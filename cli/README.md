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
 --pubkey BA84mbakG8SCUvc6kZZZmsyb1JDPSycvFeTnFTPNDSzq

==================================================
VAULT FLOW
==================================================

<!-- authority & strategist same for now -->

ts-node ./src/cli.ts init_vault --env devnet \
 --keypair /Users/jacobshiohira/.config/solana/devnet.json \
 --strategist /Users/jacobshiohira/.config/solana/devnet.json \
 --strategy <pubkey> \
 --alpha <pubkey> \
 --userCapA <pubkey> \
 --beta <pubkey> \
 --userCapB <pubkey> \
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

ts-node ./src/cli.ts find_orca_pools \
 --env mainnet-beta \
 --keypair /Users/jacobshiohira/.config/solana/devnet.json \
 --tickerA USDC \
 --tickerB ZBC

<!-- gps: 3PbRNrNoSviVqwcYJaVCpkK5RwyrswDFsVC8X9gNQV68 -->
<!-- orca: G7yWxUweRM1Kz5AxZHspsz8mui4K3un9parQoTa7DkF1 -->

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
 --addr G7yWxUweRM1Kz5AxZHspsz8mui4K3un9parQoTa7DkF1

ts-node ./src/cli.ts initialize_user_farm --env devnet \
 --keypair /Users/jacobshiohira/.config/solana/devnet.json \
 --vault 9hM5Nht3z52hJbLpxZeXty7DkuDoHNnTtPxYKYZhxrNN \
 --orcaFarmProgram 82yxjeMsvaURa4MbZZ7WZZHfobirZYkH1zF8fmeGtyaQ \
 --farmType aquafarm \
 --pair ORCA_SOL \
 --execute true

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
 --vault 9hM5Nht3z52hJbLpxZeXty7DkuDoHNnTtPxYKYZhxrNN \
 --orcaFarmProgram 82yxjeMsvaURa4MbZZ7WZZHfobirZYkH1zF8fmeGtyaQ \
 --farmType aquafarm \
 --pair ORCA_SOL \
 --execute false

ts-node ./src/cli.ts harvest --env devnet \
 --keypair /Users/jacobshiohira/.config/solana/devnet.json \
 --vault 9hM5Nht3z52hJbLpxZeXty7DkuDoHNnTtPxYKYZhxrNN \
 --orcaFarmProgram 82yxjeMsvaURa4MbZZ7WZZHfobirZYkH1zF8fmeGtyaQ \
 --farmType aquafarm \
 --pair ORCA_SOL \
 --execute true

ts-node ./src/cli.ts revert_lp_tokens --env devnet \
 --keypair /Users/jacobshiohira/.config/solana/devnet.json \
 --vault 9hM5Nht3z52hJbLpxZeXty7DkuDoHNnTtPxYKYZhxrNN \
 --orcaFarmProgram 82yxjeMsvaURa4MbZZ7WZZHfobirZYkH1zF8fmeGtyaQ \
 --farmType aquafarm \
 --pair ORCA_SOL \
 --execute true

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

<!--
- gps: BA84mbakG8SCUvc6kZZZmsyb1JDPSycvFeTnFTPNDSzq
- orca strategy: 7GKJmae1Gkw2AiK4NyaTxm4gGFWoXYm3kUEZdJuJR11y
- vault: C4bZWoUu5FY1wk6vwiTirMCRLzWE5Nud5FLqoVWGkiqV

- vault?
- do stuff on vault
- right now, i think we have to invest the funds to be able to withdraw (and get LP). what happens if that doesn't happen?
- safe assumption to think we'll always invest?
-->

ts-node ./src/cli.ts ts

<!-- gps: 3PbRNrNoSviVqwcYJaVCpkK5RwyrswDFsVC8X9gNQV68 -->
<!-- orca: G7yWxUweRM1Kz5AxZHspsz8mui4K3un9parQoTa7DkF1 -->
<!-- vault: 9hM5Nht3z52hJbLpxZeXty7DkuDoHNnTtPxYKYZhxrNN -->

ts-node ./src/cli.ts init_vault --env devnet \
 --keypair /Users/jacobshiohira/.config/solana/devnet.json \
 --strategist J49LVNp7kwbeuZfkojcn6hpV1HSwXbg76ur3kh1bPXPM \
 --strategy G7yWxUweRM1Kz5AxZHspsz8mui4K3un9parQoTa7DkF1 \
 --alpha orcarKHSqC5CDDsGbho8GKvwExejWHxTqGzXgcewB9L \
 --userCapA 1000000 \
 --assetCapA 2000000 \
 --beta So11111111111111111111111111111111111111112 \
 --userCapB 1500000000 \
 --assetCapB 2000000000 \
 --fixedRate 3000 \
 --startAt 1653610072857 \
 --depositPeriod 3600 \
 --livePeriod 7200 \
 --execute true

