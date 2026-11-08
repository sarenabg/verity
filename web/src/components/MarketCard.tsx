"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useBook, type Book } from "@/lib/book";
import type { Claim } from "@/lib/content";
import { LIVE } from "@/lib/config";
import { loadHistory } from "@/lib/live";
import { BAND_LABEL, bandOf, cents, pct, quoteBuy, quoteSell, type Side } from "@/lib/market";
import { addMoney, type Ruling, type Vote } from "@/lib/store";
import { LivePay } from "./LivePay";
import { useConnect } from "./ModeControls";
import { PayWithCoin } from "./PayWithCoin";
import { bandHex, Sparkline, toast } from "./ui";

export function MarketCard({ claim, onBet }: { claim: Claim; onBet?: () => void }) {
  const b = useBook();
  const p = b.price(claim.id);
  const verdict = b.settled(claim.id);
  const settled = verdict !== undefined;
  const live = b.mode === "live";
  const [side, setSide] = useState<Side>(p < 0.5 ? "yes" : "no");
  const [amount, setAmount] = useState(live ? "0.5" : "20");
  const [payOpen, setPayOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const openConnect = useConnect();

  useEffect(() => {
    setSide(b.price(claim.id) < 0.5 ? "yes" : "no");
    if (live) void loadHistory(claim.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claim.id, live]);

  useEffect(() => setAmount(live ? "0.5" : "20"), [live]);

  const pool = b.pool(claim.id);
  const usd = Math.max(0, Number(amount) || 0);
  const quote = useMemo(() => (usd > 0 && pool && b.open(claim.id) ? quoteBuy(pool, side, usd) : null), [pool, side, usd, b, claim.id]);
  const { points, recent } = b.history(claim);
  const pos = b.position(claim.id);
  const color = bandHex(p);
  const chips = live ? [0.25, 0.5, 1] : [10, 50, 100];
  const notLive = live && !b.live?.claims[claim.id];

  const place = useCallback(
    async (paidWith?: string) => {
      if (live && !b.account) return openConnect();
      setBusy(true);
      const r = await b.buy(claim.id, side, usd, paidWith);
      setBusy(false);
      if (!r.ok) return toast(r.error);
      onBet?.();
      if (r.rewritten) toast("The AI rewrote this fact on the page", "rewrite");
      else toast(`Bet placed: ${b.money(usd)} on ${side === "yes" ? "True" : "False"}`);
    },
    [b, claim.id, side, usd, live, openConnect, onBet],
  );

  const onPaid = useCallback(
    (paidWith: string) => {
      setPayOpen(false);
      // Demo: coins arrive as dollars first, then the bet is placed with them.
      addMoney(usd, paidWith);
      void place(paidWith);
    },
    [usd, place],
  );

  return (
    <div className="rounded-[22px] border border-line bg-surface p-6 shadow-[0_1px_2px_rgba(28,25,23,0.04),0_12px_32px_rgba(28,25,23,0.06)]">
      <p className="mb-1.5 text-sm text-muted">The market says</p>
      <h2 className="mb-4 font-serif text-[24px] leading-tight font-medium">{claim.question}</h2>

      {settled ? (
        <span className={`inline-block rounded-full px-3 py-1 text-sm font-semibold text-white ${verdict ? "bg-certain" : "bg-unlikely"}`}>Settled: {verdict ? "True" : "False"}</span>
      ) : (
        <>
          <div className="flex items-baseline gap-2.5">
            <span key={pct(p)} className="pop tabular text-[46px] leading-none font-semibold tracking-tight" style={{ color }}>
              {pct(p)}
            </span>
            <span className="text-[15px] text-muted">chance it&apos;s true</span>
          </div>
          <p className="mt-1 text-sm font-medium" style={{ color }}>
            {BAND_LABEL[bandOf(p)]}
          </p>
        </>
      )}

      <div className="mt-3 mb-5">
        <Sparkline points={points} recent={recent} color={color} />
      </div>

      {notLive && <p className="rounded-2xl bg-paper p-4 text-sm text-muted">This fact isn&apos;t open for real bets yet. Switch to Demo to try it.</p>}

      {!settled && !notLive && (
        <>
          <div className="mb-3 grid grid-cols-2 gap-2.5" role="radiogroup" aria-label="Pick a side">
            {(["yes", "no"] as const).map((sd) => {
              const on = side === sd;
              return (
                <button
                  key={sd}
                  role="radio"
                  aria-checked={on}
                  onClick={() => setSide(sd)}
                  className={`rounded-2xl border-[1.5px] px-3 py-3.5 text-base font-semibold transition ${
                    on ? (sd === "yes" ? "border-certain bg-true-tint text-certain" : "border-unlikely bg-false-tint text-false") : "border-line text-muted hover:border-line-strong"
                  }`}
                >
                  {sd === "yes" ? "True" : "False"} · <span className="tabular">{cents(sd === "yes" ? p : 1 - p)}</span>
                </button>
              );
            })}
          </div>

          <label htmlFor={`amt-${claim.id}`} className="mb-1.5 block text-sm text-muted">
            Amount
          </label>
          <div className="mb-2.5 flex items-center gap-2 rounded-2xl border border-line px-4 py-3 focus-within:border-ink">
            {!live && <span className="text-lg font-semibold">$</span>}
            <input
              id={`amt-${claim.id}`}
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
              className="tabular w-16 min-w-0 flex-1 bg-transparent text-lg font-semibold outline-none"
            />
            {live && <span className="font-semibold">USDC</span>}
            <span className="tabular ml-auto text-sm whitespace-nowrap text-muted">{quote ? `pays ${b.money(quote.payout, live ? 2 : 0)} if right` : ""}</span>
          </div>
          <div className="mb-4 flex gap-2">
            {chips.map((v) => (
              <button key={v} onClick={() => setAmount(String(v))} className="tabular rounded-full border border-line px-3.5 py-1.5 text-sm hover:border-ink">
                {live ? v : b.money(v)}
              </button>
            ))}
            {quote && <span className="tabular ml-auto self-center text-sm text-faint">→ {pct(quote.priceAfter)}</span>}
          </div>

          <button
            disabled={(!quote && !(live && !b.account)) || busy}
            onClick={() => void place()}
            className="w-full rounded-2xl bg-ink py-4 text-base font-semibold text-white transition hover:bg-black disabled:opacity-40"
          >
            {live && !b.account ? "Connect a wallet to bet" : busy ? b.pending ?? "Placing bet…" : `Bet ${b.money(usd, live ? undefined : 0)} on ${side === "yes" ? "True" : "False"}`}
          </button>
          {live && b.account && <p className="mt-2 text-center text-[13px] text-faint">Your wallet asks you to confirm</p>}
          <button
            disabled={!quote}
            onClick={() => (live && !b.account ? openConnect() : setPayOpen(true))}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl py-2.5 text-sm font-medium text-muted hover:bg-paper disabled:opacity-40"
          >
            <span className="flex -space-x-1.5">
              {["USDC", "ETH", "BTC", "SOL"].map((c) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={c} src={`/icons/coins/${c}.svg`} alt="" width={20} height={20} className="rounded-full ring-2 ring-white" />
              ))}
            </span>
            Pay with any coin
          </button>
        </>
      )}

      {pos && (pos.yes > 1e-6 || pos.no > 1e-6) && <YourShares b={b} claimId={claim.id} yes={pos.yes} no={pos.no} settled={verdict} />}

      <Settle b={b} claim={claim} ruling={b.ruling(claim.id)} settled={settled} busy={busy} setBusy={setBusy} />

      <p className="tabular mt-5 text-sm text-muted">
        {b.people(claim) !== null ? `${b.people(claim)!.toLocaleString()} people · ` : ""}
        {b.money(b.staked(claim), 0)} staked{settled ? "" : " · cash out any time"}
        {live && b.live?.config && (
          <>
            {" · "}
            <a href={`${LIVE.explorer}/address/${LIVE.contract}`} target="_blank" rel="noreferrer" className="text-certain hover:underline">
              contract
            </a>
          </>
        )}
      </p>
      <ul className="mt-2 space-y-1">
        {claim.sources.map((src) => (
          <li key={src.url}>
            <a href={src.url} target="_blank" rel="noreferrer" className="text-sm text-certain underline-offset-2 hover:underline">
              {src.title}
            </a>
          </li>
        ))}
      </ul>

      {live ? (
        <LivePay open={payOpen} usd={usd} side={side} claimId={claim.id} onClose={() => setPayOpen(false)} onReady={() => void place()} />
      ) : (
        <PayWithCoin open={payOpen} usd={usd} title={`Bet ${b.money(usd)} on ${side === "yes" ? "True" : "False"}`} onClose={() => setPayOpen(false)} onPaid={onPaid} />
      )}
    </div>
  );
}

function YourShares({ b, claimId, yes, no, settled }: { b: Book; claimId: string; yes: number; no: number; settled?: boolean }) {
  const pool = b.pool(claimId);
  const rows = (["yes", "no"] as const).filter((sd) => (sd === "yes" ? yes : no) > 1e-6);
  const live = b.mode === "live";
  if (settled !== undefined) {
    if (!live) return null;
    const won = settled ? yes : no;
    return (
      <div className="mt-5 flex items-center justify-between gap-3 rounded-2xl bg-paper p-4">
        <p className="tabular">{won > 0 ? <>You won <b>{b.money(won)}</b></> : "Your side lost this one."}</p>
        {won > 0 && (
          <button
            onClick={async () => {
              const r = await b.collect(claimId);
              toast(r.ok ? "Sent to your wallet" : r.error);
            }}
            className="shrink-0 rounded-full bg-ink px-4 py-2 text-sm font-medium text-white"
          >
            Collect
          </button>
        )}
      </div>
    );
  }
  return (
    <div className="mt-5 space-y-3 rounded-2xl bg-paper p-4">
      {rows.map((sd) => {
        const shares = sd === "yes" ? yes : no;
        const value = pool && pool.yes > 0 ? quoteSell(pool, sd, shares).amount : 0;
        return (
          <div key={sd} className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm text-muted">Your {sd === "yes" ? "True" : "False"} bet is worth</p>
              <p className="tabular text-lg font-semibold">{b.money(value, 2)}</p>
              <p className="tabular text-sm text-faint">{b.money(shares, 2)} if right</p>
            </div>
            <button
              onClick={async () => {
                const r = await b.sell(claimId, sd, shares);
                if (!r.ok) return toast(r.error);
                toast(r.rewritten ? "Cashed out. The AI rewrote this fact on the page" : live ? "Cashed out. Withdraw it from My bets" : "Cashed out", r.rewritten ? "rewrite" : "info");
              }}
              className="shrink-0 rounded-full border border-line-strong bg-surface px-4 py-2 text-sm font-medium whitespace-nowrap hover:border-ink"
            >
              Cash out
            </button>
          </div>
        );
      })}
    </div>
  );
}

function Settle({ b, claim, ruling, settled, busy, setBusy }: { b: Book; claim: Claim; ruling?: Ruling; settled: boolean; busy: boolean; setBusy: (x: boolean) => void }) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const live = b.mode === "live";
  const run = async (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setBusy(true);
    const r = await fn();
    setBusy(false);
    if (!r.ok && r.error) toast(r.error);
  };

  if (!ruling) {
    if (settled || (live && !b.live?.claims[claim.id])) return null;
    return (
      <div className="mt-5 border-t border-line pt-4">
        <button disabled={busy} onClick={() => run(() => b.request(claim.id))} className="flex w-full items-center justify-between gap-3 text-left text-sm text-muted hover:text-ink">
          <span className="flex items-center gap-2">
            <Gavel />
            Ask the AI judge to settle this
          </span>
          <span className="tabular shrink-0 whitespace-nowrap text-faint">{b.money(b.bonds.ruling, 0)} deposit</span>
        </button>
      </div>
    );
  }

  const label = ruling.verdict === "true" ? "True" : ruling.verdict === "false" ? "False" : "Can't settle yet";
  const left = ruling.windowEnds ? Math.max(0, ruling.windowEnds - now) : 0;
  return (
    <div className="rise mt-5 rounded-2xl border border-line p-4">
      {(ruling.stage === "judging" || ruling.stage === "panel") && (
        <div>
          <p className="flex items-center gap-2.5 text-sm text-muted">
            <span className="size-2.5 animate-pulse rounded-full bg-certain" />
            {ruling.stage === "judging" ? "The AI judge is reading the evidence…" : "Three AI judges are reviewing the dispute…"}
          </p>
          {live && (
            <button onClick={() => run(() => b.nudge(claim.id, ruling.stage === "panel"))} className="mt-2 text-sm font-medium text-certain hover:underline">
              Taking long? Wake the judge
            </button>
          )}
        </div>
      )}
      {ruling.stage !== "judging" && ruling.stage !== "panel" && (
        <>
          <div className="mb-2 flex items-center gap-2">
            <Gavel />
            <span className="text-sm text-muted">{ruling.stage === "final" ? "Final answer" : ruling.stage === "proposed" ? "AI judge says" : "AI judge"}</span>
            <span className={`ml-auto rounded-full px-2.5 py-0.5 text-sm font-semibold ${ruling.verdict === "true" ? "bg-true-tint text-certain" : ruling.verdict === "false" ? "bg-false-tint text-false" : "bg-sunk text-muted"}`}>{label}</span>
          </div>
          <p className="font-serif text-[16px] leading-snug text-body">{ruling.reason}</p>
          <Votes votes={ruling.panelVotes ?? ruling.votes ?? []} />
          {ruling.outcome && <p className="mt-2 text-sm text-muted">{ruling.outcome}</p>}
          {ruling.stage === "proposed" && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="tabular text-sm text-muted">{left > 0 ? `${fmtLeft(left)} left to dispute` : "Dispute time is over"}</span>
              {left > 0 && (
                <button disabled={busy} onClick={() => run(() => b.dispute(claim.id))} className="ml-auto rounded-full border border-line-strong px-3.5 py-1.5 text-sm font-medium hover:border-ink">
                  Dispute · {b.money(b.bonds.dispute, 0)}
                </button>
              )}
              {(!live || left === 0) && (
                <button disabled={busy} onClick={() => run(() => b.advance(claim.id))} className={`rounded-full bg-ink px-3.5 py-1.5 text-sm font-medium text-white ${left === 0 ? "ml-auto" : ""}`}>
                  {live ? "Make it final" : `Skip ${b.bonds.windowHours}h (demo)`}
                </button>
              )}
            </div>
          )}
          {ruling.stage === "unsettled" && !settled && (
            <button disabled={busy} onClick={() => run(() => b.request(claim.id))} className="mt-3 text-sm font-medium text-certain hover:underline">
              Ask again
            </button>
          )}
        </>
      )}
    </div>
  );
}

