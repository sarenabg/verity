"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { COINS, type Coin } from "@/lib/coins";
import { liveRegisterUsdc, refresh, useLive } from "@/lib/live";
import { CoinIcon, Modal, toast } from "./ui";

// Live: bet with any coin. NEAR Intents gives a one-time address; the coins
// arrive as USDC in the person's own NEAR wallet; then they confirm the bet.

type Deposit = { depositAddress: string; depositMemo: string | null; amountIn: string; deadline: string | null; seconds: number; chainName: string };
type Step = "register" | "pick" | "send" | "arrived" | "failed";

const STATUS_TEXT: Record<string, string> = {
  PENDING_DEPOSIT: "Waiting for your coins…",
  KNOWN_DEPOSIT_TX: "Coins seen, waiting for confirmations…",
  PROCESSING: "Changing into dollars…",
  SUCCESS: "Arrived",
  INCOMPLETE_DEPOSIT: "Too little arrived. It will be refunded.",
  REFUNDED: "Refunded to you.",
  FAILED: "Something failed. It will be refunded.",
};

export function LivePay({ open, usd, side, claimId, onClose, onReady }: { open: boolean; usd: number; side: "yes" | "no"; claimId: string; onClose: () => void; onReady: () => void }) {
  const l = useLive(true);
  const [step, setStep] = useState<Step>("pick");
  const [coin, setCoin] = useState<Coin | null>(null);
  const [dep, setDep] = useState<Deposit | null>(null);
  const [qr, setQr] = useState<string>("");
  const [st, setSt] = useState("PENDING_DEPOSIT");
  const [now, setNow] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setStep(l.registered === false ? "register" : "pick");
      setCoin(null);
      setDep(null);
      setSt("PENDING_DEPOSIT");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (step !== "send" || !dep) return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const poll = setInterval(async () => {
      try {
        const r = await (await fetch(`/api/live/status?address=${encodeURIComponent(dep.depositAddress)}`)).json();
        if (!r.status) return;
        setSt(r.status);
        if (r.status === "SUCCESS") {
          await refresh();
          setStep("arrived");
        } else if (["REFUNDED", "FAILED", "INCOMPLETE_DEPOSIT"].includes(r.status)) setStep("failed");
      } catch {}
    }, 5000);
    return () => {
      clearInterval(tick);
      clearInterval(poll);
    };
  }, [step, dep]);

  const start = async (c: Coin) => {
    if (!l.account) return;
    setCoin(c);
    setBusy(true);
    try {
      const res = await fetch("/api/live/deposit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ symbol: c.symbol, chain: c.chain, usd, account: l.account }) });
      const out = await res.json();
      if (!res.ok) throw new Error(out.error);
      setDep(out);
      setQr(await QRCode.toDataURL(out.depositAddress, { margin: 1, width: 240 }));
      setStep("send");
    } catch (e) {
      toast((e as Error).message || "Couldn't get an address");
    } finally {
      setBusy(false);
    }
  };

  const left = dep?.deadline ? Math.max(0, new Date(dep.deadline).getTime() - now) : 0;
  const title = `Bet ${usd} USDC on ${side === "yes" ? "True" : "False"}`;

  return (
    <Modal open={open} onClose={onClose} title={title}>
      {step === "register" && (
        <div className="rise">
          <p className="text-[15px] text-muted">First, let your wallet hold USDC. It costs 0.00125 NEAR, once.</p>
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const r = await liveRegisterUsdc();
              setBusy(false);
              if (r.ok) setStep("pick");
              else toast(r.error);
            }}
            className="mt-5 w-full rounded-2xl bg-ink py-4 font-semibold text-white disabled:opacity-40"
          >
            Confirm in wallet
          </button>
        </div>
      )}

      {step === "pick" && (
        <>
          <p className="-mt-2 mb-4 text-sm text-faint">Step 1 of 3 · pick a coin</p>
          <div className="grid grid-cols-3 gap-2.5">
            {COINS.map((c) => (
              <button
                key={`${c.symbol}-${c.chain}`}
                disabled={busy}
                onClick={() => void start(c)}
                className={`flex flex-col items-center gap-2 rounded-2xl border px-2 py-4 text-sm font-medium hover:border-ink hover:bg-paper disabled:opacity-50 ${coin === c ? "border-ink" : "border-line"}`}
              >
                <CoinIcon coin={c} size={34} />
                {c.symbol}
              </button>
            ))}
          </div>
          {busy && <p className="mt-4 text-center text-sm text-muted">Getting your address…</p>}
        </>
      )}

      {step === "send" && dep && coin && (
        <div className="rise">
          <p className="-mt-2 mb-3 text-sm text-faint">Step 2 of 3 · send</p>
          <p className="font-serif text-2xl">
            Send exactly <span className="tabular font-semibold">{dep.amountIn} {coin.symbol}</span>
          </p>
          <div className="mt-4 flex items-center gap-4 rounded-2xl bg-paper p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {qr && <img src={qr} alt="QR code of the address" width={112} height={112} className="rounded-lg bg-white" />}
            <div className="min-w-0">
              <p className="text-sm text-muted">To this address on {dep.chainName}</p>
              <p className="mt-1 mb-2 font-mono text-[13px] break-all">{dep.depositAddress}</p>
              {dep.depositMemo && <p className="mb-2 font-mono text-[13px]">Memo: {dep.depositMemo}</p>}
              <button
                onClick={() => {
                  void navigator.clipboard?.writeText(dep.depositAddress);
                  toast("Address copied");
                }}
                className="rounded-full border border-line-strong bg-surface px-3 py-1.5 text-sm font-medium"
              >
                Copy
              </button>
            </div>
          </div>
          <div className="tabular mt-3 flex justify-between px-1 text-sm text-muted">
            <span>Arrives as {usd} USDC</span>
            {left > 0 && <span>Price held {Math.floor(left / 60000)}:{String(Math.floor((left % 60000) / 1000)).padStart(2, "0")}</span>}
          </div>
          <p className="mt-4 flex items-center gap-2.5 text-[15px]">
            <span className="size-2.5 animate-pulse rounded-full bg-certain" />
            {STATUS_TEXT[st] ?? st}
          </p>
          <p className="mt-3 text-center text-[13px] text-faint">Money back automatically if anything fails</p>
        </div>
      )}

      {step === "arrived" && (
        <div className="rise">
          <p className="-mt-2 mb-4 text-sm text-faint">Step 3 of 3 · place your bet</p>
          <ol className="space-y-3 text-[16px]">
            <li className="flex items-center gap-3"><Check /> {coin?.symbol} received</li>
            <li className="flex items-center gap-3"><Check /> Changed into {usd} USDC</li>
          </ol>
          <button
            onClick={() => {
              onClose();
              onReady();
            }}
            className="mt-6 w-full rounded-2xl bg-ink py-4 font-semibold text-white"
          >
            Confirm bet in wallet
          </button>
        </div>
      )}

      {step === "failed" && (
        <div className="rise">
          <p className="text-[15px]">{STATUS_TEXT[st]}</p>
          <p className="mt-2 text-sm text-muted">Refunds go to your NEAR Intents balance (open intents.near.org with the same wallet).</p>
          <button onClick={() => setStep("pick")} className="mt-5 w-full rounded-2xl border border-line py-3.5 font-medium">
            Try again
          </button>
        </div>
      )}
      <span className="sr-only">{claimId}</span>
    </Modal>
  );
}

function Check() {
  return (
    <span className="grid size-8 place-items-center rounded-full bg-certain text-white">
      <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 12.5l4.5 4.5L19 7" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}
