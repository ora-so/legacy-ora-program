import { u64 } from "@solana/spl-token";

export const LOCALNET = "localnet";
export const TESTNET = "testnet";
export const DEVNET = "devnet";
export const MAINNET_BETA = "mainnet-beta";

export const MAX_BPS = 10_000;
export const MAX_BPS_U64 = new u64(MAX_BPS);
export const ZERO_U64 = new u64(0);

export const TS_IN_MS_DIGITS = 13;

export const SECOND_IN_MS = 1000 * 1;
export const MIN_IN_MS = SECOND_IN_MS * 60;
export const HOUR_IN_MS = MIN_IN_MS * 60;
export const DAY_IN_MS = HOUR_IN_MS * 24;
