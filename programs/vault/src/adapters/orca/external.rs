use {
    anchor_lang::prelude::*,
    anchor_spl::token::Token,
    borsh::{BorshDeserialize, BorshSerialize},
    solana_program::{
        instruction::Instruction, program::invoke_signed, system_program::ID as SYSTEM_PROGRAM_ID,
    },
};

#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug, Clone)]
pub struct OrcaSwapTokenInstructionData {
    pub instruction: u8,
    pub amount_in: u64,
    pub minimum_amount_out: u64,
}

pub fn create_swap_token_instruction(
    program_id: Pubkey,
    orca_pool: Pubkey,
    orca_authority: Pubkey,
    user_transfer_authority: Pubkey,
    user_source: Pubkey,
    pool_source: Pubkey,
    pool_destination: Pubkey,
    user_destination: Pubkey,
    pool_mint: Pubkey,
    fee_account: Pubkey,
    amount_in: u64,
    minimum_amount_out: u64,
) -> Instruction {
    Instruction {
        program_id,
        accounts: vec![
            AccountMeta::new_readonly(orca_pool, false),
            AccountMeta::new_readonly(orca_authority, false),
            AccountMeta::new_readonly(user_transfer_authority, true),
            AccountMeta::new(user_source, false),
            AccountMeta::new(pool_source, false),
            AccountMeta::new(pool_destination, false),
            AccountMeta::new(user_destination, false),
            AccountMeta::new(pool_mint, false),
            AccountMeta::new(fee_account, false),
            AccountMeta::new_readonly(spl_token::id(), false),
        ],
        data: OrcaSwapTokenInstructionData {
            // https://github.com/solana-labs/solana-program-library/blob/fe20132b07708226f0a6377d62b4fc8f0e5d5420/token-swap/js/src/index.ts#L495
            instruction: 1,
            amount_in,
            minimum_amount_out,
        }
        .try_to_vec()
        .unwrap(),
    }
}

#[derive(Accounts)]
pub struct SwapToken<'info> {
    /// CHECK: verified via orca CPI call
    pub orca_swap_program: AccountInfo<'info>,
    /// CHECK: verified via orca CPI call
    pub orca_pool: AccountInfo<'info>,
    /// CHECK: verified via orca CPI call
    pub orca_authority: AccountInfo<'info>,
    /// CHECK: verified via orca CPI call
    pub user_transfer_authority: AccountInfo<'info>,
    /// CHECK: verified via orca CPI call
    pub user_source: AccountInfo<'info>,
    /// CHECK: verified via orca CPI call
    pub pool_source: AccountInfo<'info>,
    /// CHECK: verified via orca CPI call
    pub pool_destination: AccountInfo<'info>,
    /// CHECK: verified via orca CPI call
    pub user_destination: AccountInfo<'info>,
    /// CHECK: verified via orca CPI call
    pub pool_mint: AccountInfo<'info>,
    /// CHECK: verified via orca CPI call
    pub fee_account: AccountInfo<'info>,
    /// CHECK: verified via orca CPI call
    pub token_program: AccountInfo<'info>,
}

pub fn swap<'a>(
    ctx: SwapToken<'a>,
    amount_in: u64,
    minimum_amount_out: u64,
    signer_seeds: &[&[&[u8]]],
) -> ProgramResult {
    invoke_signed(
        &create_swap_token_instruction(
            *ctx.orca_swap_program.key,
            *ctx.orca_pool.key,
            *ctx.orca_authority.key,
            *ctx.user_transfer_authority.key,
            *ctx.user_source.key,
            *ctx.pool_source.key,
            *ctx.pool_destination.key,
            *ctx.user_destination.key,
            *ctx.pool_mint.key,
            *ctx.fee_account.key,
            amount_in,
            minimum_amount_out,
        ),
        &[
            ctx.orca_pool.to_account_info(),
            ctx.orca_authority.to_account_info(),
            ctx.user_transfer_authority.to_account_info(),
            ctx.user_source.to_account_info(),
            ctx.pool_source.to_account_info(),
            ctx.pool_destination.to_account_info(),
            ctx.user_destination.to_account_info(),
            ctx.pool_mint.to_account_info(),
            ctx.fee_account.to_account_info(),
            ctx.token_program.to_account_info(),
        ],
        signer_seeds,
    )?;

    Ok(())
}

