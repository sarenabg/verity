import type { Metadata } from "next";
import Link from "next/link";
import { ARTICLES } from "@/lib/content";

export const metadata: Metadata = { title: "Page not found · Verity" };

export default function NotFound() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-16 sm:px-10">
      <p className="text-sm text-muted">404</p>
      <h1 className="mt-2 font-serif text-[44px] leading-tight font-medium tracking-tight">There&apos;s no page here.</h1>
      <p className="mt-3 text-lg text-muted">The link may be old, or the article doesn&apos;t exist yet. Try one of these:</p>
      <ul className="mt-8 grid gap-3 sm:grid-cols-2">
        {ARTICLES.map((a) => (
          <li key={a.slug}>
            <Link href={`/wiki/${a.slug}`} className="block rounded-2xl border border-line bg-surface p-5 hover:border-line-strong">
              <span className="block font-serif text-xl">{a.title}</span>
              <span className="block text-sm text-muted">{a.blurb}</span>
            </Link>
          </li>
        ))}
      </ul>
      <Link href="/" className="mt-8 inline-block rounded-full bg-ink px-6 py-3.5 font-medium text-white hover:bg-black">
        Back to the start
      </Link>
    </main>
  );
}
