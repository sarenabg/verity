"use client";

import Link from "next/link";
import { useBook, type Book } from "@/lib/book";
import { LIVE } from "@/lib/config";
import { CLAIM_BY_ID } from "@/lib/content";
import { pct, quoteSell, type Side } from "@/lib/market";
import { resetDemo, START_BALANCE } from "@/lib/store";
import { useConnect } from "./ModeControls";
import { bandHex, toast } from "./ui";

type Holding = { id: string; side: Side; shares: number; value: number; cost: number | null };

export function Bets() {
  const b = useBook();
  const live = b.mode === "live";
  const openConnect = useConnect();

  const ids = live ? (b.live?.view?.positions.map((p) => p.claim) ?? []) : Object.keys(b.demo.positions);
  const holdings: Holding[] = ids.flatMap((id) => {
    const pos = b.position(id);
    const pool = b.pool(id);
    if (!pos || !pool || b.settled(id) !== undefined) return [];
    return (["yes", "no"] as const)
      .filter((sd) => pos[sd] > 1e-6)
      .map((sd) => ({ id, side: sd, shares: pos[sd], value: quoteSell(pool, sd, pos[sd]).amount, cost: pos.spent !== undefined ? pos.spent * (pos[sd] / (pos.yes + pos.no)) : null }));
  });
  const winnings = ids.flatMap((id) => {
    const v = b.settled(id);
    const pos = b.position(id);
    if (v === undefined || !pos) return [];
    const won = v ? pos.yes : pos.no;
    return won > 1e-6 ? [{ id, won }] : [];
  });
  const invested = holdings.reduce((a, h) => a + h.value, 0);

  if (live && !b.account) {
    return (
      <main className="mx-auto max-w-4xl px-5 py-10 sm:px-10">
        <h1 className="font-serif text-[44px] font-medium tracking-tight">My bets</h1>
        <div className="mt-8 rounded-[22px] border border-dashed border-line-strong p-10 text-center">
          <p className="font-serif text-xl">Connect a wallet to see your bets.</p>
          <button onClick={openConnect} className="mt-4 rounded-full bg-ink px-5 py-3 font-medium text-white">
            Connect wallet
          </button>
        </div>
      </main>
    );
  }

  const addedMoney = b.demo.trades.filter((t) => t.kind === "payout" && !t.claimId).reduce((a, t) => a + t.amount, 0);
  const change = (b.balance ?? 0) + invested - START_BALANCE - addedMoney;

  return (
    <main className="mx-auto max-w-4xl px-5 py-10 sm:px-10">
      <h1 className="font-serif text-[44px] font-medium tracking-tight">My bets</h1>
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {live ? (
          <div className="rounded-[20px] border border-line bg-surface p-5">
            <p className="text-sm text-muted">Ready to collect</p>
            <p className="tabular mt-1 text-2xl font-semibold">{b.money(b.credit)}</p>
            {b.credit > 0 && (
              <button
                onClick={async () => {
                  const r = await b.withdraw();
                  toast(r.ok ? "Sent to your wallet" : r.error);
                }}
                className="mt-3 rounded-full bg-ink px-4 py-2 text-sm font-medium text-white"
              >
                Withdraw to wallet
              </button>
            )}
          </div>
        ) : (
          <Stat label="Cash" value={b.money(b.balance ?? 0, 2)} />
        )}
        <Stat label="In bets, now worth" value={b.money(invested, 2)} />
        {live ? (
          <Stat label="In your wallet" value={b.balance === null ? "…" : b.money(b.balance)} />
        ) : (
          <Stat label="Profit" value={`${change >= 0 ? "+" : "−"}${b.money(Math.abs(change), 2)}`} tone={change >= 0 ? "text-certain" : "text-unlikely"} />
        )}
      </div>

      {winnings.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-sm font-semibold">Won</h2>
          <ul className="divide-y divide-line overflow-hidden rounded-[22px] border border-line bg-surface">
            {winnings.map((w) => (
              <li key={w.id} className="flex items-center gap-4 px-5 py-4">
                <span className="min-w-0 flex-1 font-serif text-[18px]">{CLAIM_BY_ID[w.id]?.question ?? w.id}</span>
                <span className="tabular font-semibold text-certain">{b.money(w.won)}</span>
                <button
                  onClick={async () => {
                    const r = await b.collect(w.id);
                    toast(r.ok ? "Sent to your wallet" : r.error);
                  }}
                  className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-white"
                >
                  Collect
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-10">
        <h2 className="mb-3 text-sm font-semibold">Open bets</h2>
        {holdings.length === 0 ? (
          <div className="rounded-[22px] border border-dashed border-line-strong p-10 text-center">
            <p className="font-serif text-xl">No bets yet.</p>
            <Link href="/wiki/mount-everest?fact=everest-mallory" className="mt-4 inline-block rounded-full bg-ink px-5 py-3 font-medium text-white">
              Find a fact to bet on
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-[22px] border border-line bg-surface">
            {holdings.map((h) => (
              <Row key={`${h.id}-${h.side}`} b={b} h={h} />
            ))}
          </ul>
        )}
      </section>

      {!live && b.demo.trades.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-sm font-semibold">Activity</h2>
          <ul className="space-y-2 text-[15px]">
            {b.demo.trades.slice(0, 30).map((t) => (
              <li key={t.id} className="flex flex-wrap justify-between gap-x-4 gap-y-1 rounded-xl px-1 py-1.5">
                <span className="min-w-0 text-body">
                  {t.kind === "payout" && !t.claimId
                    ? "Added money"
                    : t.kind === "payout"
                      ? `Won: ${CLAIM_BY_ID[t.claimId]?.question}`
                      : `${t.kind === "buy" ? "Bet" : "Cashed out"} ${t.side === "yes" ? "True" : "False"}: ${CLAIM_BY_ID[t.claimId]?.question}`}
                  {t.paidWith ? <span className="text-faint"> · paid {t.paidWith}</span> : null}
                </span>
                <span className={`tabular ${t.kind === "buy" ? "text-muted" : "text-certain"}`}>
                  {t.kind === "buy" ? "−" : "+"}
                  {b.money(t.amount, 2)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {live ? (
        <a href={`${LIVE.explorer}/address/${b.account}`} target="_blank" rel="noreferrer" className="mt-12 inline-block text-sm text-certain hover:underline">
          See all your transactions
        </a>
      ) : (
        <button
          onClick={() => {
            if (window.confirm("Start over with $1,000 and fresh markets?")) {
              resetDemo();
              toast("Demo reset");
            }
          }}
          className="mt-12 text-sm text-muted underline-offset-2 hover:text-ink hover:underline"
        >
          Reset demo
        </button>
      )}
    </main>
  );
}

function Row({ b, h }: { b: Book; h: Holding }) {
  const c = CLAIM_BY_ID[h.id];
  const p = b.price(h.id);
  const diff = h.cost === null ? null : h.value - h.cost;
  return (
    <li className="flex flex-wrap items-center gap-4 px-5 py-4">
      <Link href={`/wiki/${c?.article}?fact=${h.id}`} className="min-w-0 flex-[1_1_240px]">
        <span className="block font-serif text-[18px] leading-snug hover:underline">{c?.question ?? h.id}</span>
        <span className="text-sm text-muted">
          {h.side === "yes" ? "True" : "False"} · now{" "}
          <span className="tabular font-semibold" style={{ color: bandHex(p) }}>
            {pct(p)}
          </span>
        </span>
      </Link>
      <span className="tabular text-right">
        <span className="block font-semibold">{b.money(h.value, 2)}</span>
        {diff !== null && (
          <span className={`block text-sm ${diff >= 0 ? "text-certain" : "text-unlikely"}`}>
            {diff >= 0 ? "+" : "−"}
            {b.money(Math.abs(diff), 2)}
          </span>
        )}
      </span>
      <button
        onClick={async () => {
          const r = await b.sell(h.id, h.side, h.shares);
          if (!r.ok) return toast(r.error);
          toast(r.rewritten ? "Cashed out. The AI rewrote this fact on the page" : "Cashed out", r.rewritten ? "rewrite" : "info");
        }}
        className="rounded-full border border-line-strong px-4 py-2 text-sm font-medium hover:border-ink"
      >
        Cash out
      </button>
    </li>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-[20px] border border-line bg-surface p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className={`tabular mt-1 text-2xl font-semibold ${tone ?? ""}`}>{value}</p>
    </div>
  );
}
