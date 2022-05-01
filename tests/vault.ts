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
} from "../sdk";
import { assertKeysEqual } from "./common/util";

import {
  setupPoolInitialization,
  FEES,
  AMP_FACTOR,
} from "./helpers/saber/pool";

const second_in_ms = 1000 * 1;
const min_in_ms = second_in_ms * 60;
const hour_in_ms = min_in_ms * 60;
const day_in_ms = hour_in_ms * 24;

// write an Asset wrapper

export const withSlippage = (amount: number, slippage: number) => {
  const bpsMax = 10_000;
  return ((bpsMax - slippage) / bpsMax) * amount;
};

export const sleep = (ms: number) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

export const addMinutes = (date: Date, minutes: number) => {
  date.setTime(date.getTime() + minutes * 60 * 1000);
  return date;
};

export const addSeconds = (date: Date, seconds: number) => {
  date.setTime(date.getTime() + seconds * 1000);
  return date;
};

export const spinUntil = async (
  until: number,
  sleepTimeoutInSeconds: number = 3,
  verbose: boolean = false
) => {
  let currentTimestamp = getCurrentTimestamp();

  for (;;) {
    if (verbose) {
      console.log(`Sleeping ${sleepTimeoutInSeconds} seconds`);
    }
    await sleep(sleepTimeoutInSeconds * 1000); // sleep for 3 seconds at a time, until auction is over
    if (currentTimestamp >= until) {
      break;
    }
    currentTimestamp = new Date().getTime() / 1000;
  }

  return;
};

