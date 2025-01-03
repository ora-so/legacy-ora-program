pub mod external;

// todo: figure out how to get rid of the double error code import (right now * is due to saber's unwrap_or_err method)
use crate::error::{ErrorCode, OraResult};
use crate::{
    constant::{GLOBAL_STATE_SEED, STRATEGY_SEED, VAULT_SEED, VAULT_STORE_SEED},
    convert_lp::Converter,
    error::ErrorCode::*,
    harvest::Harvester,
    init_strategy::StrategyInitializer,
    init_user_farm::FarmInitializer,
    invest::Invest,
    rebalance::{Rebalance, SwapConfig},
    redeem::Redeem,
    revert_lp::Reverter,
    state::{GlobalProtocolState, HasVault, StrategyFlag, Vault},
    swap::Swapper,
    util::{get_spl_amount, get_spl_mint, transfer_from_signer},
};
use anchor_lang::prelude::*;
use anchor_spl::token::TokenAccount;
use anchor_spl::token::{Mint, Token};
use external::*;
use std::mem::size_of;
use std::ops::{Deref, DerefMut};

pub struct PoolEndpoints<'info> {
    /// CHECK: temp struct we build ourselves
    pub user: AccountInfo<'info>,
    /// CHECK: temp struct we build ourselves
    pub pool: AccountInfo<'info>,
}

// map pool tokens A & B to vault tranche assets
pub fn into_pool_endpoints<'info>(
    alpha_mint: &Pubkey,
    beta_mint: &Pubkey,
    source_token_a_account_info: AccountInfo<'info>,
    from_token_a_account_info: AccountInfo<'info>,
    source_token_b_account_info: AccountInfo<'info>,
    from_token_b_account_info: AccountInfo<'info>,
) -> OraResult<(PoolEndpoints<'info>, PoolEndpoints<'info>)> {
    let alpha_asset: PoolEndpoints;
    let beta_asset: PoolEndpoints;

    let token_a_mint = get_spl_mint(&source_token_a_account_info)?;
    let token_b_mint = get_spl_mint(&source_token_b_account_info)?;

    // todo: migrate to match arm
    if token_a_mint == *alpha_mint && token_b_mint == *beta_mint {
        alpha_asset = PoolEndpoints {
            user: source_token_a_account_info,
            pool: from_token_a_account_info,
        };

        beta_asset = PoolEndpoints {
            user: source_token_b_account_info,
            pool: from_token_b_account_info,
        };
    } else if token_a_mint == *beta_mint && token_b_mint == *alpha_mint {
        alpha_asset = PoolEndpoints {
            user: source_token_b_account_info,
            pool: from_token_b_account_info,
        };

        beta_asset = PoolEndpoints {
            user: source_token_a_account_info,
            pool: from_token_a_account_info,
        };
    } else {
        return Err(PublicKeyMismatch.into());
    }

    Ok((alpha_asset, beta_asset))
}

#[repr(C)]
pub struct OrcaConfig {
    pub swap_program: Pubkey,
    pub farm_program: Pubkey,
    pub token_a: Pubkey,
    pub token_b: Pubkey,
    pub base_lp: Pubkey,
    pub farm_lp: Pubkey,
    pub double_dip_lp: Option<Pubkey>,
}

#[account]
#[derive(Default, Copy, PartialEq, Debug)]
pub struct OrcaStrategyDataV0 {
    /// pda bump
    pub bump: u8,
    /// helps decode specific strategy type
    pub flag: u64,
    /// version of data account
    pub version: u16,
    /// public key for the orca swap program
    pub swap_program: Pubkey,
    /// public key for the orca farm program
    pub farm_program: Pubkey,
    /// Pubkey token A
    pub token_a: Pubkey,
    /// Pubkey token B
    pub token_b: Pubkey,
    /// LP mint for a base pool
    pub base_lp: Pubkey,
    /// LP mint for a given pool's aquafarm
    pub farm_lp: Pubkey,
    /// LP mint for a given pool's double dip aquafarm
    pub double_dip_lp: Option<Pubkey>,
}

impl OrcaStrategyDataV0 {
    pub fn init(
        &mut self,
        bump: u8,
        flag: u64, // helps decode strategy type
        version: u16,
        config: OrcaConfig,
    ) -> Result<(), ProgramError> {
        StrategyFlag::validate_flag(flag)?;

        self.bump = bump;
        self.flag = flag;
        self.version = version;
        self.swap_program = config.swap_program;
        self.farm_program = config.farm_program;
        self.token_a = config.token_a;
        self.token_b = config.token_b;
        self.base_lp = config.base_lp;
        self.farm_lp = config.farm_lp;
        self.double_dip_lp = config.double_dip_lp;

        Ok(())
    }
}

// =====================================================================

