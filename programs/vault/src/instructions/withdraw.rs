use crate::{
    constant::{GLOBAL_STATE_SEED, VAULT_SEED},
    error::ErrorCode,
    state::vault::State,
    state::{vault::Vault, GlobalProtocolState},
    util::transfer_with_verified_ata,
};

use anchor_lang::prelude::*;
use anchor_spl::token::{burn, Burn};
use anchor_spl::token::{Mint, Token, TokenAccount};

#[derive(Accounts)]
#[instruction(amount: u64)]
pub struct Withdraw<'info> {
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

    #[account(mut)]
    pub mint: Box<Account<'info, Mint>>,

    #[account(mut)]
    pub lp: Box<Account<'info, Mint>>,

    #[account(mut)]
    pub source_lp: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = vault,
        constraint = source_ata.amount >= amount
    )]
    pub source_ata: Account<'info, TokenAccount>,

    /// CHECK: create and validate JIT in instruction
    #[account(mut)]
    pub destination_ata: UncheckedAccount<'info>,

    /// =============== PROGRAM ACCOUNTS ===============
    pub system_program: Program<'info, System>,

    pub token_program: Program<'info, Token>,

    /// CHECK: validate expected vs actual address
    #[account(address = spl_associated_token_account::ID)]
    pub ata_program: UncheckedAccount<'info>,

    pub rent: Sysvar<'info, Rent>,
}

#[repr(C)]
#[derive(AnchorSerialize, AnchorDeserialize, Debug, Default, PartialEq)]
pub struct WithdrawConfig {
    pub amount: Option<u64>,
}

/// Anyone with a specific tranche's LP token can burn the LP for the underlying collateral.
/// By the time someone can initiate a withdrawal, we assume the vault's assets are balanced
/// and use a ratio of LP supply + current token account balance to determine the number of
/// underlying assets someone is entitled to.
///
/// optionally specify amount to withdraw. otherwise, default is to exchange LP tokens for underlying
/// assets.
///
/// todo
/// @dev include extra variable saying whether funds have been balanced? we want to prevent people
///      from rugging themselves.
///        - 1 option is looking at the balance of the senior tranche's ATA & comparing amount invested
///          vs current amount. if the current amount < invested + amount from yield, we shouldn't let
///          people withdraw yet.
///        - the simplest is including a swap in the redeem function itself
///
/// todo
/// @dev model out different scenarios for returns, yields and distributions. make sure is correct.
///
/// feat:
///   - determine if withdrawal is valid (mint for vault, state of vault, etc)
///   - update any vault state (num withdrawals, user claimed funds, etc)
///   - issue receipt / burn SPL token(s) representing user's position in the vault?
///
///
pub fn handle(ctx: Context<Withdraw>, amount: u64) -> ProgramResult {
    let num_lp_tokens_for_payer = ctx.accounts.source_lp.amount;
    ctx.accounts.vault.try_transition()?;
    require!(
        ctx.accounts.vault.state == State::Withdraw,
        ErrorCode::InvalidVaultState
    );

    // it is not possible to withdraw funds if they have not been redeemed
    require!(
        ctx.accounts.vault.alpha.received > 0 || ctx.accounts.vault.beta.received > 0,
        ErrorCode::InvalidVaultState
    );

    let asset = ctx.accounts.vault.get_asset(&ctx.accounts.mint.key())?;
    require!(ctx.accounts.lp.key() == asset.lp, ErrorCode::InvalidLpMint);
    // regardless of amount requested, you cannot make a withdrawal without LP tokens
    require!(
        num_lp_tokens_for_payer == 0,
        ErrorCode::CannotWithdrawWithoutLpTokens
    );

    let lp_amount = match amount {
        amount if amount > 0 => amount,
        _ => num_lp_tokens_for_payer,
    };
    burn(ctx.accounts.into_burn_reserve_token_context(), lp_amount)?;

    // assets per lp * lp
    let asset_per_lp = ctx
        .accounts
        .source_ata
        .amount
        .checked_div(ctx.accounts.lp.supply)
        .ok_or_else(math_error!())?
        .checked_mul(ctx.accounts.source_lp.amount)
        .ok_or_else(math_error!())?;

    let authority = ctx.accounts.authority.key();
    let vault_signer_seeds = generate_vault_seeds!(authority.as_ref(), ctx.accounts.vault.bump);

    /*
     * todo: if user has excess deposit to claim, we have two options
     *
     * - change this ixn to account for the extra. in this case, we can
     *   add both instructions to a single transaction.
     * - create a new ixn to handle the claim specifically
     */
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
        vault_signer_seeds,
        asset_per_lp,
    )?;

    Ok(())
}

impl<'info> Withdraw<'info> {
    pub fn into_burn_reserve_token_context(&self) -> CpiContext<'_, '_, '_, 'info, Burn<'info>> {
        let cpi_program = self.token_program.to_account_info();

        let cpi_accounts = Burn {
            /// lp mint
            mint: self.lp.to_account_info(),
            /// payer ATA for lp mint
            to: self.source_lp.to_account_info(),
            /// payer redeeming burning tokens in exchange for deposits + returns
            authority: self.payer.to_account_info(),
        };

        CpiContext::new(cpi_program, cpi_accounts)
    }
}
