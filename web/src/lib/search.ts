import { ARTICLE_BY_SLUG, ARTICLES, CLAIMS } from "./content";

export type Hit = { href: string; label: string; sub: string };

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * Articles first, then facts. Every word of the query must appear somewhere in the item
 * (title, topic and blurb for articles; the question and all three wordings for facts).
 */
export function search(query: string, limit = 7): Hit[] {
  const words = norm(query).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const has = (text: string) => {
    const t = norm(text);
    return words.every((w) => t.includes(w));
  };
  const arts = ARTICLES.filter((a) => has(`${a.title} ${a.topic} ${a.blurb}`))
    .sort((x, y) => Number(norm(y.title).startsWith(words[0])) - Number(norm(x.title).startsWith(words[0])))
    .map((a) => ({ href: `/wiki/${a.slug}`, label: a.title, sub: a.topic }));
  const facts = CLAIMS.filter((c) => has(`${c.question} ${c.yes} ${c.mixed} ${c.no}`))
    .sort((x, y) => Number(has(y.question)) - Number(has(x.question)))
    .map((c) => ({ href: `/wiki/${c.article}?fact=${c.id}`, label: c.question, sub: ARTICLE_BY_SLUG[c.article]?.title ?? "" }));
  return [...arts, ...facts].slice(0, limit);
}
