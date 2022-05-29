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
import Decimal from "decimal.js";

import { toOrcaFarmType, VaultClient } from "../../sdk/src/vault";
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
  clusterToNetwork,
  toOrcaU64,
  scaleToOrcaU64,
  getOrcaPool,
  getAquafarm,
  getDoubleDipFarm,
  findAssociatedTokenAddress,
} from "@ora-protocol/sdk";

import {
  setupPoolInitialization,
  FEES,
  AMP_FACTOR,
  sendAndConfirmTransactionWithTitle,
} from "./helpers/saber/pool";

import {
  getOrca,
  Network,
  OrcaFarmConfig,
  OrcaPoolConfig,
  OrcaU64,
} from "@orca-so/sdk";
import { OrcaPoolParams } from "@orca-so/sdk/dist/model/orca/pool/pool-types";
import { OrcaFarmParams } from "@orca-so/sdk/dist/model/orca/farm/farm-types";
import { Orca } from "@orca-so/sdk/dist/public/main/types";
import { ZERO_U64 } from "../../sdk/src/common/constant";

program.version("0.0.1");
log.setLevel("info");

const COIN_GECKO_SYMBOLS = {
  usdc: "usd-coin",
  usdt: "tether",
  zbc: "zebec-protocol",
};

export const toCoinGeckoNames = (tokens: string[]): string[] => {
  return tokens.map((token) => {
    if (token in COIN_GECKO_SYMBOLS) {
      return COIN_GECKO_SYMBOLS[token];
    }
    return token;
  });
};

export const DEFAULT_HURDLE_RATE = 1000;
export const DEFAULT_PERIOD_IN_SECONDS = 1 * 24 * 60 * 60;
export const DEFAULT_TOKEN_DECIMALS = 6;

// ============================================================================
// show account data commands
// ============================================================================

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

programCommand("derive_global_protocol_state").action(async (_, cmd) => {
  const { keypair, env } = cmd.opts();

  const walletKeyPair: Keypair = loadWalletKey(keypair);
  const _client = createClient(env, walletKeyPair);
  const { addr } = await _client.generateGlobalStateAddress();

  log.info("===========================================");
  log.info("Global protocol address: ", addr.toBase58());
  log.info("===========================================");
});

programCommand("init_global_protocol_state")
  .option("-t, --treasury <pubkey>", "Pubkey of the protocol treasury")
  .option("-e, --execute <boolean>", "Execute transaction or not")
  .action(async (_, cmd) => {
    const { keypair, env, treasury, execute } = cmd.opts();

    const walletKeyPair: Keypair = loadWalletKey(keypair);
    const _client = createClient(env, walletKeyPair);

    const _treasury = new PublicKey(treasury);
    const _execute = execute === "true" ? true : false;

    const { tx, addr } = await _client.initializeGlobalProtocolState(
      _treasury,
      walletKeyPair,
      _execute
    );

    log.info("===========================================");
    log.info(
      `✅ Initialized global protocol state with public key [${addr.toBase58()}] in tx [${tx}]`
    );
    log.info("===========================================");
  });

programCommand("show_global_protocol_state")
  .option("-p, --pubkey <pubkey>", "Pubkey of global protocol state pubkey")
  .action(async (_, cmd) => {
    const { keypair, env, pubkey } = cmd.opts();

    const walletKeyPair: Keypair = loadWalletKey(keypair);
    const _client = createClient(env, walletKeyPair);
    const _pubkey = new PublicKey(pubkey);
    const globalState = await _client.fetchGlobalState(_pubkey);

    log.info("===========================================");
    log.info("Global state protocol");
    log.info("Address: ", _pubkey.toBase58());
    log.info("Bump: ", globalState.bump);
    log.info("Authority: ", globalState.authority.toBase58());
    log.info("Active: ", globalState.active);
    log.info("Treasury: ", globalState.treasury.toBase58());
    log.info("===========================================");
  });

programCommand("init_saber_strategy")
  .option(
    "-a, --tokenA <pubkey>",
    "Pubkey of the token A associated with the strategy"
  )
  .option(
    "-b, --tokenB <pubkey>",
    "Pubkey of the token B associated with the strategy"
  )
  .option("-s, --swap <pubkey>", "Pubkey of the saber pool")
  .option("-lp, --lpToken <pubkey>", "LP token associated with the pool")
  .option("-e, --execute <boolean>", "Execute transaction or not")
  .action(async (_, cmd) => {
    const { keypair, env, tokenA, tokenB, swap, lpToken, execute } = cmd.opts();

    const walletKeyPair: Keypair = loadWalletKey(keypair);
    const _client = createClient(env, walletKeyPair);

    const _tokenA = new PublicKey(tokenA);
    const _tokenB = new PublicKey(tokenB);
    const _swap = new PublicKey(swap);
    const _lpToken = new PublicKey(lpToken);
    const _execute = execute === "true" ? true : false;

    const { tx, strategy } = await _client.initializeSaberStrategy(
      _tokenA,
      _tokenB,
      _swap,
      _lpToken,
      walletKeyPair,
      _execute
    );

    log.info("===========================================");
    log.info(
      `✅ Created strategy with public key [${strategy.toBase58()}] in tx [${tx}]`
    );
    log.info("===========================================");
  });

