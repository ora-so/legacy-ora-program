import * as anchor from "@project-serum/anchor";
import { Keypair, PublicKey } from "@solana/web3.js";
import { expect } from "chai";
import { toIVault } from "../sdk/src";
import {
  assertKeysEqual,
  expectThrowsAsync,
  TestContext,
  wrappedIt,
} from "./common/util";
import { DepositConfig, InitVaultConfig, VaultTestClient } from "./test-client";

export const suite = (getContext: () => Promise<TestContext>) => {
  const testClient = new VaultTestClient();

  wrappedIt("Initialize vault", getContext, async (ctx) => {
    const userCap = 100000000;
    const { addr } = await testClient.initVault({
      strategy: Keypair.generate().publicKey,
      alpha: {
        mint: ctx.collateralA.publicKey,
        userCap: new anchor.BN(userCap),
        assetCap: null,
      },
      beta: {
        mint: ctx.collateralB.publicKey,
        userCap: null,
        assetCap: null,
      },
      depositPeriodInSeconds: 3600, // 1 hour
    } as InitVaultConfig);

    const vault = await testClient.fetchVault(addr);

    // in this case, authority is both authority and strategist
    assertKeysEqual(vault.authority, testClient.fetchAuthority());
    assertKeysEqual(vault.strategist, testClient.fetchAuthority());

    // check mints on vault are collateral we previously created
    assertKeysEqual(vault.alpha.mint, ctx.collateralA.publicKey);
    assertKeysEqual(vault.beta.mint, ctx.collateralB.publicKey);

    expect(vault.alpha.userCap.toNumber()).to.equal(userCap);
    expect(vault.alpha.assetCap).to.equal(null);
    expect(vault.beta.userCap).to.equal(null);
    expect(vault.beta.assetCap).to.equal(null);
  });

  wrappedIt(
    "Attempt to exceed user cap with 1 deposit",
    getContext,
    async (ctx) => {
      const user1 = ctx.user1;

      const tokenToDeposit = ctx.collateralA.publicKey;
      const vaultAddress = testClient.getCurrentVaultAddress();
      const vault = await testClient.fetchVault(vaultAddress);
      const asset = testClient.getAsset(toIVault(vault), tokenToDeposit);

      // 1x10^-6 more than max amount
      const amount = asset.userCap.toNumber() + 1;
      expectThrowsAsync(async () => {
        testClient.makeDeposit({
          payer: user1,
          amount,
          mint: tokenToDeposit,
        } as DepositConfig);
      });
    }
  );

  wrappedIt(
    "Make a series of small deposits, eventually exceed cap",
    getContext,
    async (ctx) => {
      const user1 = ctx.user1;

      const tokenToDeposit = ctx.collateralA.publicKey;
      const vaultAddress = testClient.getCurrentVaultAddress();
      const vault = await testClient.fetchVault(vaultAddress);
      const asset = testClient.getAsset(toIVault(vault), tokenToDeposit);

      // 100 / 5 => 20 tokens each time
      const numDeposits = 5;
      for (let i = 0; i < numDeposits; i++) {
        const amount = asset.userCap.toNumber() / numDeposits;
        await testClient.makeDeposit({
          payer: user1,
          amount,
          mint: tokenToDeposit,
        } as DepositConfig);

        const _vault = await testClient.fetchVault(vaultAddress);
        const _asset = testClient.getAsset(toIVault(_vault), tokenToDeposit);

        // deposits are not zero-indexed, this for-loop counter is
        expect(_asset.deposits.toNumber()).to.equal(i + 1);
      }

      // deposit of a single unit more will fail
      expectThrowsAsync(async () => {
        await testClient.makeDeposit({
          payer: user1,
          amount: 1,
          mint: tokenToDeposit,
        } as DepositConfig);
      });
    }
  );
};
