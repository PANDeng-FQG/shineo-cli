import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { normalizeProjectPath } from "./project-path.js";

export type LocalProjectFile = {
  path: string;
  absolutePath: string;
  contents: Buffer;
  contentHash: string;
  sizeBytes: number;
  mimeType: string;
  textEncoding: "utf-8" | null;
};

const ignoredNames = new Set([".git", "node_modules", "dist", ".next", ".turbo", ".shineo.json"]);

export async function readLocalProject(directory = process.cwd()): Promise<LocalProjectFile[]> {
  const files: LocalProjectFile[] = [];
  await visit(directory, directory, files);
  return files.sort((left, right) => left.path.localeCompare(right.path));
}

export async function writeLocalFile(directory: string, filePath: string, contents: Buffer): Promise<void> {
  const normalized = normalizeProjectPath(filePath);
  const absolutePath = path.resolve(directory, normalized);
  if (!isInside(directory, absolutePath)) throw new Error(`远程文件路径越界：${filePath}`);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  const realRoot = await fs.realpath(directory);
  const realParent = await fs.realpath(path.dirname(absolutePath));
  if (!isInside(realRoot, realParent)) throw new Error(`远程文件路径越界：${filePath}`);
  try {
    if ((await fs.lstat(absolutePath)).isSymbolicLink()) throw new Error(`远程文件不能覆盖符号链接：${filePath}`);
  } catch (error) {
    if (!isMissingFile(error)) throw error;
  }
  await fs.writeFile(absolutePath, contents);
}

async function visit(root: string, current: string, files: LocalProjectFile[]): Promise<void> {
  const relativeDirectory = path.relative(root, current).replace(/\\/g, "/");
  const insideShineoDirectory = relativeDirectory === ".shineo" || relativeDirectory.startsWith(".shineo/");
  for (const entry of await fs.readdir(current, { withFileTypes: true })) {
    if (ignoredNames.has(entry.name) || (entry.name.startsWith(".") && entry.name !== ".shineo" && !insideShineoDirectory)) continue;
    const absolutePath = path.join(current, entry.name);
    if (entry.isDirectory()) {
      await visit(root, absolutePath, files);
      continue;
    }
    if (!entry.isFile()) continue;
    const contents = await fs.readFile(absolutePath);
    const relativePath = normalizeProjectPath(path.relative(root, absolutePath));
    files.push({
      path: relativePath,
      absolutePath,
      contents,
      contentHash: createHash("sha256").update(contents).digest("hex"),
      sizeBytes: contents.byteLength,
      mimeType: mimeTypeFor(relativePath),
      textEncoding: isTextPath(relativePath) ? "utf-8" : null,
    });
  }
}

function isInside(root: string, target: string): boolean {
  const relative = path.relative(path.resolve(root), target);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== "..");
}

function isMissingFile(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}

function isTextPath(filePath: string): boolean {
  return /\.(?:css|html?|js|jsx|json|md|mjs|ts|tsx|txt|xml|yaml|yml)$/i.test(filePath);
}

function mimeTypeFor(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();
  return ({
    ".css": "text/css",
    ".html": "text/html",
    ".js": "text/javascript",
    ".json": "application/json",
    ".md": "text/markdown",
    ".svg": "image/svg+xml",
    ".ts": "text/typescript",
    ".tsx": "text/typescript",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
  } as Record<string, string>)[extension] ?? "application/octet-stream";
}
