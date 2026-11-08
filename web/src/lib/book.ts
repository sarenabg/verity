"use client";

// One interface for the screens, whether the visitor is in Demo (play money,
// lib/store.ts) or Live (real USDC on NEAR, lib/live.ts).

import { parseEvidence, type ChainClaim } from "./chain";
import { fromUnits } from "./config";
import { CLAIM_BY_ID, CLAIMS, type Claim } from "./content";
import {
  getLive,
  liveBuy,
  liveCollect,
  liveDispute,
  liveFinalize,
  livePool,
  livePrice,
  liveRequest,
  liveSell,
  liveWithdraw,
  nudgeJudge,
  useLive,
  type LiveState,
} from "./live";
import { money as dollars, wordingOf, type Pool, type Side, type Wording } from "./market";
import { useMode, type Mode } from "./mode";
import * as demo from "./store";
import type { Revision, Ruling, State as DemoState, Vote } from "./store";

export type Result = { ok: true; rewritten?: boolean } | { ok: false; error: string };

export type Book = {
  mode: Mode;
  live: LiveState | null;
  demo: DemoState;
  money: (v: number, digits?: number) => string;
  account: string | null;
  /** Demo: play money. Live: USDC in the connected wallet. */
  balance: number | null;
  /** Live only: winnings and cash-outs waiting to be withdrawn. */
  credit: number;
  /** Is this fact tradeable right now? (Live: it exists on the contract.) */
  open: (id: string) => boolean;
  pool: (id: string) => Pool | null;
  price: (id: string) => number;
  settled: (id: string) => boolean | undefined;
  position: (id: string) => { yes: number; no: number; spent?: number } | null;
  history: (claim: Claim) => { points: { t: number; p: number }[]; recent: number };
  ruling: (id: string) => Ruling | undefined;
  staked: (claim: Claim) => number;
  people: (claim: Claim) => number | null;
  sentence: (claim: Claim) => { text: string; ai: boolean };
  revisions: (slug: string) => Revision[];
  lastRewrite?: { claimId: string; at: number };
  pending: string | null;
  bonds: { ruling: number; dispute: number; windowHours: number };
  buy: (id: string, side: Side, amount: number, paidWith?: string) => Promise<Result>;
  sell: (id: string, side: Side, shares: number) => Promise<Result>;
  request: (id: string) => Promise<Result>;
  dispute: (id: string) => Promise<Result>;
  /** Demo: skip the dispute window. Live: finalize once the window has passed. */
  advance: (id: string) => Promise<Result>;
  /** Live: collect winnings of a settled fact to the wallet. */
  collect: (id: string) => Promise<Result>;
  withdraw: () => Promise<Result>;
  nudge: (id: string, panel: boolean) => Promise<Result>;
};

export function useBook(): Book {
  const mode = useMode();
  const d = demo.useVerity();
  const l = useLive(mode === "live");
  return mode === "live" ? liveBook(l, d) : demoBook(d);
}

function demoBook(s: DemoState): Book {
  return {
    mode: "demo",
    live: null,
    demo: s,
    money: (v, digits = 0) => dollars(v, digits),
    account: null,
    balance: s.balance,
    credit: 0,
    open: (id) => !(id in s.settled),
    pool: (id) => s.pools[id] ?? null,
    price: (id) => demo.priceNow(s, id),
    settled: (id) => s.settled[id],
    position: (id) => s.positions[id] ?? null,
    history: (claim) => ({ points: demo.historyOf(s, claim), recent: s.points[claim.id]?.length ?? 0 }),
    ruling: (id) => s.rulings[id],
    staked: (claim) => demo.stakedOn(s, claim),
    people: (claim) => claim.traders + s.trades.filter((t) => t.claimId === claim.id && t.kind === "buy").length,
    sentence: (claim) => {
      const out = demo.sentenceNow(s, claim);
      return { text: out.text, ai: out.ai?.writer === "near-ai" };
    },
    revisions: (slug) => s.revisions.filter((r) => r.slug === slug),
    lastRewrite: s.lastRewrite,
    pending: null,
    bonds: { ruling: demo.RULING_BOND, dispute: demo.DISPUTE_BOND, windowHours: demo.DISPUTE_HOURS },
    buy: async (id, side, amount, paidWith) => demo.buy(id, side, amount, paidWith),
    sell: async (id, side, shares) => demo.sell(id, side, shares),
    request: (id) => demo.requestRuling(id) as Promise<Result>,
    dispute: (id) => demo.dispute(id) as Promise<Result>,
    advance: async (id) => {
      demo.skipWindow(id);
      return { ok: true };
    },
    collect: async () => ({ ok: true }),
    withdraw: async () => ({ ok: true }),
    nudge: async () => ({ ok: true }),
  };
}

function statusOf(c: ChainClaim | undefined) {
  return c && typeof c.status === "object" ? c.status : null;
}

