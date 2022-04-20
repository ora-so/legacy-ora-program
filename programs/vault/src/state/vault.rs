use {
anchor_lang::prelude::*,
crate::{
  state::asset::Asset,
  util::get_current_timestamp,
  error::ErrorCode
}
};

#[repr(C)]
#[derive(Debug, Default, PartialEq)]
pub struct VaultConfig {
  pub strategy: Pubkey,
  pub authority: Pubkey,
  pub strategist: Pubkey,
  pub fixed_rate: u16,
  pub start_at: u64,
  pub invest_at: u64,
  pub redeem_at: u64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq)]
pub enum State {
  Inactive,
  Deposit,
  Live,
  Redeem,
  Withdraw
}

impl Default for State {
  fn default() -> Self {
      State::Inactive
  }
}

#[account]
#[derive(Debug, Default, PartialEq)]
pub struct Vault {
  /// bump
  pub bump: u8,
  /// entity that created the vault and has rights to perform limited CRUD operations
  pub authority: Pubkey,
  /// asset with a fixed return from vault
  pub alpha: Asset,
  /// asset with a variable return from vault
  pub beta: Asset,
  /// defines interactions with downstream protocols
  pub strategy: Pubkey,
  /// entity with the right to invoke functions defined by the strategy
  pub strategist: Pubkey,
  /// return offered to the alpha asset, in basis points
  pub fixed_rate: u16,
  // current state of vault
  pub state: State,
  // timestamp when the vault begins accepting deposits
  pub start_at: u64,
  // timestamp when investors can no longer move funds, strategist can invest
  pub invest_at: u64,
  // timestamp when strategist can redeem LP tokens for liquidity, investors can withdraw
  pub redeem_at: u64,
}

impl Vault {
  pub fn init(
      &mut self,
      bump: u8,
      config: VaultConfig,
      alpha: Asset,
      beta: Asset
  ) {
      self.bump = bump;

      // vault assets
      self.alpha = alpha;
      self.beta = beta;

      // vault config
      self.authority = config.authority;
      self.strategy = config.strategy;
      self.strategist = config.strategist;
      self.fixed_rate = config.fixed_rate;
      self.start_at = config.start_at;
      self.invest_at = config.invest_at;
      self.redeem_at = config.redeem_at;
      self.state = State::Inactive;
  }

  pub fn update_authority(
    &mut self,
    authority: Pubkey
  ) {
    self.authority = authority;
  }

  pub fn update_strategist(
    &mut self,
    strategist: Pubkey
  ) {
    self.strategist = strategist;
  }

  pub fn transition(
    &mut self,
  ) -> ProgramResult {
    let timestamp = get_current_timestamp()?;

    if timestamp >= self.redeem_at {
      self.state = State::Withdraw
    } else if timestamp >= self.invest_at {
      self.state = State::Live
    } else if timestamp >= self.start_at {
      self.state = State::Deposit
    } else {
      return Err(ErrorCode::MissingTransitionAtTimeForState.into())
    }

    Ok(())
  }
}
