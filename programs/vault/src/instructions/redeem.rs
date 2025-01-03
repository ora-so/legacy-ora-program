use anchor_spl::token::TokenAccount;
use {
    crate::{
        error::ErrorCode,
        state::{HasVault, State},
    },
    anchor_lang::prelude::*,
};

pub fn balance_difference(
    token_account: &mut Account<TokenAccount>,
) -> std::result::Result<(u64, u64), ProgramError> {
    let before = token_account.amount;
    token_account.reload()?;

    Ok((before, token_account.amount))
}

pub fn verify_received(
    token_account: &mut Account<TokenAccount>,
    min_expected: u64,
) -> std::result::Result<u64, ProgramError> {
    let (before, after) = balance_difference(token_account)?;
    let received = after.checked_sub(before).ok_or_else(math_error!())?;
    require!(received >= min_expected, ErrorCode::SlippageTooHigh);

    Ok(received)
}

pub trait Redeem<'info> {
    fn redeem(&mut self, min_token_a: u64, min_token_b: u64) -> ProgramResult;
}

///  Based on a vault's strategy, we will deserialize the related account state and call
///  implemented `redeem` trait. Depending on the strategy, it will take different
///  actions. In the case of an AMM, it will burn an LP token in exchange for a relative
///  nuber of the pool's tokens.
///
pub fn handle<'info, T: Redeem<'info> + HasVault>(
    ctx: Context<'_, '_, '_, 'info, T>,
    min_token_a: u64,
    min_token_b: u64,
) -> ProgramResult {
    let vault = ctx.accounts.vault();

    require!(vault.state() == State::Redeem, ErrorCode::InvalidVaultState);
    msg!("vault state verified");

    // if no assets were invested, return early. received initialized at 0.
    if vault.alpha.invested == 0 && vault.beta.invested == 0 {
        msg!("no funds invested; returning early");
        return Ok(());
    }

    // burn LP for underlying assets in downstream protocol
    ctx.accounts.redeem(min_token_a, min_token_b)
}