programCommand("find_orca_pools")
  .option(
    "-ta, --tickerA <pubkey>",
    "Ticker for token A for which we want to find a pool"
  )
  .option(
    "-tb, --tickerB <pubkey>",
    "Ticker for token B for which we want to find a pool"
  )
  .action(async (_, cmd) => {
    const { keypair, env, tickerA, tickerB } = cmd.opts();

    const walletKeyPair: Keypair = loadWalletKey(keypair);
    const _client = createClient(env, walletKeyPair);
    const orca = getOrca(_client.provider.connection, clusterToNetwork(env));

    const p1 = `${tickerA}_${tickerB}`;
    const p2 = `${tickerB}_${tickerA}`;
    for (const pair of [p1, p2]) {
      try {
        console.log("================= Pool Info =======================");
        const pool = orca.getPool(OrcaPoolConfig[pair]);
        const poolParams: OrcaPoolParams = (pool as any).poolParams;
        console.log(`Pool for ${pair}: ${poolParams.address.toBase58()}`);

        const _tokenA = pool.getTokenA();
        console.log(`tokenA: ${_tokenA.name} => ${_tokenA.mint.toBase58()}`);
        const _tokenB = pool.getTokenB();
        console.log(`tokenB: ${_tokenB.name} => ${_tokenB.mint.toBase58()}`);
        const poolTokenMint = pool.getPoolTokenMint();
        console.log(`poolTokenMint: ${poolTokenMint.toBase58()}`);
      } catch (_: any) {
        console.log(`No pool for ${pair}`);
      }
    }
  });

programCommand("init_orca_strategy")
  .option("-osp, --orcaSwapProgram <pubkey>", "Orca Swap Program")
  .option("-ofp, --orcaFarmProgram <pubkey>", "Orca Farm Program")
  .option("-p, --pair <string>", "Orca pool pair (e.g. ORCA_SOL)")
  .option("-e, --execute <boolean>", "Execute transaction or not")
  .action(async (_, cmd) => {
    const { keypair, env, orcaSwapProgram, orcaFarmProgram, pair, execute } =
      cmd.opts();

    const _orcaSwapProgram = new PublicKey(orcaSwapProgram);
    const _orcaFarmProgram = new PublicKey(orcaFarmProgram);
    const _execute = execute === "true" ? true : false;

    const walletKeyPair: Keypair = loadWalletKey(keypair);
    const _client = createClient(env, walletKeyPair);

    try {
      const { tx, strategy } = await _client.initializeOrcaStrategy(
        _orcaSwapProgram,
        _orcaFarmProgram,
        pair,
        walletKeyPair,
        _execute
      );

      log.info("===========================================");
      log.info(
        `✅ Created strategy with public key [${strategy.toBase58()}] in tx [${tx}]`
      );
      log.info("===========================================");
    } catch (error: any) {
      log.error(error);
    }
  });

