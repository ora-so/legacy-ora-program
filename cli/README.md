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

The keypair here is related to the token's mint authority. You also must account for decimals in the amount parameter. For example, sending amount = 100 of a token with 6 decimals means that you'll actually be sending `100 / 10^6 = 0.0001`. If you want to send 1 token, you need to specify `1x10^6`.

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

### Todo

Add commands for other operations, like deposit, invest, process_claims, claim, withdraw, etc.
