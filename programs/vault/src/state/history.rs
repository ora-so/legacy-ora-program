use crate::error::ErrorCode;
use anchor_lang::prelude::*;
use std::result::Result;

/**
 * Account to track user deposit metadata for any given vault's tranche.
 *
 * PDA address is derived from the following seeds:
 *  - "history"
 *  - vault pubkey
 *  - mint pubkey
 *  - user pubkey
 */
#[account]
#[derive(Copy, Debug, Default, PartialEq)]
pub struct History {
    /// bump
    pub bump: u8,
    /// attribute explicitly saying whether or not an account has been initialized
    pub intialized: bool,
    /// count of unique deposits by user
    pub deposits: u64,
    /// cumulative amount deposited for the asset
    pub cumulative: u64,
    /// amount user has right to claim due to an excess deposit. the asset
    /// to be claimed is stored on the vault itself.
    pub claim: u64,
    /// user has right to claim LP tokens representing their position in the tranche
    pub can_claim_tranche_lp: bool,
}

impl History {
    pub fn init_if_needed(&mut self, bump: u8) {
        if !self.intialized {
            self.bump = bump;
            self.intialized = true;
            self.deposits = 0;
            self.cumulative = 0;
            self.claim = 0;
            self.can_claim_tranche_lp = true;
        }
    }

    pub fn increment_deposits(&mut self) -> Result<(), ProgramError> {
        self.deposits = self.deposits.checked_add(1).ok_or_else(math_error!())?;

        Ok(())
    }

    pub fn deposit(&mut self, amount: u64) -> Result<(), ProgramError> {
        self.increment_deposits()?;
        self.cumulative = self
            .cumulative
            .checked_add(amount)
            .ok_or_else(math_error!())?;

        Ok(())
    }

    pub fn has_claim(&self) -> bool {
        return self.claim > 0;
    }

    pub fn add_claim(&mut self, amount: u64) -> Result<(), ProgramError> {
        msg!("before: {}, amount: {}", self.claim, amount);
        self.claim = self.claim.checked_add(amount).ok_or_else(math_error!())?;
        msg!("after: {}", self.claim);

        Ok(())
    }

    pub fn reset_claim(&mut self) {
        self.claim = 0;
    }

    pub fn claim_tranche_lp(&mut self) {
        self.can_claim_tranche_lp = false;
    }
}
