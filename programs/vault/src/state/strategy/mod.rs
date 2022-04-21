pub mod saber;

use {
  anchor_lang::prelude::*,
  crate::{
    error::{OraResult, ErrorCode},
    state::{vault::Vault},
  },
  std::cell::RefMut,
  enumflags2::BitFlags,
  core::mem::size_of
};

use saber::SaberStrategy;

pub const ANCHOR_DISCRIIMINATOR_OFFSET: usize = 8;

pub trait StrategyActions {
  fn invest(&self, vault: Account<Vault>) -> ProgramResult;
  fn redeem(&self, vault: Account<Vault>) -> ProgramResult;

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
