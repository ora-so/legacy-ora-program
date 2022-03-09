use {
    crate::{constant::VAULT_SEED, context::Withdraw},
    anchor_lang::prelude::*,
    anchor_spl::token::transfer,
};

/// assume we will always want to withdraw an some amount of both underlying assets in a pool.
/// the other option is to withdraw a single asset. this is inoptimal, as a one-sided withdrawal
/// could result in extra fees. this is to incentivize users to keep the pool balanced.
/// https://github.com/saber-hq/stable-swap/blob/9c93edf591908c0198273546b6c17e07da56b11c/stable-swap-anchor/src/instructions.rs#L167
pub fn handle(
    ctx: Context<Withdraw>,
    pool_token_amount: u64,
    minimum_token_a_amount: u64,
    minimum_token_b_amount: u64,
) -> ProgramResult {
    // note: we don't check attempted transfer amounts vs actual ATA balances because transfer CPI call will
    // handle this for us. anagously, token_a_amount + token_b_amount <= min_mint_amount because saber CPI call
    // will handle this for us. additionally, in the future, we might want to handle input vs output ratios ourselves,
    // aka deciding how much slippage we are willing to accept. and/or, provide functionality for client to specify
    // their preferences.

    let authority = ctx.accounts.authority.key();
    let vault_signer_seeds: &[&[&[u8]]] = &[&[
        VAULT_SEED.as_bytes(),
        authority.as_ref(),
        &[ctx.accounts.vault.bump],
    ]];

    // transfer LP tokens from vault ATA in exchange for some ratio of tokens the specified saber pool.
    stable_swap_anchor::withdraw(
        ctx.accounts
            .into_saber_swap_withdraw_context()
            .with_signer(vault_signer_seeds),
        pool_token_amount,
        minimum_token_a_amount,
        minimum_token_b_amount,
    )?;

    // transfer token A and B amounts from vault ATAs to the authority ATAs
    transfer(
        ctx.accounts
            .into_transfer_token_context(
                ctx.accounts.user_token_a.to_account_info(),
                ctx.accounts
                    .saber_withdraw
                    .saber_swap_common
                    .source_token_a
                    .to_account_info(),
            )
            .with_signer(vault_signer_seeds),
        minimum_token_a_amount,
    )?;

    transfer(
        ctx.accounts
            .into_transfer_token_context(
                ctx.accounts.user_token_b.to_account_info(),
                ctx.accounts
                    .saber_withdraw
                    .saber_swap_common
                    .source_token_b
                    .to_account_info(),
            )
            .with_signer(vault_signer_seeds),
        minimum_token_b_amount,
    )?;

    // (feat): generate a withdrawal receipt as a PDA for historical record keeping purposes?
    ctx.accounts.vault.increment_withdrawal_nonce();

    Ok(())
}
