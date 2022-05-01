use crate::{constant::VAULT_SEED, error::ErrorCode};

// todo: does this work?
macro_rules! generate_vault_seeds {
    ($a:expr, $b:expr) => {{
        &[VAULT_SEED.as_bytes(), $a.as_ref(), &[$b]]
    }};
}

macro_rules! math_error {
    () => {{
        || {
            let error_code = ErrorCode::MathError;
            msg!("Error {} thrown at {}:{}", error_code, file!(), line!());
            error_code
        }
    }};
}
