import { readConfig, type ShineoConfig } from "../config/config-store.js";

export type ApiClientOptions = {
  apiUrl?: string;
  accessToken?: string;
  verbose?: boolean;
};

export class ApiError extends Error {
  constructor(public readonly status: number, message: string, public readonly payload?: unknown) {
    super(message);
    this.name = "ApiError";
  }
}

export class ApiClient {
  private readonly apiUrl: string;
  private readonly accessToken: string | undefined;

  private constructor(private readonly options: ApiClientOptions, config: ShineoConfig) {
    this.apiUrl = (options.apiUrl ?? config.apiUrl).replace(/\/$/, "");
    this.accessToken = options.accessToken ?? config.accessToken ?? process.env.SHINEO_TOKEN;
  }

  static async create(options: ApiClientOptions = {}): Promise<ApiClient> {
    return new ApiClient(options, await readConfig());
  }

  get baseUrl(): string {
    return this.apiUrl;
  }

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    if (this.accessToken) headers.set("Authorization", `Bearer ${this.accessToken}`);
    if (this.options.verbose) process.stderr.write(`${init.method ?? "GET"} ${this.apiUrl}${path}\n`);
    const response = await fetch(`${this.apiUrl}${path}`, { ...init, headers });
    const payload = await readPayload(response);
    if (!response.ok) throw new ApiError(response.status, readErrorMessage(payload, response.statusText), payload);
    return payload as T;
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>(path);
  }

  post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>(path, { method: "POST", body: JSON.stringify(body) });
  }

  postWithHeaders<T>(path: string, body: unknown, headers: Record<string, string>): Promise<T> {
    return this.request<T>(path, { method: "POST", body: JSON.stringify(body), headers });
  }

  patch<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>(path, { method: "PATCH", body: JSON.stringify(body) });
  }

  delete<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: "DELETE" });
  }
}

async function readPayload(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function readErrorMessage(payload: unknown, fallback: string): string {
  if (typeof payload === "string" && payload) return payload;
  if (payload && typeof payload === "object") {
    const value = payload as Record<string, unknown>;
    if (typeof value.message === "string") return value.message;
    if (typeof value.error === "string") return value.error;
    if (value.error && typeof value.error === "object" && typeof (value.error as Record<string, unknown>).message === "string") return String((value.error as Record<string, unknown>).message);
  }
  return fallback;
}
