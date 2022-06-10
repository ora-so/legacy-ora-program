use anchor_lang::prelude::Pubkey;
use solana_program::pubkey;

/// PDA seed strings
pub const GLOBAL_STATE_SEED: &str = "globalstate";
pub const VAULT_SEED: &str = "vault";
pub const VAULT_STORE_SEED: &str = "vaultstore";
pub const STRATEGY_SEED: &str = "strategy";
pub const RECEIPT_SEED: &str = "receipt";
pub const HISTORY_SEED: &str = "history";

pub const SOL_PUBKEY: Pubkey = pubkey!("So11111111111111111111111111111111111111112");
pub const SOL_DECIMALS: u8 = 9;

// vault states
pub const INACTIVE_STATE: &str = "inactive";
pub const DEPOSIT_STATE: &str = "deposit";
pub const LIVE_STATE: &str = "live";
pub const REDEEM_STATE: &str = "redeem";
pub const REBALANCE_STATE: &str = "rebalance";
pub const WITHDRAW_STATE: &str = "withdraw";
