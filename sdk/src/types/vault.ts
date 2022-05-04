export type Vault = {
  "version": "0.1.0",
  "name": "vault",
  "instructions": [
    {
      "name": "initializeSaberStrategy",
      "accounts": [
        {
          "name": "authority",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "saberStrategy",
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
      "name": "initializeVault",
      "accounts": [
        {
          "name": "authority",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "vault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "strategy",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "strategist",
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
          "isMut": false,
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
      "name": "invest",
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
          "name": "strategy",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "vault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "saberDeposit",
          "accounts": [
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
                }
              ]
            },
            {
              "name": "outputLp",
              "isMut": true,
              "isSigner": false
            }
          ]
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
          "name": "vault",
          "isMut": true,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "redeem",
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
          "name": "strategy",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "vault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "saberWithdraw",
          "accounts": [
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
          ]
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
          "name": "minTokenA",
          "type": "u64"
        },
        {
          "name": "minTokenB",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
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
            "name": "intialized",
            "type": "bool"
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
      "name": "saberLpStrategyV0",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "flags",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "tokenA",
            "type": "publicKey"
          },
          {
            "name": "tokenB",
            "type": "publicKey"
          }
        ]
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
            "name": "excess",
            "type": {
              "option": "publicKey"
            }
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
    }
  ],
  "types": [
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
      "name": "WithdrawConfig",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "amount",
            "type": {
              "option": "u64"
            }
          }
        ]
      }
    },
    {
      "name": "Key",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "Uninitialized"
          },
          {
            "name": "Saber"
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
          }
        ]
      }
    },
    {
      "name": "Strategy",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "SaberLpStrategyV0",
            "fields": [
              {
                "defined": "saber::SaberLpStrategyV0"
              }
            ]
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
  ],
  "errors": [
    {
      "code": 6000,
      "name": "MathError",
      "msg": "Math Error"
    },
    {
      "code": 6001,
      "name": "PublicKeyMismatch",
      "msg": "PublicKeyMismatch"
    },
    {
      "code": 6002,
      "name": "BumpMismatch",
      "msg": "BumpMismatch"
    },
    {
      "code": 6003,
      "name": "InvalidMintAuthority",
      "msg": "InvalidMintAuthority"
    },
    {
      "code": 6004,
      "name": "UninitializedAccount",
      "msg": "UninitializedAccount"
    },
    {
      "code": 6005,
      "name": "IncorrectOwner",
      "msg": "IncorrectOwner"
    },
    {
      "code": 6006,
      "name": "PublicKeysShouldBeUnique",
      "msg": "PublicKeysShouldBeUnique"
    },
    {
      "code": 6007,
      "name": "AccountAlreadyInitialized",
      "msg": "AccountAlreadyInitialized"
    },
    {
      "code": 6008,
      "name": "InsufficientTokenBalance",
      "msg": "Insufficient token balance"
    },
    {
      "code": 6009,
      "name": "ImpossibleTokenRatioRequested",
      "msg": "Impossible token ratio request"
    },
    {
      "code": 6010,
      "name": "InvalidStateTransition",
      "msg": "Invalid state transition"
    },
    {
      "code": 6011,
      "name": "MissingTransitionAtTimeForState",
      "msg": "Missing transition at time for state"
    },
    {
      "code": 6012,
      "name": "VaultHasNoDeposits",
      "msg": "Vault has no deposits"
    },
    {
      "code": 6013,
      "name": "InvalidDepositForVault",
      "msg": "Invalid deposit for vault"
    },
    {
      "code": 6014,
      "name": "WrongAccountOwner",
      "msg": "Wrong account owner"
    },
    {
      "code": 6015,
      "name": "InvalidAccountData",
      "msg": "Invalid account data"
    },
    {
      "code": 6016,
      "name": "InvalidStrategyFlag",
      "msg": "Invalid strategy flag"
    },
    {
      "code": 6017,
      "name": "StrategyAlreadyExists",
      "msg": "Strategy already exists"
    },
    {
      "code": 6018,
      "name": "InvalidVaultState",
      "msg": "Invalid vault state"
    },
    {
      "code": 6019,
      "name": "NonexistentAsset",
      "msg": "Non-existent Asset"
    },
    {
      "code": 6020,
      "name": "InvalidLpMint",
      "msg": "Invalid LP Mint"
    },
    {
      "code": 6021,
      "name": "DepositExceedsUserCap",
      "msg": "Deposit exceeds user cap"
    },
    {
      "code": 6022,
      "name": "DepositExceedsAssetCap",
      "msg": "Deposit exceeds asset cap"
    },
    {
      "code": 6023,
      "name": "CannotWithdrawWithoutLpTokens",
      "msg": "Cannot redeem without LP tokens"
    },
    {
      "code": 6024,
      "name": "DataTypeMismatch",
      "msg": "Data type mismatch"
    },
    {
      "code": 6025,
      "name": "SlippageTooHigh",
      "msg": "Slippage too high"
    },
    {
      "code": 6026,
      "name": "DualSidedExcesssNotPossible",
      "msg": "Dual-sided excesss is not possible"
    }
  ]
};

