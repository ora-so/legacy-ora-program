import { BN } from "@project-serum/anchor";
import { u64 } from "@solana/spl-token";
import {
  Connection,
  Keypair,
  Transaction,
  TransactionInstruction,
  PublicKey,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import invariant from "tiny-invariant";
import { ZERO_U64, MAX_BPS, TS_IN_MS_DIGITS } from "./constant";

import { SignerInfo, ATAResult, SwapAmount } from "./types";

export function isKp(kp: PublicKey | Keypair) {
  return kp instanceof Keypair || "_keypair" in kp;
}

export const getSignersFromPayer = (payer: PublicKey | Keypair): SignerInfo => {
  const payerIsKeypair = isKp(payer);
  const _payer = payerIsKeypair ? (<Keypair>payer).publicKey : payer;

  // assert signers is non-empty array?
  const signers = [];
  if (payerIsKeypair) signers.push(<Keypair>payer);

  return {
    payer: _payer,
    signers,
  } as SignerInfo;
};

export const addIxn = (
  ixn: TransactionInstruction | null,
  ixns: TransactionInstruction[]
): void => {
  if (ixn instanceof TransactionInstruction) {
    ixns.push(ixn);
  }
};

export const executeTx = async (
  connection: Connection,
  ixns: TransactionInstruction[],
  signers: Keypair[]
): Promise<string> => {
  const tx = new Transaction();
  ixns.forEach((ixn) => tx.add(ixn));

  return await sendAndConfirmTransaction(connection, tx, signers);
};

export const flattenValidInstructions = (
  ataResults: ATAResult[]
): TransactionInstruction[] => {
  const flattenedInstructions: TransactionInstruction[] = [];

  ataResults.forEach((res) => {
    flattenedInstructions.push(...(res.instruction ? [res.instruction] : []));
  });

  return flattenedInstructions;
};

// given max slippage in bps, calculate the minimum amount of token B we are willing to accept after the swap.
export const computeSwapAmounts = (
  amountIn: number,
  maxSlippageBps: number
): SwapAmount => {
  const _amountIn = new u64(amountIn);
  const _minimumAmountOut = new u64(
    Math.round(amountIn * ((MAX_BPS - maxSlippageBps) / MAX_BPS))
  );

  invariant(
    _minimumAmountOut.gte(ZERO_U64),
    "amount in + slippage must result in a minimum amount out greater than zero"
  );

  invariant(
    _amountIn.gte(_minimumAmountOut),
    "amount in must be greater than or equal to minimum amount out"
  );

  return {
    amountIn: _amountIn,
    minAmountOut: _minimumAmountOut,
  };
};

export const asNumber = (n: number | u64 | BN) =>
  typeof n === "number" ? n : n.toNumber();

export const numDigits = (n: number) => n.toString().length;

export const getTimestamp = (date: Date, d: number = 10): number => {
  return +(date.getTime() / 10 ** (TS_IN_MS_DIGITS - d)).toFixed(0);
};

export const getCurrentTimestamp = (d: number = 10): number =>
  getTimestamp(new Date(), d);

// from timestamp to number
export const toDate = (ts: number): Date => {
  const digitCount = numDigits(ts);
  const tsInMs = ts * 10 ** (TS_IN_MS_DIGITS - digitCount);
  return new Date(tsInMs);
};
