import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

export interface DeployConfigIssue {
  path: string;
  message: string;
}

export async function checkDeployConfig(path = "wrangler.jsonc"): Promise<DeployConfigIssue[]> {
  const config = JSON.parse(await readFile(path, "utf8")) as unknown;
  return findDeployConfigIssues(config);
}

export function findDeployConfigIssues(config: unknown): DeployConfigIssue[] {
  if (!isRecord(config)) {
    return [{ path: "$", message: "Wrangler config must be a JSON object." }];
  }

  return [
    ...bindingIssues(config["d1_databases"], "d1_databases", "DB", "database_id"),
    ...bindingIssues(config["kv_namespaces"], "kv_namespaces", "CACHE_KV", "id"),
    ...productionVarIssues(config["vars"])
  ];
}

function bindingIssues(value: unknown, path: string, binding: string, idKey: string): DeployConfigIssue[] {
  if (!Array.isArray(value)) return [{ path, message: `${path} must be an array.` }];

  const entry = value.find((item) => isRecord(item) && item["binding"] === binding);
  if (!isRecord(entry)) return [{ path, message: `${binding} binding is required.` }];

  const id = entry[idKey];
  if (typeof id !== "string" || id.trim() === "" || id === "REPLACE_ME") {
    return [{ path: `${path}.${binding}.${idKey}`, message: `${binding} must use a real Cloudflare resource ID.` }];
  }

  return [];
}

function productionVarIssues(value: unknown): DeployConfigIssue[] {
  if (!isRecord(value)) return [{ path: "vars", message: "vars must be an object." }];

  return [
    ...requiredVars.flatMap(([name, expected]) => {
      return value[name] === expected ? [] : [{ path: `vars.${name}`, message: `${name} must be ${JSON.stringify(expected)}.` }];
    }),
    ...authModeIssues(value)
  ];
}

const requiredVars = [
  ["ENVIRONMENT", "production"],
  ["DISABLE_IMAGE_CONVERSION", "true"]
] as const;

function authModeIssues(vars: Record<string, unknown>): DeployConfigIssue[] {
  const requireAuth = vars["REQUIRE_AUTH"];
  const allowAnon = vars["ALLOW_ANON"];
  const locked = requireAuth === "true" && allowAnon === "false";
  const anonymous = requireAuth === "false" && allowAnon === "true";

  if (locked || anonymous) return [];

  return [
    {
      path: "vars.REQUIRE_AUTH",
      message: 'auth mode must be either REQUIRE_AUTH="true"/ALLOW_ANON="false" or REQUIRE_AUTH="false"/ALLOW_ANON="true".'
    }
  ];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function main(): Promise<void> {
  const issues = await checkDeployConfig(process.argv[2] ?? "wrangler.jsonc");
  if (issues.length === 0) {
    console.log("deploy config preflight passed");
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
