import { Wallet } from "@project-serum/anchor";
import {
  Cluster,
  clusterApiUrl,
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  Transaction,
  TransactionResponse,
} from "@solana/web3.js";
import { program } from "commander";
import log from "loglevel";
import { u64 } from "@solana/spl-token";
import invariant from "tiny-invariant";
import {
  deployNewSwap,
  StableSwap,
  SWAP_PROGRAM_ID,
  IExchange,
  depositInstruction,
} from "@saberhq/stableswap-sdk";
import { SignerWallet } from "@saberhq/solana-contrib";

import { VaultClient } from "../../sdk/src/vault";
import { loadWalletKey } from "./helpers/account";
import { executeTx } from "../../sdk/src/common/util";
import {
  getTimestamp,
  VaultConfig,
  addSeconds,
  getOrDefault,
  getCurrentTimestamp,
  toU64,
  toIVault,
} from "@ora-protocol/sdk";

import {
  setupPoolInitialization,
  FEES,
  AMP_FACTOR,
  sendAndConfirmTransactionWithTitle,
} from "./helpers/saber/pool";

program.version("0.0.1");
log.setLevel("info");

export const DEFAULT_HURDLE_RATE = 1000;
export const DEFAULT_PERIOD_IN_SECONDS = 1 * 24 * 60 * 60;
export const DEFAULT_TOKEN_DECIMALS = 6;

// ============================================================================
// show account data commands
// ============================================================================

programCommand("ts", false)
  .option(
    "-o, --offset <number>",
    "Optional offset from current timestamp. In seconds."
  )
  .action(async (_, cmd) => {
    const { offset } = cmd.opts();

    let date = new Date();
    if (offset) {
      date = addSeconds(date, +offset);
    }

    console.log("Timestamp (with optional offset): ", date.getTime());
  });

programCommand("derive_vault")
  .option("-a, --authority <pubkey>", "Authority of the vault")
  .action(async (_, cmd) => {
    const { keypair, env, authority } = cmd.opts();

    const walletKeyPair: Keypair = loadWalletKey(keypair);
    const _client = createClient(env, walletKeyPair);
    const _publicKey = new PublicKey(authority);

    const { addr, bump } = await _client.generateVaultAddress(_publicKey);

    console.log("Vault");
    log.info("===========================================");
    log.info("Vault address: ", addr.toBase58());
    log.info("Vault bump: ", bump);
    log.info("===========================================");
  });

programCommand("init_strategy")
  .option(
    "-a, --tokenA <pubkey>",
    "Pubkey of the token A associated with the strategy"
  )
  .option(
    "-b, --tokenB <pubkey>",
    "Pubkey of the token B associated with the strategy"
  )
  .action(async (_, cmd) => {
    const { keypair, env, tokenA, tokenB } = cmd.opts();

    const walletKeyPair: Keypair = loadWalletKey(keypair);
    const _client = createClient(env, walletKeyPair);

    const _tokenA = new PublicKey(tokenA);
    const _tokenB = new PublicKey(tokenB);

    const { tx, strategy } = await _client.initializeStrategy(
      _tokenA,
      _tokenB,
      walletKeyPair
    );

    log.info("===========================================");
    log.info(
      `✅ Created strategy with public key [${strategy.toBase58()}] in tx [${tx}]`
    );
    log.info("===========================================");
  });

programCommand("decode_strategy")
  .option("-s, --strategy <pubkey>", "Pubkey of the strategy to decode")
  .action(async (_, cmd) => {
    const { keypair, env, strategy } = cmd.opts();

    const walletKeyPair: Keypair = loadWalletKey(keypair);
    const _client = createClient(env, walletKeyPair);

    const _strategy = new PublicKey(strategy);

    const result = await _client.fetchStrategy(_strategy);

    const discriminator = result.data.buffer.slice(0, 8);
    // const flags = result.data.buffer.slice(8, 16);
    const flags = result.data.filter((e, i) => i >= 8 && i < 16);

    log.info("result: ", result);
    log.info("discriminator: ", discriminator);
    log.info("flags: ", flags);

    const view = new Int8Array(flags);
    log.info("view: ", view);

    log.info("8: ", result.data.at(8));
    log.info("9: ", result.data.at(9));
    log.info("10: ", result.data.at(10));
    log.info("11: ", result.data.at(11));
    log.info("12: ", result.data.at(12));

    for (const b of result.data) {
      console.log(b);
    }

    log.info("===========================================");
  });

