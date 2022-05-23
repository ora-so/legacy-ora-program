use anchor_lang::prelude::Pubkey;
use solana_program::pubkey;

/// PDA seed strings
pub const GLOBAL_STATE_SEED: &str = "globalstate";
pub const VAULT_SEED: &str = "vault";
pub const FARM_VAULT_SEED: &str = "farmvault";
pub const STRATEGY_SEED: &str = "strategy";
pub const RECEIPT_SEED: &str = "receipt";
pub const HISTORY_SEED: &str = "history";

pub const ORCA_FARM_PROGRAM: &str = "82yxjeMsvaURa4MbZZ7WZZHfobirZYkH1zF8fmeGtyaQ";

#[cfg(feature = "mainnet-beta")]
pub const ORCA_SWAP_PROGRAM: &str = "9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP";
#[cfg(not(feature = "mainnet-beta"))] // but, only devnet afaik
pub const ORCA_SWAP_PROGRAM: &str = "3xQ8SWv2GaFXXpHZNqkXsdxq5DZciHBz6ZFoPPfbFd7U";

pub const SOL_PUBKEY: Pubkey = pubkey!("So11111111111111111111111111111111111111112");
pub const SOL_DECIMALS: u8 = 9;
pub const MAX_BIPS: usize = 10_000;
