import * as anchor from "@project-serum/anchor";
import { Program, Provider, Idl, Wallet, BN } from "@project-serum/anchor";
import { StableSwap, SWAP_PROGRAM_ID } from "@saberhq/stableswap-sdk";
import {
  AccountLayout,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  Token,
  TOKEN_PROGRAM_ID,
  u64,
} from "@solana/spl-token";
import {
  AccountInfo,
  AccountMeta,
  Cluster,
  Commitment,
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  TransactionInstruction,
} from "@solana/web3.js";

import {
  Aquafarm,
  fetchGlobalFarms,
  fetchUserFarms,
  getUserFarmAddress,
} from "@orca-so/aquafarm";

import { SaberRegistryProvider } from "saber-swap-registry-provider";

import { AccountUtils } from "./common/account-utils";
import {
  DEVNET,
  MAX_BPS,
  ONE_U64,
  ZERO_U64,
  SOL_KEY_STR,
  ZERO_ORCA_U64,
} from "./common/constant";
import { PriceClient } from "./common/price";
import {
  PdaDerivationResult,
  SignerInfo,
  PoolConfig,
  TokenSupply,
  IAsset,
  IVault,
  VaultConfig,
  ProcessClaimsResult,
  Strategy,
  StrategyType,
  CompositeATAResult,
} from "./common/types";
import {
  getSignersFromPayer,
  flattenValidInstructions,
  toIVault,
} from "./common/util";
import { Vault } from "./types/vault";
import { getOrCreateATA } from "./common";
import Decimal from "decimal.js";

import {
  getTokens,
  OrcaPool,
  OrcaPoolToken,
  U64Utils,
  OrcaFarmConfig as ORCA_FARM_CONFIG,
  OrcaPoolConfig as ORCA_POOL_CONFIG,
  OrcaU64,
  getOrca,
  Network,
} from "@orca-so/sdk";
import { OrcaFarmParams } from "@orca-so/sdk/dist/model/orca/farm/farm-types";
import { OrcaPoolParams } from "@orca-so/sdk/dist/model/orca/pool/pool-types";
import { Orca } from "@orca-so/sdk/dist/public/main/types";

export const fixedRateToDecimal = (n: number) => n / 10_000;

export const descaleToOrcaU64 = (amount: number, token: OrcaPoolToken) => {
  const scale = token.scale;
  return new OrcaU64(new u64(amount / 10 ** scale), scale);
};

export const scaleToOrcaU64 = (amount: number, token: OrcaPoolToken) => {
  const scale = token.scale;
  return new OrcaU64(new u64(amount * 10 ** scale), scale);
};

export const toOrcaU64 = (amount: number, token: OrcaPoolToken) => {
  const scale = token.scale;
  return new OrcaU64(new u64(amount), scale);
};

export interface SwapConfig {
  maxIn: u64;
  maxOut: u64;
  alphaToBeta: boolean;
}

// todo: toVaultMeta, toOrcaPool
export const computeSwapForVault = async (
  pool: OrcaPool,
  vault: IVault,
  orcaInvestment: OrcaInvestment
): Promise<SwapConfig | null> => {
  const trancheTokens = getTrancheAsOrcaTokens(vault, pool);

  const redeemableAlpha =
    orcaInvestment.a.token.mint.toBase58() === vault.alpha.mint.toBase58()
      ? orcaInvestment.a.amountOrcaU64
      : orcaInvestment.b.amountOrcaU64;
  const _redeemableAlpha = redeemableAlpha ? redeemableAlpha.toNumber() : 0;
  console.log("_redeemableAlpha: ", _redeemableAlpha);

  const redeemableBeta =
    orcaInvestment.a.token.mint.toBase58() === vault.beta.mint.toBase58()
      ? orcaInvestment.a.amountOrcaU64
      : orcaInvestment.b.amountOrcaU64;
  const _redeemableBeta = redeemableBeta ? redeemableBeta.toNumber() : 0;
  console.log("_redeemableBeta: ", _redeemableBeta);

  if (_redeemableAlpha === 0 && _redeemableBeta === 0) {
    console.log("Both redeemable values cannot be 0");
    return null;
  }

  const fixedRateDecimal = fixedRateToDecimal(vault.fixedRate);
  // form => amount * 10 ** decimals
  const requiredAlpha =
    vault.alpha.invested.toNumber() * (1 + fixedRateDecimal);

  if (_redeemableAlpha < requiredAlpha) {
    // swap beta for alpha; we need to make alpha tranche whole since it's senior
    // we can use swapAmount input/output ratio to back into approximate input for output
    // including slippage and fees. aka how much of beta we need to convert to alpha.
    // otherwise, we could reverse engineer the getQuote function, but this might be just
    // as effective?
    const remainingA = requiredAlpha - _redeemableAlpha;
    const scaledRemainingA = descaleToOrcaU64(remainingA, trancheTokens.alpha);

    const swapRatio = await getSwapRatio(
      pool,
      trancheTokens.alpha,
      scaledRemainingA
    );

    // either some subset of beta, or all of it if there's not enough
    const amountInputBeta = Math.min(swapRatio * remainingA, _redeemableBeta);

    const swapEstimates = await getAmountsForSwap(
      pool,
      trancheTokens.beta,
      scaleToOrcaU64(amountInputBeta, trancheTokens.beta)
    );

    return {
      maxIn: U64Utils.toTokenU64(
        swapEstimates.input,
        trancheTokens.beta,
        "inputAmount"
      ),
      maxOut: U64Utils.toTokenU64(
        swapEstimates.output,
        trancheTokens.alpha,
        "outputAmount"
      ),
      alphaToBeta: false,
    };
  } else if (_redeemableAlpha > requiredAlpha) {
    // swap alpha for beta
    const residualA = _redeemableAlpha - requiredAlpha;
    const swapEstimates = await getAmountsForSwap(
      pool,
      trancheTokens.alpha,
      scaleToOrcaU64(residualA, trancheTokens.alpha)
    );

    return {
      maxIn: U64Utils.toTokenU64(
        swapEstimates.input,
        trancheTokens.alpha,
        "inputAmount"
      ),
      maxOut: U64Utils.toTokenU64(
        swapEstimates.output,
        trancheTokens.beta,
        "outputAmount"
      ),
      alphaToBeta: true,
    };
  } else {
    // do nothing
    return null;
  }
};

export const getSwapRatio = async (
  pool: OrcaPool,
  inputToken: OrcaPoolToken,
  inputAmount: OrcaU64
): Promise<number> => {
  const amountForSwap = await getAmountsForSwap(pool, inputToken, inputAmount);
  return amountForSwap.input.toNumber() / amountForSwap.output.toNumber();
};

export const getAmountsForSwap = async (
  pool: OrcaPool,
  inputToken: OrcaPoolToken,
  inputAmount: OrcaU64
) => {
  const quote = await pool.getQuote(inputToken, inputAmount);
  const outputAmount = quote.getMinOutputAmount();

  return {
    // todo: ensure input is decimal?
    input: inputAmount.toDecimal(),
    output: outputAmount.toDecimal(),
  };
};

export interface TrancheAsOrcaTokens {
  alpha: OrcaPoolToken;
  beta: OrcaPoolToken;
}

// align vault tranches with orca pool tokens
export const getTrancheAsOrcaTokens = (vault: IVault, pool: OrcaPool) => {
  const _tokenA = pool.getTokenA();
  const _tokenB = pool.getTokenB();

  const _alpha =
    vault.alpha.mint.toBase58() === _tokenA.mint.toBase58() ? _tokenA : _tokenB;

  const _beta =
    vault.beta.mint.toBase58() === _tokenA.mint.toBase58() ? _tokenA : _tokenB;

  return {
    alpha: _alpha,
    beta: _beta,
  } as TrancheAsOrcaTokens;
};

export interface SwapAccounts {
  mint: PublicKey;
  source: PublicKey;
  dest: PublicKey;
}

export interface OrcaSwapConfig {
  input: SwapAccounts;
  output: SwapAccounts;
  instructions: InstructionData;
}

export const getSwapConfig = async (
  input: OrcaPoolToken,
  inputAmount: u64,
  output: OrcaPoolToken,
  owner: PublicKey,
  payer: PublicKey,
  connection: Connection
): Promise<OrcaSwapConfig> => {
  // seed account with lamports if SOL & input token
  const sourceAta = await resolveAtaForDeposit(
    input.mint,
    owner, // vault
    payer,
    connection,
    inputAmount.toNumber()
  );

  const destAta = await resolveAtaForDeposit(
    output.mint,
    owner,
    payer,
    connection
  );

  const instructionData: InstructionData = {
    instructions: [...sourceAta.instructions, ...destAta.instructions],
    cleanup: [...sourceAta.cleanup, ...destAta.cleanup],
    signers: [...sourceAta.signers, ...destAta.signers],
  };

  return {
    input: {
      mint: input.mint,
      source: sourceAta.address,
      dest: input.addr,
    },
    output: {
      mint: output.mint,
      source: destAta.address,
      dest: output.addr,
    },
    instructions: instructionData,
  } as OrcaSwapConfig;
};

export interface InstructionData {
  instructions: TransactionInstruction[];
  cleanup: TransactionInstruction[];
  signers: Keypair[];
}

