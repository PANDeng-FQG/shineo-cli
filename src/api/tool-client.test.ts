import { strict as assert } from "node:assert";
import test from "node:test";
import { ToolClient } from "./tool-client.js";

test("ToolClient sends project context and raw tool input", async () => {
  const calls: Array<{ path: string; body: unknown }> = [];
  const api = {
    get: async () => [{ name: "list_skills", description: "", parameters: {}, requiresProject: false }],
    post: async (path: string, body: unknown) => {
      calls.push({ path, body });
      return { toolName: "project_cms", success: true, changed: false, result: { items: [] } };
    },
  } as never;

  const result = await new ToolClient(api).execute("project_cms", { action: "list" }, { projectId: "project", workspaceId: "workspace" });
  assert.equal(result.success, true);
  assert.deepEqual(calls, [{ path: "/cli/v1/tools/project_cms", body: { projectId: "project", workspaceId: "workspace", input: { action: "list" } } }]);
});