#[derive(Accounts)]
#[instruction(bump: u8, flag: u64, version: u16)]
pub struct InitializeOrca<'info> {
    #[account(
        mut,
        constraint = global_protocol_state.authority.key() == authority.key()
    )]
    pub authority: Signer<'info>,

    #[account(
        seeds = [GLOBAL_STATE_SEED.as_bytes()],
        bump,
    )]
    pub global_protocol_state: Box<Account<'info, GlobalProtocolState>>,

    #[account(
        init,
        seeds = [
            STRATEGY_SEED.as_bytes(),
            &flag.to_le_bytes(),
            &version.to_le_bytes(),
            token_a.key().to_bytes().as_ref(),
            token_b.key().to_bytes().as_ref(),
            pool.key().to_bytes().as_ref(),
            base_lp.key().to_bytes().as_ref(),
            farm.key().to_bytes().as_ref(),
            farm_lp.key().to_bytes().as_ref(),
        ],
        bump,
        payer = authority,
        space = 8 + size_of::<OrcaStrategyDataV0>(),
    )]
    pub strategy: Box<Account<'info, OrcaStrategyDataV0>>,

    pub token_a: Box<Account<'info, Mint>>,

    pub token_b: Box<Account<'info, Mint>>,

    /// CHECK: unused in instruction, just to derive strategy key
    pub swap_program: UncheckedAccount<'info>,

    /// CHECK: unused in instruction, just to derive strategy key
    pub farm_program: UncheckedAccount<'info>,

    /// CHECK: unused in instruction, just to derive strategy key
    pub pool: UncheckedAccount<'info>,

    /// CHECK: unused in instruction, just to derive strategy key
    pub base_lp: UncheckedAccount<'info>,

    /// CHECK: unused in instruction, just to derive strategy key
    pub farm: UncheckedAccount<'info>,

    /// CHECK: unused in instruction, just to derive strategy key
    pub farm_lp: UncheckedAccount<'info>,

    /// CHECK: unused in instruction, just to derive strategy key
    pub double_dip_farm_lp: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,

    pub rent: Sysvar<'info, Rent>,
}

impl<'info> StrategyInitializer<'info> for InitializeOrca<'info> {
    fn initialize_strategy(&mut self, bump: u8, flag: u64, version: u16) -> ProgramResult {
        let default_pubkey = Pubkey::default();

        // if key == default_pubkey, indicates double dip farm DNE
        let _double_dip_lp = match *self.double_dip_farm_lp.key {
            key if key != default_pubkey => Some(key),
            _ => None,
        };

        self.strategy.init(
            bump,
            flag,
            version,
            OrcaConfig {
                swap_program: *self.swap_program.key,
                farm_program: *self.farm_program.key,
                token_a: self.token_a.key(),
                token_b: self.token_b.key(),
                base_lp: *self.base_lp.key,
                farm_lp: *self.farm_lp.key,
                double_dip_lp: _double_dip_lp,
            },
        )
    }
}

// =====================================================================

#[derive(Accounts)]
pub struct InvestOrca<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: read-only account to validate vault address
    pub authority: UncheckedAccount<'info>,

    #[account(
        seeds = [GLOBAL_STATE_SEED.as_bytes()],
        bump,
    )]
    pub global_protocol_state: Box<Account<'info, GlobalProtocolState>>,

    #[account(
        mut,
        seeds = [
            VAULT_SEED.as_bytes(),
            authority.key().to_bytes().as_ref()
        ],
        bump,
        constraint = vault.strategy == strategy.key(),
        constraint = vault.authority == authority.key(),
        constraint = vault.strategist == payer.key()
    )]
    pub vault: Box<Account<'info, Vault>>,

    /// CHECK: verified via instruction access_control
    #[account(mut)]
    pub vault_store: UncheckedAccount<'info>,

    pub strategy: Box<Account<'info, OrcaStrategyDataV0>>,

    pub system_program: Program<'info, System>,

    pub token_program: Program<'info, Token>,

    pub rent: Sysvar<'info, Rent>,

    // ====================================================
    // orca accounts
    // ====================================================
    /// CHECK: verfied via orca CPI
    pub orca_swap_program: UncheckedAccount<'info>,

    /// CHECK: verfied via orca CPI
    pub orca_pool: UncheckedAccount<'info>,

    /// CHECK: verfied via orca CPI
    pub orca_authority: UncheckedAccount<'info>,

    /// CHECK: verfied via orca CPI
    #[account(mut)]
    pub source_token_a: UncheckedAccount<'info>,

    /// CHECK: verfied via orca CPI
    #[account(mut)]
    pub source_token_b: UncheckedAccount<'info>,

    /// CHECK: verfied via orca CPI
    #[account(mut)]
    pub into_a: UncheckedAccount<'info>,

    /// CHECK: verfied via orca CPI
    #[account(mut)]
    pub into_b: UncheckedAccount<'info>,

    #[account(mut)]
    pub pool_token: Box<Account<'info, Mint>>,

    #[account(
        mut,
        associated_token::mint = pool_token.key(),
        associated_token::authority = vault_store, // todo: or vault_store.key?
    )]
    pub pool_account: Box<Account<'info, TokenAccount>>,
}