#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug, Clone)]
pub struct OrcaDepositInstructionData {
    pub instruction: u8,
    pub pool_token_amount: u64,
    pub maximum_token_a: u64,
    pub maximum_token_b: u64,
}

#[allow(clippy::too_many_arguments)]
pub fn create_deposit_instruction(
    program_id: Pubkey,
    orca_pool: Pubkey,
    orca_authority: Pubkey,
    user_transfer_authority: Pubkey,
    source_a: Pubkey,
    source_b: Pubkey,
    into_a: Pubkey,
    into_b: Pubkey,
    pool_token: Pubkey,
    pool_account: Pubkey,
    pool_token_amount: u64,
    maximum_token_a: u64,
    maximum_token_b: u64,
) -> Instruction {
    Instruction {
        program_id,
        // https://github.com/solana-labs/solana-program-library/blob/fe20132b07708226f0a6377d62b4fc8f0e5d5420/token-swap/js/src/index.ts#L628-L639
        accounts: vec![
            AccountMeta::new_readonly(orca_pool, false),
            AccountMeta::new_readonly(orca_authority, false),
            AccountMeta::new_readonly(user_transfer_authority, true),
            // only signer because token account created?
            AccountMeta::new(source_a, false),
            AccountMeta::new(source_b, false),
            AccountMeta::new(into_a, false),
            AccountMeta::new(into_b, false),
            AccountMeta::new(pool_token, false),
            AccountMeta::new(pool_account, false),
            AccountMeta::new_readonly(spl_token::id(), false),
        ],
        data: OrcaDepositInstructionData {
            // https://github.com/solana-labs/solana-program-library/blob/fe20132b07708226f0a6377d62b4fc8f0e5d5420/token-swap/js/src/index.ts#L620
            instruction: 2,
            pool_token_amount,
            maximum_token_a,
            maximum_token_b,
        }
        .try_to_vec()
        .unwrap(),
    }
}

#[derive(Accounts)]
pub struct CreatePoolDeposit<'info> {
    /// CHECK: verified via orca CPI call
    pub orca_swap_program: AccountInfo<'info>,
    /// CHECK: verified via orca CPI call
    pub orca_pool: AccountInfo<'info>,
    /// CHECK: verified via orca CPI call
    pub orca_authority: AccountInfo<'info>,
    /// CHECK: verified via orca CPI call
    pub user_transfer_authority: AccountInfo<'info>,
    /// CHECK: verified via orca CPI call
    pub source_a: AccountInfo<'info>,
    /// CHECK: verified via orca CPI call
    pub source_b: AccountInfo<'info>,
    /// CHECK: verified via orca CPI call
    pub into_a: AccountInfo<'info>,
    /// CHECK: verified via orca CPI call
    pub into_b: AccountInfo<'info>,
    /// CHECK: verified via orca CPI call
    pub pool_token: AccountInfo<'info>,
    /// CHECK: verified via orca CPI call
    pub pool_account: AccountInfo<'info>,
    /// CHECK: verified via orca CPI call
    pub token_program: AccountInfo<'info>,
}

pub fn deposit<'a>(
    ctx: CreatePoolDeposit<'a>,
    pool_token_amount: u64,
    maximum_token_a: u64,
    maximum_token_b: u64,
    signer_seeds: &[&[&[u8]]],
) -> ProgramResult {
    invoke_signed(
        &create_deposit_instruction(
            *ctx.orca_swap_program.key,
            *ctx.orca_pool.key,
            *ctx.orca_authority.key,
            *ctx.user_transfer_authority.key,
            *ctx.source_a.key,
            *ctx.source_b.key,
            *ctx.into_a.key,
            *ctx.into_b.key,
            *ctx.pool_token.key,
            *ctx.pool_account.key,
            pool_token_amount,
            maximum_token_a,
            maximum_token_b,
        ),
        &[
            // orca_swap_program?
            ctx.orca_pool.to_account_info(),
            ctx.orca_authority.to_account_info(),
            ctx.user_transfer_authority.to_account_info(),
            ctx.source_a.to_account_info(),
            ctx.source_b.to_account_info(),
            ctx.into_a.to_account_info(),
            ctx.into_b.to_account_info(),
            ctx.pool_token.to_account_info(),
            ctx.pool_account.to_account_info(),
            ctx.token_program.to_account_info(),
        ],
        signer_seeds,
    )?;

    Ok(())
}

