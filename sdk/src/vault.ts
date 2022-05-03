import * as anchor from "@project-serum/anchor";
import { Program, Provider, Idl, Wallet, BN } from "@project-serum/anchor";
import { StableSwap, SWAP_PROGRAM_ID } from "@saberhq/stableswap-sdk";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  u64,
} from "@solana/spl-token";
import {
  AccountMeta,
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
import { PriceClient } from "./common/price";
import { PdaDerivationResult, SignerInfo, PoolConfig } from "./common/types";
import {
  getSignersFromPayer,
  flattenValidInstructions,
  getCurrentTimestamp,
} from "./common/util";
import { Vault } from "./types/vault";

const MAX_BPS = 10_000;
const U64_ZERO = new u64(0);
const U64_ONE = new u64(1);

export interface ProcessClaimsResult {
  claimsProcessed: boolean;
  tx: string;
}

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

export interface Asset {
  mint: PublicKey;
  lp: PublicKey;
  assetCap?: u64;
  userCap?: u64;
  deposits: u64;
  deposited: u64;
  invested: u64;
  excess: u64;
  received: u64;
}

export enum State {
  Inactive,
  Deposit,
  Live,
  Redeem,
  Withdraw,
}

export interface IVault {
  bump: number;
  authority: PublicKey;
  alpha: Asset;
  beta: Asset;
  strategy: PublicKey;
  strategist: PublicKey;
  fixedRate: number;
  state: State;
  startAt: u64;
  investAt: u64;
  redeemAt: u64;

  // related to claims
  excess?: PublicKey;
  claimsProcessed: boolean;
  claimsIdx?: u64;
}

export const toIVault = (vault: any): IVault => vault as IVault;

/**
 * note: we forgo passing in depositor's ATAs here because it's presumed they
 * already have these tokens. otherwise, they will not be able to deposit.
 *
 * todo: write an Asset wrapper
 */
export class VaultClient extends AccountUtils {
  wallet: Wallet;
  provider!: Provider;
  vaultProgram!: Program<Vault>;

  // providers
  saberProvider!: SaberRegistryProvider;
  priceClient!: PriceClient;

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
    this.priceClient = new PriceClient();
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

  generateHistoryAddress = async (
    vault: PublicKey,
    mint: PublicKey,
    payer: PublicKey,
    programID: PublicKey = this.vaultProgram.programId
  ): Promise<PdaDerivationResult> => {
    const [addr, bump] = await this.findProgramAddress(programID, [
      "history",
      vault,
      mint,
      payer,
    ]);

    return {
      addr,
      bump,
    } as PdaDerivationResult;
  };

  generateReceiptAddress = async (
    vault: PublicKey,
    mint: PublicKey,
    depositIndex: BN,
    programID: PublicKey = this.vaultProgram.programId
  ): Promise<PdaDerivationResult> => {
    const [addr, bump] = await this.findProgramAddress(programID, [
      "receipt",
      vault,
      mint,
      depositIndex.toBuffer("le", 8),
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

  fetchReceipt = async (addr: PublicKey) => {
    return this.vaultProgram.account.receipt.fetch(addr);
  };

  fetchHistory = async (addr: PublicKey) => {
    return this.vaultProgram.account.history.fetch(addr);
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

  getAsset = (vault: IVault, mint: PublicKey): Asset => {
    if (mint.toBase58() === vault.alpha.mint.toBase58()) {
      return vault.alpha;
    } else if (mint.toBase58() === vault.beta.mint.toBase58()) {
      return vault.beta;
    } else {
      throw new Error("Invalid pubkey");
    }
  };

  calculateExchangeRate = async (vault: PublicKey, mint: PublicKey) => {
    // amount in vault / lp supply
    const _vault = await this.fetchVault(vault);
    const _asset = this.getAsset(toIVault(_vault), mint);

    const lpSupply = (await this.fetchTokenSupply(_asset.lp)).supply;
    const balance = await this.fetchTokenBalance(_asset.mint, vault);

    console.log("balance: ", balance);
    console.log("lpSupply: ", lpSupply);

    return balance / lpSupply;
  };

  // fetch history accounts for a vault for a user, aka has a user made a deposit
  // in a specific vault?

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

    // todo: does this work?
    const _asset = await this.getAsset(toIVault(_vault), mint);
    console.log("_asset: ", _asset);

    // current number of deposits + 1, for next deposit in sequence
    const index = new u64(_asset.deposits.toNumber() + 1);
    console.log("index: ", index.toNumber());

    const { addr: receipt, bump: receiptBump } =
      await this.generateReceiptAddress(vault, mint, index);
    const { addr: history, bump: historyBump } =
      await this.generateHistoryAddress(vault, mint, signerInfo.payer);

    console.log("history: ", history.toBase58());
    console.log(historyBump);
    console.log("receipt: ", receipt);
    console.log(receiptBump);
    console.log(amount);
    console.log("current: ", getCurrentTimestamp());
    console.log("start: ", _vault.startAt.toNumber());
    console.log("invest: ", _vault.investAt.toNumber());

    return this.vaultProgram.rpc.deposit(
      index,
      receiptBump,
      historyBump,
      amount,
      {
        accounts: {
          payer: signerInfo.payer,
          authority: _vault.authority,
          vault,
          receipt,
          history,
          mint,
          sourceAta: sourceTokenAccount.address,
          destinationAta: destinationTokenAccount.address,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          ataProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          rent: SYSVAR_RENT_PUBKEY,
        },
        preInstructions: flattenValidInstructions([
          // sourceTokenAccount,
          destinationTokenAccount,
        ]),
        signers: signerInfo.signers,
      }
    );
  };

  claim = async (
    vault: PublicKey,
    mint: PublicKey,
    payer: PublicKey | Keypair
  ) => {
    const signerInfo: SignerInfo = getSignersFromPayer(payer);
    const _vault = await this.fetchVault(vault);
    const _asset = this.getAsset(toIVault(_vault), mint);
    const _assetLp = _asset.lp;

    const sourceAssetAta = await this.getOrCreateATA(
      mint,
      vault,
      signerInfo.payer,
      this.provider.connection
    );

    const destinationAssetAta = await this.getOrCreateATA(
      mint,
      signerInfo.payer,
      signerInfo.payer,
      this.provider.connection
    );

    const destinationLpTokenAccount = await this.getOrCreateATA(
      _assetLp,
      signerInfo.payer,
      signerInfo.payer,
      this.provider.connection
    );

    const { addr: history } = await this.generateHistoryAddress(
      vault,
      mint,
      signerInfo.payer
    );

    return this.vaultProgram.rpc.claim({
      accounts: {
        payer: signerInfo.payer,
        authority: _vault.authority,
        vault,
        history,
        mint,
        lp: _assetLp,
        sourceAta: sourceAssetAta.address,
        destinationAta: destinationAssetAta.address,
        destinationLpAta: destinationLpTokenAccount.address,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        ataProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        rent: SYSVAR_RENT_PUBKEY,
      },
      preInstructions: flattenValidInstructions([
        destinationAssetAta,
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
    payer: PublicKey | Keypair,
    cluster: Cluster = DEVNET
  ) => {
    const signerInfo: SignerInfo = getSignersFromPayer(payer);
    const _vault = await this.fetchVault(vault);
    console.log("_vault: ", _vault);

    // const b = _vault.beta;

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

    if (!poolConfig.investConfig) {
      throw new Error(
        "Deposit config must be defined for deposit operations at the moment"
      );
    }

    const _investableA = new u64(poolConfig.investConfig.tokenAmountA);
    const _investableB = new u64(poolConfig.investConfig.tokenAmountB);
    const _minAmountBack = new u64(poolConfig.investConfig.minMintAmount);

    console.log("_investableA: ", _investableA.toNumber());
    console.log("_investableB: ", _investableB.toNumber());
    console.log("_minAmountBack: ", _minAmountBack.toNumber());

    return this.vaultProgram.rpc.invest(
      _investableA,
      _investableB,
      _minAmountBack,
      {
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
      }
    );
  };

  toAccountMeta = (receipt: PublicKey, history: PublicKey) => {
    return [receipt, history].map(
      (acc, idx): AccountMeta => ({
        pubkey: acc,
        isSigner: false,
        // history (idx 1) should be writable
        isWritable: idx % 2 === 0 ? false : true,
      })
    );
  };

  getAccountsForClaim = async (
    vaultAddress: PublicKey,
    vault: IVault,
    count: number = 10
  ): Promise<AccountMeta[]> => {
    if (!vault.excess)
      throw new Error(
        "No excess mint defined. Can only process claims after vault funds are invested."
      );

    const excessMint = vault.excess;
    const remainingAccounts: AccountMeta[] = [];
    if (vault.claimsProcessed) return remainingAccounts;

    const _asset = this.getAsset(vault, excessMint);
    let _claimsIndex = new u64(
      vault.claimsIdx ? vault.claimsIdx : _asset.deposits
    );

    for (let i = 0; i < count; i++) {
      const { addr: receipt } = await this.generateReceiptAddress(
        vaultAddress,
        excessMint,
        _claimsIndex
      );

      const _receipt = await this.fetchReceipt(receipt);

      const { addr: history } = await this.generateHistoryAddress(
        vaultAddress,
        excessMint,
        _receipt.depositor
      );

      remainingAccounts.push(...this.toAccountMeta(receipt, history));

      // decrement claims index
      _claimsIndex = _claimsIndex.sub(U64_ONE);
    }

    return remainingAccounts;
  };

  /**
   * Process claims on both side of the vault. Still a lot of outstanding work to make sure this API
   * is redundant and can handle transaction timeouts, failures, etc.
   *
   * @param vault
   * @param payer
   */
  processClaims = async (
    vault: PublicKey,
    payer: PublicKey | Keypair
  ): Promise<ProcessClaimsResult> => {
    const signerInfo: SignerInfo = getSignersFromPayer(payer);
    const _vault = await this.fetchVault(vault);

    const remainingAccounts = await this.getAccountsForClaim(
      vault,
      toIVault(_vault)
    );

    const tx = await this.vaultProgram.rpc.processClaims({
      accounts: {
        payer: signerInfo.payer,
        authority: _vault.authority,
        vault,
      },
      remainingAccounts,
      signers: signerInfo.signers,
    });

    return {
      claimsProcessed: (await this.fetchVault(vault)).claimsProcessed,
      tx,
    };
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
