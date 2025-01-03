use crate::{
    constant::{GLOBAL_STATE_SEED, VAULT_SEED, VAULT_STORE_SEED},
    error::{ErrorCode, OraResult},
    state::vault::State,
    state::{vault::Vault, GlobalProtocolState},
    util::spl_token_transfer,
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

    /// CHECK: manually initialized PDA; verified in instruction
    #[account(mut)]
    pub vault_store: UncheckedAccount<'info>,

    #[account(mut)]
    pub mint: Box<Account<'info, Mint>>,

    #[account(mut)]
    pub lp: Box<Account<'info, Mint>>,

    #[account(mut)]
    pub source_lp: Box<Account<'info, TokenAccount>>,

    /// CHECK: can be wrapped wSOL, so not a TokenAccount. Validation done via Token Program CPI.
    #[account(mut)]
    pub source_ata: UncheckedAccount<'info>,

    /// CHECK: can be wrapped wSOL, so not a TokenAccount. Validation done via Token Program CPI.
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

/// Anyone with a specific tranche's LP token can burn the LP for the underlying collateral.
/// By the time someone can initiate a withdrawal, we assume the vault's assets are balanced
/// and use a ratio of LP supply + current token account balance to determine the number of
/// underlying assets someone is entitled to.
///
/// optionally specify amount to withdraw. otherwise, default is to exchange LP tokens for underlying
/// assets.
///
/// @dev users MUST call claim before withdraw in order to (1) claim deposited assets not invested
///      and (2) receive LP tokens to burn when actually withdrawing liquidity from the vault.
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
    ctx.accounts.vault.try_transition()?;
    msg!("vault state: {:?}", ctx.accounts.vault.state);

    // requires (alpha|beta).received to be > 0
    require!(
        ctx.accounts.vault.state == State::Withdraw,
        ErrorCode::InvalidVaultState
    );
    msg!("vault state verified");

    let asset = ctx.accounts.vault.get_asset(&ctx.accounts.mint.key())?;
    msg!("asset: {:?}", asset);
    msg!("asset.lp: {:?}", asset.lp);
    msg!("ctx.accounts.lp.key(): {:?}", ctx.accounts.lp.key());

    let num_lp_tokens_for_payer = ctx.accounts.source_lp.amount;
    msg!("num_lp_tokens_for_payer: {}", num_lp_tokens_for_payer);

    // you cannot make a withdrawal without valid LP tokens
    require!(ctx.accounts.lp.key() == asset.lp, ErrorCode::InvalidLpMint);
    require!(
        num_lp_tokens_for_payer > 0,
        ErrorCode::CannotWithdrawWithoutLpTokens
    );

    // default to withdrawing all LP tokens if none are specified
    let lp_amount = match amount {
        amount if amount > 0 => amount,
        _ => num_lp_tokens_for_payer,
    };
    msg!("lp_amount: {}", lp_amount);
    burn(ctx.accounts.into_burn_reserve_token_context(), lp_amount)?;

    msg!("{:?} received for asset {:?}", asset.received, asset.mint);

    // @dev we cannot use `ctx.accounts.lp.supply` because it's possible not all LP tokens have been minted (during claim instruction).
    //      instead we can use `vault.invested` since (1) tranche tokens and assets have the same decimals and (2) are minted at a 1-1 rate.
    msg!("ctx.accounts.lp.supply: {}", ctx.accounts.lp.supply);
    msg!("asset.invested: {}", asset.invested);

    let withdrawal_amount = compute_withdrawal_amount(
        asset.received,
        asset.invested,
        lp_amount,
        ctx.accounts.lp.decimals,
    )?;

    let vault_key = ctx.accounts.vault.key();
    let vault_store_signer_seeds =
        generate_vault_store_seeds!(*vault_key.as_ref(), ctx.accounts.vault.vault_store_bump);

    spl_token_transfer(
        ctx.accounts.token_program.to_account_info(),
        ctx.accounts.source_ata.to_account_info(),
        ctx.accounts.destination_ata.to_account_info(),
        ctx.accounts.vault_store.to_account_info(),
        &[vault_store_signer_seeds],
        withdrawal_amount,
    )?;

    Ok(())
}

/// Compute a user's withdrawal amount based on the amount received in the tranche,
/// the total supply of tranche tokens, and the users share of those tokens.
///
/// @dev assumption is that mint & lp decimals are equal. this is enforced on vault
///      creation
///
/// @dev formula is computing NUM_ASSETS_PER_LP * NUM_LP, adjusted for the tokens'
///      decimals to maintain precision in calculations. more succintly,
///      amount = (((received * 10^decimals) / supply) * share) / 10^decimals,
///      where supply = invested = total LP based on amount invested
///
pub fn compute_withdrawal_amount(
    received: u64,
    supply: u64,
    share: u64,
    decimals: u8,
) -> OraResult<u64> {
    let received_extended: u128 = received as u128;

    msg!("decimals: {:?}", decimals);
    msg!("received_extended: {:?}", received_extended);

    let decimal_multiplier = 10u128
        .checked_pow(decimals as u32)
        .ok_or_else(math_error!())?;
    msg!("decimal_multiplier: {:?}", decimal_multiplier);

    let received_padded: u128 = received_extended
        .checked_mul(decimal_multiplier)
        .ok_or_else(math_error!())?;

    msg!("received_padded: {:?}", received_padded);

    let asset_per_lp: u128 = received_padded
        .checked_div(supply as u128)
        .ok_or_else(math_error!())?;
    msg!("asset_per_lp: {:?}", asset_per_lp);

    let assets_to_withdraw_padded: u128 = asset_per_lp
        .checked_mul(share as u128)
        .ok_or_else(math_error!())?;
    msg!("assets_to_withdraw_padded: {:?}", assets_to_withdraw_padded);

    let assets_to_withdraw: u128 = assets_to_withdraw_padded
        .checked_div(decimal_multiplier)
        .ok_or_else(math_error!())?;
    msg!("assets_to_withdraw: {:?}", assets_to_withdraw);

    Ok(assets_to_withdraw as u64)
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
