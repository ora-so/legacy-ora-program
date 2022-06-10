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
use state::{GlobalProtocolState, Vault, VaultConfig};

declare_id!("CRDRY8VKkjPBBoyurn3jQdy7n2TjgexDqfePno5gnQxV");

#[program]
pub mod vault {
    use super::*;

    // ========= [NATIVE VAULT] =========

    pub fn initialize_global_protocol_state(
        ctx: Context<InitializeGlobalProtocolState>,
        bump: u8,
    ) -> ProgramResult {
        instructions::init_global_protocol_state::handle(ctx, bump)
    }

    // todo: update sdk
    #[access_control(protocol_not_paused(&ctx.accounts.global_protocol_state))]
    pub fn initialize_vault(
        ctx: Context<InitializeVault>,
        vault_bump: u8,
        vault_store_bump: u8,
        vault_config: VaultConfig,
    ) -> ProgramResult {
        instructions::init_vault::handle(ctx, vault_bump, vault_store_bump, vault_config)
    }

    #[access_control(protocol_not_paused(&ctx.accounts.global_protocol_state))]
    pub fn transition_vault(
        ctx: Context<TransitionVault>,
        target_state: String,
        timestamp: u64,
    ) -> ProgramResult {
        instructions::transition_vault::handle(ctx, target_state, timestamp)
    }

