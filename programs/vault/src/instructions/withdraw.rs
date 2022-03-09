use {
    anchor_lang::prelude::*,
    crate::context::Withdraw,
};

pub fn handle(
    ctx: Context<Withdraw>,
) -> ProgramResult {
    Ok(())
}