programCommand("init_vault")
  .option(
    "-st, --strategist <pubkey>",
    "Pubkey of the strategist that has rights to invest and redeem funds"
  )
  .option(
    "-s, --strategy <pubkey>",
    "Pubkey of the strategy used by the vault to invest and redeem funds"
  )
  .option("-aa, --alpha <pubkey>", "Mint of the vault's alpha asset")
  .option("-ba, --beta <pubkey>", "Mint of the vault's beta asset")
  .option(
    "-fr, --fixedRate <number>",
    "Fixed rate the senior tranche is guaranteed to recieve, in basis points."
  )
  .option(
    "-sa, --startAt <number>",
    "Timestamp at which the vault starts accepting deposits. In milliseconds."
  )
  .option(
    "-dp, --depositPeriod <number>",
    "Duration for which the vault accepts deposits. In seconds."
  )
  .option(
    "-lp, --livePeriod <number>",
    "Duration for which the vault invests funds. In seconds."
  )
  .action(async (_, cmd) => {
    const {
      keypair,
      env,
      strategist,
      strategy,
      alpha,
      beta,
      fixedRate,
      startAt,
      depositPeriod,
      livePeriod,
    } = cmd.opts();

    const walletKeyPair: Keypair = loadWalletKey(keypair);
    const _client = createClient(env, walletKeyPair);

    // authority defaults to keypair passed in
    let _authority = walletKeyPair.publicKey;
    const _strategy = new PublicKey(strategy);
    const _strategist = new PublicKey(strategist);
    const _alpha = new PublicKey(alpha);
    const _beta = new PublicKey(beta);
    const _fixedRate = getOrDefault(+fixedRate, DEFAULT_HURDLE_RATE);
    const _startAt = new Date(getOrDefault(+startAt, new Date().getTime()));
    const _investAt = addSeconds(
      _startAt,
      getOrDefault(+depositPeriod, DEFAULT_PERIOD_IN_SECONDS)
    );
    const _redeemAt = addSeconds(
      _investAt,
      getOrDefault(+livePeriod, DEFAULT_PERIOD_IN_SECONDS)
    );

    const vaultConfig: VaultConfig = {
      authority: _authority,
      strategy: _strategy,
      strategist: _strategist,
      alpha: _alpha,
      beta: _beta,
      fixedRate: _fixedRate,
      startAt: new u64(getTimestamp(_startAt)),
      investAt: new u64(getTimestamp(_investAt)),
      redeemAt: new u64(getTimestamp(_redeemAt)),
    };

    await _client.initializeVault(vaultConfig, walletKeyPair);

    const { addr } = await _client.generateVaultAddress(_authority);

    log.info("===========================================");
    log.info(
      `✅ Created vault with key [${addr.toBase58()}]. Run [show_vault] command to see other vault data.`
    );
    log.info("===========================================");
  });

