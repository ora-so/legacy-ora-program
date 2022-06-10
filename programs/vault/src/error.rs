use anchor_lang::prelude::*;

pub type OraResult<T = ()> = std::result::Result<T, ProgramError>;

#[error]
pub enum ErrorCode {
    #[msg("Protocol pausesd")]
    ProtocolPaused,

    #[msg("Math Error")]
    MathError,
    #[msg("PublicKeyMismatch")]
    PublicKeyMismatch,
    #[msg("BumpMismatch")]
    BumpMismatch,
    #[msg("InvalidMintAuthority")]
    InvalidMintAuthority,
    #[msg("UninitializedAccount")]
    UninitializedAccount,
    #[msg("AlreadyInitializedAccount")]
    AlreadyInitializedAccount,
    #[msg("IncorrectOwner")]
    IncorrectOwner,
    #[msg("PublicKeysShouldBeUnique")]
    PublicKeysShouldBeUnique,
    #[msg("AccountAlreadyInitialized")]
    AccountAlreadyInitialized,
    #[msg("Insufficient token balance")]
    InsufficientTokenBalance,
    #[msg("Impossible token ratio request")]
    ImpossibleTokenRatioRequested,

    #[msg("Invalid state transition")]
    InvalidStateTransition,
    #[msg("Missing transition at time for state")]
    MissingTransitionAtTimeForState,
    #[msg("Vault has no deposits")]
    VaultHasNoDeposits,
    #[msg("Invalid deposit for vault")]
    InvalidDepositForVault,

    #[msg("Wrong account owner")]
    WrongAccountOwner,
    #[msg("Invalid account data")]
    InvalidAccountData,
    #[msg("Invalid strategy flag")]
    InvalidStrategyFlag,
    #[msg("Strategy already exists")]
    StrategyAlreadyExists,

    #[msg("Invalid vault state")]
    InvalidVaultState,
    #[msg("Invalid vault store")]
    InvalidVaultStore,
    #[msg("Non-existent Asset")]
    NonexistentAsset,
    #[msg("Invalid LP Mint")]
    InvalidLpMint,
    #[msg("Deposit exceeds user cap")]
    DepositExceedsUserCap,
    #[msg("Asset cap exceeded")]
    AssetCapExceeded,
    #[msg("Cannot redeem without LP tokens")]
    CannotWithdrawWithoutLpTokens,

    #[msg("Data type mismatch")]
    DataTypeMismatch,
    #[msg("Slippage too high")]
    SlippageTooHigh,

    #[msg("Dual-sided excesss is not possible")]
    DualSidedExcesssNotPossible,

    #[msg("Derived key invalid")]
    DerivedKeyInvalid,

    #[msg("Invalid remaining accounts index")]
    InvalidRemainingAccountsIndex,

    #[msg("Missing required field")]
    MissingRequiredField,
    #[msg("Missing required config")]
    MissingRequiredConfig,
    #[msg("Unexpected authority")]
    UnexpectedAuthority,
    #[msg("Decimal mismatch")]
    DecimalMismatch,
    #[msg("Already claimed LP tokens")]
    AlreadyClaimedLpTokens,

    #[msg("Unable to write to remaining account")]
    UnableToWriteToRemainingAccount,
    #[msg("Expected non-zero returns")]
    ExpectedNonzeroReturns,
}
