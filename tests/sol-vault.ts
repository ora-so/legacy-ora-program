import * as anchor from "@project-serum/anchor";
import { Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { expect } from "chai";

import { toIVault } from "../sdk/src";
import { SOL_KEY_STR } from "../sdk/src/common/constant";
import { assertKeysEqual, TestContext, wrappedIt } from "./common/util";
import { DepositConfig, InitVaultConfig, VaultTestClient } from "./test-client";

export const suite = (getContext: () => Promise<TestContext>) => {
  const testClient = new VaultTestClient();

  let authority: Keypair;
  let strategist: Keypair;

  const _solPubkey = new PublicKey(SOL_KEY_STR);

  before("fund athority wwallet", async () => {
    authority = await testClient.nodeWallet.createFundedWallet(
      1 * LAMPORTS_PER_SOL
    );

    strategist = authority;
  });

  // todo: long term, setup a saber pool with SOL on 1 side so that we can configure the
  // continuation router?
  wrappedIt("Initialize vault", getContext, async (ctx) => {
    // doesn't matter since we won't actually be swapping in a saber pool
    const strategyAddress = Keypair.generate().publicKey;

    const userCap = 1000000000000;
    const assetCap = 1000000000000;
    const { addr } = await testClient.initVault({
      payer: authority,
      strategy: strategyAddress,
      alpha: {
        mint: _solPubkey,
        userCap: new anchor.BN(userCap),
        assetCap: null,
      },
      beta: {
        mint: ctx.collateralB.publicKey,
        userCap: null,
        assetCap: new anchor.BN(assetCap),
      },
    } as InitVaultConfig);

    const vault = await testClient.fetchVault(addr);

    // in this case, authority is both authority and strategist
    assertKeysEqual(vault.authority, authority.publicKey);
    assertKeysEqual(vault.strategist, authority.publicKey);

    // check mints on vault are collateral we previously created
    assertKeysEqual(vault.alpha.mint, _solPubkey);
    assertKeysEqual(vault.beta.mint, ctx.collateralB.publicKey);

    expect(vault.alpha.userCap.toNumber()).to.equal(userCap);
    expect(vault.alpha.assetCap).to.equal(null);
    expect(vault.beta.userCap).to.equal(null);
    expect(vault.beta.assetCap.toNumber()).to.equal(assetCap);
  });

  wrappedIt(
    "Deposit SOL from wSOL account -> ATA into the vault",
    getContext,
    async (ctx) => {
      const user1 = ctx.user1;

      const tokenToDeposit = _solPubkey;
      const vaultAddress = testClient.getCurrentVaultAddress();

      const amount = 250_000_000; // 0.25
      await testClient.makeDeposit({
        payer: user1,
        amount,
        mint: tokenToDeposit,
      } as DepositConfig);

      const vaultAlphaTokenBalance = await testClient.fetchTokenBalance(
        tokenToDeposit,
        vaultAddress
      );

      // even thought depositing SOL, should be safe to assert balance = amount
      expect(vaultAlphaTokenBalance).to.equal(amount);

      const vaultAfter = await testClient.fetchVault(vaultAddress);
      const asset = testClient.getAsset(toIVault(vaultAfter), tokenToDeposit);
      expect(asset.deposits.toNumber()).to.equal(1);

      const history = await testClient.fetchHistoryWithSeeds(
        vaultAddress,
        tokenToDeposit,
        user1.publicKey
      );
      expect(history.intialized).to.be.true;
      expect(history.cumulative.toNumber()).to.equal(amount);
      expect(history.deposits.toNumber()).to.equal(1);

      const receipt = await testClient.fetchReceiptWithSeeds(
        vaultAddress,
        tokenToDeposit,
        asset.deposits
      );
      expect(receipt.cumulative.toNumber()).to.equal(0);
      expect(receipt.amount.toNumber()).to.equal(amount);
      expect(receipt.depositor.toBase58()).to.equal(user1.publicKey.toBase58());
    }
  );
};