<!-- SOL-ORCA, og reversed -->

<!-- vault: BDbAoUfYCwUDxSzioJkqmktH4fAcuDfqZhb89PDwKUS1 -->

ts-node ./src/cli.ts init_vault --env devnet \
 --keypair ../vaultKeys/vault-orca-sol-1.json \
 --strategist 5exbnfD3zMgyo3b5sZczDt1fTrMqNVo6EB7PP6oebUkE \
 --strategy G7yWxUweRM1Kz5AxZHspsz8mui4K3un9parQoTa7DkF1 \
 --alpha So11111111111111111111111111111111111111112 \
 --userCapA 1500000000 \
 --assetCapA 2000000000 \
 --beta orcarKHSqC5CDDsGbho8GKvwExejWHxTqGzXgcewB9L \
 --userCapB 1000000 \
 --assetCapB 2000000 \
 --fixedRate 1000 \
 --startAt 1653783198445 \
 --depositPeriod 3600 \
 --livePeriod 7200 \
 --execute true

ts-node ./src/cli.ts show_vault --env devnet \
 --keypair /Users/jacobshiohira/.config/solana/devnet.json \
 --vault BDbAoUfYCwUDxSzioJkqmktH4fAcuDfqZhb89PDwKUS1

ts-node ./src/cli.ts deposit --env devnet \
 --keypair /Users/jacobshiohira/.config/solana/devnet.json \
 --vault BDbAoUfYCwUDxSzioJkqmktH4fAcuDfqZhb89PDwKUS1 \
 --mint orcarKHSqC5CDDsGbho8GKvwExejWHxTqGzXgcewB9L \
 --amount 0.02 \
 --execute true

ts-node ./src/cli.ts deposit --env devnet \
 --keypair ../mintKeys/depositor2.json \
 --vault BDbAoUfYCwUDxSzioJkqmktH4fAcuDfqZhb89PDwKUS1 \
 --mint So11111111111111111111111111111111111111112 \
 --amount 0.1 \
 --execute true

ts-node ./src/cli.ts deposit --env devnet \
 --keypair ../mintKeys/depositor1.json \
 --vault BDbAoUfYCwUDxSzioJkqmktH4fAcuDfqZhb89PDwKUS1 \
 --mint So11111111111111111111111111111111111111112 \
 --amount 1 \
 --execute true

ts-node ./src/cli.ts deposit --env devnet \
 --keypair /Users/jacobshiohira/.config/solana/devnet.json \
 --vault BDbAoUfYCwUDxSzioJkqmktH4fAcuDfqZhb89PDwKUS1 \
 --mint So11111111111111111111111111111111111111112 \
 --amount 0.69 \
 --execute true

ts-node ./src/cli.ts show_depositors --env devnet \
 --keypair /Users/jacobshiohira/.config/solana/devnet.json \
 --vault BDbAoUfYCwUDxSzioJkqmktH4fAcuDfqZhb89PDwKUS1 \
 --mint So11111111111111111111111111111111111111112

ts-node ./src/cli.ts show_receipts --env devnet \
 --keypair /Users/jacobshiohira/.config/solana/devnet.json \
 --vault BDbAoUfYCwUDxSzioJkqmktH4fAcuDfqZhb89PDwKUS1 \
 --mint So11111111111111111111111111111111111111112 \
 --execute true

ts-node ./src/cli.ts show_deposit_history --env devnet \
 --keypair /Users/jacobshiohira/.config/solana/devnet.json \
 --vault BDbAoUfYCwUDxSzioJkqmktH4fAcuDfqZhb89PDwKUS1 \
 --depositor J49LVNp7kwbeuZfkojcn6hpV1HSwXbg76ur3kh1bPXPM \
 --mint orcarKHSqC5CDDsGbho8GKvwExejWHxTqGzXgcewB9L

9dX7Fz5qMQU27VnYjv56mCN4VCCe6Er6EwJSwqwgD9cE

<!-- todo: test B/A for A/B -->

/Users/jacobshiohira/.config/solana/devnet.json

ts-node ./src/cli.ts invest_orca --env devnet \
 --keypair ../vaultKeys/vault-orca-sol-1.json \
 --vault BDbAoUfYCwUDxSzioJkqmktH4fAcuDfqZhb89PDwKUS1 \
 --orcaSwapProgram 3xQ8SWv2GaFXXpHZNqkXsdxq5DZciHBz6ZFoPPfbFd7U \
 --pair ORCA_SOL \
 --alpha 0.000476 \
 --beta 0.025 \
 --execute true

