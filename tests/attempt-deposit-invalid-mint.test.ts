import { Keypair } from "@solana/web3.js";
import { DepositConfig, InitVaultConfig, VaultTestClient } from "./test-client";
import { expectThrowsAsync, TestContext, wrappedIt } from "./common/util";

export const suite = (getContext: () => Promise<TestContext>) => {
  const testClient = new VaultTestClient();

  wrappedIt("Initialize vault", getContext, async (ctx) => {
    await testClient.initVault({
      strategy: Keypair.generate().publicKey,
      alpha: {
        mint: ctx.collateralA.publicKey,
        userCap: null,
        assetCap: null,
      },
      beta: {
        mint: ctx.collateralB.publicKey,
        userCap: null,
        assetCap: null,
      },
    } as InitVaultConfig);
  });

  wrappedIt("Attempt to deposit incorrect mint", getContext, async (ctx) => {
    const user1 = ctx.user1;
    const invalidTokenToDeposit = ctx.collateralC.publicKey;

    // todo: bypass sdk logic to actually invoke instruction
    expectThrowsAsync(async () => {
      await testClient.makeDeposit({
        payer: user1,
        amount: 100_000_000,
        mint: invalidTokenToDeposit,
      } as DepositConfig);
    });
  });
};
