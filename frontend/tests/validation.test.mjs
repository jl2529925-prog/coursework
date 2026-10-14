import test from "node:test";
import assert from "node:assert/strict";

import { formToTransaction, validateBudgetRows, validateTransaction } from "../assets/js/validation.mjs";

const validTransaction = { occurred_on: "2026-08-05", type: "expense", category: "Food", amount: "12.50", note: "Lunch" };

test("valid transaction passes", () => assert.equal(validateTransaction(validTransaction).valid, true));
test("invalid calendar date fails", () => assert.match(validateTransaction({ ...validTransaction, occurred_on: "2026-02-30" }).errors.occurred_on, /valid/));
test("missing type fails", () => assert.ok(validateTransaction({ ...validTransaction, type: "" }).errors.type));
test("missing category fails", () => assert.ok(validateTransaction({ ...validTransaction, category: " " }).errors.category));
test("long category fails", () => assert.ok(validateTransaction({ ...validTransaction, category: "a".repeat(41) }).errors.category));
test("zero amount fails", () => assert.ok(validateTransaction({ ...validTransaction, amount: "0" }).errors.amount));
test("three decimal places fail", () => assert.ok(validateTransaction({ ...validTransaction, amount: "1.999" }).errors.amount));
test("comma grouped amount passes", () => assert.equal(validateTransaction({ ...validTransaction, amount: "1,234.50" }).valid, true));
test("long note fails", () => assert.ok(validateTransaction({ ...validTransaction, note: "n".repeat(161) }).errors.note));

test("valid budget rows normalize limits", () => {
  const result = validateBudgetRows([{ category: "Food", limit: "800" }, { category: "Study", limit: "350.5" }]);
  assert.equal(result.valid, true);
  assert.deepEqual(result.limits, { Food: "800.00", Study: "350.50" });
});

test("duplicate budget category fails", () => {
  const result = validateBudgetRows([{ category: "Food", limit: "800" }, { category: "Food", limit: "100" }]);
  assert.ok(result.errors["category-1"]);
});

test("empty budget fails at form level", () => assert.ok(validateBudgetRows([{ category: "", limit: "" }]).errors.form));
test("partial budget row fails", () => assert.ok(validateBudgetRows([{ category: "Food", limit: "" }]).errors["limit-0"]));

test("form data converts to trimmed payload", () => {
  const data = new FormData();
  for (const [key, value] of Object.entries({ ...validTransaction, category: " Food " })) data.set(key, value);
  assert.equal(formToTransaction(data).category, "Food");
});

