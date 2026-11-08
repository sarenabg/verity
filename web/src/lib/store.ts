"use client";

import { useSyncExternalStore } from "react";
import { ARTICLES, CLAIM_BY_ID, CLAIMS, type Claim } from "./content";
import { priceOf, quoteBuy, quoteSell, seedPool, wordingOf, type Pool, type Side, type Wording } from "./market";
import type { Proof } from "./nearai";

// Everything the demo remembers lives here, in the visitor's browser
// (localStorage). Every visitor gets their own world with $1,000 of play money.
// The same rules run on-chain in contracts/verity_market.

export const START_BALANCE = 1000;
export const RULING_BOND = 10; // asking for a ruling
export const DISPUTE_BOND = 20; // disputing a ruling
export const DISPUTE_HOURS = 48;

export type Position = { yes: number; no: number; spent: number };

export type Trade = {
  id: string;
  t: number;
  claimId: string;
  kind: "buy" | "sell" | "payout";
  side: Side;
  amount: number;
  shares: number;
  before: number;
  after: number;
  paidWith?: string; // "0.0061 ETH" when paid from another coin
};

export type Revision = { id: string; t: number; slug: string; claimId: string; from: Wording; to: Wording; price: number; writer: "near-ai" | "demo" };

export type Vote = { model: string; verdict: Verdict; reason: string; writer: "near-ai" | "demo"; proof?: Proof };
export type Verdict = "true" | "false" | "unsettled";

export type Ruling = {
  stage: "judging" | "proposed" | "panel" | "final" | "unsettled";
  verdict?: Verdict;
  reason?: string;
  votes?: Vote[];
  panelVotes?: Vote[];
  requestedAt: number;
  windowEnds?: number;
  disputed?: boolean;
  outcome?: string; // one line for the history
};

export type AiText = { wording: Wording; text: string; writer: "near-ai" | "demo"; model?: string; proof?: Proof };

export type State = {
  v: 1;
  balance: number;
  pools: Record<string, Pool>;
  positions: Record<string, Position>;
  trades: Trade[];
  revisions: Revision[];
  rulings: Record<string, Ruling>;
  settled: Record<string, boolean>; // claimId → true/false once final
  aiText: Record<string, AiText>;
  points: Record<string, { t: number; p: number }[]>; // price points from trades
  lastRewrite?: { claimId: string; at: number };
};

const KEY = "verity:v1";

export function initialState(): State {
  return {
    v: 1,
    balance: START_BALANCE,
    pools: Object.fromEntries(CLAIMS.map((c) => [c.id, seedPool(c.start, c.depth)])),
    positions: {},
    trades: [],
    revisions: [],
    rulings: {},
    settled: {},
    aiText: {},
    points: {},
  };
}

// ---------- the store ----------

const SERVER_STATE = initialState();
let state: State = SERVER_STATE;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw) as State;
      if (saved.v === 1) {
        // Keep pools for any claims added since the save.
        state = { ...initialState(), ...saved, pools: { ...initialState().pools, ...saved.pools } };
      }
    }
  } catch {
    // Private window or blocked storage: start fresh, nothing is saved.
  }
}

function set(next: State) {
  state = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  load();
  listeners.add(l);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      loaded = false;
      load();
      l();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}

export function useVerity(): State {
  return useSyncExternalStore(
    subscribe,
    () => {
      load();
      return state;
    },
    () => SERVER_STATE,
  );
}

export function getState(): State {
  load();
  return state;
}

// ---------- reading ----------

export function priceNow(s: State, claimId: string): number {
  if (claimId in s.settled) return s.settled[claimId] ? 1 : 0;
  return priceOf(s.pools[claimId]);
}

/** The wording the page shows for a fact right now. */
export function wordingNow(s: State, claimId: string): Wording {
  if (claimId in s.settled) return s.settled[claimId] ? "yes" : "no";
  return wordingOf(priceNow(s, claimId));
}

