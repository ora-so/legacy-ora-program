/**
 * This code was GENERATED using the solita package.
 * Please DO NOT EDIT THIS FILE, instead rerun solita to update it or write a wrapper to add functionality.
 *
 * See: https://github.com/metaplex-foundation/solita
 */

import * as beet from "@metaplex-foundation/beet";
import * as web3 from "@solana/web3.js";
import { VaultConfig, vaultConfigBeet } from "../types/VaultConfig";

/**
 * @category Instructions
 * @category InitializeVault
 * @category generated
 */
export type InitializeVaultInstructionArgs = {
  vaultBump: number;
  vaultConfig: VaultConfig;
};
/**
 * @category Instructions
 * @category InitializeVault
 * @category generated
 */
const initializeVaultStruct = new beet.BeetArgsStruct<
  InitializeVaultInstructionArgs & {
    instructionDiscriminator: number[] /* size: 8 */;
  }
>(
  [
    ["instructionDiscriminator", beet.uniformFixedSizeArray(beet.u8, 8)],
    ["vaultBump", beet.u8],
    ["vaultConfig", vaultConfigBeet],
  ],
  "InitializeVaultInstructionArgs"
);
/**
 * Accounts required by the _initializeVault_ instruction
 * @category Instructions
 * @category InitializeVault
 * @category generated
 */
export type InitializeVaultInstructionAccounts = {
  authority: web3.PublicKey;
  vault: web3.PublicKey;
  strategy: web3.PublicKey;
  strategist: web3.PublicKey;
  alphaMint: web3.PublicKey;
  alphaLp: web3.PublicKey;
  betaMint: web3.PublicKey;
  betaLp: web3.PublicKey;
};

const initializeVaultInstructionDiscriminator = [
  48, 191, 163, 44, 71, 129, 63, 164,
];

/**
 * Creates a _InitializeVault_ instruction.
 *
 * @param accounts that will be accessed while the instruction is processed
 * @param args to provide as instruction data to the program
 *
 * @category Instructions
 * @category InitializeVault
 * @category generated
 */
export function createInitializeVaultInstruction(
  accounts: InitializeVaultInstructionAccounts,
  args: InitializeVaultInstructionArgs
) {
  const {
    authority,
    vault,
    strategy,
    strategist,
    alphaMint,
    alphaLp,
    betaMint,
    betaLp,
  } = accounts;

  const [data] = initializeVaultStruct.serialize({
    instructionDiscriminator: initializeVaultInstructionDiscriminator,
    ...args,
  });
  const keys: web3.AccountMeta[] = [
    {
      pubkey: authority,
      isWritable: true,
      isSigner: true,
    },
    {
      pubkey: vault,
      isWritable: true,
      isSigner: false,
    },
    {
      pubkey: strategy,
      isWritable: true,
      isSigner: false,
    },
    {
      pubkey: strategist,
      isWritable: true,
      isSigner: false,
    },
    {
      pubkey: alphaMint,
      isWritable: true,
      isSigner: false,
    },
    {
      pubkey: alphaLp,
      isWritable: true,
      isSigner: false,
    },
    {
      pubkey: betaMint,
      isWritable: true,
      isSigner: false,
    },
    {
      pubkey: betaLp,
      isWritable: true,
      isSigner: false,
    },
    {
      pubkey: web3.SystemProgram.programId,
      isWritable: false,
      isSigner: false,
    },
  ];

  const ix = new web3.TransactionInstruction({
    programId: new web3.PublicKey(
      "56YRTVX6MNrpQgnGQbzAq7xPyeqyY9ShDrpRNkyMpUgj"
    ),
    keys,
    data,
  });
  return ix;
}
