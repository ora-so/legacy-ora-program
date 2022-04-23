use {
  anchor_lang::prelude::*,
  crate::{
    error::ErrorCode,
    math_error
  },
};

#[repr(C)]
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, Default, PartialEq)]
pub struct Asset {
  /// asset's mint
  pub mint: Pubkey,
  /// token representing a stake in this asset
  pub lp: Pubkey,
  /// cap on assets cumulative eposits
  pub asset_cap: Option<u64>,
  /// cap on any user's deposits
  pub user_cap: Option<u64>,
  /// amount deposited
  pub deposited: u64,
  /// this only represents the amount invested at a single point in time.
  /// add another attribute if to enable mid-cycle deposits.
  pub invested: u64,
  /// amount receieved once
  pub received: u64,
}

impl Asset {
  pub fn builder() -> AssetBuilder {
    AssetBuilder::new()
  }

  // todo: handle asset_cap
  // todo: handle user_cap

  pub fn add_deposit(&mut self, deposited: u64) -> ProgramResult {
    self.deposited = self.deposited
      .checked_add(deposited)
      .ok_or_else(math_error!())?;

    Ok(())
  }

  pub fn add_investment(&mut self, invested: u64) -> ProgramResult {
    self.invested = self.invested
      .checked_add(invested)
      .ok_or_else(math_error!())?;

    Ok(())
  }

  pub fn update_receipt(&mut self, received: u64) -> ProgramResult {
    self.received = self.received
      .checked_add(received)
      .ok_or_else(math_error!())?;

    Ok(())
  }
}

pub struct AssetBuilder {
  pub mint: Option<Pubkey>,
  pub lp: Option<Pubkey>,
}

impl AssetBuilder {
  pub fn new() -> Self {
    Self {
      mint: None,
      lp: None,
    }
  }

  pub fn mint(mut self, mint: impl Into<Pubkey>) -> Self {
    self.mint = Some(mint.into());
    self
  }

  pub fn lp(mut self, lp: impl Into<Pubkey>) -> Self {
    self.lp = Some(lp.into());
    self
  }

  pub fn build(self) -> Asset {
    Asset {
      // panic if None, better way to handle?
      mint: self.mint.unwrap(),
      lp: self.lp.unwrap(),
      asset_cap: None,
      user_cap: None,
      deposited: 0,
      invested: 0,
      received: 0,
    }
  }
}
