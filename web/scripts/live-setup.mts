// Set up the live markets: create every fact on the contract and give each one
// its starting money (liquidity) at its starting price.
//
//   npx tsx scripts/live-setup.mts plan                       # print what will be sent (no signing)
//   npx tsx scripts/live-setup.mts run --network testnet \
//     --contract verity-market-x.testnet --token verity-musdc-x.testnet \
//     --owner verity-owner-x.testnet [--per-fact 2]          # sign with ~/.near-credentials (testnet only)
//
// On mainnet, use the /admin page instead: the owner signs each step in their own wallet.

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { setupPlan } from "../src/lib/setup.ts";

const args = process.argv.slice(2);
const flag = (name: string, fallback?: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};

const perFact = Number(flag("per-fact", "2"));
const plan = setupPlan(perFact);

if (args[0] !== "run") {
  console.log(JSON.stringify({ create_claims: plan.createArgs, seed_many_msg: plan.seedMsg, total_usdc: plan.totalUnits / 1e6 }, null, 2));
  process.exit(0);
}

const network = flag("network", "testnet")!;
if (network !== "testnet") {
  console.error("This script only signs on testnet. On mainnet, use the /admin page and your own wallet.");
  process.exit(1);
}
const contract = flag("contract")!;
const token = flag("token")!;
const owner = flag("owner")!;
const rpc = "https://test.rpc.fastnear.com";

const { Account } = await import("@near-js/accounts");
const { JsonRpcProvider } = await import("@near-js/providers");
const { KeyPairSigner } = await import("@near-js/signers");

const keyOf = (acc: string) => JSON.parse(readFileSync(`${homedir()}/.near-credentials/testnet/${acc}.json`, "utf8")).private_key;
const provider = new JsonRpcProvider({ url: rpc });
const ownerAcc = new Account(owner, provider, KeyPairSigner.fromSecretKey(keyOf(owner)));
const TGAS = 10n ** 12n;

console.log(`1/4 Test USDC for the owner (${plan.totalUnits / 1e6})`);
for (let left = plan.totalUnits; left > 0; left -= 1_000_000_000) {
  await ownerAcc.callFunction({ contractId: token, methodName: "mint", args: { account_id: owner, amount: String(Math.min(left, 1_000_000_000)) }, gas: 30n * TGAS });
}
console.log("2/4 Let the contract hold the token");
await ownerAcc.callFunction({ contractId: token, methodName: "storage_deposit", args: { account_id: contract, registration_only: true }, deposit: 1_250_000_000_000_000_000_000n, gas: 30n * TGAS });
console.log(`3/4 Create ${plan.createArgs.claims.length} facts`);
await ownerAcc.callFunction({ contractId: contract, methodName: "create_claims", args: plan.createArgs, gas: 300n * TGAS });
console.log("4/4 Seed every market");
await ownerAcc.callFunction({
  contractId: token,
  methodName: "ft_transfer_call",
  args: { receiver_id: contract, amount: String(plan.totalUnits), msg: JSON.stringify(plan.seedMsg) },
  deposit: 1n,
  gas: 300n * TGAS,
});
console.log("Done.");
