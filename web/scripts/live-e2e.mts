// End-to-end test of Live mode on NEAR testnet, through the real contract and
// the app's own judge endpoint. Uses throwaway testnet accounts from
// ~/.near-credentials/testnet and test USDC. No real money.
//
//   npm run dev                      (with .env.local pointing at the testnet contract)
//   npx tsx scripts/live-e2e.mts --contract verity-market-x.testnet --token verity-musdc-x.testnet \
//     --bettor verity-alice-x.testnet [--base http://localhost:3200]
//
// Covers: bet → price moves → cash out → ask the judge → ruling on-chain →
// finalize after the dispute window → collect winnings → withdraw to wallet;
// and the dispute path with the 3-model panel.

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { CLAIMS } from "../src/lib/content";

const args = process.argv.slice(2);
const flag = (n: string, d?: string) => (args.indexOf(`--${n}`) >= 0 ? args[args.indexOf(`--${n}`) + 1] : d);
const contract = flag("contract")!;
const token = flag("token")!;
const bettor = flag("bettor")!;
const base = flag("base", "http://localhost:3200")!;
const rpc = "https://test.rpc.fastnear.com";

const { Account } = await import("@near-js/accounts");
const { JsonRpcProvider } = await import("@near-js/providers");
const { KeyPairSigner } = await import("@near-js/signers");
const provider = new JsonRpcProvider({ url: rpc });
const key = JSON.parse(readFileSync(`${homedir()}/.near-credentials/testnet/${bettor}.json`, "utf8")).private_key;
const me = new Account(bettor, provider, KeyPairSigner.fromSecretKey(key));
const TGAS = 10n ** 12n;
const USDC = 1_000_000;

let failed = 0;
const check = (ok: boolean, label: string) => {
  console.log(`${ok ? "✓" : "✗"} ${label}`);
  if (!ok) failed++;
};
const view = <T,>(contractId: string, method: string, a: object = {}) => provider.callFunction(contractId, method, a) as Promise<T>;
type Claim = { price_bps: number; status: string | Record<string, { verdict?: boolean; proposed_at_ns?: number } | undefined> };
const claim = (id: string) => view<Claim>(contract, "get_claim", { id });
const ftCall = (amount: number, msg: object) =>
  me.callFunction({ contractId: token, methodName: "ft_transfer_call", args: { receiver_id: contract, amount: String(amount), msg: JSON.stringify(msg) }, deposit: 1n, gas: 100n * TGAS });
const judge = async (claimId: string, panel = false) => {
  const res = await fetch(`${base}/api/live/judge`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ claimId, panel }) });
  return { status: res.status, body: await res.json() };
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const stage = (c: Claim) => (typeof c.status === "string" ? c.status : Object.keys(c.status)[0]);

// 0. Test money
await me.callFunction({ contractId: token, methodName: "mint", args: { account_id: bettor, amount: String(30 * USDC) }, gas: 30n * TGAS });
const startBal = Number(await view<string>(token, "ft_balance_of", { account_id: bettor }));
check(startBal >= 30 * USDC, `bettor has ${startBal / USDC} test USDC`);

// 1. Bet True on Mallory: the price goes up
const before = (await claim("everest-mallory")).price_bps;
await ftCall(1 * USDC, { buy: { claim: "everest-mallory", side: "yes" } });
const after = (await claim("everest-mallory")).price_bps;
check(after > before, `bet 1 USDC on True: Mallory ${before / 100}% → ${after / 100}%`);
const acct = await view<{ credit: string; positions: { claim: string; yes: string }[] }>(contract, "get_account", { account: bettor });
const pos = acct.positions.find((p) => p.claim === "everest-mallory");
check(Boolean(pos && Number(pos.yes) > USDC), `account view shows ${Number(pos?.yes) / USDC} True shares`);

// 2. Cash out half
const half = String(Math.floor(Number(pos!.yes) / 2));
await me.callFunction({ contractId: contract, methodName: "sell", args: { claim: "everest-mallory", side: "yes", shares: half }, gas: 50n * TGAS });
const credit1 = Number((await view<{ credit: string }>(contract, "get_account", { account: bettor })).credit);
check(credit1 > 0, `cashed out half: ${credit1 / USDC} USDC waiting to withdraw`);
const hist = await view<[number, number][]>(contract, "get_history", { claim: "everest-mallory" });
check(hist.length >= 3, `chart history has ${hist.length} points`);

