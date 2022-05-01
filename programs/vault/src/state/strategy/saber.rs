use {
    crate::{
        constant::VAULT_SEED,
        context::{Invest, Redeem},
        error::ErrorCode,
        state::{asset::Asset, strategy::StrategyActions, vault::Vault},
        util::{assert_is_ata, create_ata_if_dne, with_slippage},
    },
    anchor_lang::prelude::*,
    anchor_spl::token::TokenAccount,
    borsh::BorshDeserialize,
    bytemuck::{Pod, Zeroable},
    solana_program::borsh::try_from_slice_unchecked,
    stable_swap_anchor::{Deposit, SwapOutput, SwapToken, SwapUserContext, Withdraw},
    std::cmp::min,
};

pub fn balance_difference(
    token_account: &mut Account<TokenAccount>,
) -> std::result::Result<(u64, u64), ProgramError> {
    let before = token_account.amount;
    token_account.reload()?;

    Ok((before, token_account.amount))
}

pub fn verify_received(
    token_account: &mut Account<TokenAccount>,
    min_expected: u64,
) -> std::result::Result<u64, ProgramError> {
    let (before, after) = balance_difference(token_account)?;
    let received = after.checked_sub(before).ok_or_else(math_error!())?;
    require!(received >= min_expected, ErrorCode::SlippageTooHigh);

    Ok(received)
}

pub fn try_from_slice_checked<T: BorshDeserialize>(
    data: &[u8],
    // data_type: Key,
    data_size: usize,
) -> Result<T, ProgramError> {
    if data.len() != data_size {
        return Err(ErrorCode::DataTypeMismatch.into());
    }

    let result: T = try_from_slice_unchecked(data)?;

    Ok(result)
}

pub const SABER_STRATEGY_SIZE: usize = 8 + // discriminator
    8 + // flag
    1 + // bump
    32 + // token a
    32; // token b

// todo: store bump?
// does this work without anchor (de)serialize
#[account]
#[derive(Default, Copy, PartialEq, Debug)]
pub struct SaberLpStrategyV0 {
    // helps decode specific strategy type
    pub flags: u64,
    // pda bump
    pub bump: u8,
    pub token_a: Pubkey,
    // add saber swap pool info for verification
    pub token_b: Pubkey,
    //
    // todo: add slippaage guardrails in swaps?
}

// dev: probably need to pass in some shared context so that we can pull balances off ATAs and what not
// todo: make sure all accounts are validated?
impl StrategyActions for SaberLpStrategyV0 {
    /**
     * @dev Given the total available amounts of senior and junior assets.
     *      invest as much as possible and record any excess uninvested
     *      assets.
     *
     * invest amount_a and amount_b
     */
    fn invest(
        &self,
        ctx: Context<Invest>,
        amount_a: u64,
        amount_b: u64,
        min_out: u64,
    ) -> ProgramResult {
        // temp: take in directly from caller
        // let min_mint_amount = with_slippage(
        //     amount_a.checked_add(amount_b).ok_or_else(math_error!())?,
        //     slippage_tolerance,
        // )?;

        create_and_verify_ata_for_invest(&ctx)?;

        let authority = *ctx.accounts.authority.key;
        // invest tokens from vault ATA to saber pool. recieve LP tokens in a vault ATA.
        stable_swap_anchor::deposit(
            ctx.accounts
                .into_saber_swap_invest_context()
                .with_signer(&[&[
                    VAULT_SEED.as_bytes(),
                    authority.as_ref(),
                    &[ctx.accounts.vault.bump],
                ]]),
            amount_a,
            amount_b,
            min_out,
        )?;

        Ok(())
    }

    /**
     * @dev Convert all LP tokens back into the pair of underlying.
     *      Initially, we will equally redeem underlying assets in
     *      equal quantities based on USD value. The senior tranche
     *      is expecting to get paid some hurdle rate above the
     *      principal. Here are the possible outcomes:
     *
     *      - Senior tranche doesn't have enough: sell some or all
     *        junior tranche assets to make teh senior tranche whole.
     *        In the worst case, the senior tranche could suffer
     *        a loss and the junior tranche will be wiped out.
     *
     *      - If the senior tranche has more than enough, reduce this tranche
     *        to the expected payoff. The excess senior tokens should be
     *        converted to junior tokens.
     *
     * https://github.com/ondoprotocol/ondo-protocol/blob/main/contracts/strategies/UniswapStrategy.sol#L301
     */

