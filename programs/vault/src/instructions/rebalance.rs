use crate::{
    error::{ErrorCode, OraResult},
    state::{HasVault, State, Vault},
};
use anchor_lang::prelude::*;

#[repr(C)]
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, Default, PartialEq)]
pub struct SwapConfig {
    /// max number of tokens to put into the pool
    pub max_in: u64,
    /// min number of tokens expected out of the pool
    pub min_out: u64,
    /// swap direction: alpha_to_beta swaps alpha for beta, !alpha_to_beta swaps beta for alpha
    /// this allows the strategist to compute swap info at the SDK layer and then pass that info
    /// to the instruction.
    pub alpha_to_beta: bool,
    // todo: is this sufficient for raydium? where it requires base_in? can maybe
}

pub trait Rebalance<'info> {
    fn rebalance(&mut self, swap_config: SwapConfig) -> OraResult<(u64, u64, u64, u64)>;
}

pub fn handle<'info, T: Rebalance<'info> + HasVault>(
    ctx: Context<'_, '_, '_, 'info, T>,
    swap_config: Option<SwapConfig>,
) -> ProgramResult {
    require!(
        ctx.accounts.vault().state() == State::Rebalance,
        ErrorCode::InvalidVaultState
    );
    msg!("vault state verified");

    // exit early without a valid swap config; this can happen if the redeemed assets naturally hit the expected returns distribution
    let _swap_config = match swap_config {
        Some(x) => x,
        None => return Ok(()),
    };

    // only perform swap and update received values if max_in is non-zero and positive
    if _swap_config.max_in == 0 {
        return Ok(());
    }

    let alpha_to_beta = _swap_config.alpha_to_beta;
    let (alpha_before, alpha_after, beta_before, beta_after) =
        ctx.accounts.rebalance(_swap_config)?;

    update_vault_after_rebalance(
        ctx.accounts.vault_mut(),
        alpha_to_beta,
        alpha_before,
        alpha_after,
        beta_before,
        beta_after,
    )
}

// update received amounts for vault tranches
fn update_vault_after_rebalance<'info>(
    vault: &mut Vault,
    alpha_to_beta: bool,
    alpha_before: u64,
    alpha_after: u64,
    beta_before: u64,
    beta_after: u64,
) -> ProgramResult {
    match alpha_to_beta {
        // swapped for alpha for beta
        true => {
            // before > after => before - after > 0
            let alpha_delta = alpha_before
                .checked_sub(alpha_after)
                .ok_or_else(math_error!())?;
            vault.get_alpha_mut()?.sub_receipt(alpha_delta)?;

            // after > before => after - before > 0
            let beta_delta = beta_after
                .checked_sub(beta_before)
                .ok_or_else(math_error!())?;
            vault.get_beta_mut()?.add_receipt(beta_delta)?;
        }
        // ^_swap_config.alpha_to_beta; swapped for beta for alpha
        false => {
            // after > before => after - before > 0
            let alpha_delta = alpha_after
                .checked_sub(alpha_before)
                .ok_or_else(math_error!())?;
            vault.get_alpha_mut()?.add_receipt(alpha_delta)?;

            // before > after => before - after > 0
            let beta_delta = beta_before
                .checked_sub(beta_after)
                .ok_or_else(math_error!())?;
            vault.get_beta_mut()?.sub_receipt(beta_delta)?;
        }
    }

    Ok(())
}
