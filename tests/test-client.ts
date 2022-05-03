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

// =======================================================
// Custom definitions to make interfacing with SDK easier
// =======================================================

export interface InitVaultConfig {
  strategy: PublicKey;
  strategist?: PublicKey; // possibly use different person than authority
  alpha: PublicKey;
  beta: PublicKey;
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
      : this.authority.publicKey;

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
      authority: this.authority.publicKey,
      strategy: config.strategy,
      strategist: _strategist,
      alpha: config.alpha,
      beta: config.beta,
      fixedRate: getOrDefault(config.fixedRate, DEFAULT_HURDLE_RATE),
      startAt: new u64(getTimestamp(_startAtDate)),
      investAt: new u64(getTimestamp(_investAtDate)),
      redeemAt: new u64(getTimestamp(_redeemAtDate)),
    };

    await this.initializeVault(vaultConfig, this.authority);

    const { addr } = await this.generateVaultAddress(this.authority.publicKey);
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

    await this.invest(
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
    return;
  };

  doProcessClaims = async (config: ProcessClaimsConfig) => {
    return;
  };

  makeClaim = async (config: ClaimConfig) => {
    return;
  };
}
