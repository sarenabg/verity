"use client";

import { useEffect, useState } from "react";
import { usdcRegistered } from "@/lib/chain";
import { LIVE } from "@/lib/config";
import { CLAIMS } from "@/lib/content";
import { refresh, useLive } from "@/lib/live";
import { setMode } from "@/lib/mode";
import { setupPlan } from "@/lib/setup";
import { send, USDC_STORAGE } from "@/lib/wallet";
import { useConnect } from "./ModeControls";
import { toast } from "./ui";

// Owner-only setup for Live mode. Every step is signed in the owner's own wallet.

const PER_FACT = Number(process.env.NEXT_PUBLIC_SEED_PER_FACT || "2");

export function Admin() {
  const l = useLive(true);
  const openConnect = useConnect();
  const [contractCanHold, setContractCanHold] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const plan = setupPlan(PER_FACT);

  useEffect(() => setMode("live"), []);
  useEffect(() => {
    if (LIVE.contract) void usdcRegistered(LIVE.contract).then(setContractCanHold).catch(() => setContractCanHold(null));
  }, [l.claims]);

  if (!LIVE.contract) return <Shell>Set NEXT_PUBLIC_VERITY_CONTRACT first (see DEPLOY.md).</Shell>;

  const created = Object.keys(l.claims).length;
  const seeded = Object.values(l.claims).filter((c) => Number(c.yes) > 0).length;
  const isOwner = l.account && l.config?.owner === l.account;

  const step = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      await refresh();
      toast("Done");
    } catch (e) {
      toast((e as Error).message?.slice(0, 140) || "Cancelled");
    } finally {
      setBusy(false);
    }
  };

  const steps = [
    {
      done: contractCanHold === true,
      title: "Let the contract hold USDC",
      cost: "0.00125 NEAR",
      run: () => send([{ receiverId: LIVE.usdc, methodName: "storage_deposit", args: { account_id: LIVE.contract, registration_only: true }, deposit: USDC_STORAGE, gasTgas: 30 }]),
    },
    {
      done: created >= CLAIMS.length,
      title: `Create ${CLAIMS.length} facts`,
      cost: "gas only",
      run: () => send([{ receiverId: LIVE.contract, methodName: "create_claims", args: plan.createArgs, gasTgas: 300 }]),
    },
    {
      done: seeded >= CLAIMS.length,
      title: `Start every market (${PER_FACT} USDC each)`,
      cost: `${plan.totalUnits / 1e6} USDC`,
      run: () =>
        send([
          {
            receiverId: LIVE.usdc,
            methodName: "ft_transfer_call",
            args: { receiver_id: LIVE.contract, amount: String(plan.totalUnits), msg: JSON.stringify(plan.seedMsg) },
            deposit: 1n,
            gasTgas: 300,
          },
        ]),
    },
  ];

  return (
    <Shell>
      <p className="text-[15px] text-muted">
        Contract <span className="font-mono text-ink">{LIVE.contract}</span> · owner <span className="font-mono text-ink">{l.config?.owner ?? "…"}</span>
      </p>
      {!l.account ? (
        <button onClick={openConnect} className="mt-6 rounded-full bg-ink px-5 py-3 font-medium text-white">
          Connect the owner wallet
        </button>
      ) : !isOwner ? (
        <p className="mt-6 rounded-2xl bg-false-tint p-4 text-false">Connected as {l.account}. Only the owner can set up markets.</p>
      ) : (
        <ol className="mt-6 space-y-3">
          {steps.map((s, i) => (
            <li key={s.title} className="flex items-center gap-4 rounded-[20px] border border-line bg-surface p-5">
              <span className={`grid size-9 shrink-0 place-items-center rounded-full font-semibold ${s.done ? "bg-certain text-white" : "border border-line"}`}>{s.done ? "✓" : i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{s.title}</span>
                <span className="block text-sm text-muted">{s.cost}</span>
              </span>
              {!s.done && (
                <button disabled={busy || steps.slice(0, i).some((p) => !p.done)} onClick={() => step(s.run)} className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-white disabled:opacity-40">
                  Confirm in wallet
                </button>
              )}
            </li>
          ))}
        </ol>
      )}
      <p className="mt-6 text-sm text-faint">
        {created} facts created · {seeded} markets open
      </p>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-2xl px-5 py-12 sm:px-10">
      <h1 className="mb-3 font-serif text-[40px] font-medium tracking-tight">Set up live markets</h1>
      {children}
    </main>
  );
}
