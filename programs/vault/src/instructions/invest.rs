use crate::{
    error::{ErrorCode, OraResult},
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
    require!(
        ctx.accounts.vault().state() == State::Live,
        ErrorCode::InvalidVaultState
    );
    msg!("vault state verified");

    // no matter how many times the authority calls this instruction when the vault has 1 tranche with 0 deposits,
    // we will set invested = 0 and excess = deposited on both sides so that we can process claims correctly.
    // this will then allow people to withdraw funds.
    if !ctx.accounts.vault().has_dual_deposits() {
        msg!("1 tranche has no deposits");

        let mutable_vault = ctx.accounts.vault_mut();
        mutable_vault.get_alpha_mut()?.make_investment(0)?;
        mutable_vault.get_beta_mut()?.make_investment(0)?;

        return Ok(());
    }

    // both sides of the vault must have deposits in order to inveest
    msg!("verified deposits are on both sides");

    // todo: rename; beta is junior, alpha is senior
    let (invested_alpha, invested_beta) =
        ctx.accounts
            .invest(investable_a, investable_b, min_tokens_back)?;

    msg!(
        "invested alpha: {}, invested beta: {}",
        invested_alpha,
        invested_beta
    );

    Ok(())
}
