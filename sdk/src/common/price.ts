import { Cluster } from "@solana/web3.js";
import { TokenProvider, asStrings, PubKeyString } from "./token";

export enum Currency {
  USD = "usd",
}

// https://api.coingecko.com/api/v3/coins/list
export class PriceClient {
  BASE_URI: string = "https://api.coingecko.com/api/v3";
  PRICE_ENDPOINT: string = "simple/price";

  tokenProvider: TokenProvider;

  constructor() {
    this.tokenProvider = new TokenProvider();
  }

  fetchPrice = async (
    mint: PubKeyString,
    cluster: Cluster = "mainnet-beta",
    currency: Currency = Currency.USD
  ) => {
    return this.fetchPrices([mint], cluster, currency);
  };

  // ordering of prices?
  fetchPrices = async (
    mints: PubKeyString[],
    cluster: Cluster = "mainnet-beta",
    currency: Currency = Currency.USD
  ) => {
    const symbols = this.tokenProvider.fetchSymbols(asStrings(mints), cluster);

    // todo: map between tokens names/symbols to coingecko ids
    // maintain our own internal data?
    const uri = `${this.BASE_URI}/${this.PRICE_ENDPOINT}?ids=${symbols.join(
      ","
    )}&vs_currencies=${currency}`;

    return fetch(uri)
      .then((json) => json)
      .then((result) => result);
  };
}

// compute the relative amount of each based on pricing?
// const investableA = await this.priceClient.fetchPrice(
//   poolConfig.tokenA,
//   cluster
// );
