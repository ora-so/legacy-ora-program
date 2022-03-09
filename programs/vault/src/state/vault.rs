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

    // keep track of positions? could also pull from ATAs owned by this entity?
}

impl Vault {
    pub fn init(
        &mut self,
        bump: u8,
        authority: Pubkey,
    ) {
        self.bump = bump;
        self.authority = authority;
        self.deposit_nonce = 0;
        self.withdrawal_nonce = 0;
    }
}
