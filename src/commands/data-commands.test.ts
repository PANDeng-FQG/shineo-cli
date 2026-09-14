import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { initializeDataApiSdk } from "./data-commands.js";

test("initializeDataApiSdk writes SDK files, preserves local files, and updates revision", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "shineo-cli-sdk-"));
  const previousDirectory = process.cwd();
  await fs.writeFile(path.join(directory, ".shineo.json"), JSON.stringify({
    schemaVersion: 1,
    apiUrl: "https://api.example.test",
    projectId: "project-id",
    workspaceId: "workspace-id",
    revisionId: "revision-before",
  }), "utf8");
  await fs.mkdir(path.join(directory, ".shineo", "apisdk"), { recursive: true });
  await fs.writeFile(path.join(directory, ".shineo", "apisdk", "auth.ts"), "local-auth\n", "utf8");

  const calls: Array<{ path: string; body: unknown }> = [];
  const api = {
    post: async (requestPath: string, body: unknown) => {
      calls.push({ path: requestPath, body });
      const revisionId = calls.length === 1 ? "revision-after-init" : "revision-after-overwrite";
      return {
        toolName: "database_init",
        success: true,
        changed: true,
        result: {
          created: ["/.shineo/apisdk/index.ts"],
          skipped: ["/.shineo/apisdk/auth.ts"],
          overwritten: [],
          files: ["/.shineo/apisdk/index.ts", "/.shineo/apisdk/auth.ts"],
          sdkVersion: "1.0.0",
          revisionId,
          fileContents: {
            "/.shineo/apisdk/index.ts": "export const client = true;\n",
            "/.shineo/apisdk/auth.ts": "remote-auth\n",
          },
        },
      };
    },
  } as never;
  const output = { result: () => undefined } as never;

  try {
    process.chdir(directory);
    await initializeDataApiSdk(api, output);
    assert.equal(await fs.readFile(path.join(directory, ".shineo", "apisdk", "index.ts"), "utf8"), "export const client = true;\n");
    assert.equal(await fs.readFile(path.join(directory, ".shineo", "apisdk", "auth.ts"), "utf8"), "local-auth\n");
    assert.equal(JSON.parse(await fs.readFile(path.join(directory, ".shineo.json"), "utf8")).revisionId, "revision-after-init");

    await initializeDataApiSdk(api, output, true);
    assert.equal(await fs.readFile(path.join(directory, ".shineo", "apisdk", "auth.ts"), "utf8"), "remote-auth\n");
    assert.equal(JSON.parse(await fs.readFile(path.join(directory, ".shineo.json"), "utf8")).revisionId, "revision-after-overwrite");
    assert.deepEqual(calls.map((call) => ({ path: call.path, body: call.body })), [
      { path: "/cli/v1/tools/database_init", body: { projectId: "project-id", workspaceId: "workspace-id", input: { overwrite: false } } },
      { path: "/cli/v1/tools/database_init", body: { projectId: "project-id", workspaceId: "workspace-id", input: { overwrite: true } } },
    ]);
  } finally {
    process.chdir(previousDirectory);
  }
});