programCommand("show_vault")
  .option("-v, --vault <pubkey>", "Vault address to display.")
  .option(
    "-a, --authority <pubkey>",
    "Vault authority. Used to derive vault address. Only required if vault isn't specified."
  )
  .action(async (_, cmd) => {
    const { keypair, env, vault, authority } = cmd.opts();

    const walletKeyPair: Keypair = loadWalletKey(keypair);
    const _client = createClient(env, walletKeyPair);

    let vAddress: PublicKey;
    if (vault) {
      vAddress = new PublicKey(vault);
    } else {
      if (!authority)
        throw new Error("authority must be specified if vault is null");

      const _authority = new PublicKey(authority);
      const { addr } = await _client.generateVaultAddress(_authority);
      vAddress = addr;
    }

    const _vault = toIVault(await _client.fetchVault(vAddress));

    log.info("===========================================");
    log.info("Data for vault: ", vAddress.toBase58());
    log.info("Vault bump: ", _vault.bump);
    log.info("===========================================");

    log.info("Alpha asset ===============================");
    const alpha = _vault.alpha;
    log.info("Mint: ", alpha.mint.toBase58());
    log.info("LP Mint: ", alpha.lp.toBase58());
    log.info(
      "Asset cap: ",
      alpha.assetCap ? alpha.assetCap.toNumber() : "No cap"
    );
    log.info("User cap: ", alpha.userCap ? alpha.userCap.toNumber() : "No cap");
    log.info("Deposits: ", alpha.deposits.toNumber());
    log.info("Deposited: ", alpha.deposited.toNumber());
    log.info("Invested: ", alpha.invested.toNumber());
    log.info("Excess: ", alpha.excess.toNumber());
    log.info("Received: ", alpha.received.toNumber());

    log.info("Beta asset ===============================");
    const beta = _vault.beta;
    log.info("Mint: ", beta.mint.toBase58());
    log.info("LP Mint: ", beta.lp.toBase58());
    log.info(
      "Asset cap: ",
      beta.assetCap ? beta.assetCap.toNumber() : "No cap"
    );
    log.info("User cap: ", beta.userCap ? beta.userCap.toNumber() : "No cap");
    log.info("Deposits: ", beta.deposits.toNumber());
    log.info("Deposited: ", beta.deposited.toNumber());
    log.info("Invested: ", beta.invested.toNumber());
    log.info("Excess: ", beta.excess.toNumber());
    log.info("Received: ", beta.received.toNumber());

    log.info("Authority: ", _vault.authority.toBase58());
    log.info("Strategy: ", _vault.strategy.toBase58());
    log.info("Strategist: ", _vault.strategist.toBase58());
    log.info("Fixed rate: ", _vault.fixedRate);
    log.info("State: ", _vault.state);
    log.info("Vault start at: ", _vault.startAt.toNumber());
    log.info("Vault invest at: ", _vault.investAt.toNumber());
    log.info("Vault redeem at: ", _vault.redeemAt.toNumber());
    log.info("===========================================");
    log.info("Excess asset: ", _vault.excess ? _vault.excess : "Not defined");
    log.info("Claims processed: ", _vault.claimsProcessed);
    log.info(
      "Claims index: ",
      _vault.claimsIdx ? _vault.claimsIdx : "Not defined"
    );
    log.info("===========================================");
  });

programCommand("deposit")
  .option(
    "-v, --vault <pubkey>",
    "Public key of the vault into which you want to deposit funds"
  )
  .option("-m --mint <pubkey>", "Public key of the asset you want to deposit")
  .option(
    "-a --amount <number>",
    "Amount of funds to deposit. Ignore the decimal calculation - just provide the raw amount."
  )
  .action(async (_, cmd) => {
    const { keypair, env, vault, mint, amount } = cmd.opts();

    const walletKeyPair: Keypair = loadWalletKey(keypair);
    const _client = createClient(env, walletKeyPair);

    const _vault = new PublicKey(vault);
    const _mint = new PublicKey(mint);
    const decimals = (await _client.fetchTokenSupply(_mint)).decimals;
    const _amount = toU64(+amount * 10 ** decimals);

    await _client.deposit(_vault, _mint, _amount, walletKeyPair);

    log.info("===========================================");
    log.info(
      `Deposited ${_amount.toNumber()} of ${_mint.toBase58()} into vault ${_vault.toBase58()}`
    );
    log.info("===========================================");
  });

// mint with keypair as authority since it has to sign the tx & can be used to mint new tokens.
programCommand("mint")
  .option(
    "-d, --decimals <number>",
    "Decimals of the token to mint. Optional: default is 6."
  )
  .action(async (_, cmd) => {
    const { keypair, env, decimals } = cmd.opts();

    const walletKeyPair: Keypair = loadWalletKey(keypair);
    const _client = createClient(env, walletKeyPair);
    const mint = Keypair.generate();

    const _decimals = decimals ? decimals : DEFAULT_TOKEN_DECIMALS;

    await executeTx(
      _client.provider.connection,
      await _client.mintTokens(
        _client.provider.connection,
        walletKeyPair.publicKey,
        mint.publicKey,
        walletKeyPair.publicKey,
        walletKeyPair.publicKey,
        _decimals
      ),
      [walletKeyPair, mint]
    );

    log.info("===========================================");
    log.info(
      `Creating token with mint [${mint.publicKey.toBase58()}] via authority [${walletKeyPair.publicKey.toBase58()}]`
    );
    log.info("===========================================");
  });

