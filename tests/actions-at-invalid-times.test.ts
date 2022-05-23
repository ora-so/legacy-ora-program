import { TestContext, wrappedIt } from "./common/util";
import { VaultTestClient } from "./test-client";

export const suite = (getContext: () => Promise<TestContext>) => {
  const _testClient = new VaultTestClient();

  // setup vault and try to do stuff before the start at time
  wrappedIt("Placeholder", getContext, async (_ctx) =>
    console.log("pending implementation")
  );

  // ======== deposit, invest, redeem before periods ========
  // it("Attempt to deposit before deposit period", async () => {
  //   const vault = await client.fetchVault(testClient.getCurrentVaultAddress());
  //   expect(getCurrentTimestamp() <= vault.startAt.toNumber()).to.be.true;
  //   expectThrowsAsync(async () => {
  //     await testClient.makeDeposit({
  //       payer: user1,
  //       amount: 100_000_000,
  //       mint: collateralA.publicKey,
  //       applyImmediately: true,
  //     } as DepositConfig);
  //   });
  // });

  // it("Attempt to invest before live period", async () => {
  //   const vault = await client.fetchVault(testClient.getCurrentVaultAddress());
  //   expect(getCurrentTimestamp() <= vault.investAt.toNumber()).to.be.true;
  //   expectThrowsAsync(async () => {
  //     await testClient.investFunds({
  //       payer: testClient.fetchAuthorityKp(),
  //       tokenA: vault.alpha.mint,
  //       amountA: 1,
  //       tokenB: vault.beta.mint,
  //       amountB: 1,
  //       minOut: 0,
  //       swapAccount: stableSwapAccount.publicKey,
  //       applyImmediately: true,
  //     } as InvestConfig);
  //   });
  // });
};
