import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { findOversizedFiles } from "../scripts/check-file-lines";

let tempRoot: string | null = null;

afterEach(async () => {
  if (tempRoot) {
    await rm(tempRoot, { recursive: true, force: true });
    tempRoot = null;
  }
});

describe("file line check", () => {
  it("passes files at or under the limit", async () => {
    tempRoot = await createTempProject();
    await writeFile(join(tempRoot, "src", "ok.ts"), makeLines(300));

    await expect(findOversizedFiles(tempRoot)).resolves.toEqual([]);
  });

  it("reports files over the limit", async () => {
    tempRoot = await createTempProject();
    await writeFile(join(tempRoot, "src", "too-large.ts"), makeLines(301));

    await expect(findOversizedFiles(tempRoot)).resolves.toEqual([{ path: "src/too-large.ts", lines: 301 }]);
  });
});

async function createTempProject(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "converting-md-lines-"));
  await mkdir(join(root, "src"));
  await mkdir(join(root, "test"));
  await mkdir(join(root, "scripts"));
  return root;
}

function makeLines(count: number): string {
  return Array.from({ length: count }, () => "export {};").join("\n");
}