#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug, Clone)]
pub struct OrcaWithdrawInstructionData {
    pub instruction: u8,
    pub pool_token_amount: u64,
    pub maximum_token_a: u64,
    pub maximum_token_b: u64,
}

#[allow(clippy::too_many_arguments)]
pub fn create_withdraw_instruction(
    program_id: Pubkey,
    orca_pool: Pubkey,
    orca_authority: Pubkey,
    user_transfer_authority: Pubkey,
    pool_mint: Pubkey,
    source_pool_account: Pubkey,
    from_a: Pubkey,
    from_b: Pubkey,
    user_account_a: Pubkey,
    user_account_b: Pubkey,
    fee_account: Pubkey,
    pool_token_amount: u64,
    maximum_token_a: u64,
    maximum_token_b: u64,
) -> Instruction {
    Instruction {
        program_id,
        // https://github.com/solana-labs/solana-program-library/blob/fe20132b07708226f0a6377d62b4fc8f0e5d5420/token-swap/js/src/index.ts#L729-L741
        accounts: vec![
            AccountMeta::new_readonly(orca_pool, false),
            AccountMeta::new_readonly(orca_authority, false),
            AccountMeta::new_readonly(user_transfer_authority, true),
            AccountMeta::new(pool_mint, false),
            AccountMeta::new(source_pool_account, false),
            AccountMeta::new(from_a, false),
            AccountMeta::new(from_b, false),
            AccountMeta::new(user_account_a, false),
            AccountMeta::new(user_account_b, false),
            AccountMeta::new(fee_account, false),
            AccountMeta::new_readonly(spl_token::id(), false),
        ],
        data: OrcaWithdrawInstructionData {
            // https://github.com/solana-labs/solana-program-library/blob/fe20132b07708226f0a6377d62b4fc8f0e5d5420/token-swap/js/src/index.ts#L721
            instruction: 3,
            pool_token_amount,
            maximum_token_a,
            maximum_token_b,
        }
        .try_to_vec()
        .unwrap(),
    }
}

#[derive(Accounts)]
pub struct CreatePoolWithdrawal<'info> {
    /// CHECK: verified via orca CPI call
    pub orca_swap_program: AccountInfo<'info>,
    /// CHECK: verified via orca CPI call
    pub orca_pool: AccountInfo<'info>,
    /// CHECK: verified via orca CPI call
    pub orca_authority: AccountInfo<'info>,
    /// CHECK: verified via orca CPI call
    pub user_transfer_authority: AccountInfo<'info>,
    /// CHECK: verified via orca CPI call
    pub pool_mint: AccountInfo<'info>,
    /// CHECK: verified via orca CPI call
    pub source_pool_account: AccountInfo<'info>,
    /// CHECK: verified via orca CPI call
    pub from_a: AccountInfo<'info>,
    /// CHECK: verified via orca CPI call
    pub from_b: AccountInfo<'info>,
    /// CHECK: verified via orca CPI call
    pub user_account_a: AccountInfo<'info>,
    /// CHECK: verified via orca CPI call
    pub user_account_b: AccountInfo<'info>,
    /// CHECK: verified via orca CPI call
    pub fee_account: AccountInfo<'info>,
    /// CHECK: verified via orca CPI call
    pub token_program: AccountInfo<'info>,
}

