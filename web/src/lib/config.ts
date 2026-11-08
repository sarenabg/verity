// Live-mode settings. All public (they're in the browser), so no secrets here.
// Live mode is offered only when NEXT_PUBLIC_VERITY_CONTRACT is set.

export const LIVE = {
  contract: process.env.NEXT_PUBLIC_VERITY_CONTRACT || "",
  /** Native USDC on NEAR mainnet (6 decimals). */
  usdc: process.env.NEXT_PUBLIC_USDC || "17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1",
  rpc: process.env.NEXT_PUBLIC_NEAR_RPC || "https://free.rpc.fastnear.com",
  network: (process.env.NEXT_PUBLIC_NEAR_NETWORK || "mainnet") as "mainnet" | "testnet",
  explorer: process.env.NEXT_PUBLIC_EXPLORER || "https://nearblocks.io",
};

export const liveAvailable = () => Boolean(LIVE.contract);

/** Live on testnet uses test dollars; say so everywhere Live is named. */
export const TESTNET = LIVE.network === "testnet";
export const LIVE_NAME = TESTNET ? "Live · testnet" : "Live";

export const USDC_DECIMALS = 6;
export const toUnits = (usdc: number) => BigInt(Math.round(usdc * 10 ** USDC_DECIMALS));
export const fromUnits = (units: string | number | bigint) => Number(units) / 10 ** USDC_DECIMALS;