export const initInstructionData = (): InstructionData => {
  return {
    instructions: [],
    cleanup: [],
    signers: [],
  };
};

export interface OrcaFarmConfig {
  owner: PublicKey;
  farm: Aquafarm;
  userFarm: PublicKey; // userFarmPublicKey
  needsInitialization: boolean;
  userBaseAta: PublicKey; // userBase.address, // base LP ATA
  userFarmAta: PublicKey; // userFarm.address, // farm LP ATA
  userRewardAta: PublicKey; // userReward.address,
  instructions: InstructionData;
}

// wSOL will only ever be from user, not vault
export const createWSOLAccountInstructions = (
  owner: PublicKey,
  solMint: PublicKey,
  amountIn: number,
  rentExemptLamports: number
) => {
  const tempAccount = new Keypair();

  // https://github.com/solana-labs/solana-web3.js/blob/ca79fc8/src/system-program.ts#L748
  const createAccountInstruction = SystemProgram.createAccount({
    fromPubkey: owner, // signer
    newAccountPubkey: tempAccount.publicKey, // signer
    lamports: amountIn + rentExemptLamports,
    space: AccountLayout.span,
    programId: TOKEN_PROGRAM_ID,
  });

  // https://github.com/solana-labs/solana-program-library/blob/851efed46783ae655c3ebb42f46aaa0f37cddd45/token/js/client/token.js#L1473
  const initAccountInstruction = Token.createInitAccountInstruction(
    TOKEN_PROGRAM_ID,
    solMint,
    tempAccount.publicKey,
    owner
  );

  // owner has to be a signer if no multisig
  // https://github.com/solana-labs/solana-program-library/blob/851efed46783ae655c3ebb42f46aaa0f37cddd45/token/js/client/token.js#L1850
  const closeWSOLAccountInstruction = Token.createCloseAccountInstruction(
    TOKEN_PROGRAM_ID,
    tempAccount.publicKey,
    owner,
    owner,
    []
  );

  return {
    address: tempAccount.publicKey,
    instructions: [createAccountInstruction, initAccountInstruction],
    cleanupInstructions: [closeWSOLAccountInstruction],
    signers: [tempAccount],
  };
};

export const resolveAtaForDeposit = async (
  mint: PublicKey,
  owner: PublicKey,
  payer: PublicKey,
  connection: Connection,
  initialLamports: number = 0 // seed with no extra lamports by default
): Promise<CompositeATAResult> => {
  const ownerAccountInfo = await connection.getAccountInfo(owner);
  // if mint is sol and owning program is system program; we will create normal ATAs for
  // PDA
  if (
    mint.toBase58() === SOL_KEY_STR &&
    ownerAccountInfo?.owner.toBase58() === SystemProgram.programId.toBase58()
  ) {
    console.log(
      `creating wraapped SOL for owner [${owner.toBase58()}] and mint [${mint.toBase58()}]`
    );
    const accountRentExempt =
      await connection.getMinimumBalanceForRentExemption(AccountLayout.span);
    const result = createWSOLAccountInstructions(
      payer,
      mint,
      initialLamports,
      accountRentExempt
    );

    return {
      address: result.address,
      instructions: result.instructions,
      cleanup: result.cleanupInstructions,
      signers: result.signers,
    } as CompositeATAResult;
  } else {
    console.log(
      `normal ATA for owner [${owner.toBase58()}] and mint [${mint.toBase58()}]`
    );
    const result = await getOrCreateATA(mint, owner, payer, connection);

    return {
      address: result.address,
      instructions: result.instructions,
      cleanup: [],
      signers: [],
    };
  }
};

// ==========================================
// farm stuff
// aquafarm sdk: https://github.com/orca-so/typescript-sdk/blob/e04a5c4742500e1b9988207226d58184617ed45c/src/model/orca/farm/orca-farm.ts#L60
// todo: in future, maybe take token pair and find pool info?
// ==========================================
export const getFarmData = async (
  farmOwner: PublicKey,
  aquafarmProgram: PublicKey,
  farmParams: OrcaFarmParams,
  payer: PublicKey,
  connection: Connection
): Promise<OrcaFarmConfig> => {
  const { address: farmAddress, rewardTokenMint } = farmParams;
  const userFarmPublicKey = (
    await getUserFarmAddress(
      farmAddress,
      farmOwner,
      TOKEN_PROGRAM_ID,
      aquafarmProgram
    )
  )[0];

  const globalFarms = await fetchGlobalFarms(
    connection,
    [farmAddress],
    aquafarmProgram
  );
  const userFarms = await fetchUserFarms(
    connection,
    farmOwner,
    [farmAddress],
    aquafarmProgram
  );

  if (!globalFarms) {
    throw new Error("Failed to get globalFarms information");
  }
  const _farm = new Aquafarm(
    globalFarms[0],
    aquafarmProgram,
    userFarms && userFarms[0]
  );

  // If the user lacks the farm token account, create it
  const userFarm = await resolveAtaForDeposit(
    _farm.globalFarm.farmTokenMint,
    farmOwner,
    payer,
    connection
  );

  // If the user lacks the reward token account, create it
  const userReward = await resolveAtaForDeposit(
    rewardTokenMint,
    farmOwner,
    payer,
    connection
  );

  // If the user lacks the base token account, create it
  const userBase = await resolveAtaForDeposit(
    farmParams.baseTokenMint,
    farmOwner,
    payer,
    connection
  );

  console.log(
    "_farm.globalFarm.baseTokenVault: ",
    _farm.globalFarm.baseTokenVault.toBase58()
  );
  console.log(
    "_farm.globalFarm.baseTokenVault: ",
    _farm.globalFarm.baseTokenVault.toBase58()
  );
  console.log(
    "_farm.globalFarm.farmTokenMint: ",
    _farm.globalFarm.farmTokenMint.toBase58()
  );
  console.log(
    "_farm.globalFarm.publicKey: ",
    _farm.globalFarm.publicKey.toBase58()
  );
  console.log(
    "_farm.globalFarm.authority: ",
    _farm.globalFarm.authority.toBase58()
  );
  console.log("shouldInitializeFarm: ", !_farm.isUserFarmInitialized());

  const instructionData: InstructionData = {
    instructions: [
      ...userBase.instructions,
      ...userFarm.instructions,
      ...userReward.instructions,
    ],
    cleanup: [...userBase.cleanup, ...userFarm.cleanup, ...userReward.cleanup],
    signers: [...userBase.signers, ...userFarm.signers, ...userReward.signers],
  };

  return {
    owner: farmOwner,
    farm: _farm,
    userFarm: userFarmPublicKey,
    needsInitialization: !_farm.isUserFarmInitialized(),
    userBaseAta: userBase.address, // base LP
    userFarmAta: userFarm.address, // farm LP
    userRewardAta: userReward.address,
    instructions: instructionData,
  } as OrcaFarmConfig;
};

/**
 * Scan array to see if there is more than 1 non-zero value
 *
 * @param arr
 * @returns boolean representing only 1 non-zero u8 value
 */
export const verifyBitArr = (arr: Uint8Array): boolean => {
  return (
    arr.reduce((prev, curr) => {
      if (curr > 0) return prev + 1;
      return prev;
    }, 0) === 1
  );
};

/**
 * Typescript counter-part to Rust's u64::from_le_bytes()
 *
 * @param arr
 * @returns number from its u8 parts.
 */
export const arrToU64 = (arr: Uint8Array) =>
  arr.reduce((prev, curr, i) => {
    return prev | (curr * (1 << (8 * i)));
  }, 0);