    fn redeem(&self, ctx: Context<Redeem>, min_token_a: u64, min_token_b: u64) -> ProgramResult {
        // vault pubkey verified via context

        assert_is_ata(
            &ctx.accounts.saber_withdraw.input_lp.to_account_info(),
            &ctx.accounts.vault.key(),
            &ctx.accounts
                .saber_withdraw
                .saber_swap_common
                .pool_mint
                .key(),
        )?;

        // transfer LP tokens from vault ATA in exchange for some ratio of tokens the specified saber pool.
        // https://github.com/Uniswap/v2-periphery/blob/dda62473e2da448bc9cb8f4514dadda4aeede5f4/contracts/UniswapV2Router02.sol#L103
        let authority = ctx.accounts.authority.key();
        stable_swap_anchor::withdraw(
            ctx.accounts
                .into_saber_swap_redeem_context()
                .with_signer(&[&[
                    VAULT_SEED.as_bytes(),
                    authority.as_ref(),
                    &[ctx.accounts.vault.bump],
                ]]),
            ctx.accounts.saber_withdraw.input_lp.amount,
            0,
            0,
        )?;

        let received_a = verify_received(
            &mut ctx.accounts.saber_withdraw.saber_swap_common.source_token_a,
            min_token_a,
        )?;
        ctx.accounts.vault.update_receipt(
            &ctx.accounts
                .saber_withdraw
                .saber_swap_common
                .source_token_a
                .mint,
            received_a,
        )?;

        let received_b = verify_received(
            &mut ctx.accounts.saber_withdraw.saber_swap_common.source_token_b,
            min_token_b,
        )?;
        ctx.accounts.vault.update_receipt(
            &ctx.accounts
                .saber_withdraw
                .saber_swap_common
                .source_token_b
                .mint,
            received_b,
        )?;

        // note: based on tranche returns, we'll need to change the per-asset distribution.
        // this could mean pulling out assets in different proportions (demoninated in USD).
        // or, later computing returns and doing swaps?
        // dev: reload token account for senior tranche asset, check if it meets the expected amount.

        Ok(())
    }

    // other trait function implementations here
}

// todo: figure out where to init a strategy object
impl SaberLpStrategyV0 {
    pub fn init(
        &mut self,
        bump: u8,
        flags: u64, // helps decode strategy type
        token_a: Pubkey,
        token_b: Pubkey,
    ) {
        self.bump = bump;
        self.flags = flags;
        self.token_a = token_a;
        self.token_b = token_b;
    }

    #[inline]
    pub fn load<'a>(
        strategy: &'a AccountInfo,
        program_id: &Pubkey,
    ) -> Result<SaberLpStrategyV0, ProgramError> {
        require!(strategy.owner == program_id, ErrorCode::WrongAccountOwner);

        Ok(try_from_slice_checked(
            &strategy.data.borrow_mut(),
            SABER_STRATEGY_SIZE,
        )?)
    }
}

#[cfg(target_endian = "little")]
unsafe impl Zeroable for SaberLpStrategyV0 {}

#[cfg(target_endian = "little")]
unsafe impl Pod for SaberLpStrategyV0 {}

// transform Invest context into saber swap deposit CPI context
impl<'info> Invest<'info> {
    pub fn into_saber_swap_invest_context(&self) -> CpiContext<'_, '_, '_, 'info, Deposit<'info>> {
        let cpi_program = self
            .saber_deposit
            .saber_swap_common
            .saber_program
            .to_account_info();

        let cpi_accounts = Deposit {
            /// The context of the user
            user: SwapUserContext {
                /// The spl_token program
                token_program: self
                    .saber_deposit
                    .saber_swap_common
                    .token_program
                    .to_account_info(),
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
    pub fn into_saber_swap_redeem_context(&self) -> CpiContext<'_, '_, '_, 'info, Withdraw<'info>> {
        let cpi_program = self
            .saber_withdraw
            .saber_swap_common
            .saber_program
            .to_account_info();

        let cpi_accounts = Withdraw {
            /// The context of the user
            user: SwapUserContext {
                /// The spl_token program
                token_program: self
                    .saber_withdraw
                    .saber_swap_common
                    .token_program
                    .to_account_info(),
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
    let vault_account_info = ctx.accounts.vault.to_account_info();
    let pool_mint_account_info = ctx
        .accounts
        .saber_deposit
        .saber_swap_common
        .pool_mint
        .to_account_info();

    create_ata_if_dne(
        ctx.accounts.saber_deposit.output_lp.to_account_info(),
        vault_account_info.clone(),
        ctx.accounts
            .saber_deposit
            .saber_swap_common
            .pool_mint
            .to_account_info(),
        ctx.accounts.payer.to_account_info(),
        ctx.accounts.ata_program.to_account_info(),
        ctx.accounts
            .saber_deposit
            .saber_swap_common
            .token_program
            .to_account_info(),
        ctx.accounts
            .saber_deposit
            .saber_swap_common
            .system_program
            .to_account_info(),
        ctx.accounts.rent.to_account_info(),
        &[],
    )?;

    assert_is_ata(
        &ctx.accounts.saber_deposit.output_lp.to_account_info(),
        &vault_account_info.key,
        &pool_mint_account_info.key,
    )?;

    Ok(())
}
