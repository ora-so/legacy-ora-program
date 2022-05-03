import * as anchor from "@project-serum/anchor";
import { PublicKey, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { expect } from "chai";
import { TOKEN_PROGRAM_ID, u64 } from "@solana/spl-token";
import {
  deployNewSwap,
  StableSwap,
  SWAP_PROGRAM_ID,
  IExchange,
} from "@saberhq/stableswap-sdk";
import { SPLToken, Token as SToken } from "@saberhq/token-utils";
import { SignerWallet } from "@saberhq/solana-contrib";

import {
  VaultClient,
  executeTx,
  NodeWallet,
  VaultConfig,
  getTimestamp,
  asNumber,
  getCurrentTimestamp,
  toDate,
} from "../sdk/dist/cjs";
import { assertKeysEqual } from "./common/util";

// toU64,

import {
  VaultTestClient,
  InitVaultConfig,
  DepositConfig,
  InvestConfig,
} from "./test-client";

import {
  setupPoolInitialization,
  FEES,
  AMP_FACTOR,
} from "./helpers/saber/pool";

describe("vault", () => {
  const _provider = anchor.Provider.env();

  const client = new VaultClient(
    _provider.connection,
    _provider.wallet as anchor.Wallet
  );

  const testClient = new VaultTestClient();

  let authority: Keypair;
  let user1: Keypair;

  let collateralA: Keypair;
  let collateralB: Keypair;
  // act as unauthorized collateral
  let collateralC: Keypair;

  let vaultConfig: VaultConfig;

  // ================================
  // saber related config
  // ================================
  let tokenPool: SPLToken;
  let userPoolAccount: PublicKey;
  let mintA: SPLToken;
  let mintB: SPLToken;
  let tokenAccountA: PublicKey;
  let tokenAccountB: PublicKey;
  let adminFeeAccountA: PublicKey;
  let adminFeeAccountB: PublicKey;
  let exchange: IExchange;
  let stableSwap: StableSwap;
  let stableSwapAccount: Keypair;
  let stableSwapProgramId: PublicKey;

  // ================================
  // saber strategies
  // ================================
  let saberStrategy: PublicKey;

  const nodeWallet = new NodeWallet(
    anchor.Provider.env().connection,
    anchor.Provider.env().wallet as anchor.Wallet
  );

  before("Create funded user accounts", async () => {
    authority = await nodeWallet.createFundedWallet(1 * LAMPORTS_PER_SOL);
    user1 = await nodeWallet.createFundedWallet(1 * LAMPORTS_PER_SOL);
  });

  before("Mint collateral A and B", async () => {
    collateralA = Keypair.generate();
    collateralB = Keypair.generate();
    collateralC = Keypair.generate();

    // mint collateral A
    await executeTx(
      client.provider.connection,
      await client.mintTokens(
        client.provider.connection,
        authority.publicKey,
        collateralA.publicKey,
        authority.publicKey,
        authority.publicKey
      ),
      [authority, collateralA]
    );

    // mint collateral B
    await executeTx(
      client.provider.connection,
      await client.mintTokens(
        client.provider.connection,
        authority.publicKey,
        collateralB.publicKey,
        authority.publicKey,
        authority.publicKey
      ),
      [authority, collateralB]
    );

    // mint collateral C
    await executeTx(
      client.provider.connection,
      await client.mintTokens(
        client.provider.connection,
        authority.publicKey,
        collateralC.publicKey,
        authority.publicKey,
        authority.publicKey
      ),
      [authority, collateralC]
    );
  });

  // =============================================================================
  // create a local saber pool with our custom token mints, use to swap locally.
  // we can test a local swap with a test like this.
  // =============================================================================
  before("deploy & seed saber pool", async () => {
    stableSwapAccount = Keypair.generate();

    const { seedPoolAccounts } = await setupPoolInitialization(
      collateralA.publicKey,
      collateralB.publicKey,
      authority
    );

    const provider = new SignerWallet(authority).createProvider(
      client.provider.connection
    );

    const { swap: newSwap, initializeArgs } = await deployNewSwap({
      provider: provider as any,
      swapProgramID: SWAP_PROGRAM_ID,
      adminAccount: authority.publicKey,
      tokenAMint: collateralA.publicKey,
      tokenBMint: collateralB.publicKey,
      ampFactor: new u64(AMP_FACTOR),
      fees: FEES,
      initialLiquidityProvider: authority.publicKey,
      useAssociatedAccountForInitialLP: true,
      seedPoolAccounts,
      swapAccountSigner: stableSwapAccount,
    });

    exchange = {
      programID: stableSwapProgramId,
      swapAccount: stableSwapAccount.publicKey,
      lpToken: new SToken({
        symbol: "LP",
        name: "StableSwap LP",
        address: initializeArgs.poolTokenMint.toString(),
        decimals: 6,
        chainId: 100,
      }),
      tokens: [
        new SToken({
          symbol: "TOKA",
          name: "Token A",
          address: initializeArgs.tokenA.mint.toString(),
          decimals: 6,
          chainId: 100,
        }),
        new SToken({
          symbol: "TOKB",
          name: "Token B",
          address: initializeArgs.tokenB.mint.toString(),
          decimals: 6,
          chainId: 100,
        }),
      ],
    };

    stableSwap = newSwap;

    tokenPool = new SPLToken(
      client.provider.connection,
      initializeArgs.poolTokenMint,
      TOKEN_PROGRAM_ID,
      authority
    );

    mintA = new SPLToken(
      client.provider.connection,
      initializeArgs.tokenA.mint,
      TOKEN_PROGRAM_ID,
      authority
    );
    mintB = new SPLToken(
      client.provider.connection,
      initializeArgs.tokenB.mint,
      TOKEN_PROGRAM_ID,
      authority
    );
    tokenAccountA = initializeArgs.tokenA.reserve;
    tokenAccountB = initializeArgs.tokenB.reserve;
    adminFeeAccountA = initializeArgs.tokenA.adminFeeAccount;
    adminFeeAccountB = initializeArgs.tokenB.adminFeeAccount;
    userPoolAccount = initializeArgs.destinationPoolTokenAccount;
  });

  it("load and verify swap pool integrity", async () => {
    const fetchedStableSwap = await StableSwap.load(
      client.provider.connection,
      stableSwapAccount.publicKey,
      stableSwapProgramId
    );

    assertKeysEqual(
      fetchedStableSwap.config.swapAccount,
      stableSwapAccount.publicKey
    );
    const { state } = fetchedStableSwap;
    assertKeysEqual(state.tokenA.adminFeeAccount, adminFeeAccountA);
    assertKeysEqual(state.tokenB.adminFeeAccount, adminFeeAccountB);
    assertKeysEqual(state.tokenA.reserve, tokenAccountA);
    assertKeysEqual(state.tokenB.reserve, tokenAccountB);
    assertKeysEqual(state.tokenA.mint, mintA.publicKey);
    assertKeysEqual(state.tokenB.mint, mintB.publicKey);
    assertKeysEqual(state.poolTokenMint, tokenPool.publicKey);

    expect(state.initialAmpFactor.toNumber()).to.equal(AMP_FACTOR);
    expect(state.targetAmpFactor.toNumber()).to.equal(AMP_FACTOR);
    // expect(state.fees).to.equal(FEES); // plain equal doesn't work here
  });

  before("Fund user accounts with some of each collateral", async () => {
    const fundingAmount = new u64(1_000_000_000_000); // 1,000,000

    for (const user of [authority, user1]) {
      for (const collateral of [collateralA, collateralB]) {
        console.log(
          `Funding [${user.publicKey.toBase58()}] with ${fundingAmount.toNumber()} of ${collateral.publicKey.toBase58()}`
        );

        const signers =
          user.publicKey.toBase58() === authority.publicKey.toBase58()
            ? [authority]
            : [user, authority];
        await executeTx(
          client.provider.connection,
          await client.initTokenAccount(
            client.provider.connection,
            collateral.publicKey,
            user.publicKey,
            authority.publicKey,
            fundingAmount
          ),
          signers
        );
      }
    }
  });

  it("Initialize saber strategy", async () => {
    const { tx, strategy } = await client.initializeStrategy(
      collateralA.publicKey,
      collateralB.publicKey,
      authority
    );

    saberStrategy = strategy;
  });

  it("Initialize vault", async () => {
    const { addr } = await testClient.initVault({
      strategy: saberStrategy,
      alpha: collateralA.publicKey,
      beta: collateralB.publicKey,
    } as InitVaultConfig);

    const vault = await testClient.fetchVault(addr);

    console.log(testClient.fetchAuthority());
    console.log(vault);

    // in this case, authority is both authority and strategist
    assertKeysEqual(vault.authority, testClient.fetchAuthority());
    assertKeysEqual(vault.strategist, testClient.fetchAuthority());

    // check mints on vault are collateral we previously created
    assertKeysEqual(vault.alpha.mint, collateralA.publicKey);
    assertKeysEqual(vault.beta.mint, collateralB.publicKey);
  });

  it("Deposit mint A into the vault", async () => {
    const vaultAddress = testClient.getCurrentVaultAddress();
    const depositorAlphaTokenBalanceBefore = await client.fetchTokenBalance(
      collateralA.publicKey,
      user1.publicKey
    );

    const amount = 100_000_000;
    await testClient.makeDeposit({
      payer: user1,
      amount,
      mint: collateralA.publicKey,
    } as DepositConfig);

    const depositorAlphaTokenBalanceAfter = await client.fetchTokenBalance(
      collateralA.publicKey,
      user1.publicKey
    );

    const vaultAlphaTokenBalance = await client.fetchTokenBalance(
      collateralA.publicKey,
      vaultAddress
    );

    const vaultAfter = await client.fetchVault(vaultAddress);
    expect(vaultAfter.alpha.deposited.toNumber()).to.equal(amount);
    expect(depositorAlphaTokenBalanceAfter).to.equal(
      depositorAlphaTokenBalanceBefore - amount
    );
    expect(vaultAlphaTokenBalance).to.equal(amount);
  });

  it("Deposit mint B into the vault", async () => {
    const amount = 100_000_000;
    await testClient.makeDeposit({
      payer: user1,
      amount,
      mint: collateralB.publicKey,
    } as DepositConfig);
  });

  it("Invest funds via the strategy", async () => {
    const vaultAddress = testClient.getCurrentVaultAddress();
    const vault = await client.fetchVault(vaultAddress);

    const vaultAlphaTokenBalanceBefore = await client.fetchTokenBalance(
      vault.alpha.mint,
      vaultAddress
    );

    const vaultBetaTokenBalanceBefore = await client.fetchTokenBalance(
      vault.beta.mint,
      vaultAddress
    );

    const amountA = vaultAlphaTokenBalanceBefore;
    const amountB = vaultBetaTokenBalanceBefore;
    const minOut = (amountA + amountB) * 0.75;

    await testClient.investFunds({
      payer: testClient.fetchAuthorityKp(),
      tokenA: vault.alpha.mint,
      amountA,
      tokenB: vault.beta.mint,
      amountB: amountB,
      minOut,
      swapAccount: stableSwapAccount.publicKey,
      mint: collateralB.publicKey,
    } as InvestConfig);

    const vaultAlphaTokenBalanceAfter = await client.fetchTokenBalance(
      vault.alpha.mint,
      vaultAddress
    );

    const vaultBetaTokenBalanceAfter = await client.fetchTokenBalance(
      vault.beta.mint,
      vaultAddress
    );

    console.log("vaultAlphaTokenBalanceAfter: ", vaultAlphaTokenBalanceAfter);
    console.log("vaultBetaTokenBalanceAfter: ", vaultBetaTokenBalanceAfter);

    // const vaultPoolLpToken = await client.fetchTokenBalance(
    //   stableSwap.state.poolTokenMint,
    //   addr
    // );

    // // at least amount invested with slippage

    // const minAmountOut = withSlippage(
    //   depositorAlphaTokenBalanceBefore + depositorBetaTokenBalanceBefore,
    //   slippage
    // );
    // console.log("minAmountOut: ", minAmountOut);

    // const vaultAfter = await client.fetchVault(addr);

    // expect(vaultAfter.alpha.invested.toNumber() > 0).to.be.true;
    // expect(vaultAfter.beta.invested.toNumber() > 0).to.be.true;

    // // todo balances?
    // console.log("vaultAlphaTokenBalanceAfter: ", vaultAlphaTokenBalanceAfter);
    // console.log("vaultBetaTokenBalanceAfter: ", vaultBetaTokenBalanceAfter);
    // // lp is equal to number of assets deposited?
    // console.log("vaultPoolLpToken: ", vaultPoolLpToken);
    // // depositorAlphaTokenBalanceBefore >= alphaInvested
    // // depositorBetaTokenBalanceBefore >= betaInvested
  });

  // it("Redeem Saber LP tokens for mints in the vault", async () => {
  //   const { addr } = await client.generateVaultAddress(authority.publicKey);
  //   const vault = await client.fetchVault(addr);

  //   await spinUntil(asNumber(vault.redeemAt), 3, true);

  //   const slippage = 2500;
  //   await client.redeem(
  //     {
  //       tokenA: collateralA.publicKey,
  //       tokenB: collateralB.publicKey,
  //       swapAccount: stableSwapAccount.publicKey,
  //     },
  //     addr,
  //     slippage,
  //     authority
  //   );

  //   const vaultAlphaTokenBalanceAfter = await client.fetchTokenBalance(
  //     vault.alpha.mint,
  //     addr
  //   );

  //   const vaultBetaTokenBalanceAfter = await client.fetchTokenBalance(
  //     vault.beta.mint,
  //     addr
  //   );

  //   const vaultPoolLpToken = await client.fetchTokenBalance(
  //     stableSwap.state.poolTokenMint,
  //     addr
  //   );

  //   const vaultAfter = await client.fetchVault(addr);
  //   const alphaInvested = vaultAfter.alpha.invested;
  //   const betaInvested = vaultAfter.beta.invested;

  //   console.log("alphaInvested: ", alphaInvested.toNumber());
  //   console.log("betaInvested: ", betaInvested.toNumber());
  //   console.log("vaultAlphaTokenBalanceAfter: ", vaultAlphaTokenBalanceAfter);
  //   console.log("vaultBetaTokenBalanceAfter: ", vaultBetaTokenBalanceAfter);
  //   // lp is equal to number of assets deposited?
  //   console.log("vaultPoolLpToken: ", vaultPoolLpToken);
  // });

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
});
