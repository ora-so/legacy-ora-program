use {
    crate::{constant::VAULT_SEED, context::Deposit},
    anchor_lang::prelude::*,
};

pub fn handle(
    ctx: Context<Deposit>,
    token_a_amount: u64,
    token_b_amount: u64,
    min_mint_amount: u64,
) -> ProgramResult {
    let authority = ctx.accounts.authority.key();

    stable_swap_anchor::deposit(
        ctx.accounts
            .into_saber_swap_deposit_context()
            .with_signer(&[&[
                VAULT_SEED.as_bytes(),
                authority.to_bytes().as_ref(),
                &[ctx.accounts.vault.bump],
            ]]),
        token_a_amount,
        token_b_amount,
        min_mint_amount,
    )?;

    Ok(())
}
