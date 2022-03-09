use anchor_lang::prelude::*;

#[error]
pub enum ErrorCode {
    #[msg("Insufficient token balance")]
    InsufficientTokenBalance,
    #[msg("Impossible token ratio request")]
    ImpossibleTokenRatioRequested,
    #[msg("Math Error")]
    MathError,
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
