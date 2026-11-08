import assert from "node:assert/strict";
import { test } from "node:test";
import { search } from "./search";

test("finds a fact by its question", () => {
  const hits = search("mallory");
  assert.ok(hits.some((h) => h.href === "/wiki/mount-everest?fact=everest-mallory"));
});

test("finds a fact by words that are only in the article sentence", () => {
  // "Hillary" is in the sentence, not in the question "Were Hillary and Norgay ...", and "Tenzing" only in the sentence.
  assert.ok(search("tenzing").some((h) => h.href.includes("mount-everest")));
});

test("lists the article before its facts, and needs every word", () => {
  const hits = search("pluto");
  assert.equal(hits[0].href, "/wiki/pluto");
  assert.equal(search("pluto octopus").length, 0);
});

test("ignores case, accents and extra spaces; an empty query finds nothing", () => {
  assert.deepEqual(search("  GREAT   wall "), search("great wall"));
  assert.ok(search("Napoléon").length > 0);
  assert.deepEqual(search("   "), []);
});

test("returns at most the limit", () => {
  assert.ok(search("the", 7).length <= 7);
});
