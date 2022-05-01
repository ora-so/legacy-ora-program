use {crate::context::InitializeSaberStrategy, anchor_lang::prelude::*};

/**
 * todo: serialize more data to perform checks / guard-rail data on saber deposits
 */
pub fn handle(ctx: Context<InitializeSaberStrategy>, bump: u8) -> ProgramResult {
    let token_a = ctx.accounts.token_a.key();
    let token_b = ctx.accounts.token_a.key();

    msg!(
        "initializing saber strategy {} with token A {} and token B {}",
        ctx.accounts.saber_strategy.key(),
        token_a,
        token_b
    );

    // ex how to create on-chain and set memory directly:
    // https://github.com/metaplex-foundation/metaplex-program-library/blob/master/auction-house/program/src/bid/mod.rs#L266
    ctx.accounts.saber_strategy.init(
        bump,
        1u64 << 0, // todo: figure out how to set this more elegantly? reference the enum
        ctx.accounts.token_a.key(),
        ctx.accounts.token_b.key(),
    );

    Ok(())
}
