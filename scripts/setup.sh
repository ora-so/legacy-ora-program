#!/usr/bin/env bash
echo installing root packages
yarn install
anchor build
yarn cp-idl

echo installing sdk packages
cd sdk
yarn install
yarn build

echo running program tests
cd ..
anchor test

echo installed all packages ✅