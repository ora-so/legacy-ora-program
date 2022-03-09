use {
    crate::{
        constant::VAULT_SEED,
        state::vault::{Vault, VAULT_ACCOUNT_SPACE},
    },
    anchor_lang::prelude::*,
    anchor_spl::token::{Mint, Token, TokenAccount, Transfer},
    stable_swap_anchor::{
        Deposit as DepositLiquidity, SwapOutput, SwapToken, SwapUserContext,
        Withdraw as WithdrawLiquidity,
    },
};

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    // note: might want to revisit these PDA seeds. mainly the authority key since an authority could
    // change over time. further, this design is limiting because it assumes a 1-1 mapping between
    // authority address and vault.
    #[account(
        init,
        seeds = [
            VAULT_SEED.as_bytes(),
            authority.key().to_bytes().as_ref()
        ],
        bump,
        payer = authority,
        space = VAULT_ACCOUNT_SPACE
    )]
    pub vault: Account<'info, Vault>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    /// no restrictions because anyone can deposit, technically
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
    pub vault: Box<Account<'info, Vault>>,

    /// deposit into a saber pool requires token A and B. in the future,
    /// the deposit function won't be so restrictive. but, the simplest
    /// vault implementation requires us to do deposit + LP in 1 instruction
    /// since "vault" is actually just a pass through.
    #[account(
        mut,
        constraint = user_token_a.owner == authority.key()
    )]
    pub user_token_a: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = user_token_b.owner == authority.key()
    )]
    pub user_token_b: Account<'info, TokenAccount>,

    /// custom struct to encapsulate all accounts required for the saber deposit operation
    pub saber_deposit: SaberDeposit<'info>,

    /// =============== PROGRAM ACCOUNTS ===============
    pub system_program: Program<'info, System>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    /// only a single authority should be allowed to withdraw funds from the vault.
    #[account(
      mut,
      constraint = authority.key() == vault.authority.key()
    )]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [
            VAULT_SEED.as_bytes(),
            authority.key().to_bytes().as_ref()
        ],
        bump,
    )]
    pub vault: Box<Account<'info, Vault>>,

    #[account(mut)]
    pub user_token_a: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub user_token_b: Box<Account<'info, TokenAccount>>,

    /// custom struct to encapsulate all accounts required for the saber withdraw operation
    pub saber_withdraw: SaberWithdraw<'info>,

    /// =============== PROGRAM ACCOUNTS ===============
    pub system_program: Program<'info, System>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct SaberDeposit<'info> {
    /// custom struct to encapsulate all common saber swap accounts
    pub saber_swap_common: SaberSwapCommon<'info>,

    /// The output account for LP tokens
    #[account(mut)]
    pub output_lp: Box<Account<'info, TokenAccount>>,
}

#[derive(Accounts)]
pub struct SaberWithdraw<'info> {
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
    pub saber_program: UncheckedAccount<'info>,
}

// ======================================
// CPI CONTEXT TRANSFORMATIONS
// ======================================

impl<'info> Deposit<'info> {
    pub fn into_transfer_token_context(
        &self,
        user_token: AccountInfo<'info>,
        vault_token: AccountInfo<'info>,
    ) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        let cpi_program = self.token_program.to_account_info();

        let cpi_accounts = Transfer {
            /// source ATA
            from: user_token,
            /// destination ATA
            to: vault_token,
            /// entity authorizing transfer
            authority: self.authority.to_account_info(),
        };

        CpiContext::new(cpi_program, cpi_accounts)
    }

    pub fn into_saber_swap_deposit_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, DepositLiquidity<'info>> {
        let cpi_program = self
            .saber_deposit
            .saber_swap_common
            .saber_program
            .to_account_info();

        let cpi_accounts = DepositLiquidity {
            /// The context of the user
            user: SwapUserContext {
                /// The spl_token program
                token_program: self.token_program.to_account_info(),
                /// The authority of the swap
                swap_authority: self
                    .saber_deposit
                    .saber_swap_common
                    .swap_authority
                    .to_account_info(),
                /// The authority of the user
                user_authority: self.vault.to_account_info(),
                /// The pool's swap account
                swap: self.saber_deposit.saber_swap_common.swap.to_account_info(),
            },
            /// The "A" token of the swap
            input_a: SwapToken {
                /// The depositor's token A ATA
                user: self
                    .saber_deposit
                    .saber_swap_common
                    .source_token_a
                    .to_account_info(),
                /// The pool’s token A ATA
                reserve: self
                    .saber_deposit
                    .saber_swap_common
                    .reserve_a
                    .to_account_info(),
            },
            /// The "B" token of the swap
            input_b: SwapToken {
                /// The depositor's token B ATA
                user: self
                    .saber_deposit
                    .saber_swap_common
                    .source_token_b
                    .to_account_info(),
                /// The pool’s token B ATA
                reserve: self
                    .saber_deposit
                    .saber_swap_common
                    .reserve_b
                    .to_account_info(),
            },
            /// The pool's LP mint
            pool_mint: self
                .saber_deposit
                .saber_swap_common
                .pool_mint
                .to_account_info(),
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
        let cpi_program = self
            .saber_withdraw
            .saber_swap_common
            .saber_program
            .to_account_info();

        let cpi_accounts = WithdrawLiquidity {
            /// The context of the user
            user: SwapUserContext {
                /// The spl_token program
                token_program: self.token_program.to_account_info(),
                /// The authority of the swap
                swap_authority: self
                    .saber_withdraw
                    .saber_swap_common
                    .swap_authority
                    .to_account_info(),
                /// The authority of the user
                user_authority: self.vault.to_account_info(),
                /// The pool's swap account
                swap: self.saber_withdraw.saber_swap_common.swap.to_account_info(),
            },
            /// The withdrawer's LP ATA
            input_lp: self.saber_withdraw.input_lp.to_account_info(),
            /// The pool's LP mint
            pool_mint: self
                .saber_withdraw
                .saber_swap_common
                .pool_mint
                .to_account_info(),
            /// The "A" token of the swap
            output_a: SwapOutput {
                user_token: SwapToken {
                    /// The withdrawer's token A ATA
                    user: self
                        .saber_withdraw
                        .saber_swap_common
                        .source_token_a
                        .to_account_info(),
                    /// The pool’s token A ATA
                    reserve: self
                        .saber_withdraw
                        .saber_swap_common
                        .reserve_a
                        .to_account_info(),
                },
                // The token account for the fees associated with the token
                fees: self.saber_withdraw.output_a_fees.to_account_info(),
            },
            /// The "B" token of the swap
            output_b: SwapOutput {
                user_token: SwapToken {
                    /// The withdrawer's token B ATA
                    user: self
                        .saber_withdraw
                        .saber_swap_common
                        .source_token_b
                        .to_account_info(),
                    /// The pool’s token B ATA
                    reserve: self
                        .saber_withdraw
                        .saber_swap_common
                        .reserve_b
                        .to_account_info(),
                },
                // The token account for the fees associated with the token
                fees: self.saber_withdraw.output_b_fees.to_account_info(),
            },
        };

        CpiContext::new(cpi_program, cpi_accounts)
    }

    pub fn into_transfer_token_context(
        &self,
        authority_token: AccountInfo<'info>,
        vault_token: AccountInfo<'info>,
    ) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        let cpi_program = self.token_program.to_account_info();

        let cpi_accounts = Transfer {
            /// source ATA
            from: vault_token,
            /// destination ATA
            to: authority_token,
            /// entity authorizing transfer
            authority: self.vault.to_account_info(),
        };

        CpiContext::new(cpi_program, cpi_accounts)
    }
}
