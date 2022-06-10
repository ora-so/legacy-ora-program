use crate::{
    constant::{GLOBAL_STATE_SEED, STRATEGY_SEED, VAULT_SEED},
    error::OraResult,
    init_strategy::StrategyInitializer,
    invest::Invest,
    redeem::{verify_received, Redeem},
    state::{GlobalProtocolState, HasVault, StrategyFlag, Vault},
};
use anchor_lang::prelude::*;
use anchor_spl::token::TokenAccount;
use anchor_spl::token::{Mint, Token};
use stable_swap_anchor::{Deposit, SwapOutput, SwapToken, SwapUserContext, Withdraw};
use std::mem::size_of;
use std::ops::{Deref, DerefMut};

#[account]
#[derive(Default, Copy, PartialEq, Debug)]
pub struct SaberStrategyDataV0 {
    /// pda bump
    pub bump: u8,
    /// helps decode specific strategy type
    pub flag: u64,
    /// version of data account
    pub version: u16,
    /// LP mint for a base pool
    pub base_lp: Pubkey,
    /// LP mint for a given pool's base farm
    pub farm_lp: Option<Pubkey>,
}

impl SaberStrategyDataV0 {
    pub fn init(
        &mut self,
        bump: u8,
        flag: u64, // helps decode strategy type
        version: u16,
        base_lp: Pubkey,
    ) -> Result<(), ProgramError> {
        StrategyFlag::validate_flag(flag)?;

        self.bump = bump;
        self.flag = flag;
        self.version = version;
        self.base_lp = base_lp;

        // none for now
        self.farm_lp = None;

        Ok(())
    }
}

// =====================================================================

#[derive(Accounts)]
#[instruction(bump: u8, flag: u64, version: u16)]
pub struct InitializeSaber<'info> {
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
            base_pool.key().to_bytes().as_ref(),
            pool_lp.key().to_bytes().as_ref(),
        ],
        bump,
        payer = authority,
        space = 8 + size_of::<SaberStrategyDataV0>(),
    )]
    pub strategy: Box<Account<'info, SaberStrategyDataV0>>,

    pub token_a: Box<Account<'info, Mint>>,

    pub token_b: Box<Account<'info, Mint>>,

    /// CHECK: unused in instruction, just to derive strategy key
    pub base_pool: UncheckedAccount<'info>,

    /// CHECK: unused in instruction, just to derive strategy key
    pub pool_lp: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,

    pub rent: Sysvar<'info, Rent>,
}

impl<'info> StrategyInitializer<'info> for InitializeSaber<'info> {
    fn initialize_strategy(&mut self, bump: u8, flag: u64, version: u16) -> ProgramResult {
        self.strategy.init(bump, flag, version, *self.pool_lp.key)?;

        Ok(())
    }
}

// =====================================================================

#[derive(Accounts)]
pub struct InvestSaber<'info> {
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

    /// CHECK: pubkey matched in context, validation done in instruction
    pub strategy: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,

    pub token_program: Program<'info, Token>,

    pub rent: Sysvar<'info, Rent>,

    // ====================================================
    // saber accounts
    // ====================================================
    /// custom struct to encapsulate all common saber swap accounts
    pub saber_swap_common: SaberSwapCommon<'info>,

    /// The output account for LP tokens
    #[account(mut)]
    pub output_lp: Box<Account<'info, TokenAccount>>,
}

impl_has_vault!(InvestSaber<'_>);

impl<'info> Invest<'info> for InvestSaber<'info> {
    fn invest(&mut self, amount_a: u64, amount_b: u64, min_out: u64) -> OraResult<(u64, u64)> {
        let vault_signer_seeds =
            generate_vault_seeds!(*self.authority.key.as_ref(), self.vault.bump);

        stable_swap_anchor::deposit(
            self.into_saber_swap_deposit_context()
                .with_signer(&[vault_signer_seeds]),
            amount_a,
            amount_b,
            min_out,
        )?;

        Ok((amount_a, amount_b))
    }
}

impl<'info> InvestSaber<'info> {
    pub fn into_saber_swap_deposit_context(&self) -> CpiContext<'_, '_, '_, 'info, Deposit<'info>> {
        let cpi_program = self.saber_swap_common.saber_program.to_account_info();

        let cpi_accounts = Deposit {
            /// The context of the user
            user: SwapUserContext {
                /// The spl_token program
                token_program: self.token_program.to_account_info(),
                /// The authority of the swap
                swap_authority: self.saber_swap_common.swap_authority.to_account_info(),
                /// The authority of the user
                user_authority: self.vault.to_account_info(),
                /// The pool's swap account
                swap: self.saber_swap_common.swap.to_account_info(),
            },
            /// The "A" token of the swap
            input_a: SwapToken {
                /// The depositor's token A ATA
                user: self.saber_swap_common.source_token_a.to_account_info(),
                /// The pool’s token A ATA
                reserve: self.saber_swap_common.reserve_a.to_account_info(),
            },
            /// The "B" token of the swap
            input_b: SwapToken {
                /// The depositor's token B ATA
                user: self.saber_swap_common.source_token_b.to_account_info(),
                /// The pool’s token B ATA
                reserve: self.saber_swap_common.reserve_b.to_account_info(),
            },
            /// The pool's LP mint
            pool_mint: self.saber_swap_common.pool_mint.to_account_info(),
            /// The output account for LP tokens
            output_lp: self.output_lp.to_account_info(),
        };

