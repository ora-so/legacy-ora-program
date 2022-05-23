import { TestContext, wrappedIt } from "./common/util";
import { VaultTestClient } from "./test-client";

export const suite = (getContext: () => Promise<TestContext>) => {
  const _testClient = new VaultTestClient();

  wrappedIt("Placeholder", getContext, async (_ctx) =>
    console.log("pending implementation")
  );
};