pub fn withdraw<'a>(
    ctx: CreatePoolWithdrawal<'a>,
    pool_token_amount: u64,
    maximum_token_a: u64,
    maximum_token_b: u64,
    signer_seeds: &[&[&[u8]]],
) -> ProgramResult {
    invoke_signed(
        &create_withdraw_instruction(
            *ctx.orca_swap_program.key,
            *ctx.orca_pool.key,
            *ctx.orca_authority.key,
            *ctx.user_transfer_authority.key,
            *ctx.pool_mint.key,
            *ctx.source_pool_account.key,
            *ctx.from_a.key,
            *ctx.from_b.key,
            *ctx.user_account_a.key,
            *ctx.user_account_b.key,
            *ctx.fee_account.key,
            pool_token_amount,
            maximum_token_a,
            maximum_token_b,
        ),
        &[
            // orca_swap_program?
            ctx.orca_pool.to_account_info(),
            ctx.orca_authority.to_account_info(),
            ctx.user_transfer_authority.to_account_info(),
            ctx.pool_mint.to_account_info(),
            ctx.source_pool_account.to_account_info(),
            ctx.from_a.to_account_info(),
            ctx.from_b.to_account_info(),
            ctx.user_account_a.to_account_info(),
            ctx.user_account_b.to_account_info(),
            ctx.fee_account.to_account_info(),
            ctx.token_program.to_account_info(),
        ],
        signer_seeds, // todo: does this work?
    )?;

    Ok(())
}

#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug, Clone)]
pub struct OrcaInitUserFarmInstructionData {
    pub instruction: u8,
}

#[allow(clippy::too_many_arguments)]
pub fn init_user_farm_instruction(
    program_id: Pubkey,
    global_farm_state: Pubkey,
    user_farm_state: Pubkey,
    owner: Pubkey,
) -> Instruction {
    Instruction {
        program_id,
        // https://github.com/orca-so/aquafarm-sdk/blob/main/src/instructions.ts#L302-L343
        accounts: vec![
            AccountMeta::new(global_farm_state, false),
            AccountMeta::new(user_farm_state, false),
            AccountMeta::new(owner, true),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
        ],
        data: OrcaInitUserFarmInstructionData {
            // https://github.com/orca-so/aquafarm-sdk/blob/main/src/instructions.ts#L18
            instruction: 1,
        }
        .try_to_vec()
        .unwrap(),
    }
}

#[derive(Accounts)]
pub struct InitUserFarm<'info> {
    /// CHECK: verified via orca CPI call
    pub aquafarm_program: AccountInfo<'info>,
    /// CHECK: verified via orca CPI call
    pub global_farm_state: AccountInfo<'info>,
    /// CHECK: verified via orca CPI call
    pub user_farm_state: AccountInfo<'info>,
    /// CHECK: verified via orca CPI call
    pub owner: AccountInfo<'info>,
    /// CHECK: verified via orca CPI call
    pub system_program: AccountInfo<'info>,
}

pub fn init_user_farm<'a>(ctx: InitUserFarm<'a>, signer_seeds: &[&[&[u8]]]) -> ProgramResult {
    invoke_signed(
        &init_user_farm_instruction(
            *ctx.aquafarm_program.key,
            *ctx.global_farm_state.key,
            *ctx.user_farm_state.key,
            *ctx.owner.key,
        ),
        &[
            ctx.global_farm_state.to_account_info(),
            ctx.user_farm_state.to_account_info(),
            ctx.owner.to_account_info(),
            ctx.system_program.to_account_info(),
        ],
        signer_seeds,
    )?;

    Ok(())
}

#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug, Clone)]
pub struct OrcaConvertTokenInstructionData {
    pub instruction: u8,
    pub amount_to_convert: u64,
}

// Convert base tokens to farm tokens
pub fn create_convert_token_instruction(
    program_id: Pubkey, // aquafarmProgramId
    user_farm_owner: Pubkey,
    user_base_ata: Pubkey,
    global_base_token_vault: Pubkey,
    user_transfer_authority: Pubkey,
    farm_token_mint: Pubkey,
    user_farm_ata: Pubkey,
    global_farm: Pubkey,
    user_farm: Pubkey,
    global_reward_token_vault: Pubkey,
    user_reward_ata: Pubkey,
    authority: Pubkey,
    amount_to_convert: u64,
) -> Instruction {
    Instruction {
        program_id,
        // https://github.com/orca-so/aquafarm-sdk/blob/main/src/instructions.ts#L122-L184
        accounts: vec![
            AccountMeta::new_readonly(user_farm_owner, true),
            AccountMeta::new(user_base_ata, false),
            AccountMeta::new(global_base_token_vault, false),
            AccountMeta::new_readonly(user_transfer_authority, true),
            AccountMeta::new(farm_token_mint, false),
            AccountMeta::new(user_farm_ata, false),
            AccountMeta::new(global_farm, false),
            AccountMeta::new(user_farm, false),
            AccountMeta::new(global_reward_token_vault, false),
            AccountMeta::new(user_reward_ata, false),
            AccountMeta::new_readonly(authority, false),
            AccountMeta::new_readonly(spl_token::id(), false),
        ],
        data: OrcaConvertTokenInstructionData {
            // https://github.com/orca-so/aquafarm-sdk/blob/main/src/instructions.ts#L192
            instruction: 2,
            amount_to_convert,
        }
        .try_to_vec()
        .unwrap(),
    }
}

