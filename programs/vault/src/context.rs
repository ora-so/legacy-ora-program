use {
    crate::{constant::VAULT_SEED, state::vault::Vault},
    anchor_lang::prelude::*,
    anchor_spl::token::{Mint, Token, TokenAccount, Transfer},
    std::mem::size_of,
};

#[derive(Accounts)]
#[instruction(vault_bump: u8)]
pub struct InitializeVault<'info> {
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
        space = size_of::<Vault>(),
    )]
    pub vault: Account<'info, Vault>,

    #[account(mut)]
    /// CHECK: TODO
    pub strategy: UncheckedAccount<'info>,
    #[account(mut)]
    /// CHECK: TODO
    pub strategist: UncheckedAccount<'info>,

    #[account(mut)]
    pub alpha_mint: Account<'info, Mint>,
    #[account(mut)]
    pub alpha_lp: Account<'info, Mint>,
    #[account(mut)]
    pub beta_mint: Account<'info, Mint>,
    #[account(mut)]
    pub beta_lp: Account<'info, Mint>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(amount: u64)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: read-only account to validate vault address
    pub authority: AccountInfo<'info>,

    #[account(
        mut,
        seeds = [
            VAULT_SEED.as_bytes(),
            authority.key().to_bytes().as_ref()
        ],
        bump,
    )]
    pub vault: Box<Account<'info, Vault>>,

    /// CHECK: validate expected vs actual address
    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = payer,
        constraint = source_ata.amount >= amount
    )]
    pub source_ata: Account<'info, TokenAccount>,

    /// CHECK: create and validate JIT in instruction
    #[account(mut)]
    pub destination_ata: AccountInfo<'info>,

    /// =============== PROGRAM ACCOUNTS ===============
    pub system_program: Program<'info, System>,

    pub token_program: Program<'info, Token>,

    /// CHECK: validate expected vs actual address
    #[account(address = spl_associated_token_account::ID)]
    pub ata_program: AccountInfo<'info>,

    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
#[instruction(amount: u64)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: read-only account to validate vault address
    pub authority: AccountInfo<'info>,

    #[account(
        mut,
        seeds = [
            VAULT_SEED.as_bytes(),
            authority.key().to_bytes().as_ref()
        ],
        bump,
    )]
    pub vault: Box<Account<'info, Vault>>,

    /// CHECK: validate expected vs actual address
    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = vault,
        constraint = source_ata.amount >= amount
    )]
    pub source_ata: Account<'info, TokenAccount>,

    /// CHECK: create and validate JIT in instruction
    #[account(mut)]
    pub destination_ata: AccountInfo<'info>,

    /// =============== PROGRAM ACCOUNTS ===============
    pub system_program: Program<'info, System>,

    pub token_program: Program<'info, Token>,

    /// CHECK: validate expected vs actual address
    #[account(address = spl_associated_token_account::ID)]
    pub ata_program: AccountInfo<'info>,

    pub rent: Sysvar<'info, Rent>,
}

// ======================================
// CPI CONTEXT TRANSFORMATIONS
// ======================================

impl<'info> Deposit<'info> {
    pub fn into_transfer_token_context(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        let cpi_program = self.token_program.to_account_info();

        let cpi_accounts = Transfer {
            /// source ATA
            from: self.source_ata.to_account_info(),
            /// destination ATA
            to: self.destination_ata.to_account_info(),
            /// entity authorizing transfer
            authority: self.payer.to_account_info(),
        };

        CpiContext::new(cpi_program, cpi_accounts)
    }
}

impl<'info> Withdraw<'info> {
    pub fn into_transfer_token_context(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        let cpi_program = self.token_program.to_account_info();

        let cpi_accounts = Transfer {
            /// source ATA
            from: self.source_ata.to_account_info(),
            /// destination ATA
            to: self.destination_ata.to_account_info(),
            /// entity authorizing transfer
            authority: self.vault.to_account_info(),
        };

        CpiContext::new(cpi_program, cpi_accounts)
    }
}
