use {
    crate::{error::ErrorCode, state::asset::Asset, util::get_current_timestamp},
    anchor_lang::prelude::*,
    std::result::Result,
};

#[repr(C)]
#[derive(AnchorSerialize, AnchorDeserialize, Debug, Default, PartialEq)]
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

    /// optional: asset for which we have an
    pub excess: Option<Pubkey>,
    pub claims_processed: bool,
    pub claims_idx: Option<u64>,
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

        // excess related metadata; value set at time of investment
        self.excess = None;
        self.claims_processed = false;
        self.claims_idx = None;
    }

    pub fn update_authority(&mut self, authority: Pubkey) {
        self.authority = authority;
    }

    pub fn update_strategist(&mut self, strategist: Pubkey) {
        self.strategist = strategist;
    }

    pub fn vault_has_deposits(&mut self) -> bool {
        return self.alpha.has_deposits() && self.beta.has_deposits();
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

    pub fn get_asset_mut<'a>(&'a mut self, mint: &Pubkey) -> Result<&'a mut Asset, ProgramError> {
        let asset = match *mint {
            m if self.alpha.mint == m => &mut self.alpha,
            m if self.beta.mint == m => &mut self.beta,
            _ => return Err(ErrorCode::NonexistentAsset.into()),
        };

        Ok(asset)
    }

    pub fn update_deposit<'a>(&'a mut self, mint: &Pubkey, amount: u64) -> ProgramResult {
        self.get_asset_mut(mint)?.add_deposit(amount)?;

        Ok(())
    }

    pub fn update_investment(
        &mut self,
        mint: &Pubkey,
        total: u64,
        investable: u64,
    ) -> ProgramResult {
        let asset = self.get_asset_mut(mint)?;
        let excess = total.checked_sub(investable).ok_or_else(math_error!())?;

        asset.add_investment(investable)?;

        if excess > 0 {
            asset.add_excess(excess)?;

            require!(
                self.excess.is_none(),
                ErrorCode::DualSidedExcesssNotPossible
            );

            self.excess = Some(*mint);
        } else {
            // rare case that we have no excess investments. no need to process claims.
            self.finalize_claims();
        }

        Ok(())
    }

    pub fn update_receipt(&mut self, mint: &Pubkey, amount: u64) -> ProgramResult {
        self.get_asset_mut(mint)?.add_receipt(amount)?;

        Ok(())
    }

    // set_excess_if_possible
    pub fn set_excess_if_possible(&mut self) -> ProgramResult {
        // we processed excess before
        if self.excess.is_some() {
            return Ok(());
        }

        // one side of the vault should have no extra assets
        // todo: is this valid assumption? if not, we should move
        // this data to the asset struct itself.
        require!(
            self.alpha.excess == 0 || self.beta.excess == 0,
            ErrorCode::DualSidedExcesssNotPossible
        );

        if self.alpha.excess > 0 {
            self.excess = Some(self.alpha.mint);
        } else if self.beta.excess > 0 {
            self.excess = Some(self.beta.mint);
        }

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

    pub fn can_users_claim(&self) -> bool {
        return self.claims_processed
            && self.state != State::Deposit
            && self.state != State::Inactive;
    }
}
