export type BucketVault = {
  "version": "0.1.0",
  "name": "bucket_vault",
  "instructions": [
    {
      "name": "initialize",
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
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "vaultBump",
          "type": "u8"
        }
      ]
    },
    {
      "name": "deposit",
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
          "name": "userTokenA",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userTokenB",
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
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "tokenAAmount",
          "type": "u64"
        },
        {
          "name": "tokenBAmount",
          "type": "u64"
        },
        {
          "name": "minMintAmount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "withdraw",
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
          "name": "userTokenA",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userTokenB",
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
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "poolTokenAmount",
          "type": "u64"
        },
        {
          "name": "minimumTokenAAmount",
          "type": "u64"
        },
        {
          "name": "minimumTokenBAmount",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
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
            "name": "depositNonce",
            "type": "u64"
          },
          {
            "name": "withdrawalNonce",
            "type": "u64"
          }
        ]
      }
    }
  ],
  "types": [
    {
      "name": "ErrorCode",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "BaseVaultError"
          },
          {
            "name": "InsufficientTokenBalance"
          }
        ]
      }
    }
  ]
};

export const IDL: BucketVault = {
  "version": "0.1.0",
  "name": "bucket_vault",
  "instructions": [
    {
      "name": "initialize",
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
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "vaultBump",
          "type": "u8"
        }
      ]
    },
    {
      "name": "deposit",
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
          "name": "userTokenA",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userTokenB",
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
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "tokenAAmount",
          "type": "u64"
        },
        {
          "name": "tokenBAmount",
          "type": "u64"
        },
        {
          "name": "minMintAmount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "withdraw",
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
          "name": "userTokenA",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userTokenB",
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
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "poolTokenAmount",
          "type": "u64"
        },
        {
          "name": "minimumTokenAAmount",
          "type": "u64"
        },
        {
          "name": "minimumTokenBAmount",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
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
            "name": "depositNonce",
            "type": "u64"
          },
          {
            "name": "withdrawalNonce",
            "type": "u64"
          }
        ]
      }
    }
  ],
  "types": [
    {
      "name": "ErrorCode",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "BaseVaultError"
          },
          {
            "name": "InsufficientTokenBalance"
          }
        ]
      }
    }
  ]
};