        CpiContext::new(cpi_program, cpi_accounts)
    }
}

// =====================================================================

#[derive(Accounts)]
pub struct RedeemSaber<'info> {
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

    /// CHECK: pubkey matched in context, validation done in instruction
    // todo: update this to check for seeds
    pub strategy: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,

    pub token_program: Program<'info, Token>,

    pub rent: Sysvar<'info, Rent>,

    // ====================================================
    // saber accounts
    // ====================================================
    /// custom struct to encapsulate all common saber swap accounts
    pub saber_swap_common: SaberSwapCommon<'info>,

    /// The output account for LP tokens
    #[account(mut)]
    pub input_lp: Box<Account<'info, TokenAccount>>,

    /// The token account for the fees associated with token "B"
    #[account(mut)]
    pub output_a_fees: Box<Account<'info, TokenAccount>>,

    /// The token account for the fees associated with token "A"
    #[account(mut)]
    pub output_b_fees: Box<Account<'info, TokenAccount>>,
}

impl_has_vault!(RedeemSaber<'_>);

impl<'info> Redeem<'info> for RedeemSaber<'info> {
    fn redeem(&mut self, min_token_a: u64, min_token_b: u64) -> ProgramResult {
        let vault_signer_seeds =
            generate_vault_seeds!(*self.authority.key.as_ref(), self.vault.bump);

        stable_swap_anchor::withdraw(
            self.into_saber_swap_withdraw_context()
                .with_signer(&[vault_signer_seeds]),
            self.input_lp.amount,
            0,
            0,
        )?;

        let received_a = verify_received(&mut self.saber_swap_common.source_token_a, min_token_a)?;
        self.vault
            .update_receipt(&self.saber_swap_common.source_token_a.mint, received_a)?;

        let received_b = verify_received(&mut self.saber_swap_common.source_token_b, min_token_b)?;
        self.vault
            .update_receipt(&self.saber_swap_common.source_token_b.mint, received_b)?;

        Ok(())
    }
}

impl<'info> RedeemSaber<'info> {
    pub fn into_saber_swap_withdraw_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, Withdraw<'info>> {
        let cpi_program = self.saber_swap_common.saber_program.to_account_info();

        let cpi_accounts = Withdraw {
            /// The context of the user
            user: SwapUserContext {
                /// The spl_token program
                token_program: self.token_program.to_account_info(),
                /// The authority of the swap
                swap_authority: self.saber_swap_common.swap_authority.to_account_info(),
                /// The authority of the user
                user_authority: self.vault.to_account_info(),
                /// The pool's swap account
                swap: self.saber_swap_common.swap.to_account_info(),
            },
            /// The withdrawer's LP ATA
            input_lp: self.input_lp.to_account_info(),
            /// The pool's LP mint
            pool_mint: self.saber_swap_common.pool_mint.to_account_info(),
            /// The "A" token of the swap
            output_a: SwapOutput {
                user_token: SwapToken {
                    /// The withdrawer's token A ATA
                    user: self.saber_swap_common.source_token_a.to_account_info(),
                    /// The pool’s token A ATA
                    reserve: self.saber_swap_common.reserve_a.to_account_info(),
                },
                // The token account for the fees associated with the token
                fees: self.output_a_fees.to_account_info(),
            },
            /// The "B" token of the swap
            output_b: SwapOutput {
                user_token: SwapToken {
                    /// The withdrawer's token B ATA
                    user: self.saber_swap_common.source_token_b.to_account_info(),
                    /// The pool’s token B ATA
                    reserve: self.saber_swap_common.reserve_b.to_account_info(),
                },
                // The token account for the fees associated with the token
                fees: self.output_b_fees.to_account_info(),
            },
        };

        CpiContext::new(cpi_program, cpi_accounts)
    }
}

// ==========================================================
// saber common contexts
// ==========================================================

#[derive(Accounts)]
pub struct SaberSwapCommon<'info> {
    /// saber stable swap program
    /// CHECK: verified via saber stable swap CPI call
    pub swap: UncheckedAccount<'info>,

    /// The authority of the swap.
    /// CHECK: verified via saber stable swap CPI call
    pub swap_authority: UncheckedAccount<'info>,

    /// The token account for the pool's reserves of this token
    #[account(mut)]
    pub source_token_a: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub reserve_a: Box<Account<'info, TokenAccount>>,

    /// The token account for the pool's reserves of this token
    #[account(mut)]
    pub source_token_b: Box<Account<'info, TokenAccount>>,

    /// The token account for the pool's reserves of this token
    #[account(mut)]
    pub reserve_b: Box<Account<'info, TokenAccount>>,

    /// The pool mint of the swap
    #[account(mut)]
    pub pool_mint: Box<Account<'info, Mint>>,

    /// CHECK: verified via saber stable swap CPI call
    #[account(address = stable_swap_anchor::ID)]
    pub saber_program: UncheckedAccount<'info>,
}
