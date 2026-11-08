// Smoke test: starts the built app (run `npm run build` first) and checks that
// every page and API answers. Works offline: the quote API falls back to an estimate.
//   npm run build && npm run smoke
import { spawn } from "node:child_process";

const PORT = Number(process.env.SMOKE_PORT || 3299);
const BASE = `http://localhost:${PORT}`;
const server = spawn("npx", ["next", "start", "-p", String(PORT)], { cwd: new URL("..", import.meta.url), stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, NEAR_AI_API_KEY: "" } });
let log = "";
server.stdout.on("data", (d) => (log += d));
server.stderr.on("data", (d) => (log += d));

let failed = 0;
const check = (ok, label) => {
  console.log(`${ok ? "✓" : "✗"} ${label}`);
  if (!ok) failed++;
};

async function waitUp() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(BASE);
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`server did not start:\n${log}`);
}

const page = async (path, ...needles) => {
  const r = await fetch(BASE + path);
  const html = await r.text();
  check(r.status === 200 && needles.every((n) => html.includes(n)), `GET ${path} → ${r.status}${needles.length ? ` contains ${needles.map((n) => JSON.stringify(n)).join(", ")}` : ""}`);
};

const post = async (path, body) => {
  const r = await fetch(BASE + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { status: r.status, json: await r.json() };
};

try {
  await waitUp();
  await page("/", "The encyclopedia that knows how sure it is", "Most disputed right now");
  await page("/wiki/mount-everest", "Mount Everest", "8,848.86", "The market says");
  for (const slug of ["pluto", "octopus", "great-wall-of-china", "voynich-manuscript", "napoleon"]) await page(`/wiki/${slug}`, "The market says");
  await page("/bets", "My bets");
  await page("/admin", "Set up live markets");
  await page("/how", "How Verity works", "Checkable facts can be settled");
  const missing = await fetch(`${BASE}/wiki/not-a-page`);
  check(missing.status === 404, `GET /wiki/not-a-page → 404`);

  const lj = await post("/api/live/judge", { claimId: "nope" });
  check(lj.status === 400, "/api/live/judge rejects unknown facts");
  const ld = await post("/api/live/deposit", { symbol: "ETH", chain: "eth", usd: 0, account: "x" });
  check(ld.status === 400, "/api/live/deposit validates its input");

  const status = await (await fetch(`${BASE}/api/status`)).json();
  check(status.nearAi === false, "/api/status reports demo mode without a key");

  const w = await post("/api/write", { claimId: "everest-mallory", price: 0.45 });
  check(w.status === 200 && w.json.writer === "demo" && w.json.text.includes("open question"), "/api/write picks the 'disputed' wording at 45%");
  const bad = await post("/api/write", { claimId: "nope", price: 0.5 });
  check(bad.status === 400, "/api/write rejects unknown facts");

  const j1 = await post("/api/judge", { claimId: "wall-space", panel: false });
  check(j1.json.verdict === "false" && j1.json.votes.length === 1, "/api/judge: Great Wall from space → False");
  const j2 = await post("/api/judge", { claimId: "everest-mallory", panel: true });
  check(j2.json.verdict === "unsettled" && j2.json.votes.length === 3, "/api/judge: Mallory → can't settle yet, 3-model panel");

  const q = await (await fetch(`${BASE}/api/quote?symbol=ETH&chain=eth&usd=20`)).json();
  check(q.amountIn > 0 && ["near-intents", "price", "estimate"].includes(q.source), `/api/quote: $20 = ${q.amountIn} ETH (${q.source})`);
} catch (e) {
  console.error(e);
  failed++;
} finally {
  server.kill();
}
console.log(failed ? `\n${failed} check(s) failed` : "\nAll smoke checks passed");
process.exit(failed ? 1 : 0);
