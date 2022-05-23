use crate::{
    constant::{GLOBAL_STATE_SEED, HISTORY_SEED, VAULT_SEED},
    error::ErrorCode,
    state::{vault::Vault, GlobalProtocolState, History},
    util::{mint_with_verified_ata, transfer_with_verified_ata},
};
use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

#[derive(Accounts)]
#[instruction(deposit_index: u64)]
pub struct Claim<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: read-only account to validate vault address
    pub authority: UncheckedAccount<'info>,

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

    #[account(
        mut,
        seeds = [
            HISTORY_SEED.as_bytes(),
            vault.key().to_bytes().as_ref(),
            mint.key().to_bytes().as_ref(),
            payer.key().to_bytes().as_ref(),
        ],
        bump,
    )]
    pub history: Box<Account<'info, History>>,

    pub mint: Box<Account<'info, Mint>>,

    #[account(mut)]
    pub lp: Box<Account<'info, Mint>>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = vault,
    )]
    pub source_ata: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = payer,
    )]
    pub destination_ata: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        associated_token::mint = lp,
        associated_token::authority = payer,
    )]
    pub destination_lp_ata: Box<Account<'info, TokenAccount>>,

    /// =============== PROGRAM ACCOUNTS ===============
    pub system_program: Program<'info, System>,

    pub token_program: Program<'info, Token>,

    /// CHECK: validate expected vs actual address
    #[account(address = spl_associated_token_account::ID)]
    pub ata_program: UncheckedAccount<'info>,

    pub rent: Sysvar<'info, Rent>,
}

/// After the vault's funds are invested, there is a chance one side of the vault will have excess funds
/// that were not invested. This instruction will do two things:
///
///   - return excess funds
///   - mint a proportional number of LP tokens representing a position in the vault's tranche's invested
///     assets. This is a tokenized position that allows the depositor to leverage across the ecosystem.
///     These LP tokens will also be referenced when a user decides to withdraw assets from the vault.
///
/// This instruction can only be invoked after the funds are invested and the claims are processed.
///
pub fn handle(ctx: Context<Claim>) -> ProgramResult {
    require!(
        ctx.accounts.vault.can_users_claim(),
        ErrorCode::InvalidVaultState
    );

    // verify mint and lp from vault vs instruction accounts
    let asset = ctx.accounts.vault.get_asset(&ctx.accounts.mint.key())?;
    require!(ctx.accounts.lp.key() == asset.lp, ErrorCode::InvalidLpMint);

    let claim_amount = ctx.accounts.history.claim;
    let deposit_amount = ctx.accounts.history.cumulative;
    let lp_amount = deposit_amount
        .checked_sub(claim_amount)
        .ok_or_else(math_error!())?;

    let authority = ctx.accounts.authority.key();
    let vault_signer_seeds = generate_vault_seeds!(authority.as_ref(), ctx.accounts.vault.bump);

    if claim_amount > 0 {
        transfer_with_verified_ata(
            ctx.accounts.source_ata.to_account_info(),
            ctx.accounts.destination_ata.to_account_info(),
            ctx.accounts.payer.to_account_info(),
            ctx.accounts.mint.to_account_info(),
            ctx.accounts.payer.to_account_info(),
            ctx.accounts.ata_program.to_account_info(),
            ctx.accounts.token_program.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
            ctx.accounts.rent.to_account_info(),
            &[],
            ctx.accounts.vault.to_account_info(),
            vault_signer_seeds, // todo: does this work?
            claim_amount,
        )?;
    }

    // mint LP (SPL token) to user relative to the deposited amount to represent their position
    if lp_amount > 0 {
        mint_with_verified_ata(
            ctx.accounts.destination_lp_ata.to_account_info(),
            ctx.accounts.payer.to_account_info(),
            ctx.accounts.lp.to_account_info(),
            ctx.accounts.payer.to_account_info(),
            ctx.accounts.ata_program.to_account_info(),
            ctx.accounts.token_program.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
            ctx.accounts.rent.to_account_info(),
            &[],
            ctx.accounts.vault.to_account_info(),
            vault_signer_seeds,
            lp_amount, // 1-1 asset to LP amount
        )?;
    }

    Ok(())
}
