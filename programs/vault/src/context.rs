use {
    crate::{
        constant::{HISTORY_SEED, RECEIPT_SEED, STRATEGY_SEED, VAULT_SEED},
        state::{
            deposit::{
                history::{History, HISTORY_SIZE},
                receipt::{Receipt, RECEIPT_SIZE},
            },
            strategy::saber::{SaberLpStrategyV0, SABER_STRATEGY_SIZE},
            vault::Vault,
        },
    },
    anchor_lang::prelude::*,
    anchor_spl::token::{Mint, Token, TokenAccount, Transfer},
    std::mem::size_of,
};

// todo: how to restrict this instruction?
#[derive(Accounts)]
pub struct InitializeSaberStrategy<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        seeds = [
            STRATEGY_SEED.as_bytes(),
            token_a.key().to_bytes().as_ref(),
            token_b.key().to_bytes().as_ref(),
            authority.key().to_bytes().as_ref()
        ],
        bump,
        payer = authority,
        space = SABER_STRATEGY_SIZE
    )]
    pub saber_strategy: Box<Account<'info, SaberLpStrategyV0>>, // UncheckedAccount<'info>, //

    pub token_a: Box<Account<'info, Mint>>,

    pub token_b: Box<Account<'info, Mint>>,

    pub system_program: Program<'info, System>,

    pub rent: Sysvar<'info, Rent>,
}

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
    pub vault: Box<Account<'info, Vault>>,

    #[account(mut)]
    /// CHECK: TODO
    pub strategy: UncheckedAccount<'info>,

    #[account(mut)]
    /// CHECK: TODO
    pub strategist: UncheckedAccount<'info>,

    #[account(mut)]
    pub alpha_mint: Box<Account<'info, Mint>>,

    #[account(
        mut,
        constraint = alpha_lp.decimals == alpha_mint.decimals,
        constraint = alpha_lp.freeze_authority.unwrap() == vault.key(),
        constraint = alpha_lp.mint_authority.unwrap() == vault.key(),
    )]
    pub alpha_lp: Box<Account<'info, Mint>>,

    #[account(mut)]
    pub beta_mint: Box<Account<'info, Mint>>,

    #[account(
        mut,
        constraint = beta_lp.decimals == beta_mint.decimals,
        constraint = beta_lp.freeze_authority.unwrap() == vault.key(),
        constraint = beta_lp.mint_authority.unwrap() == vault.key(),
    )]
    pub beta_lp: Box<Account<'info, Mint>>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(deposit_index: u64)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: read-only account to validate vault address
    pub authority: UncheckedAccount<'info>,

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

    #[account(
        init,
        seeds = [
            RECEIPT_SEED.as_bytes(),
            vault.key().to_bytes().as_ref(),
            mint.key().to_bytes().as_ref(),
            &deposit_index.to_le_bytes()
        ],
        bump,
        payer = payer,
        space = RECEIPT_SIZE
    )]
    pub receipt: Box<Account<'info, Receipt>>,

    #[account(
        init_if_needed,
        seeds = [
            HISTORY_SEED.as_bytes(),
            vault.key().to_bytes().as_ref(),
            mint.key().to_bytes().as_ref(),
            payer.key().to_bytes().as_ref(),
        ],
        bump,
        payer = payer,
        space = HISTORY_SIZE
    )]
    pub history: Box<Account<'info, History>>,

    pub mint: Box<Account<'info, Mint>>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = payer,
        // constraint = source_ata.amount >= amount
    )]
    pub source_ata: Box<Account<'info, TokenAccount>>,

    /// CHECK: create and validate JIT in instruction
    #[account(mut)]
    pub destination_ata: UncheckedAccount<'info>,

    /// =============== PROGRAM ACCOUNTS ===============
    pub system_program: Program<'info, System>,

    pub token_program: Program<'info, Token>,

    /// CHECK: validate expected vs actual address
    #[account(address = spl_associated_token_account::ID)]
    pub ata_program: UncheckedAccount<'info>,

    pub rent: Sysvar<'info, Rent>,
}