function liveBook(l: LiveState, d: DemoState): Book {
  const windowNs = l.config?.dispute_window_ns ?? 0;
  const chain = (id: string) => l.claims[id];
  const price = (id: string) => (chain(id) ? livePrice(chain(id)) : CLAIM_BY_ID[id]?.start ?? 0.5);
  const settled = (id: string) => {
    const st = statusOf(chain(id));
    return st && "Settled" in st ? st.Settled.verdict : undefined;
  };
  const toVotes = (evidence: string): Vote[] =>
    (parseEvidence(evidence).v ?? []).map(([model, verdict, kind, signer, writer]) => ({
      model,
      verdict: verdict as Vote["verdict"],
      reason: "",
      writer: writer ?? (kind ? "near-ai" : "demo"),
      proof: kind ? { chatId: "", model, signatureKind: kind, signingAddress: signer, signature: null, hashesMatch: true } : undefined,
    }));
  return {
    mode: "live",
    live: l,
    demo: d,
    money: (v, digits = 2) => {
      // Small real amounts always show cents.
      const d = digits === 0 && v < 100 ? 2 : digits;
      return `${v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d })} USDC`;
    },
    account: l.account,
    balance: l.usdc,
    credit: l.view ? fromUnits(l.view.credit) : 0,
    open: (id) => Boolean(chain(id)) && settled(id) === undefined && Number(chain(id).yes) > 0,
    pool: (id) => (chain(id) ? livePool(chain(id)) : null),
    price,
    settled,
    position: (id) => {
      const p = l.view?.positions.find((x) => x.claim === id);
      return p ? { yes: fromUnits(p.yes), no: fromUnits(p.no) } : null;
    },
    history: (claim) => {
      const h = l.history[claim.id] ?? [];
      const points = h.map(([t, bps]) => ({ t: t * 1000, p: bps / 10_000 }));
      if (points.length === 1) points.unshift({ t: points[0].t - 3_600_000, p: points[0].p });
      if (points.length === 0) return { points: [{ t: 0, p: price(claim.id) }, { t: 1, p: price(claim.id) }], recent: 0 };
      return { points, recent: 0 };
    },
    ruling: (id) => {
      const st = statusOf(chain(id));
      if (!st) return undefined;
      if ("Judging" in st) return { stage: "judging", requestedAt: Date.now() };
      if ("Proposed" in st) {
        const ev = parseEvidence(st.Proposed.evidence);
        return {
          stage: "proposed",
          verdict: st.Proposed.verdict ? "true" : "false",
          reason: ev.r,
          votes: toVotes(st.Proposed.evidence),
          requestedAt: st.Proposed.proposed_at_ns / 1e6,
          windowEnds: (st.Proposed.proposed_at_ns + windowNs) / 1e6,
        };
      }
      if ("Disputed" in st) return { stage: "panel", verdict: st.Disputed.verdict ? "true" : "false", reason: parseEvidence(st.Disputed.evidence).r, requestedAt: Date.now(), disputed: true };
      if ("Settled" in st) return { stage: "final", verdict: st.Settled.verdict ? "true" : "false", reason: parseEvidence(st.Settled.evidence).r, votes: toVotes(st.Settled.evidence), requestedAt: 0 };
      return undefined;
    },
    staked: (claim) => (chain(claim.id) ? fromUnits(chain(claim.id).volume) : 0),
    people: () => null,
    sentence: (claim) => {
      const st = settled(claim.id);
      const w: Wording = st === undefined ? wordingOf(price(claim.id)) : st ? "yes" : "no";
      const ai = l.aiText[claim.id];
      return ai && ai.wording === w ? { text: ai.text, ai: true } : { text: claim[w], ai: false };
    },
    revisions: (slug) => liveRevisions(l, slug),
    lastRewrite: l.lastRewrite,
    pending: l.pending,
    bonds: { ruling: fromUnits(l.config?.ruling_bond ?? 0), dispute: fromUnits(l.config?.dispute_bond ?? 0), windowHours: windowNs / 3.6e12 },
    buy: (id, side, amount) => liveBuy(id, side, amount),
    sell: (id, side, shares) => liveSell(id, side, shares),
    request: async (id) => liveRequest(id),
    dispute: async (id) => liveDispute(id),
    advance: (id) => liveFinalize(id),
    collect: (id) => liveCollect(id),
    withdraw: () => liveWithdraw(),
    nudge: (id, panel) => nudgeJudge(id, panel),
  };
}

/** Live page history: every time a fact's chart crossed a wording line. */
function liveRevisions(l: LiveState, slug: string): Revision[] {
  const out: Revision[] = [];
  for (const c of CLAIMS.filter((x) => x.article === slug)) {
    const h = l.history[c.id] ?? [];
    for (let i = 1; i < h.length; i++) {
      const from = wordingOf(h[i - 1][1] / 10_000);
      const to = wordingOf(h[i][1] / 10_000);
      if (from !== to) out.push({ id: `${c.id}-${i}`, t: h[i][0] * 1000, slug, claimId: c.id, from, to, price: h[i][1] / 10_000, writer: "demo" });
    }
  }
  return out.sort((a, b) => b.t - a.t);
}

export { getLive };