programCommand("mint_to")
  .option("-m, --mint <pubkey>", "Address of the token's mint")
  .option("-t, --to <pubkey>", "Address to which we should mint tokens")
  .option(
    "-a, --amount <number>",
    "Amount of tokens to mint. Ignore decimals, amount will be adjusted based on token decimals."
  )
  .action(async (_, cmd) => {
    const { keypair, env, to, amount, mint } = cmd.opts();

    const walletKeyPair: Keypair = loadWalletKey(keypair);
    const _client = createClient(env, walletKeyPair);
    const _to = new PublicKey(to);
    const _mint = new PublicKey(mint);

    const decimals = (await _client.fetchTokenSupply(_mint)).decimals;
    const _amount = toU64(+amount * 10 ** decimals);

    await executeTx(
      _client.provider.connection,
      await _client.initTokenAccount(
        _client.provider.connection,
        _mint,
        _to,
        walletKeyPair.publicKey,
        _amount
      ),
      [walletKeyPair]
    );

    log.info("===========================================");
    log.info(
      `Minting [${amount}] [${_mint.toBase58()}] with authority [${walletKeyPair.publicKey.toBase58()}]`
    );
    log.info("===========================================");
  });

// ============================================================================
// saber related commands
// ============================================================================

// todo: mostly for testing purposes. we don't actually need this for mainnet.
// todo: deposit into pool
programCommand("init_saber_pool")
  .option("-ta, --tokenA <pubkey>", "Token A")
  .option("-tb, --tokenB <pubkey>", "Token B")
  .action(async (_, cmd) => {
    const { keypair, env, tokenA, tokenB } = cmd.opts();

    const walletKeyPair: Keypair = loadWalletKey(keypair);
    const _authority = walletKeyPair.publicKey;

    const _connection = new Connection(clusterApiUrl(env));
    const provider = new SignerWallet(walletKeyPair).createProvider(
      _connection
    );

    const stableSwapAccount = Keypair.generate();

    const _tokenA = new PublicKey(tokenA);
    const _tokenB = new PublicKey(tokenB);

    const { seedPoolAccounts } = await setupPoolInitialization(
      _tokenA,
      _tokenB,
      walletKeyPair
    );

    const { swap, initializeArgs } = await deployNewSwap({
      provider: provider as any,
      swapProgramID: SWAP_PROGRAM_ID,
      adminAccount: _authority,
      tokenAMint: _tokenA,
      tokenBMint: _tokenB,
      ampFactor: new u64(AMP_FACTOR),
      fees: FEES,
      initialLiquidityProvider: _authority,
      useAssociatedAccountForInitialLP: true,
      seedPoolAccounts,
      swapAccountSigner: stableSwapAccount,
    });

    console.log("stableSwapAccount: ", stableSwapAccount.publicKey.toBase58());
    console.log("swap: ", swap);
    console.log("initializeArgs: ", initializeArgs);
  });

programCommand("load_pool", false)
  .option("-ssa, --stableSwapAccount <pubkey>", "Stable swap account")
  .option("-e, --env <string>", "Environment in which pool exists")
  .action(async (_, cmd) => {
    const { env, stableSwapAccount } = cmd.opts();

    const _stableSwapAccount = new PublicKey(stableSwapAccount);

    const stableSwapProgramId = new PublicKey(
      "SSwpkEEcbUqx4vtoEByFjSkhKdCT862DNVb52nZg1UZ"
    );
    const _connection = new Connection(clusterApiUrl(env));
    const fetchedStableSwap = await StableSwap.load(
      _connection,
      _stableSwapAccount,
      stableSwapProgramId
    );

    console.log("fetchedStableSwap: ", fetchedStableSwap);
  });

