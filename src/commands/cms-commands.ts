import { ApiClient } from "../api/api-client.js";
import { OutputWriter } from "../output/output-writer.js";
import { readProjectConfig } from "../config/config-store.js";

export async function listCms(api: ApiClient, output: OutputWriter, workspaceId?: string): Promise<void> {
  const config = await readProjectConfig().catch(() => null);
  const workspace = workspaceId ?? config?.workspaceId;
  if (!workspace) throw new Error("请提供 workspaceId，或在项目目录执行此命令。");
  output.result(await api.get(`/workspaces/${encodeURIComponent(workspace)}/cms`));
}

export async function cmsAction(api: ApiClient, output: OutputWriter, action: string, cmsId?: string, value?: string): Promise<void> {
  const id = cmsId || "";
  let result: unknown;
  if (action === "view") result = await api.get(`/cms/${encodeURIComponent(id)}`);
  else if (action === "delete") result = await api.delete(`/cms/${encodeURIComponent(id)}`);
  else if (action === "update") result = await api.patch(`/cms/${encodeURIComponent(id)}`, JSON.parse(value || "{}"));
  else if (action === "access") result = await api.get(`/cms/${encodeURIComponent(id)}/access`);
  else throw new Error(`不支持的 CMS 操作：${action}`);
  output.result(result);
}
