"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { useBook } from "@/lib/book";
import { ARTICLES, CLAIMS } from "@/lib/content";
import { money } from "@/lib/market";
import { addMoney } from "@/lib/store";
import { DemoStrip, ModePill, signOut, useConnect } from "./ModeControls";
import { PayWithCoin } from "./PayWithCoin";
import { Logo, Modal, toast } from "./ui";

export function Header() {
  const b = useBook();
  const path = usePathname();
  const [amountOpen, setAmountOpen] = useState(false);
  const [usd, setUsd] = useState(100);
  const [payOpen, setPayOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const openConnect = useConnect();
  const live = b.mode === "live";

  const onPaid = useCallback(
    (paidWith: string) => {
      addMoney(usd, paidWith);
      setPayOpen(false);
      toast(`${money(usd)} added`);
    },
    [usd],
  );

  const nav = [
    { href: "/", label: "Explore" },
    { href: "/bets", label: "My bets" },
    { href: "/how", label: "How it works" },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/90 backdrop-blur">
      <DemoStrip />
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-5 py-3.5 sm:px-10">
        <Link href="/" aria-label="Verity home">
          <Logo />
        </Link>
        <nav className="order-3 flex w-full gap-1 text-[15px] sm:order-none sm:w-auto">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`rounded-full px-3.5 py-2 ${path === n.href ? "bg-surface font-medium text-ink shadow-[0_0_0_1px_var(--color-line)]" : "text-muted hover:text-ink"}`}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <Search />
        <div className="ml-auto flex items-center gap-2.5">
          <ModePill />
          {!live && (
            <>
              <Link href="/bets" className="tabular hidden text-[15px] font-semibold sm:inline" aria-label="Your balance">
                {money(b.balance ?? 0)}
              </Link>
              <button onClick={() => setAmountOpen(true)} className="rounded-full bg-ink px-4 py-2.5 text-sm font-medium text-white hover:bg-black">
                Add money
              </button>
            </>
          )}
          {live && !b.account && (
            <button onClick={openConnect} className="rounded-full bg-ink px-4 py-2.5 text-sm font-medium text-white hover:bg-black">
              Connect wallet
            </button>
          )}
          {live && b.account && (
            <div className="relative">
              <button onClick={() => setMenu((m) => !m)} className="flex items-center gap-2.5 rounded-full border border-line bg-surface py-1.5 pr-3.5 pl-1.5 text-sm font-medium">
                <span className="grid size-7 place-items-center rounded-full bg-ink text-xs text-white">{b.account[0]?.toUpperCase()}</span>
                <span className="max-w-[9rem] truncate">{b.account}</span>
                <span className="tabular hidden text-muted sm:inline">· {b.balance === null ? "…" : b.money(b.balance)}</span>
              </button>
              {menu && (
                <div className="pop absolute right-0 mt-2 w-56 overflow-hidden rounded-2xl border border-line bg-surface shadow-xl">
                  <Link href="/bets" onClick={() => setMenu(false)} className="block px-4 py-3 text-[15px] hover:bg-paper">
                    My bets
                  </Link>
                  <button
                    onClick={() => {
                      setMenu(false);
                      void signOut();
                    }}
                    className="block w-full px-4 py-3 text-left text-[15px] hover:bg-paper"
                  >
                    Disconnect
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <Modal open={amountOpen} onClose={() => setAmountOpen(false)} title="Add money">
        <div className="grid grid-cols-3 gap-2.5">
          {[50, 100, 250].map((v) => (
            <button
              key={v}
              onClick={() => setUsd(v)}
              className={`tabular rounded-2xl border py-5 text-xl font-semibold ${usd === v ? "border-ink bg-ink text-white" : "border-line hover:border-ink"}`}
            >
              {money(v)}
            </button>
          ))}
        </div>
        <button
          onClick={() => {
            setAmountOpen(false);
            setPayOpen(true);
          }}
          className="mt-5 w-full rounded-2xl bg-ink py-4 font-semibold text-white"
        >
          Pay with any coin
        </button>
      </Modal>
      <PayWithCoin open={payOpen} usd={usd} title={`Add ${money(usd)}`} onClose={() => setPayOpen(false)} onPaid={onPaid} />
    </header>
  );
}

function Search() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [focus, setFocus] = useState(false);
  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    const arts = ARTICLES.filter((a) => a.title.toLowerCase().includes(t) || a.topic.toLowerCase().includes(t)).map((a) => ({ href: `/wiki/${a.slug}`, label: a.title, sub: a.topic }));
    const facts = CLAIMS.filter((c) => c.question.toLowerCase().includes(t)).map((c) => ({ href: `/wiki/${c.article}?fact=${c.id}`, label: c.question, sub: ARTICLES.find((a) => a.slug === c.article)?.title ?? "" }));
    return [...arts, ...facts].slice(0, 7);
  }, [q]);

  return (
    <div className="relative hidden min-w-0 flex-1 md:block md:max-w-xs">
      <label className="flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2.5 text-muted focus-within:border-ink">
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M20 20l-4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input
          aria-label="Search"
          placeholder="Search anything"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setFocus(true)}
          onBlur={() => setTimeout(() => setFocus(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && results[0]) {
              router.push(results[0].href);
              setQ("");
            }
          }}
          className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-faint"
        />
      </label>
      {focus && results.length > 0 && (
        <ul className="pop absolute inset-x-0 top-full mt-2 overflow-hidden rounded-2xl border border-line bg-surface shadow-xl">
          {results.map((r) => (
            <li key={r.href}>
              <Link href={r.href} onClick={() => setQ("")} className="block px-4 py-3 hover:bg-paper">
                <span className="block text-[15px] text-ink">{r.label}</span>
                <span className="block text-xs text-faint">{r.sub}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
