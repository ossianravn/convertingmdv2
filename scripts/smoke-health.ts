import { spawn, type ChildProcessByStdio } from "node:child_process";
import type { Readable } from "node:stream";
import { setTimeout as delay } from "node:timers/promises";

type WranglerProcess = ChildProcessByStdio<null, Readable, Readable>;

const port = readPort();
const healthUrl = `http://127.0.0.1:${port}/healthz`;
let processOutput = "";
const worker = startWrangler(port);

try {
  const requestId = await waitForHealth(worker, healthUrl);
  console.log(`health smoke passed: ${healthUrl} (${requestId})`);
} finally {
  await stopProcess(worker);
}

function startWrangler(port: number): WranglerProcess {
  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  const child = spawn(
    npmCommand,
    ["run", "dev", "--", "--local", "--port", String(port), "--local-protocol", "http"],
    {
      cwd: process.cwd(),
      detached: process.platform !== "win32",
      env: { ...process.env, HOME: process.env["SMOKE_HOME"] ?? "/tmp" },
      stdio: ["ignore", "pipe", "pipe"]
    }
  );

  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", captureOutput);
  child.stderr.on("data", captureOutput);
  return child;
}

function captureOutput(chunk: string): void {
  processOutput = (processOutput + chunk).slice(-8000);
}

async function waitForHealth(worker: WranglerProcess, url: string): Promise<string> {
  const startedAt = Date.now();
  let lastError: unknown = null;

  while (Date.now() - startedAt < 15000) {
    if (worker.exitCode !== null) {
      throw new Error(`Wrangler exited before health check passed.\n${processOutput}`);
    }

    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
      const requestId = response.headers.get("X-Converting-Request-Id") ?? "";
      const body: unknown = await response.json();
      if (response.ok && isHealthyBody(body) && requestId.startsWith("req_")) return requestId;
    } catch (error) {
      lastError = error;
    }

    await delay(500);
  }

  throw new Error(`Health check timed out. Last error: ${errorMessage(lastError)}\n${processOutput}`);
}

async function stopProcess(worker: WranglerProcess): Promise<void> {
  if (worker.exitCode !== null || worker.pid === undefined) return;

  sendSignal(worker, "SIGTERM");
  await Promise.race([waitForExit(worker), delay(5000)]);
  if (worker.exitCode !== null) return;

  sendSignal(worker, "SIGKILL");
  await Promise.race([waitForExit(worker), delay(2000)]);
}

function sendSignal(worker: WranglerProcess, signal: NodeJS.Signals): void {
  if (worker.pid === undefined) return;

  try {
    if (process.platform === "win32") worker.kill(signal);
    else process.kill(-worker.pid, signal);
  } catch (error) {
    if (worker.exitCode === null) throw error;
  }
}

function waitForExit(worker: WranglerProcess): Promise<void> {
  if (worker.exitCode !== null) return Promise.resolve();
  return new Promise((resolve) => worker.once("exit", () => resolve()));
}

function readPort(): number {
  const rawPort = process.env["SMOKE_PORT"] ?? "8787";
  const parsed = Number(rawPort);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error("SMOKE_PORT must be an integer between 1 and 65535.");
  }

  return parsed;
}

function isHealthyBody(value: unknown): value is { ok: true } {
  return typeof value === "object" && value !== null && (value as Record<string, unknown>)["ok"] === true;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