impl_has_vault!(InvestOrca<'_>);

impl<'info> Invest<'info> for InvestOrca<'info> {
    fn invest(&mut self, amount_a: u64, amount_b: u64, min_out: u64) -> OraResult<(u64, u64)> {
        let orca_swap_program_account_info = self.orca_swap_program.to_account_info();
        // root orca swap program ID, now we can make assume Orca will correctly verify orca related accounts during CPI
        require!(
            self.strategy.swap_program == *orca_swap_program_account_info.key,
            PublicKeyMismatch
        );

        let vault_alpha_mint = self.vault.alpha.mint;
        let vault_beta_mint = self.vault.beta.mint;

        msg!("get pool inputs");
        let (alpha_asset, beta_asset) = into_pool_endpoints(
            &vault_alpha_mint,
            &vault_beta_mint,
            self.source_token_a.to_account_info(),
            self.into_a.to_account_info(),
            self.source_token_b.to_account_info(),
            self.into_b.to_account_info(),
        )?;

        let alpha_amount_before = get_spl_amount(&alpha_asset.user)?;
        let beta_amount_before = get_spl_amount(&beta_asset.user)?;
        msg!("alpha_amount_before: {}", alpha_amount_before);
        msg!("beta_amount_before: {}", beta_amount_before);

        let vault_key = self.vault.key();
        let vault_store_signer_seeds =
            generate_vault_store_seeds!(*vault_key.as_ref(), self.vault.vault_store_bump);

        // @dev: instead of checking ATA ownership explicitly, the CPI will fail if the vault_store
        //       is not the authority over the source ATAs
        deposit(
            CreatePoolDeposit {
                orca_swap_program: orca_swap_program_account_info,
                orca_pool: self.orca_pool.to_account_info(),
                orca_authority: self.orca_authority.to_account_info(),
                user_transfer_authority: self.vault_store.to_account_info(),
                source_a: self.source_token_a.to_account_info(),
                source_b: self.source_token_b.to_account_info(),
                into_a: self.into_a.to_account_info(),
                into_b: self.into_b.to_account_info(),
                pool_token: self.pool_token.to_account_info(),
                pool_account: self.pool_account.to_account_info(),
                token_program: self.token_program.to_account_info(),
            },
            min_out,
            amount_a,
            amount_b,
            &[vault_store_signer_seeds],
        )?;

        let alpha_amount_after = get_spl_amount(&alpha_asset.user)?;
        let beta_amount_after = get_spl_amount(&beta_asset.user)?;
        msg!("alpha_amount_after: {}", alpha_amount_after);
        msg!("beta_amount_after: {}", beta_amount_after);

        // before - after because we invest funds, so before > after
        let alpha_invested_amount = alpha_amount_before
            .checked_sub(alpha_amount_after)
            .ok_or_else(math_error!())?;
        msg!("alpha_invested_amount: {}", alpha_invested_amount);

        let beta_invested_amount = beta_amount_before
            .checked_sub(beta_amount_after)
            .ok_or_else(math_error!())?;
        msg!("beta_invested_amount: {}", beta_invested_amount);

        let mutable_vault = self.vault_mut();
        mutable_vault
            .get_alpha_mut()?
            .make_investment(alpha_invested_amount)?;
        mutable_vault
            .get_beta_mut()?
            .make_investment(beta_invested_amount)?;

        Ok((alpha_invested_amount, beta_invested_amount))
    }
}

// =====================================================================

#[derive(Accounts)]
pub struct RedeemOrca<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: read-only account to validate vault address
    pub authority: UncheckedAccount<'info>,

    #[account(
        seeds = [GLOBAL_STATE_SEED.as_bytes()],
        bump,
    )]
    pub global_protocol_state: Box<Account<'info, GlobalProtocolState>>,

    #[account(
        mut,
        seeds = [
            VAULT_SEED.as_bytes(),
            authority.key().to_bytes().as_ref()
        ],
        bump,
        constraint = vault.strategy == strategy.key(),
        constraint = vault.authority == authority.key(),
        constraint = vault.strategist == payer.key()
    )]
    pub vault: Box<Account<'info, Vault>>,

    /// CHECK: verified via instruction access_control
    #[account(mut)]
    pub vault_store: UncheckedAccount<'info>,

    pub strategy: Box<Account<'info, OrcaStrategyDataV0>>,

    pub system_program: Program<'info, System>,

    pub token_program: Program<'info, Token>,

    pub rent: Sysvar<'info, Rent>,

    // ====================================================
    // orca accounts
    // ====================================================
    /// CHECK: verfied via orca CPI
    pub orca_swap_program: UncheckedAccount<'info>,

    /// CHECK: verfied via orca CPI
    pub orca_pool: UncheckedAccount<'info>,

    /// CHECK: verfied via orca CPI
    pub orca_authority: UncheckedAccount<'info>,

    #[account(mut)]
    pub pool_mint: Box<Account<'info, Mint>>,

    #[account(
        mut,
        associated_token::mint = pool_mint.key(),
        associated_token::authority = vault_store, // todo: or vault_store.key?
    )]
    pub source_pool_account: Box<Account<'info, TokenAccount>>,

    /// CHECK: verfied via orca CPI
    #[account(mut)]
    pub from_a: UncheckedAccount<'info>,

    /// CHECK: verfied via orca CPI
    #[account(mut)]
    pub from_b: UncheckedAccount<'info>,

    /// CHECK: verfied via orca CPI
    #[account(mut)]
    pub source_token_a: UncheckedAccount<'info>,

    /// CHECK: verfied via orca CPI
    #[account(mut)]
    pub source_token_b: UncheckedAccount<'info>,

    /// CHECK: verfied via orca CPI
    #[account(mut)]
    pub fee_account: UncheckedAccount<'info>,
}

