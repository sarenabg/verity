import assert from "node:assert/strict";
import { test } from "node:test";
import { amountDigits, cleanAmount } from "./amount";

test("an amount box keeps digits, one dot and cents", () => {
  assert.equal(cleanAmount("1.2.3"), "1.23");
  assert.equal(cleanAmount("12.345"), "12.34");
  assert.equal(cleanAmount("abc"), "");
  assert.equal(cleanAmount("$1,000"), "1000");
  assert.equal(cleanAmount(".5"), "0.5");
  assert.equal(cleanAmount("007"), "7");
  assert.equal(cleanAmount("20"), "20");
  assert.equal(cleanAmount("0.25", 6), "0.25");
});

test("whole amounts show without cents, others with cents", () => {
  assert.equal(amountDigits(20), 0);
  assert.equal(amountDigits(0.5), 2);
});
