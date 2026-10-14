import test from "node:test";
import assert from "node:assert/strict";
import { BrowserStore, defaultPreferences, mergePreferences } from "../assets/js/storage.mjs";

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, value); }
  removeItem(key) { this.values.delete(key); }
}

test("store writes and reads namespaced JSON", () => {
  const store = new BrowserStore(new MemoryStorage());
  assert.equal(store.write("draft", { amount: "12" }), true);
  assert.deepEqual(store.read("draft"), { amount: "12" });
});
test("store removes data", () => { const store = new BrowserStore(new MemoryStorage()); store.write("x", 1); store.remove("x"); assert.equal(store.read("x"), null); });
test("malformed storage returns fallback", () => { const memory = new MemoryStorage(); memory.setItem("ledgerleaf:x", "{"); assert.deepEqual(new BrowserStore(memory).read("x", []), []); });
test("preferences retain valid choices", () => assert.equal(mergePreferences({ currency: "EUR" }).currency, "EUR"));
test("preferences reject invalid API schemes", () => assert.equal(mergePreferences({ apiBase: "file:///x" }).apiBase, defaultPreferences.apiBase));

