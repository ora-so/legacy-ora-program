use anchor_lang::prelude::*;

#[account]
#[derive(Debug, Default, PartialEq)]
pub struct Vault {
    /// bump
    pub bump: u8,
    /// entities authorized to perform certain actions
    pub authority: Pubkey,
    /// nonces to keep track of activity
    pub deposit_nonce: u64,
    pub withdrawal_nonce: u64,
    // (feat): keep track of positions? can also pull from ATAs owned by this entity?
}

impl Vault {
    pub fn init(&mut self, bump: u8, authority: Pubkey) {
        self.bump = bump;
        self.authority = authority;
        self.deposit_nonce = 0;
        self.withdrawal_nonce = 0;
    }

    pub fn increment_deposit_nonce(&mut self) {
        self.deposit_nonce = self.deposit_nonce + 1;
    }

    pub fn increment_withdrawal_nonce(&mut self) {
        self.withdrawal_nonce = self.withdrawal_nonce + 1;
    }
}

pub const VAULT_ACCOUNT_SPACE: usize =
    // discriminator
    8 +
    // bump
    1 +
    // authority
    32 +
    // deposit_nonce
    8 +
    // withdrawal_nonce
    8;
