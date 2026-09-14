import envPaths from "env-paths";
import fs from "node:fs/promises";
import path from "node:path";
import { normalizeProjectPath } from "../filesystem/project-path.js";

export type ShineoConfig = {
  apiUrl: string;
  accessToken?: string;
  refreshToken?: string;
  language?: "zh-CN" | "en-US";
};

export type ProjectConfig = {
  schemaVersion: 1;
  apiUrl: string;
  projectId: string;
  workspaceId: string;
  projectName?: string;
  revisionId?: string | null;
  entry?: string | null;
  dependencies?: Record<string, string>;
};

export function getConfigPath(): string {
  return path.join(envPaths("shineo").config, "config.json");
}

export async function readConfig(): Promise<ShineoConfig> {
  try {
    const raw = await fs.readFile(getConfigPath(), "utf8");
    const value = JSON.parse(raw) as Record<string, unknown>;
    return {
      apiUrl: readApiUrl(value.apiUrl),
      ...(typeof value.accessToken === "string" ? { accessToken: value.accessToken } : {}),
      ...(typeof value.refreshToken === "string" ? { refreshToken: value.refreshToken } : {}),
      ...(value.language === "zh-CN" || value.language === "en-US" ? { language: value.language } : {}),
    };
  } catch (error) {
    if (isMissingFile(error)) return { apiUrl: readApiUrl(process.env.SHINEO_API_URL) };
    throw new Error(`无法读取 Shineo 配置：${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function writeConfig(config: ShineoConfig): Promise<void> {
  const filePath = getConfigPath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(config, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
}

export async function readProjectConfig(directory = process.cwd()): Promise<ProjectConfig> {
  const filePath = path.join(directory, ".shineo.json");
  let raw: string;
  try {
    raw = await fs.readFile(filePath, "utf8");
  } catch {
    throw new Error(`当前目录没有 .shineo.json，请先执行 shineo project clone 或 shineo project init。`);
  }
  const value = JSON.parse(raw) as Record<string, unknown>;
  if (value.schemaVersion !== 1 || typeof value.projectId !== "string" || typeof value.workspaceId !== "string") {
    throw new Error(".shineo.json 格式无效，需要 schemaVersion、projectId 和 workspaceId。");
  }
  return {
    schemaVersion: 1,
    apiUrl: readApiUrl(value.apiUrl),
    projectId: value.projectId,
    workspaceId: value.workspaceId,
    ...(typeof value.projectName === "string" ? { projectName: value.projectName } : {}),
    ...(typeof value.revisionId === "string" || value.revisionId === null ? { revisionId: value.revisionId } : {}),
    ...(typeof value.entry === "string" || value.entry === null ? { entry: value.entry === null ? null : normalizeProjectPath(value.entry) } : {}),
    ...(isStringRecord(value.dependencies) ? { dependencies: value.dependencies } : {}),
  };
}

export async function writeProjectConfig(config: ProjectConfig, directory = process.cwd()): Promise<void> {
  await fs.writeFile(path.join(directory, ".shineo.json"), `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

function readApiUrl(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "https://api.shineo.app";
  return value.trim().replace(/\/$/, "");
}

function isMissingFile(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.values(value).every((item) => typeof item === "string"));
}
