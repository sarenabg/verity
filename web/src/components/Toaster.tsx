"use client";

import { useEffect, useState } from "react";

type Toast = { id: number; message: string; tone: "info" | "rewrite" };

export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => {
    let n = 0;
    const on = (e: Event) => {
      const { message, tone } = (e as CustomEvent).detail as Omit<Toast, "id">;
      const id = ++n;
      setItems((xs) => [...xs, { id, message, tone }]);
      setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 4200);
    };
    window.addEventListener("verity:toast", on);
    return () => window.removeEventListener("verity:toast", on);
  }, []);
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-5 z-[60] flex flex-col items-center gap-2 px-4">
      {items.map((t) => (
        <div key={t.id} className="rise flex max-w-md items-center gap-3 rounded-2xl bg-ink px-5 py-3.5 text-[15px] text-white shadow-xl">
          {t.tone === "rewrite" ? (
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" className="shrink-0 text-amber-300">
              <path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4L12 3z" fill="currentColor" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" className="shrink-0 text-emerald-300">
              <path d="M5 12.5l4.5 4.5L19 7" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}
