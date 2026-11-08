import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { chainLogo, COINS, coinLogo } from "./coins";
import { WALLETS } from "./wallet";

const pub = (p: string) => join(process.cwd(), "public", p);

test("every coin and chain shown in the coin picker has a logo file", () => {
  for (const c of COINS) {
    assert.ok(existsSync(pub(coinLogo(c))), `missing ${coinLogo(c)}`);
    if (c.chain !== c.symbol.toLowerCase()) assert.ok(existsSync(pub(chainLogo(c))), `missing ${chainLogo(c)}`);
  }
});

test("logo SVGs are small, self-contained drawings (a broken one rendered as fragments)", () => {
  for (const c of COINS) {
    const svg = readFileSync(pub(coinLogo(c)), "utf8");
    assert.match(svg, /^<svg[\s>]/, `${c.symbol} is not an SVG`);
    assert.ok(svg.length < 12_000, `${c.symbol} logo is ${svg.length} bytes; keep coin logos simple`);
    assert.doesNotMatch(svg, /<script|href="http/i, `${c.symbol} logo loads something external`);
  }
});

test("every wallet in the connect window has its logo", () => {
  for (const w of WALLETS) assert.ok(existsSync(pub(w.icon)), `missing ${w.icon}`);
});