export function sentenceNow(s: State, claim: Claim): { text: string; ai?: AiText } {
  const w = wordingNow(s, claim.id);
  const ai = s.aiText[claim.id];
  if (ai && ai.wording === w) return { text: ai.text, ai };
  return { text: claim[w] };
}

export function stakedOn(s: State, claim: Claim): number {
  const mine = s.trades.filter((t) => t.claimId === claim.id && t.kind === "buy").reduce((a, t) => a + t.amount, 0);
  return claim.volume + mine;
}

/** 30 days of made-up but stable history, ending at the starting price, then real trades. */
export function historyOf(s: State, claim: Claim): { t: number; p: number }[] {
  const day = 86_400_000;
  const firstTrade = s.points[claim.id]?.[0]?.t ?? Date.now();
  const end = firstTrade - 60_000;
  const rand = mulberry32(hash(claim.id));
  const logit = (p: number) => Math.log(p / (1 - p));
  const unlogit = (x: number) => 1 / (1 + Math.exp(-x));
  const pts: { t: number; p: number }[] = [];
  let x = logit(claim.start);
  const vol = claim.depth > 5000 ? 0.04 : 0.16;
  for (let i = 0; i < 30; i++) {
    pts.push({ t: end - i * day, p: unlogit(x) });
    x += (rand() - 0.5) * 2 * vol + (i < 12 ? (rand() - 0.5) * vol : 0);
  }
  pts.reverse();
  return [...pts, ...(s.points[claim.id] ?? [])];
}

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const uid = () => Math.random().toString(36).slice(2, 10);

// ---------- actions ----------

export type BetResult = { ok: true; trade: Trade; rewritten: boolean } | { ok: false; error: string };

export function buy(claimId: string, side: Side, amount: number, paidWith?: string): BetResult {
  const s = getState();
  if (claimId in s.settled) return { ok: false, error: "This fact is settled." };
  if (!(amount > 0)) return { ok: false, error: "Enter an amount." };
  if (amount > s.balance + 1e-9) return { ok: false, error: "Not enough money. Add some first." };
  const pool = s.pools[claimId];
  const before = priceOf(pool);
  const q = quoteBuy(pool, side, amount);
  const pos = s.positions[claimId] ?? { yes: 0, no: 0, spent: 0 };
  const trade: Trade = { id: uid(), t: Date.now(), claimId, kind: "buy", side, amount, shares: q.shares, before, after: q.priceAfter, paidWith };
  const next: State = {
    ...s,
    balance: s.balance - amount,
    pools: { ...s.pools, [claimId]: q.pool },
    positions: { ...s.positions, [claimId]: { ...pos, [side]: pos[side] + q.shares, spent: pos.spent + amount } },
    trades: [trade, ...s.trades],
    points: { ...s.points, [claimId]: [...(s.points[claimId] ?? []), { t: trade.t, p: q.priceAfter }] },
  };
  const rewritten = afterMove(next, claimId, before, q.priceAfter);
  return { ok: true, trade, rewritten };
}

export function sell(claimId: string, side: Side, shares: number): BetResult {
  const s = getState();
  const pos = s.positions[claimId];
  if (!pos || pos[side] < shares - 1e-9 || !(shares > 0)) return { ok: false, error: "You don't hold those shares." };
  if (claimId in s.settled) return { ok: false, error: "This fact is settled." };
  const pool = s.pools[claimId];
  const before = priceOf(pool);
  const q = quoteSell(pool, side, Math.min(shares, pos[side]));
  const left = pos[side] - shares;
  const trade: Trade = { id: uid(), t: Date.now(), claimId, kind: "sell", side, amount: q.amount, shares, before, after: q.priceAfter };
  const share = pos[side] > 0 ? shares / pos[side] : 1;
  const next: State = {
    ...s,
    balance: s.balance + q.amount,
    pools: { ...s.pools, [claimId]: q.pool },
    positions: { ...s.positions, [claimId]: { ...pos, [side]: left < 1e-9 ? 0 : left, spent: pos.spent * (1 - share) } },
    trades: [trade, ...s.trades],
    points: { ...s.points, [claimId]: [...(s.points[claimId] ?? []), { t: trade.t, p: q.priceAfter }] },
  };
  const rewritten = afterMove(next, claimId, before, q.priceAfter);
  return { ok: true, trade, rewritten };
}

