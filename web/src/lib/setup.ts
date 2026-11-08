import { CLAIMS } from "./content";

// What the owner sends to set up the live markets. Used by scripts/live-setup.ts
// (testnet) and the /admin page (mainnet, signed in the owner's wallet).

export function setupPlan(perFactUsdc = 2) {
  const each = Math.round(perFactUsdc * 1e6);
  const createArgs = { claims: CLAIMS.map((c) => ({ id: c.id, question: c.question })) };
  const seedMsg = {
    seed_many: {
      seeds: CLAIMS.map((c) => ({ claim: c.id, price_bps: Math.round(c.start * 10_000), amount: String(each) })),
    },
  };
  return { createArgs, seedMsg, totalUnits: each * CLAIMS.length };
}
