use {
    crate::{constant::VAULT_SEED, context::Deposit},
    anchor_lang::prelude::*,
    anchor_spl::token::transfer,
};

pub fn handle(
    ctx: Context<Deposit>,
    token_a_amount: u64,
    token_b_amount: u64,
    min_mint_amount: u64,
) -> ProgramResult {
    // note: we don't check attempted transfer amounts vs actual ATA balances because transfer CPI call will
    // handle this for us. analogously, token_a_amount + token_b_amount <= min_mint_amount because saber CPI call
    // will handle this for us. additionally, in the future, we might want to handle input vs output ratios ourselves,
    // aka deciding how much slippage we are willing to accept. and/or, provide functionality for client to specify
    // their preferences.

    msg!(
        "Attempting to deposit {} of token {} and {} of token {} in exchange for minimum {} of LP token {}",
        token_a_amount,
        ctx.accounts.user_token_a.mint,
        token_b_amount,
        ctx.accounts.user_token_b.mint,
        min_mint_amount,
        ctx.accounts.saber_deposit.output_lp.mint
    );

    // transfer token A and B amounts from user ATAs to the vault ATAs
    transfer(
        ctx.accounts.into_transfer_token_context(
            ctx.accounts.user_token_a.to_account_info(),
            ctx.accounts
                .saber_deposit
                .saber_swap_common
                .source_token_a
                .to_account_info(),
        ),
        token_a_amount,
    )?;

    transfer(
        ctx.accounts.into_transfer_token_context(
            ctx.accounts.user_token_b.to_account_info(),
            ctx.accounts
                .saber_deposit
                .saber_swap_common
                .source_token_b
                .to_account_info(),
        ),
        token_b_amount,
    )?;

    let authority = ctx.accounts.authority.key();
    let vault_signer_seeds: &[&[&[u8]]] = &[&[
        VAULT_SEED.as_bytes(),
        authority.as_ref(),
        &[ctx.accounts.vault.bump],
    ]];

    // deposit tokens from vault ATA to saber pool. recieve LP tokens in a vault ATA.
    stable_swap_anchor::deposit(
        ctx.accounts
            .into_saber_swap_deposit_context()
            .with_signer(vault_signer_seeds),
        token_a_amount,
        token_b_amount,
        min_mint_amount,
    )?;

    // (feat): generate a deposit receipt as a PDA for historical record keeping purposees
    ctx.accounts.vault.increment_deposit_nonce();

    Ok(())
}
