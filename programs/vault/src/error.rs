use anchor_lang::prelude::*;

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
