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
    ...browserBindingIssues(config["browser"]),
    ...frontpageIssues(config["assets"], config["build"]),
    ...bindingIssues(config["d1_databases"], "d1_databases", "DB", "database_id"),
    ...bindingIssues(config["kv_namespaces"], "kv_namespaces", "CACHE_KV", "id"),
    ...productionVarIssues(config["vars"])
  ];
}

function browserBindingIssues(value: unknown): DeployConfigIssue[] {
  if (!isRecord(value)) return [{ path: "browser", message: "BROWSER binding is required." }];
  if (value["binding"] !== "BROWSER") {
    return [{ path: "browser.binding", message: 'browser binding must be "BROWSER".' }];
  }
  return [];
}

// `/` must reach the Worker, which picks HTML or JSON and adds the page's CSP.
// html_handling "auto-trailing-slash" would serve index.html for `/` directly.
const expectedAssets = { binding: "ASSETS", directory: "./dist/web", html_handling: "none" } as const;

function frontpageIssues(assets: unknown, build: unknown): DeployConfigIssue[] {
  const issues: DeployConfigIssue[] = Object.entries(expectedAssets).flatMap(([key, expected]) => {
    const actual = isRecord(assets) ? assets[key] : undefined;
    return actual === expected ? [] : [{ path: `assets.${key}`, message: `assets.${key} must be ${JSON.stringify(expected)}.` }];
  });

  if (!isRecord(build) || build["command"] !== "npm run build:web") {
    issues.push({ path: "build.command", message: 'build.command must be "npm run build:web".' });
  }

  return issues;
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
    ...authModeIssues(value),
    ...fallbackIssues(value)
  ];
}

// Jev answers are only stable on a pinned model; an alias moves on its own.
// Frankensurf, when enabled, must be reached over TLS: the call carries its key.
function fallbackIssues(vars: Record<string, unknown>): DeployConfigIssue[] {
  const issues: DeployConfigIssue[] = [];
  const model = vars["TYPESAFE_MODEL"];
  if (typeof model !== "string" || !/^jev-\d+\.\d+\.\d+$/.test(model)) {
    issues.push({ path: "vars.TYPESAFE_MODEL", message: 'TYPESAFE_MODEL must be a pinned Jev version such as "jev-1.14.0".' });
  }

  const enabled = vars["DISABLE_FRANKENSURF"] === "false";
  const url = vars["FRANKENSURF_URL"];
  if (enabled && (typeof url !== "string" || !url.startsWith("https://"))) {
    issues.push({ path: "vars.FRANKENSURF_URL", message: "FRANKENSURF_URL must be an https:// URL when Frankensurf is enabled." });
  }

  return issues;
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