#[derive(Accounts)]
pub struct ConvertBaseTokens<'info> {
    /// CHECK: verified via orca CPI call
    pub aquafarm_program: AccountInfo<'info>,
    /// CHECK: verified via orca CPI call
    pub user_farm_owner: AccountInfo<'info>,
    /// CHECK: verified via orca CPI call
    pub user_base_ata: AccountInfo<'info>,
    /// CHECK: verified via orca CPI call
    pub global_base_token_vault: AccountInfo<'info>,
    /// CHECK: verified via orca CPI call
    pub user_transfer_authority: AccountInfo<'info>,
    /// CHECK: verified via orca CPI call
    pub farm_token_mint: AccountInfo<'info>,
    /// CHECK: verified via orca CPI call
    pub user_farm_ata: AccountInfo<'info>,
    /// CHECK: verified via orca CPI call
    pub global_farm: AccountInfo<'info>,
    /// CHECK: verified via orca CPI call
    pub user_farm: AccountInfo<'info>,
    /// CHECK: verified via orca CPI call
    pub global_reward_token_vault: AccountInfo<'info>,
    /// CHECK: verified via orca CPI call
    pub user_reward_ata: AccountInfo<'info>,
    /// CHECK: verified via orca CPI call
    pub authority: AccountInfo<'info>,
    /// CHECK: verified via orca CPI call
    pub token_program: AccountInfo<'info>,
}

pub fn convert<'a>(
    ctx: ConvertBaseTokens<'a>,
    amount_to_convert: u64,
    signer_seeds: &[&[&[u8]]],
) -> ProgramResult {
    invoke_signed(
        &create_convert_token_instruction(
            *ctx.aquafarm_program.key,
            *ctx.user_farm_owner.key,
            *ctx.user_base_ata.key,
            *ctx.global_base_token_vault.key,
            *ctx.user_transfer_authority.key,
            *ctx.farm_token_mint.key,
            *ctx.user_farm_ata.key,
            *ctx.global_farm.key,
            *ctx.user_farm.key,
            *ctx.global_reward_token_vault.key,
            *ctx.user_reward_ata.key,
            *ctx.authority.key,
            amount_to_convert,
        ),
        &[
            ctx.user_farm_owner.to_account_info(),
            ctx.user_base_ata.to_account_info(),
            ctx.global_base_token_vault.to_account_info(),
            ctx.user_transfer_authority.to_account_info(),
            ctx.farm_token_mint.to_account_info(),
            ctx.user_farm_ata.to_account_info(),
            ctx.global_farm.to_account_info(),
            ctx.user_farm.to_account_info(),
            ctx.global_reward_token_vault.to_account_info(),
            ctx.user_reward_ata.to_account_info(),
            ctx.authority.to_account_info(),
            ctx.token_program.to_account_info(),
        ],
        signer_seeds,
    )?;

    Ok(())
}

#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug, Clone)]
pub struct OrcaRevertTokenInstructionData {
    pub instruction: u8,
    pub amount_to_revert: u64,
}

