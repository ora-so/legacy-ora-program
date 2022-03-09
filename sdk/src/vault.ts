import * as anchor from "@project-serum/anchor";
import { Program, Provider, Idl, Wallet } from "@project-serum/anchor";
import { StableSwap, SWAP_PROGRAM_ID } from "@saberhq/stableswap-sdk";
import { TOKEN_PROGRAM_ID, u64 } from "@solana/spl-token";
import {
  Cluster,
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";
import { SaberRegistryProvider } from "saber-swap-registry-provider";

import { AccountUtils } from "./common/account-utils";
import { DEVNET } from "./common/constant";
import { PdaDerivationResult, SignerInfo, PoolConfig } from "./common/types";
import { getSignersFromPayer, flattenValidInstructions } from "./common/util";
import { BucketVault as Vault } from "./types/bucket_vault";

export class VaultClient extends AccountUtils {
  wallet: Wallet;
  provider!: Provider;
  vaultProgram!: Program<Vault>;

  // providers
  saberProvider!: SaberRegistryProvider;

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

    this.saberProvider = new SaberRegistryProvider();
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
      this.vaultProgram = anchor.workspace.BucketVault as Program<Vault>;
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

  // todo: there is A LOT of logic for functions that interact with saber. extract into a common helper function.
  deposit = async (
    poolConfig: PoolConfig,
    vault: PublicKey,
    payer: PublicKey | Keypair,
    cluster: Cluster = DEVNET
  ) => {
    if (!poolConfig.depositConfig) {
      throw new Error("Deposit config must be defined for deposit operations");
    }

    const signerInfo: SignerInfo = getSignersFromPayer(payer);

    // fetch data needed to perform swap; for now, we are only using saber, so we need to
    // use the swap account for pool with mints A/B.
    const swapAccount = poolConfig.swapAccount
      ? poolConfig.swapAccount
      : await this.saberProvider.getSwapAccountFromMints(
          poolConfig.tokenA,
          poolConfig.tokenB,
          cluster
        );

    const fetchedStableSwap = await StableSwap.load(
      this.provider.connection,
      swapAccount,
      SWAP_PROGRAM_ID
    );

    const tokenAmountA = new u64(poolConfig.depositConfig.tokenAmountA);
    const tokenAmountB = new u64(poolConfig.depositConfig.tokenAmountB);

    // todo: move on-chain; for now, just use 15% slippage so that transaction goes through.
    const minMintAmount =
      (poolConfig.depositConfig.tokenAmountA +
        poolConfig.depositConfig.tokenAmountB) *
      0.85;
    const _minMintAmount = new u64(minMintAmount);

    // we need 5 ATAs: vault token A source, vault token B source, vault LP
    const userTokenA = await this.getOrCreateATA(
      poolConfig.tokenA,
      signerInfo.payer,
      signerInfo.payer,
      this.provider.connection
    );

    const userTokenB = await this.getOrCreateATA(
      poolConfig.tokenB,
      signerInfo.payer,
      signerInfo.payer,
      this.provider.connection
    );

    const vaultTokenA = await this.getOrCreateATA(
      poolConfig.tokenA,
      vault,
      signerInfo.payer,
      this.provider.connection
    );

    const vaultTokenB = await this.getOrCreateATA(
      poolConfig.tokenB,
      vault,
      signerInfo.payer,
      this.provider.connection
    );

    const vaultLp = await this.getOrCreateATA(
      fetchedStableSwap.state.poolTokenMint,
      vault,
      signerInfo.payer,
      this.provider.connection
    );

    return this.vaultProgram.rpc.deposit(
      tokenAmountA,
      tokenAmountB,
      _minMintAmount,
      {
        accounts: {
          authority: signerInfo.payer,
          vault,
          userTokenA: userTokenA.address,
          userTokenB: userTokenB.address,
          saberDeposit: {
            saberSwapCommon: {
              swap: fetchedStableSwap.config.swapAccount,
              swapAuthority: fetchedStableSwap.config.authority,
              sourceTokenA: vaultTokenA.address,
              reserveA: fetchedStableSwap.state.tokenA.reserve,
              sourceTokenB: vaultTokenB.address,
              reserveB: fetchedStableSwap.state.tokenB.reserve,
              poolMint: fetchedStableSwap.state.poolTokenMint,
              saberProgram: fetchedStableSwap.config.swapProgramID,
            },
            outputLp: vaultLp.address,
          },
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
        // note: we forgo passing in depositor's ATAs here because it's presumed they
        // already have these tokens. otherwise, they will not be able to deposit.
        preInstructions: flattenValidInstructions([
          vaultTokenA,
          vaultTokenB,
          vaultLp,
        ]),
        signers: signerInfo.signers,
      }
    );
  };

  withdraw = async (
    poolConfig: PoolConfig,
    vault: PublicKey,
    payer: PublicKey | Keypair,
    cluster: Cluster = DEVNET
  ) => {
    if (!poolConfig.withdrawConfig) {
      throw new Error(
        "Withdraw config must be defined for withdraw operations"
      );
    }

    const signerInfo: SignerInfo = getSignersFromPayer(payer);

    // fetch data needed to perform swap; for now, we are only using saber, so we need to
    // use he swap account for pool with mints A/B.
    const swapAccount = poolConfig.swapAccount
      ? poolConfig.swapAccount
      : await this.saberProvider.getSwapAccountFromMints(
          poolConfig.tokenA,
          poolConfig.tokenB,
          cluster
        );

    const fetchedStableSwap = await StableSwap.load(
      this.provider.connection,
      swapAccount,
      SWAP_PROGRAM_ID
    );

    const tokenWithdrawalAmount =
      (poolConfig.withdrawConfig.tokenAmountLp * 0.85) / 2;

    // todo: move on-chain; for now, just use 15% slippage so that transaction goes through.
    const minMintAmount = new u64(poolConfig.withdrawConfig.tokenAmountLp);
    const _tokenWithdrawalAmount = new u64(tokenWithdrawalAmount);

    // we need 5 ATAs: vault token A source, vault token B source, vault LP
    const userTokenA = await this.getOrCreateATA(
      poolConfig.tokenA,
      signerInfo.payer,
      signerInfo.payer,
      this.provider.connection
    );

    const userTokenB = await this.getOrCreateATA(
      poolConfig.tokenB,
      signerInfo.payer,
      signerInfo.payer,
      this.provider.connection
    );

    const vaultTokenA = await this.getOrCreateATA(
      poolConfig.tokenA,
      vault,
      signerInfo.payer,
      this.provider.connection
    );

    const vaultTokenB = await this.getOrCreateATA(
      poolConfig.tokenB,
      vault,
      signerInfo.payer,
      this.provider.connection
    );

    const vaultLp = await this.getOrCreateATA(
      fetchedStableSwap.state.poolTokenMint,
      vault,
      signerInfo.payer,
      this.provider.connection
    );

    return this.vaultProgram.rpc.withdraw(
      minMintAmount,
      _tokenWithdrawalAmount,
      _tokenWithdrawalAmount,
      {
        accounts: {
          authority: signerInfo.payer,
          vault,
          userTokenA: userTokenA.address,
          userTokenB: userTokenB.address,
          saberWithdraw: {
            saberSwapCommon: {
              swap: fetchedStableSwap.config.swapAccount,
              swapAuthority: fetchedStableSwap.config.authority,
              sourceTokenA: vaultTokenA.address,
              reserveA: fetchedStableSwap.state.tokenA.reserve,
              sourceTokenB: vaultTokenB.address,
              reserveB: fetchedStableSwap.state.tokenB.reserve,
              poolMint: fetchedStableSwap.state.poolTokenMint,
              saberProgram: fetchedStableSwap.config.swapProgramID,
            },
            inputLp: vaultLp.address,
            outputAFees: fetchedStableSwap.state.tokenA.adminFeeAccount,
            outputBFees: fetchedStableSwap.state.tokenB.adminFeeAccount,
          },
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
        preInstructions: flattenValidInstructions([
          vaultTokenA,
          vaultTokenB,
          userTokenA,
          userTokenB,
        ]),
        signers: signerInfo.signers,
      }
    );
  };
}
