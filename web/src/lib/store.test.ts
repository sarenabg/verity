import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { buy, dispute, DISPUTE_BOND, getState, recoverInterrupted, requestRuling, resetDemo, RULING_BOND, skipWindow, START_BALANCE } from "./store";

// The demo store runs in Node too: no window, so nothing is saved, and the judge is a stub.
type Reply = { verdict: "true" | "false" | "unsettled"; reason: string; votes: [] };
let replies: Reply[] = [];
globalThis.fetch = (async () => {
  const next = replies.shift() ?? { verdict: "false", reason: "stub", votes: [] };
  return { ok: true, json: async () => next };
}) as unknown as typeof fetch;

beforeEach(() => {
  resetDemo();
  replies = [];
});

test("asking the judge twice at once takes one deposit", async () => {
  replies = [{ verdict: "false", reason: "seen from orbit? no", votes: [] }];
  const [a, b] = await Promise.all([requestRuling("wall-space"), requestRuling("wall-space")]);
  assert.equal([a, b].filter((r) => r.ok).length, 1);
  assert.equal(getState().balance, START_BALANCE - RULING_BOND);
});

test("when the panel agrees with the judge, the asker gets both deposits back (as in the contract)", async () => {
  replies = [
    { verdict: "false", reason: "judge", votes: [] },
    { verdict: "false", reason: "panel", votes: [] },
  ];
  await requestRuling("wall-space");
  await dispute("wall-space");
  const s = getState();
  assert.equal(s.settled["wall-space"], false);
  // In the demo you are both the asker and the disputer.
  assert.equal(s.balance, START_BALANCE);
  const kinds = s.trades.map((t) => [t.kind, t.amount]);
  assert.deepEqual(kinds, [
    ["refund", RULING_BOND + DISPUTE_BOND],
    ["deposit", DISPUTE_BOND],
    ["deposit", RULING_BOND],
  ]);
});

test("settling a fact is written in the page history, even when its wording stays the same", async () => {
  replies = [{ verdict: "false", reason: "judge", votes: [] }];
  await requestRuling("wall-space");
  skipWindow("wall-space");
  const s = getState();
  const rev = s.revisions.find((r) => r.claimId === "wall-space");
  assert.ok(rev, "no page-history entry for the settled fact");
  assert.equal(rev.price, 0);
  assert.equal(s.balance, START_BALANCE, "the undisputed asker gets the deposit back");
});

test("winners are paid $1 a share when a fact settles", async () => {
  const r = buy("wall-space", "no", 50);
  assert.ok(r.ok);
  const shares = r.trade.shares;
  replies = [{ verdict: "false", reason: "judge", votes: [] }];
  await requestRuling("wall-space");
  skipWindow("wall-space");
  const won = getState().trades.find((t) => t.kind === "payout" && t.claimId === "wall-space");
  assert.ok(won);
  assert.ok(Math.abs(won.amount - shares) < 1e-9);
});

test("'can't settle yet' returns the deposit and leaves the market open", async () => {
  replies = [{ verdict: "unsettled", reason: "no proof", votes: [] }];
  await requestRuling("everest-mallory");
  const s = getState();
  assert.equal(s.balance, START_BALANCE);
  assert.equal("everest-mallory" in s.settled, false);
  assert.equal(s.rulings["everest-mallory"].stage, "unsettled");
  // and it can be asked again later
  replies = [{ verdict: "unsettled", reason: "still no proof", votes: [] }];
  assert.equal((await requestRuling("everest-mallory")).ok, true);
});

test("a refresh while the judge is thinking gives the deposit back instead of spinning forever", () => {
  const s = { ...getState(), balance: 990, rulings: { "wall-space": { stage: "judging" as const, requestedAt: 1 } } };
  const r = recoverInterrupted(s);
  assert.equal(r.balance, 1000);
  assert.equal(r.rulings["wall-space"], undefined);
  assert.equal(r.trades[0].kind, "refund");
});

test("a refresh during a dispute returns the dispute deposit and keeps the judge's answer", () => {
  const proposed = { stage: "proposed" as const, verdict: "false" as const, reason: "x", requestedAt: 1, windowEnds: 9e15 };
  const s = { ...getState(), balance: 970, rulings: { "wall-space": { ...proposed, stage: "panel" as const, disputed: true } } };
  const r = recoverInterrupted(s);
  assert.equal(r.balance, 970 + DISPUTE_BOND);
  assert.equal(r.rulings["wall-space"].stage, "proposed");
  assert.equal(r.rulings["wall-space"].verdict, "false");
});
