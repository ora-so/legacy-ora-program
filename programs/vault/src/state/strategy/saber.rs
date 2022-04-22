use {
  anchor_lang::prelude::*,
  crate::{
    constant::VAULT_SEED,
    context::{Invest, Redeem},
    error::ErrorCode,
    state::strategy::StrategyActions,
    util::{assert_is_ata, create_ata_if_dne, with_slippage},
    math_error
  },
  bytemuck::{cast_slice_mut, from_bytes_mut, try_cast_slice_mut, Pod, Zeroable},
  std::cell::RefMut,
  stable_swap_anchor::{
    Deposit, SwapOutput, SwapToken, SwapUserContext,
    Withdraw,
  },
};

#[account]
#[derive(Default, Copy)]
pub struct SaberStrategy {
  flags: u64, // helps decode strategy type

  // add saber swap pool info for verification
}

// dev: probably need to pass in some shared context so that we can pull balances off ATAs and what not
impl StrategyActions for SaberStrategy {
  fn invest(&self, ctx: Context<Invest>, slippage_tolerance: u16) -> ProgramResult {
    let vault = &ctx.accounts.vault;
    
    // right now, the strategy knows nothing about a vault. there's only a one-way mapping
    // from the vault to the strategy, which we verify here. in the future, we may want to
    // store and validate additional parameters.
    require!(vault.strategy == ctx.accounts.strategy.key(), ErrorCode::PublicKeyMismatch);

    let alpha_amount = vault.alpha.deposited;
    let beta_amount = vault.beta.deposited;

    msg!(
      "investing {} of asset {} and {} of asset {} with slippage tolerance [{}%] into vault {}",
      alpha_amount,
      vault.alpha.mint.key(),
      beta_amount,
      vault.beta.mint.key(),
      slippage_tolerance,
      vault.key()
    );

    create_and_verify_ata_for_invest(&ctx)?;

    let min_mint_amount = with_slippage(
      alpha_amount
        .checked_add(beta_amount)
        .ok_or_else(math_error!())?,
      slippage_tolerance)?;
  
    let authority = ctx.accounts.authority.key();
    // invest tokens from vault ATA to saber pool. recieve LP tokens in a vault ATA.
    stable_swap_anchor::deposit(
      ctx.accounts
        .into_saber_swap_invest_context()
        .with_signer(&[&[
          VAULT_SEED.as_bytes(),
          authority.as_ref(),
          &[ctx.accounts.vault.bump],
        ]]),
        alpha_amount,
        beta_amount,
      min_mint_amount,
    )?;

    Ok(())
  }

  fn redeem(&self, ctx: Context<Redeem>, slippage_tolerance: u16) -> ProgramResult {
    let vault = &ctx.accounts.vault;

    // right now, the strategy knows nothing about a vault. there's only a one-way mapping
    // from the vault to the strategy, which we verify here. in the future, we may want to
    // store and validate additional parameters.
    require!(vault.strategy == ctx.accounts.strategy.key(), ErrorCode::PublicKeyMismatch);

    msg!("redeeming token a = {}, token b = {}", vault.alpha.invested, vault.beta.invested);

    // todo: figure out a more flexible orientation in case a/b switch spots
    assert_is_ata(
      &ctx.accounts.saber_withdraw.saber_swap_common.source_token_a.to_account_info(),
      &vault.key(),
      &vault.alpha.mint
    )?;

    assert_is_ata(
      &ctx.accounts.saber_withdraw.saber_swap_common.source_token_b.to_account_info(),
      &vault.key(),
      &vault.beta.mint
    )?;

    // todo: do we have options when redeeming tokens here? for simplicity, assumption 
    // right now is that they should probably be redeemed in equal ratio.
    let num_lp_tokens = ctx.accounts.saber_withdraw.input_lp.amount;
    let per_asset_tokens = with_slippage(
        num_lp_tokens,
        slippage_tolerance)?
      .checked_div(2)
      .ok_or_else(math_error!())?;

    let authority = ctx.accounts.authority.key();
    // transfer LP tokens from vault ATA in exchange for some ratio of tokens the specified saber pool.
    stable_swap_anchor::withdraw(
      ctx.accounts
          .into_saber_swap_redeem_context()
          .with_signer(&[&[
            VAULT_SEED.as_bytes(),
            authority.as_ref(),
            &[ctx.accounts.vault.bump],
          ]]),
        num_lp_tokens,
        per_asset_tokens,
        per_asset_tokens,
    )?;

    Ok(())
  }

  // other trait function implementations here
}

// todo: figure out where to init a strategy object
impl SaberStrategy {
  pub fn init(
   &mut self,
   flags: u64, // helps decode strategy type
  ) {
    self.flags = flags;
  }

  #[inline]
  pub fn load<'a>(
    strategy: &'a AccountInfo,
    program_id: &Pubkey,
  ) -> Result<RefMut<'a, SaberStrategy>, ProgramError> {
    require!(strategy.owner == program_id, ErrorCode::WrongAccountOwner);

    let account_data: RefMut<'a, [u8]>;
    account_data = RefMut::map(strategy.try_borrow_mut_data().unwrap(), |data| *data);

    let state: RefMut<'a, Self>;
    state = RefMut::map(account_data, |data| {
      from_bytes_mut(cast_slice_mut::<u8, u8>(try_cast_slice_mut(data).unwrap()))
    });

    Ok(state)
  }
}

#[cfg(target_endian = "little")]
unsafe impl Zeroable for SaberStrategy {}

#[cfg(target_endian = "little")]
unsafe impl Pod for SaberStrategy {}

// transform Invest context into saber swap deposit CPI context
impl<'info> Invest<'info> {
  pub fn into_saber_swap_invest_context(
    &self,
  ) -> CpiContext<'_, '_, '_, 'info, Deposit<'info>> {
    let cpi_program = self
        .saber_deposit
        .saber_swap_common
        .saber_program
        .to_account_info();
  
    let cpi_accounts = Deposit {
        /// The context of the user
        user: SwapUserContext {
            /// The spl_token program
            token_program: self.saber_deposit.saber_swap_common.token_program.to_account_info(),
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

// transform Invest context into saber swap deposit CPI context
impl<'info> Redeem<'info> {
  pub fn into_saber_swap_redeem_context(
    &self,
) -> CpiContext<'_, '_, '_, 'info, Withdraw<'info>> {
    let cpi_program = self
        .saber_withdraw
        .saber_swap_common
        .saber_program
        .to_account_info();

    let cpi_accounts = Withdraw {
        /// The context of the user
        user: SwapUserContext {
            /// The spl_token program
            token_program: self.saber_withdraw.saber_swap_common.token_program.to_account_info(),
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
}

fn create_and_verify_ata_for_invest(ctx: &Context<Invest>) -> ProgramResult {
  create_ata_if_dne(
      ctx.accounts.vault_lp.to_account_info(),
      ctx.accounts.vault.to_account_info(),
      ctx.accounts.saber_deposit.output_lp.to_account_info(),
      ctx.accounts.payer.to_account_info(),
      ctx.accounts.ata_program.to_account_info(),
      ctx.accounts.saber_deposit.saber_swap_common.token_program.to_account_info(),
      ctx.accounts.saber_deposit.saber_swap_common.system_program.to_account_info(),
      ctx.accounts.rent.to_account_info(),
      &[],
  )?;

  assert_is_ata(
      &ctx.accounts.vault_lp.to_account_info(),
      &ctx.accounts.vault.key(),
      &ctx.accounts.saber_deposit.output_lp.key(),
  )?;

  Ok(())
}