// Settling is permanent, so each run uses checkable facts that are still open on the contract.
// (The demo judge rules each one by its `truth` in content.ts; a NEAR AI key makes it decide itself.)
const open: typeof CLAIMS = [];
for (const c of CLAIMS.filter((x) => x.checkable)) {
  if (stage(await claim(c.id)) === "Open") open.push(c);
  if (open.length === 2) break;
}
if (open.length < 2) {
  console.log("✗ fewer than 2 checkable facts are still open on this contract: deploy a fresh testnet contract (scripts/live-setup.mts)");
  process.exit(1);
}
const [A, B] = open;
const sideA = A.truth ? "yes" : "no";
console.log(`  judging "${A.id}" (expect ${A.truth ? "True" : "False"}); disputing "${B.id}"`);

// 3. Bet on the side the judge will pick, then ask the judge
await ftCall(1 * USDC, { buy: { claim: A.id, side: sideA } });
await ftCall(1 * USDC, { request_ruling: { claim: A.id } });
check(stage(await claim(A.id)) === "Judging", "ruling requested (1 USDC deposit)");
const j = await judge(A.id);
check(j.status === 200 && (j.body.verdict === "true" || j.body.verdict === "false"), `judge endpoint ruled ${j.body.verdict ?? j.body.error}${j.body.tx ? ` (tx ${j.body.tx.slice(0, 8)}…)` : ""}`);
const again = await judge(A.id);
check(again.status === 409, "calling the judge twice does nothing the second time");
const proposed = await claim(A.id);
check(stage(proposed) === "Proposed", "ruling is on-chain and waiting out the dispute window");

// 4. Dispute path: ask, then dispute, then the 3-model panel decides
await ftCall(1 * USDC, { request_ruling: { claim: B.id } });
await judge(B.id);
await ftCall(2 * USDC, { dispute: { claim: B.id } });
check(stage(await claim(B.id)) === "Disputed", "ruling disputed (2 USDC deposit)");
const p = await judge(B.id, true);
check(p.status === 200 && p.body.panel === true, `3-model panel ruled ${p.body.verdict ?? p.body.error}`);
const v = await claim(B.id);
check(stage(v) === "Settled", "disputed fact is settled by the panel");

// 5. Wait for the dispute window, finalize, collect and withdraw
const windowNs = (await view<{ dispute_window_ns: number }>(contract, "get_config")).dispute_window_ns;
const proposedAt = typeof proposed.status === "object" ? proposed.status.Proposed?.proposed_at_ns : undefined;
const endsMs = (proposedAt ?? Date.now() * 1e6) / 1e6 + windowNs / 1e6;
const wait = Math.max(0, endsMs - Date.now() + 3000);
console.log(`  waiting ${Math.round(wait / 1000)}s for the dispute window…`);
await sleep(wait);
await me.callFunction({ contractId: contract, methodName: "finalize", args: { claim: A.id }, gas: 30n * TGAS });
const settled = await claim(A.id);
const wantBps = j.body.verdict === "true" ? 10_000 : 0;
check(stage(settled) === "Settled" && settled.price_bps === wantBps, `finalized: ${A.id} = ${j.body.verdict}`);
await me.callFunction({ contractId: contract, methodName: "redeem", args: { claim: A.id }, gas: 30n * TGAS });
if (stage(await claim(B.id)) === "Settled") await me.callFunction({ contractId: contract, methodName: "redeem", args: { claim: B.id }, gas: 30n * TGAS });
const credit2 = Number((await view<{ credit: string }>(contract, "get_account", { account: bettor })).credit);
check(credit2 > credit1, `winnings + bonds waiting: ${credit2 / USDC} USDC`);
const balBefore = Number(await view<string>(token, "ft_balance_of", { account_id: bettor }));
await me.callFunction({ contractId: contract, methodName: "withdraw", args: {}, gas: 60n * TGAS });
await sleep(3000);
const balAfter = Number(await view<string>(token, "ft_balance_of", { account_id: bettor }));
check(balAfter - balBefore === credit2, `withdrew ${(balAfter - balBefore) / USDC} USDC to the wallet`);

console.log(failed ? `\n${failed} check(s) failed` : "\nAll live checks passed");
process.exit(failed ? 1 : 0);
