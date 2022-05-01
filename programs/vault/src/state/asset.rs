use {crate::error::ErrorCode, anchor_lang::prelude::*};

#[repr(C)]
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, Default, PartialEq)]
pub struct Asset {
    /// asset's mint
    pub mint: Pubkey,
    /// token representing a stake in this asset
    pub lp: Pubkey,
    /// cap on assets cumulative deposits
    pub asset_cap: Option<u64>,
    /// cap on any user's deposits
    pub user_cap: Option<u64>,
    /// number of independent deposits made into vualt
    pub deposits: u64,
    /// amount deposited
    pub deposited: u64,
    /// this only represents the amount invested at a single point in time.
    /// add another attribute if to enable mid-cycle deposits.
    pub invested: u64,
    /// amount deposited but not invested
    pub excess: u64,
    /// amount receieved once
    pub received: u64,
}

impl Asset {
    pub fn builder() -> AssetBuilder {
        AssetBuilder::new()
    }

    pub fn has_deposits(&self) -> bool {
        return self.deposited > 0;
    }

    pub fn increment_deposits(&mut self) -> ProgramResult {
        self.deposits = self.deposits.checked_add(1).ok_or_else(math_error!())?;

        Ok(())
    }

    pub fn add_deposit(&mut self, deposited: u64) -> ProgramResult {
        self.increment_deposits()?;
        self.deposited = self
            .deposited
            .checked_add(deposited)
            .ok_or_else(math_error!())?;

        // guard against cumulative asset deposits exceeding a certain amount
        match self.asset_cap {
            Some(asset_cap) => {
                require!(
                    self.deposited <= asset_cap,
                    ErrorCode::DepositExceedsAssetCap
                );

                Ok(())
            }
            None => Ok(()),
        }
    }

    pub fn add_investment(&mut self, invested: u64) -> ProgramResult {
        self.invested = self
            .invested
            .checked_add(invested)
            .ok_or_else(math_error!())?;

        Ok(())
    }

    pub fn add_excess(&mut self, excess: u64) -> ProgramResult {
        self.excess = self.excess.checked_add(excess).ok_or_else(math_error!())?;

        Ok(())
    }

    pub fn add_receipt(&mut self, received: u64) -> ProgramResult {
        self.received = self
            .received
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
            deposits: 0,
            deposited: 0,
            invested: 0,
            excess: 0,
            received: 0,
        }
    }
}
