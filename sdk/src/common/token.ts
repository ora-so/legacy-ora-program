import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  MintLayout,
  Token,
  TOKEN_PROGRAM_ID,
  u64,
} from "@solana/spl-token";
import {
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  TransactionInstruction,
  Connection,
  Cluster,
} from "@solana/web3.js";
import {
  TokenListProvider,
  TokenListContainer,
  TokenInfo,
} from "@solana/spl-token-registry";

import { ATAResult, ATAsResult } from "./types";
import { ZERO_U64 } from "./constant";

export type PubKeyString = PublicKey | string;

export const asString = (mint: PubKeyString) =>
  typeof mint === "string" ? mint : mint.toBase58();

export const asStrings = (mints: PubKeyString[]) =>
  mints.map((mint) => asString(mint));

export const findAssociatedTokenAddress = async (
  owner: PublicKey,
  mint: PublicKey
): Promise<PublicKey> => {
  return (
    await PublicKey.findProgramAddress(
      [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
      ASSOCIATED_TOKEN_PROGRAM_ID
    )
  )[0];
};

// todo: replace with createAssociatedTokenAccountInstruction?
export const createAssociatedTokenAccount = (
  mint: PublicKey,
  associatedAccount: PublicKey,
  owner: PublicKey,
  payer: PublicKey
) => {
  const keys = [
    { pubkey: payer, isSigner: true, isWritable: true },
    { pubkey: associatedAccount, isSigner: false, isWritable: true },
    { pubkey: owner, isSigner: false, isWritable: false },
    { pubkey: mint, isSigner: false, isWritable: false },
    {
      pubkey: SystemProgram.programId,
      isSigner: false,
      isWritable: false,
    },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    {
      pubkey: SYSVAR_RENT_PUBKEY,
      isSigner: false,
      isWritable: false,
    },
  ];
  return new TransactionInstruction({
    keys,
    programId: ASSOCIATED_TOKEN_PROGRAM_ID,
    data: Buffer.alloc(0),
  });
};

export const getOrCreateATA = async (
  mint: PublicKey,
  owner: PublicKey,
  payer: PublicKey,
  conn: Connection
): Promise<ATAResult> => {
  const address = await findAssociatedTokenAddress(owner, mint);
  if (await conn.getAccountInfo(address)) {
    return { address, instruction: null };
  } else {
    return {
      address,
      instruction: createAssociatedTokenAccount(
        mint,
        address,
        owner, // owner
        payer // payer
      ),
    };
  }
};

export const getOrCreateATAs = async (
  mints: PublicKey[],
  owner: PublicKey,
  payer: PublicKey,
  conn: Connection
): Promise<ATAsResult> => {
  const atas: ATAsResult = {
    addresses: {},
    instructions: [],
  };

  for (const mint of mints) {
    const address = await findAssociatedTokenAddress(owner, mint);
    if (await conn.getAccountInfo(address)) {
      atas.addresses[mint.toBase58()] = address;
      atas.instructions.push(null);
    } else {
      atas.addresses[mint.toBase58()] = address;
      atas.instructions.push(
        createAssociatedTokenAccount(
          mint,
          address,
          owner, // owner
          payer // payer
        )
      );
    }
  }

  return atas;
};

export const initTokenAccount = async (
  connection: Connection,
  mint: PublicKey,
  owner: PublicKey,
  payer: PublicKey,
  amount: u64 = ZERO_U64
): Promise<TransactionInstruction[]> => {
  const tokenATA = await getOrCreateATA(mint, owner, payer, connection);

  const fundTransaction =
    amount === ZERO_U64
      ? []
      : [
          Token.createMintToInstruction(
            TOKEN_PROGRAM_ID,
            mint,
            tokenATA.address,
            payer, // mint to
            [],
            amount
          ),
        ];

  return [
    ...(tokenATA.instruction ? [tokenATA.instruction] : []),
    ...fundTransaction,
  ];
};

export const mintTokens = async (
  connection: Connection,
  payer: PublicKey,
  mint: PublicKey,
  mintAuthority: PublicKey,
  freezeAuthority: PublicKey | null = null,
  decimals = 6
): Promise<TransactionInstruction[]> => {
  return [
    new TransactionInstruction(
      SystemProgram.createAccount({
        fromPubkey: payer,
        newAccountPubkey: mint,
        space: MintLayout.span,
        lamports: await Token.getMinBalanceRentForExemptMint(connection),
        programId: TOKEN_PROGRAM_ID,
      })
    ),
    new TransactionInstruction(
      Token.createInitMintInstruction(
        TOKEN_PROGRAM_ID,
        mint,
        decimals,
        mintAuthority, // mintAuthority
        freezeAuthority // freezeAuthority
      )
    ),
  ];
};

export class TokenProvider {
  tokenListContainer: TokenListContainer;
  tokenMap: Map<Cluster, Map<string, TokenInfo>>;

  constructor() {
    new TokenListProvider().resolve().then((container) => {
      this.tokenListContainer = container;
      this.tokenMap = new Map();
    });
  }

  _saturateMap = (cluster: Cluster) => {
    // new map for cluster
    if (!this.tokenMap.has(cluster)) this.tokenMap.set(cluster, new Map());

    // get cluster, we know it exists because we just created if DNE before
    const tokensForCluster = this.tokenMap.get(cluster)!;

    // tokens already populated, return early
    if (tokensForCluster.size > 0) return;

    // saturate map
    const tokenInfos: TokenInfo[] = this.tokenListContainer
      .filterByClusterSlug(cluster)
      .getList();

    tokenInfos.forEach((tokenInfo) => {
      tokensForCluster.set(tokenInfo.address, tokenInfo);
    });
  };

  fetchTokens = (
    mints: PublicKey[] | string[],
    cluster: Cluster = "mainnet-beta"
  ): TokenInfo[] => {
    if (mints.length === 0) return [];

    const _mints: string[] =
      typeof mints[0] === "string"
        ? (mints as string[])
        : (mints as PublicKey[]).map((mint) => mint.toBase58());

    this._saturateMap(cluster);

    const tokensForCluster = this.tokenMap.get(cluster)!;
    return _mints
      .map((_mint) => tokensForCluster.get(_mint))
      .filter(isTokenInfo);
  };

  fetchSymbols = (
    mints: PublicKey[] | string[],
    cluster: Cluster = "mainnet-beta"
  ): string[] => {
    return this.fetchTokens(mints, cluster).map((token) => token.symbol);
  };
}

// https://www.benmvp.com/blog/filtering-undefined-elements-from-array-typescript/
const isTokenInfo = (
  tokenInfo: TokenInfo | undefined
): tokenInfo is TokenInfo => {
  return !!tokenInfo;
};
