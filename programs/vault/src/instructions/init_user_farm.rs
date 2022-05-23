use anchor_lang::prelude::*;

pub trait FarmInitializer<'info> {
    fn initialize_user_farm(&mut self, bump: u8) -> ProgramResult;
}

pub fn handle<'info, T: FarmInitializer<'info>>(
    ctx: Context<'_, '_, '_, 'info, T>,
    bump: u8,
) -> ProgramResult {
    ctx.accounts.initialize_user_farm(bump)
}
