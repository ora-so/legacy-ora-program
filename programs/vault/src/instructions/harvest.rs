use crate::{
    error::ErrorCode,
    state::{HasVault, State},
};
use anchor_lang::prelude::*;

pub trait Harvester<'info> {
    fn harvest(&mut self, bump: u8, amount: Option<u64>) -> ProgramResult;
}

pub fn handle<'info, T: Harvester<'info> + HasVault>(
    ctx: Context<'_, '_, '_, 'info, T>,
    bump: u8,
    amount: Option<u64>,
) -> ProgramResult {
    ctx.accounts.vault_mut().try_transition()?;
    require!(
        ctx.accounts.vault().state() == State::Live,
        ErrorCode::InvalidVaultState
    );

    ctx.accounts.harvest(bump, amount)?;

    Ok(())
}
