import * as anchor from "@project-serum/anchor";
import { PublicKey, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { expect } from "chai";
import { TOKEN_PROGRAM_ID, u64 } from "@solana/spl-token";

import { VaultClient, executeTx, NodeWallet } from "../sdk/dist/cjs";
import { assertKeysEqual } from "./common/util";

describe("vault", () => {
  const _provider = anchor.Provider.env();

  const client = new VaultClient(
    _provider.connection,
    _provider.wallet as anchor.Wallet
  );

  let authority: Keypair;

  let collateralA: Keypair;
  let collateralB: Keypair;

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

  it("Deposit amount of mint into the vault", async () => {
    const { addr } = await client.generateVaultAddress(authority.publicKey);

    const balanceABefore = await client.fetchTokenBalance(
      collateralA.publicKey,
      authority.publicKey
    );

    const amount = new u64(1_000_000);
    await client.deposit(addr, collateralA.publicKey, amount, authority);

    const balanceAAfter = await client.fetchTokenBalance(
      collateralA.publicKey,
      authority.publicKey
    );

    const vaultABalanceAfter = await client.fetchTokenBalance(
      collateralA.publicKey,
      addr
    );

    // note: don't check ATA balance before because it DNE
    expect(balanceAAfter).to.equal(balanceABefore - amount.toNumber());
    expect(vaultABalanceAfter).to.equal(amount.toNumber());
  });

  it("Withdraw amount of mint from the vault", async () => {
    const { addr } = await client.generateVaultAddress(authority.publicKey);

    const balanceABefore = await client.fetchTokenBalance(
      collateralA.publicKey,
      authority.publicKey
    );

    const vaultABalanceBefore = await client.fetchTokenBalance(
      collateralA.publicKey,
      addr
    );

    const amount = new u64(1_000_000);
    await client.withdraw(addr, collateralA.publicKey, amount, authority);

    const balanceAAfter = await client.fetchTokenBalance(
      collateralA.publicKey,
      authority.publicKey
    );

    const vaultABalanceAfter = await client.fetchTokenBalance(
      collateralA.publicKey,
      addr
    );

    expect(balanceAAfter).to.equal(balanceABefore + amount.toNumber());
    expect(vaultABalanceAfter).to.equal(
      vaultABalanceBefore - amount.toNumber()
    );
  });
});
