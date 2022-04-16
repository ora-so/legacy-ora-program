use {
    crate::{
        constant::VAULT_SEED,
        context::Withdraw,
        util::{assert_is_ata, create_ata_if_dne},
    },
    anchor_lang::prelude::*,
    anchor_spl::token::transfer,
};

/// Allow user to withdraw the amount of mint from the vault to which they are entitled.
///
/// feat:
///     - determine if withdrawal is valid (mint for vault, state of vault, etc)
///     - update any vault state (num withdrawals, user claimed funds, etc)
///     - issue receipt / burn SPL token(s) representing user's position in the vault?
pub fn handle(ctx: Context<Withdraw>, amount: u64) -> ProgramResult {
    create_and_verify_destination_ata(&ctx)?;

    let authority = ctx.accounts.authority.key();
    let vault_signer_seeds: &[&[&[u8]]] = &[&[
        VAULT_SEED.as_bytes(),
        authority.as_ref(),
        &[ctx.accounts.vault.bump],
    ]];

    // transfer amount of mint from vault ATA to the user ATA
    transfer(
        ctx.accounts
            .into_transfer_token_context()
            .with_signer(vault_signer_seeds),
        amount
    )?;

    Ok(())
}

// Create destination ATA if it DNE. Then, verify that ATA address matches what
// we expect based on the owner and mint. We don't need to create the source ATA
// because that must exist in order to transfer tokens from that ATA to the vault
// ATA.
//
// Dev: depending on context object, we can optionally require that the destination
// ATA exists before calling into this instruction. we do not right now, which is why
// we create ATA if needed and then check that actual ATA matches what we expect.
fn create_and_verify_destination_ata(ctx: &Context<Withdraw>) -> ProgramResult {
    create_ata_if_dne(
        ctx.accounts.destination_ata.to_account_info(),
        ctx.accounts.payer.to_account_info(),
        ctx.accounts.mint.to_account_info(),
        ctx.accounts.payer.to_account_info(),
        ctx.accounts.ata_program.to_account_info(),
        ctx.accounts.token_program.to_account_info(),
        ctx.accounts.system_program.to_account_info(),
        ctx.accounts.rent.to_account_info(),
        &[],
    )?;

    assert_is_ata(
        &ctx.accounts.destination_ata.to_account_info(),
        &ctx.accounts.payer.key(),
        &ctx.accounts.mint.key(),
    )?;

    Ok(())
}