impl_has_vault!(RedeemOrca<'_>);

impl<'info> Redeem<'info> for RedeemOrca<'info> {
    // todo: split redeem into redeem + rebalance
    fn redeem(&mut self, min_token_a: u64, min_token_b: u64) -> ProgramResult {
        let orca_swap_program_account_info = self.orca_swap_program.to_account_info();
        // root orca swap program ID, now we can make assume Orca will correctly verify orca related accounts during CPI
        require!(
            self.strategy.swap_program == *orca_swap_program_account_info.key,
            PublicKeyMismatch
        );

        msg!(
            "Burn {:?} pool LP tokens in exchange for {:?} A and {:?} B",
            self.source_pool_account.amount,
            min_token_a,
            min_token_b
        );

        // map pool tokens A & B to vault tranche assets
        let vault_alpha_mint = self.vault.alpha.mint;
        let vault_beta_mint = self.vault.beta.mint;

        let (alpha_asset, beta_asset) = into_pool_endpoints(
            &vault_alpha_mint,
            &vault_beta_mint,
            self.source_token_a.to_account_info(),
            self.from_a.to_account_info(),
            self.source_token_b.to_account_info(),
            self.from_b.to_account_info(),
        )?;

        let alpha_amount_before = get_spl_amount(&alpha_asset.user)?;
        let beta_amount_before = get_spl_amount(&beta_asset.user)?;

        let vault_key = self.vault.key();
        let vault_store_signer_seeds =
            generate_vault_store_seeds!(*vault_key.as_ref(), self.vault.vault_store_bump);

        // burn LP tokens for underlying liquidity in orca pool
        withdraw(
            CreatePoolWithdrawal {
                orca_swap_program: orca_swap_program_account_info,
                orca_pool: self.orca_pool.to_account_info(),
                orca_authority: self.orca_authority.to_account_info(),
                user_transfer_authority: self.vault_store.to_account_info(),
                pool_mint: self.pool_mint.to_account_info(),
                source_pool_account: self.source_pool_account.to_account_info(),
                from_a: self.from_a.to_account_info(),
                from_b: self.from_b.to_account_info(),
                user_account_a: self.source_token_a.to_account_info(),
                user_account_b: self.source_token_b.to_account_info(),
                fee_account: self.fee_account.to_account_info(),
                token_program: self.token_program.to_account_info(),
            },
            self.source_pool_account.amount,
            min_token_a,
            min_token_b,
            &[vault_store_signer_seeds],
        )?;

        let alpha_amount_after = get_spl_amount(&alpha_asset.user)?;
        let beta_amount_after = get_spl_amount(&beta_asset.user)?;

        // after - before because we redeem funds, so after > before
        let alpha_withdrawal_amount = alpha_amount_after
            .checked_sub(alpha_amount_before)
            .ok_or_else(math_error!())?;

        let beta_withdrawal_amount = beta_amount_after
            .checked_sub(beta_amount_before)
            .ok_or_else(math_error!())?;

        let mutable_vault = self.vault_mut();
        mutable_vault
            .get_alpha_mut()?
            .add_receipt(alpha_withdrawal_amount)?;
        mutable_vault
            .get_beta_mut()?
            .add_receipt(beta_withdrawal_amount)?;

        Ok(())
    }
}

// =====================================================================

#[derive(Accounts)]
pub struct RebalanceOrca<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: read-only account to validate vault address
    pub authority: UncheckedAccount<'info>,

    #[account(
        seeds = [GLOBAL_STATE_SEED.as_bytes()],
        bump,
    )]
    pub global_protocol_state: Box<Account<'info, GlobalProtocolState>>,

    #[account(
        mut,
        seeds = [
            VAULT_SEED.as_bytes(),
            authority.key().to_bytes().as_ref()
        ],
        bump,
        constraint = vault.strategy == strategy.key(),
        constraint = vault.authority == authority.key(),
        constraint = vault.strategist == payer.key()
    )]
    pub vault: Box<Account<'info, Vault>>,

    /// CHECK: verified via instruction access_control
    #[account(mut)]
    pub vault_store: UncheckedAccount<'info>,

    pub strategy: Box<Account<'info, OrcaStrategyDataV0>>,

    pub token_program: Program<'info, Token>,

    // ====================================================
    // orca accounts
    // ====================================================
    /// CHECK: verfied via orca CPI
    pub orca_swap_program: UncheckedAccount<'info>,

    /// CHECK: verfied via orca CPI
    pub orca_pool: UncheckedAccount<'info>,

    /// CHECK: verfied via orca CPI
    pub orca_authority: UncheckedAccount<'info>,

    /// CHECK: verfied via orca CPI
    #[account(mut)]
    pub user_source: UncheckedAccount<'info>,

    /// CHECK: verfied via orca CPI
    #[account(mut)]
    pub pool_source: UncheckedAccount<'info>,

    /// CHECK: verfied via orca CPI
    #[account(mut)]
    pub pool_destination: UncheckedAccount<'info>,

    /// CHECK: verfied via orca CPI
    #[account(mut)]
    pub user_destination: UncheckedAccount<'info>,

    /// CHECK: verfied via orca CPI
    #[account(mut)]
    pub pool_mint: UncheckedAccount<'info>,

    /// CHECK: verfied via orca CPI
    #[account(mut)]
    pub fee_account: UncheckedAccount<'info>,
}

