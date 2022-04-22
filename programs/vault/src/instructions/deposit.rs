use {
    crate::{
        context::Deposit,
        util::{assert_is_ata, create_ata_if_dne},
    },
    anchor_lang::prelude::*,
    anchor_spl::token::{transfer, Transfer},
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
    create_and_verify_destination_ata(&ctx)?;

    // transfer amount of mint from user ATA to the vault ATA
    transfer(ctx.accounts.into_transfer_token_context(), amount)?;

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
fn create_and_verify_destination_ata(ctx: &Context<Deposit>) -> ProgramResult {
    create_ata_if_dne(
        ctx.accounts.destination_ata.to_account_info(),
        ctx.accounts.vault.to_account_info(),
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
        &ctx.accounts.vault.key(),
        &ctx.accounts.mint.key(),
    )?;

    Ok(())
}

impl<'info> Deposit<'info> {
    pub fn into_transfer_token_context(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        let cpi_program = self.token_program.to_account_info();

        let cpi_accounts = Transfer {
            /// source ATA
            from: self.source_ata.to_account_info(),
            /// destination ATA
            to: self.destination_ata.to_account_info(),
            /// entity authorizing transfer
            authority: self.payer.to_account_info(),
        };

        CpiContext::new(cpi_program, cpi_accounts)
    }
}