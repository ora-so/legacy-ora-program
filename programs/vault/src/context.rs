use {
    anchor_lang::prelude::*,
    stable_swap_anchor::{
        Deposit as DepositLiquidity,
        Withdraw as WithdrawLiquidity
    },
};

#[derive(Accounts)]
pub struct Initialize {}

#[derive(Accounts)]
pub struct Deposit {}

// assume we want to withdraw an equal amount of both underlying assets in the pool
// https://github.com/saber-hq/stable-swap/blob/9c93edf591908c0198273546b6c17e07da56b11c/stable-swap-anchor/src/instructions.rs#L167
#[derive(Accounts)]
pub struct Withdraw {}
