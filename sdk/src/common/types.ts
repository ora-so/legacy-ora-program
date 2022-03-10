import { u64 } from "@solana/spl-token";
import { Keypair, PublicKey, TransactionInstruction } from "@solana/web3.js";

export interface DepositConfig {
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
  depositConfig?: DepositConfig;
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

export interface ATAResult {
  address: PublicKey;
  instruction: TransactionInstruction | null;
}

export interface ATAsResult {
  addresses: { [pubkey: string]: PublicKey };
  instructions: (TransactionInstruction | null)[];
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

export interface Collateral {
  mint: PublicKey;
  allocation: number;
}

export interface RebalanceConfig {
  amountIn: number;
  maxSlippageBps: number;
  tokenA: PublicKey;
  tokenB: PublicKey;
  swapAccount?: PublicKey;
}
