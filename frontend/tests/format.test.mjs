import test from "node:test";
import assert from "node:assert/strict";
import { clamp, currencySymbol, money, periodLabel, readableDate } from "../assets/js/format.mjs";

test("money uses requested currency", () => assert.match(money(12.5, "CNY"), /12\.50/));
test("currency symbol is returned", () => assert.equal(currencySymbol("CNY"), "¥"));
test("date is readable", () => assert.match(readableDate("2026-08-05"), /05/));
test("period label contains month and year", () => assert.match(periodLabel("2026-08"), /August 2026/));
test("clamp enforces both bounds", () => { assert.equal(clamp(-1, 0, 10), 0); assert.equal(clamp(20, 0, 10), 10); });

