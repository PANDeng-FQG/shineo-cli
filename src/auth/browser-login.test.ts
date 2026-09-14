import assert from "node:assert/strict";
import { test } from "node:test";
import { exchangePkceCode, renderCallbackPage } from "./browser-login.js";

test("exchangePkceCode follows the Supabase PKCE request contract", async () => {
  const originalFetch = globalThis.fetch;
  let request: Request | undefined;
  globalThis.fetch = async (input, init) => {
    request = new Request(input, init);
    return new Response(JSON.stringify({ access_token: "access-token", refresh_token: "refresh-token" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  try {
    await assert.doesNotReject(() => exchangePkceCode("http://localhost:8100", "anon-key", "auth-code", "verifier"));
    assert.equal(request?.url, "http://localhost:8100/auth/v1/token?grant_type=pkce");
    assert.equal(request?.headers.get("apikey"), "anon-key");
    assert.equal(request?.headers.get("content-type"), "application/json;charset=UTF-8");
    assert.deepEqual(await request?.json(), { auth_code: "auth-code", code_verifier: "verifier" });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("renderCallbackPage returns a UTF-8 branded completion page", () => {
  const page = renderCallbackPage();
  assert.match(page, /<meta charset="utf-8">/);
  assert.match(page, /Login successful/);
  assert.match(page, /background: #111/);
  assert.match(page, /history\.replaceState/);
});
