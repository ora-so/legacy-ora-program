use anchor_lang::prelude::*;

mod context;
mod error;
mod instructions;

use context::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod bucket_vault {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> ProgramResult {
        instructions::initialize::handle(ctx)?;
        
        Ok(())
    }

    pub fn deposit(ctx: Context<Deposit>) -> ProgramResult {
        instructions::deposit::handle(ctx)?;

        Ok(())
    }

    pub fn withdraw(ctx: Context<Withdraw>) -> ProgramResult {
        instructions::withdraw::handle(ctx)?;

        Ok(())
    }
}