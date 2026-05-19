import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface OversizedFile {
  path: string;
  lines: number;
}

const defaultDirs = ["src", "test", "scripts"];
const ignoredDirs = new Set(["node_modules", "dist", ".wrangler", "migrations"]);
const checkedExtensions = new Set([".ts", ".tsx"]);

export async function findOversizedFiles(root: string, maxLines = 300): Promise<OversizedFile[]> {
  const files: OversizedFile[] = [];

  for (const dir of defaultDirs) {
    await scanDirectory(resolve(root, dir), root, maxLines, files);
  }

  return files;
}

async function scanDirectory(path: string, root: string, maxLines: number, files: OversizedFile[]): Promise<void> {
  let entries;
  try {
    entries = await readdir(path, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (ignoredDirs.has(entry.name)) continue;

    const child = join(path, entry.name);
    if (entry.isDirectory()) {
      await scanDirectory(child, root, maxLines, files);
      continue;
    }

    if (entry.isFile() && checkedExtensions.has(extname(entry.name))) {
      const lines = await countLines(child);
      if (lines > maxLines) {
        files.push({ path: relative(root, child), lines });
      }
    }
  }
}

async function countLines(path: string): Promise<number> {
  const content = await readFile(path, "utf8");
  if (content.length === 0) return 0;
  return content.split("\n").length;
}

async function main(): Promise<void> {
  const root = process.cwd();
  const oversized = await findOversizedFiles(root);
  if (oversized.length === 0) return;

  for (const file of oversized) {
    console.error(`${file.path}: ${file.lines} lines`);
  }

  process.exitCode = 1;
}

const isCli = fileURLToPath(import.meta.url) === process.argv[1];
if (isCli) {
  void main();
}