/** Save the new state; if the fact crossed a line, record a page rewrite and ask the AI writer. */
function afterMove(next: State, claimId: string, before: number, after: number): boolean {
  const from = wordingOf(before);
  const to = wordingOf(after);
  if (from === to) {
    set(next);
    return false;
  }
  const claim = CLAIM_BY_ID[claimId];
  const rev: Revision = { id: uid(), t: Date.now(), slug: claim.article, claimId, from, to, price: after, writer: "demo" };
  set({ ...next, revisions: [rev, ...next.revisions], lastRewrite: { claimId, at: Date.now() } });
  void askWriter(claim, after, rev.id);
  return true;
}

async function askWriter(claim: Claim, price: number, revId: string) {
  try {
    const res = await fetch("/api/write", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ claimId: claim.id, price }) });
    if (!res.ok) return;
    const out = (await res.json()) as { text: string; writer: "near-ai" | "demo"; model?: string; proof?: Proof };
    if (out.writer !== "near-ai") return;
    const s = getState();
    if (wordingNow(s, claim.id) !== wordingOf(price)) return; // the market moved on meanwhile
    set({
      ...s,
      aiText: { ...s.aiText, [claim.id]: { wording: wordingOf(price), text: out.text, writer: out.writer, model: out.model, proof: out.proof } },
      revisions: s.revisions.map((r) => (r.id === revId ? { ...r, writer: "near-ai" } : r)),
      lastRewrite: { claimId: claim.id, at: Date.now() },
    });
  } catch {
    // Offline: the prewritten sentence stays.
  }
}

export function addMoney(amount: number, paidWith?: string) {
  const s = getState();
  set({
    ...s,
    balance: s.balance + amount,
    trades: [{ id: uid(), t: Date.now(), claimId: "", kind: "payout", side: "yes", amount, shares: 0, before: 0, after: 0, paidWith }, ...s.trades],
  });
}

export function resetDemo() {
  set(initialState());
}

// ---------- settling a fact: AI judge, then a dispute window ----------

type JudgeReply = { verdict: Verdict; reason: string; votes: Vote[] };

