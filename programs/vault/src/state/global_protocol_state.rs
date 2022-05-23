use anchor_lang::prelude::*;

#[account]
#[derive(Debug, Default, PartialEq)]
pub struct GlobalProtocolState {
    /// bump
    pub bump: u8,
    /// entity with authority to resume/pause the protocol. this is also the entity that can create new strategies.
    pub authority: Pubkey,
    /// protocol is active or not. vault related actions are paused if this value is false.
    pub active: bool,
    /// account to which protocol fees accrue
    pub treasury: Pubkey,
}

impl GlobalProtocolState {
    pub fn init(&mut self, bump: u8, authority: Pubkey, treasury: Pubkey) {
        self.bump = bump;
        self.authority = authority;
        self.treasury = treasury;
        self.active = true;
    }
}
