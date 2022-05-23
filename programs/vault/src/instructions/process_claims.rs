use crate::{
    constant::{GLOBAL_STATE_SEED, VAULT_SEED},
    error::ErrorCode,
    state::{vault::Vault, GlobalProtocolState, History, Receipt},
    util::{
        assert_valid_pda, get_history_address_and_bump_seed, get_receipt_address_and_bump_seed,
    },
};
use anchor_lang::prelude::*;
use solana_program::account_info::next_account_infos;
use std::convert::TryInto;
use vipers::unwrap_int;

// todo: who can invoke function? authority on vault?
#[derive(Accounts)]
pub struct ProcessClaims<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: read-only account to validate vault address
    pub authority: UncheckedAccount<'info>,

    #[account(
        seeds = [GLOBAL_STATE_SEED.as_bytes()],
        bump,
    )]
    pub global_protocol_state: Box<Account<'info, GlobalProtocolState>>,

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
pub struct ProcessClaimInfo<'info> {
    #[account(mut)]
    pub receipt: Box<Account<'info, Receipt>>,

    #[account(mut)]
    pub history: Box<Account<'info, History>>,
}

///  After investing funds, we will know if there are any excess assets for users to claim.
///  This can happen when we need to balance both sides of the vault.
///
///  in order to process claims, we need to do 2 things:
///    1. work backwards from the most recent deposit. the goal is to find the deposit that
///       saturated the vault past the deposited amount.
///    2. we need to compute the amount every user is entitled to and serialize that on the vault.
///
///  @dev the calling client will do most of the work here to figure out what accounts to pass in,
///       the instruction just verifies correctness. we probably need to bump the compute units of
///       these instructions.
///
///  @dev since there is a limit to how many accounts can be passed to a transaction, it's possible
///       we'll need to invoke this instruction multiple times. The instruction saves intermediary
///       state and won't reprocess information when finished.
///   
///  @dev after the vaults are finalized and funds are returned, we can close history and claim
///       accounts to retrieve the rent funds. These can be returned to users or redirected to
///       the protocol as an additional fee.
///
///  todo: refactor comments below
///  figure out if there is excess on either asset. if not, exit.
///  if excess, save that to vault state. and claims index to most recent index.
///
///  1. first time calling - no claims
///  2. first time calling - claims
///  3. nth time calling - no claims
///  4. nth time calling - claims
///
///  if we found last discrepancy, update claims_processed => true
///  iterate through ctx.remaining_accounts to, verify acccount data, update the users history
///  an instruction that could require A LOT of compute / strategic splitting to fit into
///  account limits.
///  relate n & n+1 accounts for user (deposit, history) -> update vault
///
pub fn handle(ctx: Context<ProcessClaims>) -> ProgramResult {
    let vault = &mut ctx.accounts.vault;
    vault.set_excess_if_possible()?;

    // no more claims to process, exit early
    if vault.excess.is_none() || vault.claims_already_processed() {
        return Ok(());
    }

    let excess_asset_mint = vault.excess.unwrap();
    let excess_asset = vault.get_asset(&excess_asset_mint)?;
    let excess_asset_invested = excess_asset.invested;

    let remaining_accounts = ctx.remaining_accounts;
    let num_remaining_accounts = remaining_accounts.len();
    // if no value is set (first time processing), the default will be the total number of depoits on the vault
    // todo: be careful about 0 index here
    let start = vault.claims_idx.unwrap_or(excess_asset.deposits);

    let num_accounts_to_process = unwrap_int!(num_remaining_accounts.checked_div(2));
    let remaining_accounts_iter = &mut ctx.remaining_accounts.iter();
    // keep track of actual number of accounts processed. we need this on top of remaining accounts count in case we exit early.
    let mut num_claims_processsed = 0 as u64;
    for idx in 0..num_accounts_to_process {
        let mut process_claim_info: ProcessClaimInfo = Accounts::try_accounts(
            &crate::ID,
            &mut next_account_infos(remaining_accounts_iter, 2)?,
            &[],
        )?;

        // we are walking backward, so we go from n to n-m
        let claim_idx = start
            .checked_sub(idx.try_into().unwrap())
            .ok_or_else(math_error!())?;

        // todo: do we also need to check discriminator?
        let receipt_info = &process_claim_info.receipt.to_account_info();
        let (curr_receipt_address, curr_receipt_bump) =
            get_receipt_address_and_bump_seed(&vault.key(), &excess_asset_mint, claim_idx);
        assert_valid_pda(
            receipt_info,
            &curr_receipt_address,
            curr_receipt_bump == process_claim_info.receipt.bump,
        )?;

        let history_info = &process_claim_info.history.to_account_info();
        let (curr_history_address, curr_history_bump) = get_history_address_and_bump_seed(
            &vault.key(),
            &excess_asset_mint,
            &process_claim_info.receipt.depositor,
        );
        assert_valid_pda(
            history_info,
            &curr_history_address,
            curr_history_bump == process_claim_info.history.bump,
        )?;

        let cumulative_amount = process_claim_info.receipt.cumulative;
        let deposit_amount = process_claim_info.receipt.amount;

        let (amount, is_complete) =
            compute_claim_amount(excess_asset_invested, cumulative_amount, deposit_amount)?;
        // todo: does this actually update the claim amount? -> we should make sure history is a &mut
        process_claim_info.history.add_claim(amount)?;

        if is_complete {
            vault.finalize_claims();
            break;
        }

        num_claims_processsed = num_claims_processsed
            .checked_add(1)
            .ok_or_else(math_error!())?;
    }

    // update end index so that next time, we can continue processing
    let end_idx = start
        .checked_sub(num_claims_processsed.try_into().unwrap())
        .ok_or_else(math_error!())?;

    vault.update_claims_index(end_idx);

    Ok(())
}

pub fn compute_claim_amount(
    invested: u64,
    cumulative: u64,
    deposited: u64,
) -> Result<(u64, bool), ProgramError> {
    let cumulative_after_deposit = cumulative
        .checked_add(deposited)
        .ok_or_else(math_error!())?;

    if cumulative > invested {
        // return full deposit amount
        return Ok((deposited, false));
    } else if cumulative_after_deposit > invested {
        // return marginal amount
        let claim_amount = cumulative_after_deposit
            .checked_add(invested)
            .ok_or_else(math_error!())?;

        return Ok((claim_amount, true));
    }

    Ok((0, true))
}
