"use client";

import { useEffect, useSyncExternalStore } from "react";
import { getAccount, getConfig, getHistory, listClaims, usdcBalance, usdcRegistered, type ChainAccount, type ChainClaim, type ChainConfig } from "./chain";
import { fromUnits, LIVE, toUnits } from "./config";
import { CLAIM_BY_ID } from "./content";
import { quoteBuy, quoteSell, wordingOf, type Pool, type Side } from "./market";
import type { Proof } from "./nearai";
import { connectedAccount, onAccountChange, ONE_YOCTO, send, USDC_STORAGE } from "./wallet";

// Live mode: the markets live in contracts/verity_market on NEAR mainnet.
// This store polls the contract and sends transactions through the wallet.

export type LiveState = {
  status: "idle" | "loading" | "ready" | "error";
  error?: string;
  config: ChainConfig | null;
  claims: Record<string, ChainClaim>;
  history: Record<string, [number, number][]>;
  account: string | null;
  view: ChainAccount | null;
  usdc: number | null; // wallet balance
  registered: boolean | null; // USDC storage registered
  aiText: Record<string, { wording: string; text: string; model?: string; proof?: Proof }>;
  pending: string | null; // what the wallet is busy with
  lastRewrite?: { claimId: string; at: number };
};

let state: LiveState = { status: "idle", config: null, claims: {}, history: {}, account: null, view: null, usdc: null, registered: null, aiText: {}, pending: null };
const SERVER: LiveState = state;
const listeners = new Set<() => void>();
const set = (patch: Partial<LiveState>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};
export const getLive = () => state;

let started = false;
let timer: ReturnType<typeof setInterval> | null = null;

async function start() {
  if (started || !LIVE.contract) return;
  started = true;
  set({ status: "loading" });
  const account = await connectedAccount().catch(() => null);
  set({ account });
  void onAccountChange((a) => {
    if (a !== state.account) {
      set({ account: a, view: null, usdc: null, registered: null });
      void refresh();
    }
  });
  await refresh();
  timer = setInterval(() => void refresh(), 8000);
}

export async function refresh() {
  try {
    const [claims, config] = await Promise.all([listClaims(), state.config ? Promise.resolve(state.config) : getConfig()]);
    const patch: Partial<LiveState> = { status: "ready", error: undefined, config, claims: Object.fromEntries(claims.map((c) => [c.id, c])) };
    if (state.account) {
      const [view, bal, reg] = await Promise.all([getAccount(state.account), usdcBalance(state.account), usdcRegistered(state.account)]);
      Object.assign(patch, { view, usdc: fromUnits(bal), registered: reg });
    }
    set(patch);
  } catch (e) {
    set({ status: state.status === "ready" ? "ready" : "error", error: (e as Error).message });
  }
}

export async function loadHistory(claimId: string) {
  try {
    const h = await getHistory(claimId);
    set({ history: { ...state.history, [claimId]: h } });
  } catch {}
}

export function useLive(enabled: boolean): LiveState {
  useEffect(() => {
    if (enabled) void start();
  }, [enabled]);
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => SERVER,
  );
}

export function stopLive() {
  if (timer) clearInterval(timer);
  timer = null;
  started = false;
}

// ---------- reading helpers ----------

export function livePool(c: ChainClaim): Pool {
  return { yes: fromUnits(c.yes), no: fromUnits(c.no) };
}

export function livePrice(c: ChainClaim): number {
  if (typeof c.status === "object" && "Settled" in c.status) return c.status.Settled.verdict ? 1 : 0;
  return c.price_bps / 10_000;
}

// ---------- actions (each asks the wallet to sign) ----------

type Result = { ok: true; rewritten?: boolean; note?: string } | { ok: false; error: string };

async function run(label: string, fn: () => Promise<unknown>): Promise<Result> {
  if (!state.account) return { ok: false, error: "Connect a wallet first." };
  set({ pending: label });
  try {
    await fn();
    await refresh();
    return { ok: true };
  } catch (e) {
    const msg = (e as Error)?.message || String(e);
    return { ok: false, error: /reject|cancel|closed|denied/i.test(msg) ? "Cancelled in your wallet." : msg.slice(0, 160) };
  } finally {
    set({ pending: null });
  }
}

const ftCall = (amount: bigint, msg: object) => ({
  receiverId: LIVE.usdc,
  methodName: "ft_transfer_call",
  args: { receiver_id: LIVE.contract, amount: amount.toString(), msg: JSON.stringify(msg) },
  deposit: ONE_YOCTO,
  gasTgas: 100,
});

