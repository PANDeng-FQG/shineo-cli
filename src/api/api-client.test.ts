import { strict as assert } from "node:assert";
import test from "node:test";
import { ApiClient, ApiError } from "./api-client.js";

test("ApiClient exposes structured HTTP errors", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ error: { message: "权限不足", code: "FORBIDDEN" } }), { status: 403, headers: { "content-type": "application/json" } });
  try {
    const api = await ApiClient.create({ apiUrl: "https://api.example.test", accessToken: "token" });
    await assert.rejects(() => api.get("/private"), (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.status, 403);
      assert.equal(error.message, "权限不足");
      return true;
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