export const IDL: Vault = {
  "version": "0.1.0",
  "name": "vault",
  "instructions": [
    {
      "name": "initializeSaberStrategy",
      "accounts": [
        {
          "name": "authority",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "saberStrategy",
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
      "name": "initializeVault",
      "accounts": [
        {
          "name": "authority",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "vault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "strategy",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "strategist",
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
          "isMut": false,
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
      "name": "invest",
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
          "name": "strategy",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "vault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "saberDeposit",
          "accounts": [
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
                }
              ]
            },
            {
              "name": "outputLp",
              "isMut": true,
              "isSigner": false
            }
          ]
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
          "name": "vault",
          "isMut": true,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "redeem",
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
          "name": "strategy",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "vault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "saberWithdraw",
          "accounts": [
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
          ]
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
          "name": "minTokenA",
          "type": "u64"
        },
        {
          "name": "minTokenB",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
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
            "name": "intialized",
            "type": "bool"
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
      "name": "saberLpStrategyV0",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "flags",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "tokenA",
            "type": "publicKey"
          },
          {
            "name": "tokenB",
            "type": "publicKey"
          }
        ]
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
            "name": "excess",
            "type": {
              "option": "publicKey"
            }
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
    }
  ],
  "types": [
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
      "name": "WithdrawConfig",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "amount",
            "type": {
              "option": "u64"
            }
          }
        ]
      }
    },
    {
      "name": "Key",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "Uninitialized"
          },
          {
            "name": "Saber"
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
          }
        ]
      }
    },
    {
      "name": "Strategy",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "SaberLpStrategyV0",
            "fields": [
              {
                "defined": "saber::SaberLpStrategyV0"
              }
            ]
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
  ],
  "errors": [
    {
      "code": 6000,
      "name": "MathError",
      "msg": "Math Error"
    },
    {
      "code": 6001,
      "name": "PublicKeyMismatch",
      "msg": "PublicKeyMismatch"
    },
    {
      "code": 6002,
      "name": "BumpMismatch",
      "msg": "BumpMismatch"
    },
    {
      "code": 6003,
      "name": "InvalidMintAuthority",
      "msg": "InvalidMintAuthority"
    },
    {
      "code": 6004,
      "name": "UninitializedAccount",
      "msg": "UninitializedAccount"
    },
    {
      "code": 6005,
      "name": "IncorrectOwner",
      "msg": "IncorrectOwner"
    },
    {
      "code": 6006,
      "name": "PublicKeysShouldBeUnique",
      "msg": "PublicKeysShouldBeUnique"
    },
    {
      "code": 6007,
      "name": "AccountAlreadyInitialized",
      "msg": "AccountAlreadyInitialized"
    },
    {
      "code": 6008,
      "name": "InsufficientTokenBalance",
      "msg": "Insufficient token balance"
    },
    {
      "code": 6009,
      "name": "ImpossibleTokenRatioRequested",
      "msg": "Impossible token ratio request"
    },
    {
      "code": 6010,
      "name": "InvalidStateTransition",
      "msg": "Invalid state transition"
    },
    {
      "code": 6011,
      "name": "MissingTransitionAtTimeForState",
      "msg": "Missing transition at time for state"
    },
    {
      "code": 6012,
      "name": "VaultHasNoDeposits",
      "msg": "Vault has no deposits"
    },
    {
      "code": 6013,
      "name": "InvalidDepositForVault",
      "msg": "Invalid deposit for vault"
    },
    {
      "code": 6014,
      "name": "WrongAccountOwner",
      "msg": "Wrong account owner"
    },
    {
      "code": 6015,
      "name": "InvalidAccountData",
      "msg": "Invalid account data"
    },
    {
      "code": 6016,
      "name": "InvalidStrategyFlag",
      "msg": "Invalid strategy flag"
    },
    {
      "code": 6017,
      "name": "StrategyAlreadyExists",
      "msg": "Strategy already exists"
    },
    {
      "code": 6018,
      "name": "InvalidVaultState",
      "msg": "Invalid vault state"
    },
    {
      "code": 6019,
      "name": "NonexistentAsset",
      "msg": "Non-existent Asset"
    },
    {
      "code": 6020,
      "name": "InvalidLpMint",
      "msg": "Invalid LP Mint"
    },
    {
      "code": 6021,
      "name": "DepositExceedsUserCap",
      "msg": "Deposit exceeds user cap"
    },
    {
      "code": 6022,
      "name": "DepositExceedsAssetCap",
      "msg": "Deposit exceeds asset cap"
    },
    {
      "code": 6023,
      "name": "CannotWithdrawWithoutLpTokens",
      "msg": "Cannot redeem without LP tokens"
    },
    {
      "code": 6024,
      "name": "DataTypeMismatch",
      "msg": "Data type mismatch"
    },
    {
      "code": 6025,
      "name": "SlippageTooHigh",
      "msg": "Slippage too high"
    },
    {
      "code": 6026,
      "name": "DualSidedExcesssNotPossible",
      "msg": "Dual-sided excesss is not possible"
    }
  ]
};