function fmtLeft(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}h` : `${m}:${String(s % 60).padStart(2, "0")}`;
}

function Votes({ votes }: { votes: Vote[] }) {
  if (!votes.length) return null;
  return (
    <ul className="mt-3 space-y-1.5">
      {votes.map((v, i) => (
        <li key={i} className="flex items-center gap-2 text-xs text-muted">
          <span className={`size-2 rounded-full ${v.verdict === "true" ? "bg-certain" : v.verdict === "false" ? "bg-unlikely" : "bg-faint"}`} />
          <span className="truncate">{v.writer === "near-ai" ? v.model.split("/").pop() : votes.length > 1 ? `Judge ${i + 1}` : "Judge"}</span>
          {v.writer === "near-ai" && v.proof?.signatureKind ? (
            <a
              href="https://cloud.near.ai/verify"
              target="_blank"
              rel="noreferrer"
              title={`Signed by ${v.proof.signingAddress ?? "unknown"} (${v.proof.signatureKind})${v.proof.hashesMatch ? ", matches our request and answer" : ""}`}
              className="ml-auto shrink-0 text-certain hover:underline"
            >
              Signed in a sealed computer ✓
            </a>
          ) : (
            <span className="ml-auto shrink-0 text-faint">{v.writer === "near-ai" ? "NEAR AI" : "demo judge"}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

function Gavel() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M14 4l6 6M11 7l6 6M12.5 5.5l-6 6 3 3 6-6M8 13L3 18l2 2 5-5M4 22h10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
