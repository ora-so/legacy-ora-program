use crate::error::{ErrorCode, OraResult};
use anchor_lang::prelude::*;
use enumflags2::BitFlags;

#[derive(Copy, Clone, BitFlags, Debug, Eq, PartialEq)]
#[repr(u64)]
pub enum StrategyFlag {
    // leaves us room for 63 strategies; should we increase this to something like u128 or u256?
    SaberLpStrategyV0 = 1u64 << 0,
    OrcaLpStrategyV0 = 1u64 << 1,
}

impl StrategyFlag {
    pub fn strategy_flags_from_u64(flag: u64) -> OraResult<BitFlags<StrategyFlag>> {
        BitFlags::from_bits(flag)
            .map_err(|_| ErrorCode::InvalidStrategyFlag.into())
            .map(Into::into)
    }

    pub fn validate_flag(flag: u64) -> Result<(), ProgramError> {
        StrategyFlag::strategy_flags_from_u64(flag)?;

        Ok(())
    }
}