describe("vault", () => {
  const _provider = anchor.Provider.env();

  const client = new VaultClient(
    _provider.connection,
    _provider.wallet as anchor.Wallet
  );

  let authority: Keypair;

  let collateralA: Keypair;
  let collateralB: Keypair;

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
  });

  before("Mint collateral A and B", async () => {
    collateralA = Keypair.generate();
    collateralB = Keypair.generate();

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

    for (const user of [authority]) {
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
    const currentTimestamp = new Date();
    const _startAt = addSeconds(currentTimestamp, 1);
    const startAt = new u64(getTimestamp(_startAt));
    const _investAt = addSeconds(_startAt, 10);
    const investAt = new u64(getTimestamp(_investAt));
    const _redeemAt = addSeconds(_investAt, 10);
    const redeemAt = new u64(getTimestamp(_redeemAt));

    vaultConfig = {
      authority: authority.publicKey,
      strategy: saberStrategy,
      strategist: authority.publicKey,
      alpha: collateralA.publicKey,
      beta: collateralB.publicKey,
      fixedRate: 1000, // bps
      startAt,
      investAt,
      redeemAt,
    };

    await client.initializeVault(vaultConfig, authority);

    const { addr } = await client.generateVaultAddress(authority.publicKey);
    const vault = await client.fetchVault(addr);

    // authority is both authority and strategist
    assertKeysEqual(vault.authority, authority.publicKey);
    assertKeysEqual(vault.strategist, authority.publicKey);

    // check mints on vault are collateral we previously created
    assertKeysEqual(vault.alpha.mint, collateralA.publicKey);
    assertKeysEqual(vault.beta.mint, collateralB.publicKey);
  });

  it("Deposit mint A into the vault", async () => {
    const { addr } = await client.generateVaultAddress(authority.publicKey);
    const vault = await client.fetchVault(addr);

    await spinUntil(asNumber(vault.startAt), 3, true);

    const depositorAlphaTokenBalanceBefore = await client.fetchTokenBalance(
      vault.alpha.mint,
      authority.publicKey
    );

    const amount = 100_000_000;
    const _amount = new u64(amount);
    await client.deposit(
      addr,
      vault.alpha.mint,
      vault.alpha.lp,
      // todo: create util to do conversion between amounts wrt decimals
      _amount,
      authority
    );

    const depositorAlphaTokenBalanceAfter = await client.fetchTokenBalance(
      vault.alpha.mint,
      authority.publicKey
    );

    const userAlphaLpBalance = await client.fetchTokenBalance(
      vault.alpha.lp,
      authority.publicKey
    );

    const vaultAlphaTokenBalance = await client.fetchTokenBalance(
      vault.alpha.mint,
      addr
    );

    const vaultAfter = await client.fetchVault(addr);
    expect(vaultAfter.alpha.deposited.toNumber()).to.equal(amount);
    expect(depositorAlphaTokenBalanceAfter).to.equal(
      depositorAlphaTokenBalanceBefore - amount
    );
    expect(userAlphaLpBalance).to.equal(amount);
    expect(vaultAlphaTokenBalance).to.equal(amount);
  });

  it("Deposit mint B into the vault", async () => {
    const { addr } = await client.generateVaultAddress(authority.publicKey);
    const vault = await client.fetchVault(addr);

    const depositorBetaTokenBalanceBefore = await client.fetchTokenBalance(
      vault.beta.mint,
      authority.publicKey
    );

    const amount = 100_000_000;
    const _amount = new u64(amount);
    await client.deposit(
      addr,
      vault.beta.mint,
      vault.beta.lp,
      // todo: create util to do conversion between amounts wrt decimals
      _amount,
      authority
    );

    const depositorBetaTokenBalanceAfter = await client.fetchTokenBalance(
      vault.beta.mint,
      authority.publicKey
    );

    const userBetaLpBalance = await client.fetchTokenBalance(
      vault.beta.lp,
      authority.publicKey
    );

    const vaultAlphaTokenBalance = await client.fetchTokenBalance(
      vault.beta.mint,
      addr
    );

    const vaultAfter = await client.fetchVault(addr);
    expect(vaultAfter.beta.deposited.toNumber()).to.equal(amount);
    expect(depositorBetaTokenBalanceAfter).to.equal(
      depositorBetaTokenBalanceBefore - amount
    );
    expect(userBetaLpBalance).to.equal(amount);
    expect(vaultAlphaTokenBalance).to.equal(amount);
  });

  it("Invest funds via the strategy", async () => {
    const { addr } = await client.generateVaultAddress(authority.publicKey);
    const vault = await client.fetchVault(addr);

    await spinUntil(asNumber(vault.investAt), 3, true);

    const depositorAlphaTokenBalanceBefore = await client.fetchTokenBalance(
      vault.beta.mint,
      addr
    );

    const depositorBetaTokenBalanceBefore = await client.fetchTokenBalance(
      vault.beta.mint,
      addr
    );

    const slippage = 2500;
    await client.invest(
      {
        tokenA: collateralA.publicKey,
        tokenB: collateralB.publicKey,
        swapAccount: stableSwapAccount.publicKey,
      },
      addr,
      slippage,
      authority
    );

    const vaultAlphaTokenBalanceAfter = await client.fetchTokenBalance(
      vault.alpha.mint,
      addr
    );

    const vaultBetaTokenBalanceAfter = await client.fetchTokenBalance(
      vault.beta.mint,
      addr
    );

    const vaultPoolLpToken = await client.fetchTokenBalance(
      stableSwap.state.poolTokenMint,
      addr
    );

    // at least amount invested with slippage

    const minAmountOut = withSlippage(
      depositorAlphaTokenBalanceBefore + depositorBetaTokenBalanceBefore,
      slippage
    );
    console.log("minAmountOut: ", minAmountOut);

    const vaultAfter = await client.fetchVault(addr);

    expect(vaultAfter.alpha.invested.toNumber() > 0).to.be.true;
    expect(vaultAfter.beta.invested.toNumber() > 0).to.be.true;

    // todo balances?
    console.log("vaultAlphaTokenBalanceAfter: ", vaultAlphaTokenBalanceAfter);
    console.log("vaultBetaTokenBalanceAfter: ", vaultBetaTokenBalanceAfter);
    // lp is equal to number of assets deposited?
    console.log("vaultPoolLpToken: ", vaultPoolLpToken);
    // depositorAlphaTokenBalanceBefore >= alphaInvested
    // depositorBetaTokenBalanceBefore >= betaInvested
  });

  it("Redeem Saber LP tokens for mints in the vault", async () => {
    const { addr } = await client.generateVaultAddress(authority.publicKey);
    const vault = await client.fetchVault(addr);

    await spinUntil(asNumber(vault.redeemAt), 3, true);

    const slippage = 2500;
    await client.redeem(
      {
        tokenA: collateralA.publicKey,
        tokenB: collateralB.publicKey,
        swapAccount: stableSwapAccount.publicKey,
      },
      addr,
      slippage,
      authority
    );

    const vaultAlphaTokenBalanceAfter = await client.fetchTokenBalance(
      vault.alpha.mint,
      addr
    );

    const vaultBetaTokenBalanceAfter = await client.fetchTokenBalance(
      vault.beta.mint,
      addr
    );

    const vaultPoolLpToken = await client.fetchTokenBalance(
      stableSwap.state.poolTokenMint,
      addr
    );

    const vaultAfter = await client.fetchVault(addr);
    const alphaInvested = vaultAfter.alpha.invested;
    const betaInvested = vaultAfter.beta.invested;

    console.log("alphaInvested: ", alphaInvested.toNumber());
    console.log("betaInvested: ", betaInvested.toNumber());
    console.log("vaultAlphaTokenBalanceAfter: ", vaultAlphaTokenBalanceAfter);
    console.log("vaultBetaTokenBalanceAfter: ", vaultBetaTokenBalanceAfter);
    // lp is equal to number of assets deposited?
    console.log("vaultPoolLpToken: ", vaultPoolLpToken);
  });

  it("Withdraw amount of mint from the vault", async () => {
    const { addr } = await client.generateVaultAddress(authority.publicKey);
    const vault = await client.fetchVault(addr);

    const alpha = vault.alpha.mint;
    const alphaLp = vault.alpha.lp;

    // lp before, lp after, collateral before, collateral after
    const userAlphaBefore = await client.fetchTokenBalance(
      alpha,
      authority.publicKey
    );

    const userLpBefore = await client.fetchTokenBalance(
      alphaLp,
      authority.publicKey
    );

    const vaultAlphaBefore = await client.fetchTokenBalance(alpha, addr);

    // todo
    const exchangeRate = await client.calculateExchangeRate(addr, alpha);
    console.log("exchangeRate: ", exchangeRate);

    await client.withdraw(
      addr,
      collateralA.publicKey,
      vault.alpha.lp,
      authority
    );

    // lp -> assets is not always going to be 1-1 but rather based on supply exchange rate
    const vaultAfter = await client.fetchVault(addr);
    console.log("vaultAfter: ", vaultAfter);
    console.log("alpha invested: ", vaultAfter.alpha.invested.toNumber());
    console.log("alpha received: ", vaultAfter.alpha.received.toNumber());

    const userAlphaAfter = await client.fetchTokenBalance(
      alpha,
      authority.publicKey
    );

    const userLpAfter = await client.fetchTokenBalance(
      alphaLp,
      authority.publicKey
    );

    const vaultAlphaAfter = await client.fetchTokenBalance(alpha, addr);

    console.log("userAlphaAfter: ", userAlphaAfter);
    console.log("userLpAfter: ", userLpAfter);
    console.log("vaultAlphaAfter: ", vaultAlphaAfter);
  });
});
