"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useBook } from "@/lib/book";
import { money } from "@/lib/market";
import { search } from "@/lib/search";
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
  const [findOpen, setFindOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const openConnect = useConnect();
  const live = b.mode === "live";

  // The account menu closes on a click outside it or on Escape.
  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  // A new page closes the phone search.
  useEffect(() => setFindOpen(false), [path]);

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
        <nav aria-label="Main" className="order-3 flex w-full items-center gap-1 text-[15px] sm:order-none sm:w-auto">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={path === n.href ? "page" : undefined}
              className={`rounded-full px-3 py-2 sm:px-3.5 ${path === n.href ? "bg-surface font-medium text-ink shadow-[0_0_0_1px_var(--color-line)]" : "text-muted hover:text-ink"}`}
            >
              {n.label}
            </Link>
          ))}
          <button
            onClick={() => setFindOpen((o) => !o)}
            aria-label="Search"
            aria-expanded={findOpen}
            className="ml-auto grid size-10 place-items-center rounded-full text-muted hover:bg-surface hover:text-ink md:hidden"
          >
            <SearchIcon />
          </button>
        </nav>
        <div className="relative hidden min-w-0 flex-1 md:block md:max-w-xs">
          <SearchBox />
        </div>
        <div className="ml-auto flex items-center gap-2.5">
          <ModePill />
          {!live && (
            <>
              <Link href="/bets" className="tabular text-[15px] font-semibold" aria-label={`Your balance: ${money(b.balance ?? 0)}. See my bets`}>
                {money(b.balance ?? 0)}
              </Link>
              <button onClick={() => setAmountOpen(true)} aria-label="Add money" className="grid h-10 min-w-10 place-items-center rounded-full bg-ink px-3 text-sm font-medium text-white hover:bg-black sm:px-4">
                <span className="sm:hidden" aria-hidden="true">
                  <svg width="16" height="16" viewBox="0 0 24 24">
                    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
                  </svg>
                </span>
                <span className="hidden sm:inline">Add money</span>
              </button>
            </>
          )}
          {live && !b.account && (
            <button onClick={openConnect} className="rounded-full bg-ink px-4 py-2.5 text-sm font-medium text-white hover:bg-black">
              Connect wallet
            </button>
          )}
          {live && b.account && (
            <div className="relative" ref={menuRef}>
              <button onClick={() => setMenu((m) => !m)} aria-expanded={menu} aria-haspopup="menu" className="flex items-center gap-2.5 rounded-full border border-line bg-surface py-1.5 pr-3.5 pl-1.5 text-sm font-medium">
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

      {findOpen && (
        <div className="mx-auto max-w-6xl px-5 pb-3 md:hidden">
          <SearchBox autoFocus onDone={() => setFindOpen(false)} />
        </div>
      )}

      <Modal open={amountOpen} onClose={() => setAmountOpen(false)} title="Add money">
        <div className="grid grid-cols-3 gap-2.5">
          {[50, 100, 250].map((v) => (
            <button
              key={v}
              aria-pressed={usd === v}
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

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M20 20l-4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** Search with a suggestion list: arrow keys move, Enter opens, Escape closes. */
function SearchBox({ autoFocus, onDone }: { autoFocus?: boolean; onDone?: () => void }) {
  const router = useRouter();
  const id = useId();
  const [q, setQ] = useState("");
  const [focus, setFocus] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const results = useMemo(() => search(q), [q]);
  const open = focus && q.trim().length > 0;

  const go = (href: string) => {
    router.push(href);
    setQ("");
    input.current?.blur();
    onDone?.();
  };

  return (
    <div className="relative">
      <label className="flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2.5 text-muted focus-within:border-ink">
        <SearchIcon />
        <input
          ref={input}
          type="search"
          role="combobox"
          aria-label="Search articles and facts"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-activedescendant={open && results[active] ? `${id}-${active}` : undefined}
          autoFocus={autoFocus}
          placeholder="Search anything"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
            setFocus(true);
          }}
          onFocus={() => setFocus(true)}
          onBlur={() => setTimeout(() => setFocus(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" && results.length) {
              e.preventDefault();
              setActive((a) => (a + 1) % results.length);
            } else if (e.key === "ArrowUp" && results.length) {
              e.preventDefault();
              setActive((a) => (a - 1 + results.length) % results.length);
            } else if (e.key === "Enter" && results[active]) {
              e.preventDefault();
              go(results[active].href);
            } else if (e.key === "Escape") {
              setQ("");
              onDone?.();
            }
          }}
          className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-faint [&::-webkit-search-cancel-button]:hidden"
        />
      </label>
      {open && (
        <ul id={`${id}-list`} role="listbox" aria-label="Suggestions" className="pop absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-line bg-surface shadow-xl">
          {results.length === 0 && <li className="px-4 py-3 text-[15px] text-muted">No articles or facts match “{q.trim()}”.</li>}
          {results.map((r, i) => (
            <li key={r.href} id={`${id}-${i}`} role="option" aria-selected={i === active}>
              <Link
                href={r.href}
                tabIndex={-1}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(r.href)}
                className={`block px-4 py-3 ${i === active ? "bg-paper" : ""}`}
              >
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
