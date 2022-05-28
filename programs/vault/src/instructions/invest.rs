use crate::{
    error::{OraResult, ErrorCode},
    state::{HasVault, State},
};
use anchor_lang::prelude::*;

pub trait Invest<'info> {
    /// Given the total available amounts of senior and junior assets. We will invest as much as
    /// possible and record any uninvested assets.
    ///
    /// @dev Because this functionality is can only be invoked by a particular keypair, we allow
    ///      to decide how much of each asset is invested.
    ///
    fn invest(&mut self, amount_a: u64, amount_b: u64, min_out: u64) -> OraResult<(u64, u64)>;
}

pub fn handle<'info, T: Invest<'info> + HasVault>(
    ctx: Context<'_, '_, '_, 'info, T>,
    investable_a: u64,
    investable_b: u64,
    min_tokens_back: u64,
) -> ProgramResult {
    ctx.accounts.vault_mut().try_transition()?;
    msg!("transitioning");
    require!(
        ctx.accounts.vault().state() == State::Live,
        ErrorCode::InvalidVaultState
    );
    msg!("transitioned");

    // both sides of the vault must have deposits in order to inevst
    require!(
        ctx.accounts.vault().has_deposits(),
        ErrorCode::VaultHasNoDeposits
    );
    msg!("verified deposits");

    // todo: rename; beta is junior, alpha is senior
    let (invested_alpha, invested_beta) = ctx.accounts
        .invest(investable_a, investable_b, min_tokens_back)?;

    msg!("invested alpha: {}, invested beta: {}", invested_alpha, invested_beta);

    Ok(())
}
