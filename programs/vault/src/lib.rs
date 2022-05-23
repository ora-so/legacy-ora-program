use anchor_lang::prelude::*;

#[macro_use]
mod macros;

mod adapters;
mod constant;
mod error;
mod instructions;
mod state;
mod util;

use adapters::*;
use error::ErrorCode;
use instructions::*;
use state::{GlobalProtocolState, VaultConfig};

declare_id!("56YRTVX6MNrpQgnGQbzAq7xPyeqyY9ShDrpRNkyMpUgj");

#[program]
pub mod vault {
    use super::*;

    pub fn initialize_global_protocol_state(
        ctx: Context<InitializeGlobalProtocolState>,
        bump: u8,
    ) -> ProgramResult {
        instructions::init_global_protocol_state::handle(ctx, bump)?;

        Ok(())
    }

    #[access_control(protocol_not_paused(&ctx.accounts.global_protocol_state))]
    pub fn initialize_saber<'info>(
        ctx: Context<'_, '_, '_, 'info, InitializeSaber<'info>>,
        bump: u8,
        flag: u64,
        version: u16,
    ) -> ProgramResult {
        instructions::init_strategy::handle(ctx, bump, flag, version)?;

        Ok(())
    }

    #[access_control(protocol_not_paused(&ctx.accounts.global_protocol_state))]
    pub fn initialize_orca<'info>(
        ctx: Context<'_, '_, '_, 'info, InitializeOrca<'info>>,
        bump: u8,
        flag: u64,
        version: u16,
    ) -> ProgramResult {
        instructions::init_strategy::handle(ctx, bump, flag, version)?;

        Ok(())
    }

    #[access_control(protocol_not_paused(&ctx.accounts.global_protocol_state))]
    pub fn initialize_vault(
        ctx: Context<InitializeVault>,
        vault_bump: u8,
        vault_config: VaultConfig,
    ) -> ProgramResult {
        instructions::init_vault::handle(ctx, vault_bump, vault_config)?;

        Ok(())
    }

    #[access_control(protocol_not_paused(&ctx.accounts.global_protocol_state))]
    pub fn deposit(
        ctx: Context<Deposit>,
        deposit_index: u64,
        receipt_bump: u8,
        history_bump: u8,
        amount: u64,
    ) -> ProgramResult {
        instructions::deposit::handle(ctx, deposit_index, receipt_bump, history_bump, amount)?;

        Ok(())
    }

    #[access_control(protocol_not_paused(&ctx.accounts.global_protocol_state))]
    pub fn process_claims(ctx: Context<ProcessClaims>) -> ProgramResult {
        instructions::process_claims::handle(ctx)?;

        Ok(())
    }

    #[access_control(protocol_not_paused(&ctx.accounts.global_protocol_state))]
    pub fn claim(ctx: Context<Claim>) -> ProgramResult {
        instructions::claim::handle(ctx)?;

        Ok(())
    }

    #[access_control(protocol_not_paused(&ctx.accounts.global_protocol_state))]
    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> ProgramResult {
        instructions::withdraw::handle(ctx, amount)?;

        Ok(())
    }

    // todo: update logic that maps A/B pair to vault alpha/beta
    #[access_control(protocol_not_paused(&ctx.accounts.global_protocol_state))]
    pub fn invest_saber<'info>(
        ctx: Context<'_, '_, '_, 'info, InvestSaber<'info>>,
        investable_a: u64,
        investable_b: u64,
        min_tokens_back: u64,
    ) -> ProgramResult {
        instructions::invest::handle(ctx, investable_a, investable_b, min_tokens_back)?;

        Ok(())
    }

    // todo: update logic that maps A/B pair to vault alpha/beta
    #[access_control(protocol_not_paused(&ctx.accounts.global_protocol_state))]
    pub fn invest_orca<'info>(
        ctx: Context<'_, '_, '_, 'info, InvestOrca<'info>>,
        investable_a: u64,
        investable_b: u64,
        min_tokens_back: u64,
    ) -> ProgramResult {
        instructions::invest::handle(ctx, investable_a, investable_b, min_tokens_back)?;

        Ok(())
    }

    #[access_control(protocol_not_paused(&ctx.accounts.global_protocol_state))]
    pub fn initialize_user_farm_orca<'info>(
        ctx: Context<'_, '_, '_, 'info, InitializeUserFarmOrca<'info>>,
        bump: u8,
    ) -> ProgramResult {
        instructions::init_user_farm::handle(ctx, bump)?;

        Ok(())
    }

    #[access_control(protocol_not_paused(&ctx.accounts.global_protocol_state))]
    pub fn convert_orca_lp<'info>(
        ctx: Context<'_, '_, '_, 'info, ConvertOrcaLp<'info>>,
        bump: u8,
    ) -> ProgramResult {
        instructions::convert_lp::handle(ctx, bump, None)?;

        Ok(())
    }

    #[access_control(protocol_not_paused(&ctx.accounts.global_protocol_state))]
    pub fn harvest_orca<'info>(
        ctx: Context<'_, '_, '_, 'info, HarvestOrcaLp<'info>>,
        bump: u8,
    ) -> ProgramResult {
        instructions::harvest::handle(ctx, bump, None)?;

        Ok(())
    }

    #[access_control(protocol_not_paused(&ctx.accounts.global_protocol_state))]
    pub fn revert_orca_lp<'info>(
        ctx: Context<'_, '_, '_, 'info, RevertOrcaLp<'info>>,
        bump: u8,
    ) -> ProgramResult {
        instructions::revert_lp::handle(ctx, bump, None)?;

        Ok(())
    }

    // todo: update logic that maps A/B pair to vault alpha/beta
    #[access_control(protocol_not_paused(&ctx.accounts.global_protocol_state))]
    pub fn redeem_saber<'info>(
        ctx: Context<'_, '_, '_, 'info, RedeemSaber<'info>>,
        min_token_a: u64,
        min_token_b: u64,
        swap_config: Option<SwapConfig>,
    ) -> ProgramResult {
        instructions::redeem::handle(ctx, min_token_a, min_token_b, swap_config)?;

        Ok(())
    }

    // todo: update logic that maps A/B pair to vault alpha/beta
    #[access_control(protocol_not_paused(&ctx.accounts.global_protocol_state))]
    pub fn redeem_orca<'info>(
        ctx: Context<'_, '_, '_, 'info, RedeemOrca<'info>>,
        min_token_a: u64,
        min_token_b: u64,
        swap_config: Option<SwapConfig>,
    ) -> ProgramResult {
        instructions::redeem::handle(ctx, min_token_a, min_token_b, swap_config)?;

        Ok(())
    }

    #[access_control(protocol_not_paused(&ctx.accounts.global_protocol_state))]
    pub fn swap_orca<'info>(
        ctx: Context<'_, '_, '_, 'info, SwapOrca<'info>>,
        bump: u8,
        amount_in: u64,
        min_amount_out: u64,
    ) -> ProgramResult {
        instructions::swap::handle(ctx, bump, amount_in, min_amount_out)?;

        Ok(())
    }
}

fn protocol_not_paused(state: &Account<GlobalProtocolState>) -> ProgramResult {
    if !state.active {
        return Err(ErrorCode::ProtocolPaused.into());
    }
    Ok(())
}
