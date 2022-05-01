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
          "name": "lpAta",
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
          "name": "slippageTolerance",
          "type": "u16"
        }
      ]
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
      "name": "ErrorCode",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "PublicKeyMismatch"
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
            "name": "StatementFalse"
          },
          {
            "name": "MathError"
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
            "name": "DataTypeMismatch"
          },
          {
            "name": "SlippageTooHigh"
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
          "name": "lpAta",
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
          "name": "slippageTolerance",
          "type": "u16"
        }
      ]
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
      "name": "ErrorCode",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "PublicKeyMismatch"
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
            "name": "StatementFalse"
          },
          {
            "name": "MathError"
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
            "name": "DataTypeMismatch"
          },
          {
            "name": "SlippageTooHigh"
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
  ]
};
