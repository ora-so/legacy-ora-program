use {
    crate::{
        constant::{HISTORY_SEED, RECEIPT_SEED},
        error::ErrorCode,
        id,
    },
    anchor_lang::{
        prelude::*,
        solana_program::{
            clock,
            program::invoke_signed,
            program_memory::sol_memcmp,
            program_pack::{IsInitialized, Pack},
            pubkey::PUBKEY_BYTES,
            system_instruction,
        },
    },
    anchor_spl::token::{mint_to, transfer, MintTo, Transfer},
    spl_associated_token_account::get_associated_token_address,
    spl_token::state::Account as SplAccount,
    std::convert::TryInto,
};

pub fn get_current_timestamp() -> Result<u64, ProgramError> {
    // i64 -> u64 ok to unwrap
    Ok(clock::Clock::get()?.unix_timestamp.try_into().unwrap())
}

pub fn assert_initialized<T: Pack + IsInitialized>(
    account_info: &AccountInfo,
) -> Result<T, ProgramError> {
    let account: T = T::unpack_unchecked(&account_info.data.borrow())?;
    if !account.is_initialized() {
        return Err(ErrorCode::UninitializedAccount.into());
    } else {
        Ok(account)
    }
}

pub fn assert_owned_by(account: &AccountInfo, owner: &Pubkey) -> Result<(), ProgramError> {
    if account.owner != owner {
        return Err(ErrorCode::IncorrectOwner.into());
    } else {
        Ok(())
    }
}

pub fn assert_keys_equal(key1: Pubkey, key2: Pubkey) -> Result<(), ProgramError> {
    if sol_memcmp(key1.as_ref(), key2.as_ref(), PUBKEY_BYTES) != 0 {
        return Err(ErrorCode::PublicKeyMismatch.into());
    } else {
        Ok(())
    }
}

/// Create account almost from scratch, lifted from
/// <https://github.com/metaplex-foundation/metaplex-program-library/blob/master/auction-house/program/src/utils.rs>
/// <https://github.com/solana-labs/solana-program-library/blob/7d4873c61721aca25464d42cc5ef651a7923ca79/associated-token-account/program/src/processor.rs#L51-L98>
#[inline(always)]
pub fn create_or_allocate_account_raw<'a>(
    program_id: Pubkey,
    new_account_info: &AccountInfo<'a>,
    rent_sysvar_info: &AccountInfo<'a>,
    system_program_info: &AccountInfo<'a>,
    payer_info: &AccountInfo<'a>,
    size: usize,
    signer_seeds: &[&[u8]],
    new_acct_seeds: &[&[u8]],
) -> std::result::Result<(), ProgramError> {
    let rent = &Rent::from_account_info(rent_sysvar_info)?;
    let required_lamports = rent
        .minimum_balance(size)
        .max(1)
        .saturating_sub(new_account_info.lamports());

    if required_lamports > 0 {
        msg!("Transfer {} lamports to the new account", required_lamports);
        let seeds: &[&[&[u8]]];
        let as_arr = [signer_seeds];

        if signer_seeds.len() > 0 {
            seeds = &as_arr;
        } else {
            seeds = &[];
        }
        invoke_signed(
            &system_instruction::transfer(&payer_info.key, new_account_info.key, required_lamports),
            &[
                payer_info.clone(),
                new_account_info.clone(),
                system_program_info.clone(),
            ],
            seeds,
        )?;
    }

    let accounts = &[new_account_info.clone(), system_program_info.clone()];

    msg!("Allocate space for the account {}", new_account_info.key);
    invoke_signed(
        &system_instruction::allocate(new_account_info.key, size.try_into().unwrap()),
        accounts,
        &[&new_acct_seeds],
    )?;

    msg!("Assign the account to the owning program");
    invoke_signed(
        &system_instruction::assign(new_account_info.key, &program_id),
        accounts,
        &[&new_acct_seeds],
    )?;
    msg!("Completed assignation!");

    Ok(())
}

pub fn assert_is_ata(
    ata: &AccountInfo,
    wallet: &Pubkey,
    mint: &Pubkey,
) -> Result<SplAccount, ProgramError> {
    let ata_account: SplAccount = assert_initialized(ata)?;

    assert_owned_by(ata, &spl_token::id())?;
    assert_keys_equal(ata_account.owner, *wallet)?;
    assert_keys_equal(ata_account.mint, *mint)?;
    assert_keys_equal(get_associated_token_address(wallet, mint), *ata.key)?;
    Ok(ata_account)
}