programCommand("deposit_into_pool")
  .option("-ssa, --stableSwapAccount <pubkey>", "Stable swap account")
  .option(
    "-pa, --poolAuthority <pubkey>",
    "Stable swap pool authority. Used to derive poolTokenAccount."
  )
  .option("-aa, --amountA <number>", "Deposit amount A")
  .option("-ab, --amountB <number>", "Deposit amount B")
  .action(async (_, cmd) => {
    const { keypair, env, stableSwapAccount, amountA, amountB, poolAuthority } =
      cmd.opts();
    const walletKeyPair: Keypair = loadWalletKey(keypair);
    const payer = walletKeyPair.publicKey;

    const _client = createClient(env, walletKeyPair);
    const _stableSwapAccount = new PublicKey(stableSwapAccount);
    const _poolAuthority = new PublicKey(poolAuthority);
    const stableSwapProgramId = new PublicKey(
      "SSwpkEEcbUqx4vtoEByFjSkhKdCT862DNVb52nZg1UZ"
    );
    const _connection = new Connection(clusterApiUrl(env));
    const stableSwap = await StableSwap.load(
      _connection,
      _stableSwapAccount,
      stableSwapProgramId
    );
    const tokenAtaA = await _client.getOrCreateATA(
      stableSwap.state.tokenA.mint,
      payer,
      payer,
      _connection
    );
    const tokenAmountA = await _client.fetchTokenBalance(
      stableSwap.state.tokenB.mint,
      payer
    );
    console.log("tokenAmountA: ", tokenAmountA);
    const tokenAtaB = await _client.getOrCreateATA(
      stableSwap.state.tokenA.mint,
      payer,
      payer,
      _connection
    );

    const tokenAmountB = await _client.fetchTokenBalance(
      stableSwap.state.tokenB.mint,
      payer
    );
    console.log("tokenAmountB: ", tokenAmountB);

    // actually must be ATA of pool authority!
    const poolTokenMintAta = await _client.getOrCreateATA(
      stableSwap.state.poolTokenMint,
      _poolAuthority,
      payer,
      _connection
    );
    const tokenAmountPoolMint = await _client.fetchTokenBalance(
      stableSwap.state.poolTokenMint,
      _poolAuthority
    );

    console.log("tokenAmountPoolMint: ", tokenAmountPoolMint);
    console.log("poolTokenMintAta: ", poolTokenMintAta.address);
    console.log("poolTokenMintAta: ", poolTokenMintAta.address.toBase58());

    // todo: adjust for decimals?
    const depositAmountA = +amountA; // LAMPORTS_PER_SOL *
    const depositAmountB = +amountB; // LAMPORTS_PER_SOL *

    // https://github.com/saber-hq/stable-swap/blob/master/stable-swap-program/sdk/test/e2e.int.test.ts#L208
    let txReceipt: TransactionResponse | null = null;
    const txn = new Transaction().add(
      stableSwap.deposit({
        userAuthority: _poolAuthority,
        sourceA: tokenAtaA.address,
        sourceB: tokenAtaB.address,
        poolTokenAccount: poolTokenMintAta.address,
        tokenAmountA: new u64(depositAmountA),
        tokenAmountB: new u64(depositAmountB),
        minimumPoolTokenAmount: new u64(0), // To avoid slippage errors
      })
    );
    const txSig = await sendAndConfirmTransactionWithTitle(
      "deposit",
      _connection,
      txn,
      walletKeyPair,
      walletKeyPair
    );
    txReceipt = await _connection.getTransaction(txSig, {
      commitment: "confirmed",
    });

    console.log("txSig: ", txSig);
    console.log("txReceipt: ", txReceipt);
  });

// ============================================================================
// helper commands
// ============================================================================

function programCommand(name: string, defaultOptions: boolean = true) {
  const executable = program.command(name);

  if (defaultOptions) {
    executable
      .option(
        "-e, --env <string>",
        "Solana cluster env name",
        "devnet" // mainnet-beta, testnet, devnet
      )
      .option(
        "-k, --keypair <path>",
        `Solana wallet location`,
        "--keypair not provided"
      );
  }

  return executable;
}

const createClient = (cluster: Cluster, keypair: Keypair) => {
  const connection =
    cluster.toLocaleLowerCase() === "localnet"
      ? "http://localhost:8899"
      : clusterApiUrl(cluster);

  return new VaultClient(new Connection(connection), new Wallet(keypair));
};

program.parse(process.argv);
