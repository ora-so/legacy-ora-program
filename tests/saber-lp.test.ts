import * as anchor from "@project-serum/anchor";
import { Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { expect } from "chai";
import { asNumber, spinUntil, toIVault } from "../sdk/src";
import { assertKeysEqual, TestContext, wrappedIt } from "./common/util";
import {
  DepositConfig,
  InitVaultConfig,
  InvestConfig,
  VaultTestClient,
} from "./test-client";

export const suite = (getContext: () => Promise<TestContext>) => {
  const testClient = new VaultTestClient();
  let saberStrategy: PublicKey;

  let authority: Keypair;
  let strategist: Keypair;
  // let user1: Keypair;

  before("fund athority wwallet", async () => {
    authority = await testClient.nodeWallet.createFundedWallet(
      1 * LAMPORTS_PER_SOL
    );

    strategist = authority;
  });

  wrappedIt("Initialize vault", getContext, async (ctx) => {
    const { addr: strategyAddress } =
      await testClient.generateSaberStrategyAddress(
        ctx.stableSwap.state.tokenA.mint,
        ctx.stableSwap.state.tokenB.mint,
        ctx.stableSwap.config.swapAccount,
        ctx.stableSwap.state.poolTokenMint
      );

    console.log("strategyAddress: ", strategyAddress.toBase58());

    const userCap = 1000000000000;
    const assetCap = 1000000000000;
    const { addr } = await testClient.initVault({
      payer: authority,
      strategy: strategyAddress,
      alpha: {
        mint: ctx.collateralA.publicKey,
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
    assertKeysEqual(vault.alpha.mint, ctx.collateralA.publicKey);
    assertKeysEqual(vault.beta.mint, ctx.collateralB.publicKey);

    expect(vault.alpha.userCap.toNumber()).to.equal(userCap);
    expect(vault.alpha.assetCap).to.equal(null);
    expect(vault.beta.userCap).to.equal(null);
    expect(vault.beta.assetCap.toNumber()).to.equal(assetCap);
  });

  // todo: verify receipt account state updated
  // todo: verify history account state updated
  // todo: make it such that we can pass token object and mint new tokens here, so that we don't ahve to pass user1 from context
  wrappedIt("Deposit mint A into the vault", getContext, async (ctx) => {
    const user1 = ctx.user1;

    const tokenToDeposit = ctx.collateralA.publicKey;
    const vaultAddress = testClient.getCurrentVaultAddress();
    const depositorAlphaTokenBalanceBefore = await testClient.fetchTokenBalance(
      tokenToDeposit,
      user1.publicKey
    );

    const amount = 100_000_000;
    await testClient.makeDeposit({
      payer: user1,
      amount,
      mint: tokenToDeposit,
    } as DepositConfig);

    const depositorAlphaTokenBalanceAfter = await testClient.fetchTokenBalance(
      tokenToDeposit,
      user1.publicKey
    );

    const vaultAlphaTokenBalance = await testClient.fetchTokenBalance(
      tokenToDeposit,
      vaultAddress
    );

    const vaultAfter = await testClient.fetchVault(vaultAddress);
    expect(depositorAlphaTokenBalanceAfter).to.equal(
      depositorAlphaTokenBalanceBefore - amount
    );
    expect(vaultAlphaTokenBalance).to.equal(amount);

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
  });

  wrappedIt("Deposit mint B into the vault", getContext, async (ctx) => {
    const user1 = ctx.user1;

    const tokenToDeposit = ctx.collateralB.publicKey;
    const amount = 100_000_000;
    await testClient.makeDeposit({
      payer: user1,
      amount,
      mint: tokenToDeposit,
    } as DepositConfig);

    const vaultAddress = testClient.getCurrentVaultAddress();
    const vault = await testClient.fetchVault(vaultAddress);
    const asset = testClient.getAsset(toIVault(vault), tokenToDeposit);
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
  });

  wrappedIt("Invest funds via the strategy", getContext, async (ctx) => {
    const vaultAddress = testClient.getCurrentVaultAddress();
    const vault = await testClient.fetchVault(vaultAddress);

    const vaultAlphaTokenBalanceBefore = await testClient.fetchTokenBalance(
      vault.alpha.mint,
      vaultAddress
    );

    const vaultBetaTokenBalanceBefore = await testClient.fetchTokenBalance(
      vault.beta.mint,
      vaultAddress
    );

    const amountA = vaultAlphaTokenBalanceBefore;
    const amountB = vaultBetaTokenBalanceBefore;
    const minOut = (amountA + amountB) * 0.75;

    console.log("auth: ", strategist.publicKey.toBase58());

    await testClient.investFunds({
      payer: strategist,
      tokenA: vault.alpha.mint,
      amountA,
      tokenB: vault.beta.mint,
      amountB: amountB,
      minOut,
      swapAccount: ctx.stableSwapAccount.publicKey,
    } as InvestConfig);

    const vaultAlphaTokenBalanceAfter = await testClient.fetchTokenBalance(
      vault.alpha.mint,
      vaultAddress
    );

    const vaultBetaTokenBalanceAfter = await testClient.fetchTokenBalance(
      vault.beta.mint,
      vaultAddress
    );

    console.log("vaultAlphaTokenBalanceAfter: ", vaultAlphaTokenBalanceAfter);
    console.log("vaultBetaTokenBalanceAfter: ", vaultBetaTokenBalanceAfter);

    const vaultPoolLpToken = await testClient.fetchTokenBalance(
      ctx.stableSwap.state.poolTokenMint,
      vaultAddress
    );
    console.log("vaultPoolLpToken: ", vaultPoolLpToken);

    const vaultAfter = await testClient.fetchVault(vaultAddress);
    console.log(
      "vaultAfter.alpha.invested.toNumber(): ",
      vaultAfter.alpha.invested.toNumber()
    );
    console.log(
      "vaultAfter.beta.invested.toNumber(): ",
      vaultAfter.beta.invested.toNumber()
    );

    // console.log("vaultAfter: ", vaultAfter);
    console.log(
      "vaultAfter alpha deposits: ",
      vaultAfter.alpha.deposits.toNumber()
    );
    console.log(
      "vaultAfter alpha excess?: ",
      vaultAfter.alpha.excess.toNumber()
    );

    console.log(
      "vaultAfter beta deposits: ",
      vaultAfter.beta.deposits.toNumber()
    );
    console.log("vaultAfter beta excess?: ", vaultAfter.beta.excess.toNumber());
  });

  // todo: claim process to get lp tokens

  // wrappedIt(
  //   "Redeem Saber LP tokens for mints in the vault",
  //   getContext,
  //   async (ctx) => {
  //     const { addr } = await testClient.generateVaultAddress(
  //       ctx.authority.publicKey
  //     );
  //     const vault = await testClient.fetchVault(addr);

  //     await spinUntil(asNumber(vault.redeemAt), 3, true);

  //     const slippage = 2500;
  //     await testClient.redeemSaber(
  //       {
  //         tokenA: ctx.collateralA.publicKey,
  //         tokenB: ctx.collateralB.publicKey,
  //         swapAccount: ctx.stableSwapAccount.publicKey,
  //       },
  //       addr,
  //       slippage,
  //       ctx.authority
  //     );

  //     const vaultAlphaTokenBalanceAfter = await testClient.fetchTokenBalance(
  //       vault.alpha.mint,
  //       addr
  //     );

  //     const vaultBetaTokenBalanceAfter = await testClient.fetchTokenBalance(
  //       vault.beta.mint,
  //       addr
  //     );

  //     const vaultPoolLpToken = await testClient.fetchTokenBalance(
  //       ctx.stableSwap.state.poolTokenMint,
  //       addr
  //     );

  //     const vaultAfter = await testClient.fetchVault(addr);
  //     const alphaInvested = vaultAfter.alpha.invested;
  //     const betaInvested = vaultAfter.beta.invested;

  //     console.log("alphaInvested: ", alphaInvested.toNumber());
  //     console.log("betaInvested: ", betaInvested.toNumber());
  //     console.log("vaultAlphaTokenBalanceAfter: ", vaultAlphaTokenBalanceAfter);
  //     console.log("vaultBetaTokenBalanceAfter: ", vaultBetaTokenBalanceAfter);
  //     // lp is equal to number of assets deposited?
  //     console.log("vaultPoolLpToken: ", vaultPoolLpToken);
  //   }
  // );

  // it("Withdraw amount of mint from the vault", async () => {
  //   const { addr } = await client.generateVaultAddress(authority.publicKey);
  //   const vault = await client.fetchVault(addr);

  //   const alpha = vault.alpha.mint;
  //   const alphaLp = vault.alpha.lp;

  //   // lp before, lp after, collateral before, collateral after
  //   const userAlphaBefore = await client.fetchTokenBalance(
  //     alpha,
  //     authority.publicKey
  //   );

  //   const userLpBefore = await client.fetchTokenBalance(
  //     alphaLp,
  //     authority.publicKey
  //   );

  //   const vaultAlphaBefore = await client.fetchTokenBalance(alpha, addr);

  //   // todo
  //   const exchangeRate = await client.calculateExchangeRate(addr, alpha);
  //   console.log("exchangeRate: ", exchangeRate);

  //   await client.withdraw(
  //     addr,
  //     collateralA.publicKey,
  //     vault.alpha.lp,
  //     authority
  //   );

  //   // lp -> assets is not always going to be 1-1 but rather based on supply exchange rate
  //   const vaultAfter = await client.fetchVault(addr);
  //   console.log("vaultAfter: ", vaultAfter);
  //   console.log("alpha invested: ", vaultAfter.alpha.invested.toNumber());
  //   console.log("alpha received: ", vaultAfter.alpha.received.toNumber());

  //   const userAlphaAfter = await client.fetchTokenBalance(
  //     alpha,
  //     authority.publicKey
  //   );

  //   const userLpAfter = await client.fetchTokenBalance(
  //     alphaLp,
  //     authority.publicKey
  //   );

  //   const vaultAlphaAfter = await client.fetchTokenBalance(alpha, addr);

  //   console.log("userAlphaAfter: ", userAlphaAfter);
  //   console.log("userLpAfter: ", userLpAfter);
  //   console.log("vaultAlphaAfter: ", vaultAlphaAfter);
  // });
};
