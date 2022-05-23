use crate::{
    error::ErrorCode,
    state::{Asset, HasVault, State, Vault},
    util::assert_is_ata,
};
use anchor_lang::prelude::*;
use spl_token::state::Account as SplAccount;

pub fn verify_investable_amount(
    token_account: &SplAccount,
    asset: &Asset,
    target: u64,
) -> std::result::Result<(), ProgramError> {
    // vault token account must have at least the amount we wish to invest.
    require!(
        target <= asset.deposited && target <= token_account.amount,
        ErrorCode::InsufficientTokenBalance
    );

    // lastly, verify that the target amount is under the asset cap
    match asset.asset_cap {
        Some(asset_cap) => {
            require!(target <= asset_cap, ErrorCode::AssetCapExceeded);

            Ok(())
        }
        None => Ok(()),
    }
}

pub fn verify_investment<'info>(
    token_account_info: &AccountInfo<'info>,
    mint: Pubkey,
    amount: u64,
    vault: &mut Account<Vault>,
) -> ProgramResult {
    let vault_key = vault.key();
    let asset = vault.get_asset(&mint)?;
    let token_account = assert_is_ata(&token_account_info, &vault_key, &mint)?;

    verify_investable_amount(&token_account, &asset, amount)?;
    vault.update_investment(&mint, token_account.amount, amount)?;

    Ok(())
}

pub trait Invest<'info> {
    /// Given the total available amounts of senior and junior assets. We will invest as much as
    /// possible and record any uninvested assets.
    ///
    /// @dev Because this functionality is can only be invoked by a particular keypair, we allow
    ///      to decide how much of each asset is invested.
    ///
    fn invest(&mut self, amount_a: u64, amount_b: u64, min_out: u64) -> ProgramResult;
    fn verify_junior_investment(&mut self, amount: u64) -> ProgramResult;
    fn verify_senior_investment(&mut self, amount: u64) -> ProgramResult;
}

pub fn handle<'info, T: Invest<'info> + HasVault>(
    ctx: Context<'_, '_, '_, 'info, T>,
    investable_a: u64,
    investable_b: u64,
    min_tokens_back: u64,
) -> ProgramResult {
    ctx.accounts.vault_mut().try_transition()?;
    require!(
        ctx.accounts.vault().state() == State::Live,
        ErrorCode::InvalidVaultState
    );

    // both sides of the vault must have deposits in order to inevst
    require!(
        ctx.accounts.vault().vault_has_deposits(),
        ErrorCode::VaultHasNoDeposits
    );

    ctx.accounts.verify_junior_investment(investable_a)?;
    ctx.accounts.verify_senior_investment(investable_b)?;
    ctx.accounts
        .invest(investable_a, investable_b, min_tokens_back)?;

    Ok(())
}
