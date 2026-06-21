import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

export interface EnvHygieneIssue {
  path: string;
  message: string;
}

export interface EnvHygieneInput {
  devVarsExample: string;
  gitignore: string;
}

const requiredExampleVars = [
  "ADMIN_TOKEN",
  "API_KEY_PEPPER"
] as const;

const requiredIgnoredFiles = [".dev.vars", ".env", ".env.*"] as const;

export async function checkEnvHygiene(): Promise<EnvHygieneIssue[]> {
  const [devVarsExample, gitignore] = await Promise.all([
    readFile(".dev.vars.example", "utf8"),
    readFile(".gitignore", "utf8")
  ]);

  return findEnvHygieneIssues({ devVarsExample, gitignore });
}

export function findEnvHygieneIssues(input: EnvHygieneInput): EnvHygieneIssue[] {
  return [...devVarsExampleIssues(input.devVarsExample), ...gitignoreIssues(input.gitignore)];
}

function devVarsExampleIssues(content: string): EnvHygieneIssue[] {
  const parsed = parseEnvExample(content);
  const issues = [...parsed.issues];

  for (const name of requiredExampleVars) {
    const value = parsed.values.get(name);
    if (value === undefined) {
      issues.push({ path: `.dev.vars.example.${name}`, message: `${name} placeholder is required.` });
      continue;
    }

    if (value !== "replace_me") {
      issues.push({
        path: `.dev.vars.example.${name}`,
        message: `${name} must use the placeholder value "replace_me" in the example file.`
      });
    }
  }

  for (const name of parsed.duplicates) {
    issues.push({ path: `.dev.vars.example.${name}`, message: `${name} must be listed only once.` });
  }

  return issues;
}

function parseEnvExample(content: string): {
  values: Map<string, string>;
  duplicates: string[];
  issues: EnvHygieneIssue[];
} {
  const values = new Map<string, string>();
  const duplicates: string[] = [];
  const issues: EnvHygieneIssue[] = [];

  for (const [index, line] of content.split(/\r?\n/).entries()) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;

    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex <= 0) {
      issues.push({ path: `.dev.vars.example:${index + 1}`, message: "Expected KEY=value syntax." });
      continue;
    }

    const name = trimmed.slice(0, equalsIndex);
    const value = trimmed.slice(equalsIndex + 1);
    if (values.has(name)) duplicates.push(name);
    values.set(name, value);
  }

  return { values, duplicates, issues };
}

function gitignoreIssues(content: string): EnvHygieneIssue[] {
  const entries = new Set(
    content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line !== "" && !line.startsWith("#"))
  );

  return requiredIgnoredFiles.flatMap((entry) => {
    return entries.has(entry) ? [] : [{ path: ".gitignore", message: `${entry} must be ignored.` }];
  });
}

async function main(): Promise<void> {
  const issues = await checkEnvHygiene();
  if (issues.length === 0) {
    console.log("env hygiene check passed");
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
