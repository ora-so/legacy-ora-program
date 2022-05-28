export type Vault = {
  "version": "0.1.0",
  "name": "vault",
  "instructions": [
    {
      "name": "initializeGlobalProtocolState",
      "accounts": [
        {
          "name": "authority",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "globalProtocolState",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "treasury",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "bump",
          "type": "u8"
        }
      ]
    },
    {
      "name": "initializeSaber",
      "accounts": [
        {
          "name": "authority",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "globalProtocolState",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "strategy",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenA",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenB",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "basePool",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "poolLp",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "bump",
          "type": "u8"
        },
        {
          "name": "flag",
          "type": "u64"
        },
        {
          "name": "version",
          "type": "u16"
        }
      ]
    },
    {
      "name": "initializeOrca",
      "accounts": [
        {
          "name": "authority",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "globalProtocolState",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "strategy",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenA",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenB",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "swapProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "farmProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "pool",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "baseLp",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "farm",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "farmLp",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "doubleDipFarmLp",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "bump",
          "type": "u8"
        },
        {
          "name": "flag",
          "type": "u64"
        },
        {
          "name": "version",
          "type": "u16"
        }
      ]
    },
    {
      "name": "initializeVault",
      "accounts": [
        {
          "name": "authority",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "globalProtocolState",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "vault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "alphaMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "alphaLp",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "betaMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "betaLp",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "vaultBump",
          "type": "u8"
        },
        {
          "name": "vaultConfig",
          "type": {
            "defined": "VaultConfig"
          }
        }
      ]
    },
    {
      "name": "deposit",
      "accounts": [
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "authority",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "globalProtocolState",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "vault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "receipt",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "history",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "mint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "sourceAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "destinationAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "ataProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "depositIndex",
          "type": "u64"
        },
        {
          "name": "receiptBump",
          "type": "u8"
        },
        {
          "name": "historyBump",
          "type": "u8"
        },
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "investSaber",
      "accounts": [
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "authority",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "globalProtocolState",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "vault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "strategy",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "saberSwapCommon",
          "accounts": [
            {
              "name": "swap",
              "isMut": false,
              "isSigner": false
            },
            {
              "name": "swapAuthority",
              "isMut": false,
              "isSigner": false
            },
            {
              "name": "sourceTokenA",
              "isMut": true,
              "isSigner": false
            },
            {
              "name": "reserveA",
              "isMut": true,
              "isSigner": false
            },
            {
              "name": "sourceTokenB",
              "isMut": true,
              "isSigner": false
            },
            {
              "name": "reserveB",
              "isMut": true,
              "isSigner": false
            },
            {
              "name": "poolMint",
              "isMut": true,
              "isSigner": false
            },
            {
              "name": "saberProgram",
              "isMut": false,
              "isSigner": false
            }
          ]
        },
        {
          "name": "outputLp",
          "isMut": true,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "investableA",
          "type": "u64"
        },
        {
          "name": "investableB",
          "type": "u64"
        },
        {
          "name": "minTokensBack",
          "type": "u64"
        }
      ]
    },
    {
      "name": "investOrca",
      "accounts": [
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "authority",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "globalProtocolState",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "vault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "strategy",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "orcaSwapProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "orcaPool",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "orcaAuthority",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "sourceTokenA",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "sourceTokenB",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "intoA",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "intoB",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "poolToken",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "poolAccount",
          "isMut": true,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "investableA",
          "type": "u64"
        },
        {
          "name": "investableB",
          "type": "u64"
        },
        {
          "name": "minTokensBack",
          "type": "u64"
        }
      ]
    },
    {
      "name": "processClaims",
      "accounts": [
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "authority",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "globalProtocolState",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "vault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "mint",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "claim",
      "accounts": [
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "authority",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "globalProtocolState",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "vault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "history",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "mint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "lp",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "sourceAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "destinationAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "destinationLpAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "ataProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "initializeUserFarmOrca",
      "accounts": [
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "authority",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "globalProtocolState",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "vault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "farmVault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "strategy",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "aquafarmProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "globalFarm",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userFarm",
          "isMut": true,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "bump",
          "type": "u8"
        }
      ]
    },
    {
      "name": "convertOrcaLp",
      "accounts": [
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "authority",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "globalProtocolState",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "vault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "farmVault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "strategy",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "aquafarmProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "poolAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userBaseAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "globalBaseTokenVault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "farmTokenMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userFarmAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "globalFarm",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userFarm",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "globalRewardTokenVault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userRewardAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "farmAuthority",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "bump",
          "type": "u8"
        }
      ]
    },
    {
      "name": "harvestOrca",
      "accounts": [
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "authority",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "globalProtocolState",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "vault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "farmVault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "strategy",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "aquafarmProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "globalFarm",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userFarm",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "globalBaseTokenVault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "globalRewardTokenVault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userRewardAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "farmAuthority",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "bump",
          "type": "u8"
        }
      ]
    },
    {
      "name": "revertOrcaLp",
      "accounts": [
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "authority",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "globalProtocolState",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "vault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "farmVault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "strategy",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "aquafarmProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "poolAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userBaseAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "globalBaseTokenVault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "farmTokenMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userFarmAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "globalFarm",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userFarm",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "globalRewardTokenVault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userRewardAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "farmAuthority",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "bump",
          "type": "u8"
        }
      ]
    },
    {
      "name": "redeemSaber",
      "accounts": [
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "authority",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "globalProtocolState",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "vault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "strategy",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "saberSwapCommon",
          "accounts": [
            {
              "name": "swap",
              "isMut": false,
              "isSigner": false
            },
            {
              "name": "swapAuthority",
              "isMut": false,
              "isSigner": false
            },
            {
              "name": "sourceTokenA",
              "isMut": true,
              "isSigner": false
            },
            {
              "name": "reserveA",
              "isMut": true,
              "isSigner": false
            },
            {
              "name": "sourceTokenB",
              "isMut": true,
              "isSigner": false
            },
            {
              "name": "reserveB",
              "isMut": true,
              "isSigner": false
            },
            {
              "name": "poolMint",
              "isMut": true,
              "isSigner": false
            },
            {
              "name": "saberProgram",
              "isMut": false,
              "isSigner": false
            }
          ]
        },
        {
          "name": "inputLp",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "outputAFees",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "outputBFees",
          "isMut": true,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "minTokenA",
          "type": "u64"
        },
        {
          "name": "minTokenB",
          "type": "u64"
        },
        {
          "name": "swapConfig",
          "type": {
            "option": {
              "defined": "SwapConfig"
            }
          }
        }
      ]
    },
    {
      "name": "redeemOrca",
      "accounts": [
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "authority",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "globalProtocolState",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "vault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "strategy",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "orcaSwapProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "orcaPool",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "orcaAuthority",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "poolMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "sourcePoolAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "fromA",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "fromB",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "sourceTokenA",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "sourceTokenB",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "feeAccount",
          "isMut": true,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "minTokenA",
          "type": "u64"
        },
        {
          "name": "minTokenB",
          "type": "u64"
        },
        {
          "name": "swapConfig",
          "type": {
            "option": {
              "defined": "SwapConfig"
            }
          }
        }
      ]
    },
    {
      "name": "withdraw",
      "accounts": [
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "authority",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "globalProtocolState",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "vault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "mint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "lp",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "sourceLp",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "sourceAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "destinationAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "ataProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "swapOrca",
      "accounts": [
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "authority",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "globalProtocolState",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "vault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "farmVault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "strategy",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "orcaSwapProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "orcaPool",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "orcaAuthority",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "userTransferAuthority",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userSource",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "poolSource",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "poolDestination",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userDestination",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "poolMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "feeAccount",
          "isMut": true,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "bump",
          "type": "u8"
        },
        {
          "name": "amountIn",
          "type": "u64"
        },
        {
          "name": "minAmountOut",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "orcaStrategyDataV0",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "flag",
            "type": "u64"
          },
          {
            "name": "version",
            "type": "u16"
          },
          {
            "name": "swapProgram",
            "type": "publicKey"
          },
          {
            "name": "farmProgram",
            "type": "publicKey"
          },
          {
            "name": "tokenA",
            "type": "publicKey"
          },
          {
            "name": "tokenB",
            "type": "publicKey"
          },
          {
            "name": "baseLp",
            "type": "publicKey"
          },
          {
            "name": "farmLp",
            "type": "publicKey"
          },
          {
            "name": "doubleDipLp",
            "type": {
              "option": "publicKey"
            }
          }
        ]
      }
    },
    {
      "name": "saberStrategyDataV0",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "flag",
            "type": "u64"
          },
          {
            "name": "version",
            "type": "u16"
          },
          {
            "name": "baseLp",
            "type": "publicKey"
          },
          {
            "name": "farmLp",
            "type": {
              "option": "publicKey"
            }
          }
        ]
      }
    },
    {
      "name": "globalProtocolState",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "authority",
            "type": "publicKey"
          },
          {
            "name": "active",
            "type": "bool"
          },
          {
            "name": "treasury",
            "type": "publicKey"
          }
        ]
      }
    },
    {
      "name": "history",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "intialized",
            "type": "bool"
          },
          {
            "name": "deposits",
            "type": "u64"
          },
          {
            "name": "cumulative",
            "type": "u64"
          },
          {
            "name": "claim",
            "type": "u64"
          },
          {
            "name": "canClaimTrancheLp",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "receipt",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "cumulative",
            "type": "u64"
          },
          {
            "name": "depositor",
            "type": "publicKey"
          }
        ]
      }
    },
    {
      "name": "farmVault",
      "type": {
        "kind": "struct",
        "fields": []
      }
    },
    {
      "name": "vault",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "authority",
            "type": "publicKey"
          },
          {
            "name": "alpha",
            "type": {
              "defined": "Asset"
            }
          },
          {
            "name": "beta",
            "type": {
              "defined": "Asset"
            }
          },
          {
            "name": "strategy",
            "type": "publicKey"
          },
          {
            "name": "strategist",
            "type": "publicKey"
          },
          {
            "name": "fixedRate",
            "type": "u16"
          },
          {
            "name": "state",
            "type": {
              "defined": "State"
            }
          },
          {
            "name": "startAt",
            "type": "u64"
          },
          {
            "name": "investAt",
            "type": "u64"
          },
          {
            "name": "redeemAt",
            "type": "u64"
          },
          {
            "name": "farmVault",
            "type": {
              "option": "publicKey"
            }
          }
        ]
      }
    }
  ],
  "types": [
    {
      "name": "SwapConfig",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "maxIn",
            "type": "u64"
          },
          {
            "name": "minOut",
            "type": "u64"
          },
          {
            "name": "alphaToBeta",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "Asset",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "type": "publicKey"
          },
          {
            "name": "lp",
            "type": "publicKey"
          },
          {
            "name": "assetCap",
            "type": {
              "option": "u64"
            }
          },
          {
            "name": "userCap",
            "type": {
              "option": "u64"
            }
          },
          {
            "name": "deposits",
            "type": "u64"
          },
          {
            "name": "deposited",
            "type": "u64"
          },
          {
            "name": "invested",
            "type": "u64"
          },
          {
            "name": "excess",
            "type": "u64"
          },
          {
            "name": "received",
            "type": "u64"
          },
          {
            "name": "totalInvested",
            "type": "u64"
          },
          {
            "name": "rolloverDeposited",
            "type": "u64"
          },
          {
            "name": "claimsProcessed",
            "type": "bool"
          },
          {
            "name": "claimsIdx",
            "type": {
              "option": "u64"
            }
          }
        ]
      }
    },
    {
      "name": "AssetConfig",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "userCap",
            "type": {
              "option": "u64"
            }
          },
          {
            "name": "assetCap",
            "type": {
              "option": "u64"
            }
          }
        ]
      }
    },
    {
      "name": "VaultConfig",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "strategy",
            "type": "publicKey"
          },
          {
            "name": "authority",
            "type": "publicKey"
          },
          {
            "name": "strategist",
            "type": "publicKey"
          },
          {
            "name": "alpha",
            "type": {
              "defined": "AssetConfig"
            }
          },
          {
            "name": "beta",
            "type": {
              "defined": "AssetConfig"
            }
          },
          {
            "name": "fixedRate",
            "type": "u16"
          },
          {
            "name": "startAt",
            "type": "u64"
          },
          {
            "name": "investAt",
            "type": "u64"
          },
          {
            "name": "redeemAt",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "ErrorCode",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "ProtocolPaused"
          },
          {
            "name": "MathError"
          },
          {
            "name": "PublicKeyMismatch"
          },
          {
            "name": "BumpMismatch"
          },
          {
            "name": "InvalidMintAuthority"
          },
          {
            "name": "UninitializedAccount"
          },
          {
            "name": "IncorrectOwner"
          },
          {
            "name": "PublicKeysShouldBeUnique"
          },
          {
            "name": "AccountAlreadyInitialized"
          },
          {
            "name": "InsufficientTokenBalance"
          },
          {
            "name": "ImpossibleTokenRatioRequested"
          },
          {
            "name": "InvalidStateTransition"
          },
          {
            "name": "MissingTransitionAtTimeForState"
          },
          {
            "name": "VaultHasNoDeposits"
          },
          {
            "name": "InvalidDepositForVault"
          },
          {
            "name": "WrongAccountOwner"
          },
          {
            "name": "InvalidAccountData"
          },
          {
            "name": "InvalidStrategyFlag"
          },
          {
            "name": "StrategyAlreadyExists"
          },
          {
            "name": "InvalidVaultState"
          },
          {
            "name": "NonexistentAsset"
          },
          {
            "name": "InvalidLpMint"
          },
          {
            "name": "DepositExceedsUserCap"
          },
          {
            "name": "AssetCapExceeded"
          },
          {
            "name": "CannotWithdrawWithoutLpTokens"
          },
          {
            "name": "DataTypeMismatch"
          },
          {
            "name": "SlippageTooHigh"
          },
          {
            "name": "DualSidedExcesssNotPossible"
          },
          {
            "name": "DerivedKeyInvalid"
          },
          {
            "name": "InvalidRemainingAccountsIndex"
          },
          {
            "name": "MissingRequiredField"
          },
          {
            "name": "MissingRequiredConfig"
          },
          {
            "name": "CannotReinstantiateFarmVault"
          },
          {
            "name": "MissingFarmVault"
          },
          {
            "name": "UnexpectedAuthority"
          },
          {
            "name": "DecimalMismatch"
          },
          {
            "name": "AlreadyClaimedLpTokens"
          },
          {
            "name": "UnableToWriteToRemainingAccount"
          }
        ]
      }
    },
    {
      "name": "StrategyFlag",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "SaberLpStrategyV0"
          },
          {
            "name": "OrcaLpStrategyV0"
          }
        ]
      }
    },
    {
      "name": "State",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "Inactive"
          },
          {
            "name": "Deposit"
          },
          {
            "name": "Live"
          },
          {
            "name": "Redeem"
          },
          {
            "name": "Withdraw"
          }
        ]
      }
    }
  ]
};