/**
 * note: we forgo passing in depositor's ATAs here because it's presumed they
 * already have these tokens. otherwise, they will not be able to deposit.
 *
 * todo: write an IAsset wrapper
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

  generateGlobalStateAddress = async (
    programID: PublicKey = this.vaultProgram.programId
  ): Promise<PdaDerivationResult> => {
    const [addr, bump] = await this.findProgramAddress(programID, [
      "globalstate",
    ]);

    return {
      addr,
      bump,
    } as PdaDerivationResult;
  };

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

  generateVaultFarmAddress = async (
    vault: PublicKey,
    programID: PublicKey = this.vaultProgram.programId
  ): Promise<PdaDerivationResult> => {
    const [addr, bump] = await this.findProgramAddress(programID, [
      "farmvault",
      vault,
    ]);

    return {
      addr,
      bump,
    } as PdaDerivationResult;
  };

  // todo: refactor strategy stuff later
  generateSaberStrategyAddress = async (
    tokenA: PublicKey,
    tokenB: PublicKey,
    swap: PublicKey,
    lp: PublicKey,
    programID: PublicKey = this.vaultProgram.programId
  ): Promise<PdaDerivationResult> => {
    // flag is 1 // version is 0 for now
    // todo: refactor later
    const flag = new BN(1);
    const version = new BN(0);

    // console.log(tokenA);
    // console.log(tokenB);
    // console.log(swap);
    // console.log(lp);

    const [addr, bump] = await this.findProgramAddress(programID, [
      "strategy",
      flag.toBuffer("le", 8),
      version.toBuffer("le", 2),
      tokenA,
      tokenB,
      swap,
      lp,
    ]);

    return {
      addr,
      bump,
    } as PdaDerivationResult;
  };

  // todo: refactor strategy stuff later
  generateOrcaStrategyAddress = async (
    tokenA: PublicKey,
    tokenB: PublicKey,
    pool: PublicKey,
    lp: PublicKey,
    farm: PublicKey,
    farm_lp: PublicKey,
    programID: PublicKey = this.vaultProgram.programId
  ): Promise<PdaDerivationResult> => {
    const flag = new BN(2);
    const version = new BN(0);

    const [addr, bump] = await this.findProgramAddress(programID, [
      "strategy",
      flag.toBuffer("le", 8),
      version.toBuffer("le", 2),
      tokenA,
      tokenB,
      pool,
      lp,
      farm,
      farm_lp,
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
    depositIndex: u64,
    programID: PublicKey = this.vaultProgram.programId
  ): Promise<PdaDerivationResult> => {
    const _depositIndexBytes = new BN(depositIndex.toNumber()).toBuffer(
      "le",
      8
    );

    const [addr, bump] = await this.findProgramAddress(programID, [
      "receipt",
      vault,
      mint,
      _depositIndexBytes,
    ]);

    return {
      addr,
      bump,
    } as PdaDerivationResult;
  };

  // ================================================
  // Fetch & deserialize objects
  // ================================================

  getAccountInfo = async (
    addr: PublicKey,
    commitment?: Commitment
  ): Promise<AccountInfo<Buffer> | null> => {
    return await this.conn.getAccountInfo(addr, commitment);
  };

  // todo: export this to its own class?
  classifyStrategy = async (
    addr: PublicKey,
    commitment?: Commitment
  ): Promise<Strategy> => {
    const accountInfo = await this.getAccountInfo(addr, commitment);
    if (accountInfo === null)
      throw new Error(`No account info found for ${addr.toBase58()}`);

    const flagsOffset = 8; // ignore discriminator
    const flagsLength = 8; // u64
    const flags = accountInfo.data.filter(
      (_, i) => i >= flagsOffset && i < flagsOffset + flagsLength
    );

    if (!verifyBitArr(flags))
      throw new Error(`Invalid strategy acount data: ${flags}`);

    const n = arrToU64(flags);
    const val: StrategyType = Strategy[n] as StrategyType;
    if (val === undefined) throw new Error(`No strategy found for ${n}`);

    return Strategy[val];
  };

  // todo: how will we know how to decode this?
  // add return types => string, and general obj?
  fetchStrategy = async (addr: PublicKey, commitment?: Commitment) => {
    const strategy = await this.classifyStrategy(addr, commitment);

    switch (strategy) {
      case Strategy.SaberLpStrategyV0:
        // return {
        //   name: SABER_LP_STRATEGY,
        //   protocol: Protocol.Saber,
        //   version: 0,
        //   data: this.fetchSaberLpStrategyV0(addr),
        // };
        return this.fetchSaberLpStrategyV0(addr);
      default:
        throw new Error(`Unknown strategy: ${strategy}`);
    }
  };

  fetchGlobalState = async (addr: PublicKey) => {
    return this.vaultProgram.account.globalProtocolState.fetch(addr);
  };

  fetchSaberLpStrategyV0 = async (addr: PublicKey) => {
    return this.vaultProgram.account.saberStrategyDataV0.fetch(addr);
  };

  fetchVault = async (addr: PublicKey) => {
    return this.vaultProgram.account.vault.fetch(addr);
  };

  fetchVaults = async () => {
    return this.vaultProgram.account.vault.all();
  };

  fetchReceipt = async (addr: PublicKey) => {
    return this.vaultProgram.account.receipt.fetch(addr);
  };

  fetchReceiptWithSeeds = async (
    vault: PublicKey,
    mint: PublicKey,
    depositIndex: u64
  ) => {
    return this.fetchReceipt(
      (await this.generateReceiptAddress(vault, mint, depositIndex)).addr
    );
  };

  fetchHistory = async (addr: PublicKey) => {
    return this.vaultProgram.account.history.fetch(addr);
  };

  fetchHistoryWithSeeds = async (
    vault: PublicKey,
    mint: PublicKey,
    payer: PublicKey
  ) => {
    return this.fetchHistory(
      (await this.generateHistoryAddress(vault, mint, payer)).addr
    );
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
    if (mint.toBase58() === SOL_KEY_STR) {
      return {
        supply: 0,
        decimals: 9,
      };
    }

    const supply = await this.conn.getTokenSupply(mint);
    return {
      supply: +supply["value"]["amount"],
      decimals: +supply["value"]["decimals"],
    };
  };

  getAsset = (vault: IVault, mint: PublicKey): IAsset => {
    if (mint.toBase58() === vault.alpha.mint.toBase58()) {
      return vault.alpha;
    } else if (mint.toBase58() === vault.beta.mint.toBase58()) {
      return vault.beta;
    } else {
      throw new Error("Invalid pubkey");
    }
  };

  // fetch history accounts for a vault for a user, aka has a user made a deposit
  // in a specific vault?

  // ================================================
  // Smart contract function helpers
  // ================================================

  /**
   * PDA init can only be called once per deployed program. Signer will be global authority.
   *
   * @param payer
   * @returns {
   *    tx: transaction_hash,
   *    addr: PDA address
   * }
   */
  initializeGlobalProtocolState = async (
    treasury: PublicKey,
    payer: PublicKey | Keypair,
    executeTransaction: boolean = true
  ) => {
    const signerInfo: SignerInfo = getSignersFromPayer(payer);
    const { addr, bump } = await this.generateGlobalStateAddress();

    if (executeTransaction) {
      const tx = await this.vaultProgram.rpc.initializeGlobalProtocolState(
        bump,
        {
          accounts: {
            authority: signerInfo.payer,
            globalProtocolState: addr,
            treasury,
            systemProgram: SystemProgram.programId,
            rent: SYSVAR_RENT_PUBKEY,
          },
          signers: signerInfo.signers,
        }
      );

      return {
        tx,
        addr,
      };
    }
    return { tx: "nan", addr: Keypair.generate().publicKey };
  };

  initializeSaberStrategy = async (
    tokenA: PublicKey,
    tokenB: PublicKey,
    swap: PublicKey,
    lp: PublicKey,
    payer: PublicKey | Keypair,
    executeTransaction: boolean = true
  ) => {
    const signerInfo: SignerInfo = getSignersFromPayer(payer);
    const { addr: globalStateAddr } = await this.generateGlobalStateAddress();
    const { addr: strategyAddr, bump } =
      await this.generateSaberStrategyAddress(tokenA, tokenB, swap, lp);

    console.log("tokenA: ", tokenA.toBase58());
    console.log("tokenB: ", tokenB.toBase58());
    console.log("swap: ", swap.toBase58());
    console.log("lp: ", lp.toBase58());

    console.log("strategyAddr: ", strategyAddr.toBase58());
    console.log("globalStateAddr: ", globalStateAddr.toBase58());
    console.log("payer: ", signerInfo.payer.toBase58());

    // flag is 1 // version is 0 for now
    // todo: refactor later
    const flag = new BN(1);
    const version = 0;

    if (executeTransaction) {
      const tx = await this.vaultProgram.rpc.initializeSaber(
        bump,
        flag,
        version,
        {
          accounts: {
            authority: signerInfo.payer,
            globalProtocolState: globalStateAddr,
            strategy: strategyAddr,
            tokenA,
            tokenB,
            basePool: swap,
            poolLp: lp,
            systemProgram: SystemProgram.programId,
            rent: SYSVAR_RENT_PUBKEY,
          },
          signers: signerInfo.signers,
        }
      );

      return {
        tx,
        strategy: strategyAddr,
      };
    }

    return { tx: "nan", strategy: Keypair.generate().publicKey };
  };

  // todo: doesn't have to correspond w sides of the vualt right?
  initializeOrcaStrategy = async (
    swapProgram: PublicKey,
    farmProgram: PublicKey,
    pair: string,
    payer: PublicKey | Keypair,
    executeTransaction: boolean = true,
    cluster: Cluster = DEVNET
  ) => {
    const signerInfo: SignerInfo = getSignersFromPayer(payer);
    const { addr: globalStateAddr } = await this.generateGlobalStateAddress();

    const orca = getOrca(this.provider.connection, clusterToNetwork(cluster));
    const { pool, poolParams } = getOrcaPool(orca, pair);
    const _tokenA = pool.getTokenA();
    const _tokenB = pool.getTokenB();
    const _poolTokenMint = pool.getPoolTokenMint();
    const aquafarmParams = getAquafarm(orca, pair);
    const doubleDipFarmParams = getDoubleDipFarm(orca, pair);
    const doubleDipFarmLp =
      doubleDipFarmParams !== null
        ? doubleDipFarmParams.farmTokenMint
        : PublicKey.default;
    console.log("doubleDipFarmLp: ", doubleDipFarmLp.toBase58());

    const { addr: strategyAddr, bump } = await this.generateOrcaStrategyAddress(
      _tokenA.mint,
      _tokenB.mint,
      poolParams.address,
      _poolTokenMint,
      aquafarmParams.address,
      aquafarmParams.farmTokenMint
    );

    console.log("strategyAddr: ", strategyAddr.toBase58());
    console.log("globalStateAddr: ", globalStateAddr.toBase58());
    console.log("payer: ", signerInfo.payer.toBase58());

    // todo: refactor later
    // flag is 2 // version is 0 for now
    const flag = new BN(1 << 1); // 2
    const version = 0;

    if (executeTransaction) {
      const tx = await this.vaultProgram.rpc.initializeOrca(
        bump,
        flag,
        version,
        {
          accounts: {
            authority: signerInfo.payer,
            globalProtocolState: globalStateAddr,
            strategy: strategyAddr,
            swapProgram,
            farmProgram,
            tokenA: _tokenA,
            tokenB: _tokenB,
            pool: poolParams.address,
            baseLp: _poolTokenMint,
            farm: aquafarmParams.address,
            farmLp: aquafarmParams.farmTokenMint,
            doubleDipFarmLp,
            systemProgram: SystemProgram.programId,
            rent: SYSVAR_RENT_PUBKEY,
          },
          signers: signerInfo.signers,
        }
      );

      return {
        tx,
        strategy: strategyAddr,
      };
    }

    return { tx: "nan", strategy: Keypair.generate().publicKey };
  };

  // we init mints with the LP keypairs such that the mint and freeze authority is the vault. this means that the vault PDA will
  // be able to sign future mint (and possibly freeze instructions).
  initializeVault = async (
    vaultConfig: VaultConfig,
    payer: PublicKey | Keypair,
    executeTransaction: boolean = true
  ) => {
    const signerInfo: SignerInfo = getSignersFromPayer(payer);

    const { addr: globalStateAddr } = await this.generateGlobalStateAddress();
    const { addr: vault, bump } = await this.generateVaultAddress(
      signerInfo.payer
    );

    const alpha = vaultConfig.alpha.mint;
    const alphaDecimals = (await this.fetchTokenSupply(vaultConfig.alpha.mint))
      .decimals;
    const alphaLp = Keypair.generate();
    const vaultLpA = await resolveAtaForDeposit(
      alphaLp.publicKey,
      vault,
      signerInfo.payer,
      this.provider.connection
    );

    const beta = vaultConfig.beta.mint;
    const betaDecimals = (await this.fetchTokenSupply(vaultConfig.beta.mint))
      .decimals;
    const betaLp = Keypair.generate();
    const vaultLpB = await resolveAtaForDeposit(
      betaLp.publicKey,
      vault,
      signerInfo.payer,
      this.provider.connection
    );

    console.log("alpha: ", alpha.toBase58());
    console.log("alha lp: ", alphaLp.publicKey.toBase58());
    console.log("beta: ", beta.toBase58());
    console.log("beta lp: ", betaLp.publicKey.toBase58());

    if (executeTransaction) {
      // `indefinite span` transaction error can happen when using `undefined` instead of `null` for optional types.
      return this.vaultProgram.rpc.initializeVault(
        bump,
        {
          authority: vaultConfig.authority,
          strategy: vaultConfig.strategy,
          strategist: vaultConfig.strategist,
          alpha: {
            userCap: vaultConfig.alpha.userCap,
            assetCap: vaultConfig.alpha.assetCap,
          },
          beta: {
            userCap: vaultConfig.beta.userCap,
            assetCap: vaultConfig.beta.assetCap,
          },
          fixedRate: vaultConfig.fixedRate,
          startAt: vaultConfig.startAt,
          investAt: vaultConfig.investAt,
          redeemAt: vaultConfig.redeemAt,
        } as any,
        {
          accounts: {
            authority: signerInfo.payer,
            globalProtocolState: globalStateAddr,
            vault,
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
            ...vaultLpA.instructions,
            ...vaultLpB.instructions,
          ],
          signers: [alphaLp, betaLp, ...signerInfo.signers],
        }
      );
    }
    return "nan";
  };

  deposit = async (
    vault: PublicKey,
    mint: PublicKey,
    amount: u64,
    payer: PublicKey | Keypair,
    executeTransaction: boolean = true
  ) => {
    const signerInfo: SignerInfo = getSignersFromPayer(payer);
    const _vault = await this.fetchVault(vault);

    const { addr: globalStateAddr } = await this.generateGlobalStateAddress();
    console.log("globalStateAddr: ", globalStateAddr.toBase58());

    // seed account with lamports if SOL & input token
    const sourceTokenAccount = await resolveAtaForDeposit(
      mint,
      signerInfo.payer,
      signerInfo.payer,
      this.provider.connection,
      amount.toNumber()
    );
    console.log("sourceTokenAccount: ", sourceTokenAccount.address.toBase58());

    // @dev: don't close ATA at the end of the transaction
    const destinationTokenAccount = await resolveAtaForDeposit(
      mint,
      vault,
      signerInfo.payer,
      this.provider.connection
    );
    console.log(
      "destinationTokenAccount: ",
      destinationTokenAccount.address.toBase58()
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

    console.log("vault: ", vault.toBase58());
    console.log("receipt: ", receipt.toBase58(), ", bump: ", receiptBump);
    console.log("history: ", history.toBase58(), ", bump: ", historyBump);
    console.log("mint: ", mint.toBase58());
    console.log("globalStateAddr: ", globalStateAddr.toBase58());
    console.log("signerInfo.payer: ", signerInfo.payer.toBase58());

    if (executeTransaction) {
      // todo: wSOL account paradigm when mint is SOL; only for orca?
      return this.vaultProgram.rpc.deposit(
        index,
        receiptBump,
        historyBump,
        amount,
        {
          accounts: {
            payer: signerInfo.payer,
            authority: _vault.authority,
            globalProtocolState: globalStateAddr,
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
          preInstructions: [
            ...sourceTokenAccount.instructions,
            ...destinationTokenAccount.instructions,
          ],
          postInstructions: sourceTokenAccount.cleanup,
          signers: [
            ...signerInfo.signers,
            ...destinationTokenAccount.signers,
            ...sourceTokenAccount.signers,
          ],
        }
      );
    }
    return "nan";
  };

  claim = async (
    vault: PublicKey,
    mint: PublicKey,
    payer: PublicKey | Keypair,
    executeTransaction: boolean = true
  ) => {
    const signerInfo: SignerInfo = getSignersFromPayer(payer);

    const { addr: globalStateAddr } = await this.generateGlobalStateAddress();
    const _vault = await this.fetchVault(vault);
    const _asset = this.getAsset(toIVault(_vault), mint);
    const _assetLp = _asset.lp;

    // todo: does resolveAtaForDeposit work for all these?
    const sourceAssetAta = await resolveAtaForDeposit(
      mint,
      vault,
      signerInfo.payer,
      this.provider.connection
    );

    const destinationAssetAta = await resolveAtaForDeposit(
      mint,
      signerInfo.payer,
      signerInfo.payer,
      this.provider.connection
    );

    const destinationLpTokenAccount = await resolveAtaForDeposit(
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

    if (executeTransaction) {
      return this.vaultProgram.rpc.claim({
        accounts: {
          payer: signerInfo.payer,
          authority: _vault.authority,
          globalProtocolState: globalStateAddr,
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
    }
    return "nan";
  };

  investOrca = async (
    vault: PublicKey,
    orcaSwapProgram: PublicKey,
    pair: string,
    alpha: Decimal,
    beta: Decimal,
    payer: PublicKey | Keypair,
    executeTransaction: boolean = true,
    cluster: Cluster = DEVNET
  ) => {
    const signerInfo: SignerInfo = getSignersFromPayer(payer);
    const { addr: globalStateAddr } = await this.generateGlobalStateAddress();
    const _vault = await this.fetchVault(vault);
    console.log("_vault: ", _vault);

    const orca = getOrca(this.provider.connection, clusterToNetwork(cluster));
    const { pool, poolParams } = getOrcaPool(orca, pair);

    const orcaInvestment = await generatePoolConfigForVault(
      this,
      signerInfo.payer,
      vault,
      pool,
      poolParams,
      alpha,
      beta,
      true
    );

    const maxAmountA = !orcaInvestment.a.amountOrcaU64
      ? ZERO_U64
      : orcaInvestment.a.amountOrcaU64;
    const maxAmountB = !orcaInvestment.b.amountOrcaU64
      ? ZERO_U64
      : orcaInvestment.b.amountOrcaU64;

    console.log("==========================================");
    console.log("investing the following amounts...");
    console.log("a: ", maxAmountA.toNumber());
    console.log("b: ", maxAmountB.toNumber());
    console.log(
      "in exchange for lp: ",
      orcaInvestment.poolToken.amount.toNumber()
    );
    console.log("==========================================");

    const { instructions, cleanup, signers } = orcaInvestment.instructions;

    if (executeTransaction) {
      return this.vaultProgram.rpc.investOrca(
        maxAmountA,
        maxAmountB,
        orcaInvestment.poolToken.amount,
        {
          accounts: {
            payer: signerInfo.payer, // must be strategist
            authority: _vault.authority,
            globalProtocolState: globalStateAddr,
            vault,
            strategy: _vault.strategy,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            rent: SYSVAR_RENT_PUBKEY,
            // orca
            orcaSwapProgram,
            orcaPool: poolParams.address,
            orcaAuthority: poolParams.authority,
            sourceTokenA: orcaInvestment.a.source, // vault
            sourceTokenB: orcaInvestment.b.source, // vault
            intoA: orcaInvestment.a.dest,
            intoB: orcaInvestment.b.dest,
            poolToken: orcaInvestment.poolToken.mint,
            poolAccount: orcaInvestment.poolToken.source,
          },
          preInstructions: instructions,
          postInstructions: cleanup,
          signers: [...signerInfo.signers, ...signers],
        }
      );
    }

    return "NaN";
  };

  /**
   * todo: refactor to include a more extensible solution depending on vault strategy. will need to structure accounts differently.
   */
  investSaber = async (
    poolConfig: PoolConfig,
    vault: PublicKey,
    payer: PublicKey | Keypair,
    cluster: Cluster = DEVNET,
    executeTransaction: boolean = true
  ) => {
    const signerInfo: SignerInfo = getSignersFromPayer(payer);

    const { addr: globalStateAddr } = await this.generateGlobalStateAddress();
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

    const vaultTokenA = await resolveAtaForDeposit(
      poolConfig.tokenA,
      vault,
      signerInfo.payer,
      this.provider.connection
    );

    console.log("vaultTokenA: ", vaultTokenA.address.toBase58());

    const vaultTokenB = await resolveAtaForDeposit(
      poolConfig.tokenB,
      vault,
      signerInfo.payer,
      this.provider.connection
    );

    console.log("vaultTokenB: ", vaultTokenB.address.toBase58());

    const vaultLpToken = await resolveAtaForDeposit(
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

    // assume 1-1 right now
    const _commonInvestable = Math.min(
      poolConfig.investConfig.tokenAmountA,
      poolConfig.investConfig.tokenAmountB
    );
    const _investableA = new u64(_commonInvestable);
    const _investableB = new u64(_commonInvestable);
    const _minAmountBack = new u64(poolConfig.investConfig.minMintAmount);

    console.log("_investableA: ", _investableA.toNumber());
    console.log("_investableB: ", _investableB.toNumber());
    console.log("_minAmountBack: ", _minAmountBack.toNumber());

    console.log(
      "fetchedStableSwap.config.swapAccount: ",
      fetchedStableSwap.config.swapAccount.toBase58()
    );
    console.log(
      "fetchedStableSwap.state.poolTokenMint: ",
      fetchedStableSwap.state.poolTokenMint.toBase58()
    );
    console.log(
      "fetchedStableSwap.config.swapProgramID: ",
      fetchedStableSwap.config.swapProgramID.toBase58()
    );
    console.log(
      "fetchedStableSwap.config.authority: ",
      fetchedStableSwap.config.authority.toBase58()
    );
    console.log(
      "fetchedStableSwap.state.tokenA.reserve: ",
      fetchedStableSwap.state.tokenA.reserve.toBase58()
    );
    console.log(
      "fetchedStableSwap.state.tokenB.reserve: ",
      fetchedStableSwap.state.tokenB.reserve.toBase58()
    );
    console.log("vaultLpToken.address: ", vaultLpToken.address.toBase58());

    console.log("signerinfo: ", signerInfo.payer.toBase58());

    if (executeTransaction) {
      return this.vaultProgram.rpc.investSaber(
        _investableA,
        _investableB,
        _minAmountBack,
        {
          accounts: {
            payer: signerInfo.payer, // must be strategist
            authority: _vault.authority,
            globalProtocolState: globalStateAddr,
            vault,
            strategy: _vault.strategy,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            rent: SYSVAR_RENT_PUBKEY,
            // saber related accounts
            saberSwapCommon: {
              swap: fetchedStableSwap.config.swapAccount,
              swapAuthority: fetchedStableSwap.config.authority,
              sourceTokenA: vaultTokenA.address,
              sourceTokenB: vaultTokenB.address,
              reserveA: fetchedStableSwap.state.tokenA.reserve,
              reserveB: fetchedStableSwap.state.tokenB.reserve,
              poolMint: fetchedStableSwap.state.poolTokenMint,
              saberProgram: fetchedStableSwap.config.swapProgramID,
            },
            outputLp: vaultLpToken.address,
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
    }
    return "nan";
  };

  _toAccountMeta = (receipt: PublicKey, history: PublicKey) => {
    return [receipt, history].map(
      (acc, idx): AccountMeta => ({
        pubkey: acc,
        isSigner: false,
        // history (idx 1) should be writable
        isWritable: idx % 2 === 0 ? false : true,
      })
    );
  };

  _getAccountsForClaim = async (
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

      remainingAccounts.push(...this._toAccountMeta(receipt, history));

      // decrement claims index
      _claimsIndex = _claimsIndex.sub(ONE_U64);
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
    payer: PublicKey | Keypair,
    executeTransaction: boolean = true
  ): Promise<ProcessClaimsResult> => {
    const signerInfo: SignerInfo = getSignersFromPayer(payer);

    const { addr: globalStateAddr } = await this.generateGlobalStateAddress();
    const _vault = await this.fetchVault(vault);

    const remainingAccounts = await this._getAccountsForClaim(
      vault,
      toIVault(_vault)
    );

    if (executeTransaction) {
      const tx = await this.vaultProgram.rpc.processClaims({
        accounts: {
          payer: signerInfo.payer,
          authority: _vault.authority,
          globalProtocolState: globalStateAddr,
          vault,
        },
        remainingAccounts,
        signers: signerInfo.signers,
      });

      return {
        claimsProcessed: (await this.fetchVault(vault)).claimsProcessed,
        tx,
      };
    }

    return {
      claimsProcessed: false,
      tx: "nan",
    };
  };

  redeemSaber = async (
    poolConfig: PoolConfig,
    vault: PublicKey,
    slippageBps: number,
    payer: PublicKey | Keypair,
    cluster: Cluster = DEVNET,
    executeTransaction: boolean = true
  ) => {
    const signerInfo: SignerInfo = getSignersFromPayer(payer);

    const { addr: globalStateAddr } = await this.generateGlobalStateAddress();
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

    const vaultTokenA = await resolveAtaForDeposit(
      poolConfig.tokenA,
      vault,
      signerInfo.payer,
      this.provider.connection
    );

    const vaultTokenB = await resolveAtaForDeposit(
      poolConfig.tokenB,
      vault,
      signerInfo.payer,
      this.provider.connection
    );

    // we don't include pre-instruction to create the ATA because this is
    // handled in the instruction itself.
    const vaultLpToken = await resolveAtaForDeposit(
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

    if (executeTransaction) {
      return this.vaultProgram.rpc.redeemSaber(minA, minB, null, {
        accounts: {
          payer: signerInfo.payer, // must be strategist
          authority: _vault.authority,
          globalProtocolState: globalStateAddr,
          strategy: _vault.strategy,
          vault,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          rent: SYSVAR_RENT_PUBKEY,
          // saber related accounts
          saberSwapCommon: {
            swap: fetchedStableSwap.config.swapAccount,
            swapAuthority: fetchedStableSwap.config.authority,
            sourceTokenA: vaultTokenA.address,
            sourceTokenB: vaultTokenB.address,
            reserveA: fetchedStableSwap.state.tokenA.reserve,
            reserveB: fetchedStableSwap.state.tokenB.reserve,
            poolMint: fetchedStableSwap.state.poolTokenMint,
            saberProgram: fetchedStableSwap.config.swapProgramID,
          },
          inputLp: vaultLpToken.address,
          outputAFees: fetchedStableSwap.state.tokenA.adminFeeAccount,
          outputBFees: fetchedStableSwap.state.tokenB.adminFeeAccount,
        },
        signers: signerInfo.signers,
      });
    }
    return "nan";
  };

  redeemOrca = async (
    vault: PublicKey,
    orcaSwapProgram: PublicKey,
    pair: string,
    payer: PublicKey | Keypair,
    executeTransaction: boolean = true,
    cluster: Cluster = DEVNET
  ): Promise<string> => {
    const signerInfo: SignerInfo = getSignersFromPayer(payer);
    const { addr: globalStateAddr } = await this.generateGlobalStateAddress();
    const _vault = await this.fetchVault(vault);

    const orca = getOrca(this.provider.connection, clusterToNetwork(cluster));
    const { pool, poolParams } = getOrcaPool(orca, pair);

    const _invalidAmount = new Decimal(0);
    const orcaInvestment = await generatePoolConfigForVault(
      this,
      signerInfo.payer,
      vault,
      pool,
      poolParams,
      _invalidAmount,
      _invalidAmount,
      false
    );

    const maxAmountA = !orcaInvestment.a.amountOrcaU64
      ? ZERO_U64
      : orcaInvestment.a.amountOrcaU64;
    const maxAmountB = !orcaInvestment.b.amountOrcaU64
      ? ZERO_U64
      : orcaInvestment.b.amountOrcaU64;

    console.log("==========================================");
    console.log("maxAmountA: ", maxAmountA.toNumber());
    console.log("maxAmountB: ", maxAmountB.toNumber());
    console.log(
      "orcaInvestment.poolToken.amount: ",
      orcaInvestment.poolToken.amount.toNumber()
    );
    console.log("==========================================");

    const { instructions, cleanup, signers } = orcaInvestment.instructions;

    // =====================================================

    const amountTokenA = !orcaInvestment.a.amountOrcaU64
      ? ZERO_U64
      : orcaInvestment.a.amountOrcaU64;
    const amountTokenB = !orcaInvestment.b.amountOrcaU64
      ? ZERO_U64
      : orcaInvestment.b.amountOrcaU64;

    // =====================================================

    const swapConfig = await computeSwapForVault(
      pool,
      toIVault(vault),
      orcaInvestment
    );

    if (swapConfig) {
      console.log("swapConfig maxIn: ", swapConfig.maxIn.toNumber());
      console.log("swapConfig maxOut: ", swapConfig.maxOut.toNumber());
      console.log("swapConfig alphaToBeta: ", swapConfig.alphaToBeta);
    } else {
      console.log("swapConfig is null");
    }

    // =====================================================

    if (executeTransaction) {
      return this.vaultProgram.rpc.redeemOrca(
        orcaInvestment.poolToken.amount,
        amountTokenA,
        amountTokenB,
        swapConfig as any, // todo: does this work?
        {
          accounts: {
            payer: signerInfo.payer, // must be strategist
            authority: _vault.authority,
            globalProtocolState: globalStateAddr,
            vault,
            strategy: _vault.strategy,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            rent: SYSVAR_RENT_PUBKEY,
            // orca
            orcaSwapProgram: orcaSwapProgram,
            orcaPool: poolParams.address,
            orcaAuthority: poolParams.authority,
            poolMint: orcaInvestment.poolToken.mint,
            sourcePoolAccount: orcaInvestment.poolToken.source, // source LP account
            fromA: orcaInvestment.a.dest, // pool
            fromB: orcaInvestment.b.dest, // pool
            sourceTokenA: orcaInvestment.a.source, // vault
            sourceTokenB: orcaInvestment.b.source, // vault
            feeAccount: poolParams.feeAccount,
          },
          preInstructions: instructions,
          postInstructions: cleanup,
          signers: [...signerInfo.signers, ...signers],
        }
      );
    }

    return "NaN";
  };

  withdraw = async (
    vault: PublicKey,
    mint: PublicKey,
    lp: PublicKey,
    payer: PublicKey | Keypair,
    amount: u64 = ZERO_U64,
    executeTransaction: boolean = true
  ) => {
    const signerInfo: SignerInfo = getSignersFromPayer(payer);

    const { addr: globalStateAddr } = await this.generateGlobalStateAddress();
    const _vault = await this.fetchVault(vault);

    const sourceLpAccount = await resolveAtaForDeposit(
      lp,
      signerInfo.payer,
      signerInfo.payer,
      this.provider.connection
    );

    // @dev: don't create ATA at the beginning or close at the end of the transaction,
    // related to vault
    const sourceTokenAccount = await resolveAtaForDeposit(
      mint,
      vault,
      signerInfo.payer,
      this.provider.connection
    );

    const destinationTokenAccount = await resolveAtaForDeposit(
      mint,
      signerInfo.payer,
      signerInfo.payer,
      this.provider.connection
    );

    if (executeTransaction) {
      return this.vaultProgram.rpc.withdraw(amount, {
        accounts: {
          payer: signerInfo.payer,
          authority: _vault.authority,
          globalProtocolState: globalStateAddr,
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
        preInstructions: destinationTokenAccount.instructions,
        postInstructions: destinationTokenAccount.cleanup,
        signers: [...signerInfo.signers, ...destinationTokenAccount.signers],
      });
    }
    return "nan";
  };

  harvestOrca = async (
    vault: PublicKey,
    aquafarmProgram: PublicKey,
    pair: string,
    farmType: OrcaFarmType,
    payer: PublicKey | Keypair,
    executeTransaction: boolean = true,
    cluster: Cluster = DEVNET
  ): Promise<string> => {
    const signerInfo: SignerInfo = getSignersFromPayer(payer);
    const { addr: globalStateAddr } = await this.generateGlobalStateAddress();
    const _vault = await this.fetchVault(vault);
    console.log("_vault: ", _vault);
    const { addr: farmVault, bump } = await this.generateVaultFarmAddress(
      vault
    );

    const orca = getOrca(this.provider.connection, clusterToNetwork(cluster));
    const farmParams =
      farmType === OrcaFarmType.AQUAFARM
        ? getAquafarm(orca, pair)
        : getDoubleDipFarm(orca, pair);
    if (!farmParams) throw new Error("farm cannot be null");

    const farmData = await getFarmData(
      farmVault,
      aquafarmProgram,
      farmParams,
      signerInfo.payer,
      this.provider.connection
    );

    const { instructions, cleanup, signers } = farmData.instructions;

    if (executeTransaction) {
      return this.vaultProgram.rpc.harvestOrca(bump, {
        accounts: {
          payer: signerInfo.payer,
          authority: _vault.authority,
          globalProtocolState: globalStateAddr,
          vault,
          strategy: _vault.strategy,
          farmVault,
          aquafarmProgram,
          globalFarm: farmData.farm.globalFarm.publicKey,
          userFarm: farmData.userFarm,
          globalBaseTokenVault: farmData.farm.globalFarm.baseTokenVault,
          globalRewardTokenVault: farmData.farm.globalFarm.rewardTokenVault,
          userRewardAta: farmData.userRewardAta,
          farmAuthority: farmData.farm.globalFarm.authority,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
        preInstructions: instructions,
        postInstructions: cleanup,
        signers: [...signerInfo.signers, ...signers],
      });
    }
    return "nan";
  };

  convertOrcaLp = async (
    vault: PublicKey,
    aquafarmProgram: PublicKey,
    pair: string,
    farmType: OrcaFarmType,
    payer: PublicKey | Keypair,
    executeTransaction: boolean = true,
    cluster: Cluster = DEVNET
  ): Promise<string> => {
    const signerInfo: SignerInfo = getSignersFromPayer(payer);
    const { addr: globalStateAddr } = await this.generateGlobalStateAddress();
    const { addr: farmVault, bump } = await this.generateVaultFarmAddress(
      vault
    );

    const orca = getOrca(this.provider.connection, clusterToNetwork(cluster));
    const farmParams =
      farmType === OrcaFarmType.AQUAFARM
        ? getAquafarm(orca, pair)
        : getDoubleDipFarm(orca, pair);
    if (!farmParams) throw new Error("farm cannot be null");

    const vaultLp = await resolveAtaForDeposit(
      farmParams.baseTokenMint,
      vault,
      signerInfo.payer,
      this.provider.connection
    );

    const farmData = await getFarmData(
      farmVault,
      aquafarmProgram,
      farmParams,
      signerInfo.payer,
      this.provider.connection
    );

    const _vault = await this.fetchVault(vault);
    const { instructions, cleanup, signers } = farmData.instructions;
    if (executeTransaction) {
      return this.vaultProgram.rpc.convertOrcaLp(bump, {
        accounts: {
          payer: signerInfo.payer,
          authority: _vault.authority,
          globalProtocolState: globalStateAddr,
          vault,
          farmVault,
          strategy: _vault.strategy,
          aquafarmProgram,
          poolAccount: vaultLp.address,
          userBaseAta: farmData.userBaseAta,
          globalBaseTokenVault: farmData.farm.globalFarm.baseTokenVault,
          farmTokenMint: farmData.farm.globalFarm.farmTokenMint,
          userFarmAta: farmData.userFarmAta,
          globalFarm: farmData.farm.globalFarm.publicKey,
          userFarm: farmData.userFarm,
          globalRewardTokenVault: farmData.farm.globalFarm.rewardTokenVault,
          userRewardAta: farmData.userRewardAta,
          farmAuthority: farmData.farm.globalFarm.authority,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
        preInstructions: instructions,
        postInstructions: cleanup,
        signers: [...signerInfo.signers, ...signers],
      });
    }
    return "nan";
  };

  revertOrcaLp = async (
    vault: PublicKey,
    aquafarmProgram: PublicKey,
    pair: string,
    farmType: OrcaFarmType,
    payer: PublicKey | Keypair,
    executeTransaction: boolean = true,
    cluster: Cluster = DEVNET
  ): Promise<string> => {
    const signerInfo: SignerInfo = getSignersFromPayer(payer);
    const { addr: globalStateAddr } = await this.generateGlobalStateAddress();
    const { addr: farmVault, bump } = await this.generateVaultFarmAddress(
      vault
    );

    const orca = getOrca(this.provider.connection, clusterToNetwork(cluster));
    const farmParams =
      farmType === OrcaFarmType.AQUAFARM
        ? getAquafarm(orca, pair)
        : getDoubleDipFarm(orca, pair);
    if (!farmParams) throw new Error("farm cannot be null");

    const vaultLp = await resolveAtaForDeposit(
      farmParams.baseTokenMint,
      vault,
      signerInfo.payer,
      this.provider.connection
    );

    const farmData = await getFarmData(
      farmVault,
      aquafarmProgram,
      farmParams,
      signerInfo.payer,
      this.provider.connection
    );

    const _vault = await this.fetchVault(vault);
    const { instructions, cleanup, signers } = farmData.instructions;

    if (executeTransaction) {
      return this.vaultProgram.rpc.revertOrcaLp(bump, {
        accounts: {
          payer: signerInfo.payer,
          authority: _vault.authority,
          globalProtocolState: globalStateAddr,
          vault,
          farmVault,
          strategy: _vault.strategy,
          aquafarmProgram,
          poolAccount: vaultLp.address,
          userBaseAta: farmData.userBaseAta,
          globalBaseTokenVault: farmData.farm.globalFarm.baseTokenVault,
          farmTokenMint: farmData.farm.globalFarm.farmTokenMint,
          userFarmAta: farmData.userFarmAta,
          globalFarm: farmData.farm.globalFarm.publicKey,
          userFarm: farmData.userFarm,
          globalRewardTokenVault: farmData.farm.globalFarm.rewardTokenVault,
          userRewardAta: farmData.userRewardAta,
          farmAuthority: farmData.farm.globalFarm.authority,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
        preInstructions: instructions,
        postInstructions: cleanup,
        signers: [...signerInfo.signers, ...signers],
      });
    }

    return "nan";
  };

  initializeUserFarmOrca = async (
    vault: PublicKey,
    aquafarmProgram: PublicKey,
    farmParams: OrcaFarmParams,
    payer: PublicKey | Keypair,
    executeTransaction: boolean = true
  ): Promise<string> => {
    const signerInfo: SignerInfo = getSignersFromPayer(payer);
    const { addr: globalStateAddr } = await this.generateGlobalStateAddress();
    const { addr: farmVault, bump } = await this.generateVaultFarmAddress(
      vault
    );

    const farmData = await getFarmData(
      farmVault,
      aquafarmProgram,
      farmParams,
      signerInfo.payer,
      this.provider.connection
    );

    const _vault = await this.fetchVault(vault);
    if (executeTransaction) {
      return this.vaultProgram.rpc.initializeUserFarmOrca(bump, {
        accounts: {
          payer: signerInfo.payer,
          authority: _vault.authority,
          globalProtocolState: globalStateAddr,
          vault,
          farmVault,
          strategy: _vault.strategy,
          aquafarmProgram,
          globalFarm: farmData.farm.globalFarm.publicKey,
          userFarm: farmData.userFarm,
          rent: SYSVAR_RENT_PUBKEY,
          systemProgram: SystemProgram.programId,
        },
        signers: signerInfo.signers,
      });
    }
    return "nan";
  };

  // todo: test this works?
  swapFromFarmVault = async (
    vault: PublicKey,
    orcaSwapProgram: PublicKey,
    tokenIn: PublicKey,
    maxIn: Decimal,
    minOut: Decimal,
    poolParams: OrcaPoolParams,
    payer: PublicKey | Keypair,
    executeTransaction: boolean = true
  ) => {
    const signerInfo: SignerInfo = getSignersFromPayer(payer);
    const { addr: globalStateAddr } = await this.generateGlobalStateAddress();
    const { addr: farmVault, bump } = await this.generateVaultFarmAddress(
      vault
    );

    const { inputPoolToken, outputPoolToken } = getTokens(
      poolParams,
      tokenIn.toBase58()
    );

    const amountInU64 = U64Utils.toTokenU64(maxIn, inputPoolToken, "amountIn");
    const minimumAmountOutU64 = U64Utils.toTokenU64(
      minOut,
      outputPoolToken,
      "minimumAmountOut"
    );

    // could also be something else?
    const swapAuthority = farmVault;
    const swapConfig = await getSwapConfig(
      inputPoolToken,
      amountInU64,
      outputPoolToken,
      swapAuthority,
      signerInfo.payer,
      this.provider.connection
    );

    const _vault = await this.fetchVault(vault);
    if (executeTransaction) {
      return this.vaultProgram.rpc.swapOrca(
        bump, // irrelevant for now, only PDAs
        amountInU64,
        minimumAmountOutU64,
        {
          accounts: {
            payer: signerInfo.payer,
            authority: _vault.authority,
            globalProtocolState: globalStateAddr,
            vault,
            farmVault,
            strategy: _vault.strategy,
            userTransferAuthority: swapAuthority,
            orcaSwapProgram: orcaSwapProgram,
            orcaPool: poolParams.address,
            orcaAuthority: poolParams.authority,
            userSource: swapConfig.input.source,
            poolSource: swapConfig.input.dest,
            userDestination: swapConfig.output.source,
            poolDestination: swapConfig.output.dest,
            poolMint: poolParams.poolTokenMint,
            feeAccount: poolParams.feeAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
          },
          preInstructions: swapConfig.instructions.instructions,
          postInstructions: swapConfig.instructions.cleanup,
          signers: [...signerInfo.signers, ...swapConfig.instructions.signers],
        }
      );
    }

    return "nan";
  };
}

export const generatePoolConfigForVault = async (
  client: VaultClient,
  payer: PublicKey,
  vault: PublicKey,
  pool: OrcaPool,
  poolParams: OrcaPoolParams,
  alpha: Decimal,
  beta: Decimal,
  isDeposit: boolean
) => {
  const poolTokenA = pool.getTokenA();
  const poolTokenB = pool.getTokenB();
  const poolTokenMint = pool.getPoolTokenMint();

  let sideA: VaultInvestment;
  let sideB: VaultInvestment;
  let instructionData: InstructionData = initInstructionData();

  const _vault = toIVault(await client.fetchVault(vault));
  if (
    poolTokenA.mint.toBase58() === _vault.alpha.mint.toBase58() &&
    poolTokenB.mint.toBase58() === _vault.beta.mint.toBase58()
  ) {
    const vaultTokenA = await resolveAtaForDeposit(
      poolTokenA.mint,
      vault,
      payer,
      client.provider.connection
    );
    instructionData = extendInstructionData(instructionData, vaultTokenA);
    sideA = {
      token: poolTokenA,
      amountDecimal: alpha,
      source: vaultTokenA.address,
      dest: poolTokenA.addr,
    };

    const vaultTokenB = await resolveAtaForDeposit(
      poolTokenB.mint,
      vault,
      payer,
      client.provider.connection
    );
    instructionData = extendInstructionData(instructionData, vaultTokenB);
    sideB = {
      token: poolTokenB,
      amountDecimal: beta,
      source: vaultTokenB.address,
      dest: poolTokenB.addr,
    };
  } else if (
    poolTokenA.mint.toBase58() === _vault.beta.mint.toBase58() &&
    poolTokenB.mint.toBase58() === _vault.alpha.mint.toBase58()
  ) {
    const vaultTokenA = await resolveAtaForDeposit(
      poolTokenB.mint,
      vault,
      payer,
      client.provider.connection
    );
    instructionData = extendInstructionData(instructionData, vaultTokenA);
    sideA = {
      token: poolTokenB,
      amountDecimal: alpha,
      source: vaultTokenA.address,
      dest: poolTokenB.addr,
    };

    const vaultTokenB = await resolveAtaForDeposit(
      poolTokenA.mint,
      vault,
      payer,
      client.provider.connection
    );
    instructionData = extendInstructionData(instructionData, vaultTokenB);
    sideB = {
      token: poolTokenA,
      amountDecimal: beta,
      source: vaultTokenB.address,
      dest: poolTokenA.addr,
    };
  } else {
    throw new Error("Pool tokens don't match vault tranches");
  }

  // normal ATA
  const vaultLp = await resolveAtaForDeposit(
    poolTokenMint,
    vault,
    payer,
    client.provider.connection
  );
  instructionData = extendInstructionData(instructionData, vaultLp);

  let amountTokenA: OrcaU64 = ZERO_ORCA_U64;
  let amountTokenB: OrcaU64 = ZERO_ORCA_U64;
  let poolTokenAmount: OrcaU64 = ZERO_ORCA_U64;

  if (isDeposit) {
    const { maxTokenAIn, maxTokenBIn, minPoolTokenAmountOut } =
      await pool.getDepositQuote(sideA.amountDecimal, sideB.amountDecimal);

    amountTokenA = maxTokenAIn;
    amountTokenB = maxTokenBIn;
    poolTokenAmount = minPoolTokenAmountOut;
  } else {
    const withdrawTokenAmount = await pool.getLPBalance(vault); // in this case, the vault owns the LP
    const withdrawTokenMint = pool.getPoolTokenMint();
    const { maxPoolTokenAmountIn, minTokenAOut, minTokenBOut } =
      await pool.getWithdrawQuote(withdrawTokenAmount, withdrawTokenMint);

    amountTokenA = minTokenAOut;
    amountTokenB = minTokenBOut;
    poolTokenAmount = maxPoolTokenAmountIn;
  }

  const amountTokenA_U64 = U64Utils.toTokenU64(
    amountTokenA.toDecimal(),
    sideA.token,
    "maxAIn"
  );

  const amountTokenB_U64 = U64Utils.toTokenU64(
    amountTokenB.toDecimal(),
    sideB.token,
    "maxBIn"
  );

  const amountPoolToken_U64 = U64Utils.toPoolU64(
    poolTokenAmount.toDecimal(),
    poolParams,
    "poolTokenAmount"
  );

  return {
    a: {
      ...sideA,
      amountOrcaU64: amountTokenA_U64,
    },
    b: {
      ...sideB,
      amountOrcaU64: amountTokenB_U64,
    },
    poolToken: {
      mint: poolTokenMint,
      source: vaultLp.address,
      amount: amountPoolToken_U64,
    },
    instructions: instructionData,
  } as OrcaInvestment;
};

export interface OrcaInvestment {
  a: VaultInvestment;
  b: VaultInvestment;
  poolToken: PoolToken;
  instructions: InstructionData;
}

export interface PoolToken {
  mint: PublicKey;
  source: PublicKey;
  amount: u64;
}

export interface VaultInvestment {
  token: OrcaPoolToken;
  amountDecimal: Decimal;
  amountOrcaU64?: u64;
  source: PublicKey;
  dest: PublicKey;
}

// ===============================================================

// todo: add type
export const getOrcaPool = (orca: Orca, pair: string) => {
  try {
    const pool = orca.getPool(ORCA_POOL_CONFIG[pair]);
    return {
      pool,
      poolParams: (pool as any).poolParams,
    };
  } catch (err: any) {
    throw new Error(`pool not found for ${pair}`);
  }
};

export const getAquafarm = (orca: Orca, pair: string): OrcaFarmParams => {
  const farmPair = `${pair}_AQ`; // transform `ORCA_SOL` to `ORCA_SOL_AQ`

  try {
    const orcaSolFarm = orca.getFarm(ORCA_FARM_CONFIG[farmPair]);
    return (orcaSolFarm as any).farmParams;
  } catch (err: any) {
    throw new Error(`aquafarm not found for ${farmPair}`);
  }
};

export const getDoubleDipFarm = (
  orca: Orca,
  pair: string
): OrcaFarmParams | null => {
  const doubleDipPair = `${pair}_DD`; // transform `ORCA_SOL` to `ORCA_SOL_AQ`

  try {
    const doubleDipFarm = orca.getFarm(ORCA_FARM_CONFIG[doubleDipPair]);
    return (doubleDipFarm as any).farmParams;
  } catch (err: any) {
    return null;
  }
};

// ===============================================================

// todo
// export interface OrcaPoolConfig {
//   tokenA: OrcaPoolToken;
//   // source/dest not needed in ora since deposit into vault and into orca are separate
//   sourceA: PublicKey;
//   // destA: PublicKey;
//   tokenB: OrcaPoolToken;
//   sourceB: PublicKey;
//   // destB: PublicKey;
//   destLP: PublicKey;
//   poolTokenMint: PublicKey;
//   instructions: InstructionData;
// }

// // todo: in future, maybe take token pair and find pool info?
// export const getPoolData_legacy = async (
//   vault: PublicKey,
//   orcaSwapProgram: PublicKey,
//   pool: OrcaPool,
//   poolParams: OrcaPoolParams,
//   payer: PublicKey,
//   initialA: number, // non-zero for SOL mints
//   initialB: number, // non-zero for SOL mints
//   connection: Connection
// ): Promise<OrcaPoolConfig> => {
//   const tokenA = pool.getTokenA();
//   const tokenB = pool.getTokenB();
//   const poolTokenMint = pool.getPoolTokenMint();

//   const userTokenA = await resolveAtaForDeposit(
//     tokenA.mint,
//     payer,
//     payer,
//     connection,
//     initialA
//   );

//   const userTokenB = await resolveAtaForDeposit(
//     tokenB.mint,
//     payer,
//     payer,
//     connection,
//     initialB
//   );

//   const vaultTokenA = await resolveAtaForDeposit(
//     tokenA.mint,
//     vault,
//     payer,
//     connection
//   );

//   // normal ATA
//   const vaultTokenB = await resolveAtaForDeposit(
//     tokenB.mint,
//     vault,
//     payer,
//     connection
//   );

//   const vaultLp = await resolveAtaForDeposit(
//     poolTokenMint,
//     vault,
//     payer,
//     connection
//   );

//   console.log("==========================================");
//   console.log("orcaSwapProgram: ", orcaSwapProgram.toBase58());
//   console.log("orcaPool: ", poolParams.address.toBase58());
//   console.log("orcaAuthority: ", poolParams.authority.toBase58());
//   console.log("tokenA mint: ", tokenA.mint.toBase58());
//   console.log("tokenB mint: ", tokenB.mint.toBase58());
//   console.log("poolTokenMint: ", poolTokenMint.toBase58());
//   console.log("==========================================");
//   console.log("userTokenA: ", userTokenA.address.toBase58());
//   console.log("vaultTokenA: ", vaultTokenA.address.toBase58());
//   console.log("==========================================");
//   console.log("userTokenB: ", userTokenB.address.toBase58());
//   console.log("vaultTokenB: ", vaultTokenB.address.toBase58());
//   console.log("==========================================");
//   console.log("poolTokenMint: ", poolTokenMint.toBase58());
//   console.log("vaultLp: ", vaultLp.address.toBase58());
//   console.log("==========================================");

//   const instructionData: InstructionData = {
//     instructions: [
//       ...userTokenA.instructions,
//       ...userTokenB.instructions,
//       ...vaultTokenA.instructions,
//       ...vaultTokenB.instructions,
//       ...vaultLp.instructions,
//     ],
//     cleanup: [
//       ...userTokenA.cleanup,
//       ...userTokenB.cleanup,
//       ...vaultTokenA.cleanup,
//       ...vaultTokenB.cleanup,
//       ...vaultLp.cleanup,
//     ],
//     signers: [
//       ...userTokenA.signers,
//       ...userTokenB.signers,
//       ...vaultTokenA.signers,
//       ...vaultTokenB.signers,
//       ...vaultLp.signers,
//     ],
//   };

//   return {
//     tokenA,
//     sourceA: userTokenA.address,
//     destA: vaultTokenA.address,
//     tokenB,
//     sourceB: userTokenB.address,
//     destB: vaultTokenB.address,
//     poolTokenMint,
//     destLP: vaultLp.address,
//     instructions: instructionData,
//   } as OrcaPoolConfig;
// };

// // todo: in future, maybe take token pair and find pool info?
// export const getPoolData = async (
//   vault: PublicKey,
//   orcaSwapProgram: PublicKey,
//   pool: OrcaPool,
//   poolParams: OrcaPoolParams,
//   payer: PublicKey,
//   initialA: number, // non-zero for SOL mints
//   initialB: number, // non-zero for SOL mints
//   connection: Connection
// ): Promise<OrcaPoolConfig> => {
//   const tokenA = pool.getTokenA();
//   const tokenB = pool.getTokenB();
//   const poolTokenMint = pool.getPoolTokenMint();

//   const vaultTokenA = await resolveAtaForDeposit(
//     tokenA.mint,
//     vault,
//     payer,
//     connection
//   );

//   const vaultTokenB = await resolveAtaForDeposit(
//     tokenB.mint,
//     vault,
//     payer,
//     connection
//   );

//   // normal ATA
//   const vaultLp = await resolveAtaForDeposit(
//     poolTokenMint,
//     vault,
//     payer,
//     connection
//   );

//   console.log("==========================================");
//   console.log("orcaSwapProgram: ", orcaSwapProgram.toBase58());
//   console.log("orcaPool: ", poolParams.address.toBase58());
//   console.log("orcaAuthority: ", poolParams.authority.toBase58());
//   console.log("tokenA mint: ", tokenA.mint.toBase58());
//   console.log("tokenB mint: ", tokenB.mint.toBase58());
//   console.log("poolTokenMint: ", poolTokenMint.toBase58());
//   console.log("==========================================");
//   console.log("vaultTokenA: ", vaultTokenA.address.toBase58());
//   console.log("==========================================");
//   console.log("vaultTokenB: ", vaultTokenB.address.toBase58());
//   console.log("==========================================");
//   console.log("poolTokenMint: ", poolTokenMint.toBase58());
//   console.log("vaultLp: ", vaultLp.address.toBase58());
//   console.log("==========================================");

//   const instructionData: InstructionData = {
//     instructions: [
//       ...vaultTokenA.instructions,
//       ...vaultTokenB.instructions,
//       ...vaultLp.instructions,
//     ],
//     cleanup: [
//       ...vaultTokenA.cleanup,
//       ...vaultTokenB.cleanup,
//       ...vaultLp.cleanup,
//     ],
//     signers: [
//       ...vaultTokenA.signers,
//       ...vaultTokenB.signers,
//       ...vaultLp.signers,
//     ],
//   };

//   return {
//     tokenA,
//     destA: vaultTokenA.address,
//     tokenB,
//     destB: vaultTokenB.address,
//     poolTokenMint,
//     destLP: vaultLp.address,
//     instructions: instructionData,
//   } as OrcaPoolConfig;
// };

export const extendInstructionData = (
  instructionData: InstructionData,
  result: CompositeATAResult
): InstructionData => {
  return {
    instructions: [...instructionData.instructions, ...result.instructions],
    cleanup: [...instructionData.cleanup, ...result.cleanup],
    signers: [...instructionData.signers, ...result.signers],
  };
};

export const clusterToNetwork = (cluster: Cluster): Network => {
  if (cluster === DEVNET) {
    return Network.DEVNET;
  }

  return Network.MAINNET;
};

export enum OrcaFarmType {
  AQUAFARM,
  DOUBLE_DIP,
}

export const toOrcaFarmType = (farm: string): OrcaFarmType => {
  if (farm === "aquafarm") {
    return OrcaFarmType.AQUAFARM;
  } else if (farm === "double-dip") {
    return OrcaFarmType.DOUBLE_DIP;
  }

  throw new Error("invalid farm type");
};
