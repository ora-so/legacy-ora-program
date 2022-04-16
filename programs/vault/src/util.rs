use {
    crate::error::ErrorCode,
    anchor_lang::{
        prelude::*,
        solana_program::{
            program::invoke_signed,
            program_memory::sol_memcmp,
            program_pack::{IsInitialized, Pack},
            pubkey::PUBKEY_BYTES,
        },
    },
    spl_associated_token_account::get_associated_token_address,
    spl_token::state::Account as SplAccount,
};

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
