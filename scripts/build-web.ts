import { build } from "esbuild";
import { cp, mkdir, readFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";

// Bundles the frontpage into dist/web, which wrangler.jsonc serves as static
// assets. Wrangler runs this through `build.command` before dev and deploy.
export const webOutDir = "dist/web";

export async function buildWeb(outDir = webOutDir): Promise<void> {
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  await Promise.all([
    build({
      entryPoints: ["web/src/main.ts"],
      outfile: `${outDir}/app.js`,
      bundle: true,
      format: "esm",
      target: "es2022",
      minify: true,
      loader: { ".css": "text" },
      banner: { js: await markedLicenseBanner() },
      logLevel: "warning"
    }),
    build({
      entryPoints: ["web/styles/main.css"],
      outfile: `${outDir}/app.css`,
      bundle: true,
      minify: true,
      logLevel: "warning"
    }),
    cp("web/public", outDir, { recursive: true })
  ]);
}

// marked's MIT notice is a plain block comment, which minification drops.
async function markedLicenseBanner(): Promise<string> {
  const manifest = JSON.parse(await readFile("node_modules/marked/package.json", "utf8")) as { version: string };
  return `/*! marked v${manifest.version} | (c) MarkedJS, Christopher Jeffrey | MIT License | https://github.com/markedjs/marked */`;
}

const isCli = fileURLToPath(import.meta.url) === process.argv[1];
if (isCli) {
  await buildWeb();
  console.log(`web assets built in ${webOutDir}`);
}
