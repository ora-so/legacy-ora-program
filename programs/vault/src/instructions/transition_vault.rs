use crate::{
    constant::{GLOBAL_STATE_SEED, VAULT_SEED},
    state::{vault::Vault, GlobalProtocolState},
};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct TransitionVault<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        seeds = [GLOBAL_STATE_SEED.as_bytes()],
        bump,
    )]
    pub global_protocol_state: Box<Account<'info, GlobalProtocolState>>,

    #[account(
     mut,
     seeds = [
        VAULT_SEED.as_bytes(),
        authority.key().to_bytes().as_ref()
     ],
     bump,
     constraint = vault.authority == authority.key(),
 )]
    pub vault: Box<Account<'info, Vault>>,
}

pub fn handle(
    ctx: Context<TransitionVault>,
    target_state: String,
    timestamp: u64,
) -> ProgramResult {
    ctx.accounts.vault.transition(target_state, timestamp)?;

    Ok(())
}
