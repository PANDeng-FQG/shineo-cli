import envPaths from "env-paths";
import fs from "node:fs/promises";
import path from "node:path";
import { normalizeProjectPath } from "../filesystem/project-path.js";

export const DEFAULT_API_URL = "https://api.shineo.app";

export type ShineoProfile = {
  apiUrl: string;
  accessToken?: string;
  refreshToken?: string;
};

export type ShineoConfig = {
  apiUrl: string;
  accessToken?: string;
  refreshToken?: string;
  language?: "zh-CN" | "en-US";
  profile?: string;
};

export type ShineoConfigProfile = {
  name: string;
  apiUrl: string;
  authenticated: boolean;
  active: boolean;
};

export type StoredShineoConfig = {
  schemaVersion: 2;
  activeProfile: string;
  profiles: Record<string, ShineoProfile>;
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

export async function readConfig(profileName?: string): Promise<ShineoConfig> {
  const stored = await readStoredConfig();
  const selectedProfile = profileName ?? stored.activeProfile;
  const profile = stored.profiles[selectedProfile] ?? defaultProfile(selectedProfile);
  return {
    ...profile,
    ...(stored.language ? { language: stored.language } : {}),
    profile: selectedProfile,
  };
}

export async function listConfigProfiles(): Promise<ShineoConfigProfile[]> {
  const stored = await readStoredConfig();
  return Object.entries(stored.profiles).map(([name, profile]) => ({
    name,
    apiUrl: profile.apiUrl,
    authenticated: Boolean(profile.accessToken),
    active: name === stored.activeProfile,
  }));
}

export async function useConfigProfile(profileName: string): Promise<ShineoConfig> {
  validateProfileName(profileName);
  const stored = await readStoredConfig();
  if (!stored.profiles[profileName]) stored.profiles[profileName] = defaultProfile(profileName);
  stored.activeProfile = profileName;
  await writeStoredConfig(stored);
  return readConfig(profileName);
}

export async function writeConfig(config: ShineoConfig, profileName?: string): Promise<void> {
  const stored = await readStoredConfig();
  const selectedProfile = profileName ?? config.profile ?? stored.activeProfile;
  validateProfileName(selectedProfile);
  stored.profiles[selectedProfile] = {
    apiUrl: readApiUrl(config.apiUrl),
    ...(config.accessToken ? { accessToken: config.accessToken } : {}),
    ...(config.refreshToken ? { refreshToken: config.refreshToken } : {}),
  };
  stored.activeProfile = selectedProfile;
  if (config.language) stored.language = config.language;
  await writeStoredConfig(stored);
}

async function readStoredConfig(): Promise<StoredShineoConfig> {
  try {
    const raw = await fs.readFile(getConfigPath(), "utf8");
    return migrateConfig(JSON.parse(raw) as Record<string, unknown>);
  } catch (error) {
    if (isMissingFile(error)) {
      return {
        schemaVersion: 2,
        activeProfile: "production",
        profiles: { production: { apiUrl: readApiUrl(process.env.SHINEO_API_URL) } },
      };
    }
    throw new Error(`无法读取 Shineo 配置：${error instanceof Error ? error.message : String(error)}`);
  }
}

export function migrateConfig(value: Record<string, unknown>): StoredShineoConfig {
  const language = value.language === "zh-CN" || value.language === "en-US" ? value.language : undefined;
  if (isProfileRecord(value.profiles)) {
    const profiles = Object.fromEntries(Object.entries(value.profiles).map(([name, profile]) => [name, {
      apiUrl: readApiUrl(profile.apiUrl),
      ...(profile.accessToken ? { accessToken: profile.accessToken } : {}),
      ...(profile.refreshToken ? { refreshToken: profile.refreshToken } : {}),
    }]));
    const activeProfile = typeof value.activeProfile === "string" && profiles[value.activeProfile]
      ? value.activeProfile
      : Object.keys(profiles)[0] ?? "production";
    return { schemaVersion: 2, activeProfile, profiles, ...(language ? { language } : {}) };
  }

  const legacyProfile = readApiUrl(value.apiUrl);
  const profileName = isLocalApiUrl(legacyProfile) ? "local" : "production";
  return {
    schemaVersion: 2,
    activeProfile: profileName,
    profiles: {
      [profileName]: {
        apiUrl: legacyProfile,
        ...(typeof value.accessToken === "string" ? { accessToken: value.accessToken } : {}),
        ...(typeof value.refreshToken === "string" ? { refreshToken: value.refreshToken } : {}),
      },
    },
    ...(language ? { language } : {}),
  };
}

async function writeStoredConfig(config: StoredShineoConfig): Promise<void> {
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
  if (typeof value !== "string" || !value.trim()) return DEFAULT_API_URL;
  return value.trim().replace(/\/$/, "");
}

function defaultProfile(profileName: string): ShineoProfile {
  return { apiUrl: profileName === "local" ? "http://localhost:3000" : DEFAULT_API_URL };
}

function isLocalApiUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.hostname === "localhost" || url.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

function validateProfileName(value: string): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(value)) throw new Error("profile 名称只能包含字母、数字、点、下划线和连字符。");
}

function isMissingFile(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.values(value).every((item) => typeof item === "string"));
}

function isProfileRecord(value: unknown): value is Record<string, ShineoProfile> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.values(value).every((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    const profile = item as Record<string, unknown>;
    return typeof profile.apiUrl === "string"
      && (profile.accessToken === undefined || typeof profile.accessToken === "string")
      && (profile.refreshToken === undefined || typeof profile.refreshToken === "string");
  }));
}
