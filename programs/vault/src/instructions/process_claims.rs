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

    /// CHECK: read-only account to process claims for 1 side on the vault
    pub mint: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct ProcessClaimInfo<'info> {
    pub receipt: Account<'info, Receipt>,

    #[account(mut)]
    pub history: Account<'info, History>,
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

pub fn handle<'info>(ctx: Context<'_, '_, '_, 'info, ProcessClaims<'info>>) -> ProgramResult {
    // @dev: we intentionally avoid checking vault state at this point. we want to process claims

    let vault_key = ctx.accounts.vault.key();
    let asset_to_process = ctx.accounts.vault.get_asset_mut(ctx.accounts.mint.key)?;

    // no more claims to process, exit early. note that we cannot check if asset->excess == 0,
    // because it's possible the entire balance of a single tranche can be invested.
    if asset_to_process.claims_already_processed() {
        msg!("claims_already_processed. normally, exit early");
        return Ok(());
    } else if asset_to_process.deposits == 0 {
        msg!("num deposits == 0");
        // if there are no deposits on the vault, mark claims index = 0 and processed claims = true
        asset_to_process.update_claims_index(asset_to_process.deposits);
        asset_to_process.finalize_claims();
        return Ok(());
    }

    // if no value is set (first time processing), the default will be the total number of depoits on the vault
    let start = asset_to_process
        .claims_idx
        .unwrap_or(asset_to_process.deposits);
    msg!("start: {}", start);

    let asset_amount_invested = asset_to_process.invested;
    msg!("asset_amount_invested: {}", asset_amount_invested);

    let remaining_accounts = ctx.remaining_accounts;
    let num_remaining_accounts = remaining_accounts.len();
    let num_accounts_to_process = unwrap_int!(num_remaining_accounts.checked_div(2));
    let remaining_accounts_iter = &mut ctx.remaining_accounts.iter();
    // keep track of actual number of accounts processed. we need this on top of remaining accounts count in case we exit early.
    let mut num_claims_processsed = 0 as u64;
    for idx in 0..num_accounts_to_process {
        let mut process_claim_info: ProcessClaimInfo<'info> = Accounts::try_accounts(
            &crate::ID,
            &mut next_account_infos(remaining_accounts_iter, 2)?,
            &[],
        )?;
        // we are walking backward, so we go from n to n-m
        let claim_idx = start
            .checked_sub(idx.try_into().unwrap())
            .ok_or_else(math_error!())?;
        msg!("claim_idx: {}", claim_idx);

        // todo: do we also need to check discriminator?
        let receipt_info = &process_claim_info.receipt.to_account_info();
        let (curr_receipt_address, curr_receipt_bump) =
            get_receipt_address_and_bump_seed(&vault_key, &asset_to_process.mint, claim_idx);
        assert_valid_pda(
            receipt_info,
            &curr_receipt_address,
            curr_receipt_bump == process_claim_info.receipt.bump,
        )?;

        let history_info = &process_claim_info.history.to_account_info();
        let (curr_history_address, curr_history_bump) = get_history_address_and_bump_seed(
            &vault_key,
            &asset_to_process.mint,
            &process_claim_info.receipt.depositor,
        );
        assert_valid_pda(
            history_info,
            &curr_history_address,
            curr_history_bump == process_claim_info.history.bump,
        )?;

        let cumulative_amount = process_claim_info.receipt.cumulative;
        let deposit_amount = process_claim_info.receipt.amount;
        msg!("cumulative_amount: {}", cumulative_amount);
        msg!("deposit_amount: {}", deposit_amount);

        let (amount, is_complete) =
            compute_claim_amount(asset_amount_invested, cumulative_amount, deposit_amount)?;

        process_claim_info.history.add_claim(amount)?;
        process_claim_info
            .history
            .exit(&crate::ID)
            .or(Err(ErrorCode::UnableToWriteToRemainingAccount))?;

        msg!("amount: {}", amount);
        msg!("is_complete: {}", is_complete);

        num_claims_processsed = num_claims_processsed
            .checked_add(1)
            .ok_or_else(math_error!())?;

        if is_complete {
            msg!("done, finalize claims");
            asset_to_process.finalize_claims();
            break;
        }
    }

    // update end index so that next time, we can continue processing
    let end_idx = start
        .checked_sub(num_claims_processsed.try_into().unwrap())
        .ok_or_else(math_error!())?;

    msg!("end_idx: {}", end_idx);

    asset_to_process.update_claims_index(end_idx);

    Ok(())
}

// todo: is this right? verify with bpf tests + simulation
pub fn compute_claim_amount(
    invested: u64,
    cumulative: u64,
    deposited: u64,
) -> Result<(u64, bool), ProgramError> {
    let cumulative_after_deposit = cumulative
        .checked_add(deposited)
        .ok_or_else(math_error!())?;
    msg!("cumulative_after_deposit: {}", cumulative_after_deposit);

    if cumulative == invested {
        msg!("cumulative == invested");
        // cumulative == total amount invested, before investment. return full amount and denote finished processing
        // == true because we hit the cross-over point exactly.
        return Ok((deposited, true));
    } else if cumulative > invested {
        msg!("cumulative > invested");
        // cumulative > total amount invested, before investment. return full amount and denote finished processing
        // == false. we have not yet hit the cross-over point.
        return Ok((deposited, false));
    } else if cumulative_after_deposit > invested {
        msg!("cumulative_after_deposit >= invested");
        // return marginal amount; we found cross over point for claims
        let claim_amount = cumulative_after_deposit
            .checked_sub(invested)
            .ok_or_else(math_error!())?;
        msg!("claim_amount: {}", claim_amount);

        return Ok((claim_amount, true));
    }

    msg!("claim_amount: {}", 0);

    Ok((0, true))
}
