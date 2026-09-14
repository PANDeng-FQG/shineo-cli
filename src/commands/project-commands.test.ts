import assert from "node:assert/strict";
import { test } from "node:test";
import { createProjectMutations } from "./project-commands.js";

test("createProjectMutations normalizes server paths before push", () => {
  const localFiles = [
    localFile("src/components/Header.tsx", "local-header"),
    localFile("src/new.ts", "new-file"),
    localFile(".shineo/apisdk/index.ts", "local-sdk"),
  ];
  const remoteFiles = [
    remoteFile("/src/components/Header.tsx", "remote-header"),
    remoteFile("/src/removed.ts", "removed-file"),
    remoteFile("/.shineo/apisdk/index.ts", "remote-sdk"),
    remoteFile("/.shineo.json", "cli-config"),
  ];

  assert.deepEqual(createProjectMutations(localFiles, remoteFiles).map((mutation) => ({
    type: mutation.type,
    path: mutation.path,
    expectedContentHash: mutation.expectedContentHash,
  })), [
    { type: "write", path: "src/components/Header.tsx", expectedContentHash: "remote-header" },
    { type: "write", path: "src/new.ts", expectedContentHash: null },
    { type: "write", path: ".shineo/apisdk/index.ts", expectedContentHash: "remote-sdk" },
    { type: "delete", path: "src/removed.ts", expectedContentHash: "removed-file" },
  ]);
});

function localFile(filePath: string, content: string) {
  return {
    path: filePath,
    absolutePath: filePath,
    contents: Buffer.from(content),
    contentHash: content === "local-header" ? "local-header" : "new-file",
    sizeBytes: Buffer.byteLength(content),
    mimeType: "text/typescript",
    textEncoding: "utf-8" as const,
  };
}

function remoteFile(filePath: string, contentHash: string) {
  return { path: filePath, url: "https://example.test/file", contentHash };
}
