import http from "node:http";
import { createHash, randomBytes } from "node:crypto";
import open from "open";
import { ApiClient } from "../api/api-client.js";
import { writeConfig, type ShineoConfig } from "../config/config-store.js";

export async function loginInBrowser(api: ApiClient, config: ShineoConfig, provider?: string, profileName?: string): Promise<void> {
  if (provider !== undefined && provider !== "google" && provider !== "github") throw new Error("登录方式只能是 google 或 github。");
  const publicConfig = await api.get<{ supabaseUrl: string; anonKey: string; appUrl: string }>("/cli/v1/auth/config");
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
  const state = randomBytes(32).toString("base64url");
  const callback = await createCallbackServer();
  try {
    const authorizeUrl = new URL("/cli/authorize", publicConfig.appUrl);
    if (provider) authorizeUrl.searchParams.set("provider", provider);
    authorizeUrl.searchParams.set("redirect_to", callback.redirectUri);
    authorizeUrl.searchParams.set("code_challenge", codeChallenge);
    authorizeUrl.searchParams.set("code_challenge_method", "s256");
    authorizeUrl.searchParams.set("state", state);
    await open(authorizeUrl.toString());
    process.stderr.write("已打开浏览器，请完成 Shineo 登录。\n");
    const params = await callback.waitForCallback();
    if (params.get("error_description") || params.get("error")) throw new Error(params.get("error_description") || params.get("error") || "登录失败。");
    const code = params.get("code");
    if (!code) throw new Error("登录回调缺少授权码。");
    if (params.get("state") !== state) throw new Error("登录回调状态校验失败，请重新登录。");
    const exchanged = params.get("flow") === "email"
      ? await exchangeCliAuthorizationCode(api, code, codeVerifier)
      : await exchangePkceCode(publicConfig.supabaseUrl, publicConfig.anonKey, code, codeVerifier);
    const nextConfig: ShineoConfig = { ...config, accessToken: exchanged.access_token };
    if (exchanged.refresh_token) nextConfig.refreshToken = exchanged.refresh_token;
    await writeConfig(nextConfig, profileName);
  } finally {
    await callback.close();
  }
}

async function exchangeCliAuthorizationCode(api: ApiClient, code: string, codeVerifier: string): Promise<{ access_token: string; refresh_token?: string }> {
  return api.post<{ access_token: string; refresh_token?: string }>("/cli/v1/auth/token", { code, codeVerifier });
}

type PkceTokenResponse = {
  access_token?: unknown;
  refresh_token?: unknown;
  error_description?: unknown;
  msg?: unknown;
};

export async function exchangePkceCode(supabaseUrl: string, anonKey: string, code: string, codeVerifier: string): Promise<{ access_token: string; refresh_token?: string }> {
  const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/token?grant_type=pkce`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      "Content-Type": "application/json;charset=UTF-8",
    },
    body: JSON.stringify({ auth_code: code, code_verifier: codeVerifier }),
  });
  const payload = await response.json() as PkceTokenResponse;
  if (!response.ok || typeof payload.access_token !== "string") {
    const message = typeof payload.error_description === "string" ? payload.error_description : typeof payload.msg === "string" ? payload.msg : "无法交换登录会话。";
    throw new Error(message);
  }
  return {
    access_token: payload.access_token,
    ...(typeof payload.refresh_token === "string" ? { refresh_token: payload.refresh_token } : {}),
  };
}

async function createCallbackServer(): Promise<{
  redirectUri: string;
  waitForCallback: () => Promise<URLSearchParams>;
  close: () => Promise<void>;
}> {
  const server = http.createServer((request, response) => {
    const requestUrl = new URL(request.url || "/", "http://127.0.0.1");
    if (requestUrl.pathname !== "/callback") {
      response.statusCode = 404;
      response.setHeader("Content-Type", "text/plain; charset=utf-8");
      response.end("Not found");
      return;
    }
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(renderCallbackPage());
    callbackResolve?.(requestUrl.searchParams);
    callbackResolve = null;
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("无法启动登录回调服务。");
  let callbackResolve: ((params: URLSearchParams) => void) | null = null;
  const callbackPromise = new Promise<URLSearchParams>((resolve) => { callbackResolve = resolve; });
  return {
    redirectUri: `http://127.0.0.1:${address.port}/callback`,
    waitForCallback: () => callbackPromise,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

export function renderCallbackPage(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="dark">
    <title>Shineo CLI</title>
    <style>
      :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #111; color: #f5f5f5; }
      * { box-sizing: border-box; }
      body { min-height: 100vh; margin: 0; display: grid; place-items: center; padding: 24px; background: #111; }
      main { width: min(100%, 360px); text-align: center; }
      .brand { display: inline-flex; align-items: center; gap: 9px; margin-bottom: 48px; font-size: 16px; font-weight: 600; letter-spacing: .01em; }
      .brand svg { width: 24px; height: 16px; fill: currentColor; }
      .status { width: 48px; height: 48px; margin: 0 auto 22px; display: grid; place-items: center; border: 1px solid #3b82f6; border-radius: 999px; color: #60a5fa; }
      .status svg { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 2; }
      h1 { margin: 0; font-size: 24px; line-height: 1.3; font-weight: 600; }
      p { margin: 12px 0 0; color: #a3a3a3; font-size: 14px; line-height: 1.6; }
      .hint { margin-top: 32px; color: #737373; font-size: 12px; }
    </style>
  </head>
  <body>
    <main>
      <div class="brand">
        <svg viewBox="0 0 267 170" aria-hidden="true"><path d="M78.001 169.706L0.294922 92.001H155.705L78.001 169.706ZM216.717 141.138L167.58 92.001H265.853L216.717 141.138ZM156.002 78.001H0L78.001 0L156.002 78.001ZM266.718 78.001H166.715L216.717 28L266.718 78.001Z" /></svg>
        <span>Shineo</span>
      </div>
      <div class="status" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6" /></svg></div>
      <h1>Login successful</h1>
      <p>You can return to your terminal to continue.</p>
      <p class="hint">You may close this window</p>
    </main>
    <script>history.replaceState(null, "", location.pathname);</script>
  </body>
</html>`;
}
