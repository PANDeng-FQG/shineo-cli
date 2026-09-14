import { ApiClient } from "../api/api-client.js";
import { ToolClient } from "../api/tool-client.js";
import { readProjectConfig, writeProjectConfig } from "../config/config-store.js";
import { readLocalProject, writeLocalFile } from "../filesystem/project-files.js";
import { normalizeProjectPath } from "../filesystem/project-path.js";
import { OutputWriter } from "../output/output-writer.js";

export type DataToolName = "data_tables" | "data_fields" | "data_records" | "data_permissions";

type DataApiSdkInitResult = {
  revisionId?: string | null;
  fileContents?: Record<string, string>;
  [key: string]: unknown;
};

export async function initializeDataApiSdk(api: ApiClient, output: OutputWriter, overwrite = false): Promise<void> {
  const project = await readProjectConfig();
  const result = await new ToolClient(api).execute("database_init", { overwrite }, {
    projectId: project.projectId,
    workspaceId: project.workspaceId,
  });
  if (!result.success) {
    output.result(result);
    throw new Error(result.error || "Shineo 数据 API SDK 初始化失败。");
  }

  const details = isRecord(result.result) ? result.result as DataApiSdkInitResult : {};
  const localFiles = new Set((await readLocalProject()).map((file) => normalizeProjectPath(file.path)));
  const written: string[] = [];
  const localSkipped: string[] = [];
  for (const [filePath, content] of Object.entries(details.fileContents ?? {})) {
    const normalizedPath = normalizeProjectPath(filePath);
    if (localFiles.has(normalizedPath) && !overwrite) {
      localSkipped.push(normalizedPath);
      continue;
    }
    await writeLocalFile(process.cwd(), normalizedPath, Buffer.from(content, "utf8"));
    written.push(normalizedPath);
  }

  const revisionId = typeof details.revisionId === "string" ? details.revisionId : null;
  if (revisionId) await writeProjectConfig({ ...project, revisionId });
  const { fileContents: _fileContents, ...safeDetails } = details;
  output.result({
    ...result,
    result: {
      ...safeDetails,
      written,
      localSkipped,
      revisionId: revisionId ?? project.revisionId ?? null,
    },
  });
}

export async function executeDataTool(
  api: ApiClient,
  output: OutputWriter,
  toolName: DataToolName,
  action: string,
  cmsId: string,
  inputJson?: string,
  inputOverrides: Record<string, unknown> = {},
): Promise<void> {
  const project = await readProjectConfig();
  const input = { ...parseObject(inputJson), ...inputOverrides };
  const result = await new ToolClient(api).execute(toolName, { cmsId, action, input }, {
    projectId: project.projectId,
    workspaceId: project.workspaceId,
  });
  output.result(result);
  if (!result.success) throw new Error(result.error || `${toolName} 执行失败。`);
}

export async function listFields(api: ApiClient, output: OutputWriter, cmsId: string, tableId: string): Promise<void> {
  const project = await readProjectConfig();
  const result = await new ToolClient(api).execute("data_fields", {
    cmsId,
    action: "list",
    input: { tableId },
  }, { projectId: project.projectId, workspaceId: project.workspaceId });
  output.result(result);
  if (!result.success) throw new Error(result.error || "data_fields 执行失败。");
}

export async function executeDataApi(
  api: ApiClient,
  output: OutputWriter,
  method: "get" | "post" | "patch" | "delete",
  path: string,
  inputJson?: string,
): Promise<void> {
  const input = parseObject(inputJson);
  const result = method === "get"
    ? await api.get(path)
    : method === "post"
      ? await api.post(path, input)
      : method === "patch"
        ? await api.patch(path, input)
        : await api.delete(path);
  output.result(result);
}

function parseObject(value?: string): Record<string, unknown> {
  if (!value) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch (error) {
    throw new Error(`JSON 参数无效：${error instanceof Error ? error.message : String(error)}`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("JSON 参数必须是对象。");
  return parsed as Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