impl_has_vault!(RebalanceOrca<'_>);

impl<'info> Rebalance<'info> for RebalanceOrca<'info> {
    // question: how much of this code can be re-used across adapters? probably at least the pool assets -> vault tranche
    fn rebalance(&mut self, swap_config: SwapConfig) -> OraResult<(u64, u64, u64, u64)> {
        // map pool tokens A & B to vault tranche assets
        let vault_alpha_mint = self.vault.alpha.mint;
        let vault_beta_mint = self.vault.beta.mint;

        let (alpha_asset, beta_asset) = into_pool_endpoints(
            &vault_alpha_mint,
            &vault_beta_mint,
            self.user_source.to_account_info(), // source_token_a
            self.pool_source.to_account_info(), // from_a
            self.user_destination.to_account_info(), // source_token_b
            self.pool_destination.to_account_info(), // from_b
        )?;

        let alpha_amount_before = get_spl_amount(&alpha_asset.user)?;
        let beta_amount_before = get_spl_amount(&beta_asset.user)?;

        let vault_key = self.vault.key();
        let vault_store_signer_seeds =
            generate_vault_store_seeds!(*vault_key.as_ref(), self.vault.vault_store_bump);

        swap(
            SwapToken {
                orca_swap_program: self.orca_swap_program.to_account_info(),
                orca_pool: self.orca_pool.to_account_info(),
                orca_authority: self.orca_authority.to_account_info(),
                user_transfer_authority: self.vault_store.to_account_info(),
                user_source: self.user_source.to_account_info(),
                pool_source: self.pool_source.to_account_info(),
                pool_destination: self.pool_destination.to_account_info(),
                user_destination: self.user_destination.to_account_info(),
                pool_mint: self.pool_mint.to_account_info(),
                fee_account: self.fee_account.to_account_info(),
                token_program: self.token_program.to_account_info(),
            },
            swap_config.max_in,
            swap_config.min_out,
            &[vault_store_signer_seeds],
        )?;

        let alpha_amount_after = get_spl_amount(&alpha_asset.user)?;
        let beta_amount_after = get_spl_amount(&beta_asset.user)?;

        Ok((
            alpha_amount_before,
            alpha_amount_after,
            beta_amount_before,
            beta_amount_after,
        ))
    }
}

// =====================================================================

// FarmInitializer
#[derive(Accounts)]
pub struct InitializeUserFarmOrca<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: read-only account to validate vault address
    pub authority: UncheckedAccount<'info>,

    #[account(
        seeds = [GLOBAL_STATE_SEED.as_bytes()],
        bump,
    )]
    pub global_protocol_state: Box<Account<'info, GlobalProtocolState>>,

    #[account(
        mut,
        seeds = [
            VAULT_SEED.as_bytes(),
            authority.key().to_bytes().as_ref()
        ],
        bump,
        constraint = vault.strategy == strategy.key(),
        constraint = vault.authority == authority.key(),
        constraint = vault.strategist == payer.key()
    )]
    pub vault: Box<Account<'info, Vault>>,

    /// CHECK: blank PDA, should match seeds. account initialized on-chain.
    #[account(mut)]
    pub vault_store: UncheckedAccount<'info>,

    pub strategy: Box<Account<'info, OrcaStrategyDataV0>>,

    pub system_program: Program<'info, System>,

    pub rent: Sysvar<'info, Rent>,

    /// =============== ORCA ACCOUNTS ===============

    /// CHECK: verfied via orca CPI
    pub aquafarm_program: UncheckedAccount<'info>,

    /// CHECK: verfied via orca CPI; farm attribute
    #[account(mut)]
    pub global_farm: UncheckedAccount<'info>,

    /// CHECK: verfied via orca CPI; farm attribute
    // https://github.com/orca-so/aquafarm-sdk/blob/9ed9db0f04cf7406f1f6e9a3e316639f3d24e68c/src/models/UserFarm.ts#L42
    #[account(mut)]
    pub user_farm: UncheckedAccount<'info>,
}

impl_has_vault!(InitializeUserFarmOrca<'_>);

impl<'info> FarmInitializer<'info> for InitializeUserFarmOrca<'info> {
    fn initialize_user_farm(&mut self) -> ProgramResult {
        let aquafarm_program_account_info = self.aquafarm_program.to_account_info();
        // root orca farm program ID, now we can make assume Orca will correctly verify orca related accounts during CPI
        require!(
            self.strategy.farm_program == *aquafarm_program_account_info.key,
            PublicKeyMismatch
        );

        let vault_key = self.vault.key();
        let vault_store_signer_seeds: &[&[u8]] = &[
            VAULT_STORE_SEED.as_bytes(),
            vault_key.as_ref(),
            &[self.vault.vault_store_bump],
        ];

        transfer_from_signer(
            self.authority.to_account_info(),
            self.vault_store.to_account_info(),
            self.system_program.to_account_info(),
            // https://solscan.io/tx/5SEfcDmP1UzcJYGVLj7aneDRE7Vd6UxQ4ihij2LzRjfWku2Ey1Noter12dD6t8AKwr7FgVtR3RB86cHcY7vpSgjA
            1_628_640,
        )?;

        init_user_farm(
            InitUserFarm {
                aquafarm_program: self.aquafarm_program.to_account_info(),
                global_farm_state: self.global_farm.to_account_info(),
                user_farm_state: self.user_farm.to_account_info(),
                owner: self.vault_store.to_account_info(),
                system_program: self.system_program.to_account_info(),
            },
            &[vault_store_signer_seeds],
        )?;

        Ok(())
    }
}

// =====================================================================

