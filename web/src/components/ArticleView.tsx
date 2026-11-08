"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useBook } from "@/lib/book";
import { ARTICLES, CLAIM_BY_ID, claimsOf, type Article } from "@/lib/content";
import { loadHistory } from "@/lib/live";
import { pct, type Wording } from "@/lib/market";
import { MarketCard } from "./MarketCard";
import { bandHex, factStyle, Sheet } from "./ui";
import { useAiStatus } from "./useAiStatus";

const WORDING_LABEL: Record<Wording, string> = { yes: "stated as true", mixed: "disputed", no: "doubtful" };

export function ArticleView({ article, initialFact }: { article: Article; initialFact?: string }) {
  const b = useBook();
  const ai = useAiStatus();
  const claims = claimsOf(article.slug);
  const [selected, setSelected] = useState(initialFact && CLAIM_BY_ID[initialFact]?.article === article.slug ? initialFact : article.featured);
  const [sheet, setSheet] = useState(false);
  const [now, setNow] = useState(0);
  const live = b.mode === "live";

  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Live: load every fact's chart so the page history can be shown.
  useEffect(() => {
    if (live) claims.forEach((c) => void loadHistory(c.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, article.slug]);

  const phone = () => window.matchMedia("(max-width: 1023px)").matches;
  const pick = (id: string) => {
    setSelected(id);
    if (phone()) setSheet(true);
  };

  // Arriving from a link to one fact ("Bet on it", search, My bets): show it.
  useEffect(() => {
    if (!initialFact || CLAIM_BY_ID[initialFact]?.article !== article.slug) return;
    if (phone()) setSheet(true);
    else document.querySelector(`[data-fact="${initialFact}"]`)?.scrollIntoView({ block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Phones: after a bet that rewrote the page, close the sheet so the change is visible.
  const afterSheetBet = (rewritten: boolean) => {
    if (!rewritten) return;
    setSheet(false);
    requestAnimationFrame(() => document.querySelector(`[data-fact="${selected}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" }));
  };

  const revisions = b.revisions(article.slug);
  const staked = claims.reduce((a, c) => a + b.staked(c), 0);
  const writtenAgo = revisions[0] ? ago(now, revisions[0].t) : null;
  const others = ARTICLES.filter((a) => a.slug !== article.slug).slice(0, 3);

  return (
    <main className="mx-auto max-w-6xl px-5 pt-10 pb-28 sm:px-10 lg:pb-10">
      <div className="flex flex-wrap items-start gap-x-12 gap-y-10">
        <article className="min-w-0 flex-[999_1_560px]">
          <p className="mb-2 text-sm text-muted">
            <Link href="/" className="hover:text-ink">
              {article.topic}
            </Link>
            {writtenAgo ? ` · rewritten ${writtenAgo}` : ""}
          </p>
          <h1 className="mb-5 font-serif text-[44px] leading-[1.05] font-medium tracking-tight sm:text-[56px]">{article.title}</h1>
          <div className="mb-8 flex flex-wrap gap-2 text-[13px]">
            <Chip>
              <span className="size-2 rounded-full bg-certain" />
              {claims.length} facts on the market
            </Chip>
            <Chip>
              <span className="tabular">{b.money(staked, 0)}</span> staked
            </Chip>
            {ai?.nearAi ? <Chip tone="blue">Written by NEAR AI · signed ✓</Chip> : <Chip>Written by AI · demo</Chip>}
          </div>

          <div className="font-serif text-[20px] leading-[1.75] text-body sm:text-[21px]">
            {article.paragraphs.map((para, i) => (
              <p key={i} className="mb-5">
                {para.map((seg, j) => {
                  if (typeof seg === "string") return <span key={j}>{seg}</span>;
                  const claim = CLAIM_BY_ID[seg.claim];
                  const p = b.price(claim.id);
                  const settled = b.settled(claim.id) !== undefined;
                  const { text } = b.sentence(claim);
                  const fresh = b.lastRewrite?.claimId === claim.id && now - b.lastRewrite.at < 3000;
                  const on = selected === claim.id;
                  return (
                    <span key={j}>
                      {/* A real <button> can't wrap across lines with the text around it, so this is a keyboard-usable span. */}
                      <span
                        key={text}
                        data-fact={claim.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => pick(claim.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            pick(claim.id);
                          }
                        }}
                        aria-pressed={on}
                        aria-label={`${text} Market: ${pct(p)} true. Open market.`}
                        className={`fact ${fresh ? "rewrite" : ""} ${on ? "lg:bg-true-tint" : ""}`}
                        style={factStyle(p, settled)}
                      >
                        {text}
                      </span>
                      <sup className="tabular ml-0.5 font-sans text-[11px] font-semibold" style={{ color: bandHex(p) }}>
                        {settled ? "✓" : pct(p)}
                      </sup>
                    </span>
                  );
                })}
              </p>
            ))}
          </div>

          <Legend />

          <section className="mt-12 border-t border-line pt-6">
            <h2 className="mb-4 text-sm font-semibold text-ink">Page history</h2>
            <ol className="space-y-3 text-[15px]">
              {revisions.slice(0, 12).map((r) => {
                const final = r.price === 1 || r.price === 0;
                return (
                  <li key={r.id} className="rise grid grid-cols-[5rem_1fr] items-baseline gap-x-2">
                    <span className="tabular text-sm text-faint">{ago(now, r.t)}</span>
                    <span className="min-w-0">
                      <button onClick={() => pick(r.claimId)} className="text-left text-body hover:underline">
                        {CLAIM_BY_ID[r.claimId].question}
                      </button>
                      <span className="block text-sm text-muted">
                        {final ? (
                          <>
                            <strong className="font-semibold text-ink">Settled {r.price === 1 ? "True" : "False"}</strong> by the AI judge
                            {r.from !== r.to ? ` · now ${WORDING_LABEL[r.to]}` : ""}
                          </>
                        ) : (
                          <>
                            {WORDING_LABEL[r.from]} → <strong className="font-semibold text-ink">{WORDING_LABEL[r.to]}</strong> at {pct(r.price)}
                            {live ? "" : ` · ${r.writer === "near-ai" ? "written by NEAR AI" : "demo writer"}`}
                          </>
                        )}
                      </span>
                    </span>
                  </li>
                );
              })}
              <li className="grid grid-cols-[5rem_1fr] items-baseline gap-x-2">
                <span className="text-sm text-faint">earlier</span>
                <span className="text-muted">Page written from {claims.length} markets</span>
              </li>
            </ol>
          </section>

          <nav className="mt-16 w-full border-t border-line pt-8" aria-label="More articles">
            <p className="mb-4 text-sm text-muted">Keep reading</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {others.map((a) => (
                <Link key={a.slug} href={`/wiki/${a.slug}`} className="rounded-2xl border border-line bg-surface p-5 hover:border-line-strong">
                  <span className="block font-serif text-xl">{a.title}</span>
                  <span className="block text-sm text-muted">{a.blurb}</span>
                </Link>
              ))}
            </div>
          </nav>
        </article>

        {/* Never taller than the window, so the market's question and price stay in view while
            you read; the list of other facts scrolls inside it when space is short. */}
        <aside className="hidden w-full lg:sticky lg:top-24 lg:-mx-4 lg:block lg:max-h-[calc(100vh-7rem)] lg:w-[412px] lg:flex-[0_0_412px] lg:overflow-y-auto lg:overscroll-contain lg:px-4 lg:pb-4">
          <MarketCard key={selected} claim={CLAIM_BY_ID[selected]} />
          <OtherFacts claims={claims.map((c) => c.id)} selected={selected} pick={pick} />
        </aside>
      </div>

      {/* Phones and tablets: a bar to open the bet sheet. */}
      <button onClick={() => setSheet(true)} className="fixed inset-x-3 bottom-3 z-30 flex items-center justify-between rounded-2xl bg-ink px-5 py-4 text-left text-white shadow-xl lg:hidden">
        <span className="text-[15px]">Tap any underlined fact to bet</span>
        <span className="text-sm font-semibold">{claims.length} facts</span>
      </button>
      <Sheet open={sheet} onClose={() => setSheet(false)} label={CLAIM_BY_ID[selected].question}>
        <MarketCard key={`sheet-${selected}`} claim={CLAIM_BY_ID[selected]} onBet={afterSheetBet} />
        <OtherFacts claims={claims.map((c) => c.id)} selected={selected} pick={setSelected} />
      </Sheet>
    </main>
  );
}

function OtherFacts({ claims, selected, pick }: { claims: string[]; selected: string; pick: (id: string) => void }) {
  const b = useBook();
  return (
    <div className="mt-6">
      <p className="mb-2 text-sm text-muted">Other facts on this page</p>
      <ul className="space-y-1">
        {claims
          .filter((id) => id !== selected)
          .map((id) => {
            const p = b.price(id);
            const st = b.settled(id);
            return (
              <li key={id}>
                <button onClick={() => pick(id)} className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-[15px] hover:bg-surface">
                  <span className="min-w-0 truncate">{CLAIM_BY_ID[id].question}</span>
                  <span className="tabular shrink-0 text-sm font-semibold" style={{ color: bandHex(p) }}>
                    {st !== undefined ? (st ? "True ✓" : "False ✓") : pct(p)}
                  </span>
                </button>
              </li>
            );
          })}
      </ul>
    </div>
  );
}

function Chip({ children, tone }: { children: React.ReactNode; tone?: "blue" }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 ${tone === "blue" ? "border-blue-200 bg-true-tint text-certain" : "border-line bg-surface text-muted"}`}>
      {children}
    </span>
  );
}

export function Legend() {
  const items = [
    { color: "#1e40af", label: "Almost certain", style: "solid" },
    { color: "#3b82f6", label: "Likely", style: "solid" },
    { color: "#8a8178", label: "Disputed", style: "dashed" },
    { color: "#c2410c", label: "Probably a myth", style: "solid" },
  ];
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-muted">
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-2">
          <span className="w-5" style={{ borderTop: `2.5px ${it.style} ${it.color}` }} />
          {it.label}
        </span>
      ))}
    </div>
  );
}

function ago(now: number, t: number): string {
  if (!now) return "just now";
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 10) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}
