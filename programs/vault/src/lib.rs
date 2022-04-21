use anchor_lang::prelude::*;

mod constant;
mod context;
mod error;
mod instructions;
mod state;
mod util;

use context::*;
use state::vault::VaultConfig;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod vault {
    use super::*;

    pub fn initialize_vault(
        ctx: Context<InitializeVault>,
        vault_bump: u8,
        vault_config: VaultConfig,
    ) -> ProgramResult {
        instructions::initialize_vault::handle(ctx, vault_bump, vault_config)?;
        Ok(())
    }

    // dev note: correct amount should account for per mint decimals off-chain
    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> ProgramResult {
        instructions::deposit::handle(ctx, amount)?;

        Ok(())
    }

    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> ProgramResult {
        instructions::withdraw::handle(ctx, amount)?;

        Ok(())
    }
}
