use {
  crate::{
    error::ErrorCode,
    context::Redeem,
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

pub fn handle(ctx: Context<Redeem>, slippage_tolerance: u16) -> ProgramResult {
  require!(ctx.accounts.vault.state == State::Withdraw, ErrorCode::InvalidVaultState);

  let strategy_account = ctx.accounts.strategy.to_account_info();
  Strategy::load(&strategy_account, &crate::ID)?.redeem(ctx, slippage_tolerance)?;

  Ok(())
}
