use {
    crate::{constant::VAULT_SEED, context::Withdraw},
    anchor_lang::prelude::*,
};

pub fn handle(
    ctx: Context<Withdraw>,
    pool_token_amount: u64,
    minimum_token_a_amount: u64,
    minimum_token_b_amount: u64,
) -> ProgramResult {
    let authority = ctx.accounts.authority.key();

    stable_swap_anchor::withdraw(
        ctx.accounts
            .into_saber_swap_withdraw_context()
            .with_signer(&[&[
                VAULT_SEED.as_bytes(),
                authority.to_bytes().as_ref(),
                &[ctx.accounts.vault.bump],
            ]]),
        pool_token_amount,
        minimum_token_a_amount,
        minimum_token_b_amount,
    )?;

    Ok(())
}
