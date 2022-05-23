use crate::{
    constant::{GLOBAL_STATE_SEED, SOL_DECIMALS, SOL_PUBKEY, VAULT_SEED},
    error::ErrorCode,
    state::{asset::Asset, vault::Vault, vault::VaultConfig, GlobalProtocolState},
};
use anchor_lang::prelude::*;
use anchor_spl::token::Mint;
use solana_program::program_pack::Pack;
use spl_token::state::Mint as SplMint;
use std::mem::size_of;

#[derive(Accounts)]
#[instruction(vault_bump: u8)]
pub struct InitializeVault<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        seeds = [GLOBAL_STATE_SEED.as_bytes()],
        bump,
    )]
    pub global_protocol_state: Box<Account<'info, GlobalProtocolState>>,

    /**
     * note: might want to revisit these PDA seeds. mainly the authority key since an authority could change over time.
     * further, this design is limiting because it assumes a 1-1 mapping between authority address and vault.
     *
     * todo: @dev strategic choice to keep vault seeds simple? no vault should have same authority to limit scope of
     *           impact for compromised keypair. if not, what else to add?
     *
     * todo: should we have an is_authorized / activated variable that will dictate whether or not a vault is ok to proceed.
     *       initially, this instruction could be gated by global protocol authority. but overtime, as the protocol is decentralized,
     *       it could be some sort of multisig.
     */
    #[account(
        init,
        seeds = [
            VAULT_SEED.as_bytes(),
            authority.key().to_bytes().as_ref()
        ],
        bump,
        payer = authority,
        space = 8 + size_of::<Vault>(),
    )]
    pub vault: Box<Account<'info, Vault>>,

    /// CHECK: can be wrapped wSOL, so cannot use Mint
    #[account(mut)]
    pub alpha_mint: UncheckedAccount<'info>,

    #[account(
        mut,
        // decimals checked in instruction
        constraint = alpha_lp.freeze_authority.unwrap() == vault.key(),
        constraint = alpha_lp.mint_authority.unwrap() == vault.key(),
    )]
    pub alpha_lp: Box<Account<'info, Mint>>,

    /// CHECK: can be wrapped wSOL, so cannot use Mint
    #[account(mut)]
    pub beta_mint: UncheckedAccount<'info>,

    #[account(
        mut,
        // decimals checked in instruction
        constraint = beta_lp.freeze_authority.unwrap() == vault.key(),
        constraint = beta_lp.mint_authority.unwrap() == vault.key(),
    )]
    pub beta_lp: Box<Account<'info, Mint>>,

    pub system_program: Program<'info, System>,
}

/// Create the vault struct with the initial configuration data.
///
/// @dev: on initialize, the vault requires the same number of decimals between the asset
/// and the LP. This enables a 1-1 exchange rate between asset and LP. this currently happens
/// off-chain and is enforced via context.
///
/// @dev: the strategy referenced by the vault should be created before initializing the vault.
pub fn handle(
    ctx: Context<InitializeVault>,
    vault_bump: u8,
    vault_config: VaultConfig,
) -> ProgramResult {
    msg!(
        "initializing vault {} with authority {}",
        ctx.accounts.vault.key(),
        ctx.accounts.authority.key()
    );
    msg!("vault_config: {:?}", vault_config);

    verify_mint_lp_decimals_match(
        ctx.accounts.alpha_mint.to_account_info(),
        ctx.accounts.alpha_lp.decimals,
    )?;
    let alpha = Asset::builder()
        .mint(ctx.accounts.alpha_mint.key())
        .lp(ctx.accounts.alpha_lp.key())
        .asset_cap(vault_config.alpha.asset_cap)
        .user_cap(vault_config.alpha.user_cap)
        .build()?;
    msg!("alpha: {:?}", alpha);

    verify_mint_lp_decimals_match(
        ctx.accounts.beta_mint.to_account_info(),
        ctx.accounts.beta_lp.decimals,
    )?;
    let beta = Asset::builder()
        .mint(ctx.accounts.beta_mint.key())
        .lp(ctx.accounts.beta_lp.key())
        .asset_cap(vault_config.beta.asset_cap)
        .user_cap(vault_config.beta.user_cap)
        .build()?;
    msg!("beta: {:?}", beta);

    ctx.accounts.vault.init(
        vault_bump,
        ctx.accounts.authority.key(),
        vault_config,
        alpha,
        beta,
    );

    Ok(())
}

pub fn verify_mint_lp_decimals_match<'a>(mint: AccountInfo<'a>, lp_decimals: u8) -> ProgramResult {
    require!(
        get_mint_decimals(mint) == lp_decimals,
        ErrorCode::DecimalMismatch
    );

    Ok(())
}

pub fn get_mint_decimals<'a>(mint: AccountInfo<'a>) -> u8 {
    match *mint.key == SOL_PUBKEY {
        true => SOL_DECIMALS,
        false => {
            let token_mint = SplMint::unpack_from_slice(&mint.data.borrow()).unwrap();
            token_mint.decimals
        }
    }
}
