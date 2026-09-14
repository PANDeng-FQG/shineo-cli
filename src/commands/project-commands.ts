import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { ApiClient } from "../api/api-client.js";
import { OutputWriter } from "../output/output-writer.js";
import { readLocalProject, writeLocalFile, type LocalProjectFile } from "../filesystem/project-files.js";
import { readProjectConfig, writeProjectConfig, type ProjectConfig } from "../config/config-store.js";
import { isCliConfigPath, normalizeProjectPath } from "../filesystem/project-path.js";

type ProjectSummary = Record<string, unknown> & { id?: string; name?: string; workspaceId?: string; workspace_id?: string };
export type SourceManifest = { ref?: string | null; entry?: string | null; dependencies?: Record<string, string>; revisionId?: string | null; files: Array<{ path: string; url: string; contentHash: string }> };
export type FileMutation =
  | { type: "write"; path: string; contentsBase64: string; mimeType: string; textEncoding: "utf-8" | null; expectedContentHash: string | null }
  | { type: "delete"; path: string; expectedContentHash: string | null };

export async function listProjects(api: ApiClient, output: OutputWriter, workspaceId?: string): Promise<void> {
  const pathName = workspaceId ? `/workspaces/${encodeURIComponent(workspaceId)}/projects` : "/projects";
  output.result(await api.get<ProjectSummary[]>(pathName));
}

export async function createProject(api: ApiClient, output: OutputWriter, input: { workspaceId: string; name: string; projectType: "default" | "components" }): Promise<void> {
  const project = await api.post<ProjectSummary>(`/workspaces/${encodeURIComponent(input.workspaceId)}/projects`, { name: input.name, projectType: input.projectType });
  const projectId = readString(project.id);
  if (projectId) {
    await writeProjectConfig({
      schemaVersion: 1,
      apiUrl: api.baseUrl,
      projectId,
      workspaceId: input.workspaceId,
      projectName: input.name,
      revisionId: null,
    });
  }
  output.result(project);
}

export async function cloneProject(api: ApiClient, output: OutputWriter, projectId: string, targetDirectory: string): Promise<void> {
  const directory = path.resolve(targetDirectory);
  await fs.mkdir(directory, { recursive: true });
  const project = await findProject(api, projectId);
  const manifest = await downloadSource(api, projectId, directory, output);
  const projectConfig: ProjectConfig = {
    schemaVersion: 1,
    apiUrl: api.baseUrl,
    projectId,
    workspaceId: readString(project.workspaceId ?? project.workspace_id),
    revisionId: manifest.revisionId ?? manifest.ref ?? null,
    entry: manifest.entry ? normalizeProjectPath(manifest.entry) : null,
    dependencies: manifest.dependencies ?? {},
  };
  if (typeof project.name === "string") projectConfig.projectName = project.name;
  await writeProjectConfig(projectConfig, directory);
  output.result({ projectId, directory, files: countSyncFiles(manifest), revisionId: manifest.revisionId ?? manifest.ref ?? null });
}

export async function pullProject(api: ApiClient, output: OutputWriter): Promise<void> {
  const config = await readProjectConfig();
  const manifest = await downloadSource(api, config.projectId, process.cwd(), output);
  const nextConfig: ProjectConfig = { ...config, apiUrl: api.baseUrl, revisionId: manifest.revisionId ?? manifest.ref ?? null };
  const entry = manifest.entry ?? config.entry;
  const dependencies = manifest.dependencies ?? config.dependencies;
  if (entry !== undefined) nextConfig.entry = entry ? normalizeProjectPath(entry) : entry;
  if (dependencies !== undefined) nextConfig.dependencies = dependencies;
  await writeProjectConfig(nextConfig, process.cwd());
  output.result({ projectId: config.projectId, files: countSyncFiles(manifest), revisionId: manifest.revisionId ?? manifest.ref ?? null });
}

