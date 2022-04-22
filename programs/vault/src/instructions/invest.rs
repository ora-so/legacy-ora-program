use {
  crate::{
    error::ErrorCode,
    context::Invest,
    state::{
      strategy::{
        Strategy,
        StrategyActions
      },
      vault::State
    }
  },
  anchor_lang::prelude::*,
};

pub fn handle(ctx: Context<Invest>, slippage_tolerance: u16) -> ProgramResult {
  require!(ctx.accounts.vault.state == State::Live, ErrorCode::InvalidVaultState);

  let strategy_account = ctx.accounts.strategy.to_account_info();
  Strategy::load(&strategy_account, &crate::ID)?.invest(ctx, slippage_tolerance)?;

  Ok(())
}
