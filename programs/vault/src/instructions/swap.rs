use crate::{error::ErrorCode, state::HasVault};
use anchor_lang::prelude::*;

pub trait Swapper<'info> {
    fn swap(&mut self, bump: u8, amount_in: u64, min_amount_out: u64) -> ProgramResult;
}

pub fn handle<'info, T: Swapper<'info> + HasVault>(
    ctx: Context<'_, '_, '_, 'info, T>,
    bump: u8,
    amount_in: u64,
    min_amount_out: u64,
) -> ProgramResult {
    require!(
        ctx.accounts.vault().can_perform_swap(),
        ErrorCode::InvalidVaultState
    );

    ctx.accounts.swap(bump, amount_in, min_amount_out)
}
