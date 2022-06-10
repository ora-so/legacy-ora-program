use anchor_lang::prelude::*;

pub trait FarmInitializer<'info> {
    fn initialize_user_farm(&mut self) -> ProgramResult;
}

pub fn handle<'info, T: FarmInitializer<'info>>(
    ctx: Context<'_, '_, '_, 'info, T>,
) -> ProgramResult {
    ctx.accounts.initialize_user_farm()
}