async function callJudge(claimId: string, panel: boolean): Promise<JudgeReply> {
  const res = await fetch("/api/judge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ claimId, panel }) });
  if (!res.ok) throw new Error("The judge is unavailable. Try again.");
  return res.json();
}

export async function requestRuling(claimId: string): Promise<{ ok: boolean; error?: string }> {
  const s = getState();
  if (claimId in s.settled) return { ok: false, error: "Already settled." };
  if (s.balance < RULING_BOND) return { ok: false, error: `You need ${RULING_BOND} dollars for the deposit.` };
  set({ ...s, balance: s.balance - RULING_BOND, rulings: { ...s.rulings, [claimId]: { stage: "judging", requestedAt: Date.now() } } });
  try {
    const r = await callJudge(claimId, false);
    const now = getState();
    if (r.verdict === "unsettled") {
      set({
        ...now,
        balance: now.balance + RULING_BOND,
        rulings: { ...now.rulings, [claimId]: { stage: "unsettled", verdict: r.verdict, reason: r.reason, votes: r.votes, requestedAt: Date.now(), outcome: "Not enough evidence yet. Deposit returned; the market stays open." } },
      });
    } else {
      set({
        ...now,
        rulings: { ...now.rulings, [claimId]: { stage: "proposed", verdict: r.verdict, reason: r.reason, votes: r.votes, requestedAt: Date.now(), windowEnds: Date.now() + DISPUTE_HOURS * 3_600_000 } },
      });
    }
    return { ok: true };
  } catch (e) {
    const now = getState();
    const rulings = { ...now.rulings };
    delete rulings[claimId];
    set({ ...now, balance: now.balance + RULING_BOND, rulings });
    return { ok: false, error: (e as Error).message };
  }
}

export async function dispute(claimId: string): Promise<{ ok: boolean; error?: string }> {
  const s = getState();
  const r = s.rulings[claimId];
  if (!r || r.stage !== "proposed") return { ok: false, error: "Nothing to dispute." };
  if (s.balance < DISPUTE_BOND) return { ok: false, error: `You need ${DISPUTE_BOND} dollars for the deposit.` };
  set({ ...s, balance: s.balance - DISPUTE_BOND, rulings: { ...s.rulings, [claimId]: { ...r, stage: "panel", disputed: true } } });
  try {
    const p = await callJudge(claimId, true);
    const now = getState();
    const base = { ...now.rulings[claimId], panelVotes: p.votes, reason: p.reason };
    if (p.verdict === r.verdict) {
      // The panel agrees with the first ruling: dispute deposit is lost, the fact settles.
      set({ ...now, rulings: { ...now.rulings, [claimId]: { ...base, stage: "final", outcome: "The panel agreed with the judge. The dispute deposit was lost." } } });
      settle(claimId, p.verdict === "true");
    } else if (p.verdict === "unsettled") {
      set({
        ...now,
        balance: now.balance + DISPUTE_BOND + RULING_BOND,
        rulings: { ...now.rulings, [claimId]: { ...base, stage: "unsettled", verdict: "unsettled", outcome: "The panel couldn't agree. Deposits returned; the market stays open." } },
      });
    } else {
      set({
        ...now,
        balance: now.balance + DISPUTE_BOND + RULING_BOND,
        rulings: { ...now.rulings, [claimId]: { ...base, stage: "final", verdict: p.verdict, outcome: "The panel overturned the judge. The disputer won the request deposit." } },
      });
      settle(claimId, p.verdict === "true");
    }
    return { ok: true };
  } catch (e) {
    const now = getState();
    set({ ...now, balance: now.balance + DISPUTE_BOND, rulings: { ...now.rulings, [claimId]: r } });
    return { ok: false, error: (e as Error).message };
  }
}

/** Demo only: jump past the 48-hour dispute window. */
export function skipWindow(claimId: string) {
  const s = getState();
  const r = s.rulings[claimId];
  if (!r || r.stage !== "proposed" || r.verdict === "unsettled" || !r.verdict) return;
  set({ ...s, balance: s.balance + RULING_BOND, rulings: { ...s.rulings, [claimId]: { ...r, stage: "final", outcome: "No one disputed. Deposit returned." } } });
  settle(claimId, r.verdict === "true");
}

/** Pay $1 per winning share and freeze the market. */
function settle(claimId: string, truth: boolean) {
  const s = getState();
  const pos = s.positions[claimId];
  const win = pos ? (truth ? pos.yes : pos.no) : 0;
  const before = priceOf(s.pools[claimId]);
  const trades = win > 0 ? [{ id: uid(), t: Date.now(), claimId, kind: "payout" as const, side: (truth ? "yes" : "no") as Side, amount: win, shares: win, before, after: truth ? 1 : 0 }, ...s.trades] : s.trades;
  const claim = CLAIM_BY_ID[claimId];
  const from = wordingOf(before);
  const to: Wording = truth ? "yes" : "no";
  const revisions = from !== to ? [{ id: uid(), t: Date.now(), slug: claim.article, claimId, from, to, price: truth ? 1 : 0, writer: "demo" as const }, ...s.revisions] : s.revisions;
  set({
    ...s,
    balance: s.balance + win,
    settled: { ...s.settled, [claimId]: truth },
    positions: { ...s.positions, [claimId]: { yes: 0, no: 0, spent: 0 } },
    trades,
    revisions,
    points: { ...s.points, [claimId]: [...(s.points[claimId] ?? []), { t: Date.now(), p: truth ? 1 : 0 }] },
    lastRewrite: from !== to ? { claimId, at: Date.now() } : s.lastRewrite,
  });
}

export const ARTICLE_COUNT = ARTICLES.length;
