import { PublicKey } from "@solana/web3.js";
export * from "./accounts";
export * from "./instructions";
export * from "./types";

/**
 * Program address
 *
 * @category constants
 * @category generated
 */
export const PROGRAM_ADDRESS = "56YRTVX6MNrpQgnGQbzAq7xPyeqyY9ShDrpRNkyMpUgj";

/**
 * Program publick key
 *
 * @category constants
 * @category generated
 */
export const PROGRAM_ID = new PublicKey(PROGRAM_ADDRESS);
