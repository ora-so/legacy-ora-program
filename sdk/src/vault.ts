import * as anchor from "@project-serum/anchor";
import { Program, Provider, Idl, Wallet } from "@project-serum/anchor";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  u64,
} from "@solana/spl-token";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import { AccountUtils } from "./common/account-utils";

// PoolConfig
import { PdaDerivationResult, SignerInfo } from "./common/types";
import { getSignersFromPayer, flattenValidInstructions } from "./common/util";
import { Vault } from "./types/vault";

export class VaultClient extends AccountUtils {
  wallet: Wallet;
  provider!: Provider;
  vaultProgram!: Program<Vault>;

  constructor(
    conn: Connection,
    wallet: anchor.Wallet,
    idl?: Idl,
    programId?: PublicKey
  ) {
    super(conn);
    this.wallet = wallet;
    this.setProvider();
    this.setVaultProgram(idl, programId);
  }

  setProvider = () => {
    this.provider = new Provider(
      this.conn,
      this.wallet,
      Provider.defaultOptions()
    );
    anchor.setProvider(this.provider);
  };

  setVaultProgram = (idl?: Idl, programId?: PublicKey) => {
    // instantiating program depends on the environment
    if (idl && programId) {
      console.log("idl: ", idl);
      // means running in prod
      this.vaultProgram = new Program<Vault>(
        idl as any,
        programId,
        this.provider
      );
    } else {
      // means running inside test suite
      this.vaultProgram = anchor.workspace.Vault as Program<Vault>;
    }
  };

  // ================================================
  // PDAs
  // ================================================

  generateVaultAddress = async (
    authority: PublicKey,
    programID: PublicKey = this.vaultProgram.programId
  ): Promise<PdaDerivationResult> => {
    const [addr, bump] = await this.findProgramAddress(programID, [
      "vault",
      authority,
    ]);

    return {
      addr,
      bump,
    } as PdaDerivationResult;
  };

  // ================================================
  // Fetch & deserialize objects
  // ================================================

  fetchVault = async (addr: PublicKey) => {
    const vault = await this.vaultProgram.account.vault.fetch(addr);

    return {
      vault,
    };
  };

  // ================================================
  // Fetch token account balanaces
  // ================================================

  fetchTokenBalance = async (
    mint: PublicKey,
    owner: PublicKey
  ): Promise<number> => {
    const addr = await this.findAssociatedTokenAddress(owner, mint);
    const tokenBalance = await this.getTokenBalance(addr);

    return +tokenBalance["value"]["amount"];
  };

  // ================================================
  // Smart contract function helpers
  // ================================================

  initializeVault = async (payer: PublicKey | Keypair) => {
    const signerInfo: SignerInfo = getSignersFromPayer(payer);

    const { addr, bump } = await this.generateVaultAddress(signerInfo.payer);

    return this.vaultProgram.rpc.initialize(bump, {
      accounts: {
        authority: signerInfo.payer,
        vault: addr,
        systemProgram: SystemProgram.programId,
      },
      signers: signerInfo.signers,
    });
  };

  // todo: deposit/withdraw are eerily similiar right now. i expect this will somewhat change over time
  // or become a non-issue if we migrate to mpl lib to auto generate the core SDK.
  deposit = async (
    vault: PublicKey,
    mint: PublicKey,
    amount: u64,
    payer: PublicKey | Keypair
  ) => {
    const signerInfo: SignerInfo = getSignersFromPayer(payer);
    const _vault = await this.fetchVault(vault);

    const sourceTokenAccount = await this.getOrCreateATA(
      mint,
      signerInfo.payer,
      signerInfo.payer,
      this.provider.connection
    );

    const destinationTokenAccount = await this.getOrCreateATA(
      mint,
      vault,
      signerInfo.payer,
      this.provider.connection
    );

    return this.vaultProgram.rpc.deposit(amount, {
      accounts: {
        payer: signerInfo.payer,
        authority: _vault.vault.authority,
        vault,
        mint,
        sourceAta: sourceTokenAccount.address,
        destinationAta: destinationTokenAccount.address,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        ataProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        rent: SYSVAR_RENT_PUBKEY,
      },
      // note: we forgo passing in depositor's ATAs here because it's presumed they
      // already have these tokens. otherwise, they will not be able to deposit.
      preInstructions: flattenValidInstructions([destinationTokenAccount]),
      signers: signerInfo.signers,
    });
  };

  // todo: in the future, we should also expose a fn to redeem all of 1 mint (aka not have to explicitly specify an amount)
  withdraw = async (
    vault: PublicKey,
    mint: PublicKey,
    amount: u64,
    payer: PublicKey | Keypair
  ) => {
    const signerInfo: SignerInfo = getSignersFromPayer(payer);
    const _vault = await this.fetchVault(vault);

    const sourceTokenAccount = await this.getOrCreateATA(
      mint,
      vault,
      signerInfo.payer,
      this.provider.connection
    );

    const destinationTokenAccount = await this.getOrCreateATA(
      mint,
      signerInfo.payer,
      signerInfo.payer,
      this.provider.connection
    );

    return this.vaultProgram.rpc.withdraw(amount, {
      accounts: {
        payer: signerInfo.payer,
        authority: _vault.vault.authority,
        vault,
        mint,
        sourceAta: sourceTokenAccount.address,
        destinationAta: destinationTokenAccount.address,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        ataProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        rent: SYSVAR_RENT_PUBKEY,
      },
      // note: we forgo passing in depositor's ATAs here because it's presumed they
      // already have these tokens. otherwise, they will not be able to deposit.
      preInstructions: flattenValidInstructions([destinationTokenAccount]),
      signers: signerInfo.signers,
    });
  };
}
