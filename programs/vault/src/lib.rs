use anchor_lang::prelude::*;

#[macro_use]
mod macros;

mod constant;
mod context;
mod error;
mod instructions;
mod state;
mod util;

use context::*;
use state::vault::VaultConfig;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod vault {
    use super::*;

    /**
     * Initialize the Saber LP strategy. This just serializes some related metadata and gives us a
     * public key to link via our vault.
     */
    pub fn initialize_saber_strategy(
        ctx: Context<InitializeSaberStrategy>,
        bump: u8,
    ) -> ProgramResult {
        instructions::initialize_saber_strategy::handle(ctx, bump)?;

        Ok(())
    }

    /**
     * Create the vault struct with the initial configuration data.
     *
     * @dev: on initialize, the vault requires the same number of decimals between the asset
     * and the LP. This enables a 1-1 exchange rate between asset and LP. this currently happens
     * off-chain and is enforced via context.
     */
    pub fn initialize_vault(
        ctx: Context<InitializeVault>,
        vault_bump: u8,
        vault_config: VaultConfig,
    ) -> ProgramResult {
        instructions::initialize_vault::handle(ctx, vault_bump, vault_config)?;

        Ok(())
    }

    /**
     * Anyone can deposit an asset on either side of the vault.
     */
    pub fn deposit(
        ctx: Context<Deposit>,
        deposit_index: u64,
        receipt_bump: u8,
        history_bump: u8,
        amount: u64,
    ) -> ProgramResult {
        instructions::deposit::handle(ctx, deposit_index, receipt_bump, history_bump, amount)?;

        Ok(())
    }

    /**
     * After the vault's funds are invested, there is a chance one side of the vault will have excess funds
     * that were not invested. This instruction will do two things:
     *
     *   - return excess funds
     *   - mint a proportional number of LP tokens representing a position in the vault's tranche's invested
     *     assets. This is a tokenized position that allows the depositor to leverage across the ecosystem.
     *     These LP tokens will also be referenced when a user decides to withdraw assets from the vault.
     *
     * This instruction can only be invoked after the funds are invested and the claims are processed.
     */
    pub fn claim(ctx: Context<Claim>) -> ProgramResult {
        instructions::claim::handle(ctx)?;

        Ok(())
    }

    /**
     * Anyone with a specific tranche's LP token can burn the LP for the underlying collateral.
     * By the time someone can initiate a withdrawal, we assume the vault's assets are balanced
     * and use a ratio of LP supply + current token account balance to determine the number of
     * underlying assets someone is entitled to.
     *
     * Anyone with deposits that didn't make it into a vault's tranche can explicitly claim
     * the excess amount. This will burn the proportionate number of LP tokens. An error will be thrown
     * if the user doesn't actually have an excess deposit to claim.
     *
     * todo @dev include extra variable saying whether funds have been balanced? we want to prevent people
     *      from rugging themselves.
     */
    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> ProgramResult {
        instructions::withdraw::handle(ctx, amount)?;

        Ok(())
    }

    /**
     * Based on a vault's strategy, we will deserialize the related account state and call
     * implemented `invest` trait. Depending on the strategy, it will take different
     * actions. In the case of an AMM, it will supply a token pair in exchange for LP
     * tokens representing the position in the pool.
     */
    pub fn invest(
        ctx: Context<Invest>,
        investable_a: u64,
        investable_b: u64,
        min_tokens_back: u64,
    ) -> ProgramResult {
        instructions::invest::handle(ctx, investable_a, investable_b, min_tokens_back)?;

        Ok(())
    }

    /**
     * After investing funds, we will know if there are any excess assets for users to claim.
     * This can happen when we need to balance both sides of the vault.
     *
     * in order to process claims, we need to do 2 things:
     *   1. work backwards from the most recent deposit. the goal is to find the deposit that
     *      saturated the vault past the deposited amount.
     *   2. we need to compute the amount every user is entitled to and serialize that on the vault.
     *
     * @dev the calling client will do most of the work here to figure out what accounts to pass in,
     *      the instruction just verifies correctness. we probably need to bump the compute units of
     *      these instructions.
     *
     * @dev since there is a limit to how many accounts can be passed to a transaction, it's possible
     *      we'll need to invoke this instruction multiple times. The instruction saves intermediary
     *      state and won't reprocess information when finished.
     *  
     * @dev after the vaults are finalized and funds are returned, we can close history and claim
     *      accounts to retrieve the rent funds. These can be returned to users or redirected to
     *      the protocol as an additional fee.
     *
     */
    pub fn process_claims(ctx: Context<ProcessClaims>) -> ProgramResult {
        instructions::process_claims::handle(ctx)?;

        Ok(())
    }

    /**
     * Based on a vault's strategy, we will deserialize the related account state and call
     * implemented `redeem` trait. Depending on the strategy, it will take different
     * actions. In the case of an AMM, it will burn an LP token in exchange for a relative
     * nuber of the pool's tokens.
     */
    pub fn redeem(ctx: Context<Redeem>, min_token_a: u64, min_token_b: u64) -> ProgramResult {
        instructions::redeem::handle(ctx, min_token_a, min_token_b)?;

        Ok(())
    }

    // perform swap = based on fixed rate
    // pub fn swap(ctx: Context<Swap>, expected_a: u64) -> ProgramResult {}
}

// [] new entity to sign for process claim related functionality
// [] add assertion checks in tests
// [] create a wrapper class for test logic

/**
 * tests
 *
 * - init saber strategy
 * - init vault
 *
 * - deposit
 *   - try to deposit before active
 *   - deposit past user cap
 *   - deposit past asset cap
 *   - deposit a bunch and check num deposits match
 *   - deposit mint that doesn't exist on vault
 *   - deposit ix with lp mint that doesn't match what's expected
 *   - try to make a deposit at an index that already exists
 *
 * - invest
 *   - try to invest before invest period
 *   - invest where no imbalance in deposits
 *
 * - process claims 👀
 *   - try to process before invest happens
 *
 * - redeem
 *    - try to redeem before time to do so
 *    - try to redeem with a slippage that fails checks
 *    - success
 *
 * - claim
 *   - try to claim before claims processed
 *   - try to claim with no lp tokens
 *   - try to claim with mint that doesn't exist on vault
 *   - try to
 *   - try to claim ix with lp mint that doesn't match what's expected
 *
 * - withdraw (verify lp tokens burned)
 *   - try to withdraw before redeeed
 *   - withdraw without any lp tokens
 *   - withdraw while amount = 0
 *   - withdraw while amount > 0
 *   - can claim right before withdrawal?
 *
 */
pub fn docs() -> u64 {
    return 0;
}

// lifecycle
// same mints for all tokens, since tied to underlying saber pools?

// create vault with all the attributes
// deposit
