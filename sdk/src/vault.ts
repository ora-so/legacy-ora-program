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
  getTimestamp,
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

export const INACTIVE_STATE = "inactive";
export const DEPOSIT_STATE = "deposit";
export const LIVE_STATE = "live";
export const REDEEM_STATE = "redeem";
export const WITHDRAW_STATE = "withdraw";

type TargetVaultState =
  | typeof INACTIVE_STATE
  | typeof DEPOSIT_STATE
  | typeof LIVE_STATE
  | typeof REDEEM_STATE
  | typeof WITHDRAW_STATE;

export const fixedRateToDecimal = (n: number) => n / 10_000;

export const descaleToOrcaU64 = (amount: number, token: OrcaPoolToken) => {
  const scale = token.scale;
  // we want decimal?
  return new OrcaU64(new u64(amount / 10 ** (scale - 2)), scale);
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
  orcaInvestment: OrcaInvestment,
  iterationDeltaBps: number = 1 // bips
): Promise<SwapConfig | null> => {
  const trancheTokens = getTrancheAsOrcaTokens(vault, pool);
  console.log("alpha tranche scale: ", trancheTokens.alpha.scale);
  console.log("beta tranche scale: ", trancheTokens.beta.scale);

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
  console.log("vault.fixedRate: ", vault.fixedRate);
  console.log("fixedRateDecimal: ", fixedRateDecimal);

  // form => amount * 10 ** decimals
  const requiredAlpha =
    vault.alpha.invested.toNumber() * (1 + fixedRateDecimal);
  console.log("requiredAlpha: ", requiredAlpha);

  if (_redeemableAlpha < requiredAlpha) {
    console.log("_redeemableAlpha < requiredAlpha");

    // swap beta for alpha; we need to make alpha tranche whole since it's senior
    // we can use swapAmount input/output ratio to back into approximate input for output
    // including slippage and fees. aka how much of beta we need to convert to alpha.
    // otherwise, we could reverse engineer the getQuote function, but this might be just
    // as effective?
    const remainingA = requiredAlpha - _redeemableAlpha;
    const remainingA_OrcaU64 = toOrcaU64(remainingA, trancheTokens.alpha);

    // get a rough estimate on the swap conversion between A & B, use that to close in on B -> reqired(A)
    let seedSwap = await getAmountsForSwap(
      pool,
      trancheTokens.alpha,
      remainingA_OrcaU64
    );
    // initial swap lossy due to fee calculations; initial buffer will help us hone in on target value faster.
    let input = seedSwap.output.toNumber() * 1.005;

    // we require at least remainingA to make alpha tranche whole; look in range of [requiredFloor, acceptableUpper)
    const requiredFloor = remainingA;
    const acceptableUpper = remainingA * 1.01;
    console.log(
      "requiredFloor: ",
      requiredFloor,
      ", acceptableUpper: ",
      acceptableUpper
    );

    // todo: add type with defaults?
    let swapEstimate: any;
    let foundValidSwap = false;
    for (let i = 0; i < 1000; i++) {
      console.log("input: ", input);
      swapEstimate = await getAmountsForSwap(
        pool,
        trancheTokens.beta,
        scaleToOrcaU64(input, trancheTokens.beta)
      );
      console.log("swapEstimate: ", swapEstimate);

      const _output =
        swapEstimate.output.toNumber() * 10 ** trancheTokens.alpha.scale;
      if (_output < requiredFloor) {
        console.log("output too low");
        input = input * (1 + iterationDeltaBps / 10_000);
      } else if (_output > acceptableUpper) {
        console.log("output too high");
        input = input * (1 - iterationDeltaBps / 10_000);
      } else {
        console.log(`found acceptable output ${_output} in ${i} iterations`);
        foundValidSwap = true;
        break;
      }
    }

    if (!foundValidSwap) throw new Error("never found valid swap");

    return {
      maxIn: U64Utils.toTokenU64(
        swapEstimate.input,
        trancheTokens.beta,
        "inputAmount"
      ),
      maxOut: U64Utils.toTokenU64(
        swapEstimate.output,
        trancheTokens.alpha,
        "outputAmount"
      ),
      alphaToBeta: false,
    };
  } else if (_redeemableAlpha > requiredAlpha) {
    console.log("_redeemableAlpha > requiredAlpha");
    // swap alpha for beta
    const residualA = _redeemableAlpha - requiredAlpha;
    console.log("residualA: ", residualA);

    const swapEstimate = await getAmountsForSwap(
      pool,
      trancheTokens.alpha,
      scaleToOrcaU64(residualA, trancheTokens.alpha)
    );
    console.log("swapEstimate: ", swapEstimate);

    return {
      maxIn: U64Utils.toTokenU64(
        swapEstimate.input,
        trancheTokens.alpha,
        "inputAmount"
      ),
      maxOut: U64Utils.toTokenU64(
        swapEstimate.output,
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
  console.log("input: ", amountForSwap.input.toNumber());
  console.log("output: ", amountForSwap.output.toNumber());
  return amountForSwap.input.toNumber() / amountForSwap.output.toNumber();
  // return amountForSwap.output.toNumber() / amountForSwap.input.toNumber();
};

export const getAmountsForSwap = async (
  pool: OrcaPool,
  inputToken: OrcaPoolToken,
  inputAmount: OrcaU64
) => {
  console.log("inputToken: ", inputToken.mint.toBase58());
  console.log("inputAmount: ", inputAmount.toNumber());

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

export const resolveAtaForPda = async (
  mint: PublicKey,
  owner: PublicKey,
  payer: PublicKey,
  connection: Connection
): Promise<CompositeATAResult> => {
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
  }

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
};

// ==========================================
// farm stuff
// aquafarm sdk: https://github.com/orca-so/typescript-sdk/blob/e04a5c4742500e1b9988207226d58184617ed45c/src/model/orca/farm/orca-farm.ts#L60
// todo: in future, maybe take token pair and find pool info?
// ==========================================
export const getFarmData = async (
  farmOwner: PublicKey, // PDA here
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
  const userFarm = await resolveAtaForPda(
    _farm.globalFarm.farmTokenMint,
    farmOwner,
    payer,
    connection
  );

  // If the user lacks the reward token account, create it
  const userReward = await resolveAtaForPda(
    rewardTokenMint,
    farmOwner,
    payer,
    connection
  );

  // If the user lacks the base token account, create it
  const userBase = await resolveAtaForPda(
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

  generateVaultStoreAddress = async (
    vault: PublicKey,
    programID: PublicKey = this.vaultProgram.programId
  ): Promise<PdaDerivationResult> => {
    const [addr, bump] = await this.findProgramAddress(programID, [
      "vaultstore",
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

  fetchOrcaLpStrategyV0 = async (addr: PublicKey) => {
    return this.vaultProgram.account.orcaStrategyDataV0.fetch(addr);
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
    console.log("globalStateAddr: ", globalStateAddr.toBase58());

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
    console.log("_tokenA: ", _tokenA.mint.toBase58());
    console.log("_tokenB: ", _tokenB.mint.toBase58());
    console.log("aquafarmParams: ", aquafarmParams.address.toBase58());
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
    const flag = new BN(2); // 2
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
            tokenA: _tokenA.mint,
            tokenB: _tokenB.mint,
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
    gpsAuthority: PublicKey | Keypair,
    executeTransaction: boolean = true
  ) => {
    const signerInfo: SignerInfo = getSignersFromPayer(payer);
    const gpsAuthorityInfo: SignerInfo = getSignersFromPayer(gpsAuthority);

    const { addr: globalStateAddr } = await this.generateGlobalStateAddress();
    const { addr: vault, bump: vaultBump } = await this.generateVaultAddress(
      signerInfo.payer
    );
    const { addr: vaultStore, bump: vaultStoreBump } =
      await this.generateVaultStoreAddress(vault);

    // todo: are these alpha/beta ATAs even needed????
    const alpha = vaultConfig.alpha.mint;
    const alphaDecimals = (await this.fetchTokenSupply(vaultConfig.alpha.mint))
      .decimals;
    const alphaLp = Keypair.generate();

    const beta = vaultConfig.beta.mint;
    const betaDecimals = (await this.fetchTokenSupply(vaultConfig.beta.mint))
      .decimals;
    const betaLp = Keypair.generate();

    console.log("alpha: ", alpha.toBase58());
    console.log("alha lp: ", alphaLp.publicKey.toBase58());
    console.log("beta: ", beta.toBase58());
    console.log("beta lp: ", betaLp.publicKey.toBase58());

    if (alpha.toBase58() === beta.toBase58()) {
      throw new Error(
        "alpha and beta tranche assets must have different mints"
      );
    }

    if (executeTransaction) {
      // `indefinite span` transaction error can happen when using `undefined` instead of `null` for optional types.
      return this.vaultProgram.rpc.initializeVault(
        vaultBump,
        vaultStoreBump,
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
          // removed investAt and redeemAt
          depositDuration: vaultConfig.depositDuration,
          investDuration: vaultConfig.investDuration,
        } as any,
        {
          accounts: {
            authority: signerInfo.payer,
            gpsAuthority: gpsAuthorityInfo.payer,
            globalProtocolState: globalStateAddr,
            vault,
            vaultStore,
            alphaMint: alpha,
            alphaLp: alphaLp.publicKey,
            betaMint: beta,
            betaLp: betaLp.publicKey,
            systemProgram: SystemProgram.programId,
            rent: SYSVAR_RENT_PUBKEY,
          },
          // todo: vault is mint/freeze authority for now
          // todo: move to anchor?
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
          ],
          signers: [
            alphaLp,
            betaLp,
            ...signerInfo.signers,
            ...gpsAuthorityInfo.signers,
          ],
        }
      );
    }
    return "nan";
  };

  transitionVault = async (
    vault: PublicKey,
    target: TargetVaultState,
    payer: PublicKey | Keypair,
    executeTransaction: boolean = true
  ) => {
    const signerInfo: SignerInfo = getSignersFromPayer(payer);
    const { addr: globalStateAddr } = await this.generateGlobalStateAddress();
    const timestamp = new u64(getTimestamp(new Date()));

    console.log("vault: ", vault.toBase58());
    console.log("globalStateAddr: ", globalStateAddr.toBase58());
    console.log("target: ", target);
    console.log("timestamp: ", timestamp.toNumber());

    if (executeTransaction) {
      return this.vaultProgram.rpc.transitionVault(target, timestamp as any, {
        accounts: {
          authority: signerInfo.payer,
          globalProtocolState: globalStateAddr,
          vault,
        },
        signers: signerInfo.signers,
      });
    }
    return "nan";
  };

  // todo: deposit directly into the vault_store
  deposit = async (
    vault: PublicKey,
    mint: PublicKey,
    amount: u64,
    payer: PublicKey | Keypair,
    executeTransaction: boolean = true
  ) => {
    const signerInfo: SignerInfo = getSignersFromPayer(payer);
    const _vault = await this.fetchVault(vault);

    const { addr: vaultStore } = await this.generateVaultStoreAddress(vault);
    console.log("vaultStore: ", vaultStore.toBase58());

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
    const destinationTokenAccount = await resolveAtaForPda(
      mint,
      vaultStore,
      signerInfo.payer,
      this.provider.connection
    );
    console.log(
      "destinationTokenAccount: ",
      destinationTokenAccount.address.toBase58()
    );

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
        index as any,
        receiptBump,
        historyBump,
        amount as any,
        {
          accounts: {
            payer: signerInfo.payer,
            authority: _vault.authority,
            globalProtocolState: globalStateAddr,
            vault,
            vaultStore,
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

  // todo: claim directly into the vault_store
  claim = async (
    vault: PublicKey,
    mint: PublicKey,
    payer: PublicKey | Keypair,
    executeTransaction: boolean = true
  ) => {
    const signerInfo: SignerInfo = getSignersFromPayer(payer);

    const { addr: vaultStore } = await this.generateVaultStoreAddress(vault);
    console.log("vaultStore: ", vaultStore.toBase58());

    const { addr: globalStateAddr } = await this.generateGlobalStateAddress();
    const _vault = await this.fetchVault(vault);
    const _asset = this.getAsset(toIVault(_vault), mint);
    const _assetLp = _asset.lp;

    const sourceAssetAta = await resolveAtaForPda(
      mint,
      vaultStore,
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
          vaultStore,
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
        preInstructions: [
          ...destinationAssetAta.instructions,
          ...destinationLpTokenAccount.instructions,
        ],
        signers: [
          ...signerInfo.signers,
          ...destinationAssetAta.signers,
          ...destinationLpTokenAccount.signers,
        ],
        postInstructions: destinationAssetAta.cleanup,
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
    const { addr: vaultStore } = await this.generateVaultStoreAddress(vault);

    const _vault = await this.fetchVault(vault);
    console.log("_vault: ", _vault);

    const orca = getOrca(this.provider.connection, clusterToNetwork(cluster));
    const { pool, poolParams } = getOrcaPool(orca, pair);

    const orcaInvestment = await generatePoolConfigForVault(
      this,
      signerInfo.payer,
      vault,
      vaultStore,
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
    console.log("a: ", orcaInvestment.a.token.mint.toBase58());
    console.log("a amount: ", maxAmountA.toNumber());
    console.log("b: ", orcaInvestment.b.token.mint.toBase58());
    console.log("b amount: ", maxAmountB.toNumber());

    console.log(
      "in exchange for lp: ",
      orcaInvestment.poolToken.amount.toNumber()
    );
    console.log("==========================================");

    console.log("payer: ", signerInfo.payer.toBase58());
    console.log("strategy: ", _vault.strategy.toBase58());
    console.log("authority: ", _vault.authority.toBase58());

    const { instructions, cleanup, signers } = orcaInvestment.instructions;

    if (executeTransaction) {
      return this.vaultProgram.rpc.investOrca(
        maxAmountA as any,
        maxAmountB as any,
        orcaInvestment.poolToken.amount,
        {
          accounts: {
            payer: signerInfo.payer, // must be strategist
            authority: _vault.authority,
            globalProtocolState: globalStateAddr,
            vault,
            vaultStore,
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
        _investableA as any,
        _investableB as any,
        _minAmountBack as any,
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
        isWritable: idx % 2 !== 0,
      })
    );
  };

  _getAccountsForClaim = async (
    vaultAddress: PublicKey,
    vault: IVault,
    mint: PublicKey,
    count: number = 2
  ): Promise<AccountMeta[]> => {
    const asset = this.getAsset(vault, mint);

    const remainingAccounts: AccountMeta[] = [];
    if (asset.claimsProcessed) return remainingAccounts;

    let _claimsIndex = new u64(
      asset.claimsIdx ? asset.claimsIdx : asset.deposits
    );
    console.log("_claimsIndex: ", _claimsIndex.toNumber());

    for (let i = 0; i <= count; i++) {
      // we reached the end early
      if (_claimsIndex.eq(ZERO_U64)) {
        break;
      }

      const { addr: receipt } = await this.generateReceiptAddress(
        vaultAddress,
        asset.mint,
        _claimsIndex
      );

      const _receipt = await this.fetchReceipt(receipt);
      console.log("_receipt: ", _receipt);

      const { addr: history } = await this.generateHistoryAddress(
        vaultAddress,
        asset.mint,
        _receipt.depositor
      );

      console.log("history: ", history);
      const _history = await this.fetchHistory(history);
      console.log("_history: ", _history);

      remainingAccounts.push(...this._toAccountMeta(receipt, history));

      // decrement claims index
      _claimsIndex = _claimsIndex.sub(ONE_U64);
    }

    console.log("remainingAccounts: ", remainingAccounts.length);

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
    mint: PublicKey,
    payer: PublicKey | Keypair,
    executeTransaction: boolean = true
  ): Promise<ProcessClaimsResult> => {
    const signerInfo: SignerInfo = getSignersFromPayer(payer);

    const { addr: globalStateAddr } = await this.generateGlobalStateAddress();
    const _vault = await this.fetchVault(vault);
    const _asset = await this.getAsset(toIVault(_vault), mint);

    console.log("_asset: ", _asset.mint.toBase58());

    const remainingAccounts = await this._getAccountsForClaim(
      vault,
      toIVault(_vault),
      mint
    );
    console.log("remainingAccounts: ", remainingAccounts.length);

    // note: we still need to submit the transaction when there are no claims to process
    // because we need to update state on-chain.
    if (executeTransaction) {
      const tx = await this.vaultProgram.rpc.processClaims({
        accounts: {
          payer: signerInfo.payer,
          authority: _vault.authority,
          globalProtocolState: globalStateAddr,
          vault,
          mint: _asset.mint,
        },
        remainingAccounts,
        signers: signerInfo.signers,
      });

      const assetAfterProcessing = await this.getAsset(
        toIVault(await this.fetchVault(vault)),
        mint
      );

      return {
        claimsProcessed: assetAfterProcessing.claimsProcessed,
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
      return this.vaultProgram.rpc.redeemSaber(minA as any, minB as any, null, {
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
    const { addr: vaultStore } = await this.generateVaultStoreAddress(vault);

    const _vault = await this.fetchVault(vault);

    const orca = getOrca(this.provider.connection, clusterToNetwork(cluster));
    const { pool, poolParams } = getOrcaPool(orca, pair);

    const _invalidAmount = new Decimal(0);
    const orcaInvestment = await generatePoolConfigForVault(
      this,
      signerInfo.payer,
      vault,
      vaultStore,
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
    console.log(
      "orcaInvestment.a.mint: ",
      orcaInvestment.a.token.mint.toBase58()
    );
    console.log(
      "orcaInvestment.a.source: ",
      orcaInvestment.a.source.toBase58()
    );
    console.log("orcaInvestment.a.dest: ", orcaInvestment.a.dest.toBase58());
    console.log("maxAmountA: ", maxAmountA.toNumber());

    console.log(
      "orcaInvestment.b.mint: ",
      orcaInvestment.b.token.mint.toBase58()
    );
    console.log(
      "orcaInvestment.b.source: ",
      orcaInvestment.b.source.toBase58()
    );
    console.log("orcaInvestment.b.dest: ", orcaInvestment.b.dest.toBase58());
    console.log("maxAmountB: ", maxAmountB.toNumber());

    console.log(
      "orcaInvestment.poolToken.source: ",
      orcaInvestment.poolToken.source.toBase58()
    );
    console.log(
      "orcaInvestment.poolToken.mint: ",
      orcaInvestment.poolToken.mint.toBase58()
    );
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

    if (executeTransaction) {
      return this.vaultProgram.rpc.redeemOrca(
        amountTokenA as any,
        amountTokenB as any,
        {
          accounts: {
            payer: signerInfo.payer, // must be strategist
            authority: _vault.authority,
            globalProtocolState: globalStateAddr,
            vault,
            vaultStore,
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

  // ==========================================================================================================

  // todo: test this
  rebalanceOrca = async (
    vault: PublicKey,
    orcaSwapProgram: PublicKey,
    pair: string,
    payer: PublicKey | Keypair,
    executeTransaction: boolean = true,
    cluster: Cluster = DEVNET
  ): Promise<string> => {
    const signerInfo: SignerInfo = getSignersFromPayer(payer);
    const { addr: globalStateAddr } = await this.generateGlobalStateAddress();
    const { addr: vaultStore } = await this.generateVaultStoreAddress(vault);

    const _vault = await this.fetchVault(vault);

    const orca = getOrca(this.provider.connection, clusterToNetwork(cluster));
    const { pool, poolParams } = getOrcaPool(orca, pair);

    // todo: next vault, undo this :nervous:
    let rebalanceConfig = await getRebalanceConfig(pool, toIVault(_vault));
    if (!rebalanceConfig) {
      console.log("no rebalance needed, exiting");
      return "NaN";
    }

    console.log("swapConfig maxIn: ", rebalanceConfig.input.amount.toNumber());
    console.log(
      "swapConfig maxOut: ",
      rebalanceConfig.output.amount.toNumber()
    );
    console.log("swapConfig alphaToBeta: ", rebalanceConfig.alphaToBeta);

    // build src/dest user addresses
    let instructionData: InstructionData = initInstructionData();
    const sourceTokenAccount = await resolveAtaForPda(
      rebalanceConfig.input.mint,
      vaultStore,
      signerInfo.payer,
      this.provider.connection
    );
    instructionData = extendInstructionData(
      instructionData,
      sourceTokenAccount
    );

    const destTokenAccount = await resolveAtaForPda(
      rebalanceConfig.output.mint,
      vaultStore,
      signerInfo.payer,
      this.provider.connection
    );
    instructionData = extendInstructionData(instructionData, destTokenAccount);

    if (executeTransaction) {
      const _rebalanceConfig = {
        maxIn: rebalanceConfig.input.amount,
        maxOut: rebalanceConfig.output.amount,
        alphaToBeta: rebalanceConfig?.alphaToBeta,
      };
      console.log("_rebalanceConfig: ", _rebalanceConfig);

      return this.vaultProgram.rpc.rebalanceOrca(_rebalanceConfig as any, {
        accounts: {
          payer: signerInfo.payer,
          authority: _vault.authority,
          globalProtocolState: globalStateAddr,
          vault,
          vaultStore,
          strategy: _vault.strategy,
          orcaSwapProgram: orcaSwapProgram,
          orcaPool: poolParams.address,
          orcaAuthority: poolParams.authority,
          userSource: sourceTokenAccount.address,
          poolSource: rebalanceConfig.input.dest,
          userDestination: destTokenAccount.address,
          poolDestination: rebalanceConfig.output.dest,
          poolMint: poolParams.poolTokenMint,
          feeAccount: poolParams.feeAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
        preInstructions: instructionData.instructions,
        postInstructions: instructionData.cleanup,
        signers: [...signerInfo.signers, ...instructionData.signers],
      });
    }

    return "NaN";
  };

  // ==========================================================================================================

  // todo: withdraw directly from the vault_store
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
    const { addr: vaultStore } = await this.generateVaultStoreAddress(vault);

    const _vault = await this.fetchVault(vault);

    const lpAmount = await this.fetchTokenBalance(lp, signerInfo.payer);
    // check is also done on-chain, but we can pre-maturely prevent a failed transaction with this check.
    if (lpAmount === 0) {
      throw new Error(
        `Cannot withdraw without any LP tokens of mint ${lp.toBase58()}`
      );
    }
    const sourceLpAccount = await resolveAtaForDeposit(
      lp,
      signerInfo.payer,
      signerInfo.payer,
      this.provider.connection
    );

    // @dev: don't create ATA at the beginning or close at the end of the transaction,
    // related to vault
    const sourceTokenAccount = await resolveAtaForPda(
      mint,
      vaultStore,
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
      return this.vaultProgram.rpc.withdraw(amount as any, {
        accounts: {
          payer: signerInfo.payer,
          authority: _vault.authority,
          globalProtocolState: globalStateAddr,
          vault,
          vaultStore,
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
        // todo: can we close LP ATA after this?
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
    const { addr: vaultStore } = await this.generateVaultStoreAddress(vault);

    const _vault = await this.fetchVault(vault);
    console.log("_vault: ", _vault);

    const orca = getOrca(this.provider.connection, clusterToNetwork(cluster));
    const farmParams =
      farmType === OrcaFarmType.AQUAFARM
        ? getAquafarm(orca, pair)
        : getDoubleDipFarm(orca, pair);
    if (!farmParams) throw new Error("farm cannot be null");

    const farmData = await getFarmData(
      vaultStore,
      aquafarmProgram,
      farmParams,
      signerInfo.payer,
      this.provider.connection
    );

    const { instructions, cleanup, signers } = farmData.instructions;

    if (executeTransaction) {
      return this.vaultProgram.rpc.harvestOrca({
        accounts: {
          payer: signerInfo.payer,
          authority: _vault.authority,
          globalProtocolState: globalStateAddr,
          vault,
          vaultStore,
          strategy: _vault.strategy,
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
    const { addr: vaultStore } = await this.generateVaultStoreAddress(vault);

    const orca = getOrca(this.provider.connection, clusterToNetwork(cluster));
    const farmParams =
      farmType === OrcaFarmType.AQUAFARM
        ? getAquafarm(orca, pair)
        : getDoubleDipFarm(orca, pair);
    if (!farmParams) throw new Error("farm cannot be null");

    const vaultLp = await resolveAtaForPda(
      farmParams.baseTokenMint,
      vaultStore,
      signerInfo.payer,
      this.provider.connection
    );

    const farmData = await getFarmData(
      vaultStore,
      aquafarmProgram,
      farmParams,
      signerInfo.payer,
      this.provider.connection
    );

    const _vault = await this.fetchVault(vault);
    const { instructions, cleanup, signers } = farmData.instructions;
    if (executeTransaction) {
      return this.vaultProgram.rpc.convertOrcaLp({
        accounts: {
          payer: signerInfo.payer,
          authority: _vault.authority,
          globalProtocolState: globalStateAddr,
          vault,
          vaultStore,
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
    const { addr: vaultStore } = await this.generateVaultStoreAddress(vault);

    const orca = getOrca(this.provider.connection, clusterToNetwork(cluster));
    const farmParams =
      farmType === OrcaFarmType.AQUAFARM
        ? getAquafarm(orca, pair)
        : getDoubleDipFarm(orca, pair);
    if (!farmParams) throw new Error("farm cannot be null");

    const vaultLp = await resolveAtaForPda(
      farmParams.baseTokenMint,
      vaultStore,
      signerInfo.payer,
      this.provider.connection
    );

    const farmData = await getFarmData(
      vaultStore,
      aquafarmProgram,
      farmParams,
      signerInfo.payer,
      this.provider.connection
    );

    const _vault = await this.fetchVault(vault);
    const { instructions, cleanup, signers } = farmData.instructions;

    if (executeTransaction) {
      return this.vaultProgram.rpc.revertOrcaLp({
        accounts: {
          payer: signerInfo.payer,
          authority: _vault.authority,
          globalProtocolState: globalStateAddr,
          vault,
          vaultStore,
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
    const { addr: vaultStore } = await this.generateVaultStoreAddress(vault);

    const farmData = await getFarmData(
      vaultStore,
      aquafarmProgram,
      farmParams,
      signerInfo.payer,
      this.provider.connection
    );

    const _vault = await this.fetchVault(vault);
    if (executeTransaction) {
      return this.vaultProgram.rpc.initializeUserFarmOrca({
        accounts: {
          payer: signerInfo.payer,
          authority: _vault.authority,
          globalProtocolState: globalStateAddr,
          vault,
          vaultStore,
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
    const { addr: vaultStore } = await this.generateVaultStoreAddress(vault);

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

    const swapConfig = await getSwapConfig(
      inputPoolToken,
      amountInU64,
      outputPoolToken,
      vaultStore, // swap authority
      signerInfo.payer,
      this.provider.connection
    );

    const _vault = await this.fetchVault(vault);
    if (executeTransaction) {
      return this.vaultProgram.rpc.swapOrca(
        amountInU64 as any,
        minimumAmountOutU64 as any,
        {
          accounts: {
            payer: signerInfo.payer,
            authority: _vault.authority,
            globalProtocolState: globalStateAddr,
            vault,
            vaultStore,
            strategy: _vault.strategy,
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

// todo: for ANYTHING that goes wrong, check here almost first
export const generatePoolConfigForVault = async (
  client: VaultClient,
  payer: PublicKey,
  vault: PublicKey,
  vaultStore: PublicKey,
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
    console.log("a is alpha, b is beta");
    const vaultTokenA = await resolveAtaForPda(
      poolTokenA.mint,
      vaultStore,
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

    const vaultTokenB = await resolveAtaForPda(
      poolTokenB.mint,
      vaultStore,
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
    console.log("a is beta, b is alpha");
    const vaultTokenA = await resolveAtaForPda(
      poolTokenB.mint,
      vaultStore,
      payer,
      client.provider.connection
    );
    instructionData = extendInstructionData(instructionData, vaultTokenA);

    const vaultTokenB = await resolveAtaForPda(
      poolTokenA.mint,
      vaultStore,
      payer,
      client.provider.connection
    );
    instructionData = extendInstructionData(instructionData, vaultTokenB);

    // everything for pool is A -> A, B -> B // vault is B -> A, A -> B
    sideA = {
      token: poolTokenA,
      amountDecimal: beta,
      source: vaultTokenB.address,
      dest: poolTokenA.addr,
    };

    sideB = {
      token: poolTokenB,
      amountDecimal: alpha,
      source: vaultTokenA.address,
      dest: poolTokenB.addr,
    };
  } else {
    throw new Error("Pool tokens don't match vault tranches");
  }

  // normal ATA
  const vaultLp = await resolveAtaForPda(
    poolTokenMint,
    vaultStore,
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
    const withdrawTokenAmount = await pool.getLPBalance(vaultStore); // in this case, the vault owns the LP
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

// todo: toVaultMeta, toOrcaPool
export const getRebalanceConfig = async (
  pool: OrcaPool,
  vault: IVault,
  iterationDeltaBps: number = 1 // bips
): Promise<RebalanceConfig | null> => {
  const trancheTokens = getTrancheAsOrcaTokens(vault, pool);
  console.log("alpha tranche scale: ", trancheTokens.alpha.scale);
  console.log("beta tranche scale: ", trancheTokens.beta.scale);

  const redeemableAlpha = vault.alpha.received.toNumber();
  const redeemableBeta = vault.beta.received.toNumber();

  if (redeemableAlpha === 0 && redeemableBeta === 0) {
    console.log("Both redeemable values cannot be 0");
    return null;
  }
  console.log("redeemableAlpha: ", redeemableAlpha);
  console.log("redeemableBeta: ", redeemableBeta);

  const fixedRateDecimal = fixedRateToDecimal(vault.fixedRate);
  console.log("vault.fixedRate: ", vault.fixedRate);
  console.log("fixedRateDecimal: ", fixedRateDecimal);

  // form => amount * 10 ** decimals
  const requiredAlpha =
    vault.alpha.invested.toNumber() * (1 + fixedRateDecimal);
  console.log("requiredAlpha: ", requiredAlpha);

  if (redeemableAlpha < requiredAlpha) {
    console.log("redeemableAlpha < requiredAlpha");

    // swap beta for alpha; we need to make alpha tranche whole since it's senior
    // we can use swapAmount input/output ratio to back into approximate input for output
    // including slippage and fees. aka how much of beta we need to convert to alpha.
    // otherwise, we could reverse engineer the getQuote function, but this might be just
    // as effective?
    const remainingA = requiredAlpha - redeemableAlpha;
    const remainingA_OrcaU64 = toOrcaU64(remainingA, trancheTokens.alpha);

    // get a rough estimate on the swap conversion between A & B, use that to close in on B -> reqired(A)
    let seedSwap = await getAmountsForSwap(
      pool,
      trancheTokens.alpha,
      remainingA_OrcaU64
    );
    // initial swap lossy due to fee calculations; initial buffer will help us hone in on target value faster.
    let input = seedSwap.output.toNumber() * 1.005;

    // we require at least remainingA to make alpha tranche whole; look in range of [requiredFloor, acceptableUpper)
    const requiredFloor = remainingA;
    const acceptableUpper = remainingA * 1.01;
    console.log(
      "requiredFloor: ",
      requiredFloor,
      ", acceptableUpper: ",
      acceptableUpper
    );

    // todo: add type with defaults?
    let swapEstimate: any;
    let foundValidSwap = false;
    for (let i = 0; i < 1000; i++) {
      console.log("input: ", input);
      swapEstimate = await getAmountsForSwap(
        pool,
        trancheTokens.beta,
        scaleToOrcaU64(input, trancheTokens.beta)
      );
      console.log("swapEstimate: ", swapEstimate);

      const _output =
        swapEstimate.output.toNumber() * 10 ** trancheTokens.alpha.scale;
      if (_output < requiredFloor) {
        console.log("output too low");
        input = input * (1 + iterationDeltaBps / 10_000);
      } else if (_output > acceptableUpper) {
        console.log("output too high");
        input = input * (1 - iterationDeltaBps / 10_000);
      } else {
        console.log(`found acceptable output ${_output} in ${i} iterations`);
        foundValidSwap = true;
        break;
      }
    }

    if (!foundValidSwap) throw new Error("never found valid swap");

    return {
      input: {
        amount: U64Utils.toTokenU64(
          swapEstimate.input,
          trancheTokens.beta,
          "outputAmount"
        ),
        mint: trancheTokens.beta.mint,
        dest: trancheTokens.beta.addr,
      },
      // maxIn: U64Utils.toTokenU64(
      //   swapEstimate.input,
      //   trancheTokens.beta,
      //   "inputAmount"
      // ),
      output: {
        amount: U64Utils.toTokenU64(
          swapEstimate.output,
          trancheTokens.alpha,
          "inputAmount"
        ),
        mint: trancheTokens.alpha.mint,
        dest: trancheTokens.alpha.addr,
      },
      // maxOut: U64Utils.toTokenU64(
      //   swapEstimate.output,
      //   trancheTokens.alpha,
      //   "outputAmount"
      // ),
      alphaToBeta: false,
    };
  } else if (redeemableAlpha > requiredAlpha) {
    console.log("redeemableAlpha > requiredAlpha");
    // swap alpha for beta
    const residualA = redeemableAlpha - requiredAlpha;
    console.log("residualA: ", residualA);

    const swapEstimate = await getAmountsForSwap(
      pool,
      trancheTokens.alpha,
      scaleToOrcaU64(residualA, trancheTokens.alpha)
    );
    console.log("swapEstimate: ", swapEstimate);

    return {
      input: {
        amount: U64Utils.toTokenU64(
          swapEstimate.input,
          trancheTokens.alpha,
          "inputAmount"
        ),
        mint: trancheTokens.alpha.mint,
        dest: trancheTokens.alpha.addr,
      },
      output: {
        amount: U64Utils.toTokenU64(
          swapEstimate.output,
          trancheTokens.beta,
          "outputAmount"
        ),
        mint: trancheTokens.beta.mint,
        dest: trancheTokens.beta.addr,
      },
      alphaToBeta: true,
    };
  } else {
    // do nothing
    return null;
  }
};

export interface RebalanceConfig {
  input: SwapConfigForTranche;
  output: SwapConfigForTranche;
  alphaToBeta: boolean;
}

export interface SwapConfigForTranche {
  amount: u64;
  mint: PublicKey;
  // source: PublicKey;
  dest: PublicKey;
}
