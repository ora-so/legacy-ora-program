use crate::{constant::GLOBAL_STATE_SEED, state::GlobalProtocolState};
use anchor_lang::prelude::*;
use std::mem::size_of;

#[derive(Accounts)]
pub struct InitializeGlobalProtocolState<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        seeds = [GLOBAL_STATE_SEED.as_bytes()],
        bump,
        payer = authority,
        space = 8 + size_of::<GlobalProtocolState>(),
    )]
    pub global_protocol_state: Box<Account<'info, GlobalProtocolState>>,

    /// CHECK: read-only account to validate vault address
    pub treasury: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,

    pub rent: Sysvar<'info, Rent>,
}

/// Initialize the global protocol state. This account will store metadata related to
/// global protocol operations. Namely,
///   - the authority here will be able to manage various strategies used by different vaults
///   - pause the protocol during turbulent chain and/or market conditions, etc.
///   - specify the fee and treasury accounts for the protocol
///
pub fn handle(ctx: Context<InitializeGlobalProtocolState>, bump: u8) -> ProgramResult {
    ctx.accounts.global_protocol_state.init(
        bump,
        ctx.accounts.authority.key(),
        ctx.accounts.treasury.key(),
    );

    Ok(())
}
