pub mod saber;

use {
    crate::{
        context::{Invest, Redeem},
        error::{ErrorCode, OraResult},
    },
    anchor_lang::prelude::*,
    borsh::{BorshDeserialize, BorshSerialize},
    core::mem::size_of,
    enumflags2::BitFlags,
};

use saber::SaberLpStrategyV0;

pub const DISCRIMINATOR_OFFSET: usize = 8;

#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug, Clone, Copy)]
pub enum Key {
    Uninitialized,
    Saber,
}

impl Default for Key {
    fn default() -> Self {
        Key::Uninitialized
    }
}

pub trait StrategyActions {
    fn invest(
        &self,
        ctx: Context<Invest>,
        amount_a: u64,
        amount_b: u64,
        min_out: u64,
    ) -> ProgramResult;
    fn redeem(&self, ctx: Context<Redeem>, min_token_a: u64, min_token_b: u64) -> ProgramResult;

    // other shared actions, like compound
}

#[derive(Copy, Clone, BitFlags, Debug, Eq, PartialEq)]
#[repr(u64)]
pub enum StrategyFlag {
    // leaves us room for 63 strategies; should we increase this to something like u128 or u256?
    SaberLpStrategyV0 = 1u64 << 0,
}

pub enum Strategy {
    SaberLpStrategyV0(saber::SaberLpStrategyV0),
}

impl Strategy {
    pub fn load(strategy: &AccountInfo, program_id: &Pubkey) -> OraResult<Self> {
        let flags = Strategy::strategy_flags(&strategy.try_borrow_data()?)?;
        msg!("flag: {:?}", flags);

        // todo: use flags to determine which strategy to use
        Ok(Strategy::SaberLpStrategyV0(SaberLpStrategyV0::load(
            strategy, program_id,
        )?))
    }

    pub fn strategy_flags(account_data: &[u8]) -> OraResult<BitFlags<StrategyFlag>> {
        let start = DISCRIMINATOR_OFFSET;
        let end = start + size_of::<StrategyFlag>();
        require!(account_data.len() >= end, ErrorCode::InvalidAccountData);

        let mut flag_bytes = [0u8; 8];
        flag_bytes.copy_from_slice(&account_data[start..end]);

        BitFlags::from_bits(u64::from_le_bytes(flag_bytes))
            .map_err(|_| ErrorCode::InvalidStrategyFlag.into())
            .map(Into::into)
    }
}

impl StrategyActions for Strategy {
    fn invest(
        &self,
        ctx: Context<Invest>,
        amount_a: u64,
        amount_b: u64,
        min_out: u64,
    ) -> ProgramResult {
        let result = match self {
            Strategy::SaberLpStrategyV0(s) => s.invest(ctx, amount_a, amount_b, min_out)?,
        };

        Ok(result)
    }

    fn redeem(&self, ctx: Context<Redeem>, min_token_a: u64, min_token_b: u64) -> ProgramResult {
        let result = match self {
            Strategy::SaberLpStrategyV0(s) => s.redeem(ctx, min_token_a, min_token_b)?,
        };

        Ok(result)
    }
}