ts-node ./src/cli.ts redeem_orca --env devnet \
 --keypair ../vaultKeys/vault-orca-sol-1.json \
 --vault BDbAoUfYCwUDxSzioJkqmktH4fAcuDfqZhb89PDwKUS1 \
 --orcaSwapProgram 3xQ8SWv2GaFXXpHZNqkXsdxq5DZciHBz6ZFoPPfbFd7U \
 --pair ORCA_SOL \
 --execute true

ts-node ./src/cli.ts process_claims --env devnet \
 --keypair /Users/jacobshiohira/.config/solana/devnet.json \
 --vault BDbAoUfYCwUDxSzioJkqmktH4fAcuDfqZhb89PDwKUS1 \
 --mint So11111111111111111111111111111111111111112 \
 --execute true

ts-node ./src/cli.ts claim --env devnet \
 --keypair /Users/jacobshiohira/.config/solana/devnet.json \
 --vault BDbAoUfYCwUDxSzioJkqmktH4fAcuDfqZhb89PDwKUS1 \
 --mint So11111111111111111111111111111111111111112 \
 --execute true

ts-node ./src/cli.ts claim --env devnet \
 --keypair /Users/jacobshiohira/.config/solana/devnet.json \
 --vault BDbAoUfYCwUDxSzioJkqmktH4fAcuDfqZhb89PDwKUS1 \
 --mint orcarKHSqC5CDDsGbho8GKvwExejWHxTqGzXgcewB9L \
 --execute true

J49LVNp7kwbeuZfkojcn6hpV1HSwXbg76ur3kh1bPXPM -> 1199615748
depositor2 9dX7Fz5qMQU27VnYjv56mCN4VCCe6Er6EwJSwqwgD9cE -> 1200000000
depositor1 9yQZBpYBAdEMNxnzWwstcu5ZQjwNa1VzsAfPKkTPxnwe -> 1000000000

ts-node ./src/cli.ts claim --env devnet \
 --keypair /Users/jacobshiohira/.config/solana/devnet.json \
 --vault BDbAoUfYCwUDxSzioJkqmktH4fAcuDfqZhb89PDwKUS1 \
 --mint So11111111111111111111111111111111111111112 \
 --execute true

ts-node ./src/cli.ts show_depositors --env devnet \
 --keypair /Users/jacobshiohira/.config/solana/devnet.json \
 --mint So11111111111111111111111111111111111111112 \
 --vault BDbAoUfYCwUDxSzioJkqmktH4fAcuDfqZhb89PDwKUS1

ts-node ./src/cli.ts show_deposit_history --env devnet \
 --keypair /Users/jacobshiohira/.config/solana/devnet.json \
 --vault BDbAoUfYCwUDxSzioJkqmktH4fAcuDfqZhb89PDwKUS1 \
 --mint So11111111111111111111111111111111111111112 \
 --depositor J49LVNp7kwbeuZfkojcn6hpV1HSwXbg76ur3kh1bPXPM

ts-node ./src/cli.ts show_deposit_history --env devnet \
 --keypair /Users/jacobshiohira/.config/solana/devnet.json \
 --vault BDbAoUfYCwUDxSzioJkqmktH4fAcuDfqZhb89PDwKUS1 \
 --mint So11111111111111111111111111111111111111112 \
 --depositor 9dX7Fz5qMQU27VnYjv56mCN4VCCe6Er6EwJSwqwgD9cE

ts-node ./src/cli.ts get_invest_estimate --env devnet \
 --keypair /Users/jacobshiohira/.config/solana/devnet.json \
 --vault BDbAoUfYCwUDxSzioJkqmktH4fAcuDfqZhb89PDwKUS1 \
 --pair ORCA_SOL

ts-node ./src/cli.ts get_invest_estimate_for_pool \
 --env mainnet-beta \
 --keypair /Users/jacobshiohira/.config/solana/devnet.json \
 --pair ZBC_USDC \
 --amountA 200000 \
 --amountB 5000

ts-node ./src/cli.ts get_invest_estimate_for_pool \
 --env devnet \
 --keypair /Users/jacobshiohira/.config/solana/devnet.json \
 --pair SOL_USDC \
 --amountA 1 \
 --amountB 1000

https://solscan.io/tx/2kz17Me2QUzUWNUZkcoNdC6xk4iJpLCARBHhiDxEMGR8Mk3a2KEDpU2C26MpkGySf46uey2noFg4JqMwt4macx5Y?cluster=devnet

