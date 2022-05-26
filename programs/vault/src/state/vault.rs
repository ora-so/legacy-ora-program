use crate::{error::ErrorCode, state::asset::Asset, util::get_current_timestamp};
use anchor_lang::prelude::*;
use std::result::Result;

#[account]
#[derive(Debug, Default, PartialEq)]
pub struct FarmVault {}

pub trait HasVault {
    fn vault(&self) -> &Vault;
    fn vault_mut(&mut self) -> &mut Vault;
}

#[repr(C)]
#[derive(AnchorSerialize, AnchorDeserialize, Debug, Default, PartialEq)]
pub struct AssetConfig {
    pub user_cap: Option<u64>,
    pub asset_cap: Option<u64>,
}

#[repr(C)]
#[derive(AnchorSerialize, AnchorDeserialize, Debug, Default, PartialEq)]
pub struct VaultConfig {
    pub strategy: Pubkey,
    pub authority: Pubkey,
    pub strategist: Pubkey,
    pub alpha: AssetConfig,
    pub beta: AssetConfig,
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
    Withdraw,
}

impl Default for State {
    fn default() -> Self {
        State::Inactive
    }
}

// todo: on vault, have function that takes in source, dest atas and return wehther it's alpha / beta

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
    /// current state of vault
    pub state: State,
    /// timestamp when the vault begins accepting deposits
    pub start_at: u64,
    /// timestamp when investors can no longer move funds, strategist can invest
    pub invest_at: u64,
    /// timestamp when strategist can redeem LP tokens for liquidity, investors can withdraw
    pub redeem_at: u64,

    /// proxy account that will hold all LP tokens for the vault
    /// since interactions require the account to carry 0 data.
    /// None until assigned.
    pub farm_vault: Option<Pubkey>,
}

impl Vault {
    pub fn init(
        &mut self,
        bump: u8,
        authority: Pubkey,
        config: VaultConfig,
        alpha: Asset,
        beta: Asset,
    ) {
        self.bump = bump;

        // vault assets
        self.alpha = alpha;
        self.beta = beta;

        // vault config
        self.authority = authority;
        self.strategy = config.strategy;
        self.strategist = config.strategist;
        self.fixed_rate = config.fixed_rate;
        self.start_at = config.start_at;
        self.invest_at = config.invest_at;
        self.redeem_at = config.redeem_at;
        self.state = State::Inactive;

        self.farm_vault = None;
    }

    pub fn update_authority(&mut self, authority: Pubkey) {
        self.authority = authority;
    }

    pub fn update_strategist(&mut self, strategist: Pubkey) {
        self.strategist = strategist;
    }

    pub fn has_deposits(&self) -> bool {
        return self.alpha.has_deposits() && self.beta.has_deposits();
    }

    pub fn state(&self) -> State {
        return self.state;
    }

    pub fn can_disperse_funds(&mut self) -> bool {
        // vault state is in redeem state and funds have been received
        return self.state == State::Redeem && (self.alpha.received > 0 || self.beta.received > 0);
    }

    pub fn transition(&mut self) -> ProgramResult {
        let timestamp = get_current_timestamp()?;

        // first, attempt time-based transitions. then, optionally
        // update a non-time-based transition if needed.
        if timestamp >= self.redeem_at {
            self.state = State::Redeem
        } else if timestamp >= self.invest_at {
            self.state = State::Live
        } else if timestamp >= self.start_at {
            self.state = State::Deposit
        } else {
            return Err(ErrorCode::MissingTransitionAtTimeForState.into());
        }

        if self.can_disperse_funds() {
            self.state = State::Withdraw
        }

        Ok(())
    }

    // allow vault to attempt transition if possible. this can help prevent an async
    // instruction invocation to transition vault state.
    pub fn try_transition(&mut self) -> ProgramResult {
        match self.transition() {
            Ok(_) | Err(_) => Ok(()),
        }
    }

    pub fn get_deposits_for(&self, mint: &Pubkey) -> Result<u64, ProgramError> {
        Ok(self.get_asset(mint)?.deposits)
    }

    pub fn get_asset(&self, mint: &Pubkey) -> Result<Asset, ProgramError> {
        let asset = match *mint {
            m if self.alpha.mint == m => self.alpha,
            m if self.beta.mint == m => self.beta,
            _ => return Err(ErrorCode::NonexistentAsset.into()),
        };

        Ok(asset)
    }

    pub fn get_alpha_mut<'a>(&'a mut self) -> Result<&'a mut Asset, ProgramError> {
        Ok(&mut self.alpha)
    }

    pub fn get_beta_mut<'a>(&'a mut self) -> Result<&'a mut Asset, ProgramError> {
        Ok(&mut self.beta)
    }

    pub fn get_asset_mut<'a>(&'a mut self, mint: &Pubkey) -> Result<&'a mut Asset, ProgramError> {
        let asset = match *mint {
            m if self.alpha.mint == m => &mut self.alpha,
            m if self.beta.mint == m => &mut self.beta,
            _ => return Err(ErrorCode::NonexistentAsset.into()),
        };

        Ok(asset)
    }

    pub fn update_deposit<'a>(&'a mut self, mint: &Pubkey, amount: u64) -> ProgramResult {
        self.get_asset_mut(mint)?.add_deposit(amount)
    }

    pub fn update_receipt(&mut self, mint: &Pubkey, amount: u64) -> ProgramResult {
        self.get_asset_mut(mint)?.add_receipt(amount)
    }

    pub fn in_claimable_state(&self, asset: &Asset) -> bool {
        return  asset.claims_already_processed()
            && self.state != State::Deposit
            && self.state != State::Inactive;
    }

    pub fn can_perform_swap(&self) -> bool {
        // withdraw too in case not everything fit within redeem?
        return self.state != State::Live || self.state != State::Redeem;
    }

    // call during init_user_farm
    pub fn assign_farm_vault(&mut self, farm_vault: &Pubkey) -> Result<(), ProgramError> {
        // farm vault can only be assigned once per vault lifetime
        match self.farm_vault {
            Some(_) => return Err(ErrorCode::CannotReinstantiateFarmVault.into()),
            None => {
                self.farm_vault = Some(*farm_vault);
                Ok(())
            }
        }
    }

    // assert the given farm vault match what is registered on the vault. farm vault will be none
    // if the user farm has not been inititialized. this is expected because the orca CPI call would
    // also fail without a valid user farm account.
    // this is on the strategy as opposed to the vault because it is an attribute specific to saber
    pub fn verify_farm_vault(&mut self, farm_vault: &Pubkey) -> Result<(), ProgramError> {
        match self.farm_vault {
            Some(_farm_vault) => {
                require!(_farm_vault == *farm_vault, PublicKeyMismatch);
                Ok(())
            }
            None => return Err(ErrorCode::MissingFarmVault.into()),
        }
    }
}
