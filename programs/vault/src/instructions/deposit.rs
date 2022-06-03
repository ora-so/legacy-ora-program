use crate::{
    constant::{GLOBAL_STATE_SEED, HISTORY_SEED, RECEIPT_SEED, VAULT_SEED},
    error::ErrorCode,
    state::{Asset, GlobalProtocolState, History, Receipt, State, Vault},
    util::transfer_with_verified_ata,
};

use anchor_lang::prelude::*;
use anchor_spl::token::Token;
use std::mem::size_of;

#[derive(Accounts)]
#[instruction(deposit_index: u64)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: read-only account to validate vault address
    pub authority: UncheckedAccount<'info>,

    #[account(
        seeds = [GLOBAL_STATE_SEED.as_bytes()],
        bump,
    )]
    pub global_protocol_state: Box<Account<'info, GlobalProtocolState>>,

    #[account(
        mut,
        seeds = [
            VAULT_SEED.as_bytes(),
            authority.key().to_bytes().as_ref()
        ],
        bump,
        constraint = vault.authority == authority.key(),
    )]
    pub vault: Box<Account<'info, Vault>>,

    #[account(
        init,
        seeds = [
            RECEIPT_SEED.as_bytes(),
            vault.key().to_bytes().as_ref(),
            mint.key().to_bytes().as_ref(),
            &deposit_index.to_le_bytes()
        ],
        bump,
        payer = payer,
        space = 8 + size_of::<Receipt>(),
    )]
    pub receipt: Box<Account<'info, Receipt>>,

    #[account(
        init_if_needed,
        seeds = [
            HISTORY_SEED.as_bytes(),
            vault.key().to_bytes().as_ref(),
            mint.key().to_bytes().as_ref(),
            payer.key().to_bytes().as_ref(),
        ],
        bump,
        payer = payer,
        space = 8 + size_of::<History>(),
    )]
    pub history: Box<Account<'info, History>>,

    /// CHECK: can be wrapped wSOL, so not a Mint
    #[account(mut)]
    pub mint: UncheckedAccount<'info>,

    // todo: any other validation?
    /// CHECK: can be wrapped wSOL, so not a TokenAccount. Validation done via Token Program CPI.
    #[account(mut)]
    pub source_ata: UncheckedAccount<'info>,

    /// CHECK: create and validate JIT in instruction. Validation done via Token Program CPI.
    #[account(mut)]
    pub destination_ata: UncheckedAccount<'info>,

    /// =============== PROGRAM ACCOUNTS ===============
    pub system_program: Program<'info, System>,

    pub token_program: Program<'info, Token>,

    /// CHECK: validate expected vs actual address
    #[account(address = spl_associated_token_account::ID)]
    pub ata_program: UncheckedAccount<'info>,

    pub rent: Sysvar<'info, Rent>,
}

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
    history.deposit(amount)?;

    match asset.user_cap {
        Some(user_cap) => {
            require!(
                history.cumulative <= user_cap,
                ErrorCode::DepositExceedsUserCap
            );

            Ok(())
        }
        None => Ok(()),
    }
}