// todo: who can be signer here?
#[derive(Accounts)]
#[instruction(deposit_index: u64)]
pub struct Claim<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: read-only account to validate vault address
    pub authority: UncheckedAccount<'info>,

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

    #[account(
        mut,
        seeds = [
            HISTORY_SEED.as_bytes(),
            vault.key().to_bytes().as_ref(),
            mint.key().to_bytes().as_ref(),
            payer.key().to_bytes().as_ref(),
        ],
        bump,
    )]
    pub history: Box<Account<'info, History>>,

    pub mint: Box<Account<'info, Mint>>,

    #[account(mut)]
    pub lp: Box<Account<'info, Mint>>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = vault,
    )]
    pub source_ata: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = payer,
    )]
    pub destination_ata: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        associated_token::mint = lp,
        associated_token::authority = payer,
    )]
    pub destination_lp_ata: Box<Account<'info, TokenAccount>>,

    /// =============== PROGRAM ACCOUNTS ===============
    pub system_program: Program<'info, System>,

    pub token_program: Program<'info, Token>,

    /// CHECK: validate expected vs actual address
    #[account(address = spl_associated_token_account::ID)]
    pub ata_program: UncheckedAccount<'info>,

    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct ProcessClaimInfo<'info> {
    #[account(mut)]
    pub receipt: Box<Account<'info, Receipt>>,

    #[account(mut)]
    pub history: Box<Account<'info, History>>,
}

#[derive(Accounts)]
#[instruction(amount: u64)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: read-only account to validate vault address
    pub authority: UncheckedAccount<'info>,

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

    #[account(mut)]
    pub mint: Box<Account<'info, Mint>>,

    #[account(mut)]
    pub lp: Box<Account<'info, Mint>>,

    #[account(mut)]
    pub source_lp: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = vault,
        constraint = source_ata.amount >= amount
    )]
    pub source_ata: Account<'info, TokenAccount>,

    /// CHECK: create and validate JIT in instruction
    #[account(mut)]
    pub destination_ata: UncheckedAccount<'info>,

    /// =============== PROGRAM ACCOUNTS ===============
    pub system_program: Program<'info, System>,

    pub token_program: Program<'info, Token>,

    /// CHECK: validate expected vs actual address
    #[account(address = spl_associated_token_account::ID)]
    pub ata_program: UncheckedAccount<'info>,

    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct Invest<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: read-only account to validate vault address
    pub authority: UncheckedAccount<'info>,

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
    pub saber_deposit: SaberDeposit<'info>,

    /// CHECK: validate expected vs actual address
    #[account(address = spl_associated_token_account::ID)]
    pub ata_program: UncheckedAccount<'info>,

    pub rent: Sysvar<'info, Rent>,
}

// todo: who can invoke function?
#[derive(Accounts)]
pub struct ProcessClaims<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: read-only account to validate vault address
    pub authority: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [
            VAULT_SEED.as_bytes(),
            authority.key().to_bytes().as_ref()
        ],
        bump,
        constraint = vault.authority == authority.key(),
        // constraint = vault.strategist == payer.key()
    )]
    pub vault: Box<Account<'info, Vault>>,
}

#[derive(Accounts)]
pub struct Redeem<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: read-only account to validate vault address
    pub authority: UncheckedAccount<'info>,

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
    pub ata_program: UncheckedAccount<'info>,

    pub rent: Sysvar<'info, Rent>,
}

// ======================================
// [START] SABER SPECIFIC CONTEXTS
#[derive(Accounts)]
pub struct SaberDeposit<'info> {
    /// custom struct to encapsulate all common saber swap accounts
    pub saber_swap_common: SaberSwapCommon<'info>,

    /// The output account for LP tokens
    /// CHECK: validate expected vs actual address
    #[account(mut)]
    pub output_lp: Box<Account<'info, TokenAccount>>,
}

#[derive(Accounts)]
pub struct SaberWithdraw<'info> {
    /// custom struct to encapsulate all common saber swap accounts
    pub saber_swap_common: SaberSwapCommon<'info>,

    /// The token account a pool's LP tokens
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
    /// CHECK: verified via saber stable swap CPI call
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

    pub system_program: Program<'info, System>,

    pub token_program: Program<'info, Token>,
}
// [END] SABER SPECIFIC CONTEXTS
// ======================================
