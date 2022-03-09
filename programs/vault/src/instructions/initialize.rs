use {
    crate::context::Initialize,
    anchor_lang::prelude::*,
};

pub fn handle(ctx: Context<Initialize>, vault_bump: u8) -> ProgramResult {
    msg!(
        "initializing vault {} with authority {}",
        ctx.accounts.vault.key(),
        ctx.accounts.authority.key()
    );

    ctx.accounts.vault.init(
        vault_bump,
        ctx.accounts.authority.key(),
    );

    Ok(())
}
