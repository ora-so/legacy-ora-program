use anchor_lang::prelude::*;

pub trait StrategyInitializer<'info> {
    fn initialize_strategy(&mut self, bump: u8, flag: u64, version: u16) -> ProgramResult;
}

pub fn handle<'info, T: StrategyInitializer<'info>>(
    ctx: Context<'_, '_, '_, 'info, T>,
    bump: u8,
    flag: u64,
    version: u16,
) -> ProgramResult {
    ctx.accounts.initialize_strategy(bump, flag, version)
}
