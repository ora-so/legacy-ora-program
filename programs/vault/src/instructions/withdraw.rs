use {
    crate::{
        constant::VAULT_SEED,
        context::Withdraw,
        state::{vault::State, asset::Asset},
        util::{transfer_with_verified_ata},
        error::ErrorCode
    },
    anchor_lang::prelude::*,
    anchor_spl::token::{burn, Burn},
};

/// Allow user to withdraw the amount of mint from the vault to which they are entitled.
///
/// feat:
///     - determine if withdrawal is valid (mint for vault, state of vault, etc)
///     - update any vault state (num withdrawals, user claimed funds, etc)
///     - issue receipt / burn SPL token(s) representing user's position in the vault?
pub fn handle(ctx: Context<Withdraw>, amount: u64) -> ProgramResult {
    ctx.accounts.vault.try_transition()?;
    require!(ctx.accounts.vault.state == State::Withdraw, ErrorCode::InvalidVaultState);

    let asset = ctx.accounts.vault.get_asset(ctx.accounts.mint.key())?;
    require!(ctx.accounts.lp.key() == asset.lp , ErrorCode::InvalidLpMint);

    // require user to withdraw all at once? can optionally change in the future?
    let lp_amount = ctx.accounts.source_lp.amount;
    burn(
        ctx.accounts.into_burn_reserve_token_context(),
        lp_amount,
    )?;

    let withdrawal_allowance = process_withdrawal_for_user(&asset, lp_amount)?;

    let authority = ctx.accounts.authority.key();
    let vault_signer_seeds = &[
        VAULT_SEED.as_bytes(),
        authority.as_ref(),
        &[ctx.accounts.vault.bump],
    ];

    transfer_with_verified_ata(
        ctx.accounts.source_ata.to_account_info(), // change to source
        ctx.accounts.destination_ata.to_account_info(),
        ctx.accounts.payer.to_account_info(),
        ctx.accounts.mint.to_account_info(),
        ctx.accounts.payer.to_account_info(),
        ctx.accounts.ata_program.to_account_info(),
        ctx.accounts.token_program.to_account_info(),
        ctx.accounts.system_program.to_account_info(),
        ctx.accounts.rent.to_account_info(),
        &[],
        ctx.accounts.vault.to_account_info(),
        vault_signer_seeds,
        withdrawal_allowance
    )?;

    Ok(())
}

// todo: calculate how much to allow users to withdraw based on number of LP tokens,
// which will factor in (deposit(s) + fixed/var return). for now, just burn lp/withdraw deposits at
// a 1-1 ratio. in the future, if a user hasn't claimed excess deposits, we'll need to factor that in as well.
pub fn process_withdrawal_for_user(
    asset: &Asset,
    lp_amount: u64
) -> std::result::Result<u64, ProgramError> {
    Ok(lp_amount)
}

impl<'info> Withdraw<'info> {
    pub fn into_burn_reserve_token_context(&self) -> CpiContext<'_, '_, '_, 'info, Burn<'info>> {
        let cpi_program = self.token_program.to_account_info();

        let cpi_accounts = Burn {
            /// lp mint
            mint: self.lp.to_account_info(),
            /// payer ATA for lp mint
            to: self.source_lp.to_account_info(),
            /// payer redeeming burning tokens in exchange for deposits + returns
            authority: self.payer.to_account_info(),
        };

        CpiContext::new(cpi_program, cpi_accounts)
    }
}