import { Wallet } from "@project-serum/anchor";
import {
  Cluster,
  clusterApiUrl,
  Connection,
  Keypair,
  PublicKey,
} from "@solana/web3.js";
import { program } from "commander";
import log from "loglevel";
import { u64 } from "@solana/spl-token";
import invariant from "tiny-invariant";

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
} from "@ora-protocol/sdk";

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

    log.info("===========================================");
    log.info("Created ✅ See vault data with [show_vault] command");
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

    const _vault = await _client.fetchVault(vAddress);

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
