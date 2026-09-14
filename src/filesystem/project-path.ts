const maxProjectPathLength = 1024;

/**
 * Project paths are relative POSIX paths at the CLI/backend boundary.
 * A leading slash is accepted only for compatibility with server/compiler manifests.
 */
export function normalizeProjectPath(input: string): string {
  if (!input || input.includes("\0")) throw new Error("项目文件路径不能为空或包含 NUL");

  const normalizedSeparators = input.normalize("NFC").replaceAll("\\", "/");
  if (/^[A-Za-z]:\//.test(normalizedSeparators) || normalizedSeparators.startsWith("//")) {
    throw new Error(`项目文件路径不能是绝对路径：${input}`);
  }

  const relativePath = normalizedSeparators.startsWith("/")
    ? normalizedSeparators.slice(1)
    : normalizedSeparators;
  const parts = relativePath.split("/");
  if (!relativePath || parts.some((part) => !part || part === "." || part === "..")) {
    throw new Error(`项目文件路径包含非法目录段：${input}`);
  }
  if (relativePath.length > maxProjectPathLength) throw new Error("项目文件路径过长");
  return parts.join("/");
}

export function toCompilerProjectPath(input: string): string {
  return `/${normalizeProjectPath(input)}`;
}

export function assertUniqueProjectPaths(paths: string[]): void {
  const seen = new Set<string>();
  for (const input of paths) {
    const normalized = normalizeProjectPath(input);
    if (seen.has(normalized)) throw new Error(`项目文件路径重复：${normalized}`);
    seen.add(normalized);
  }
}

export function isCliConfigPath(input: string): boolean {
  const normalized = normalizeProjectPath(input);
  return normalized === ".shineo.json";
}