export const IDL: Vault = {
  "version": "0.1.0",
  "name": "vault",
  "instructions": [
    {
      "name": "initializeGlobalProtocolState",
      "accounts": [
        {
          "name": "authority",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "globalProtocolState",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "treasury",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "bump",
          "type": "u8"
        }
      ]
    },
    {
      "name": "initializeSaber",
      "accounts": [
        {
          "name": "authority",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "globalProtocolState",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "strategy",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenA",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenB",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "basePool",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "poolLp",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "bump",
          "type": "u8"
        },
        {
          "name": "flag",
          "type": "u64"
        },
        {
          "name": "version",
          "type": "u16"
        }
      ]
    },
    {
      "name": "initializeOrca",
      "accounts": [
        {
          "name": "authority",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "globalProtocolState",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "strategy",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenA",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenB",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "swapProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "farmProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "pool",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "baseLp",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "farm",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "farmLp",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "doubleDipFarmLp",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "bump",
          "type": "u8"
        },
        {
          "name": "flag",
          "type": "u64"
        },
        {
          "name": "version",
          "type": "u16"
        }
      ]
    },
    {
      "name": "initializeVault",
      "accounts": [
        {
          "name": "authority",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "globalProtocolState",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "vault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "alphaMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "alphaLp",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "betaMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "betaLp",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "vaultBump",
          "type": "u8"
        },
        {
          "name": "vaultConfig",
          "type": {
            "defined": "VaultConfig"
          }
        }
      ]
    },
    {
      "name": "deposit",
      "accounts": [
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "authority",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "globalProtocolState",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "vault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "receipt",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "history",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "mint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "sourceAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "destinationAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "ataProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "depositIndex",
          "type": "u64"
        },
        {
          "name": "receiptBump",
          "type": "u8"
        },
        {
          "name": "historyBump",
          "type": "u8"
        },
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "investSaber",
      "accounts": [
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "authority",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "globalProtocolState",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "vault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "strategy",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "saberSwapCommon",
          "accounts": [
            {
              "name": "swap",
              "isMut": false,
              "isSigner": false
            },
            {
              "name": "swapAuthority",
              "isMut": false,
              "isSigner": false
            },
            {
              "name": "sourceTokenA",
              "isMut": true,
              "isSigner": false
            },
            {
              "name": "reserveA",
              "isMut": true,
              "isSigner": false
            },
            {
              "name": "sourceTokenB",
              "isMut": true,
              "isSigner": false
            },
            {
              "name": "reserveB",
              "isMut": true,
              "isSigner": false
            },
            {
              "name": "poolMint",
              "isMut": true,
              "isSigner": false
            },
            {
              "name": "saberProgram",
              "isMut": false,
              "isSigner": false
            }
          ]
        },
        {
          "name": "outputLp",
          "isMut": true,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "investableA",
          "type": "u64"
        },
        {
          "name": "investableB",
          "type": "u64"
        },
        {
          "name": "minTokensBack",
          "type": "u64"
        }
      ]
    },
    {
      "name": "investOrca",
      "accounts": [
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "authority",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "globalProtocolState",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "vault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "strategy",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "orcaSwapProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "orcaPool",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "orcaAuthority",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "sourceTokenA",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "sourceTokenB",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "intoA",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "intoB",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "poolToken",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "poolAccount",
          "isMut": true,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "investableA",
          "type": "u64"
        },
        {
          "name": "investableB",
          "type": "u64"
        },
        {
          "name": "minTokensBack",
          "type": "u64"
        }
      ]
    },
    {
      "name": "processClaims",
      "accounts": [
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "authority",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "globalProtocolState",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "vault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "mint",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "claim",
      "accounts": [
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "authority",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "globalProtocolState",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "vault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "history",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "mint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "lp",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "sourceAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "destinationAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "destinationLpAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "ataProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "initializeUserFarmOrca",
      "accounts": [
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "authority",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "globalProtocolState",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "vault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "farmVault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "strategy",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "aquafarmProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "globalFarm",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userFarm",
          "isMut": true,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "bump",
          "type": "u8"
        }
      ]
    },
    {
      "name": "convertOrcaLp",
      "accounts": [
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "authority",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "globalProtocolState",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "vault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "farmVault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "strategy",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "aquafarmProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "poolAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userBaseAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "globalBaseTokenVault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "farmTokenMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userFarmAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "globalFarm",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userFarm",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "globalRewardTokenVault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userRewardAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "farmAuthority",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "bump",
          "type": "u8"
        }
      ]
    },
    {
      "name": "harvestOrca",
      "accounts": [
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "authority",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "globalProtocolState",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "vault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "farmVault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "strategy",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "aquafarmProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "globalFarm",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userFarm",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "globalBaseTokenVault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "globalRewardTokenVault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userRewardAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "farmAuthority",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "bump",
          "type": "u8"
        }
      ]
    },
    {
      "name": "revertOrcaLp",
      "accounts": [
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "authority",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "globalProtocolState",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "vault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "farmVault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "strategy",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "aquafarmProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "poolAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userBaseAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "globalBaseTokenVault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "farmTokenMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userFarmAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "globalFarm",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userFarm",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "globalRewardTokenVault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userRewardAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "farmAuthority",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "bump",
          "type": "u8"
        }
      ]
    },
    {
      "name": "redeemSaber",
      "accounts": [
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "authority",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "globalProtocolState",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "vault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "strategy",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "saberSwapCommon",
          "accounts": [
            {
              "name": "swap",
              "isMut": false,
              "isSigner": false
            },
            {
              "name": "swapAuthority",
              "isMut": false,
              "isSigner": false
            },
            {
              "name": "sourceTokenA",
              "isMut": true,
              "isSigner": false
            },
            {
              "name": "reserveA",
              "isMut": true,
              "isSigner": false
            },
            {
              "name": "sourceTokenB",
              "isMut": true,
              "isSigner": false
            },
            {
              "name": "reserveB",
              "isMut": true,
              "isSigner": false
            },
            {
              "name": "poolMint",
              "isMut": true,
              "isSigner": false
            },
            {
              "name": "saberProgram",
              "isMut": false,
              "isSigner": false
            }
          ]
        },
        {
          "name": "inputLp",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "outputAFees",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "outputBFees",
          "isMut": true,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "minTokenA",
          "type": "u64"
        },
        {
          "name": "minTokenB",
          "type": "u64"
        },
        {
          "name": "swapConfig",
          "type": {
            "option": {
              "defined": "SwapConfig"
            }
          }
        }
      ]
    },
    {
      "name": "redeemOrca",
      "accounts": [
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "authority",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "globalProtocolState",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "vault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "strategy",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "orcaSwapProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "orcaPool",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "orcaAuthority",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "poolMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "sourcePoolAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "fromA",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "fromB",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "sourceTokenA",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "sourceTokenB",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "feeAccount",
          "isMut": true,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "minTokenA",
          "type": "u64"
        },
        {
          "name": "minTokenB",
          "type": "u64"
        },
        {
          "name": "swapConfig",
          "type": {
            "option": {
              "defined": "SwapConfig"
            }
          }
        }
      ]
    },
    {
      "name": "withdraw",
      "accounts": [
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "authority",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "globalProtocolState",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "vault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "mint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "lp",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "sourceLp",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "sourceAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "destinationAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "ataProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "swapOrca",
      "accounts": [
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "authority",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "globalProtocolState",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "vault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "farmVault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "strategy",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "orcaSwapProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "orcaPool",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "orcaAuthority",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "userTransferAuthority",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userSource",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "poolSource",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "poolDestination",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userDestination",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "poolMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "feeAccount",
          "isMut": true,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "bump",
          "type": "u8"
        },
        {
          "name": "amountIn",
          "type": "u64"
        },
        {
          "name": "minAmountOut",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "orcaStrategyDataV0",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "flag",
            "type": "u64"
          },
          {
            "name": "version",
            "type": "u16"
          },
          {
            "name": "swapProgram",
            "type": "publicKey"
          },
          {
            "name": "farmProgram",
            "type": "publicKey"
          },
          {
            "name": "tokenA",
            "type": "publicKey"
          },
          {
            "name": "tokenB",
            "type": "publicKey"
          },
          {
            "name": "baseLp",
            "type": "publicKey"
          },
          {
            "name": "farmLp",
            "type": "publicKey"
          },
          {
            "name": "doubleDipLp",
            "type": {
              "option": "publicKey"
            }
          }
        ]
      }
    },
    {
      "name": "saberStrategyDataV0",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "flag",
            "type": "u64"
          },
          {
            "name": "version",
            "type": "u16"
          },
          {
            "name": "baseLp",
            "type": "publicKey"
          },
          {
            "name": "farmLp",
            "type": {
              "option": "publicKey"
            }
          }
        ]
      }
    },
    {
      "name": "globalProtocolState",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "authority",
            "type": "publicKey"
          },
          {
            "name": "active",
            "type": "bool"
          },
          {
            "name": "treasury",
            "type": "publicKey"
          }
        ]
      }
    },
    {
      "name": "history",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "intialized",
            "type": "bool"
          },
          {
            "name": "deposits",
            "type": "u64"
          },
          {
            "name": "cumulative",
            "type": "u64"
          },
          {
            "name": "claim",
            "type": "u64"
          },
          {
            "name": "canClaimTrancheLp",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "receipt",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "cumulative",
            "type": "u64"
          },
          {
            "name": "depositor",
            "type": "publicKey"
          }
        ]
      }
    },
    {
      "name": "farmVault",
      "type": {
        "kind": "struct",
        "fields": []
      }
    },
    {
      "name": "vault",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "authority",
            "type": "publicKey"
          },
          {
            "name": "alpha",
            "type": {
              "defined": "Asset"
            }
          },
          {
            "name": "beta",
            "type": {
              "defined": "Asset"
            }
          },
          {
            "name": "strategy",
            "type": "publicKey"
          },
          {
            "name": "strategist",
            "type": "publicKey"
          },
          {
            "name": "fixedRate",
            "type": "u16"
          },
          {
            "name": "state",
            "type": {
              "defined": "State"
            }
          },
          {
            "name": "startAt",
            "type": "u64"
          },
          {
            "name": "investAt",
            "type": "u64"
          },
          {
            "name": "redeemAt",
            "type": "u64"
          },
          {
            "name": "farmVault",
            "type": {
              "option": "publicKey"
            }
          }
        ]
      }
    }
  ],
  "types": [
    {
      "name": "SwapConfig",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "maxIn",
            "type": "u64"
          },
          {
            "name": "minOut",
            "type": "u64"
          },
          {
            "name": "alphaToBeta",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "Asset",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "type": "publicKey"
          },
          {
            "name": "lp",
            "type": "publicKey"
          },
          {
            "name": "assetCap",
            "type": {
              "option": "u64"
            }
          },
          {
            "name": "userCap",
            "type": {
              "option": "u64"
            }
          },
          {
            "name": "deposits",
            "type": "u64"
          },
          {
            "name": "deposited",
            "type": "u64"
          },
          {
            "name": "invested",
            "type": "u64"
          },
          {
            "name": "excess",
            "type": "u64"
          },
          {
            "name": "received",
            "type": "u64"
          },
          {
            "name": "totalInvested",
            "type": "u64"
          },
          {
            "name": "rolloverDeposited",
            "type": "u64"
          },
          {
            "name": "claimsProcessed",
            "type": "bool"
          },
          {
            "name": "claimsIdx",
            "type": {
              "option": "u64"
            }
          }
        ]
      }
    },
    {
      "name": "AssetConfig",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "userCap",
            "type": {
              "option": "u64"
            }
          },
          {
            "name": "assetCap",
            "type": {
              "option": "u64"
            }
          }
        ]
      }
    },
    {
      "name": "VaultConfig",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "strategy",
            "type": "publicKey"
          },
          {
            "name": "authority",
            "type": "publicKey"
          },
          {
            "name": "strategist",
            "type": "publicKey"
          },
          {
            "name": "alpha",
            "type": {
              "defined": "AssetConfig"
            }
          },
          {
            "name": "beta",
            "type": {
              "defined": "AssetConfig"
            }
          },
          {
            "name": "fixedRate",
            "type": "u16"
          },
          {
            "name": "startAt",
            "type": "u64"
          },
          {
            "name": "investAt",
            "type": "u64"
          },
          {
            "name": "redeemAt",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "ErrorCode",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "ProtocolPaused"
          },
          {
            "name": "MathError"
          },
          {
            "name": "PublicKeyMismatch"
          },
          {
            "name": "BumpMismatch"
          },
          {
            "name": "InvalidMintAuthority"
          },
          {
            "name": "UninitializedAccount"
          },
          {
            "name": "IncorrectOwner"
          },
          {
            "name": "PublicKeysShouldBeUnique"
          },
          {
            "name": "AccountAlreadyInitialized"
          },
          {
            "name": "InsufficientTokenBalance"
          },
          {
            "name": "ImpossibleTokenRatioRequested"
          },
          {
            "name": "InvalidStateTransition"
          },
          {
            "name": "MissingTransitionAtTimeForState"
          },
          {
            "name": "VaultHasNoDeposits"
          },
          {
            "name": "InvalidDepositForVault"
          },
          {
            "name": "WrongAccountOwner"
          },
          {
            "name": "InvalidAccountData"
          },
          {
            "name": "InvalidStrategyFlag"
          },
          {
            "name": "StrategyAlreadyExists"
          },
          {
            "name": "InvalidVaultState"
          },
          {
            "name": "NonexistentAsset"
          },
          {
            "name": "InvalidLpMint"
          },
          {
            "name": "DepositExceedsUserCap"
          },
          {
            "name": "AssetCapExceeded"
          },
          {
            "name": "CannotWithdrawWithoutLpTokens"
          },
          {
            "name": "DataTypeMismatch"
          },
          {
            "name": "SlippageTooHigh"
          },
          {
            "name": "DualSidedExcesssNotPossible"
          },
          {
            "name": "DerivedKeyInvalid"
          },
          {
            "name": "InvalidRemainingAccountsIndex"
          },
          {
            "name": "MissingRequiredField"
          },
          {
            "name": "MissingRequiredConfig"
          },
          {
            "name": "CannotReinstantiateFarmVault"
          },
          {
            "name": "MissingFarmVault"
          },
          {
            "name": "UnexpectedAuthority"
          },
          {
            "name": "DecimalMismatch"
          },
          {
            "name": "AlreadyClaimedLpTokens"
          },
          {
            "name": "UnableToWriteToRemainingAccount"
          }
        ]
      }
    },
    {
      "name": "StrategyFlag",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "SaberLpStrategyV0"
          },
          {
            "name": "OrcaLpStrategyV0"
          }
        ]
      }
    },
    {
      "name": "State",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "Inactive"
          },
          {
            "name": "Deposit"
          },
          {
            "name": "Live"
          },
          {
            "name": "Redeem"
          },
          {
            "name": "Withdraw"
          }
        ]
      }
    }
  ]
};