// Revert farm tokens to base tokens
pub fn create_revert_token_instruction(
    program_id: Pubkey, // aquafarmProgramId
    user_farm_owner: Pubkey,
    user_base_ata: Pubkey,
    global_base_token_vault: Pubkey,
    farm_token_mint: Pubkey,
    user_farm_ata: Pubkey,
    user_burn_authority: Pubkey,
    global_farm: Pubkey,
    user_farm: Pubkey,
    global_reward_token_vault: Pubkey,
    user_reward_ata: Pubkey,
    authority: Pubkey,
    amount_to_revert: u64,
) -> Instruction {
    Instruction {
        program_id,
        // https://github.com/orca-so/aquafarm-sdk/blob/9ed9db0f04cf7406f1f6e9a3e316639f3d24e68c/src/instructions.ts#L214-L276
        accounts: vec![
            AccountMeta::new_readonly(user_farm_owner, true), // todo: writeable or nah?
            AccountMeta::new(user_base_ata, false),
            AccountMeta::new(global_base_token_vault, false),
            AccountMeta::new(farm_token_mint, false),
            AccountMeta::new(user_farm_ata, false),
            AccountMeta::new_readonly(user_burn_authority, true),
            AccountMeta::new(global_farm, false),
            AccountMeta::new(user_farm, false),
            AccountMeta::new(global_reward_token_vault, false),
            AccountMeta::new(user_reward_ata, false),
            AccountMeta::new_readonly(authority, false),
            AccountMeta::new_readonly(spl_token::id(), false),
        ],
        data: OrcaRevertTokenInstructionData {
            // https://github.com/orca-so/aquafarm-sdk/blob/9ed9db0f04cf7406f1f6e9a3e316639f3d24e68c/src/instructions.ts#L20
            instruction: 3,
            amount_to_revert,
        }
        .try_to_vec()
        .unwrap(),
    }
}

#[derive(Accounts)]
pub struct RevertBaseToken<'info> {
    /// CHECK: verified via orca CPI call
    pub aquafarm_program: AccountInfo<'info>,
    /// CHECK: verified via orca CPI call
    pub user_farm_owner: AccountInfo<'info>,
    /// CHECK: verified via orca CPI call
    pub user_base_ata: AccountInfo<'info>,
    /// CHECK: verified via orca CPI call
    pub global_base_token_vault: AccountInfo<'info>,
    /// CHECK: verified via orca CPI call
    pub farm_token_mint: AccountInfo<'info>,
    /// CHECK: verified via orca CPI call
    pub user_farm_ata: AccountInfo<'info>,
    /// CHECK: verified via orca CPI call
    pub user_burn_authority: AccountInfo<'info>,
    /// CHECK: verified via orca CPI call
    pub global_farm: AccountInfo<'info>,
    /// CHECK: verified via orca CPI call
    pub user_farm: AccountInfo<'info>,
    /// CHECK: verified via orca CPI call
    pub global_reward_token_vault: AccountInfo<'info>,
    /// CHECK: verified via orca CPI call
    pub user_reward_ata: AccountInfo<'info>,
    /// CHECK: verified via orca CPI call
    pub authority: AccountInfo<'info>,
    /// CHECK: verified via orca CPI call
    pub token_program: AccountInfo<'info>,
}

pub fn revert<'a>(
    ctx: RevertBaseToken<'a>,
    amount_to_convert: u64,
    signer_seeds: &[&[&[u8]]],
) -> ProgramResult {
    invoke_signed(
        &create_revert_token_instruction(
            *ctx.aquafarm_program.key,
            *ctx.user_farm_owner.key,
            *ctx.user_base_ata.key,
            *ctx.global_base_token_vault.key,
            *ctx.farm_token_mint.key,
            *ctx.user_farm_ata.key,
            *ctx.user_burn_authority.key,
            *ctx.global_farm.key,
            *ctx.user_farm.key,
            *ctx.global_reward_token_vault.key,
            *ctx.user_reward_ata.key,
            *ctx.authority.key,
            amount_to_convert,
        ),
        &[
            ctx.user_farm_owner.to_account_info(),
            ctx.user_base_ata.to_account_info(),
            ctx.global_base_token_vault.to_account_info(),
            ctx.farm_token_mint.to_account_info(),
            ctx.user_farm_ata.to_account_info(),
            ctx.user_burn_authority.to_account_info(),
            ctx.global_farm.to_account_info(),
            ctx.user_farm.to_account_info(),
            ctx.global_reward_token_vault.to_account_info(),
            ctx.user_reward_ata.to_account_info(),
            ctx.authority.to_account_info(),
            ctx.token_program.to_account_info(),
        ],
        signer_seeds,
    )?;

    Ok(())
}