ts-node ./src/cli.ts withdraw --env devnet \
 --keypair /Users/jacobshiohira/.config/solana/devnet.json \
 --vault BDbAoUfYCwUDxSzioJkqmktH4fAcuDfqZhb89PDwKUS1 \
 --mint So11111111111111111111111111111111111111112 \
 --execute true

ts-node ./src/cli.ts withdraw --env devnet \
 --keypair /Users/jacobshiohira/.config/solana/devnet.json \
 --vault BDbAoUfYCwUDxSzioJkqmktH4fAcuDfqZhb89PDwKUS1 \
 --mint So11111111111111111111111111111111111111112 \
 --execute true

ts-node ./src/cli.ts claim --env devnet \
 --keypair /Users/jacobshiohira/sooshisan/ora/mintKeys/depositor1.json \
 --vault BDbAoUfYCwUDxSzioJkqmktH4fAcuDfqZhb89PDwKUS1 \
 --mint So11111111111111111111111111111111111111112 \
 --execute true

ts-node ./src/cli.ts withdraw --env devnet \
 --keypair /Users/jacobshiohira/sooshisan/ora/mintKeys/depositor2.json \
 --vault BDbAoUfYCwUDxSzioJkqmktH4fAcuDfqZhb89PDwKUS1 \
 --mint So11111111111111111111111111111111111111112 \
 --execute true

BFm6WfjAEuokVoGZVdcSRw7vQZ1HTPoaj62pQ5mbAc4G

ts-node ./src/cli.ts token_supply --env mainnet-beta \
 --mint AFbX8oGjGpmVFywbVouvhQSRmiW2aR1mohfahi4Y2AdB

ts-node ./src/cli.ts token_supply --env mainnet-beta \
 --mint DUSTawucrTsGU8hcqRdHDCbuYhCPADMLM2VcCb8VnFnQ

ts-node ./src/cli.ts get_ata --env devnet --owner 9dX7Fz5qMQU27VnYjv56mCN4VCCe6Er6EwJSwqwgD9cE --mint orcarKHSqC5CDDsGbho8GKvwExejWHxTqGzXgcewB9L

<!-- https://api.coingecko.com/api/v3/simple/price?ids=stepn&vs_currencies=usd -->
<!-- https://api.coingecko.com/api/v3/simple/price?ids=1sol,all-art,allbridge,apricot,star-atlas,audius-wormhole,aurory,avalanche-2,basis-markets,,boring-protocol,bitcoin,cato,celo,solchicks-token,compendium-fi,cope,defi-land,ethereum,phantasia,bonfida,frakt-token,fantom,ftx-token,genopets,stepn,goosefx,grape-2,green-satoshi-token,hubble,,investin,jet,jpool,kin,kurobi,larix,liq-protocol,maps,meanfi,media-network,mercurial,mma-gaming,marinade,mango-markets,ninja-protocol,nova-finance,oogi,oxygen,,star-atlas-dao,port-finance,parrot-protocol,puff,raydium,rope-token,run,samoyedcoin,sator,superbonds,saber,synchrony,soldoge,,genesysgo-shadow,solice,solanium,solend,solrise-finance,synthetify-token,solana,sonarwatch,serum,step-finance,sunny-aggregator,sypool,taki,tabtrader,solfarm,unq,upfi-network,usd-coin,usdh,tether,uxd-protocol-token,,whalemap,woof-token,zebec-protocol,zignaly,,msol,,rally-solana,,socean-staked-sol,,lido-staked-sol,hapi,lido-dao,terra-luna,terrausd-wormhole,ethereum,staked-ether&vs_currencies=usd -->

solana transfer --from /Users/jacobshiohira/.config/solana/devnet.json F187rWhCtgXDKZgyyyngqzJjMZuTCQZtLRrJeTyznQii 0.01 --fee-payer /Users/jacobshiohira/.config/solana/devnet.json

5exbnfD3zMgyo3b5sZczDt1fTrMqNVo6EB7PP6oebUkE

ts-node ./src/cli.ts get_ata --env devnet --owner J49LVNp7kwbeuZfkojcn6hpV1HSwXbg76ur3kh1bPXPM --mint orcarKHSqC5CDDsGbho8GKvwExejWHxTqGzXgcewB9L

spl-token create-account F187rWhCtgXDKZgyyyngqzJjMZuTCQZtLRrJeTyznQii

spl-token transfer 2VSBJ5aKmKbLqixGfvGkaU5HXnftasn53iPFied2isXT 0.02 F187rWhCtgXDKZgyyyngqzJjMZuTCQZtLRrJeTyznQii
