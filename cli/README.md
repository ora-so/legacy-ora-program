## CLI Usage Examples

### Initializing a vault

Before initializing a vault, you need some more variables. Let's walk through the setup process for the following:

- authority
- two assets for the different sides of the vault
- the start at timestamp

When you're ready, the initialize vault command will look like

```
ts-node ./src/cli.ts init_vault --env <env> --keypair <path-to-keypair> --strategist <pubkey> --strategy <pubkey> --alpha <pubkey> --beta <pubkey> --fixedRate <number> --startAt <number> --depositPeriod <number> --livePeriod <number>
```

#### Vault authority

When calling the `init_vault` command, the vault authority will be set to the public key associated with the `--keypair` parameter. If you're not sure what public key that is, you can run `solana address -k <path-to-keypair>`.

This entity is also the payer for the transaction. So, you need to make sure it has some SOL. The `strategist` can be the same public key as the authority, if you so choose. However, you have to spefically associate the public key with this parameter.

#### Two assets for the vault

Each vault has 2 sides. We need to tell the vault which assets people are allowed to deposit. We use each asset's public key to discern if it's allowed.

On mainnet, you can just use the mint's public key. In non-mainnet environments, you might want to just mint your own tokens. In this case, we provide additional CLI commands to help you with this - `mint` and `mint_to`.

##### The `mint` command

You can optionally specify decimals. The default will be 6.

```
ts-node ./src/cli.ts mint --env <env> --keypair <path-to-keypair> --decimals <number>
```

##### The `mint_to` command

The keypair here is related to the token's mint authority. We take care of the decimal calculations for you. For example, if you say amount = 100 of a token with 6 decimals, we will compute the absolute number of tokens `100 * 10^6 = 1000000000`.

```
ts-node ./src/cli.ts mint_to --env <env> --keypair <path-to-keypair> --mint <pubkey> --to <pubkey> --amount <number>
```

#### Generating a start at timestamp

The start at timestamp will be in milliseconds. You can either generate the timestamp yourself, or you can use the `ts` CLI command. By default, this command will spit out the current timestamp. However, you can optionally specify an offset in seconds. The command with a 1 hour offset in seconds looks like

```
ts-node ./src/cli.ts ts --offset 3600
```

### Deriving a vault's public key

If you forget a vault's public key, you can derive it with the `derive_vault` command. This looks something like

```
ts-node ./src/cli.ts derive_vault --env <env> --keypair <path-to-keypair> --authority <pubkey>
```

### Inspect a vault's status

You can see all data associated with a vault via the `show_vault` command. This command will just dump the current state for the vault. If you don't know the vault's address, you can leave it out and instead provide `authority` - in this case, we will derive the address for you.

```
ts-node ./src/cli.ts show_vault --env <env> --keypair <path-to-keypair> --vault <pubkey>
```

### Deposit into a vault

Deposit some amount of a mint into a vault. You don't need to account for decimals, i.e. just set amount == 100 if you want to deposit 100 tokens. We'll adjust the amount based on the token's decimals. The command will look something like

```
ts-node ./src/cli.ts deposit --env <env> --keypair <path-to-keypair> --vault <pubkey> --mint <pubkey> --amount <number>
```

### Todo

Add commands for other operations, invest, process_claims, claim, withdraw, etc.

==================================================
GLOBAL PROTOCOL STATE FLOW
==================================================

--> using a pubkey from phantom ui
ts-node ./src/cli.ts init_global_protocol_state \
 --env devnet \
 --keypair /Users/jacobshiohira/.config/solana/devnet.json \
 --treasury 9LB3HEydFZuPnu9h2GnjfrErR7a3Hh2uQ8a2P7iLMtTE \
 --execute true

ts-node ./src/cli.ts derive_global_protocol_state \
 --env devnet \
 --keypair /Users/jacobshiohira/.config/solana/devnet.json

ts-node ./src/cli.ts show_global_protocol_state \
 --env devnet \
 --keypair /Users/jacobshiohira/.config/solana/devnet.json \
 --pubkey E1SaLmt31ycxSDGyEXAaer1F49qkHh4n8QF8z9zUQKfG

==================================================
VAULT FLOW
==================================================

<!-- authority & strategist same for now -->

ts-node ./src/cli.ts init_vault --env devnet \
 --keypair /Users/jacobshiohira/.config/solana/devnet.json \
 --strategist /Users/jacobshiohira/.config/solana/devnet.json \
 --strategy <pubkey> \
 --alpha <pubkey> \
 --beta <pubkey> \
 --fixedRate <number> \
 --startAt <number> \
 --depositPeriod <number> \
 --livePeriod <number> \
 --execute false

ts-node ./src/cli.ts show_vault --env devnet \
 --keypair <path-to-keypair> \
 --vault <pubkey>

