"use client";

import Link from "next/link";
import { ARTICLES, CLAIMS, claimsOf } from "@/lib/content";
import { useBook } from "@/lib/book";
import { pct } from "@/lib/market";
import { bandHex } from "./ui";

export function Home() {
  const b = useBook();
  const open = CLAIMS.filter((c) => b.settled(c.id) === undefined);
  const disputed = [...open].sort((x, y) => Math.abs(b.price(x.id) - 0.5) - Math.abs(b.price(y.id) - 0.5)).slice(0, 5);
  const mallory = b.price("everest-mallory");

  return (
    <main className="mx-auto max-w-6xl px-5 sm:px-10">
      <section className="grid items-center gap-10 py-14 sm:py-20 lg:grid-cols-[1.25fr_1fr]">
        <div>
          <h1 className="font-serif text-[46px] leading-[1.02] font-medium tracking-tight sm:text-[68px]">
            The encyclopedia that knows how sure it is.
          </h1>
          <p className="mt-5 max-w-lg text-lg text-muted">Every fact has a market. AI writes each page from the odds.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/wiki/mount-everest" className="rounded-full bg-ink px-6 py-3.5 font-medium text-white hover:bg-black">
              Start reading
            </Link>
            <Link href="/how" className="rounded-full border border-line-strong bg-surface px-6 py-3.5 font-medium hover:border-ink">
              How it works
            </Link>
          </div>
        </div>
        <Link href="/wiki/mount-everest?fact=everest-mallory" className="group block rounded-[24px] border border-line bg-surface p-7 shadow-[0_12px_40px_rgba(28,25,23,0.07)]">
          <p className="mb-3 text-sm text-muted">Mount Everest</p>
          <p className="font-serif text-[22px] leading-relaxed text-body">
            <span className="fact" style={{ textDecorationColor: bandHex(mallory), textDecorationStyle: mallory > 0.3 && mallory < 0.7 ? "dashed" : "solid" }}>
              George Mallory reached the summit first, in 1924.
            </span>
          </p>
          <div className="mt-6 flex items-end justify-between gap-4">
            <div>
              <span className="tabular text-5xl font-semibold tracking-tight" style={{ color: bandHex(mallory) }}>
                {pct(mallory)}
              </span>
              <span className="ml-2 text-muted">true</span>
            </div>
            <span className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-white transition group-hover:bg-black">Bet on it</span>
          </div>
        </Link>
      </section>

      <section aria-labelledby="articles" className="pb-6">
        <h2 id="articles" className="mb-5 text-sm font-semibold">
          Articles
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ARTICLES.map((a) => {
            const cs = claimsOf(a.slug);
            return (
              <Link key={a.slug} href={`/wiki/${a.slug}`} className="group rounded-[22px] border border-line p-6 transition hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(28,25,23,0.08)]" style={{ background: a.tint }}>
                <p className="text-sm text-muted">{a.topic}</p>
                <p className="mt-1 font-serif text-[28px] leading-tight font-medium">{a.title}</p>
                <p className="mt-2 text-[15px] text-muted">{a.blurb}</p>
                <div className="mt-6 flex items-center gap-1.5" aria-label={`${cs.length} facts`}>
                  {cs.map((c) => (
                    <span key={c.id} title={`${c.question} ${pct(b.price(c.id))}`} className="h-1.5 flex-1 rounded-full" style={{ background: bandHex(b.price(c.id)) }} />
                  ))}
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="disputed" className="pt-12">
        <h2 id="disputed" className="mb-5 text-sm font-semibold">
          Most disputed right now
        </h2>
        <ul className="divide-y divide-line overflow-hidden rounded-[22px] border border-line bg-surface">
          {disputed.map((c) => {
            const p = b.price(c.id);
            return (
              <li key={c.id}>
                <Link href={`/wiki/${c.article}?fact=${c.id}`} className="flex items-center gap-5 px-6 py-4.5 hover:bg-paper">
                  <span className="min-w-0 flex-1">
                    <span className="block font-serif text-[19px] leading-snug">{c.question}</span>
                    <span className="block text-sm text-faint">{ARTICLES.find((a) => a.slug === c.article)?.title}</span>
                  </span>
                  <span className="hidden h-2 w-40 overflow-hidden rounded-full bg-sunk sm:block">
                    <span className="block h-2 rounded-full" style={{ width: `${p * 100}%`, background: bandHex(p) }} />
                  </span>
                  <span className="tabular w-12 text-right text-lg font-semibold" style={{ color: bandHex(p) }}>
                    {pct(p)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="grid gap-4 pt-16 sm:grid-cols-3">
        {[
          { n: "1", t: "Every fact is a market", d: "Bet True or False. The price is how sure the world is." },
          { n: "2", t: "AI writes the page", d: "Sure facts are stated plainly. Shaky ones are called disputed." },
          { n: "3", t: "Bet with any coin", d: "BTC, ETH, SOL and 200+ more. Cash out any time." },
        ].map((x) => (
          <div key={x.n} className="rounded-[22px] border border-line bg-surface p-6">
            <span className="grid size-9 place-items-center rounded-full bg-ink font-serif text-lg text-white">{x.n}</span>
            <p className="mt-4 font-serif text-[22px] font-medium">{x.t}</p>
            <p className="mt-1 text-[15px] text-muted">{x.d}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
