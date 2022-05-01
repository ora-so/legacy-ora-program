use {
    crate::{
        constant::VAULT_SEED, context::Withdraw, error::ErrorCode, state::vault::State,
        util::transfer_with_verified_ata,
    },
    anchor_lang::prelude::*,
    anchor_spl::token::{burn, Burn},
};

#[repr(C)]
#[derive(AnchorSerialize, AnchorDeserialize, Debug, Default, PartialEq)]
pub struct WithdrawConfig {
    pub amount: Option<u64>,
}

/// Allow user to withdraw the amount of mint from the vault to which they are entitled.
///
/// todo: model out different scenarios for returns, yields and distributions. make sure is correct.
///
/// feat:
///     - determine if withdrawal is valid (mint for vault, state of vault, etc)
///     - update any vault state (num withdrawals, user claimed funds, etc)
///     - issue receipt / burn SPL token(s) representing user's position in the vault?
///
/// optionally specify amount to withdraw. otherwise, default is to exchange LP tokens for underlying
/// assets.
pub fn handle(ctx: Context<Withdraw>, amount: u64) -> ProgramResult {
    let num_lp_tokens_for_payer = ctx.accounts.source_lp.amount;
    ctx.accounts.vault.try_transition()?;
    require!(
        ctx.accounts.vault.state == State::Withdraw,
        ErrorCode::InvalidVaultState
    );

    // it is not possible to withdraw funds if they have not been redeemed
    require!(
        ctx.accounts.vault.alpha.received > 0 || ctx.accounts.vault.beta.received > 0,
        ErrorCode::InvalidVaultState
    );

    let asset = ctx.accounts.vault.get_asset(&ctx.accounts.mint.key())?;
    require!(ctx.accounts.lp.key() == asset.lp, ErrorCode::InvalidLpMint);
    // regardless of amount requested, you cannot make a withdrawal without LP tokens
    require!(
        num_lp_tokens_for_payer == 0,
        ErrorCode::CannotWithdrawWithoutLpTokens
    );

    let lp_amount = match amount {
        amount if amount > 0 => amount,
        _ => num_lp_tokens_for_payer,
    };
    burn(ctx.accounts.into_burn_reserve_token_context(), lp_amount)?;

    // assets per lp * lp
    let asset_per_lp =
        (ctx.accounts.source_ata.amount / ctx.accounts.lp.supply) * ctx.accounts.source_lp.amount;

    let authority = ctx.accounts.authority.key();
    let vault_signer_seeds = generate_vault_seeds!(authority.as_ref(), ctx.accounts.vault.bump);
    // &[
    //     VAULT_SEED.as_bytes(),
    //     authority.as_ref(),
    //     &[ctx.accounts.vault.bump],
    // ];

    /*
     * todo: if user has excess deposit to claim, we have two options
     *
     * - change this ixn to account for the extra. in this case, we can
     *   add both instructions to a single transaction.
     * - create a new ixn to handle the claim specifically
     */

    transfer_with_verified_ata(
        ctx.accounts.source_ata.to_account_info(), // change to source
        ctx.accounts.destination_ata.to_account_info(),
        ctx.accounts.payer.to_account_info(),
        ctx.accounts.mint.to_account_info(),
        ctx.accounts.payer.to_account_info(),
        ctx.accounts.ata_program.to_account_info(),
        ctx.accounts.token_program.to_account_info(),
        ctx.accounts.system_program.to_account_info(),
        ctx.accounts.rent.to_account_info(),
        &[],
        ctx.accounts.vault.to_account_info(),
        vault_signer_seeds,
        asset_per_lp,
    )?;

    Ok(())
}

impl<'info> Withdraw<'info> {
    pub fn into_burn_reserve_token_context(&self) -> CpiContext<'_, '_, '_, 'info, Burn<'info>> {
        let cpi_program = self.token_program.to_account_info();

        let cpi_accounts = Burn {
            /// lp mint
            mint: self.lp.to_account_info(),
            /// payer ATA for lp mint
            to: self.source_lp.to_account_info(),
            /// payer redeeming burning tokens in exchange for deposits + returns
            authority: self.payer.to_account_info(),
        };

        CpiContext::new(cpi_program, cpi_accounts)
    }
}
