import type { Metadata } from "next";
import Link from "next/link";
import { Legend } from "@/components/ArticleView";

export const metadata: Metadata = { title: "How it works · Verity" };

const STEPS = [
  {
    t: "Every fact is a market",
    d: "Each sentence has True and False shares. A True share pays $1 if the fact is ever settled true. Its price is the market's confidence.",
    art: (
      <div className="flex items-center gap-2">
        <span className="rounded-xl bg-true-tint px-3 py-2 text-sm font-semibold text-certain">True 14¢</span>
        <span className="rounded-xl bg-false-tint px-3 py-2 text-sm font-semibold text-false">False 86¢</span>
      </div>
    ),
  },
  {
    t: "AI writes the page from the odds",
    d: "70% or more: stated plainly. 30–70%: called disputed. Under 30%: called doubtful. When a bet moves a fact across a line, the AI rewrites that sentence.",
    art: <Legend />,
  },
  {
    t: "Markets never close",
    d: "No end date. Cash out any time at today's price. If you were early and right, you profit when others catch up.",
    art: <span className="tabular font-serif text-3xl text-certain">14% → 31%</span>,
  },
  {
    t: "Checkable facts can be settled",
    d: "Anyone can ask the AI judge for a final answer by leaving a small deposit. Anyone can dispute the answer for a while afterwards, with a bigger deposit. A dispute goes to three different AI models, and the majority wins. Then winning shares pay $1. In Demo the deposits are $10 and $20 and the wait is 48 hours.",
    art: (
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded-full bg-sunk px-3 py-1.5">Ask</span>→<span className="rounded-full bg-sunk px-3 py-1.5">Judge</span>→<span className="rounded-full bg-sunk px-3 py-1.5">48h</span>→
        <span className="rounded-full bg-ink px-3 py-1.5 text-white">Paid</span>
      </div>
    ),
  },
  {
    t: "Bet with any coin",
    d: "NEAR Intents changes BTC, ETH, SOL and 200+ other coins into dollars on NEAR in about 30 seconds.",
    art: (
      <span className="flex -space-x-2">
        {["BTC", "ETH", "SOL", "USDC", "NEAR", "XRP"].map((c) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={c} src={`/icons/coins/${c}.svg`} alt={c} width={34} height={34} className="rounded-full ring-2 ring-white" />
        ))}
      </span>
    ),
  },
];

const REAL = [
  ["The betting math", "Same rules in the app and in the NEAR contract, with tests"],
  ["Prices in any coin", "Live quotes from NEAR Intents"],
  ["The AI writer and judge", "NEAR AI, running in sealed computers. When it's switched off, prewritten answers stand in."],
];
const DEMO = [
  ["Your money", "$1,000 of play money, kept in your browser"],
  ["Paying with coins", "The quote is real; no coins move"],
  ["The 48-hour wait", "A button skips it"],
];

export default function HowPage() {
  return (
    <main className="mx-auto max-w-4xl px-5 py-12 sm:px-10">
      <h1 className="font-serif text-[44px] leading-tight font-medium tracking-tight sm:text-[56px]">How Verity works</h1>
      <ol className="mt-10 space-y-4">
        {STEPS.map((s, i) => (
          <li key={s.t} className="flex flex-wrap items-center gap-6 rounded-[22px] border border-line bg-surface p-6">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-ink font-serif text-lg text-white">{i + 1}</span>
            <div className="min-w-0 flex-[1_1_300px]">
              <h2 className="font-serif text-[24px] font-medium">{s.t}</h2>
              <p className="mt-1 text-[15px] leading-relaxed text-muted">{s.d}</p>
            </div>
            <div className="max-w-full min-w-0">{s.art}</div>
          </li>
        ))}
      </ol>

      <section className="mt-14 grid gap-4 sm:grid-cols-2">
        <Box title="Real" rows={REAL} dot="bg-certain" />
        <Box title="Demo" rows={DEMO} dot="bg-unlikely" />
      </section>

      <div className="mt-12 text-center">
        <Link href="/wiki/mount-everest?fact=everest-mallory" className="inline-block rounded-full bg-ink px-6 py-3.5 font-medium text-white hover:bg-black">
          Try it on Mount Everest
        </Link>
      </div>
    </main>
  );
}

function Box({ title, rows, dot }: { title: string; rows: string[][]; dot: string }) {
  return (
    <div className="rounded-[22px] border border-line bg-surface p-6">
      <h2 className="mb-4 flex items-center gap-2 font-semibold">
        <span className={`size-2.5 rounded-full ${dot}`} />
        {title}
      </h2>
      <dl className="space-y-3">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt className="text-[15px] font-medium">{k}</dt>
            <dd className="text-sm text-muted">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
