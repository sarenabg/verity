"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { bandOf, type Band } from "@/lib/market";
import type { Coin } from "@/lib/coins";
import { chainLogo, coinLogo } from "@/lib/coins";

export const BAND_TEXT: Record<Band, string> = {
  certain: "text-certain",
  likely: "text-likely",
  disputed: "text-disputed",
  unlikely: "text-unlikely",
  false: "text-false",
};

/** Underline style for a fact in the article text. */
export function factStyle(p: number, settled: boolean): React.CSSProperties {
  const band = bandOf(p);
  const color = { certain: "#1e40af", likely: "#3b82f6", disputed: "#8a8178", unlikely: "#ea580c", false: "#c2410c" }[band];
  return {
    textDecorationColor: color,
    textDecorationStyle: settled ? "double" : band === "disputed" ? "dashed" : "solid",
  };
}

export function bandHex(p: number): string {
  return { certain: "#1e40af", likely: "#2563eb", disputed: "#6b645d", unlikely: "#c2410c", false: "#9a3412" }[bandOf(p)];
}

export function Logo({ size = 26 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg width={size} height={size} viewBox="0 0 26 26" aria-hidden="true">
        <circle cx="13" cy="13" r="12" fill="none" stroke="#1C1917" strokeWidth="1.5" />
        <path d="M7 13.5l4 4 8-9" fill="none" stroke="#1E40AF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="font-serif text-[24px] font-semibold tracking-tight">Verity</span>
    </span>
  );
}

/**
 * Price line. The first points are 30 days of history; the last `recent` points
 * are trades made today, given the right-hand fifth of the chart so they show.
 */
export function Sparkline({ points, recent = 0, height = 80, color }: { points: { t: number; p: number }[]; recent?: number; height?: number; color: string }) {
  const w = 340;
  if (points.length < 2) return null;
  const old = points.length - recent;
  const split = recent ? 0.8 : 1;
  const xs = points.map((_, i) => (i < old ? (i / Math.max(1, old - 1)) * w * split : w * split + ((i - old + 1) / recent) * w * (1 - split)));
  const y = (p: number) => 6 + (1 - p) * (height - 12);
  const d = points.map((pt, i) => `${i ? "L" : "M"}${xs[i].toFixed(1)} ${y(pt.p).toFixed(1)}`).join(" ");
  const last = points[points.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="block w-full" style={{ height }} role="img" aria-label={`Price over the last 30 days, now ${Math.round(last.p * 100)}%`}>
      <line x1="0" x2={w} y1={y(0.5)} y2={y(0.5)} stroke="#E7E1D6" strokeDasharray="3 4" />
      <path d={`${d} L${w} ${height} L0 ${height} Z`} fill={color} fillOpacity="0.08" />
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={xs[xs.length - 1]} cy={y(last.p)} r="4" fill={color} stroke="#fff" strokeWidth="2" />
    </svg>
  );
}

export function CoinIcon({ coin, size = 28 }: { coin: Coin; size?: number }) {
  const showChain = coin.chain !== coin.symbol.toLowerCase() && !(coin.symbol === "ETH" && coin.chain === "eth") && !(coin.symbol === "BTC" && coin.chain === "btc");
  return (
    <span className="relative inline-block shrink-0" style={{ width: size, height: size }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={coinLogo(coin)} alt="" width={size} height={size} className="rounded-full" />
      {showChain && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={chainLogo(coin)} alt="" width={size * 0.46} height={size * 0.46} className="absolute -right-0.5 -bottom-0.5 rounded-full ring-2 ring-white" />
      )}
    </span>
  );
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Shared behaviour for every popup: Escape closes it, keyboard focus moves inside and stays
 * there (Tab wraps around), the page behind doesn't scroll, and focus goes back to whatever
 * opened it when it closes.
 */
function useDialog(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!open) return;
    const before = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const box = ref.current;
    // Start on the first real choice, not the close button.
    const first = box?.querySelector<HTMLElement>("[data-autofocus]") ?? [...(box?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])].find((el) => el.getAttribute("aria-label") !== "Close");
    (first ?? box)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close.current();
        return;
      }
      if (e.key !== "Tab" || !box) return;
      const items = [...box.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const [a, z] = [items[0], items[items.length - 1]];
      if (e.shiftKey && (document.activeElement === a || !box.contains(document.activeElement))) {
        e.preventDefault();
        z.focus();
      } else if (!e.shiftKey && (document.activeElement === z || !box.contains(document.activeElement))) {
        e.preventDefault();
        a.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      if (before && document.contains(before)) before.focus();
    };
  }, [open]);
  return ref;
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const ref = useDialog(open, onClose);
  if (!open || typeof document === "undefined") return null;
  // Rendered into <body> so a sticky parent can't trap it under the header.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-6" onClick={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="pop max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-surface p-6 shadow-2xl outline-none sm:max-w-md sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="font-serif text-2xl font-medium">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="grid size-10 place-items-center rounded-full text-muted hover:bg-sunk">
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

/** Phone bottom sheet (used below the lg breakpoint). */
export function Sheet({ open, onClose, label, children }: { open: boolean; onClose: () => void; label: string; children: React.ReactNode }) {
  const ref = useDialog(open, onClose);
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end bg-ink/40 lg:hidden" onClick={onClose}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} className="rise max-h-[90vh] w-full overflow-y-auto rounded-t-[28px] bg-paper px-3 pt-3 pb-6 outline-none" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} aria-label="Close" className="mx-auto mb-3 block h-6 w-16">
          <span className="mx-auto block h-1.5 w-10 rounded-full bg-line-strong" />
        </button>
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function toast(message: string, tone: "info" | "rewrite" = "info") {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("verity:toast", { detail: { message, tone } }));
}
