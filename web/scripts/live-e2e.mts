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
type Claim = { price_bps: number; status: string | Record<string, { verdict?: boolean; proposed_at_ns?: number }> };
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

// 3. Bet False on "Great Wall visible from space", then ask the judge
await ftCall(1 * USDC, { buy: { claim: "wall-space", side: "no" } });
await ftCall(1 * USDC, { request_ruling: { claim: "wall-space" } });
check(stage(await claim("wall-space")) === "Judging", "ruling requested (1 USDC deposit)");
const j = await judge("wall-space");
check(j.status === 200 && j.body.verdict === "false", `judge endpoint ruled ${j.body.verdict ?? j.body.error}${j.body.tx ? ` (tx ${j.body.tx.slice(0, 8)}…)` : ""}`);
const again = await judge("wall-space");
check(again.status === 409, "calling the judge twice does nothing the second time");
const proposed = await claim("wall-space");
check(stage(proposed) === "Proposed", "ruling is on-chain and waiting out the dispute window");

// 4. Dispute path on the Voynich decipherment
await ftCall(1 * USDC, { request_ruling: { claim: "voynich-decoded" } });
await judge("voynich-decoded");
await ftCall(2 * USDC, { dispute: { claim: "voynich-decoded" } });
check(stage(await claim("voynich-decoded")) === "Disputed", "ruling disputed (2 USDC deposit)");
const p = await judge("voynich-decoded", true);
check(p.status === 200 && p.body.panel === true, `3-model panel ruled ${p.body.verdict ?? p.body.error}`);
const v = await claim("voynich-decoded");
check(stage(v) === "Settled", "disputed fact is settled by the panel");

// 5. Wait for the dispute window, finalize, collect and withdraw
const windowNs = (await view<{ dispute_window_ns: number }>(contract, "get_config")).dispute_window_ns;
const endsMs = (proposed.status as Record<string, { proposed_at_ns: number }>).Proposed.proposed_at_ns / 1e6 + windowNs / 1e6;
const wait = Math.max(0, endsMs - Date.now() + 3000);
console.log(`  waiting ${Math.round(wait / 1000)}s for the dispute window…`);
await sleep(wait);
await me.callFunction({ contractId: contract, methodName: "finalize", args: { claim: "wall-space" }, gas: 30n * TGAS });
const settled = await claim("wall-space");
check(stage(settled) === "Settled" && settled.price_bps === 0, "finalized: Great Wall from space = False");
await me.callFunction({ contractId: contract, methodName: "redeem", args: { claim: "wall-space" }, gas: 30n * TGAS });
await me.callFunction({ contractId: contract, methodName: "redeem", args: { claim: "voynich-decoded" }, gas: 30n * TGAS });
const credit2 = Number((await view<{ credit: string }>(contract, "get_account", { account: bettor })).credit);
check(credit2 > credit1, `winnings + bonds waiting: ${credit2 / USDC} USDC`);
const balBefore = Number(await view<string>(token, "ft_balance_of", { account_id: bettor }));
await me.callFunction({ contractId: contract, methodName: "withdraw", args: {}, gas: 60n * TGAS });
await sleep(3000);
const balAfter = Number(await view<string>(token, "ft_balance_of", { account_id: bettor }));
check(balAfter - balBefore === credit2, `withdrew ${(balAfter - balBefore) / USDC} USDC to the wallet`);

console.log(failed ? `\n${failed} check(s) failed` : "\nAll live checks passed");
process.exit(failed ? 1 : 0);