pub fn create_ata_if_dne<'a>(
    ata: AccountInfo<'a>,
    wallet: AccountInfo<'a>,
    mint: AccountInfo<'a>,
    fee_payer: AccountInfo<'a>,
    ata_program: AccountInfo<'a>,
    token_program: AccountInfo<'a>,
    system_program: AccountInfo<'a>,
    rent: AccountInfo<'a>,
    fee_payer_seeds: &[&[u8]],
) -> Result<(), ProgramError> {
    if ata.data_is_empty() {
        let seeds: &[&[&[u8]]];
        let as_arr = [fee_payer_seeds];

        if fee_payer_seeds.len() > 0 {
            seeds = &as_arr;
        } else {
            seeds = &[];
        }

        invoke_signed(
            &spl_associated_token_account::create_associated_token_account(
                &fee_payer.key,
                &wallet.key,
                &mint.key,
            ),
            &[
                ata,
                wallet,
                mint,
                fee_payer,
                ata_program,
                system_program,
                rent,
                token_program,
            ],
            seeds,
        )?;
    }

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
pub fn verify_ata<'info>(
    destination: AccountInfo<'info>,
    wallet: AccountInfo<'info>,
    mint: AccountInfo<'info>,
    fee_payer: AccountInfo<'info>,
    ata_program: AccountInfo<'info>,
    token_program: AccountInfo<'info>,
    system_program: AccountInfo<'info>,
    rent: AccountInfo<'info>,
    fee_payer_seeds: &[&[u8]],
) -> ProgramResult {
    create_ata_if_dne(
        destination.clone(),
        wallet.clone(),
        mint.clone(),
        fee_payer.clone(),
        ata_program,
        token_program.clone(),
        system_program,
        rent,
        fee_payer_seeds,
    )?;

    assert_is_ata(&destination, &wallet.key(), &mint.key())?;

    Ok(())
}

// Call system transfer instruction after creating destination ATA if it DNE, and verifying the ATA
pub fn transfer_with_verified_ata<'info>(
    source: AccountInfo<'info>,
    destination: AccountInfo<'info>,
    wallet: AccountInfo<'info>,
    mint: AccountInfo<'info>,
    fee_payer: AccountInfo<'info>,
    ata_program: AccountInfo<'info>,
    token_program: AccountInfo<'info>,
    system_program: AccountInfo<'info>,
    rent: AccountInfo<'info>,
    fee_payer_seeds: &[&[u8]],
    transfer_authority: AccountInfo<'info>,
    transfer_authority_seeds: &[&[u8]],
    amount: u64,
) -> ProgramResult {
    verify_ata(
        destination.clone(),
        wallet,
        mint,
        fee_payer.clone(),
        ata_program,
        token_program.clone(),
        system_program,
        rent,
        fee_payer_seeds,
    )?;

    let transfer_accounts = Transfer {
        from: source,
        to: destination,
        authority: transfer_authority,
    };

    transfer(
        CpiContext::new(token_program, transfer_accounts).with_signer(&[transfer_authority_seeds]),
        amount,
    )?;

    Ok(())
}

pub fn mint_with_verified_ata<'info>(
    destination: AccountInfo<'info>,
    wallet: AccountInfo<'info>,
    mint: AccountInfo<'info>,
    fee_payer: AccountInfo<'info>,
    ata_program: AccountInfo<'info>,
    token_program: AccountInfo<'info>,
    system_program: AccountInfo<'info>,
    rent: AccountInfo<'info>,
    fee_payer_seeds: &[&[u8]],
    mint_authority: AccountInfo<'info>,
    mint_authority_seeds: &[&[u8]],
    amount: u64,
) -> ProgramResult {
    verify_ata(
        destination.clone(),
        wallet,
        mint.clone(),
        fee_payer.clone(),
        ata_program,
        token_program.clone(),
        system_program,
        rent,
        fee_payer_seeds,
    )?;

    let mint_to_accounts = MintTo {
        mint: mint,
        to: destination,
        authority: mint_authority,
    };

    // make sure mint authority signs
    mint_to(
        CpiContext::new(token_program, mint_to_accounts).with_signer(&[mint_authority_seeds]),
        amount,
    )?;

    Ok(())
}

/**
 * Calculate amount after slippage in basis points, 10_000 is upper bound.
 *
 * Sample usage:
 *
 * let total = 100_000;
 * let slippage_tolerance = 100; // 100 bips, 1%
 *
 * let result = with_slippage(
 *   100_000,
 *   slippage_tolerance,
 * )?;
 *
 * require!(result == 99_000, "oh no");
 *
 */
pub fn with_slippage(amount: u64, slippage: u16) -> std::result::Result<u64, ProgramError> {
    let total = 10_000_usize;
    let slippage_inverse = total
        .checked_sub(slippage.into())
        .ok_or_else(math_error!())?;

    let result = (amount as usize)
        .checked_mul(slippage_inverse)
        .ok_or_else(math_error!())?
        .checked_div(total)
        .ok_or_else(math_error!())?;

    Ok(result as u64)
}

pub fn get_receipt_address_and_bump_seed(
    vault: &Pubkey,
    asset: &Pubkey,
    index: u64,
) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[
            RECEIPT_SEED.as_bytes(),
            &vault.to_bytes(),
            &asset.to_bytes(),
            &index.to_le_bytes(),
        ],
        &id(),
    )
}

pub fn get_history_address_and_bump_seed(
    vault: &Pubkey,
    asset: &Pubkey,
    user: &Pubkey,
) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[
            HISTORY_SEED.as_bytes(),
            &vault.to_bytes(),
            &asset.to_bytes(),
            &user.to_bytes(),
        ],
        &id(),
    )
}

pub fn assert_valid_pda(
    account_info: &AccountInfo,
    expected_pubkey: &Pubkey,
    is_valid_bump: bool,
) -> Result<(), ProgramError> {
    require!(
        !account_info.data_is_empty(),
        ErrorCode::UninitializedAccount
    );
    assert_owned_by(account_info, &id())?;
    assert_keys_equal(account_info.key(), *expected_pubkey)?;
    require!(is_valid_bump, ErrorCode::BumpMismatch);

    Ok(())
}
