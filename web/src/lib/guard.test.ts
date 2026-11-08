import assert from "node:assert/strict";
import { test } from "node:test";
import { createGuard } from "./guard";

test("a double click runs the action once", async () => {
  let calls = 0;
  const g = createGuard();
  const slow = () => new Promise<number>((r) => setTimeout(() => r(++calls), 20));
  const [a, b] = await Promise.all([g.run(slow), g.run(slow)]);
  assert.equal(calls, 1);
  assert.equal(a, 1);
  assert.equal(b, undefined);
});

test("an instant action still ignores the second click of a double click", async () => {
  let calls = 0;
  const g = createGuard();
  await g.run(() => ++calls); // finishes at once, like a Demo bet
  await g.run(() => ++calls); // the double click's second click
  assert.equal(calls, 1);
});

test("a different action right after the first one is not held up", async () => {
  const g = createGuard();
  await g.run(() => "asked", "ask");
  assert.equal(await g.run(() => "disputed", "dispute"), "disputed");
  assert.equal(await g.run(() => "asked again", "ask"), undefined);
});

test("the next click works after the cool-down, even if the first action failed", async () => {
  const g = createGuard(undefined, 30);
  await assert.rejects(g.run(() => Promise.reject(new Error("wallet closed"))));
  assert.equal(g.busy(), false);
  await new Promise((r) => setTimeout(r, 40));
  assert.equal(await g.run(() => 7), 7);
});

test("busy is reported while the action runs", async () => {
  const seen: boolean[] = [];
  const g = createGuard((b) => seen.push(b));
  await g.run(async () => assert.equal(g.busy(), true));
  assert.deepEqual(seen, [true, false]);
});
