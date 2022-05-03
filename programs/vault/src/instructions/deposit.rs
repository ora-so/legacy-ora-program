use {
    crate::{
        context::Deposit,
        error::ErrorCode,
        state::{asset::Asset, deposit::history::History, vault::State},
        util::transfer_with_verified_ata,
    },
    anchor_lang::prelude::*,
};

/// Allow user to deposit amount of mint into the vault. A valid deposit will adhere
/// to the following conditions:
///
///   - vault is in the correct state, deposit.
///   - the mint attempting to be deposited must match either the alpha or beta asset mint.
///   - the receipt account for a given deposit index cannot cannot yet exist. if the account
///     already exists with valid data, this means the deposit belongs to someone else.
///   - the source ATA must have a sufficient balance to successfully perform the deposit.
///   - the user's cumulative deposits must remain under the optional user cap.
///   - the tranche's cumulative deposits must remain under the optional asset cap.
///
/// @dev in order to prevent failed deposits, we could optionally pass in a few posible receipts,
///      at current index + m, where m is some whole integer
///
/// @dev we check deposit index matches the value on the vault after incrementing because
///      the index starts at 0 and reflects the number of deposits so far.
///
/// @dev the following does not hold true because of Anchor context - the current
///      structure requires ATAs to already exist.
///
/// We will optionally create the corresponding vault ATA if it does not exist.
/// We will verify the ATA address matches the what we expect. Then, we will
/// proceed to transfer the tokens to that ATA.
///
pub fn handle(
    ctx: Context<Deposit>,
    deposit_index: u64,
    receipt_bump: u8,
    history_bump: u8,
    amount: u64,
) -> ProgramResult {
    let mint_key = &ctx.accounts.mint.key();

    ctx.accounts.vault.try_transition()?;
    msg!("state: {:?}", ctx.accounts.vault.state);
    require!(
        ctx.accounts.vault.state == State::Deposit,
        ErrorCode::InvalidVaultState
    );

    let asset = ctx.accounts.vault.get_asset(mint_key)?;

    ctx.accounts.history.init_if_needed(history_bump);
    ctx.accounts.receipt.init(
        receipt_bump,
        amount,
        asset.deposited,
        &ctx.accounts.payer.key(),
    )?;

    verify_deposit_for_user(&mut ctx.accounts.history, &asset, amount)?;

    transfer_with_verified_ata(
        ctx.accounts.source_ata.to_account_info(),
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
        amount,
    )?;

    ctx.accounts.vault.update_deposit(mint_key, amount)?;

    // this makes sure the number of deposits on the vault's asset matches the seed
    // used to derive the PDA address. If it's not equal, the caller tried to move
    // forward or backwards in the deposit sequence.
    require!(
        deposit_index == ctx.accounts.vault.get_deposits_for(mint_key)?,
        ErrorCode::InvalidDepositForVault
    );

    Ok(())
}

pub fn verify_deposit_for_user(
    history: &mut Account<History>,
    asset: &Asset,
    amount: u64,
) -> std::result::Result<(), ProgramError> {
    match asset.user_cap {
        Some(user_cap) => {
            history.deposit(amount)?;
            require!(
                history.cumulative <= user_cap,
                ErrorCode::DepositExceedsUserCap
            );

            Ok(())
        }
        None => Ok(()),
    }
}
