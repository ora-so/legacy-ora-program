use {
    crate::{
        constant::VAULT_SEED,
        context::Claim,
        error::ErrorCode,
        util::{mint_with_verified_ata, transfer_with_verified_ata},
    },
    anchor_lang::prelude::*,
};

pub fn handle(ctx: Context<Claim>) -> ProgramResult {
    require!(
        ctx.accounts.vault.can_users_claim(),
        ErrorCode::InvalidVaultState
    );

    // verify mint and lp from vault vs instruction accounts
    let asset = ctx.accounts.vault.get_asset(&ctx.accounts.mint.key())?;
    require!(ctx.accounts.lp.key() == asset.lp, ErrorCode::InvalidLpMint);

    let claim_amount = ctx.accounts.history.claim;
    let deposit_amount = ctx.accounts.history.cumulative;
    let lp_amount = deposit_amount
        .checked_sub(claim_amount)
        .ok_or_else(math_error!())?;

    let authority = ctx.accounts.authority.key();
    let vault_signer_seeds = generate_vault_seeds!(authority.as_ref(), ctx.accounts.vault.bump);

    if claim_amount > 0 {
        transfer_with_verified_ata(
            ctx.accounts.source_ata.to_account_info(),
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
            claim_amount,
        )?;
    }

    // mint LP (SPL token) to user relative to the deposited amount to represent their position
    if lp_amount > 0 {
        mint_with_verified_ata(
            ctx.accounts.destination_lp_ata.to_account_info(),
            ctx.accounts.payer.to_account_info(),
            ctx.accounts.lp.to_account_info(),
            ctx.accounts.payer.to_account_info(),
            ctx.accounts.ata_program.to_account_info(),
            ctx.accounts.token_program.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
            ctx.accounts.rent.to_account_info(),
            &[],
            ctx.accounts.vault.to_account_info(),
            vault_seeds,
            lp_amount, // 1-1 asset to LP amount
        )?;
    }

    Ok(())
}
