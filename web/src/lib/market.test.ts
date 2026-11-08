import assert from "node:assert/strict";
import { test } from "node:test";
import { bandOf, costToReach, priceOf, quoteBuy, quoteSell, seedPool, wordingOf } from "./market";
import { ARTICLES, CLAIMS, CLAIM_BY_ID } from "./content";

const close = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test("a seeded pool starts at its price", () => {
  for (const p of [0.05, 0.14, 0.5, 0.72, 0.99]) close(priceOf(seedPool(p, 1000)), p);
});

test("buying True raises the price, buying False lowers it", () => {
  const pool = seedPool(0.4, 1000);
  assert.ok(quoteBuy(pool, "yes", 50).priceAfter > 0.4);
  assert.ok(quoteBuy(pool, "no", 50).priceAfter < 0.4);
});

test("the pool keeps yes × no constant", () => {
  const pool = seedPool(0.3, 800);
  const k = pool.yes * pool.no;
  const q = quoteBuy(pool, "yes", 123);
  close(q.pool.yes * q.pool.no, k, 1e-6);
  const s = quoteSell(q.pool, "yes", q.shares / 2);
  close(s.pool.yes * s.pool.no, k, 1e-6);
});

test("a share costs less than $1, so winning pays more than you bet", () => {
  const q = quoteBuy(seedPool(0.14, 800), "yes", 20);
  assert.ok(q.avgPrice > 0.14 && q.avgPrice < 1);
  assert.ok(q.payout > 20);
});

test("buying then selling right away gets your money back (no fee)", () => {
  const pool = seedPool(0.55, 900);
  const q = quoteBuy(pool, "no", 75);
  const s = quoteSell(q.pool, "no", q.shares);
  close(s.amount, 75, 1e-6);
  close(priceOf(s.pool), 0.55, 1e-9);
});

test("cost to reach a target price is consistent with quoteBuy", () => {
  const pool = seedPool(0.14, 800);
  const { side, amount } = costToReach(pool, 0.3);
  assert.equal(side, "yes");
  close(quoteBuy(pool, side, amount).priceAfter, 0.3, 1e-6);
});

test("bands and wordings", () => {
  assert.equal(bandOf(0.99), "certain");
  assert.equal(bandOf(0.75), "likely");
  assert.equal(bandOf(0.5), "disputed");
  assert.equal(bandOf(0.2), "unlikely");
  assert.equal(bandOf(0.05), "false");
  assert.equal(wordingOf(0.7), "yes");
  assert.equal(wordingOf(0.5), "mixed");
  assert.equal(wordingOf(0.3), "no");
});

test("content: every paragraph's facts exist and belong to the article", () => {
  for (const a of ARTICLES) {
    for (const para of a.paragraphs) {
      for (const seg of para) {
        if (typeof seg === "string") continue;
        const c = CLAIM_BY_ID[seg.claim];
        assert.ok(c, `missing claim ${seg.claim}`);
        assert.equal(c.article, a.slug);
      }
    }
  }
  const used = new Set(ARTICLES.flatMap((a) => a.paragraphs.flat()).filter((s) => typeof s !== "string").map((s) => (s as { claim: string }).claim));
  for (const c of CLAIMS) assert.ok(used.has(c.id), `claim ${c.id} is never shown`);
});

test("content: checkable facts have a truth, prices are sensible", () => {
  for (const c of CLAIMS) {
    assert.ok(c.start > 0 && c.start < 1, c.id);
    if (c.checkable) assert.equal(typeof c.truth, "boolean", c.id);
    assert.ok(c.sources.length > 0, c.id);
  }
});

test("demo story: a $100 bet flips the Mallory fact's wording", () => {
  const c = CLAIM_BY_ID["everest-mallory"];
  const pool = seedPool(c.start, c.depth);
  assert.equal(wordingOf(priceOf(pool)), "no");
  assert.equal(wordingOf(quoteBuy(pool, "yes", 100).priceAfter), "mixed");
});
