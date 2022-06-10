use crate::{
    constant::{
        DEPOSIT_STATE, INACTIVE_STATE, LIVE_STATE, REBALANCE_STATE, REDEEM_STATE, WITHDRAW_STATE,
    },
    error::ErrorCode,
    state::asset::Asset,
};
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
    // duration for which the vault will be in their respective states
    pub deposit_duration: u64,
    pub invest_duration: u64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq)]
pub enum State {
    Inactive,
    Deposit,
    Live,
    Redeem,
    Rebalance,
    Withdraw,
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
    /// proxy account that will hold all tokens for the vault
    pub vault_store: Pubkey,
    /// vault_store bump since vault_store can't hold any data; and so that we don't have
    /// to pass into every instruction
    pub vault_store_bump: u8,
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
    /// timestamp at which the vault should start accepting deposits
    pub start_at: u64,
    /// timestamp at which the vault actually transitioned to the deposit state
    pub started_at: Option<u64>,
    /// duration of time for which the vault is accepting deposits
    pub deposit_duration: u64,
    /// timestamp at which strategist actually transitioned to the live state
    pub invested_at: Option<u64>,
    /// duration of time for which the vault will invest funds
    pub invest_duration: u64,
    /// timestamp at which strategist actually transitioned to the redeem state
    pub redeemed_at: Option<u64>,
    /// timestamp at which strategist actually transitioned to the rebalance state
    pub rebalanced_at: Option<u64>,
    /// boolean indicating whether or not funds have been rebalanced based on expected returns
    pub reblanced: bool,
}

impl Vault {
    pub fn init(
        &mut self,
        bump: u8,
        authority: Pubkey,
        vault_store: Pubkey,
        vault_store_bump: u8,
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
        self.vault_store = vault_store;
        self.vault_store_bump = vault_store_bump;
        self.strategy = config.strategy;
        self.strategist = config.strategist;
        self.fixed_rate = config.fixed_rate;
        self.start_at = config.start_at;
        self.started_at = None;
        self.deposit_duration = config.deposit_duration;
        self.invested_at = None;
        self.invest_duration = config.invest_duration;
        self.redeemed_at = None;
        self.rebalanced_at = None;
        self.reblanced = false;
        self.state = State::Inactive;
    }

    pub fn update_authority(&mut self, authority: Pubkey) {
        self.authority = authority;
    }

    pub fn update_strategist(&mut self, strategist: Pubkey) {
        self.strategist = strategist;
    }

    pub fn has_dual_deposits(&self) -> bool {
        return self.alpha.has_deposits() && self.beta.has_deposits();
    }

    pub fn state(&self) -> State {
        return self.state;
    }

    pub fn can_disperse_funds(&self) -> bool {
        // vault state is in rebalance state and funds have been reblanced
        return self.state == State::Rebalance && self.reblanced;
    }

    // we allow non-linear transitions because `transition` is a permmissioned instruction
    //
    // @dev: previously, we allowed linear state machine transition based mostly on timestamps, but
    //       we pivoted to this approach givent the possibile cluster time drift + the lack of oracles
    //       providing timestamps
    //
    // @dev: we don't enforrce time constraints but we do enforce order of state transitions. even the
    //       strategist must by abide by some order.
    //
    pub fn transition(&mut self, target: String, ts: u64) -> ProgramResult {
        let _target = target.trim().to_lowercase();

        match &_target as &str {
            INACTIVE_STATE => self.state = State::Inactive,
            DEPOSIT_STATE => {
                if self.state != State::Inactive {
                    return Err(ErrorCode::MissingTransitionAtTimeForState.into());
                }
                self.state = State::Deposit;
                self.started_at = Some(ts);
            }
            LIVE_STATE => {
                if self.state != State::Deposit {
                    return Err(ErrorCode::MissingTransitionAtTimeForState.into());
                }
                self.state = State::Live;
                self.invested_at = Some(ts);
            }
            REDEEM_STATE => {
                if self.state != State::Live {
                    return Err(ErrorCode::MissingTransitionAtTimeForState.into());
                }
                self.state = State::Redeem;
                self.redeemed_at = Some(ts);
            }
            REBALANCE_STATE => {
                if self.state != State::Redeem {
                    return Err(ErrorCode::MissingTransitionAtTimeForState.into());
                }
                // enforce non-zero returns in at least 1 tranche before moving to rebalance state
                if self.alpha.received == 0 && self.beta.received == 0 {
                    return Err(ErrorCode::ExpectedNonzeroReturns.into());
                }
                self.state = State::Rebalance;
                self.rebalanced_at = Some(ts);
            }
            WITHDRAW_STATE => {
                if self.state != State::Rebalance {
                    return Err(ErrorCode::MissingTransitionAtTimeForState.into());
                }

                if !self.can_disperse_funds() {
                    return Err(ErrorCode::InvalidVaultState.into());
                }

                self.state = State::Withdraw
            }
            _ => return Err(ErrorCode::MissingTransitionAtTimeForState.into()),
        }

        Ok(())
    }

    // allow vault to transition from -> into specific states such that the authority doesn't have to explicitly
    // transition vault state. this approach is only applicable for the following states, not based on timestamp.
    pub fn try_transition(&mut self) -> ProgramResult {
        match self.state {
            State::Rebalance => {
                if self.can_disperse_funds() {
                    self.transition(WITHDRAW_STATE.to_string(), 0)?;
                }

                Ok(())
            }
            _ => Ok(()),
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
        return asset.claims_already_processed()
            && self.state != State::Deposit
            && self.state != State::Inactive;
    }

    // pub fn can_perform_swap(&self) -> bool {
    //     // withdraw too in case not everything fit within redeem?
    //     return self.state != State::Live || self.state != State::Redeem;
    // }

    pub fn verify_vault_store(&mut self, vault_store: &Pubkey) -> Result<(), ProgramError> {
        require!(self.vault_store == *vault_store, PublicKeyMismatch);

        Ok(())
    }
}
