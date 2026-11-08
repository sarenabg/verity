import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleView } from "@/components/ArticleView";
import { ARTICLE_BY_SLUG, ARTICLES } from "@/lib/content";

export function generateStaticParams() {
  return ARTICLES.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const a = ARTICLE_BY_SLUG[slug];
  return { title: a ? `${a.title} · Verity` : "Page not found · Verity" };
}

export default async function WikiPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ fact?: string }> }) {
  const { slug } = await params;
  const { fact } = await searchParams;
  const article = ARTICLE_BY_SLUG[slug];
  if (!article) notFound();
  return <ArticleView key={`${slug}-${fact ?? ""}`} article={article} initialFact={fact} />;
}
