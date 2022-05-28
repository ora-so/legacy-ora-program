import { u64 } from "@solana/spl-token";
import { Keypair, PublicKey, TransactionInstruction } from "@solana/web3.js";

export interface InvestConfig {
  tokenAmountA: number;
  tokenAmountB: number;
  minMintAmount: number;
}

export interface WithdrawConfig {
  tokenAmountLp: number;
  tokenAmountA: number;
  tokenAmountB: number;
}

export interface PoolConfig {
  tokenA: PublicKey;
  tokenB: PublicKey;
  investConfig?: InvestConfig;
  withdrawConfig?: WithdrawConfig;
  swapAccount?: PublicKey;
}

export interface SwapAmount {
  amountIn: u64;
  minAmountOut: u64;
}

export interface SignerInfo {
  payer: PublicKey;
  signers: Keypair[];
}

export interface CompositeATAResult {
  address: PublicKey;
  instructions: TransactionInstruction[];
  cleanup: TransactionInstruction[];
  signers: Keypair[];
}

export interface ParsedTokenAccount {
  mint: PublicKey;
  owner: PublicKey;
  ata: PublicKey;
  amount: u64;
  decimals: number;
}

export const printParsedTokenAccount = (account: ParsedTokenAccount) => {
  console.log("mint: ", account.mint.toBase58());
  console.log("owner: ", account.owner.toBase58());
  console.log("ata: ", account.mint.toBase58());
  console.log("amount: ", account.amount.toNumber());
  console.log("decimals: ", account.decimals);
};

export interface PdaDerivationResult {
  addr: PublicKey;
  bump: number;
}

export interface ProcessClaimsResult {
  claimsProcessed: boolean;
  tx: string;
}

export interface TokenSupply {
  supply: number;
  decimals: number;
}

export interface AssetConfig {
  mint: PublicKey;
  assetCap?: u64;
  userCap?: u64;
}

export interface VaultConfig {
  authority: PublicKey;
  strategy: PublicKey;
  strategist: PublicKey;
  alpha: AssetConfig;
  beta: AssetConfig;
  fixedRate: number;
  startAt: u64;
  investAt: u64;
  redeemAt: u64;
}

export interface IAsset {
  mint: PublicKey;
  lp: PublicKey;
  assetCap?: u64;
  userCap?: u64;
  deposits: u64;
  deposited: u64;
  invested: u64;
  excess: u64;
  received: u64;
  claimsProcessed: boolean;
  claimsIdx?: u64;
}

export enum State {
  Inactive = "Inactive",
  Deposit = "Deposit",
  Live = "Live",
  Redeem = "Redeem",
  Withdraw = "Withdraw",
}

export interface IVault {
  bump: number;
  authority: PublicKey;
  alpha: IAsset;
  beta: IAsset;
  strategy: PublicKey;
  strategist: PublicKey;
  fixedRate: number;
  state: State;
  startAt: u64;
  investAt: u64;
  redeemAt: u64;
  farmVault?: PublicKey;
}

export interface SaberLpStrategyV0 {
  flags: u64;
  bump: number;
  tokenA: PublicKey;
  tokenB: PublicKey;
}

export enum Protocol {
  Saber = "Saber",
}

// helper functions to deserialize strategy accounts
export enum Strategy {
  SaberLpStrategyV0 = 1 << 0,
}

export type StrategyType = keyof typeof Strategy;