#[derive(Accounts)]
pub struct ConvertOrcaLp<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: read-only account to validate vault address
    pub authority: UncheckedAccount<'info>,

    #[account(
        seeds = [GLOBAL_STATE_SEED.as_bytes()],
        bump,
    )]
    pub global_protocol_state: Box<Account<'info, GlobalProtocolState>>,

    #[account(
        mut,
        seeds = [
            VAULT_SEED.as_bytes(),
            authority.key().to_bytes().as_ref()
        ],
        bump,
        constraint = vault.strategy == strategy.key(),
        constraint = vault.authority == authority.key(),
        constraint = vault.strategist == payer.key()
    )]
    pub vault: Box<Account<'info, Vault>>,

    /// CHECK: verified via instruction access_control
    #[account(mut)]
    pub vault_store: UncheckedAccount<'info>,

    pub strategy: Box<Account<'info, OrcaStrategyDataV0>>,

    pub system_program: Program<'info, System>,

    pub token_program: Program<'info, Token>,

    pub rent: Sysvar<'info, Rent>,

    // ====================================================
    // orca accounts
    // ====================================================
    /// CHECK: verfied via orca CPI
    pub aquafarm_program: UncheckedAccount<'info>,

    /// CHECK: verfied via orca CPI, ATA for pool_token
    #[account(mut)]
    pub pool_account: Box<Account<'info, TokenAccount>>,

    /// CHECK: verfied via orca CPI; farm attribute; ATA
    #[account(mut)]
    pub user_base_ata: Box<Account<'info, TokenAccount>>,

    /// CHECK: verfied via orca CPI; farm attribute
    #[account(mut)]
    pub global_base_token_vault: UncheckedAccount<'info>,

    /// CHECK: verfied via orca CPI; farm attribute; mint
    #[account(mut)]
    pub farm_token_mint: UncheckedAccount<'info>,

    /// CHECK: verfied via orca CPI; farm attribute; ATA
    #[account(mut)]
    pub user_farm_ata: Box<Account<'info, TokenAccount>>,

    /// CHECK: verfied via orca CPI; farm attribute
    #[account(mut)]
    pub global_farm: UncheckedAccount<'info>,

    /// CHECK: verfied via orca CPI; farm attribute
    // https://github.com/orca-so/aquafarm-sdk/blob/9ed9db0f04cf7406f1f6e9a3e316639f3d24e68c/src/models/UserFarm.ts#L42
    #[account(mut)]
    pub user_farm: UncheckedAccount<'info>,

    /// CHECK: verfied via orca CPI; farm attribute
    #[account(mut)]
    pub global_reward_token_vault: UncheckedAccount<'info>,

    /// CHECK: verfied via orca CPI; farm authority
    #[account(mut)]
    pub user_reward_ata: Box<Account<'info, TokenAccount>>,

    /// CHECK: verfied via orca CPI; farm authority
    pub farm_authority: UncheckedAccount<'info>,
}

impl_has_vault!(ConvertOrcaLp<'_>);

impl<'info> Converter<'info> for ConvertOrcaLp<'info> {
    // todo: no need to transfer if in vault_store ATA the entire time
    fn convert_lp(&mut self, _amount: Option<u64>) -> ProgramResult {
        let aquafarm_program_account_info = self.aquafarm_program.to_account_info();
        // root orca farm program ID, now we can make assume Orca will correctly verify orca related accounts during CPI
        require!(
            self.strategy.farm_program == *aquafarm_program_account_info.key,
            PublicKeyMismatch
        );

        let vault_key = self.vault.key();
        let vault_store_signer_seeds =
            generate_vault_store_seeds!(*vault_key.as_ref(), self.vault.vault_store_bump);

        msg!("Converting {:?} LP tokens", self.pool_account.amount);

        convert(
            ConvertBaseTokens {
                aquafarm_program: self.aquafarm_program.to_account_info(),
                user_farm_owner: self.vault_store.to_account_info(),
                user_base_ata: self.user_base_ata.to_account_info(),
                global_base_token_vault: self.global_base_token_vault.to_account_info(),
                user_transfer_authority: self.vault_store.to_account_info(),
                farm_token_mint: self.farm_token_mint.to_account_info(),
                user_farm_ata: self.user_farm_ata.to_account_info(),
                global_farm: self.global_farm.to_account_info(),
                user_farm: self.user_farm.to_account_info(),
                global_reward_token_vault: self.global_reward_token_vault.to_account_info(),
                user_reward_ata: self.user_reward_ata.to_account_info(),
                authority: self.farm_authority.to_account_info(),
                token_program: self.token_program.to_account_info(),
            },
            self.pool_account.amount,
            &[vault_store_signer_seeds],
        )?;

        Ok(())
    }
}

// =====================================================================

#[derive(Accounts)]
pub struct HarvestOrcaLp<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: read-only account to validate vault address
    pub authority: UncheckedAccount<'info>,

    #[account(
        seeds = [GLOBAL_STATE_SEED.as_bytes()],
        bump,
    )]
    pub global_protocol_state: Box<Account<'info, GlobalProtocolState>>,

    #[account(
        mut,
        seeds = [
            VAULT_SEED.as_bytes(),
            authority.key().to_bytes().as_ref()
        ],
        bump,
        constraint = vault.strategy == strategy.key(),
        constraint = vault.authority == authority.key(),
        constraint = vault.strategist == payer.key()
    )]
    pub vault: Box<Account<'info, Vault>>,

    /// CHECK: verified via instruction access_control
    #[account(mut)]
    pub vault_store: UncheckedAccount<'info>,

    pub strategy: Box<Account<'info, OrcaStrategyDataV0>>,

    pub token_program: Program<'info, Token>,

    // ====================================================
    // orca accounts
    // ====================================================
    /// CHECK: verfied via orca CPI
    pub aquafarm_program: UncheckedAccount<'info>,

    /// CHECK: verfied via orca CPI; farm attribute
    #[account(mut)]
    pub global_farm: UncheckedAccount<'info>,

    /// CHECK: verfied via orca CPI; farm attribute
    // https://github.com/orca-so/aquafarm-sdk/blob/9ed9db0f04cf7406f1f6e9a3e316639f3d24e68c/src/models/UserFarm.ts#L42
    #[account(mut)]
    pub user_farm: UncheckedAccount<'info>,

    /// CHECK: verfied via orca CPI; farm attribute
    #[account(mut)]
    pub global_base_token_vault: UncheckedAccount<'info>,

    /// CHECK: verfied via orca CPI; farm attribute
    #[account(mut)]
    pub global_reward_token_vault: UncheckedAccount<'info>,

    #[account(mut)]
    pub user_reward_ata: Box<Account<'info, TokenAccount>>,

    /// CHECK: verfied via orca CPI; farm authority
    pub farm_authority: UncheckedAccount<'info>,
}

