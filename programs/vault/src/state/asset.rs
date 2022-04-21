use anchor_lang::prelude::*;

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

impl Asset {
  pub fn builder() -> AssetBuilder {
    AssetBuilder::new()
  }

  // todo: handle asset_cap
  // todo: handle user_cap

  pub fn update_deposited(&mut self, deposited: u64) {
    self.deposited = deposited;
  }

  pub fn update_invested(&mut self, invested: u64) {
    self.invested = invested;
  }

  pub fn update_received(&mut self, received: u64) {
    self.received = received;
  }
}
