use {
    anchor_lang::prelude::*,
    stable_swap_anchor::{
        Deposit as DepositLiquidity,
        Withdraw as WithdrawLiquidity,
        SwapUserContext,
        SwapToken,
        SwapOutput
    },
    anchor_spl::token::{Token, TokenAccount},
    crate::{
        constant::{
            VAULT_SEED
        },
        state::vault::Vault,
    },
};

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        seeds = [
            VAULT_SEED.as_bytes(),
            authority.key().to_bytes().as_ref()
        ],
        bump,
        payer = authority,
        space = 1000 // BUCKET_ACCOUNT_SPACE
    )]
    pub vault: Account<'info, Vault>,

    /// CHECK: no read/write ops. used to set a PDA attribute.
    pub deposit_authority: AccountInfo<'info>,
    /// CHECK: no read/write ops. used to set a PDA attribute.
    pub withdraw_authority: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [
            VAULT_SEED.as_bytes(),
            authority.key().to_bytes().as_ref()
        ],
        bump,
    )]
    pub vault: Account<'info, Vault>,

    pub saber_deposit: SaberDeposit<'info>,

    pub system_program: Program<'info, System>,

    pub token_program: Program<'info, Token>,
}

// assume we want to withdraw an equal amount of both underlying assets in the pool
// https://github.com/saber-hq/stable-swap/blob/9c93edf591908c0198273546b6c17e07da56b11c/stable-swap-anchor/src/instructions.rs#L167
#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [
            VAULT_SEED.as_bytes(),
            authority.key().to_bytes().as_ref()
        ],
        bump,
    )]
    pub vault: Account<'info, Vault>,

    pub saber_withdraw: SaberWithdraw<'info>,

    pub system_program: Program<'info, System>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct SaberDeposit<'info> {
    pub saber_swap_common: SaberSwapCommon<'info>,

    /// The output account for LP tokens
    /// CHECK: verified via CPI call for saber swap
    #[account(mut)]
    pub output_lp: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct SaberWithdraw<'info> {
    pub saber_swap_common: SaberSwapCommon<'info>,

    /// The output account for LP tokens
    /// CHECK: verified via CPI call for saber swap
    #[account(mut)]
    pub input_lp: UncheckedAccount<'info>,

    /// The token account for the fees associated with token "B"
    /// CHECK: verified via CPI call for saber swap
    #[account(mut)]
    pub output_a_fees: UncheckedAccount<'info>,

    /// The token account for the fees associated with token "A"
    /// CHECK: verified via CPI call for saber swap
    #[account(mut)]
    pub output_b_fees: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct SaberSwapCommon<'info> {
    /// saber stable swap program
    /// CHECK: verified via CPI call for saber swap
    pub swap: UncheckedAccount<'info>,

    /// The authority of the swap.
    /// CHECK: verified via CPI call for saber swap
    pub swap_authority: UncheckedAccount<'info>,

    /// The token account for the pool's reserves of this token
    #[account(mut)]
    pub user_token_a: Account<'info, TokenAccount>,

    /// The token account for the pool's reserves of this token
    #[account(mut)]
    pub reserve_a: Account<'info, TokenAccount>,

    /// The token account for the pool's reserves of this token
    #[account(mut)]
    pub user_token_b: Account<'info, TokenAccount>,

    /// The token account for the pool's reserves of this token
    #[account(mut)]
    pub reserve_b: Account<'info, TokenAccount>,

    /// The pool mint of the swap
    /// CHECK: verified via CPI call for saber swap
    #[account(mut)]
    pub pool_mint: UncheckedAccount<'info>,

    /// CHECK: verified via CPI call for saber swap
    pub saber_program: UncheckedAccount<'info>,
}

// ======================================
// CPI CONTEXT TRANSFORMATIONS
// ======================================

impl<'info> Deposit<'info> {

    pub fn into_saber_swap_deposit_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, DepositLiquidity<'info>> {
        let cpi_program = self.saber_deposit.saber_swap_common.saber_program.to_account_info();

        let cpi_accounts = DepositLiquidity {
            /// The context of the user
            user: SwapUserContext {
                /// The spl_token program.
                token_program: self.token_program.to_account_info(),
                /// The authority of the swap.
                swap_authority: self.saber_deposit.saber_swap_common.swap_authority.to_account_info(),
                /// The authority of the user.
                user_authority: self.vault.to_account_info(),
                /// The pool's swap account
                swap: self.saber_deposit.saber_swap_common.swap.to_account_info(),
            },
            /// The "A" token of the swap
            input_a: SwapToken {
                /// The token account associated with the swap requester's source ATA
                user: self.saber_deposit.saber_swap_common.user_token_a.to_account_info(),
                /// The token account for the pool’s reserves of this token.
                reserve: self.saber_deposit.saber_swap_common.reserve_a.to_account_info(),
            },
            /// The "B" token of the swap
            input_b: SwapToken {
                /// The token account associated with the swap requester's destination ATA
                user: self.saber_deposit.saber_swap_common.user_token_b.to_account_info(),
                /// The token account for the pool’s reserves of this token.
                reserve: self.saber_deposit.saber_swap_common.reserve_b.to_account_info(),
            },
            /// The pool mint of the swap
            pool_mint: self.saber_deposit.saber_swap_common.pool_mint.to_account_info(),
            /// The output account for LP tokens
            output_lp: self.saber_deposit.output_lp.to_account_info(),
        };

        CpiContext::new(cpi_program, cpi_accounts)
    }
}

impl<'info> Withdraw<'info> {

    pub fn into_saber_swap_withdraw_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, WithdrawLiquidity<'info>> {
        let cpi_program = self.saber_withdraw.saber_swap_common.saber_program.to_account_info();

        let cpi_accounts = WithdrawLiquidity {
            /// The context of the user
            user: SwapUserContext {
                /// The spl_token program.
                token_program: self.token_program.to_account_info(),
                /// The authority of the swap.
                swap_authority: self.saber_withdraw.saber_swap_common.swap_authority.to_account_info(),
                /// The authority of the user.
                user_authority: self.vault.to_account_info(),
                /// The pool's swap account
                swap: self.saber_withdraw.saber_swap_common.swap.to_account_info(),
            },
            /// The input account for LP tokens
            input_lp: self.saber_withdraw.input_lp.to_account_info(),
            /// The pool mint of the swap
            pool_mint: self.saber_withdraw.saber_swap_common.pool_mint.to_account_info(),
            /// The "A" token of the swap
            output_a: SwapOutput {
                // The token accounts of the user and the token.
                user_token: SwapToken {
                    /// The token account associated with the swap requester's destination ATA
                    user: self.saber_withdraw.saber_swap_common.user_token_a.to_account_info(),
                    /// The token account for the pool’s reserves of this token.
                    reserve: self.saber_withdraw.saber_swap_common.reserve_a.to_account_info(),
                },
                // The token account for the fees associated with the token.
                fees: self.saber_withdraw.output_a_fees.to_account_info(),
            },
            /// The "B" token of the swap
            output_b: SwapOutput {
                // The token accounts of the user and the token.
                user_token: SwapToken {
                    /// The token account associated with the swap requester's destination ATA
                    user: self.saber_withdraw.saber_swap_common.user_token_b.to_account_info(),
                    /// The token account for the pool’s reserves of this token.
                    reserve: self.saber_withdraw.saber_swap_common.reserve_b.to_account_info(),
                },
                // The token account for the fees associated with the token.
                fees: self.saber_withdraw.output_b_fees.to_account_info(),
            },
        };

        CpiContext::new(cpi_program, cpi_accounts)
    }
}