export async function pushProject(api: ApiClient, output: OutputWriter, message: string): Promise<void> {
  const config = await readProjectConfig();
  const [localFiles, remote] = await Promise.all([
    readLocalProject(),
    api.get<SourceManifest>(`/projects/${encodeURIComponent(config.projectId)}/export`),
  ]);
  const mutations = createProjectMutations(localFiles, remote.files);
  const summary = summarizeMutations(mutations);
  if (mutations.length === 0) {
    output.result({ changed: false, revisionId: config.revisionId ?? remote.revisionId ?? remote.ref ?? null, mutations: 0, ...summary });
    return;
  }
  let revision: Record<string, unknown>;
  try {
    revision = await api.post<Record<string, unknown>>(`/projects/${encodeURIComponent(config.projectId)}/file-mutations`, {
      expectedHeadRevisionId: config.revisionId ?? remote.revisionId ?? remote.ref ?? null,
      idempotencyKey: randomUUID(),
      kind: "manual_checkpoint",
      message,
      entryPath: normalizeProjectPath(config.entry ?? "index.html"),
      dependencies: config.dependencies ?? {},
      mutations,
    });
  } catch (error) {
    throw formatProjectPushError(error, config.revisionId ?? null, remote.revisionId ?? remote.ref ?? null);
  }
  const revisionId = readString(revision.id ?? revision.revisionId);
  await writeProjectConfig({ ...config, apiUrl: api.baseUrl, ...(revisionId ? { revisionId } : {}) });
  output.result({ ...revision, changed: true, ...summary });
}

export async function buildProject(api: ApiClient, output: OutputWriter): Promise<void> {
  const config = await readProjectConfig();
  await pushProject(api, new OutputWriter({ json: true }), "Build from Shineo CLI");
  const build = await queueServerBuild(api, config.projectId);
  output.result(build);
}

export async function deploySourceProject(api: ApiClient, output: OutputWriter): Promise<void> {
  const config = await readProjectConfig();
  await pushProject(api, new OutputWriter({ json: true }), "Deploy from Shineo CLI");
  const build = await queueServerBuild(api, config.projectId);
  const buildId = readString(build.id);
  if (!buildId) throw new Error("服务端未返回构建 ID。");
  const revisionId = readString(build.revisionId ?? build.revision_id ?? config.revisionId);
  if (!revisionId) throw new Error("构建结果缺少 revision ID。");
  const release = await api.post<Record<string, unknown>>(`/projects/${encodeURIComponent(config.projectId)}/builds/${encodeURIComponent(buildId)}/release-bundle`, { channel: "PRODUCTION", versionId: revisionId });
  const published = await api.post<Record<string, unknown>>(`/projects/${encodeURIComponent(config.projectId)}/releases`, { channel: "PRODUCTION", versionId: revisionId, releaseBundleKey: release.objectKey, bundleHash: release.bundleHash });
  output.result({ build, release, published });
}

async function queueServerBuild(api: ApiClient, projectId: string): Promise<Record<string, unknown>> {
  const initial = await api.post<Record<string, unknown>>(`/projects/${encodeURIComponent(projectId)}/builds`, { sourceType: "head", target: "preview" });
  const buildId = readString(initial.id);
  if (!buildId) throw new Error("服务端未返回构建 ID。");
  let current = initial;
  while (["queued", "running"].includes(readString(current.status))) {
    await new Promise((resolve) => setTimeout(resolve, 1_000));
    current = await api.get<Record<string, unknown>>(`/projects/${encodeURIComponent(projectId)}/builds/${encodeURIComponent(buildId)}`);
  }
  if (current.status !== "succeeded") throw new Error(readString(current.errorMessage ?? current.error_message) || "服务端构建失败。");
  return current;
}


