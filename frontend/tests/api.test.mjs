import test from "node:test";
import assert from "node:assert/strict";
import { ApiClient, ApiError } from "../assets/js/api.mjs";

function response(payload, status = 200) {
  return { ok: status >= 200 && status < 300, status, async json() { return payload; } };
}

test("client unwraps data", async () => {
  const client = new ApiClient("http://example.test/api/v1/", async () => response({ data: [{ id: "1" }] }));
  assert.deepEqual(await client.transactions(), [{ id: "1" }]);
});
test("client sends JSON for create", async () => {
  let options;
  const client = new ApiClient("http://example.test/api/v1", async (_url, received) => { options = received; return response({ data: { id: "1" } }, 201); });
  await client.createTransaction({ amount: "1" });
  assert.equal(options.method, "POST");
  assert.equal(options.headers["Content-Type"], "application/json");
});
test("client maps API error", async () => {
  const client = new ApiClient("http://example.test/api/v1", async () => response({ error: { code: "validation_error", message: "Bad amount" } }, 422));
  await assert.rejects(() => client.transactions(), (error) => error instanceof ApiError && error.code === "validation_error" && error.status === 422);
});
test("client maps network error", async () => {
  const client = new ApiClient("http://example.test/api/v1", async () => { throw new Error("offline"); });
  await assert.rejects(() => client.health(), /could not be reached/);
});
test("delete accepts empty response", async () => {
  const client = new ApiClient("http://example.test/api/v1", async () => ({ ok: true, status: 204 }));
  assert.equal(await client.deleteTransaction("1"), null);
});

