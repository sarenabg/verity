"use client";

import { useSyncExternalStore } from "react";
import { liveAvailable } from "./config";

// Demo (play money, default) or Live (real USDC on NEAR). Remembered per browser.

export type Mode = "demo" | "live";
const KEY = "verity:mode";
let mode: Mode = "demo";
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const url = new URL(window.location.href).searchParams.get("mode");
    const saved = window.localStorage.getItem(KEY);
    const want = url === "live" || url === "demo" ? url : saved;
    if (want === "live" && liveAvailable()) mode = "live";
    if (url === "live" || url === "demo") window.localStorage.setItem(KEY, mode);
  } catch {}
}

/** remember: keep the choice for the next visit (the admin page switches without remembering). */
export function setMode(next: Mode, remember = true) {
  load();
  mode = next === "live" && !liveAvailable() ? "demo" : next;
  if (remember) {
    try {
      window.localStorage.setItem(KEY, mode);
    } catch {}
  }
  listeners.forEach((l) => l());
}

export function useMode(): Mode {
  return useSyncExternalStore(
    (l) => {
      load();
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => {
      load();
      return mode;
    },
    () => "demo",
  );
}
