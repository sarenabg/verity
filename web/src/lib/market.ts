// The betting math behind every fact.
//
// Each fact has a pool of "True" and "False" shares (a fixed-product market
// maker, the design Gnosis and Polymarket use). A share of the right answer is
// worth $1 if the fact is ever settled, so the price of a True share is the
// market's confidence that the fact is true.
//
// The pool never closes: you can always sell your shares back at today's price.
// contracts/verity_market/src/lib.rs implements the same math in integers.

export type Side = "yes" | "no";

/** Outcome-share reserves held by the market maker. Price of "yes" = no / (yes + no). */
export type Pool = { yes: number; no: number };

export function priceOf(pool: Pool): number {
  return pool.no / (pool.yes + pool.no);
}

/** A pool whose True price is `p`, with `depth` setting how much money it takes to move it. */
export function seedPool(p: number, depth: number): Pool {
  if (!(p > 0 && p < 1)) throw new Error("price must be between 0 and 1");
  return { yes: depth * (1 - p), no: depth * p };
}

export type BuyQuote = {
  shares: number; // shares received
  avgPrice: number; // dollars per share
  payout: number; // dollars back if this side wins
  priceAfter: number; // True price after the trade
  pool: Pool; // pool after the trade
};

/**
 * Spend `amount` dollars on `side`.
 * The dollars mint `amount` True + `amount` False shares into the pool; the
 * buyer takes out enough of their side to keep yes * no constant.
 */
export function quoteBuy(pool: Pool, side: Side, amount: number): BuyQuote {
  if (!(amount > 0)) throw new Error("amount must be positive");
  const k = pool.yes * pool.no;
  let next: Pool;
  let shares: number;
  if (side === "yes") {
    const no = pool.no + amount;
    const yes = k / no;
    shares = pool.yes + amount - yes;
    next = { yes, no };
  } else {
    const yes = pool.yes + amount;
    const no = k / yes;
    shares = pool.no + amount - no;
    next = { yes, no };
  }
  return { shares, avgPrice: amount / shares, payout: shares, priceAfter: priceOf(next), pool: next };
}

export type SellQuote = {
  amount: number; // dollars received
  avgPrice: number;
  priceAfter: number;
  pool: Pool;
};

/**
 * Sell `shares` of `side` back to the pool.
 * The seller adds their shares, then the pool burns `r` True + `r` False pairs
 * (worth $r) so that yes * no stays constant. Solves the quadratic for r.
 */
export function quoteSell(pool: Pool, side: Side, shares: number): SellQuote {
  if (!(shares > 0)) throw new Error("shares must be positive");
  const k = pool.yes * pool.no;
  const a = side === "yes" ? pool.yes + shares : pool.no + shares; // our side after adding
  const b = side === "yes" ? pool.no : pool.yes; // the other side
  // (a - r)(b - r) = k  →  r² - (a + b) r + (ab - k) = 0, take the smaller root.
  const sum = a + b;
  const r = (sum - Math.sqrt(sum * sum - 4 * (a * b - k))) / 2;
  const next: Pool = side === "yes" ? { yes: a - r, no: b - r } : { yes: b - r, no: a - r };
  return { amount: r, avgPrice: r / shares, priceAfter: priceOf(next), pool: next };
}

/** Dollars needed to move the True price to `target` (for "how much to flip this fact?"). */
export function costToReach(pool: Pool, target: number): { side: Side; amount: number } {
  const now = priceOf(pool);
  const side: Side = target > now ? "yes" : "no";
  let lo = 0;
  let hi = (pool.yes + pool.no) * 50;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    const p = quoteBuy(pool, side, mid).priceAfter;
    if ((side === "yes" && p < target) || (side === "no" && p > target)) lo = mid;
    else hi = mid;
  }
  return { side, amount: hi };
}

// ---- How sure is the market? ----

export type Band = "certain" | "likely" | "disputed" | "unlikely" | "false";

export function bandOf(p: number): Band {
  if (p >= 0.85) return "certain";
  if (p >= 0.7) return "likely";
  if (p > 0.3) return "disputed";
  if (p > 0.15) return "unlikely";
  return "false";
}

/** Which of the three written versions of a fact the page shows. */
export type Wording = "yes" | "mixed" | "no";

export function wordingOf(p: number): Wording {
  if (p >= 0.7) return "yes";
  if (p > 0.3) return "mixed";
  return "no";
}

export const BAND_LABEL: Record<Band, string> = {
  certain: "Almost certain",
  likely: "Likely",
  disputed: "Disputed",
  unlikely: "Unlikely",
  false: "Probably a myth",
};

export function pct(p: number): string {
  const v = Math.round(p * 100);
  return `${Math.min(99, Math.max(1, v))}%`;
}

export function cents(p: number): string {
  return `${Math.min(99, Math.max(1, Math.round(p * 100)))}¢`;
}

export function money(v: number, digits = 0): string {
  return v.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: digits, maximumFractionDigits: digits });
}
