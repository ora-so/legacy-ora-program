use anchor_spl::token::TokenAccount;
use {
    crate::{
        error::ErrorCode,
        state::{HasVault, State, Vault},
    },
    anchor_lang::prelude::*,
};

#[repr(C)]
#[derive(AnchorSerialize, AnchorDeserialize, Debug, Default, PartialEq)]
pub struct SwapConfig {
    /// max number of tokens to put into the pool
    pub max_in: u64,
    /// min number of tokens expected out of the pool
    pub min_out: u64,
    /// swap direction: alpha_to_beta swaps alpha for beta, !alpha_to_beta swaps beta for alpha
    /// this allows the strategist to compute swap info at the SDK layer and then pass that info
    /// to the instruction.
    pub alpha_to_beta: bool,
}

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

// todo: add input lp amount
pub trait Redeem<'info> {
    fn redeem(&mut self, min_token_a: u64, min_token_b: u64) -> ProgramResult;
    fn adjust_returns(&mut self, swap_config: Option<SwapConfig>) -> ProgramResult;
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
    swap_config: Option<SwapConfig>,
) -> ProgramResult {
    ctx.accounts.vault_mut().try_transition()?;
    require!(
        ctx.accounts.vault().state() == State::Redeem,
        ErrorCode::InvalidVaultState
    );

    // burn LP for underlying assets in downstream protocol
    ctx.accounts.redeem(min_token_a, min_token_b)?;
    // perform any required swaps to make senior tranche whole
    ctx.accounts.adjust_returns(swap_config)?;

    Ok(())
}
