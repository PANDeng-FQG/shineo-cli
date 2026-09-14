import { ApiClient } from "../api/api-client.js";
import { ToolClient } from "../api/tool-client.js";
import { OutputWriter } from "../output/output-writer.js";
import { readProjectConfig } from "../config/config-store.js";

export async function listTools(api: ApiClient, output: OutputWriter): Promise<void> {
  output.result(await new ToolClient(api).list());
}

export async function executeTool(api: ApiClient, output: OutputWriter, toolName: string, inputJson: string, project = false): Promise<void> {
  const toolClient = new ToolClient(api);
  const input = JSON.parse(inputJson) as unknown;
  const context = project ? await readProjectConfig() : undefined;
  const result = await toolClient.execute(toolName, input, context ? { projectId: context.projectId, workspaceId: context.workspaceId } : {});
  output.result(result);
  if (!result.success) throw new Error(result.error || `${toolName} 执行失败。`);
}

export async function executeSkill(api: ApiClient, output: OutputWriter, action: "list" | "show" | "resource", name?: string, resourcePath?: string): Promise<void> {
  const toolClient = new ToolClient(api);
  const result = action === "list"
    ? await toolClient.execute("list_skills", {})
    : action === "show"
      ? await toolClient.execute("load_skill", { skillName: required(name, "skill 名称") })
      : await toolClient.execute("load_skill_resource", { skillName: required(name, "skill 名称"), resourcePath: required(resourcePath, "resource 路径") });
  output.result(result);
  if (!result.success) throw new Error(result.error || "Skill 工具执行失败。");
}

export async function executeDesignTool(api: ApiClient, output: OutputWriter, toolName: "design_init" | "design_fonts" | "design_lint" | "design_export", inputJson?: string): Promise<void> {
  const project = await readProjectConfig();
  const input = inputJson ? parseObject(inputJson) : {};
  const result = await new ToolClient(api).execute(toolName, input, {
    projectId: project.projectId,
    workspaceId: project.workspaceId,
  });
  output.result(result);
  if (!result.success) throw new Error(result.error || `${toolName} 执行失败。`);
}

function required(value: string | undefined, name: string): string {
  if (!value) throw new Error(`缺少 ${name}。`);
  return value;
}

function parseObject(value: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch (error) {
    throw new Error(`JSON 参数无效：${error instanceof Error ? error.message : String(error)}`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("JSON 参数必须是对象。");
  return parsed as Record<string, unknown>;
}
