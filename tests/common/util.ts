import { Keypair, PublicKey } from "@solana/web3.js";
import { expect } from "chai";
import { NodeWallet } from "../../sdk";
import { SPLToken } from "@saberhq/token-utils";
import { IExchange, StableSwap } from "@saberhq/stableswap-sdk";

export interface TestContext {
  nodeWallet: NodeWallet;
  authority: Keypair;
  user1: Keypair;

  collateralA: Keypair;
  collateralB: Keypair;
  // act as unauthorized collateral
  collateralC: Keypair;

  tokenPool: SPLToken;
  userPoolAccount: PublicKey;
  mintA: SPLToken;
  mintB: SPLToken;
  tokenAccountA: PublicKey;
  tokenAccountB: PublicKey;
  adminFeeAccountA: PublicKey;
  adminFeeAccountB: PublicKey;
  exchange: IExchange;
  stableSwap: StableSwap;
  stableSwapAccount: Keypair;
  stableSwapProgramId: PublicKey;
}

export interface TokenBalance {
  mint: PublicKey;
  before: number;
  after: number;
}

export const expectThrowsAsync = async (
  method: () => Promise<any>,
  errorMessage = undefined
) => {
  let error: unknown = null;
  try {
    await method();
  } catch (err: unknown) {
    error = err;
  }
  expect(error).to.be.an("Error");
  if (errorMessage) {
    expect((error as any).message).to.equal(errorMessage);
  }
};

export const assertKeysEqual = (a: PublicKey, b: PublicKey) => {
  expect(a.toBase58()).to.equal(b.toBase58());
};

export const wrappedIt = async (
  str: string,
  getContext: () => Promise<TestContext>,
  fn: (ctx: TestContext) => Promise<void>
) => {
  it(str, async () => getContext().then(async (ctx) => fn(ctx)));
};