    #[allow(unused_must_use)]
    #[access_control(
        protocol_not_paused(&ctx.accounts.global_protocol_state) &&
        verify_vault_store(&ctx.accounts.vault, ctx.accounts.vault_store.key)
    )]
    pub fn deposit(
        ctx: Context<Deposit>,
        deposit_index: u64,
        receipt_bump: u8,
        history_bump: u8,
        amount: u64,
    ) -> ProgramResult {
        instructions::deposit::handle(ctx, deposit_index, receipt_bump, history_bump, amount)
    }

    #[access_control(protocol_not_paused(&ctx.accounts.global_protocol_state))]
    pub fn process_claims<'info>(
        ctx: Context<'_, '_, '_, 'info, ProcessClaims<'info>>,
    ) -> ProgramResult {
        instructions::process_claims::handle(ctx)
    }

    #[allow(unused_must_use)]
    #[access_control(
        protocol_not_paused(&ctx.accounts.global_protocol_state) &&
        verify_vault_store(&ctx.accounts.vault, ctx.accounts.vault_store.key)
    )]
    pub fn claim(ctx: Context<Claim>) -> ProgramResult {
        instructions::claim::handle(ctx)
    }

    // todo: amounts correct on here?
    #[allow(unused_must_use)]
    #[access_control(
        protocol_not_paused(&ctx.accounts.global_protocol_state) &&
        verify_vault_store(&ctx.accounts.vault, ctx.accounts.vault_store.key)
    )]
    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> ProgramResult {
        instructions::withdraw::handle(ctx, amount)
    }

    // ========= [ORCA] =========

    #[access_control(protocol_not_paused(&ctx.accounts.global_protocol_state))]
    pub fn initialize_orca<'info>(
        ctx: Context<'_, '_, '_, 'info, InitializeOrca<'info>>,
        bump: u8,
        flag: u64,
        version: u16,
    ) -> ProgramResult {
        instructions::init_strategy::handle(ctx, bump, flag, version)
    }

    // todo: update sdk; vault_store, not vault
    #[allow(unused_must_use)]
    #[access_control(
        protocol_not_paused(&ctx.accounts.global_protocol_state) &&
        verify_vault_store(&ctx.accounts.vault, ctx.accounts.vault_store.key)
    )]
    pub fn rebalance_orca<'info>(
        ctx: Context<'_, '_, '_, 'info, RebalanceOrca<'info>>,
        swap_config: Option<SwapConfig>,
    ) -> ProgramResult {
        instructions::rebalance::handle(ctx, swap_config)
    }

    // ========= [ORCA :: POOL] =========

    // todo: update sdk; vault_store, not vault
    // todo: update logic that maps A/B pair to vault alpha/beta
    #[allow(unused_must_use)]
    #[access_control(
        protocol_not_paused(&ctx.accounts.global_protocol_state) &&
        verify_vault_store(&ctx.accounts.vault, ctx.accounts.vault_store.key)
    )]
    pub fn invest_orca<'info>(
        ctx: Context<'_, '_, '_, 'info, InvestOrca<'info>>,
        investable_a: u64,
        investable_b: u64,
        min_tokens_back: u64,
    ) -> ProgramResult {
        instructions::invest::handle(ctx, investable_a, investable_b, min_tokens_back)
    }

    // todo: update sdk; vault_store, not vault
    // todo: update logic that maps A/B pair to vault alpha/beta
    #[allow(unused_must_use)]
    #[access_control(
        protocol_not_paused(&ctx.accounts.global_protocol_state) &&
        verify_vault_store(&ctx.accounts.vault, ctx.accounts.vault_store.key)
    )]
    pub fn redeem_orca<'info>(
        ctx: Context<'_, '_, '_, 'info, RedeemOrca<'info>>,
        min_token_a: u64,
        min_token_b: u64,
    ) -> ProgramResult {
        instructions::redeem::handle(ctx, min_token_a, min_token_b)
    }

    // todo: update sdk; vault_store, not vault
    #[allow(unused_must_use)]
    #[access_control(
        protocol_not_paused(&ctx.accounts.global_protocol_state) &&
        verify_vault_store(&ctx.accounts.vault, ctx.accounts.vault_store.key)
    )]
    pub fn swap_orca<'info>(
        ctx: Context<'_, '_, '_, 'info, SwapOrca<'info>>,
        amount_in: u64,
        min_amount_out: u64,
    ) -> ProgramResult {
        instructions::swap::handle(ctx, amount_in, min_amount_out)
    }

    // ========= [ORCA :: FARM] =========

    #[allow(unused_must_use)]
    #[access_control(
        protocol_not_paused(&ctx.accounts.global_protocol_state) &&
        verify_vault_store(&ctx.accounts.vault, ctx.accounts.vault_store.key)
    )]
    pub fn initialize_user_farm_orca<'info>(
        ctx: Context<'_, '_, '_, 'info, InitializeUserFarmOrca<'info>>,
    ) -> ProgramResult {
        instructions::init_user_farm::handle(ctx)
    }

    #[allow(unused_must_use)]
    #[access_control(
        protocol_not_paused(&ctx.accounts.global_protocol_state) &&
        verify_vault_store(&ctx.accounts.vault, ctx.accounts.vault_store.key)
    )]
    pub fn convert_orca_lp<'info>(
        ctx: Context<'_, '_, '_, 'info, ConvertOrcaLp<'info>>,
    ) -> ProgramResult {
        instructions::convert_lp::handle(ctx, None)
    }

    // todo: update sdk; vault_store, not vault
    #[allow(unused_must_use)]
    #[access_control(
        protocol_not_paused(&ctx.accounts.global_protocol_state) &&
        verify_vault_store(&ctx.accounts.vault, ctx.accounts.vault_store.key)
    )]
    pub fn harvest_orca<'info>(
        ctx: Context<'_, '_, '_, 'info, HarvestOrcaLp<'info>>,
    ) -> ProgramResult {
        instructions::harvest::handle(ctx, None)
    }

    // todo: update sdk; vault_store, not vault
    #[allow(unused_must_use)]
    #[access_control(
        protocol_not_paused(&ctx.accounts.global_protocol_state) &&
        verify_vault_store(&ctx.accounts.vault, ctx.accounts.vault_store.key)
    )]
    pub fn revert_orca_lp<'info>(
        ctx: Context<'_, '_, '_, 'info, RevertOrcaLp<'info>>,
    ) -> ProgramResult {
        instructions::revert_lp::handle(ctx, None)
    }

    // ========= [SABER] =========

    #[access_control(protocol_not_paused(&ctx.accounts.global_protocol_state))]
    pub fn initialize_saber<'info>(
        ctx: Context<'_, '_, '_, 'info, InitializeSaber<'info>>,
        bump: u8,
        flag: u64,
        version: u16,
    ) -> ProgramResult {
        instructions::init_strategy::handle(ctx, bump, flag, version)
    }

    // ========= [SABER :: POOL] =========

    // todo: update logic that maps A/B pair to vault alpha/beta
    #[access_control(protocol_not_paused(&ctx.accounts.global_protocol_state))]
    pub fn invest_saber<'info>(
        ctx: Context<'_, '_, '_, 'info, InvestSaber<'info>>,
        investable_a: u64,
        investable_b: u64,
        min_tokens_back: u64,
    ) -> ProgramResult {
        instructions::invest::handle(ctx, investable_a, investable_b, min_tokens_back)
    }

    // todo: update logic that maps A/B pair to vault alpha/beta
    #[access_control(protocol_not_paused(&ctx.accounts.global_protocol_state))]
    pub fn redeem_saber<'info>(
        ctx: Context<'_, '_, '_, 'info, RedeemSaber<'info>>,
        min_token_a: u64,
        min_token_b: u64,
    ) -> ProgramResult {
        instructions::redeem::handle(ctx, min_token_a, min_token_b)
    }
}

fn protocol_not_paused(state: &Account<GlobalProtocolState>) -> ProgramResult {
    if !state.active {
        return Err(ErrorCode::ProtocolPaused.into());
    }

    Ok(())
}

fn verify_vault_store(vault: &Account<Vault>, vault_store: &Pubkey) -> ProgramResult {
    if vault.vault_store != *vault_store {
        return Err(ErrorCode::InvalidVaultStore.into());
    }

    Ok(())
}
