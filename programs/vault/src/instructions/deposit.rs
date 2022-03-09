use {
    anchor_lang::prelude::*,
    crate::context::Deposit
};

pub fn handle(
    ctx: Context<Deposit>,
) -> ProgramResult {
    Ok(())
}