impl_has_vault!(HarvestOrcaLp<'_>);

impl<'info> Harvester<'info> for HarvestOrcaLp<'info> {
    fn harvest(&mut self, _amount: Option<u64>) -> ProgramResult {
        let aquafarm_program_account_info = self.aquafarm_program.to_account_info();
        // root orca farm program ID, now we can make assume Orca will correctly verify orca related accounts during CPI
        require!(
            self.strategy.farm_program == *aquafarm_program_account_info.key,
            PublicKeyMismatch
        );

        let vault_key = self.vault.key();
        let vault_store_signer_seeds =
            generate_vault_store_seeds!(*vault_key.as_ref(), self.vault.vault_store_bump);

        let reward_ata_before = self.user_reward_ata.amount;
        msg!("[before] reward ata balance lp: {:?}", reward_ata_before);

        harvest(
            AquafarmHarvest {
                aquafarm_program: self.aquafarm_program.to_account_info(),
                user_farm_owner: self.vault_store.to_account_info(),
                global_farm: self.global_farm.to_account_info(),
                user_farm: self.user_farm.to_account_info(),
                global_base_token_vault: self.global_base_token_vault.to_account_info(),
                global_reward_token_vault: self.global_reward_token_vault.to_account_info(),
                user_reward_token_account: self.user_reward_ata.to_account_info(),
                authority: self.farm_authority.to_account_info(),
                token_program: self.token_program.to_account_info(),
            },
            &[vault_store_signer_seeds],
        )?;

        let reward_ata_amount_after = get_spl_amount(&self.user_reward_ata.to_account_info())?;
        msg!(
            "[after] reward ata balance lp: {:?}",
            reward_ata_amount_after
        );

        Ok(())
    }
}

// =====================================================================

#[derive(Accounts)]
pub struct RevertOrcaLp<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: read-only account to validate vault address
    pub authority: UncheckedAccount<'info>,

    #[account(
        seeds = [GLOBAL_STATE_SEED.as_bytes()],
        bump,
    )]
    pub global_protocol_state: Box<Account<'info, GlobalProtocolState>>,

    #[account(
        mut,
        seeds = [
            VAULT_SEED.as_bytes(),
            authority.key().to_bytes().as_ref()
        ],
        bump,
        constraint = vault.strategy == strategy.key(),
        constraint = vault.authority == authority.key(),
        constraint = vault.strategist == payer.key()
    )]
    pub vault: Box<Account<'info, Vault>>,

    /// CHECK: verified via instruction access_control
    #[account(mut)]
    pub vault_store: UncheckedAccount<'info>,

    pub strategy: Box<Account<'info, OrcaStrategyDataV0>>,

    pub token_program: Program<'info, Token>,

    pub system_program: Program<'info, System>,

    // ====================================================
    // orca accounts
    // ====================================================
    /// CHECK: verfied via orca CPI
    pub aquafarm_program: UncheckedAccount<'info>,

    // owner is vault_store
    #[account(mut)]
    pub pool_account: Box<Account<'info, TokenAccount>>,

    /// owned by vault_store
    /// CHECK: verfied via orca CPI; farm attribute; ATA
    #[account(mut)]
    pub user_base_ata: Box<Account<'info, TokenAccount>>,

    /// CHECK: verfied via orca CPI; farm attribute
    #[account(mut)]
    pub global_base_token_vault: UncheckedAccount<'info>,

    /// CHECK: verfied via orca CPI; farm attribute; mint
    #[account(mut)]
    pub farm_token_mint: UncheckedAccount<'info>,

    /// CHECK: verfied via orca CPI; farm attribute; ATA
    #[account(mut)]
    pub user_farm_ata: Box<Account<'info, TokenAccount>>,

    /// CHECK: verfied via orca CPI; farm attribute
    #[account(mut)]
    pub global_farm: UncheckedAccount<'info>,

    /// CHECK: verfied via orca CPI; farm attribute
    // https://github.com/orca-so/aquafarm-sdk/blob/9ed9db0f04cf7406f1f6e9a3e316639f3d24e68c/src/models/UserFarm.ts#L42
    #[account(mut)]
    pub user_farm: UncheckedAccount<'info>,

    /// CHECK: verfied via orca CPI; farm attribute
    #[account(mut)]
    pub global_reward_token_vault: UncheckedAccount<'info>,

    /// CHECK: verfied via orca CPI; farm authority
    #[account(mut)]
    pub user_reward_ata: Box<Account<'info, TokenAccount>>,

    /// CHECK: verfied via orca CPI; farm authority
    pub farm_authority: UncheckedAccount<'info>,
}

