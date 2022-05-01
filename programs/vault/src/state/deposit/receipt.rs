use {crate::error::ErrorCode, anchor_lang::prelude::*};

/**
 * A receipt is created for a deposit such that we can keep track of who
 * made deposits and related vault state at that time. This information
 * is required for returning excess depossits when 1 side of the vault is
 * over-subscribed.
 *
 * PDA address is derived from the following seeds:
 *  - "receipt"
 *  - vault pubkey
 *  - asset pubkey
 *  - deposit idx
 *
 * @dev vault and asset pubkeys are not struct attributes because they are
 * encoded via the PDA seeds.
 */
#[account]
#[derive(Debug, Default, PartialEq)]
pub struct Receipt {
    /// bump
    pub bump: u8,
    /// attribute explicitly saying whether or not an account has been initialized
    pub intialized: bool,
    /// marginal amount deposited into the vault
    pub amount: u64,
    /// cumulative amount deposited into the vault for a
    /// given asset before this deposit
    pub cumulative: u64,
    /// entity that deposited into the vault
    pub depositor: Pubkey,
}

impl Receipt {
    /**
     * we should only init the account once. explicitly throw an error if someone tries to re-init an receipt PDA account that
     * has already be created. this is needed because of the `init_if_needed` feature in Anchor. we should not recreate an account
     * that represents a deposit by someone else.
     *
     * todo: explicitly test this
     */
    pub fn init(
        &mut self,
        bump: u8,
        amount: u64,
        cumulative: u64,
        depositor: &Pubkey,
    ) -> ProgramResult {
        require!(!self.intialized, ErrorCode::AccountAlreadyInitialized);

        self.bump = bump;
        self.intialized = true;
        self.amount = amount;
        self.cumulative = cumulative;
        self.depositor = *depositor;

        Ok(())
    }
}
