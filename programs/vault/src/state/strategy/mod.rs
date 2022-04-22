pub mod saber;

use {
  anchor_lang::prelude::*,
  crate::{
    context::{Invest, Redeem},
    error::{OraResult, ErrorCode},
  },
  std::cell::RefMut,
  std::ops::{Deref, DerefMut},
  enumflags2::BitFlags,
  core::mem::size_of
};

use saber::SaberStrategy;

pub const ANCHOR_DISCRIIMINATOR_OFFSET: usize = 8;

pub trait StrategyActions {
  fn invest(&self, ctx: Context<Invest>, slippage_tolerance: u16) -> ProgramResult;
  fn redeem(&self, ctx: Context<Redeem>, slippage_tolerance: u16) -> ProgramResult;

  // other shared actions, like compound
}

#[derive(Copy, Clone, BitFlags, Debug, Eq, PartialEq)]
#[repr(u64)]
pub enum StrategyFlag {
    SaberStrategyV0 = 1u64 << 0,
}

pub enum Strategy<'a> {
  SaberLpV0(RefMut<'a, saber::SaberStrategy>),
}

impl<'a> Deref for Strategy<'a> {
  type Target = saber::SaberStrategy;

  fn deref(&self) -> &Self::Target {
    match self {
      Strategy::SaberLpV0(saber_lp_v0) => saber_lp_v0.deref(),
    }
  }
}

impl<'a> DerefMut for Strategy<'a> {
  fn deref_mut(&mut self) -> &mut Self::Target {
    match self {
      Strategy::SaberLpV0(saber_lp_v0) => saber_lp_v0.deref_mut(),
    }
  }
}

impl<'a> Strategy<'a> {
  pub fn load(
    strategy: &'a AccountInfo,
    program_id: &Pubkey,
  ) -> OraResult<Self> {
    let flags = Strategy::strategy_flags(&strategy.try_borrow_data()?)?;
    msg!("flag: {:?}", flags);

    // todo: use flags to determine which strategy to use
    Ok(Strategy::SaberLpV0(SaberStrategy::load(
      strategy,
      program_id,
    )?))
  }

  pub fn strategy_flags(account_data: &[u8]) -> OraResult<BitFlags<StrategyFlag>> {
    let start = ANCHOR_DISCRIIMINATOR_OFFSET;
    let end = start + size_of::<StrategyFlag>();
    require!(account_data.len() >= end, ErrorCode::InvalidAccountData);

    let mut flag_bytes = [0u8; 8];
    flag_bytes.copy_from_slice(&account_data[start..end]);

    BitFlags::from_bits(u64::from_le_bytes(flag_bytes))
      .map_err(|_| ErrorCode::InvalidStrategyFlag.into())
      .map(Into::into)
  }
}
