"use client";

import { useCallback, useEffect, useState } from "react";
import { LIVE, liveAvailable } from "@/lib/config";
import { refresh } from "@/lib/live";
import { setMode, useMode } from "@/lib/mode";
import { connect, disconnect, WALLETS } from "@/lib/wallet";
import { Modal, toast } from "./ui";

// Demo ↔ Live switch, the amber Demo strip, and the wallet window.
// Any component can open the windows through these small events.

const open = (name: "mode" | "connect") => window.dispatchEvent(new CustomEvent(`verity:${name}`));
export const useConnect = () => useCallback(() => open("connect"), []);
export const useModePicker = () => useCallback(() => open("mode"), []);

export function DemoStrip() {
  const mode = useMode();
  if (mode !== "demo") return null;
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 bg-amber-100 px-4 py-2 text-sm text-amber-900">
      <span className="font-semibold">Demo</span>
      <span>Play money. Nothing real moves.</span>
      {liveAvailable() && (
        <button onClick={() => open("mode")} className="font-semibold underline-offset-2 hover:underline">
          Switch to Live
        </button>
      )}
    </div>
  );
}

export function ModePill() {
  const mode = useMode();
  return (
    <button
      onClick={() => open("mode")}
      className={`inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-2 text-sm font-medium ${mode === "live" ? "text-certain" : "text-amber-900"}`}
      aria-label={`Mode: ${mode}. Change`}
    >
      <span className={`size-2 rounded-full ${mode === "live" ? "bg-likely" : "bg-amber-500"}`} />
      {mode === "live" ? "Live" : "Demo"}
    </button>
  );
}

export function ModeWindows() {
  const mode = useMode();
  const [which, setWhich] = useState<"mode" | "connect" | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const onMode = () => setWhich("mode");
    const onConnect = () => setWhich("connect");
    window.addEventListener("verity:mode", onMode);
    window.addEventListener("verity:connect", onConnect);
    return () => {
      window.removeEventListener("verity:mode", onMode);
      window.removeEventListener("verity:connect", onConnect);
    };
  }, []);

  return (
    <>
      <Modal open={which === "mode"} onClose={() => setWhich(null)} title="How do you want to play?">
        <p className="-mt-3 mb-5 text-[15px] text-muted">You can switch any time.</p>
        <Choice
          on={mode === "demo"}
          tone="amber"
          title="Demo"
          text="$1,000 of play money. Nothing real moves. No wallet."
          onClick={() => {
            setMode("demo");
            setWhich(null);
          }}
        />
        <Choice
          on={mode === "live"}
          tone="blue"
          title="Live"
          text={liveAvailable() ? "Real dollars (USDC) on NEAR. Your wallet confirms every bet." : "Coming soon: the live markets aren't open yet."}
          disabled={!liveAvailable()}
          onClick={() => {
            setMode("live");
            setWhich(null);
          }}
        />
      </Modal>

      <Modal open={which === "connect"} onClose={() => setWhich(null)} title="Connect a wallet">
        <div className="flex flex-col gap-2.5">
          {WALLETS.map((w) => (
            <button
              key={w.id}
              disabled={busy !== null}
              onClick={async () => {
                setBusy(w.id);
                try {
                  await connect(w.id);
                  setWhich(null);
                  await refresh();
                  toast("Wallet connected");
                } catch (e) {
                  toast((e as Error).message?.slice(0, 120) || "Couldn't connect");
                } finally {
                  setBusy(null);
                }
              }}
              className="flex items-center gap-3.5 rounded-2xl border border-line px-4 py-3.5 text-left text-base font-medium hover:border-ink disabled:opacity-50"
            >
              <span className="size-9 rounded-xl" style={{ background: w.color }} />
              {w.name}
              {busy === w.id && <span className="ml-auto size-2.5 animate-pulse rounded-full bg-certain" />}
            </button>
          ))}
        </div>
        <p className="mt-5 text-sm text-muted">No USDC on NEAR? You can still bet with BTC, ETH, SOL and 200+ more coins.</p>
        <p className="mt-2 text-[13px] text-faint">Verity never sees your keys. Bets go to a public contract: {LIVE.contract}</p>
      </Modal>
    </>
  );
}

function Choice({ on, tone, title, text, onClick, disabled }: { on: boolean; tone: "amber" | "blue"; title: string; text: string; onClick: () => void; disabled?: boolean }) {
  const ring = on ? (tone === "amber" ? "border-amber-500 bg-amber-50" : "border-certain bg-true-tint") : "border-line";
  return (
    <button disabled={disabled} onClick={onClick} className={`mb-3 flex w-full items-start gap-4 rounded-[20px] border-2 p-4 text-left disabled:opacity-50 ${ring}`}>
      <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${tone === "amber" ? "bg-amber-100" : "bg-true-tint"}`}>
        <span className={`size-2.5 rounded-full ${tone === "amber" ? "bg-amber-500" : "bg-likely"}`} />
      </span>
      <span>
        <span className="block text-lg font-semibold">{title}</span>
        <span className="mt-0.5 block text-[15px] text-muted">{text}</span>
      </span>
    </button>
  );
}

export async function signOut() {
  await disconnect();
  await refresh();
  toast("Wallet disconnected");
}
