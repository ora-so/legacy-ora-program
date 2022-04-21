use {
  anchor_lang::prelude::*,
  crate::{
    error::ErrorCode,
    state::{vault::Vault, strategy::StrategyActions},
  },
  bytemuck::{cast_slice_mut, from_bytes_mut, try_cast_slice_mut, Pod, Zeroable},
  std::cell::RefMut,
};

#[account]
#[derive(Default, Copy)]
pub struct SaberStrategy {
  flags: u64, // helps decode strategy type
  vault: Pubkey,
  
  // add saber swap pool info
}

// dev: probably need to pass in some shared context so that we can pull balances off ATAs and what not
impl StrategyActions for SaberStrategy {
  fn invest(&self, vault: Account<Vault>) -> ProgramResult {
    require!(self.vault == vault.key(), ErrorCode::PublicKeyMismatch);
    msg!("investing token a = {}, token b = {}", vault.alpha.deposited, vault.beta.deposited);
    
    // todo: actually invest

    Ok(())
  }

  fn redeem(&self, vault: Account<Vault>) -> ProgramResult {
    require!(self.vault == vault.key(), ErrorCode::PublicKeyMismatch);
    msg!("redeeming token a = {}, token b = {}", vault.alpha.invested, vault.beta.invested);

    // todo: actually redeem

    Ok(())
  }

  // other trait function implementations here
}

impl SaberStrategy {
  pub fn init(
   &mut self,
   flags: u64, // helps decode strategy type
   vault: Pubkey,
  ) {
   self.flags = flags;
   self.vault = vault;
  }

  #[inline]
  pub fn load<'a>(
    strategy: &'a AccountInfo,
    program_id: &Pubkey,
  ) -> Result<RefMut<'a, SaberStrategy>, ProgramError> {
    require!(strategy.owner == program_id, ErrorCode::WrongAccountOwner);

    let account_data: RefMut<'a, [u8]>;
    account_data = RefMut::map(strategy.try_borrow_mut_data().unwrap(), |data| *data);

    let state: RefMut<'a, Self>;
    state = RefMut::map(account_data, |data| {
      from_bytes_mut(cast_slice_mut::<u8, u8>(try_cast_slice_mut(data).unwrap()))
    });

    Ok(state)
  }
}

#[cfg(target_endian = "little")]
unsafe impl Zeroable for SaberStrategy {}

#[cfg(target_endian = "little")]
unsafe impl Pod for SaberStrategy {}
