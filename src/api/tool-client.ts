import { ApiClient } from "./api-client.js";

export type ToolDescriptor = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  requiresProject: boolean;
};

export type ToolResult = {
  toolName?: string;
  success: boolean;
  changed?: boolean;
  result?: unknown;
  error?: string;
};

export class ToolClient {
  constructor(private readonly api: ApiClient) {}

  list(): Promise<ToolDescriptor[]> {
    return this.api.get<ToolDescriptor[]>("/cli/v1/tools");
  }

  execute(toolName: string, input: unknown, context: { projectId?: string; workspaceId?: string } = {}): Promise<ToolResult> {
    return this.api.post<ToolResult>(`/cli/v1/tools/${encodeURIComponent(toolName)}`, { ...context, input });
  }
}
