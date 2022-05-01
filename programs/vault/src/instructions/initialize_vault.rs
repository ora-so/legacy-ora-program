use {
    crate::{
        context::InitializeVault,
        state::{asset::Asset, vault::VaultConfig},
    },
    anchor_lang::prelude::*,
};

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

    let alpha = Asset::builder()
        .mint(ctx.accounts.alpha_mint.key())
        .lp(ctx.accounts.alpha_lp.key())
        .build();

    let beta = Asset::builder()
        .mint(ctx.accounts.beta_mint.key())
        .lp(ctx.accounts.beta_lp.key())
        .build();

    ctx.accounts.vault.init(
        vault_bump,
        ctx.accounts.authority.key(),
        vault_config,
        alpha,
        beta,
    );

    Ok(())
}