export function createProjectMutations(localFiles: LocalProjectFile[], remoteFiles: SourceManifest["files"]): FileMutation[] {
  const normalizedRemoteFiles = new Map(remoteFiles.map((file) => [normalizeProjectPath(file.path), file]));
  const localFilesByPath = new Map(localFiles.map((file) => [normalizeProjectPath(file.path), file]));
  const mutations: FileMutation[] = localFiles
    .filter((file) => normalizedRemoteFiles.get(normalizeProjectPath(file.path))?.contentHash !== file.contentHash)
    .map((file) => {
      const projectPath = normalizeProjectPath(file.path);
      return {
        type: "write" as const,
        path: projectPath,
        contentsBase64: file.contents.toString("base64"),
        mimeType: file.mimeType,
        textEncoding: file.textEncoding,
        expectedContentHash: normalizedRemoteFiles.get(projectPath)?.contentHash ?? null,
      };
    });
  for (const file of remoteFiles) {
    const projectPath = normalizeProjectPath(file.path);
    if (isCliConfigPath(projectPath) || localFilesByPath.has(projectPath)) continue;
    mutations.push({ type: "delete", path: projectPath, expectedContentHash: file.contentHash });
  }
  return mutations;
}

export async function projectStatus(api: ApiClient, output: OutputWriter): Promise<void> {
  const config = await readProjectConfig();
  const [project, manifest, localFiles] = await Promise.all([findProject(api, config.projectId), api.get<SourceManifest>(`/projects/${encodeURIComponent(config.projectId)}/export`), readLocalProject()]);
  const remoteHashes = new Map(manifest.files.filter((file) => !isCliConfigPath(file.path)).map((file) => [normalizeProjectPath(file.path), file.contentHash]));
  const localHashes = new Map(localFiles.map((file) => [file.path, file.contentHash]));
  const changed = [...new Set([...remoteHashes.keys(), ...localHashes.keys()])].filter((filePath) => remoteHashes.get(filePath) !== localHashes.get(filePath));
  output.result({ project, revisionId: manifest.revisionId ?? manifest.ref ?? null, changedFiles: changed, changedCount: changed.length, clean: changed.length === 0 });
}

async function downloadSource(api: ApiClient, projectId: string, directory: string, output: OutputWriter): Promise<SourceManifest> {
  const manifest = await api.get<SourceManifest>(`/projects/${encodeURIComponent(projectId)}/export`);
  for (const file of manifest.files) {
    if (isCliConfigPath(file.path)) continue;
    const response = await fetch(file.url);
    if (!response.ok) throw new Error(`下载 ${file.path} 失败：HTTP ${response.status}`);
    const contents = Buffer.from(await response.arrayBuffer());
    await writeLocalFile(directory, file.path, contents);
  }
  output.info(`已同步 ${manifest.files.filter((file) => !isCliConfigPath(file.path)).length} 个项目文件。`);
  return manifest;
}

function summarizeMutations(mutations: FileMutation[]): { added: number; modified: number; deleted: number } {
  return {
    added: mutations.filter((mutation) => mutation.type === "write" && mutation.expectedContentHash === null).length,
    modified: mutations.filter((mutation) => mutation.type === "write" && mutation.expectedContentHash !== null).length,
    deleted: mutations.filter((mutation) => mutation.type === "delete").length,
  };
}

function countSyncFiles(manifest: SourceManifest): number {
  return manifest.files.filter((file) => !isCliConfigPath(file.path)).length;
}

function formatProjectPushError(error: unknown, localRevisionId: string | null, remoteRevisionId: string | null): Error {
  if (error && typeof error === "object" && "status" in error && error.status === 409) {
    return new Error(`项目远端已更新，push 被拒绝。当前目录 revision：${localRevisionId ?? "未记录"}；远端 revision：${remoteRevisionId ?? "未知"}。请先执行 shineo project pull，确认本地改动后再 push。`);
  }
  return error instanceof Error ? error : new Error(String(error));
}

async function findProject(api: ApiClient, projectId: string): Promise<ProjectSummary> {
  const projects = await api.get<ProjectSummary[]>("/projects");
  const project = projects.find((item) => item.id === projectId);
  return project ?? { id: projectId };
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}
