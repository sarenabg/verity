import "server-only";

// NEAR Intents 1Click API: turns a coin on any chain into USDC on NEAR.
// Docs: https://docs.near-intents.org/integration/distribution-channels/1click-api

export const ONECLICK = "https://1click.chaindefuser.com/v0";
const HEADERS: Record<string, string> = { "Content-Type": "application/json", "User-Agent": "verity/0.1" };
// Optional partner key (removes the 0.2% no-key fee). https://partners.near-intents.org
if (process.env.ONECLICK_JWT) HEADERS.Authorization = `Bearer ${process.env.ONECLICK_JWT}`;

export type Token = { assetId: string; blockchain: string; symbol: string; decimals: number; price: number };
let cache: { at: number; tokens: Token[] } | null = null;

export async function tokens(): Promise<Token[]> {
  if (cache && Date.now() - cache.at < 5 * 60_000) return cache.tokens;
  const res = await fetch(`${ONECLICK}/tokens`, { headers: HEADERS, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`tokens ${res.status}`);
  cache = { at: Date.now(), tokens: (await res.json()) as Token[] };
  return cache.tokens;
}

export async function findPair(symbol: string, chain: string) {
  const list = await tokens();
  const from = list.find((t) => t.blockchain === chain && t.symbol === symbol);
  const usdc = list.find((t) => t.blockchain === "near" && t.symbol === "USDC");
  return { from, usdc };
}

export type QuoteBody = {
  dry: boolean;
  originAsset: string;
  destinationAsset: string;
  usd: number;
  recipient: string;
  refundTo: string;
  refundType: "ORIGIN_CHAIN" | "INTENTS";
};

/** "The recipient must receive exactly $usd of USDC on NEAR." */
export async function quote(b: QuoteBody) {
  const res = await fetch(`${ONECLICK}/quote`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({
      dry: b.dry,
      swapType: "EXACT_OUTPUT",
      slippageTolerance: 100,
      originAsset: b.originAsset,
      depositType: "ORIGIN_CHAIN",
      destinationAsset: b.destinationAsset,
      amount: String(Math.round(b.usd * 1e6)),
      recipient: b.recipient,
      recipientType: "DESTINATION_CHAIN",
      refundTo: b.refundTo,
      refundType: b.refundType,
      deadline: new Date(Date.now() + 30 * 60_000).toISOString(),
    }),
    signal: AbortSignal.timeout(12_000),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message || `quote ${res.status}`);
  return json.quote as { depositAddress?: string; depositMemo?: string; amountInFormatted: string; timeEstimate?: number; deadline?: string };
}

export async function status(depositAddress: string) {
  const res = await fetch(`${ONECLICK}/status?depositAddress=${encodeURIComponent(depositAddress)}`, { headers: HEADERS, signal: AbortSignal.timeout(8000) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message || `status ${res.status}`);
  return json as { status: string };
}
