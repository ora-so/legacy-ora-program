import * as anchor from "@project-serum/anchor";
import { PublicKey, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { expect } from "chai";
import {
  deployNewSwap,
  StableSwap,
  SWAP_PROGRAM_ID,
  IExchange,
} from "@saberhq/stableswap-sdk";
import { SPLToken, Token as SToken } from "@saberhq/token-utils";
import { SignerWallet } from "@saberhq/solana-contrib";
import { TOKEN_PROGRAM_ID, u64 } from "@solana/spl-token";

import { VaultClient, executeTx, NodeWallet } from "../sdk";
import { assertKeysEqual } from "./common/util";
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

  let authority: Keypair;

  let collateralA: Keypair;
  let collateralB: Keypair;

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

  it("Initialize vault", async () => {
    await client.initializeVault(authority);

    const { addr } = await client.generateVaultAddress(authority.publicKey);
    const vault = await client.fetchVault(addr);

    assertKeysEqual(vault.vault.authority, authority.publicKey);
  });

  it("Deposit the monies, store LP in the vault ATA", async () => {
    const { addr } = await client.generateVaultAddress(authority.publicKey);

    const balanceABefore = await client.fetchTokenBalance(
      collateralA.publicKey,
      authority.publicKey
    );
    const balanceBBefore = await client.fetchTokenBalance(
      collateralB.publicKey,
      authority.publicKey
    );

    const { vault: vaultBefore } = await client.fetchVault(addr);

    const depositAmountA = 1_000_000;
    const depositAmountB = 1_000_000;

    // todo: figure out how to handle slippage; for now, just use 15% slippage so that transaction goes through.
    const minMintAmount = (depositAmountA + depositAmountB) * 0.85;

    await client.deposit(
      {
        tokenA: collateralA.publicKey,
        tokenB: collateralB.publicKey,
        depositConfig: {
          tokenAmountA: depositAmountA,
          tokenAmountB: depositAmountB,
          minMintAmount,
        },
        swapAccount: stableSwapAccount.publicKey,
      },
      addr,
      authority
    );

    const balanceAAfter = await client.fetchTokenBalance(
      collateralA.publicKey,
      authority.publicKey
    );
    const balanceBAfter = await client.fetchTokenBalance(
      collateralB.publicKey,
      authority.publicKey
    );

    const vaultLpBalance = await client.fetchTokenBalance(
      stableSwap.state.poolTokenMint,
      addr
    );

    expect(balanceAAfter).to.equal(balanceABefore - depositAmountA);
    expect(balanceBAfter).to.equal(balanceBBefore - depositAmountB);
    expect(vaultLpBalance > minMintAmount).to.be.true;

    const { vault: vaultAfter } = await client.fetchVault(addr);
    expect(vaultAfter.depositNonce.toNumber()).to.equal(
      vaultBefore.depositNonce.toNumber() + 1
    );
  });

  it("Provide LP tokens in return for dual-sided pool liquidity", async () => {
    const { addr } = await client.generateVaultAddress(authority.publicKey);

    const { vault: vaultBefore } = await client.fetchVault(addr);

    const balanceABefore = await client.fetchTokenBalance(
      collateralA.publicKey,
      authority.publicKey
    );
    const balanceBBefore = await client.fetchTokenBalance(
      collateralB.publicKey,
      authority.publicKey
    );

    const vaultLpBalanceBefore = await client.fetchTokenBalance(
      stableSwap.state.poolTokenMint,
      addr
    );

    const withdrawalAmount = 1_000_000;
    // todo: move on-chain; for now, just use 15% slippage so that transaction goes through.
    const perTokenWithdrawalAmount = (withdrawalAmount * 0.85) / 2;

    await client.withdraw(
      {
        tokenA: collateralA.publicKey,
        tokenB: collateralB.publicKey,
        withdrawConfig: {
          tokenAmountLp: withdrawalAmount,
          tokenAmountA: perTokenWithdrawalAmount,
          tokenAmountB: perTokenWithdrawalAmount,
        },
        swapAccount: stableSwapAccount.publicKey,
      },
      addr,
      authority
    );

    const balanceAAfter = await client.fetchTokenBalance(
      collateralA.publicKey,
      authority.publicKey
    );
    const balanceBAfter = await client.fetchTokenBalance(
      collateralB.publicKey,
      authority.publicKey
    );

    const vaultLpBalanceAfter = await client.fetchTokenBalance(
      stableSwap.state.poolTokenMint,
      addr
    );

    expect(balanceAAfter - balanceABefore >= perTokenWithdrawalAmount).to.be
      .true;
    expect(balanceBAfter - balanceBBefore >= perTokenWithdrawalAmount).to.be
      .true;
    expect(vaultLpBalanceAfter).to.equal(
      vaultLpBalanceBefore - withdrawalAmount
    );

    const { vault: vaultAfter } = await client.fetchVault(addr);
    expect(vaultAfter.withdrawalNonce.toNumber()).to.equal(
      vaultBefore.withdrawalNonce.toNumber() + 1
    );
  });
});
