use crate::error::ErrorCode;
use anchor_lang::prelude::*;
use std::result::Result;

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
    /// number of independent deposits made into vault.
    pub deposits: u64,
    /// amount deposited
    pub deposited: u64,
    /// this only represents the amount invested at a single point in time.
    /// add another attribute if to enable mid-cycle deposits.
    pub invested: u64,
    /// amount deposited but not invested
    pub excess: u64,
    /// amount receieved after withdrawing LP tokens for underlying liquidity,
    // plus posssibly adjusting for fixed return in the senior tranche
    pub received: u64,

    // todo: update these values in code after midcycle LP deposits enabled
    /// invested (+ any midterm LP token deposits)
    pub total_invested: u64,
    /// amount deposited by the rollover fund, with priority over other deposits
    pub rollover_deposited: u64,

    /// boolean indicating whether or not depositors can refund excess deposits + tranche tokens
    pub claims_processed: bool,
    /// if claims_processed = false, this indicates where we are in the process claims process
    pub claims_idx: Option<u64>,
}

impl Asset {
    pub fn builder() -> AssetBuilder {
        AssetBuilder::new()
    }

    pub fn has_deposits(&self) -> bool {
        return self.deposited > 0;
    }

    pub fn increment_deposits(&mut self) -> Result<(), ProgramError> {
        self.deposits = self.deposits.checked_add(1).ok_or_else(math_error!())?;

        Ok(())
    }

    pub fn add_deposit(&mut self, deposited: u64) -> Result<(), ProgramError> {
        self.increment_deposits()?;
        self.deposited = self
            .deposited
            .checked_add(deposited)
            .ok_or_else(math_error!())?;

        // guard against cumulative asset deposits exceeding a certain amount
        match self.asset_cap {
            Some(asset_cap) => {
                require!(self.deposited <= asset_cap, ErrorCode::AssetCapExceeded);

                Ok(())
            }
            None => Ok(()),
        }
    }

    pub fn add_investment(&mut self, invested: u64) -> Result<(), ProgramError> {
        self.invested = self
            .invested
            .checked_add(invested)
            .ok_or_else(math_error!())?;

        Ok(())
    }

    pub fn verify_invested_amount(
        &self,
        target: u64,
    ) -> std::result::Result<(), ProgramError> {
        // lastly, verify that the target amount is under the asset cap
        match self.asset_cap {
            Some(asset_cap) => {
                require!(target <= asset_cap, ErrorCode::AssetCapExceeded);
                Ok(())
            }
            None => Ok(()),
        }
    }

    pub fn update_with_investment(
        &mut self,
        invested_amount: u64,
    ) -> ProgramResult {
        self.verify_invested_amount(invested_amount)?;

        self.add_investment(invested_amount)?;
        self.add_excess(
            self.deposited
                .checked_sub(invested_amount)
                .ok_or_else(math_error!())?
        )?;

        Ok(())
    }

    pub fn add_excess(&mut self, excess: u64) -> Result<(), ProgramError> {
        self.excess = self.excess.checked_add(excess).ok_or_else(math_error!())?;

        Ok(())
    }

    pub fn add_receipt(&mut self, amount: u64) -> Result<(), ProgramError> {
        self.received = self.received.checked_add(amount).ok_or_else(math_error!())?;
        msg!("{:?} received amount, plus {:?} now = {:?}", self.mint, amount, self.received);

        Ok(())
    }

    pub fn sub_receipt(&mut self, amount: u64) -> Result<(), ProgramError> {
        self.received = self.received.checked_sub(amount).ok_or_else(math_error!())?;
        msg!("{:?} received amount, minus {:?} now = {:?}", self.mint, amount, self.received);

        Ok(())
    }

    pub fn finalize_claims(&mut self) {
        self.claims_processed = true;
    }
    
    pub fn claims_already_processed(&self) -> bool {
        return self.claims_processed;
    }
    
    pub fn update_claims_index(&mut self, index: u64) {
        self.claims_idx = Some(index);
    }
}

pub struct AssetBuilder {
    pub mint: Option<Pubkey>,
    pub lp: Option<Pubkey>,
    pub asset_cap: Option<u64>,
    pub user_cap: Option<u64>,
}

impl AssetBuilder {
    pub fn new() -> Self {
        Self {
            mint: None,
            lp: None,
            asset_cap: None,
            user_cap: None,
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

    pub fn asset_cap(mut self, amount: impl Into<Option<u64>>) -> Self {
        self.asset_cap = amount.into();
        self
    }

    pub fn user_cap(mut self, amount: impl Into<Option<u64>>) -> Self {
        self.user_cap = amount.into();
        self
    }

    pub fn build(self) -> Result<Asset, ProgramError> {
        // todo: turn into macro; maybe https://github.com/saber-hq/vipers/blob/e127d6d1772839adc19b41b1dbe3045d231da7b9/vipers/src/assert.rs#L652
        let _mint = match self.mint {
            Some(mint) => mint,
            None => return Err(ErrorCode::MissingRequiredField.into()),
        };

        let _lp = match self.lp {
            Some(lp) => lp,
            None => return Err(ErrorCode::MissingRequiredField.into()),
        };

        Ok(Asset {
            mint: _mint,
            lp: _lp,
            asset_cap: self.asset_cap,
            user_cap: self.user_cap,
            deposits: 0,
            deposited: 0,
            invested: 0,
            excess: 0,
            received: 0,
            total_invested: 0,
            rollover_deposited: 0,

            // excess related metadata; value set at time of investment
            claims_processed: false,
            claims_idx: None,
        })
    }
}
