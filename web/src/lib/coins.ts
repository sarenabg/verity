// Coins people can bet with. NEAR Intents turns any of them into dollars
// (USDC) on NEAR. `chain` and `symbol` match the 1Click API's token list.

export type Coin = { symbol: string; chain: string; name: string; chainName: string; approxUsd: number };

export const COINS: Coin[] = [
  { symbol: "USDC", chain: "base", name: "USD Coin", chainName: "Base", approxUsd: 1 },
  { symbol: "ETH", chain: "eth", name: "Ether", chainName: "Ethereum", approxUsd: 3200 },
  { symbol: "BTC", chain: "btc", name: "Bitcoin", chainName: "Bitcoin", approxUsd: 98000 },
  { symbol: "SOL", chain: "sol", name: "Solana", chainName: "Solana", approxUsd: 180 },
  { symbol: "NEAR", chain: "near", name: "NEAR", chainName: "NEAR", approxUsd: 3 },
  { symbol: "USDT", chain: "arb", name: "Tether", chainName: "Arbitrum", approxUsd: 1 },
  { symbol: "XRP", chain: "xrp", name: "XRP", chainName: "XRP Ledger", approxUsd: 2.3 },
  { symbol: "DOGE", chain: "doge", name: "Dogecoin", chainName: "Dogecoin", approxUsd: 0.2 },
  { symbol: "ZEC", chain: "zec", name: "Zcash", chainName: "Zcash", approxUsd: 50 },
];

export function coinLogo(c: Coin): string {
  return `/icons/coins/${c.symbol}.svg`;
}

export function chainLogo(c: Coin): string {
  return `/icons/chains/${c.chain}.svg`;
}

export function findCoin(symbol: string, chain?: string): Coin | undefined {
  return COINS.find((c) => c.symbol === symbol && (!chain || c.chain === chain));
}
