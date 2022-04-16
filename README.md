# Vault

<div>
    <div align="center">
        <img src="/assets/banner.png" />
    </div>
    <span>
        Background courtesy of <a href="https://unsplash.com/@kevinchin">Kevin Chin</a> on <a href="https://unsplash.com">Unsplash</a>
    </span>
</div>

## Description

[Redacted]

### Vision

[Redacted]

#### Why build the vault?

[Redacted]

#### Ecosystem value

[Redacted]

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
