# bucket-vault

<div>
    <div align="center">
        <img src="/assets/banner.png" />
    </div>
    <span>
        Background courtesy of <a href="https://unsplash.com/@kevinchin">Kevin Chin</a> on <a href="https://unsplash.com">Unsplash</a>
    </span>
</div>

## Description

Vault aims to be deposit-and-forget yield generation protocol built by and for [bucket protocol](https://github.com/bucket-dao/bucket-program). However, the vault will be implemented with an eye toward composability such that anyone can integrate with the vault. The default vault implementation will only require users to initialize a vault, deposit funds, and redeem funds + yield. All of the other details will be abstracted away.

Even though the defaults will be simple, the vault will expose configuration (e.g. risk tolerance) so that users can create vaults based on their specific use cases.

### Current State

The team built out the most simple version of this program for a proof-of-concept. The program is currently just a "passthrough" for providing liquidity to Saber swap pools.

There are only 3 operations:

1. Initialize vault: setup vault PDA so that user can deposit funds and later redeem those funds + generaated yield.
2. Deposit: transfer a token pair from a depositor's ATAs to the vault's ATAs. At the current time, the user must deposit a token pair in order to provide liquidity. In the future, this will not be the case. Immediately after the vault receives assets, the vault will deposit the funds into the necessary Saber swap pool. The vault will then store the Saber LP token(s) that it receives for providing liquidity. There is no restriction outlining which token mints are accepted.
3. Withdraw: Redeem deposited liquidity by burning the Saber LP token(s) held by the vault. Immediately after the vault receives liquidity from Saber, it vault will transfer the token pair back to the original user's ATAs.

### Vision

The end state of the vault will allow any user or entity to permissionlessly and automatically earn yield on a pool of assets based a specific risk tolerance. A user will be able to deposit any asset(s) into an initialized vault and later redeem those asset(s) plus generated yield.

#### Why factor in risk?

As a stablecoin product, bucket protocol needs to be very mindful of all forms of risk when transferring ownership of assets to earn yield. A singular yield strategy that iss highly profitable but might result in loss of funds is likely not worth it. However, yield strategies with lower risk or combinations of yield strategies might make more sense.

Thus, bucket highly values a protocol that can manage risk while also earning yield.

#### Why build the vault?

First and foremost, bucket protocol isn't dead set on building an independent vault protocol. The vault is simply a means to an end — generating yield based on risk tolerance(s). Bucket protocol would be delighted to use another open-source product. There will be technical risk regardless of the chosen path. However, a protocol managing a pool of collateral assets needs to ensure fine grained control over what is done with those assets.

Additionally, building this vault means it can be further improved if other players in the ecosystem decide to build on top of it. For example, we can imagine an entity (human or smart contract) that spins up vaults with various risk profiles and manages those vaults on behalf of clients.

#### Composability

It doesn't make sense for vault to re-implement/fork swaps, pools, lending, etc. Instead, vault will rely on other players in the ecosystem. Any protocol that allows users to make money can be implemented — DEXs, lending protocols, derivative exchanges (e.g. Zeta, PsyOptions, Drift), yield farms, other yield aggregators, etc.

Composability will enable a better vault implementation than could be achieved in isolation.

#### Ecosystem value

Bucket and by extension, the Vault, believes in building open-source. As a protocol that will build on other players in the ecosystem. Open source examples and documentation were invaluable resources to bucket protocol's original implementation.

Further, not all protocols are open-source. The vault will have to do additional up-front work to do these integrations. So, any integrations will serve as documentation for other teams looking to do similar things.

---

As mentioned above, this project is part of the [bucket protocol](https://github.com/bucket-dao/bucket-program), a project started at [mtnDAO](https://twitter.com/mtnDAO) for [Solana's Riptide Hackathon](https://solana.com/riptide). We are in active development. For the latest updates, follow our journey:

- Website: https://bucketdao.com
- Twitter: https://twitter.com/bucket_sol

## Respository overview

- `programs/`

  - Folder containing any current and future on-chain programs. The core vault program is the only program here currently.

- `scripts/`

  - Various bash scripts to make common actions easier such as setting up a dev environment, copying IDLs, deploying a program, etc.

- `sdk/`

  - The package that allows you to easily interact with a vault program. There is a 1-1 mapping between SDK functions and on-chain instructions. The SDK is beneficial because it abstracts away a lot of complexity of finding addresses, building transactions, and more.

- `tests/`
  - The directory containing code and helpers to test the end-to-end functionality of the vault program. These tests are a great way to understand how the vault program works + how to interact with the program.

## Rust Crates

#### Custom

These rust crates are produced by running anchor build.

| Package | Description        | Version | Docs    |
| :------ | :----------------- | :------ | :------ |
| `vault` | Core vault program | pending | pending |

#### Dependencies

These rust crates are imported across this repo's programs' Cargo.toml files. Disclaimer: our programs do not necessarily the latest versions, as displayed in the table below. Check the Cargo.toml or Cargo.lock for specific crate versions.

| Package              | Description                                                       | Version                                                                                                         | Docs                                                                                           |
| :------------------- | :---------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------- |
| `anchor-spl`         | CPI clients for SPL programs                                      | [![Crates.io](https://img.shields.io/crates/v/anchor-spl)](https://crates.io/crates/anchor-spl)                 | [![Docs.rs](https://docs.rs/anchor-spl/badge.svg)](https://docs.rs/anchor-spl)                 |
| `anchor-lang`        | Solana Sealevel eDSL                                              | [![Crates.io](https://img.shields.io/crates/v/anchor-lang)](https://crates.io/crates/anchor-lang)               | [![Docs.rs](https://docs.rs/anchor-lang/badge.svg)](https://docs.rs/anchor-lang)               |
| `stable-swap-anchor` | Anchor bindings for the StableSwap Rust client                    | [![Crates.io](https://img.shields.io/crates/v/stable-swap-anchor)](https://crates.io/crates/stable-swap-anchor) | [![Docs.rs](https://docs.rs/stable-swap-anchor/badge.svg)](https://docs.rs/stable-swap-anchor) |
| `vipers`             | Assorted checks and validations for writing safer Solana programs | [![Crates.io](https://img.shields.io/crates/v/vipers)](https://crates.io/crates/vipers)                         | [![Docs.rs](https://docs.rs/vipers/badge.svg)](https://docs.rs/vipers)                         |

## JavaScript/Web3.js

To interact with a deployed vault from your own project, use the JavaScript SDK. It will later be published to NPM.

## Developing

### Getting Started

#### Solana specific

You'll need to install a couple development tools if this is your first time developing on Solana. We recommend starting with the following getting started guides:

- [Solana cookbook](https://solanacookbook.com/getting-started/installation.html#macos-linux)
- [Anchor book](https://book.anchor-lang.com/chapter_2/getting_started.html)

#### Other

By this point, you should have

- [yarn](https://classic.yarnpkg.com/lang/en/docs/install), and
- [npm](https://docs.npmjs.com/cli/v7/configuring-npm/install)

If not, it doesn't hurt to install these now. Many projects ues these tools. You will also need `ts-mocha` installed globally to run our tests. You can install it via NPM like so:

`npm i -g ts-mocha`

You might need to run the above command with `sudo` prepended. Verify it's installed by running `ts-mocha`. You should see output like this:

```sh
Error: No test files found: "test"
```

#### Installation

We provide a simple script to install dependencies, build packages. Simply run

```
yarn setup
```

#### Troubleshooting

The respective projects' documentation sites and discords are a great place to start when troubleshooting issues.

### Tests

Make sure you previously built the SDK and installed all relevant packages. Then, you can run all the tests with:

```sh
anchor test
```

## Licensing

[Apache 2.0](./LICENSE).
