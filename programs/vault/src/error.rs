use anchor_lang::prelude::*;

#[error]
pub enum ErrorCode {
    #[msg("Base vault error")]
    BaseVaultError,
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
