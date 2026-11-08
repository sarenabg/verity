// Reading from NEAR: free "view" calls over JSON-RPC. Works in the browser and on the server.

import { LIVE } from "./config";

export async function view<T>(contract: string, method: string, args: object = {}): Promise<T> {
  const res = await fetch(LIVE.rpc, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "verity",
      method: "query",
      params: { request_type: "call_function", finality: "optimistic", account_id: contract, method_name: method, args_base64: b64(JSON.stringify(args)) },
    }),
    signal: AbortSignal.timeout(12_000),
  });
  const json = await res.json();
  if (json.error || json.result?.error) throw new Error(json.error?.cause?.name || json.result?.error || "RPC error");
  return JSON.parse(new TextDecoder().decode(new Uint8Array(json.result.result))) as T;
}

function b64(s: string): string {
  if (typeof btoa === "function") return btoa(unescape(encodeURIComponent(s)));
  return Buffer.from(s, "utf8").toString("base64");
}

// ---- Shapes returned by contracts/verity_market ----

export type ChainStatus =
  | "Open"
  | { Judging: { requester: string } }
  | { Proposed: { requester: string; verdict: boolean; proposed_at_ns: number; evidence: string } }
  | { Disputed: { requester: string; disputer: string; verdict: boolean; evidence: string } }
  | { Settled: { verdict: boolean; evidence: string } };

export type ChainClaim = { id: string; question: string; yes: string; no: string; price_bps: number; volume: string; status: ChainStatus };
export type ChainAccount = { credit: string; positions: { claim: string; yes: string; no: string }[] };
export type ChainConfig = { owner: string; token: string; judge: string; panel: string; ruling_bond: string; dispute_bond: string; dispute_window_ns: number; min_bet: string };

/** The judge stores its ruling as compact JSON in `evidence`. */
export type Evidence = { r: string; v?: [model: string, verdict: string, kind: string | null, signer: string | null, writer?: "near-ai" | "demo"][] };

export function parseEvidence(s: string): Evidence {
  try {
    const e = JSON.parse(s);
    if (typeof e?.r === "string") return e;
  } catch {}
  return { r: s };
}

export async function listClaims(): Promise<ChainClaim[]> {
  const out: ChainClaim[] = [];
  for (let from = 0; ; from += 100) {
    const page = await view<ChainClaim[]>(LIVE.contract, "list_claims", { from_index: from, limit: 100 });
    out.push(...page);
    if (page.length < 100) return out;
  }
}

export const getAccount = (account: string) => view<ChainAccount>(LIVE.contract, "get_account", { account });
export const getHistory = (claim: string) => view<[number, number][]>(LIVE.contract, "get_history", { claim });
export const getConfig = () => view<ChainConfig>(LIVE.contract, "get_config");
export const usdcBalance = (account: string) => view<string>(LIVE.usdc, "ft_balance_of", { account_id: account });
export const usdcRegistered = async (account: string) => (await view<object | null>(LIVE.usdc, "storage_balance_of", { account_id: account })) !== null;
