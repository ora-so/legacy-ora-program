use {
    crate::{
        error::ErrorCode,
        math_error
    },
    anchor_lang::{
        prelude::*,
        solana_program::{
            program::invoke_signed,
            program_memory::sol_memcmp,
            program_pack::{IsInitialized, Pack},
            pubkey::PUBKEY_BYTES,
            clock,
        },
    },
    spl_associated_token_account::get_associated_token_address,
    spl_token::state::Account as SplAccount,
    std::convert::TryInto,
    anchor_spl::token::{transfer, Transfer, mint_to, MintTo},
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

pub fn assert_is_ata(
    ata: &AccountInfo,
    wallet: &Pubkey,
    mint: &Pubkey,
) -> Result<SplAccount, ProgramError> {
    assert_owned_by(ata, &spl_token::id())?;
    let ata_account: SplAccount = assert_initialized(ata)?;
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

    assert_is_ata(
        &destination,
        &wallet.key(),
        &mint.key(),
    )?;

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
    transfer_authority:  AccountInfo<'info>,
    transfer_authority_seeds: &[&[u8]],
    amount: u64
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

    transfer(CpiContext::new(token_program, transfer_accounts)
        .with_signer(&[transfer_authority_seeds]), amount)?;

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
    amount: u64
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
    mint_to(CpiContext::new(token_program, mint_to_accounts)
        .with_signer(&[mint_authority_seeds]), amount)?;

    Ok(())
}

// assuming slippage is in basis points, 10_000 is max amount
pub fn with_slippage(
    amount: u64,
    slippage: u16
) -> std::result::Result<u64, ProgramError> {
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
