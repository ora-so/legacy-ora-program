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

impl Asset {
    pub fn init(
      &mut self,
      mint: Pubkey,
      lp: Pubkey,
      asset_cap: Option<u64>,
      user_cap: Option<u64>,
      deposited: u64,
      invested: u64,
      received: u64,
  ) {
    self.mint = mint;
    self.lp = lp;
    self.asset_cap = asset_cap;
    self.user_cap = user_cap;
    self.deposited = deposited;
    self.invested = invested;
    self.received = received;
  }
}
