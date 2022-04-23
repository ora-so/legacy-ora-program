use {
    crate::{
        constant::VAULT_SEED,
        context::Deposit,
        util::{transfer_with_verified_ata, mint_with_verified_ata},
        state::{vault::State, asset::Asset},
        error::ErrorCode
    },
    anchor_lang::prelude::*,
};

/// Allow user to deposit amount of mint into the vault.
///
/// We will optionally create the corresponding vault ATA if it does not exist.
/// We will verify the ATA address matches the what we expect. Then, we will
/// proceed to transfer the tokens to that ATA.
///
/// feat:
///     - determine if deposit is valid (mint for vault, state of vault, etc)
///     - update any vault state (num deposits, etc)
///     - issue receipt / mint SPL token(s) representing user's position in the vault?
pub fn handle(ctx: Context<Deposit>, amount: u64) -> ProgramResult {
    ctx.accounts.vault.try_transition()?;
    require!(ctx.accounts.vault.state == State::Deposit, ErrorCode::InvalidVaultState);

    let mut asset = ctx.accounts.vault.get_asset(ctx.accounts.mint.key())?;
    require!(ctx.accounts.lp.key() == asset.lp , ErrorCode::InvalidLpMint);
    verify_deposit_for_user(&asset)?;

    // try to transfer amount of mint from user to the vault
    transfer_with_verified_ata(
        ctx.accounts.source_ata.to_account_info(), // change to source
        ctx.accounts.destination_ata.to_account_info(),
        ctx.accounts.vault.to_account_info(),
        ctx.accounts.mint.to_account_info(),
        ctx.accounts.payer.to_account_info(),
        ctx.accounts.ata_program.to_account_info(),
        ctx.accounts.token_program.to_account_info(),
        ctx.accounts.system_program.to_account_info(),
        ctx.accounts.rent.to_account_info(),
        &[],
        ctx.accounts.payer.to_account_info(),
        &[], // user is signer
        amount
    )?;

    asset.add_deposit(amount)?;

    // mint LP (SPL token) to user relative to the deposited amount to represent their position
    let authority = ctx.accounts.authority.key();
    let vault_seeds = &[
        VAULT_SEED.as_bytes(),
        authority.as_ref(),
        &[ctx.accounts.vault.bump],
    ];

    // todo: assuming 1-1 amount for simplicity for now. we can figure out if we want a more complex exchange rate later.
    mint_with_verified_ata(
        ctx.accounts.destination_ata.to_account_info(),
        ctx.accounts.vault.to_account_info(),
        ctx.accounts.lp.to_account_info(),
        ctx.accounts.payer.to_account_info(),
        ctx.accounts.ata_program.to_account_info(),
        ctx.accounts.token_program.to_account_info(),
        ctx.accounts.system_program.to_account_info(),
        ctx.accounts.rent.to_account_info(),
        &[],
        ctx.accounts.vault.to_account_info(),
        vault_seeds,
        amount
    )?;

    Ok(())
}

// todo: implement after we figure out how we want to store deposit info. probably in a PDA that we can first create on-chain if DNE.
pub fn verify_deposit_for_user(asset: &Asset) -> std::result::Result<(), ProgramError> {
    match asset.user_cap {
        Some(user_cap) => {
            msg!("implement check here");
            Ok(())
        },
        None => Ok(()),
    }
}