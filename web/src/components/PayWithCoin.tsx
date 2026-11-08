"use client";

import { useEffect, useState } from "react";
import { COINS, type Coin } from "@/lib/coins";
import { money } from "@/lib/market";
import { CoinIcon, Modal } from "./ui";

// Pay from any coin. NEAR Intents converts the coin into dollars on NEAR.
// The quote is live (a dry run of the 1Click API); the transfer itself is
// simulated in this demo, so no real coins move.

type Quote = { amountIn: number; seconds: number; source: "near-intents" | "price" | "estimate" };
type Step = "pick" | "send" | "moving";

export function PayWithCoin({ open, usd, title, onClose, onPaid }: { open: boolean; usd: number; title: string; onClose: () => void; onPaid: (paidWith: string) => void }) {
  const [step, setStep] = useState<Step>("pick");
  const [coin, setCoin] = useState<Coin | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [stage, setStage] = useState(0);

  useEffect(() => {
    if (!open) {
      setStep("pick");
      setCoin(null);
      setQuote(null);
      setStage(0);
    }
  }, [open]);

  useEffect(() => {
    if (!coin || step !== "send") return;
    let live = true;
    setQuote(null);
    fetch(`/api/quote?symbol=${coin.symbol}&chain=${coin.chain}&usd=${usd}`)
      .then((r) => r.json())
      .then((q) => live && setQuote(q))
      .catch(() => live && setQuote({ amountIn: usd / coin.approxUsd, seconds: 30, source: "estimate" }));
    return () => {
      live = false;
    };
  }, [coin, step, usd]);

  useEffect(() => {
    if (step !== "moving") return;
    const timers = [setTimeout(() => setStage(1), 900), setTimeout(() => setStage(2), 1900), setTimeout(() => setStage(3), 2800)];
    return () => timers.forEach(clearTimeout);
  }, [step]);

  useEffect(() => {
    if (stage === 3 && coin && quote) {
      const t = setTimeout(() => onPaid(`${fmt(quote.amountIn)} ${coin.symbol}`), 500);
      return () => clearTimeout(t);
    }
  }, [stage, coin, quote, onPaid]);

  return (
    <Modal open={open} onClose={onClose} title={title}>
      {step === "pick" && (
        <div className="grid grid-cols-3 gap-2.5">
          {COINS.map((c) => (
            <button
              key={`${c.symbol}-${c.chain}`}
              onClick={() => {
                setCoin(c);
                setStep("send");
              }}
              className="flex flex-col items-center gap-2 rounded-2xl border border-line px-2 py-4 text-sm font-medium hover:border-ink hover:bg-paper"
            >
              <CoinIcon coin={c} size={34} />
              {c.symbol}
            </button>
          ))}
        </div>
      )}

      {step === "send" && coin && (
        <div className="rise">
          <div className="rounded-2xl bg-paper p-5">
            <div className="flex items-center gap-3">
              <CoinIcon coin={coin} size={40} />
              <div>
                <p className="text-sm text-muted">You send</p>
                <p className="tabular text-2xl font-semibold">{quote ? `${fmt(quote.amountIn)} ${coin.symbol}` : "…"}</p>
              </div>
            </div>
            <div className="my-4 flex items-center gap-2 pl-3 text-faint">
              <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 4v16m0 0l-6-6m6 6l6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-sm">about {quote ? Math.max(5, Math.round(quote.seconds)) : 30} seconds</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-full bg-ink text-lg font-semibold text-white">$</span>
              <div>
                <p className="text-sm text-muted">Arrives as</p>
                <p className="tabular text-2xl font-semibold">{money(usd, 2)}</p>
              </div>
            </div>
          </div>
          <p className="mt-3 text-center text-xs text-faint">
            {quote?.source === "near-intents" ? "Live price from NEAR Intents" : quote ? "Approximate price" : "Getting a live price…"} · demo, no real coins move
          </p>
          <div className="mt-5 flex gap-2">
            <button onClick={() => setStep("pick")} className="rounded-2xl border border-line px-5 py-4 font-medium hover:bg-paper">
              Back
            </button>
            <button disabled={!quote} onClick={() => setStep("moving")} className="flex-1 rounded-2xl bg-ink px-5 py-4 font-semibold text-white disabled:opacity-40">
              Send {quote ? `${fmt(quote.amountIn)} ${coin.symbol}` : ""}
            </button>
          </div>
        </div>
      )}

      {step === "moving" && coin && (
        <ol className="rise space-y-4 py-2">
          {[`${coin.symbol} received`, "Changed into dollars", "Ready"].map((label, i) => (
            <li key={label} className="flex items-center gap-3 text-[17px]">
              <span className={`grid size-8 place-items-center rounded-full ${stage > i ? "bg-certain text-white" : "border border-line text-faint"}`}>
                {stage > i ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M5 12.5l4.5 4.5L19 7" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <span className="size-2 animate-pulse rounded-full bg-faint" />
                )}
              </span>
              <span className={stage > i ? "text-ink" : "text-faint"}>{label}</span>
            </li>
          ))}
        </ol>
      )}
    </Modal>
  );
}

function fmt(n: number): string {
  if (n >= 100) return n.toFixed(0);
  if (n >= 1) return n.toFixed(2);
  return n.toPrecision(3);
}
