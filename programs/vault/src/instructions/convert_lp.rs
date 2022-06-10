use crate::{
    error::ErrorCode,
    state::{HasVault, State},
};
use anchor_lang::prelude::*;

pub trait Converter<'info> {
    fn convert_lp(&mut self, amount: Option<u64>) -> ProgramResult;
}

pub fn handle<'info, T: Converter<'info> + HasVault>(
    ctx: Context<'_, '_, '_, 'info, T>,
    amount: Option<u64>,
) -> ProgramResult {
    require!(
        ctx.accounts.vault().state() == State::Live,
        ErrorCode::InvalidVaultState
    );

    ctx.accounts.convert_lp(amount)
}
