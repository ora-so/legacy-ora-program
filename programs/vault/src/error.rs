use anchor_lang::prelude::*;

pub type OraResult<T = ()> = std::result::Result<T, ProgramError>;

#[error]
pub enum ErrorCode {
    #[msg("PublicKeyMismatch")] // 0
    PublicKeyMismatch,
    #[msg("InvalidMintAuthority")] // 1
    InvalidMintAuthority,
    #[msg("UninitializedAccount")] // 2
    UninitializedAccount,
    #[msg("IncorrectOwner")] // 3
    IncorrectOwner,
    #[msg("PublicKeysShouldBeUnique")] // 4
    PublicKeysShouldBeUnique,
    #[msg("StatementFalse")] // 5
    StatementFalse,
    #[msg("Math Error")]
    MathError,
    #[msg("Insufficient token balance")]
    InsufficientTokenBalance,
    #[msg("Impossible token ratio request")]
    ImpossibleTokenRatioRequested,

    #[msg("Invalid state transition")]
    InvalidStateTransition,
    #[msg("Missing transition at time for state")]
    MissingTransitionAtTimeForState,

    #[msg("Wrong account owner")]
    WrongAccountOwner,
    #[msg("Invalid account data")]
    InvalidAccountData,
    #[msg("Invalid strategy flag")]
    InvalidStrategyFlag,

    #[msg("Invalid vault state")]
    InvalidVaultState,
}

#[macro_export]
macro_rules! math_error {
    () => {{
        || {
            let error_code = ErrorCode::MathError;
            msg!("Error {} thrown at {}:{}", error_code, file!(), line!());
            error_code
        }
    }};
}