programCommand("show_orca_strategy")
  .option("-a, --addr <pubkey>", "Pubkey of the strategy")
  .action(async (_, cmd) => {
    const { keypair, env, addr } = cmd.opts();

    const walletKeyPair: Keypair = loadWalletKey(keypair);
    const _client = createClient(env, walletKeyPair);
    const _addr = new PublicKey(addr);

    const strategy = await _client.fetchOrcaLpStrategyV0(_addr);

    log.info("===========================================");
    log.info("Orca strategy info");
    log.info("Address: ", _addr.toBase58());
    log.info("Bump: ", strategy.bump);
    log.info("===========================================");
    log.info("Flag: ", strategy.flag.toNumber());
    log.info("Version: ", strategy.version);
    log.info("Swap program: ", strategy.swapProgram.toBase58());
    log.info("Farm program: ", strategy.farmProgram.toBase58());
    log.info("Token A: ", strategy.tokenA.toBase58());
    log.info("Token B: ", strategy.tokenB.toBase58());
    log.info("Base LP: ", strategy.baseLp.toBase58());
    log.info("Farm LP: ", strategy.farmLp.toBase58());
    if (strategy.doubleDipLp) {
      log.info("Double dip LP: ", strategy.doubleDipLp.toBase58());
    } else {
      log.info("No double dip LP for strategy");
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
  .option(
    "-aca, --assetCapA <number>",
    "Limit the amount of asset A that can be deposited by all users"
  )
  .option(
    "-uca, --userCapA <number>",
    "Limit the amount of asset A that can be deposited by a single user"
  )
  .option("-ba, --beta <pubkey>", "Mint of the vault's beta asset")
  .option(
    "-acb, --assetCapB <number>",
    "Limit the amount of asset B that can be deposited by all users"
  )
  .option(
    "-ucb, --userCapB <number>",
    "Limit the amount of asset B that can be deposited by a single user"
  )
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
  .option("-e, --execute <boolean>", "Execute transaction or not")
  .action(async (_, cmd) => {
    const {
      keypair,
      env,
      strategist,
      strategy,
      alpha,
      assetCapA,
      userCapA,
      beta,
      assetCapB,
      userCapB,
      fixedRate,
      startAt,
      depositPeriod,
      livePeriod,
      execute,
    } = cmd.opts();

    const walletKeyPair: Keypair = loadWalletKey(keypair);
    const _client = createClient(env, walletKeyPair);
    const _execute = execute === "true" ? true : false;

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

    const _assetCapA: u64 | null = assetCapA ? new u64(+assetCapA) : null;
    const _userCapA: u64 | null = userCapA ? new u64(+userCapA) : null;
    const _assetCapB: u64 | null = assetCapB ? new u64(+assetCapB) : null;
    const _userCapB: u64 | null = userCapB ? new u64(+userCapB) : null;

    const vaultConfig: VaultConfig = {
      authority: _authority,
      strategy: _strategy,
      strategist: _strategist,
      alpha: {
        mint: _alpha,
        userCap: _userCapA,
        assetCap: _assetCapA,
      },
      beta: {
        mint: _beta,
        userCap: _userCapB,
        assetCap: _assetCapB,
      },
      fixedRate: _fixedRate,
      startAt: new u64(getTimestamp(_startAt)),
      investAt: new u64(getTimestamp(_investAt)),
      redeemAt: new u64(getTimestamp(_redeemAt)),
    };

    await _client.initializeVault(vaultConfig, walletKeyPair, _execute);

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

    log.info("=== Claims ===");
    log.info("Claims processed: ", alpha.claimsProcessed);
    log.info(
      "Claims index: ",
      alpha.claimsIdx ? alpha.claimsIdx.toNumber() : "Not defined"
    );

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

    log.info("=== Claims ===");
    log.info("Claims processed: ", beta.claimsProcessed);
    log.info(
      "Claims index: ",
      beta.claimsIdx ? beta.claimsIdx.toNumber() : "Not defined"
    );

    if (_vault.farmVault) {
      log.info("Farm vault: ", _vault.farmVault.toBase58());
    } else {
      log.info("Farm vault not assigned yet. ");
    }

    log.info("Authority: ", _vault.authority.toBase58());
    log.info("Strategy: ", _vault.strategy.toBase58());
    log.info("Strategist: ", _vault.strategist.toBase58());
    log.info("Fixed rate: ", _vault.fixedRate);
    log.info("State: ", _vault.state);
    log.info("Vault start at: ", _vault.startAt.toNumber());
    log.info("Vault invest at: ", _vault.investAt.toNumber());
    log.info("Vault redeem at: ", _vault.redeemAt.toNumber());
  });

programCommand("show_receipts")
  .option(
    "-v, --vault <pubkey>",
    "Public key of the vault into which you want to deposit funds"
  )
  .option("-m --mint <pubkey>", "Public key of the asset you want to deposit")
  .option("-e, --execute <boolean>", "Execute transaction or not")
  .action(async (_, cmd) => {
    const { keypair, env, vault, mint, execute } = cmd.opts();

    const walletKeyPair: Keypair = loadWalletKey(keypair);
    const _client = createClient(env, walletKeyPair);
    const _execute = execute === "true" ? true : false;
    const _mint = new PublicKey(mint);
    const _vault = new PublicKey(vault);
    const __vault = await _client.fetchVault(_vault);
    const _asset = _client.getAsset(toIVault(__vault), _mint);
    const numDeposits = _asset.deposits.toNumber();
    console.log(`numDeposits for ${_mint.toBase58()}: ${numDeposits}`);
    console.log("===========================================");

    for (let i = numDeposits; i > 0; i--) {
      const { addr: receipt } = await _client.generateReceiptAddress(
        _vault,
        _mint,
        toU64(i)
      );

      const _receipt = await _client.fetchReceipt(receipt);

      console.log(`deposit ${i}'s receipt ${receipt.toBase58()}: `);
      console.log("bump: ", _receipt.bump);
      console.log("amount: ", _receipt.amount.toNumber());
      console.log("cumulative: ", _receipt.cumulative.toNumber());
      console.log("depositor: ", _receipt.depositor.toBase58());
      console.log("===========================================");
    }
  });

programCommand("show_depositors")
  .option(
    "-v, --vault <pubkey>",
    "Public key of the vault into which you want to deposit funds"
  )
  .option("-m --mint <pubkey>", "Public key of the asset you want to deposit")
  .action(async (_, cmd) => {
    const { keypair, env, vault, mint } = cmd.opts();

    const walletKeyPair: Keypair = loadWalletKey(keypair);
    const _client = createClient(env, walletKeyPair);

    const _mint = new PublicKey(mint);
    const _vault = new PublicKey(vault);
    const __vault = await _client.fetchVault(_vault);
    const _asset = _client.getAsset(toIVault(__vault), _mint);
    const numDeposits = _asset.deposits.toNumber();
    console.log(`numDeposits for ${_mint.toBase58()}: ${numDeposits}`);

    const depositors = new Map<string, number>();

    for (let i = numDeposits; i > 0; i--) {
      const { addr: receipt } = await _client.generateReceiptAddress(
        _vault,
        _mint,
        toU64(i)
      );

      const _receipt = await _client.fetchReceipt(receipt);

      const _depositor = _receipt.depositor.toBase58();
      if (!depositors.has(_depositor)) {
        depositors.set(_depositor, 0);
      }
      depositors.set(_depositor, depositors.get(_depositor) + 1);
    }

    console.log(
      `Vault [${_vault.toBase58()}] with asset ${_asset.mint.toBase58()} had ${numDeposits} fromm ${
        depositors.size
      } unique depositors`
    );
    console.log("==========================================================");

    for (const d of depositors) {
      console.log(`Depositor ${d[0]} had ${d[1]} deposits`);
    }
  });

programCommand("show_deposit_history")
  .option(
    "-v, --vault <pubkey>",
    "Public key of the vault into which you want to deposit funds"
  )
  .option("-m --mint <pubkey>", "Public key of the asset you want to deposit")
  .option("-d --depositor <pubkey>", "Public key of the depositor")
  .action(async (_, cmd) => {
    const { keypair, env, vault, mint, depositor } = cmd.opts();

    const walletKeyPair: Keypair = loadWalletKey(keypair);
    const _client = createClient(env, walletKeyPair);

    const _vault = new PublicKey(vault);
    const _depositor = new PublicKey(depositor);

    const __vault = await _client.fetchVault(_vault);

    let mints = [];
    if (mint) {
      mints.push(new PublicKey(mint));
    } else {
      mints.push(__vault.alpha.mint, __vault.beta.mint);
    }

    log.info("===========================================");
    log.info(`Deposit history for ${_depositor.toBase58()}`);
    for (const _mint of mints) {
      const _asset = _client.getAsset(toIVault(__vault), _mint);
      const numDeposits = _asset.deposits.toNumber();
      console.log(`> Num deposits for ${_mint.toBase58()}: ${numDeposits}`);

      const { addr: history, bump } = await _client.generateHistoryAddress(
        _vault,
        _mint,
        _depositor
      );

      try {
        const _history = await _client.fetchHistory(history);

        log.info(`Account: ${history}`);
        log.info(`Bump: ${bump}`);
        log.info(`Initialized: ${_history.intialized}`);
        log.info(`Deposits: ${_history.deposits.toNumber()}`);
        log.info(`Cumulative: ${_history.cumulative.toNumber()}`);
        log.info(`Claim: ${_history.claim.toNumber()}`);
        log.info(`CanClaimTrancheLp: ${_history.canClaimTrancheLp}`);
        log.info("===========================================");
      } catch (err: any) {
        // no-op
      }
    }
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
  .option("-e, --execute <boolean>", "Execute transaction or not")
  .action(async (_, cmd) => {
    const { keypair, env, vault, mint, amount, execute } = cmd.opts();

    const walletKeyPair: Keypair = loadWalletKey(keypair);
    const _client = createClient(env, walletKeyPair);
    const _execute = execute === "true" ? true : false;

    const _vault = new PublicKey(vault);
    const _mint = new PublicKey(mint);
    const decimals = (await _client.fetchTokenSupply(_mint)).decimals;
    const _amount = toU64(+amount * 10 ** decimals);

    await _client.deposit(_vault, _mint, _amount, walletKeyPair, _execute);

    log.info("===========================================");
    log.info(
      `Deposited ${_amount.toNumber()} of ${_mint.toBase58()} into vault ${_vault.toBase58()}`
    );
    log.info("===========================================");
  });

programCommand("claim")
  .option(
    "-v, --vault <pubkey>",
    "Public key of the vault into which you want to deposit funds"
  )
  .option("-m --mint <pubkey>", "Public key of the asset you want to deposit")
  .option("-e, --execute <boolean>", "Execute transaction or not")
  .action(async (_, cmd) => {
    const { keypair, env, vault, mint, execute } = cmd.opts();

    const walletKeyPair: Keypair = loadWalletKey(keypair);
    const _client = createClient(env, walletKeyPair);
    const _vault = new PublicKey(vault);
    const _mint = new PublicKey(mint);
    const _execute = execute === "true" ? true : false;

    const tx = await _client.claim(_vault, _mint, walletKeyPair, _execute);

    log.info("===========================================");
    log.info(
      `Entity attempted to invoke claim for mint ${_mint.toBase58()} in vault ${_vault.toBase58()}; Details in TX: ${tx}`
    );
    log.info("===========================================");
  });

programCommand("process_claims")
  .option(
    "-v, --vault <pubkey>",
    "Public key of the vault into which you want to deposit funds"
  )
  .option("-m --mint <pubkey>", "Public key of the asset you want to deposit")
  .option("-e, --execute <boolean>", "Execute transaction or not")
  .action(async (_, cmd) => {
    const { keypair, env, vault, mint, execute } = cmd.opts();

    const walletKeyPair: Keypair = loadWalletKey(keypair);
    const _client = createClient(env, walletKeyPair);
    const _vault = new PublicKey(vault);
    const _mint = new PublicKey(mint);
    const _execute = execute === "true" ? true : false;

    const { tx, claimsProcessed } = await _client.processClaims(
      _vault,
      _mint,
      walletKeyPair,
      _execute
    );

    log.info("===========================================");
    log.info(
      `Processed claims = ${claimsProcessed} with details in TX = ${tx}`
    );
    log.info("===========================================");
  });

programCommand("withdraw")
  .option(
    "-v, --vault <pubkey>",
    "Public key of the vault into which you want to deposit funds"
  )
  .option("-m --mint <pubkey>", "Public key of the asset you want to deposit")
  .option(
    "-a --amount <number>",
    "Amount of funds to deposit. Ignore the decimal calculation - just provide the raw amount."
  )
  .option("-e, --execute <boolean>", "Execute transaction or not")
  .action(async (_, cmd) => {
    const { keypair, env, vault, mint, trancheToken, amount, execute } =
      cmd.opts();

    const walletKeyPair: Keypair = loadWalletKey(keypair);
    const _client = createClient(env, walletKeyPair);
    const _execute = execute === "true" ? true : false;

    const _vault = new PublicKey(vault);
    const _mint = new PublicKey(mint);
    // const _trancheToken = new PublicKey(trancheToken);

    const __vault = await _client.fetchVault(_vault);
    const asset = _client.getAsset(toIVault(__vault), _mint);

    let _amount = ZERO_U64;
    if (amount !== null) {
      const balance = await _client.fetchTokenBalance(
        asset.lp,
        walletKeyPair.publicKey
      );
      _amount = toU64(balance);
    }
    console.log("amount to withdraw: ", _amount.toNumber());

    const tx = await _client.withdraw(
      _vault,
      _mint,
      asset.lp,
      walletKeyPair,
      _amount,
      _execute
    );

    log.info("===========================================");
    log.info(
      `Withdrew ${_amount.toNumber()} of ${asset.lp.toBase58()} LP for underlying mint ${_mint.toBase58()} from vault ${_vault.toBase58()} in TX ${tx}`
    );
    log.info("===========================================");
  });

// ============================================================================
// orca related commands
// ============================================================================

programCommand("get_invest_estimate_for_pool")
  .option("-p, --pair <string>", "Orca pool pair (e.g. ORCA_SOL)")
  .option("-a, --amountA <number>", "adsf")
  .option("-b, --amountB <number>", "asdf")
  .action(async (_, cmd) => {
    const { keypair, env, pair, amountA, amountB } = cmd.opts();

    const walletKeyPair: Keypair = loadWalletKey(keypair);
    const _client = createClient(env, walletKeyPair);
    const _amountA = +amountA;
    const _amountB = +amountB;

    const orca = getOrca(_client.provider.connection, clusterToNetwork(env));
    const { pool } = getOrcaPool(orca, pair);

    const tokenA = pool.getTokenA();
    const tokenAName = tokenA.name.toLowerCase();
    const tokenB = pool.getTokenB();
    const tokenBName = tokenB.name.toLowerCase();

    const tokenPrices = await fetchTokenPrices([tokenAName, tokenBName]);
    const tokenAInUsd = tokenPrices.get(tokenAName);
    const tokenAAsUsd = _amountA * tokenAInUsd;

    const tokenBInUsd = tokenPrices.get(tokenBName);
    const tokenBAsUsd = _amountB * tokenBInUsd;

    // get min
    let inputAlpha: number = 0;
    let inputBeta: number = 0;
    if (tokenAAsUsd > tokenBAsUsd) {
      // compute equivalent alpha to match beta
      inputAlpha = tokenBAsUsd / tokenAInUsd;
      inputBeta = tokenBAsUsd / tokenBInUsd;
    } else if (tokenAAsUsd < tokenBAsUsd) {
      // compute equivalent beta to match alpha
      inputAlpha = tokenAAsUsd / tokenAInUsd;
      inputBeta = tokenAAsUsd / tokenBInUsd;
    } else {
      inputAlpha = tokenAAsUsd / tokenAInUsd;
      inputBeta = tokenBAsUsd / tokenBInUsd;
    }

    console.log("inputAlpha: ", inputAlpha);
    console.log("inputBeta: ", inputBeta);

    const quote = await pool.getDepositQuote(
      new Decimal(inputAlpha),
      new Decimal(inputBeta)
    );
    console.log("quote::out => ", quote.minPoolTokenAmountOut.toNumber());
    console.log("quote::maxAIn => ", quote.maxTokenAIn.toNumber());
    console.log("quote::maxBIn => ", quote.maxTokenBIn.toNumber());
  });

programCommand("get_invest_estimate")
  .option("-v, --vault <pubkey>", "Vault pubkey")
  .option("-p, --pair <string>", "Orca pool pair (e.g. ORCA_SOL)")
  .action(async (_, cmd) => {
    const { keypair, env, vault, pair } = cmd.opts();

    const walletKeyPair: Keypair = loadWalletKey(keypair);
    const _client = createClient(env, walletKeyPair);
    const _vault = new PublicKey(vault);

    const orca = getOrca(_client.provider.connection, clusterToNetwork(env));
    const { pool } = getOrcaPool(orca, pair);
    const __vault = await _client.fetchVault(_vault);

    const tokenA = pool.getTokenA();
    const tokenAName = tokenA.name.toLowerCase();
    const tokenB = pool.getTokenB();
    const tokenBName = tokenB.name.toLowerCase();

    const tokenPrices = await fetchTokenPrices([tokenAName, tokenBName]);
    console.log("tokenPrices: ", tokenPrices);

    // map tokens to tranches
    const alphaDecimals = (await _client.fetchTokenSupply(__vault.alpha.mint))
      .decimals;
    const alphaAsDecimal =
      __vault.alpha.deposited.toNumber() / 10 ** alphaDecimals;
    console.log("alphaAsDecimal: ", alphaAsDecimal);
    const betaDecimals = (await _client.fetchTokenSupply(__vault.beta.mint))
      .decimals;
    const betaAsDecimal =
      __vault.beta.deposited.toNumber() / 10 ** betaDecimals;
    console.log("betaAsDecimal: ", betaAsDecimal);

    console.log("tokenPrices[tokenAName]: ", tokenPrices.get(tokenAName));
    console.log("tokenPrices[tokenBName]: ", tokenPrices.get(tokenBName));

    const alphaInUsd =
      __vault.alpha.mint.toBase58() === tokenA.mint.toBase58()
        ? tokenPrices.get(tokenAName)
        : tokenPrices.get(tokenBName);
    const alphaAsUsd = alphaAsDecimal * alphaInUsd;
    console.log("alphaAsUsd: ", alphaAsUsd);

    const betaInUsd =
      __vault.beta.mint.toBase58() === tokenA.mint.toBase58()
        ? tokenPrices.get(tokenAName)
        : tokenPrices.get(tokenBName);
    const betaAsUsd = betaAsDecimal * betaInUsd;
    console.log("betaAsUsd: ", betaAsUsd);

    // get min
    let inputAlpha: number = 0;
    let inputBeta: number = 0;
    if (alphaAsUsd > betaAsUsd) {
      // compute equivalent alpha to match beta
      inputAlpha = betaAsUsd / alphaInUsd;
      inputBeta = betaAsUsd / betaInUsd;
    } else if (alphaAsUsd < betaAsUsd) {
      // compute equivalent beta to match alpha
      inputAlpha = alphaAsUsd / alphaInUsd;
      inputBeta = alphaAsUsd / betaInUsd;
    } else {
      inputAlpha = alphaAsUsd / alphaInUsd;
      inputBeta = betaAsUsd / betaInUsd;
    }

    console.log("inputAlpha: ", inputAlpha);
    console.log("inputBeta: ", inputBeta);

    const quote = await pool.getDepositQuote(
      new Decimal(inputAlpha),
      new Decimal(inputBeta)
    );
    console.log("quote::out => ", quote.minPoolTokenAmountOut.toNumber());
    console.log("quote::maxAIn => ", quote.maxTokenAIn.toNumber());
    console.log("quote::maxBIn => ", quote.maxTokenBIn.toNumber());
  });

export const fetchTokenPrices = async (
  tokens: string[],
  currency: string = "usd"
): Promise<Map<string, number>> => {
  console.log("tokens: ", tokens);
  // const _tokens = toCoinGeckoNames(tokens);
  const _tokens = tokens.map((_token) => _token.replace(" ", "-"));
  console.log("_tokens: ", _tokens);

  const uri = `https://api.coingecko.com/api/v3/simple/price?ids=${_tokens.join(
    ","
  )}&vs_currencies=${currency}`;

  console.log("uri: ", uri);
  const result = await fetch(uri)
    .then((response) => response.json())
    .then((result) => result);

  const tokenToPrice = new Map<string, number>();

  // results are in terms of `_tokens`, but caller expects `tokens` naming convention
  _tokens.forEach((token, idx) => {
    tokenToPrice.set(tokens[idx], +result[token][currency]);
  });

  return tokenToPrice;
};

programCommand("initialize_user_farm")
  .option("-v, --vault <pubkey>", "Vault pubkey")
  .option("-ofp, --orcaFarmProgram <pubkey>", "Orca Farm Program")
  .option("-ft, --farmType <string>", "Farm type: aquafarm or double-dip")
  .option("-p, --pair <string>", "Orca pool pair (e.g. ORCA_SOL)")
  .option("-e, --execute <boolean>", "Execute transaction or not")
  .action(async (_, cmd) => {
    const { keypair, env, vault, orcaFarmProgram, farmType, pair, execute } =
      cmd.opts();

    // todo: validate farm type better
    const validFarmTypes = ["aquafarm", "double-dip"];
    if (!farmType || !validFarmTypes.includes(farmType))
      throw new Error("Must provide valid farm type");

    const walletKeyPair: Keypair = loadWalletKey(keypair);
    const _client = createClient(env, walletKeyPair);
    const _vault = new PublicKey(vault);
    const _orcaFarmProgram = new PublicKey(orcaFarmProgram);
    const _execute = execute === "true" ? true : false;

    const connection = new Connection(clusterApiUrl(env), "singleGossip");
    const orca = getOrca(connection, Network.DEVNET);
    // todo: create soe sort of enum to represent farm type?
    const farmParams =
      farmType === "aquafarm"
        ? getAquafarm(orca, pair)
        : getDoubleDipFarm(orca, pair);

    const tx = await _client.initializeUserFarmOrca(
      _vault,
      _orcaFarmProgram,
      farmParams,
      walletKeyPair,
      _execute
    );

    log.info("===========================================");
    log.info(
      `Initialized user farm for farm ${farmParams.address.toBase58()} with base token mint ${farmParams.baseTokenMint.toBase58()}, farm token mint ${farmParams.farmTokenMint.toBase58()}, and reward token mint ${farmParams.rewardTokenMint.toBase58()} for vault ${_vault.toBase58()} in TX: ${tx}`
    );
    log.info("===========================================");
  });

programCommand("invest_orca")
  .option("-v, --vault <pubkey>", "Vault pubkey")
  .option("-osp, --orcaSwapProgram <pubkey>", "Orca Swap Program")
  .option("-p, --pair <string>", "Orca pool pair (e.g. ORCA_SOL)")
  .option("-a, --alpha <number>", "Amount of alpha asset to invest")
  .option("-b, --beta <number>", "Amount of beta asset to invest")
  .option("-e, --execute <boolean>", "Execute transaction or not")
  .action(async (_, cmd) => {
    const { keypair, env, vault, orcaSwapProgram, pair, alpha, beta, execute } =
      cmd.opts();

    if (!alpha && !beta) throw new Error("Provide alpha or beta");

    const walletKeyPair: Keypair = loadWalletKey(keypair);
    const _client = createClient(env, walletKeyPair);
    const _vault = new PublicKey(vault);
    const _orcaSwapProgram = new PublicKey(orcaSwapProgram);
    const _alpha = new Decimal(alpha);
    const _beta = new Decimal(beta);
    const _execute = execute === "true" ? true : false;

    const tx = await _client.investOrca(
      _vault,
      _orcaSwapProgram,
      pair,
      _alpha,
      _beta,
      walletKeyPair,
      _execute
    );
    console.log(
      `Invested ${_alpha.toNumber()} of token A and ${_beta.toNumber()} of token B in TX = ${tx}`
    );
  });

programCommand("redeem_orca")
  .option("-v, --vault <pubkey>", "Vault pubkey")
  .option("-osp, --orcaSwapProgram <pubkey>", "Orca Swap Program")
  .option("-p, --pair <string>", "Orca pool pair (e.g. ORCA_SOL)")
  // .option("-lp, --lpAmount <number>", "Amount of LP to withdraw")
  .option("-e, --execute <boolean>", "Execute transaction or not")
  .action(async (_, cmd) => {
    const { keypair, env, vault, orcaSwapProgram, pair, execute } = cmd.opts();

    const walletKeyPair: Keypair = loadWalletKey(keypair);
    const _client = createClient(env, walletKeyPair);
    const _vault = new PublicKey(vault);
    const _orcaSwapProgram = new PublicKey(orcaSwapProgram);
    const _execute = execute === "true" ? true : false;

    try {
      const tx = await _client.redeemOrca(
        _vault,
        _orcaSwapProgram,
        pair,
        walletKeyPair,
        _execute
      );

      log.info("===========================================");
      log.info(`Redeemed LP from ${pair} on vault ${_vault} in TX: ${tx}`);
      log.info("===========================================");
    } catch (error: any) {
      log.error(error);
    }
  });

programCommand("convert_lp_tokens")
  .option("-v, --vault <pubkey>", "Vault pubkey")
  .option("-ofp, --orcaFarmProgram <pubkey>", "Orca Farm Program")
  .option("-ft, --farmType <string>", "Farm type: aquafarm or double-dip")
  .option("-p, --pair <string>", "Orca pool pair (e.g. ORCA_SOL)")
  .option("-e, --execute <boolean>", "Execute transaction or not")
  .action(async (_, cmd) => {
    const { keypair, env, vault, orcaFarmProgram, farmType, pair, execute } =
      cmd.opts();

    // todo: validate farm type better
    const validFarmTypes = ["aquafarm", "double-dip"];
    if (!farmType || !validFarmTypes.includes(farmType))
      throw new Error("Must provide valid farm type");

    const walletKeyPair: Keypair = loadWalletKey(keypair);
    const _client = createClient(env, walletKeyPair);
    const _vault = new PublicKey(vault);
    const _orcaFarmProgram = new PublicKey(orcaFarmProgram);
    const _execute = execute === "true" ? true : false;

    try {
      const tx = await _client.convertOrcaLp(
        _vault,
        _orcaFarmProgram,
        pair,
        toOrcaFarmType(farmType),
        walletKeyPair,
        _execute
      );

      log.info("===========================================");
      log.info(`Converted base LP to farm LP in TX: ${tx}`);
      log.info("===========================================");
    } catch (error: any) {
      log.error(error);
    }
  });

programCommand("harvest")
  .option("-v, --vault <pubkey>", "Vault pubkey")
  .option("-ofp, --orcaFarmProgram <pubkey>", "Orca Farm Program")
  .option("-ft, --farmType <string>", "Farm type: aquafarm or double-dip")
  .option("-p, --pair <string>", "Orca pool pair (e.g. ORCA_SOL)")
  .option("-e, --execute <boolean>", "Execute transaction or not")
  .action(async (_, cmd) => {
    const { keypair, env, vault, orcaFarmProgram, farmType, pair, execute } =
      cmd.opts();

    // todo: validate farm type better
    const validFarmTypes = ["aquafarm", "double-dip"];
    if (!farmType || !validFarmTypes.includes(farmType))
      throw new Error("Must provide valid farm type");

    const walletKeyPair: Keypair = loadWalletKey(keypair);
    const _client = createClient(env, walletKeyPair);
    const _vault = new PublicKey(vault);
    const _orcaFarmProgram = new PublicKey(orcaFarmProgram);
    const _execute = execute === "true" ? true : false;

    try {
      const tx = await _client.harvestOrca(
        _vault,
        _orcaFarmProgram,
        pair,
        toOrcaFarmType(farmType),
        walletKeyPair,
        _execute
      );

      log.info("===========================================");
      log.info(`Harvested rewards for farm of pair ${pair} in TX: ${tx}`);
      log.info("===========================================");
    } catch (error: any) {
      log.error(error);
    }
  });

programCommand("revert_lp_tokens")
  .option("-v, --vault <pubkey>", "Vault pubkey")
  .option("-ofp, --orcaFarmProgram <pubkey>", "Orca Farm Program")
  .option("-ft, --farmType <string>", "Farm type: aquafarm or double-dip")
  .option("-p, --pair <string>", "Orca pool pair (e.g. ORCA_SOL)")
  .option("-e, --execute <boolean>", "Execute transaction or not")
  .action(async (_, cmd) => {
    const { keypair, env, vault, orcaFarmProgram, farmType, pair, execute } =
      cmd.opts();

    // todo: validate farm type better
    const validFarmTypes = ["aquafarm", "double-dip"];
    if (!farmType || !validFarmTypes.includes(farmType))
      throw new Error("Must provide valid farm type");

    const walletKeyPair: Keypair = loadWalletKey(keypair);
    const _client = createClient(env, walletKeyPair);
    const _vault = new PublicKey(vault);
    const _orcaFarmProgram = new PublicKey(orcaFarmProgram);
    const _execute = execute === "true" ? true : false;

    try {
      const tx = await _client.revertOrcaLp(
        _vault,
        _orcaFarmProgram,
        pair,
        toOrcaFarmType(farmType),
        walletKeyPair,
        _execute
      );

      log.info("===========================================");
      log.info(`Reverted farm LP to base LP in TX: ${tx}`);
      log.info("===========================================");
    } catch (error: any) {
      log.error(error);
    }
  });

// specifically, for auto-compounding since we are using swapFromFarmVault. maybe we can have a generalized function
// and instruction that takes in a boolean or something, tellinig ixn who authority is.
programCommand("swap")
  .option("-v, --vault <pubkey>", "Vault pubkey")
  .option("-osp, --orcaSwapProgram <pubkey>", "Orca Swap Program")
  .option("-p, --pair <string>", "Orca pool pair (e.g. ORCA_SOL)")
  .option("-ti, --tokenIn <pubkey>", "Token to swap")
  .option("-ai, --amountIn <number>", "Amount of token to deposit")
  .option("-e, --execute <boolean>", "Execute transaction or not")
  .action(async (_, cmd) => {
    const {
      keypair,
      env,
      vault,
      orcaSwapProgram,
      pair,
      tokenIn,
      amountIn,
      execute,
    } = cmd.opts();

    const walletKeyPair: Keypair = loadWalletKey(keypair);
    const _client = createClient(env, walletKeyPair);

    const _vault = new PublicKey(vault);
    const _orcaSwapProgram = new PublicKey(orcaSwapProgram);
    const _tokenIn = new PublicKey(tokenIn);
    const _execute = execute === "true" ? true : false;

    const connection = new Connection(clusterApiUrl(env), "singleGossip");
    const orca = getOrca(connection, Network.DEVNET);
    log.info("orca obj");

    try {
      const { pool, poolParams } = getOrcaPool(orca, pair);

      const __tokenIn =
        _tokenIn.toBase58() === pool.getTokenA().mint.toBase58()
          ? pool.getTokenA()
          : pool.getTokenB();

      const _amountIn = new Decimal(+amountIn);
      const quote = await pool.getQuote(__tokenIn, _amountIn);
      const outputAmount = quote.getMinOutputAmount();
      console.log(
        "amountIn: ",
        amountIn,
        ", output: ",
        outputAmount.toNumber()
      );

      const tx = await _client.swapFromFarmVault(
        _vault,
        _orcaSwapProgram,
        _tokenIn,
        _amountIn, // todo: does this? work?
        outputAmount.toDecimal(),
        poolParams,
        walletKeyPair,
        _execute
      );

      log.info("===========================================");
      log.info(
        `Swap ${_amountIn.toNumber()} of token [${_tokenIn.toBase58()}] for ${outputAmount.toNumber()} in TX: ${tx}`
      );
      log.info("===========================================");
    } catch (error: any) {
      log.error(error);
    }
  });

// ============================================================================
// misc helper commands
// ============================================================================

programCommand("cost", false)
  .option(
    "-e, --env <string>",
    "Solana cluster env name",
    "devnet" // mainnet-beta, testnet, devnet
  )
  .option("-s, --size <number>", "Rent free cost for accounts of size n")
  .action(async (_, cmd) => {
    const { env, size } = cmd.opts();

    const connection = new Connection(clusterApiUrl(env));
    const cost = await connection.getMinimumBalanceForRentExemption(+size);

    console.log(
      `Account of size ${size} costs ${cost} lamports [${
        cost / LAMPORTS_PER_SOL
      } SOL]`
    );
  });

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

// ============================================================================
// token related commands
// ============================================================================

// mint with keypair as authority since it has to sign the tx & can be used to mint new tokens.
programCommand("token_supply", false)
  .option("-m, --mint <pubkey>", "Pubkey of token to check supply of.")
  .option(
    "-e, --env <string>",
    "Solana cluster env name",
    "devnet" // mainnet-beta, testnet, devnet
  )
  .action(async (_, cmd) => {
    const { env, mint } = cmd.opts();

    const _client = createClient(env, Keypair.generate());
    const _mint = new PublicKey(mint);

    const supply = await _client.provider.connection.getTokenSupply(_mint);
    console.log(supply);
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

programCommand("get_ata", false)
  .option("-e, --env <pubkey>", "Environment (doesn't matter)")
  .option("-o, --owner <pubkey>", "Owner of ATA")
  .option("-m, --mint <pubkey>", "Mint for ATA")
  .action(async (_, cmd) => {
    const { env, owner, mint } = cmd.opts();

    const _owner = new PublicKey(owner);
    const _mint = new PublicKey(mint);

    const address = await findAssociatedTokenAddress(_owner, _mint);

    log.info("===========================================");
    console.log("ATA address: ", address.toBase58());
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