impl_has_vault!(RevertOrcaLp<'_>);

impl<'info> Reverter<'info> for RevertOrcaLp<'info> {
    fn revert_lp(&mut self, _amount: Option<u64>) -> ProgramResult {
        let aquafarm_program_account_info = self.aquafarm_program.to_account_info();
        // root orca farm program ID, now we can make assume Orca will correctly verify orca related accounts during CPI
        require!(
            self.strategy.farm_program == *aquafarm_program_account_info.key,
            PublicKeyMismatch
        );

        let vault_key = self.vault.key();
        let vault_store_signer_seeds =
            generate_vault_store_seeds!(*vault_key.as_ref(), self.vault.vault_store_bump);

        msg!("LP to revert: {:?}", self.user_farm_ata.amount);
        revert(
            RevertBaseToken {
                aquafarm_program: self.aquafarm_program.to_account_info(),
                user_farm_owner: self.vault_store.to_account_info(),
                user_base_ata: self.user_base_ata.to_account_info(),
                global_base_token_vault: self.global_base_token_vault.to_account_info(),
                farm_token_mint: self.farm_token_mint.to_account_info(),
                user_farm_ata: self.user_farm_ata.to_account_info(),
                user_burn_authority: self.vault_store.to_account_info(),
                global_farm: self.global_farm.to_account_info(),
                user_farm: self.user_farm.to_account_info(),
                global_reward_token_vault: self.global_reward_token_vault.to_account_info(),
                user_reward_ata: self.user_reward_ata.to_account_info(),
                authority: self.farm_authority.to_account_info(),
                token_program: self.token_program.to_account_info(),
            },
            self.user_farm_ata.amount,
            &[vault_store_signer_seeds],
        )?;

        let base_lp_amount = get_spl_amount(&self.user_base_ata.to_account_info())?;
        msg!("base_lp_amount balance after: {}", base_lp_amount);

        Ok(())
    }
}

// =====================================================================

#[derive(Accounts)]
pub struct SwapOrca<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: read-only account to validate vault address
    pub authority: UncheckedAccount<'info>,

    #[account(
        seeds = [GLOBAL_STATE_SEED.as_bytes()],
        bump,
    )]
    pub global_protocol_state: Box<Account<'info, GlobalProtocolState>>,

    #[account(
        mut,
        seeds = [
            VAULT_SEED.as_bytes(),
            authority.key().to_bytes().as_ref()
        ],
        bump,
        constraint = vault.strategy == strategy.key(),
        constraint = vault.authority == authority.key(),
        constraint = vault.strategist == payer.key()
    )]
    pub vault: Box<Account<'info, Vault>>,

    /// CHECK: verified via instruction access_control
    #[account(mut)]
    pub vault_store: UncheckedAccount<'info>,

    pub strategy: Box<Account<'info, OrcaStrategyDataV0>>,

    pub token_program: Program<'info, Token>,

    // ====================================================
    // orca accounts
    // ====================================================
    /// CHECK: verfied via orca CPI
    pub orca_swap_program: UncheckedAccount<'info>,

    /// CHECK: verfied via orca CPI
    pub orca_pool: UncheckedAccount<'info>,

    /// CHECK: verfied via orca CPI
    pub orca_authority: UncheckedAccount<'info>,

    /// CHECK: verfied via orca CPI
    #[account(mut)]
    pub user_source: UncheckedAccount<'info>,

    /// CHECK: verfied via orca CPI
    #[account(mut)]
    pub pool_source: UncheckedAccount<'info>,

    /// CHECK: verfied via orca CPI
    #[account(mut)]
    pub pool_destination: UncheckedAccount<'info>,

    /// CHECK: verfied via orca CPI
    #[account(mut)]
    pub user_destination: UncheckedAccount<'info>,

    /// CHECK: verfied via orca CPI
    #[account(mut)]
    pub pool_mint: UncheckedAccount<'info>,

    /// CHECK: verfied via orca CPI
    #[account(mut)]
    pub fee_account: UncheckedAccount<'info>,
}

impl_has_vault!(SwapOrca<'_>);

impl<'info> Swapper<'info> for SwapOrca<'info> {
    // @dev: assumption is that we'll only ever swap from vault_store
    fn swap(&mut self, amount_in: u64, min_amount_out: u64) -> ProgramResult {
        let vault_key = self.vault.key();
        let vault_store_signer_seeds =
            generate_vault_store_seeds!(*vault_key.as_ref(), self.vault.vault_store_bump);

        swap(
            SwapToken {
                orca_swap_program: self.orca_swap_program.to_account_info(),
                orca_pool: self.orca_pool.to_account_info(),
                orca_authority: self.orca_authority.to_account_info(),
                user_transfer_authority: self.vault_store.to_account_info(),
                user_source: self.user_source.to_account_info(),
                pool_source: self.pool_source.to_account_info(),
                pool_destination: self.pool_destination.to_account_info(),
                user_destination: self.user_destination.to_account_info(),
                pool_mint: self.pool_mint.to_account_info(),
                fee_account: self.fee_account.to_account_info(),
                token_program: self.token_program.to_account_info(),
            },
            amount_in,
            min_amount_out,
            &[vault_store_signer_seeds],
        )?;

        Ok(())
    }
}
