import { readdir, readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";

export interface PrdDocIssue {
  path: string;
  message: string;
}

interface PrdManifest {
  file_count?: unknown;
  max_markdown_lines_target?: unknown;
  line_counts?: unknown;
  files?: unknown;
}

const defaultPrdDir = ".dev-docs/converting-md-prd-split";

export async function checkPrdDocs(prdDir = defaultPrdDir): Promise<PrdDocIssue[]> {
  const manifest = parseManifest(await readFile(join(prdDir, "manifest.json"), "utf8"));
  const entries = await readdir(prdDir, { withFileTypes: true });
  const markdownFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => entry.name)
    .sort();

  const lineCounts = new Map<string, number>();
  await Promise.all(
    markdownFiles.map(async (file) => {
      const content = await readFile(join(prdDir, file), "utf8");
      lineCounts.set(file, countLines(content));
    })
  );

  return findPrdDocIssues({ manifest, markdownFiles, lineCounts });
}

export function findPrdDocIssues(input: {
  manifest: PrdManifest;
  markdownFiles: string[];
  lineCounts: Map<string, number>;
}): PrdDocIssue[] {
  const files = readStringList(input.manifest.files);
  const maxLines = readPositiveInteger(input.manifest.max_markdown_lines_target, "max_markdown_lines_target");
  const issues: PrdDocIssue[] = [];

  if (typeof input.manifest.file_count !== "number" || input.manifest.file_count !== input.markdownFiles.length) {
    issues.push({ path: "manifest.json.file_count", message: "file_count must match Markdown file count." });
  }

  if (files.length === 0) {
    issues.push({ path: "manifest.json.files", message: "files must list PRD Markdown files." });
  } else if (!sameList(files, input.markdownFiles)) {
    issues.push({ path: "manifest.json.files", message: "files must match PRD Markdown files exactly." });
  }

  if (maxLines === null) {
    issues.push({
      path: "manifest.json.max_markdown_lines_target",
      message: "max_markdown_lines_target must be a positive integer."
    });
  }

  const manifestLineCounts = readLineCounts(input.manifest.line_counts);
  for (const file of input.markdownFiles) {
    const actual = input.lineCounts.get(file) ?? 0;
    if (maxLines !== null && actual > maxLines) {
      issues.push({ path: file, message: `PRD file has ${actual} lines; limit is ${maxLines}.` });
    }

    if (manifestLineCounts.get(file) !== actual) {
      issues.push({ path: `manifest.json.line_counts.${file}`, message: `Expected ${actual}.` });
    }
  }

  return issues;
}

function parseManifest(content: string): PrdManifest {
  return JSON.parse(content) as PrdManifest;
}

function countLines(content: string): number {
  if (content.length === 0) return 0;
  const lines = content.split(/\r?\n/).length;
  return content.endsWith("\n") ? lines - 1 : lines;
}

function readStringList(value: unknown): string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) return [];
  return [...value].sort();
}

function readPositiveInteger(value: unknown, _name: string): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

function readLineCounts(value: unknown): Map<string, number> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return new Map();

  return new Map(
    Object.entries(value).flatMap(([file, lines]) => {
      return typeof lines === "number" && Number.isInteger(lines) ? [[basename(file), lines]] : [];
    })
  );
}

function sameList(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

async function main(): Promise<void> {
  const issues = await checkPrdDocs(process.argv[2] ?? defaultPrdDir);
  if (issues.length === 0) {
    console.log("prd docs check passed");
    return;
  }

  for (const issue of issues) {
    console.error(`${issue.path}: ${issue.message}`);
  }

  process.exitCode = 1;
}

const isCli = fileURLToPath(import.meta.url) === process.argv[1];
if (isCli) {
  void main();
}
