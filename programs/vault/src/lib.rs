use anchor_lang::prelude::*;

mod constant;
mod context;
mod error;
mod instructions;
mod state;

use context::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod bucket_vault {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, vault_bump: u8) -> ProgramResult {
        instructions::initialize::handle(ctx, vault_bump)?;

        Ok(())
    }

    pub fn deposit(
        ctx: Context<Deposit>,
        token_a_amount: u64,
        token_b_amount: u64,
        min_mint_amount: u64,
    ) -> ProgramResult {
        instructions::deposit::handle(ctx, token_a_amount, token_b_amount, min_mint_amount)?;

        Ok(())
    }

    pub fn withdraw(
        ctx: Context<Withdraw>,
        pool_token_amount: u64,
        minimum_token_a_amount: u64,
        minimum_token_b_amount: u64,
    ) -> ProgramResult {
        instructions::withdraw::handle(
            ctx,
            pool_token_amount,
            minimum_token_a_amount,
            minimum_token_b_amount,
        )?;

        Ok(())
    }
}
