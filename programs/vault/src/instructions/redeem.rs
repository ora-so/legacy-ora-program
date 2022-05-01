use {
    crate::{
        context::Redeem,
        error::ErrorCode,
        state::{
            strategy::{Strategy, StrategyActions},
            vault::State,
        },
    },
    anchor_lang::prelude::*,
};

pub fn handle(ctx: Context<Redeem>, min_token_a: u64, min_token_b: u64) -> ProgramResult {
    ctx.accounts.vault.try_transition()?;
    require!(
        ctx.accounts.vault.state == State::Redeem,
        ErrorCode::InvalidVaultState
    );

    let strategy_account = ctx.accounts.strategy.to_account_info();
    Strategy::load(&strategy_account, &crate::ID)?.redeem(ctx, min_token_a, min_token_b)?;

    Ok(())
}
