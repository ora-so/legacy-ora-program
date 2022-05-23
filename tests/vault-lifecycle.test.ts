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

import { VaultClient, executeTx, NodeWallet, sleep } from "../sdk";
import { assertKeysEqual, TestContext } from "./common/util";

import {
  setupPoolInitialization,
  FEES,
  AMP_FACTOR,
} from "./helpers/saber/pool";
import { ONE_U64, ZERO_U64 } from "../sdk/src/common/constant";

import { suite as saberLpTestSuite } from "./saber-lp.test";
import { suite as userCapDepositSuite } from "./user-cap-deposit.test";
import { suite as assetCapDepositSuite } from "./asset-cap-deposit.test";
import { suite as actionsAtInvalidTimesSuite } from "./actions-at-invalid-times.test";
import { suite as attemptDepositInvalidMint } from "./attempt-deposit-invalid-mint.test";
import { suite as solVaultSuite } from "./sol-vault";

describe("vault", () => {
  const _provider = anchor.Provider.env();

  const client = new VaultClient(
    _provider.connection,
    _provider.wallet as anchor.Wallet
  );

  let testContext: TestContext;

  let authority: Keypair;
  // todo: come up with a better way to fund wallets with keypair
  // wrapped token like saber?
  let user1: Keypair;

  let collateralA: Keypair;
  let collateralB: Keypair;
  // act as unauthorized collateral
  let collateralC: Keypair;

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

  const getContext = async () => {
    while (testContext.stableSwap === undefined) await sleep(100);

    return testContext;
  };

  before("Create funded user accounts", async () => {
    authority = await nodeWallet.createFundedWallet(1 * LAMPORTS_PER_SOL);
    user1 = await nodeWallet.createFundedWallet(1 * LAMPORTS_PER_SOL);
  });

  before("Mint collateral A and B", async () => {
    collateralA = Keypair.generate();
    collateralB = Keypair.generate();
    collateralC = Keypair.generate();

    for (const collateral of [collateralA, collateralB, collateralC]) {
      // mint collateral A
      await executeTx(
        client.provider.connection,
        await client.mintTokens(
          client.provider.connection,
          authority.publicKey,
          collateral.publicKey,
          authority.publicKey,
          authority.publicKey
        ),
        [authority, collateral]
      );
    }
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

  before("Saturate context", () => {
    testContext = {
      nodeWallet,
      authority,
      user1,
      collateralA,
      collateralB,
      collateralC,
      tokenPool,
      userPoolAccount,
      mintA,
      mintB,
      tokenAccountA,
      tokenAccountB,
      adminFeeAccountA,
      adminFeeAccountB,
      exchange,
      stableSwap,
      stableSwapAccount,
      stableSwapProgramId,
    };
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

  it("Initialize global protocol state", async () => {
    const treasury = Keypair.generate().publicKey;
    await client.initializeGlobalProtocolState(treasury, authority);

    const { addr } = await client.generateGlobalStateAddress();
    const globalState = await client.fetchGlobalState(addr);
    console.log("authority : ", authority.publicKey.toBase58());
    console.log("globalState.authority : ", globalState.authority.toBase58());
    console.log("treasury : ", treasury.toBase58());
    console.log("globalState.treasury : ", globalState.treasury.toBase58());
  });

  it("Initialize saber strategy", async () => {
    const { tx, strategy } = await client.initializeSaberStrategy(
      collateralA.publicKey,
      collateralB.publicKey,
      exchange.swapAccount,
      exchange.lpToken.mintAccount,
      authority
    );

    saberStrategy = strategy;
    console.log("transaction hash: ", tx);
  });

  // describe(
  //   "Null strategy :: Test deposit invalid mint",
  //   attemptDepositInvalidMint.bind(this, getContext)
  // );

  // describe(
  //   "Null strategy :: Test user cap",
  //   userCapDepositSuite.bind(this, getContext)
  // );

  // describe(
  //   "Null strategy :: Test asset cap",
  //   assetCapDepositSuite.bind(this, getContext)
  // );

  // look into imbalanced redemption
  // ==> [] more on A
  // ==> [] more on B

  describe(
    "Saber LP Strategy :: Full lifecycle",
    saberLpTestSuite.bind(this, getContext)
  );

  // describe(
  //   "Vault with SOL :: Test wSOL & SOL ATA transfers",
  //   solVaultSuite.bind(this, getContext)
  // );

  // =========================================================
});
