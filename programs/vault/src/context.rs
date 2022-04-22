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
        constraint = vault.authority == authority.key(),
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
        constraint = vault.authority == authority.key(),
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

#[derive(Accounts)]
pub struct Invest<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: read-only account to validate vault address
    pub authority: AccountInfo<'info>,

    /// CHECK: pubkey matched in context, validation done in instruction
    pub strategy: UncheckedAccount<'info>,

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

    /// CHECK: vault ATA to hold LP after investing assets
    #[account(mut)]
    pub vault_lp: Account<'info, TokenAccount>,

    /// custom struct to encapsulate all accounts required for the saber deposit operation.
    /// not a sustainable model for multiple integrations, but should work for now.
    pub saber_deposit: SaberDeposit<'info>,

    /// CHECK: validate expected vs actual address
    #[account(address = spl_associated_token_account::ID)]
    pub ata_program: AccountInfo<'info>,

    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct Redeem<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: read-only account to validate vault address
    pub authority: AccountInfo<'info>,

    /// CHECK: pubkey matched in context, validation done in instruction
    pub strategy: UncheckedAccount<'info>,

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

    /// custom struct to encapsulate all accounts required for the saber deposit operation.
    /// not a sustainable model for multiple integrations, but should work for now.
    pub saber_withdraw: SaberWithdraw<'info>,

    /// CHECK: validate expected vs actual address
    #[account(address = spl_associated_token_account::ID)]
    pub ata_program: AccountInfo<'info>,

    pub rent: Sysvar<'info, Rent>,
}

// ======================================
// [START] SABER SPECIFIC CONTEXTS
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

    pub system_program: Program<'info, System>,

    pub token_program: Program<'info, Token>,
}
// [END] SABER SPECIFIC CONTEXTS
// ======================================
