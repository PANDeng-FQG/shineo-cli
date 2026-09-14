import { strict as assert } from "node:assert";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { readLocalProject, writeLocalFile } from "./project-files.js";
import { normalizeProjectPath } from "./project-path.js";

test("readLocalProject returns stable hashes and excludes CLI metadata", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "shineo-cli-files-"));
  await fs.mkdir(path.join(directory, "src"));
  await fs.mkdir(path.join(directory, ".shineo", "apisdk"), { recursive: true });
  await fs.writeFile(path.join(directory, "src", "main.ts"), "export const ready = true;\n", "utf8");
  await fs.writeFile(path.join(directory, ".shineo", "apisdk", "auth.ts"), "export const ready = true;\n", "utf8");
  await fs.writeFile(path.join(directory, ".shineo.json"), "{}\n", "utf8");
  const files = await readLocalProject(directory);

  assert.deepEqual(files.map((file) => file.path), [".shineo/apisdk/auth.ts", "src/main.ts"]);
  const mainFile = files.find((file) => file.path === "src/main.ts");
  assert.equal(mainFile?.contentHash, "4c9a2a851c102d1e1fe2ebb20defb6a0332b9b5c431a0fd644fe21712c412c6a");
  assert.equal(mainFile?.textEncoding, "utf-8");
});

test("writeLocalFile rejects paths outside the project directory", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "shineo-cli-files-"));
  await assert.rejects(() => writeLocalFile(directory, "../outside.txt", Buffer.from("x")), /项目文件路径包含非法目录段/);
});

test("writeLocalFile accepts a server manifest path with one leading slash", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "shineo-cli-files-"));
  await writeLocalFile(directory, "/src/components/Header.tsx", Buffer.from("export {}"));
  assert.equal(await fs.readFile(path.join(directory, "src", "components", "Header.tsx"), "utf8"), "export {}");
});

test("project paths are stable across operating systems", () => {
  assert.equal(normalizeProjectPath("src\\components\\Header.tsx"), "src/components/Header.tsx");
  assert.equal(normalizeProjectPath("/src/components/Header.tsx"), "src/components/Header.tsx");
  for (const value of ["../secret", "C:\\secret", "\\\\server\\share", "src/../secret", "src//file.ts"]) {
    assert.throws(() => normalizeProjectPath(value));
  }
});
