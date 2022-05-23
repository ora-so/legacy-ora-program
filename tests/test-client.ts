import * as anchor from "@project-serum/anchor";
import { Program, Provider, Idl, Wallet, BN } from "@project-serum/anchor";
import { TOKEN_PROGRAM_ID, u64 } from "@solana/spl-token";

import {
  AccountMeta,
  Cluster,
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  VaultClient,
  executeTx,
  NodeWallet,
  VaultConfig,
  getTimestamp,
  asNumber,
  getCurrentTimestamp,
  toDate,
  toIVault,
  getOrDefault,
  addSeconds,
  toU64,
  spinUntil,
} from "../sdk";
import { AssetConfig } from "../sdk/src";
import { ZERO_U64 } from "../sdk/src/common/constant";

// =======================================================
// Custom definitions to make interfacing with SDK easier
// =======================================================

export interface InitVaultConfigForAsset {
  mint: PublicKey;
  assetCap?: u64;
  userCap?: u64;
}

export interface InitVaultConfig {
  payer: Keypair;
  strategy: PublicKey;
  strategist?: PublicKey; // possibly use different person than authority
  alpha: InitVaultConfigForAsset;
  beta: InitVaultConfigForAsset;
  fixedRate?: number; // default to 1000 bps
  // default to now
  startAt?: Date;
  // length of deposit state, live after
  depositPeriodInSeconds?: number;
  // length of live state, redeem after
  livePeriodInSeconds?: number;
}

export interface DepositConfig {
  payer: Keypair;
  amount: number;
  mint: PublicKey;
  applyImmediately?: boolean;
}

// todo
export interface WithdrawConfig {
  payer: Keypair;
  amount: number;
  mint: PublicKey;
  lp: PublicKey;
  applyImmediately?: boolean;
}

export interface InvestConfig {
  payer: Keypair;
  tokenA: PublicKey;
  amountA: number;
  tokenB: PublicKey;
  amountB: number;
  minOut: number;
  // not flexible, but for time being while we only have saber :shrug:
  swapAccount: PublicKey;
  applyImmediately?: boolean;
}

// todo
export interface RedeemConfig {
  payer: Keypair;
  tokenA: PublicKey;
  amountA: number;
  tokenB: PublicKey;
  amountB: number;
  minOut: number;
  swapAccount: PublicKey;
  applyImmediately?: boolean;
}

// todo
export interface ClaimConfig {
  payer: Keypair;
  applyImmediately?: boolean;
}

// todo
export interface ProcessClaimsConfig {
  payer: Keypair;
  applyImmediately?: boolean;
}

// ==============================================

export const DEFAULT_HURDLE_RATE = 1000;
export const DEFAULT_PERIOD_IN_SECONDS = 10;

export class VaultTestClient extends VaultClient {
  authority: Keypair;
  nodeWallet: NodeWallet;
  funder: Keypair;

  vaultAddress: PublicKey;

  constructor() {
    const initAuthorityWallet = async (amount?: number) => {
      return this.nodeWallet.createFundedWallet(
        getOrDefault(amount, 1 * LAMPORTS_PER_SOL)
      );
    };

    // setup connection & local wallet
    super(
      anchor.Provider.env().connection,
      anchor.Provider.env().wallet as anchor.Wallet
    );

    this.nodeWallet = new NodeWallet(
      anchor.Provider.env().connection,
      anchor.Provider.env().wallet as anchor.Wallet
    );

    this.funder = this.nodeWallet.wallet.payer;

    initAuthorityWallet().then((kp) => {
      this.authority = kp;
    });
  }

  fetchAuthorityKp = () => this.authority;

  fetchAuthority = () => this.authority.publicKey;

  getCurrentVaultAddress = () => this.vaultAddress;

  /**
   * will overwrite static `vaultAddress` if recalled
   */
  initVault = async (config: InitVaultConfig) => {
    const _strategist = config.strategist
      ? config.strategist
      : config.payer.publicKey;

    const _startAtDate = getOrDefault(
      config.startAt,
      addSeconds(new Date(), DEFAULT_PERIOD_IN_SECONDS)
    ); // getCurrentTimestamp
    const _investAtDate = addSeconds(
      _startAtDate,
      getOrDefault(config.depositPeriodInSeconds, DEFAULT_PERIOD_IN_SECONDS)
    );
    const _redeemAtDate = addSeconds(
      _investAtDate,
      getOrDefault(config.livePeriodInSeconds, DEFAULT_PERIOD_IN_SECONDS)
    );

    const vaultConfig: VaultConfig = {
      authority: config.payer.publicKey,
      strategy: config.strategy,
      strategist: _strategist,
      alpha: {
        mint: config.alpha.mint,
        userCap: config.alpha.userCap,
        assetCap: config.alpha.assetCap,
      },
      beta: {
        mint: config.beta.mint,
        userCap: config.beta.userCap,
        assetCap: config.beta.assetCap,
      },
      fixedRate: getOrDefault(config.fixedRate, DEFAULT_HURDLE_RATE),
      startAt: new u64(getTimestamp(_startAtDate)),
      investAt: new u64(getTimestamp(_investAtDate)),
      redeemAt: new u64(getTimestamp(_redeemAtDate)),
    };

    console.log("vaultConfig: ", vaultConfig);

    await this.initializeVault(vaultConfig, config.payer);

    const { addr } = await this.generateVaultAddress(config.payer.publicKey);
    this.vaultAddress = addr;

    return {
      addr,
      vaultConfig,
    };
  };

  makeDeposit = async (config: DepositConfig) => {
    const vault = await this.fetchVault(this.vaultAddress);
    console.log("getCurrentTimestamp: ", getCurrentTimestamp());
    console.log("vault.startAt: ", vault.startAt.toNumber());

    // wait for deposit period
    if (!getOrDefault(config.applyImmediately, false)) {
      await spinUntil(asNumber(vault.startAt), 3, true);
    }

    await this.deposit(
      this.vaultAddress,
      config.mint,
      toU64(config.amount),
      config.payer
    );
  };

  makeWithdrawal = async (config: WithdrawConfig) => {
    const vaultAddress = this.vaultAddress;

    return;
  };

  investFunds = async (config: InvestConfig) => {
    const vaultAddress = this.vaultAddress;
    const vault = await this.fetchVault(vaultAddress);

    // wait for invest period
    if (!getOrDefault(config.applyImmediately, false)) {
      await spinUntil(asNumber(vault.investAt), 3, true);
    }

    await this.investSaber(
      {
        tokenA: vault.alpha.mint,
        tokenB: vault.beta.mint,
        investConfig: {
          tokenAmountA: config.amountA,
          tokenAmountB: config.amountB,
          minMintAmount: config.minOut,
        },
        swapAccount: config.swapAccount,
      },
      vaultAddress,
      config.payer
    );

    return;
  };

  redeemFunds = async (config: RedeemConfig) => {
    const vaultAddress = this.vaultAddress;
    const vault = await this.fetchVault(vaultAddress);

    // todo
    const slippage = 0;
    await this.redeemSaber(
      {
        tokenA: vault.alpha.mint,
        tokenB: vault.alpha.mint,
        swapAccount: config.swapAccount,
      },
      vaultAddress,
      slippage,
      config.payer
    );

    return;
  };

  doProcessClaims = async (config: ProcessClaimsConfig) => {
    return;
  };

  makeClaim = async (config: ClaimConfig) => {
    return;
  };
}
