macro_rules! generate_vault_seeds {
    ($a:expr, $b:expr) => {{
        &[VAULT_SEED.as_bytes(), $a.as_ref(), &[$b]]
    }};
}

macro_rules! generate_vault_store_seeds {
    ($a:expr, $b:expr) => {{
        &[VAULT_STORE_SEED.as_bytes(), $a.as_ref(), &[$b]]
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

// TODO make this a custom derive procmacro
macro_rules! impl_has_vault {
    ($($t:ty),+ $(,)?) => ($(
        impl HasVault for $t {
            fn vault(&self) -> &Vault {
                self.vault.deref()
            }

            fn vault_mut(&mut self) -> &mut Vault {
                self.vault.deref_mut()
            }
        }
    )+)
}
