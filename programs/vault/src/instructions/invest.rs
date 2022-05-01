use {
    crate::{
        context::Invest,
        error::ErrorCode,
        state::{
            asset::Asset,
            strategy::{Strategy, StrategyActions},
            vault::State,
        },
    },
    anchor_lang::prelude::*,
    anchor_spl::token::TokenAccount,
    std::cmp::min,
};

// todo: decide on strategy to do investments for now... just accept amounts for a & b without any calculations?
pub fn handle(
    ctx: Context<Invest>,
    investable_a: u64,
    investable_b: u64,
    min_tokens_back: u64,
) -> ProgramResult {
    ctx.accounts.vault.try_transition()?;
    require!(
        ctx.accounts.vault.state == State::Live,
        ErrorCode::InvalidVaultState
    );

    // both sides of the vault must have deposits in order to inevst
    require!(
        ctx.accounts.vault.vault_has_deposits(),
        ErrorCode::VaultHasNoDeposits
    );

    // pubkey verified via context
    let vault = &mut ctx.accounts.vault;
    let alpha_mint = vault.alpha.mint;
    let beta_mint = vault.beta.mint;

    let token_account_a = &ctx.accounts.saber_deposit.saber_swap_common.source_token_a;
    verify_investable_amount(token_account_a, &vault.alpha, investable_a)?;

    let token_account_b = &ctx.accounts.saber_deposit.saber_swap_common.source_token_b;
    verify_investable_amount(token_account_b, &vault.beta, investable_b)?;

    vault.update_investment(&alpha_mint, token_account_a.amount, investable_a)?;
    vault.update_investment(&beta_mint, token_account_b.amount, investable_b)?;

    let strategy_account = ctx.accounts.strategy.to_account_info();
    // temp: slippage_tolerance = 0
    // todo: add min_tokens_back
    Strategy::load(&strategy_account, &crate::ID)?.invest(ctx, investable_a, investable_b, 0)?;

    Ok(())
}

pub fn verify_investable_amount(
    token_account: &Account<TokenAccount>,
    asset: &Asset,
    target: u64,
) -> std::result::Result<(), ProgramError> {
    require!(
        token_account.mint == asset.mint,
        ErrorCode::InsufficientTokenBalance
    );

    let token_account_amount = token_account.amount;
    // vault token account must have at least the amount we wish to invest.
    require!(
        target <= asset.deposited && target <= token_account_amount,
        ErrorCode::InsufficientTokenBalance
    );

    Ok(())
}

/**
 * dev: determine how many tokens can be deposited. right now, assume
 * 1-1 ratio between token value. eventually, need oracles to figure out the ratio.
 * maybe we can roughly store this amount on the asset as well.
 *
 * todo item
 */
pub fn calculate_investable_amount(alpha_amount: u64, beta_amount: u64) -> (u64, u64) {
    let investable_amount = min(alpha_amount, beta_amount);

    return (investable_amount, investable_amount);
}