ts-node ./src/cli.ts deposit --env devnet \
 --keypair <path-to-keypair> \
 --vault <pubkey> \
 --mint <pubkey> \
 --amount <number> \
 --execute false

ts-node ./src/cli.ts process_claims --env devnet \
 --keypair <path-to-keypair> \
 --vault <pubkey> \
 --execute false

ts-node ./src/cli.ts claim --env devnet \
 --keypair <path-to-keypair> \
 --vault <pubkey> \
 --mint <pubkey> \
 --execute false

ts-node ./src/cli.ts withdraw --env devnet \
 --keypair <path-to-keypair> \
 --vault <pubkey> \
 --mint <pubkey> \
 --trancheToken <pubkey> \
 --execute false

==================================================
ORCA FLOW
==================================================

<!-- devnet swap: 3xQ8SWv2GaFXXpHZNqkXsdxq5DZciHBz6ZFoPPfbFd7U -->
<!-- devnet farm: 82yxjeMsvaURa4MbZZ7WZZHfobirZYkH1zF8fmeGtyaQ -->

ts-node ./src/cli.ts find_orca_pools \
 --env devnet \
 --keypair /Users/jacobshiohira/.config/solana/devnet.json \
 --tickerA USDC \
 --tickerB SOL

ts-node ./src/cli.ts init_orca_strategy \
 --env devnet \
 --keypair /Users/jacobshiohira/.config/solana/devnet.json \
 --orcaSwapProgram 3xQ8SWv2GaFXXpHZNqkXsdxq5DZciHBz6ZFoPPfbFd7U \
 --orcaFarmProgram 82yxjeMsvaURa4MbZZ7WZZHfobirZYkH1zF8fmeGtyaQ \
 --pair ORCA_SOL \
 --execute true

ts-node ./src/cli.ts show_orca_strategy \
 --env devnet \
 --keypair /Users/jacobshiohira/.config/solana/devnet.json \
 --addr 6NKgFQQ24zMaC7yP1udds3iVdAGSjfVTpQSYcagiANM5

ts-node ./src/cli.ts initialize_user_farm --env devnet \
 --keypair /Users/jacobshiohira/.config/solana/devnet.json \
 --vault <pubkey> \
 --orcaFarmProgram 82yxjeMsvaURa4MbZZ7WZZHfobirZYkH1zF8fmeGtyaQ \
 --pair ORCA_SOL \
 --execute false

ts-node ./src/cli.ts invest_orca --env devnet \
 --keypair /Users/jacobshiohira/.config/solana/devnet.json \
 --vault <pubkey> \
 --orcaSwapProgram 3xQ8SWv2GaFXXpHZNqkXsdxq5DZciHBz6ZFoPPfbFd7U \
 --pair ORCA_SOL \
 --alpha <number> \
 --beta <number> \
 --execute false

ts-node ./src/cli.ts invest_orca --env devnet \
 --keypair /Users/jacobshiohira/.config/solana/devnet.json \
 --vault <pubkey> \
 --orcaSwapProgram 3xQ8SWv2GaFXXpHZNqkXsdxq5DZciHBz6ZFoPPfbFd7U \
 --pair ORCA_SOL \
 --alpha <number> \
 --beta <number> \
 --execute false

ts-node ./src/cli.ts convert_lp_tokens --env devnet \
 --keypair /Users/jacobshiohira/.config/solana/devnet.json \
 --vault <pubkey> \
 --orcaFarmProgram 82yxjeMsvaURa4MbZZ7WZZHfobirZYkH1zF8fmeGtyaQ \
 --farmType aquafarm \
 --pair ORCA_SOL \
 --execute false

ts-node ./src/cli.ts harvest --env devnet \
 --keypair /Users/jacobshiohira/.config/solana/devnet.json \
 --vault <pubkey> \
 --orcaFarmProgram 82yxjeMsvaURa4MbZZ7WZZHfobirZYkH1zF8fmeGtyaQ \
 --farmType aquafarm \
 --pair ORCA_SOL \
 --execute false

ts-node ./src/cli.ts revert_lp_tokens --env devnet \
 --keypair /Users/jacobshiohira/.config/solana/devnet.json \
 --vault <pubkey> \
 --orcaFarmProgram 82yxjeMsvaURa4MbZZ7WZZHfobirZYkH1zF8fmeGtyaQ \
 --farmType aquafarm \
 --pair ORCA_SOL \
 --execute false

==================================================
TOKEN HELPER FLOW
==================================================

ts-node ./src/cli.ts mint_to --env devnet \
 --keypair <path-to-keypair> \
 --mint <pubkey> \
 --to <pubkey> \
 --amount <number>

ts-node ./src/cli.ts mint --env <env> \
 --keypair <path-to-keypair> \
 --decimals <number>
