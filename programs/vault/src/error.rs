use anchor_lang::prelude::*;

pub type OraResult<T = ()> = std::result::Result<T, ProgramError>;

#[error]
pub enum ErrorCode {
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
    #[msg("Non-existent Asset")]
    NonexistentAsset,
    #[msg("Invalid LP Mint")]
    InvalidLpMint,
    #[msg("Deposit exceeds user cap")]
    DepositExceedsUserCap,
    #[msg("Deposit exceeds asset cap")]
    DepositExceedsAssetCap,
    #[msg("Cannot redeem without LP tokens")]
    CannotWithdrawWithoutLpTokens,

    #[msg("Data type mismatch")]
    DataTypeMismatch,
    #[msg("Slippage too high")]
    SlippageTooHigh,

    #[msg("Dual-sided excesss is not possible")]
    DualSidedExcesssNotPossible,
}