#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug, Clone)]
pub struct OrcaHarvestInstructionData {
    pub instruction: u8,
}

// what each account means; https://github.com/orca-so/typescript-sdk/blob/e04a5c4742500e1b9988207226d58184617ed45c/src/model/orca/farm/orca-farm.ts#L255

#[allow(clippy::too_many_arguments)]
pub fn create_harvest_instruction(
    program_id: Pubkey,
    user_farm_owner: Pubkey,
    global_farm: Pubkey,
    user_farm: Pubkey,
    global_base_token_vault: Pubkey,
    global_reward_token_vault: Pubkey,
    user_reward_token_account: Pubkey,
    authority: Pubkey,
) -> Instruction {
    Instruction {
        program_id,
        // https://github.com/orca-so/aquafarm-sdk/blob/main/src/instructions.ts#L302-L343
        accounts: vec![
            // writable? diff b/w sdk and tx
            // sdk: https://github.com/orca-so/aquafarm-sdk/blob/main/src/instructions.ts#L303-L307
            // tx: https://solscan.io/tx/4NrtD6jAjH7mmEXeYAPfS5Fs1ruEBY8TgcQjhAi7tvVbiirWSv93NJ49Jub6iagnd2mWhz2kzUhsh1uyvoBEXU32
            AccountMeta::new(user_farm_owner, true),
            AccountMeta::new(global_farm, false),
            AccountMeta::new(user_farm, false),
            AccountMeta::new_readonly(global_base_token_vault, false),
            AccountMeta::new(global_reward_token_vault, false),
            AccountMeta::new(user_reward_token_account, false),
            AccountMeta::new_readonly(authority, false),
            AccountMeta::new_readonly(spl_token::id(), false),
        ],
        data: OrcaHarvestInstructionData {
            // https://github.com/orca-so/aquafarm-sdk/blob/main/src/instructions.ts#L21
            instruction: 4,
        }
        .try_to_vec()
        .unwrap(),
    }
}

#[derive(Accounts)]
pub struct AquafarmHarvest<'info> {
    /// CHECK: verified via orca CPI call
    pub aquafarm_program: AccountInfo<'info>,
    /// CHECK: verified via orca CPI call
    pub user_farm_owner: AccountInfo<'info>,
    /// CHECK: verified via orca CPI call
    pub global_farm: AccountInfo<'info>,
    /// CHECK: verified via orca CPI call
    pub user_farm: AccountInfo<'info>,
    /// CHECK: verified via orca CPI call
    pub global_base_token_vault: AccountInfo<'info>,
    /// CHECK: verified via orca CPI call
    pub global_reward_token_vault: AccountInfo<'info>,
    /// CHECK: verified via orca CPI call
    pub user_reward_token_account: AccountInfo<'info>,
    /// CHECK: verified via orca CPI call
    pub authority: AccountInfo<'info>,
    /// CHECK: verified via orca CPI call
    pub token_program: AccountInfo<'info>,
}

pub fn harvest<'a>(ctx: AquafarmHarvest<'a>, signer_seeds: &[&[&[u8]]]) -> ProgramResult {
    invoke_signed(
        &create_harvest_instruction(
            *ctx.aquafarm_program.key,
            *ctx.user_farm_owner.key,
            *ctx.global_farm.key,
            *ctx.user_farm.key,
            *ctx.global_base_token_vault.key,
            *ctx.global_reward_token_vault.key,
            *ctx.user_reward_token_account.key,
            *ctx.authority.key,
        ),
        &[
            ctx.user_farm_owner.to_account_info(),
            ctx.global_farm.to_account_info(),
            ctx.user_farm.to_account_info(),
            ctx.global_base_token_vault.to_account_info(),
            ctx.global_reward_token_vault.to_account_info(),
            ctx.user_reward_token_account.to_account_info(),
            ctx.authority.to_account_info(),
            ctx.token_program.to_account_info(),
        ],
        signer_seeds,
    )?;

    Ok(())
}