export async function liveBuy(claimId: string, side: Side, usdc: number): Promise<Result> {
  const c = state.claims[claimId];
  if (!c) return { ok: false, error: "This fact isn't live yet." };
  const before = livePrice(c);
  // Accept up to 3% worse than quoted, in case someone else bets first.
  const minShares = toUnits(quoteBuy(livePool(c), side, usdc).shares * 0.97);
  const r = await run("Confirm your bet in your wallet", () => send([ftCall(toUnits(usdc), { buy: { claim: claimId, side, min_shares: minShares.toString() } })]));
  return r.ok ? { ...r, rewritten: crossed(claimId, before) } : r;
}

export async function liveSell(claimId: string, side: Side, shares: number): Promise<Result> {
  const c = state.claims[claimId];
  if (!c) return { ok: false, error: "Unknown fact." };
  const before = livePrice(c);
  const minOut = toUnits(quoteSell(livePool(c), side, shares).amount * 0.97);
  const held = state.view?.positions.find((p) => p.claim === claimId)?.[side] ?? "0";
  // Selling everything: send the exact on-chain amount so nothing is left behind by rounding.
  const units = Math.abs(fromUnits(held) - shares) < 1e-6 ? held : toUnits(shares).toString();
  const r = await run("Confirm in your wallet", () =>
    send([{ receiverId: LIVE.contract, methodName: "sell", args: { claim: claimId, side, shares: units, min_out: minOut.toString() }, gasTgas: 50 }]),
  );
  return r.ok ? { ...r, rewritten: crossed(claimId, before) } : r;
}

export async function liveRequest(claimId: string): Promise<Result> {
  const bond = BigInt(state.config?.ruling_bond ?? "0");
  const r = await run("Confirm the deposit in your wallet", () => send([ftCall(bond, { request_ruling: { claim: claimId } })]));
  if (r.ok) void nudgeJudge(claimId, false);
  return r;
}

export async function liveDispute(claimId: string): Promise<Result> {
  const bond = BigInt(state.config?.dispute_bond ?? "0");
  const r = await run("Confirm the deposit in your wallet", () => send([ftCall(bond, { dispute: { claim: claimId } })]));
  if (r.ok) void nudgeJudge(claimId, true);
  return r;
}

/** Ask our server to run the AI judge for a fact that is waiting for a ruling. Safe to call twice. */
export async function nudgeJudge(claimId: string, panel: boolean): Promise<Result> {
  try {
    const res = await fetch("/api/live/judge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ claimId, panel }) });
    const out = await res.json();
    await refresh();
    return res.ok ? { ok: true } : { ok: false, error: out.error ?? "The judge is offline." };
  } catch {
    return { ok: false, error: "The judge is offline." };
  }
}

export const liveFinalize = (claimId: string) =>
  run("Confirm in your wallet", () => send([{ receiverId: LIVE.contract, methodName: "finalize", args: { claim: claimId }, gasTgas: 30 }]));

export const liveCollect = (claimId: string) =>
  run("Confirm in your wallet", () =>
    send([
      { receiverId: LIVE.contract, methodName: "redeem", args: { claim: claimId }, gasTgas: 30 },
      { receiverId: LIVE.contract, methodName: "withdraw", args: {}, gasTgas: 60 },
    ]),
  );

export const liveWithdraw = () => run("Confirm in your wallet", () => send([{ receiverId: LIVE.contract, methodName: "withdraw", args: {}, gasTgas: 60 }]));

/** Testnet only: the test token (contracts/mock_usdc) lets anyone mint up to 1,000 test dollars. */
export const liveMintTestDollars = (usdc = 20) =>
  run("Confirm in your wallet", () =>
    send([{ receiverId: LIVE.usdc, methodName: "mint", args: { account_id: state.account, amount: toUnits(usdc).toString() }, gasTgas: 30 }]),
  );

export const liveRegisterUsdc = () =>
  run("Confirm in your wallet", () =>
    send([{ receiverId: LIVE.usdc, methodName: "storage_deposit", args: { account_id: state.account, registration_only: true }, deposit: USDC_STORAGE, gasTgas: 30 }]),
  );

/** Did the last trade move this fact across a wording line? If so, ask the AI writer. */
function crossed(claimId: string, before: number): boolean {
  const c = state.claims[claimId];
  if (!c) return false;
  const after = livePrice(c);
  if (wordingOf(before) === wordingOf(after)) return false;
  set({ lastRewrite: { claimId, at: Date.now() } });
  void loadHistory(claimId);
  void askWriter(claimId, after);
  return true;
}

async function askWriter(claimId: string, price: number) {
  if (!CLAIM_BY_ID[claimId]) return;
  try {
    const res = await fetch("/api/write", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ claimId, price }) });
    const out = await res.json();
    if (out.writer === "near-ai") set({ aiText: { ...state.aiText, [claimId]: { wording: wordingOf(price), text: out.text, model: out.model, proof: out.proof } } });
  } catch {}
}
