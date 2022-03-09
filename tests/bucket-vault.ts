import * as anchor from "@project-serum/anchor";
import { expect } from "chai";

describe("vault", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.Provider.env());

  it("Load program definition", async () => {
    // Add your test here.    
    const program = anchor.workspace.BucketVault;
    expect(program !== undefined).to.be.true;
  });
});
