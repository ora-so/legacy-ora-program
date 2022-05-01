import * as anchor from "@project-serum/anchor";
import { Program, Provider, Idl, Wallet } from "@project-serum/anchor";
import { StableSwap, SWAP_PROGRAM_ID } from "@saberhq/stableswap-sdk";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  u64,
} from "@solana/spl-token";
import {
  Cluster,
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import { SaberRegistryProvider } from "saber-swap-registry-provider";

import { AccountUtils } from "./common/account-utils";
import { DEVNET } from "./common/constant";
import { PdaDerivationResult, SignerInfo, PoolConfig } from "./common/types";
import { getSignersFromPayer, flattenValidInstructions } from "./common/util";
import { Vault } from "./types/vault";

const MAX_BPS = 10_000;
const U64_ZERO = new u64(0);

export interface TokenSupply {
  supply: number;
  decimals: number;
}

// include strategy object?
export interface VaultConfig {
  authority: PublicKey;
  strategy: PublicKey;
  strategist: PublicKey;
  alpha: PublicKey;
  beta: PublicKey;
  fixedRate: number;
  startAt: u64;
  investAt: u64;
  redeemAt: u64;
}

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

  generateStrategyAddress = async (
    tokenA: PublicKey,
    tokenB: PublicKey,
    authority: PublicKey,
    programID: PublicKey = this.vaultProgram.programId
  ): Promise<PdaDerivationResult> => {
    const [addr, bump] = await this.findProgramAddress(programID, [
      "strategy",
      tokenA,
      tokenB,
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
    return this.vaultProgram.account.vault.fetch(addr);
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

  fetchTokenSupply = async (mint: PublicKey): Promise<TokenSupply> => {
    const supply = await this.conn.getTokenSupply(mint);

    return {
      supply: +supply["value"]["amount"],
      decimals: +supply["value"]["decimals"],
    };
  };

  getAsset = (vault: any, mint: PublicKey): any => {
    if (mint.toBase58() === vault.alpha.mint.toBase58()) {
      return vault.alpha;
    } else if (mint.toBase58() === vault.beta.mint.toBase58()) {
      return vault.beta;
    } else {
      throw new Error("Invalid pubkey");
    }
  };

  // todo: figure out the typing here
  calculateExchangeRate = async (vault: PublicKey, mint: PublicKey) => {
    // amount in vault / lp supply
    const _vault = await this.fetchVault(vault);
    const _asset = this.getAsset(_vault, mint);

    const lpSupply = (await this.fetchTokenSupply(_asset.lp)).supply;
    const balance = await this.fetchTokenBalance(_asset.mint, vault);

    console.log("balance: ", balance);
    console.log("lpSupply: ", lpSupply);

    return balance / lpSupply;
  };

  // ================================================
  // Smart contract function helpers
  // ================================================

  initializeStrategy = async (
    tokenA: PublicKey,
    tokenB: PublicKey,
    payer: PublicKey | Keypair
  ) => {
    const signerInfo: SignerInfo = getSignersFromPayer(payer);

    const { addr, bump } = await this.generateStrategyAddress(
      tokenA,
      tokenB,
      signerInfo.payer
    );

    const tx = await this.vaultProgram.rpc.initializeSaberStrategy(bump, {
      accounts: {
        authority: signerInfo.payer,
        saberStrategy: addr,
        tokenA,
        tokenB,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      },
      signers: signerInfo.signers,
    });

    return {
      tx,
      strategy: addr,
    };
  };

  // we init mints with the LP keypairs such that the mint and freeze authority is the vault. this means that the vault PDA will
  // be able to sign future mint (and possibly freeze instructions).
  initializeVault = async (
    vaultConfig: VaultConfig,
    payer: PublicKey | Keypair
  ) => {
    const signerInfo: SignerInfo = getSignersFromPayer(payer);

    const { addr: vault, bump } = await this.generateVaultAddress(
      signerInfo.payer
    );

    const alpha = vaultConfig.alpha;
    const alphaDecimals = (await this.fetchTokenSupply(vaultConfig.alpha))
      .decimals;
    const alphaLp = Keypair.generate();
    const vaultLpA = await this.getOrCreateATA(
      alphaLp.publicKey,
      vault,
      signerInfo.payer,
      this.provider.connection
    );

    const beta = vaultConfig.beta;
    const betaDecimals = (await this.fetchTokenSupply(vaultConfig.beta))
      .decimals;
    const betaLp = Keypair.generate();
    const vaultLpB = await this.getOrCreateATA(
      betaLp.publicKey,
      vault,
      signerInfo.payer,
      this.provider.connection
    );

    return this.vaultProgram.rpc.initializeVault(bump, vaultConfig, {
      accounts: {
        authority: signerInfo.payer,
        vault,
        strategy: vaultConfig.strategy,
        strategist: vaultConfig.strategist,
        alphaMint: alpha,
        alphaLp: alphaLp.publicKey,
        betaMint: beta,
        betaLp: betaLp.publicKey,
        systemProgram: SystemProgram.programId,
      },
      preInstructions: [
        ...(await this.mintTokens(
          this.provider.connection,
          signerInfo.payer,
          alphaLp.publicKey,
          vault,
          vault,
          alphaDecimals
        )),
        ...(await this.mintTokens(
          this.provider.connection,
          signerInfo.payer,
          betaLp.publicKey,
          vault,
          vault,
          betaDecimals
        )),
        ...(vaultLpA.instruction ? [vaultLpA.instruction] : []),
        ...(vaultLpB.instruction ? [vaultLpB.instruction] : []),
      ],
      signers: [alphaLp, betaLp, ...signerInfo.signers],
    });
  };

  // todo: deposit/withdraw are eerily similiar right now. i expect this will somewhat change over time
  // or become a non-issue if we migrate to mpl lib to auto generate the core SDK.
  deposit = async (
    vault: PublicKey,
    mint: PublicKey,
    lp: PublicKey,
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

    const destinationLpTokenAccount = await this.getOrCreateATA(
      lp,
      signerInfo.payer,
      signerInfo.payer,
      this.provider.connection
    );

    return this.vaultProgram.rpc.deposit(amount, {
      accounts: {
        payer: signerInfo.payer,
        authority: _vault.authority,
        vault,
        mint,
        lp,
        sourceAta: sourceTokenAccount.address,
        destinationAta: destinationTokenAccount.address,
        lpAta: destinationLpTokenAccount.address,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        ataProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        rent: SYSVAR_RENT_PUBKEY,
      },
      // note: we forgo passing in depositor's ATAs here because it's presumed they
      // already have these tokens. otherwise, they will not be able to deposit.
      preInstructions: flattenValidInstructions([
        destinationTokenAccount,
        destinationLpTokenAccount,
      ]),
      signers: signerInfo.signers,
    });
  };

  // todo: more extensible solution is probably to build a strategy object, similar to
  // `StableSwap` or `PoolConfig`
  invest = async (
    poolConfig: PoolConfig,
    vault: PublicKey,
    slippage: number,
    payer: PublicKey | Keypair,
    cluster: Cluster = DEVNET
  ) => {
    // if (!poolConfig.depositConfig) {
    //   throw new Error("Deposit config must be defined for deposit operations");
    // }
    console.log("slippage: ", slippage);

    const signerInfo: SignerInfo = getSignersFromPayer(payer);
    const _vault = await this.fetchVault(vault);
    console.log("_vault: ", _vault);

    // fetch data needed to perform swap; for now, we are only using saber, so we need to
    // use the swap account for pool with mints A/B.
    const swapAccount = poolConfig.swapAccount
      ? poolConfig.swapAccount
      : await this.saberProvider.getSwapAccountFromMints(
          poolConfig.tokenA,
          poolConfig.tokenB,
          cluster
        );

    console.log("swapAccount: ", swapAccount);

    const fetchedStableSwap = await StableSwap.load(
      this.provider.connection,
      swapAccount,
      SWAP_PROGRAM_ID
    );

    console.log("fetchedStableSwap: ", fetchedStableSwap);

    const vaultTokenA = await this.getOrCreateATA(
      poolConfig.tokenA,
      vault,
      signerInfo.payer,
      this.provider.connection
    );

    console.log("vaultTokenA: ", vaultTokenA.address.toBase58());

    const vaultTokenB = await this.getOrCreateATA(
      poolConfig.tokenB,
      vault,
      signerInfo.payer,
      this.provider.connection
    );

    console.log("vaultTokenB: ", vaultTokenB.address.toBase58());

    const vaultLpToken = await this.getOrCreateATA(
      fetchedStableSwap.state.poolTokenMint,
      vault,
      signerInfo.payer,
      this.provider.connection
    );

    console.log("vaultLpToken: ", vaultLpToken.address.toBase58());

    return this.vaultProgram.rpc.invest(slippage, {
      accounts: {
        payer: signerInfo.payer, // must be strategist
        authority: _vault.authority,
        strategy: _vault.strategy,
        vault,
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
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          },
          outputLp: vaultLpToken.address,
        },
        ataProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        rent: SYSVAR_RENT_PUBKEY,
      },
      // there is an edge csae where we don't have any deposits in 1 side of the vault, thus the ATA will not exist.
      // this will immediately cause the transction to fail because Anchor interprets the account as a TokenAccount.
      // so, a non-existent account will fail.
      preInstructions: flattenValidInstructions([
        vaultTokenA,
        vaultTokenB,
        vaultLpToken,
      ]),
      signers: signerInfo.signers,
    });
  };

  redeem = async (
    poolConfig: PoolConfig,
    vault: PublicKey,
    slippageBps: number,
    payer: PublicKey | Keypair,
    cluster: Cluster = DEVNET
  ) => {
    const signerInfo: SignerInfo = getSignersFromPayer(payer);
    const _vault = await this.fetchVault(vault);

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

    // we don't include pre-instruction to create the ATA because this is
    // handled in the instruction itself.
    const vaultLpToken = await this.getOrCreateATA(
      fetchedStableSwap.state.poolTokenMint,
      vault,
      signerInfo.payer,
      this.provider.connection
    );

    const slippagePercentage = (MAX_BPS - slippageBps) / MAX_BPS;

    const minA = new u64(
      _vault.alpha.deposited.toNumber() * slippagePercentage
    );
    console.log("minA: ", minA.toNumber());

    const minB = new u64(_vault.beta.deposited.toNumber() * slippagePercentage);
    console.log("minB: ", minB.toNumber());

    return this.vaultProgram.rpc.redeem(minA, minB, {
      accounts: {
        payer: signerInfo.payer, // must be strategist
        authority: _vault.authority,
        strategy: _vault.strategy,
        vault,
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
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          },
          inputLp: vaultLpToken.address,
          outputAFees: fetchedStableSwap.state.tokenA.adminFeeAccount,
          outputBFees: fetchedStableSwap.state.tokenB.adminFeeAccount,
        },
        ataProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        rent: SYSVAR_RENT_PUBKEY,
      },
      signers: signerInfo.signers,
    });
  };

  withdraw = async (
    vault: PublicKey,
    mint: PublicKey,
    lp: PublicKey,
    payer: PublicKey | Keypair,
    amount: u64 = U64_ZERO
  ) => {
    const signerInfo: SignerInfo = getSignersFromPayer(payer);
    const _vault = await this.fetchVault(vault);

    const sourceTokenAccount = await this.getOrCreateATA(
      mint,
      vault,
      signerInfo.payer,
      this.provider.connection
    );

    const sourceLpAccount = await this.getOrCreateATA(
      lp,
      signerInfo.payer,
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
        authority: _vault.authority,
        vault,
        mint,
        lp,
        sourceLp: sourceLpAccount.address,
        sourceAta: sourceTokenAccount.address,
        destinationAta: destinationTokenAccount.address,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        ataProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        rent: SYSVAR_RENT_PUBKEY,
      },
      // preInstructions: flattenValidInstructions([destinationTokenAccount]),
      signers: signerInfo.signers,
    });
  };
}
