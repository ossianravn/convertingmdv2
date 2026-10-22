import { describe, expect, it } from "vitest";
import { findDeployConfigIssues } from "../scripts/check-deploy-config";

describe("deploy config preflight", () => {
  it("rejects placeholder Cloudflare binding IDs", () => {
    const issues = findDeployConfigIssues(validConfig({ d1Id: "REPLACE_ME", kvId: "REPLACE_ME" }));

    expect(issues).toEqual([
      { path: "d1_databases.DB.database_id", message: "DB must use a real Cloudflare resource ID." },
      { path: "kv_namespaces.CACHE_KV.id", message: "CACHE_KV must use a real Cloudflare resource ID." }
    ]);
  });

  it("rejects unsafe production vars", () => {
    const issues = findDeployConfigIssues(
      validConfig({
        vars: {
          ENVIRONMENT: "development",
          REQUIRE_AUTH: "false",
          ALLOW_ANON: "false",
          DISABLE_IMAGE_CONVERSION: "false",
          TYPESAFE_MODEL: "jev-1.14.0"
        }
      })
    );

    expect(issues).toEqual([
      { path: "vars.ENVIRONMENT", message: 'ENVIRONMENT must be "production".' },
      { path: "vars.DISABLE_IMAGE_CONVERSION", message: 'DISABLE_IMAGE_CONVERSION must be "true".' },
      {
        path: "vars.REQUIRE_AUTH",
        message:
          'auth mode must be either REQUIRE_AUTH="true"/ALLOW_ANON="false" or REQUIRE_AUTH="false"/ALLOW_ANON="true".'
      }
    ]);
  });

  it("rejects missing Browser binding", () => {
    const { browser: _browser, ...config } = validConfig({});

    expect(findDeployConfigIssues(config)).toEqual([{ path: "browser", message: "BROWSER binding is required." }]);
  });

  it("requires the frontpage assets to be built and routed through the Worker", () => {
    const config = { ...validConfig({}), assets: { binding: "ASSETS", directory: "./dist/web", html_handling: "auto-trailing-slash" } };
    const { build: _build, ...withoutBuild } = config;

    expect(findDeployConfigIssues(withoutBuild)).toEqual([
      { path: "assets.html_handling", message: 'assets.html_handling must be "none".' },
      { path: "build.command", message: 'build.command must be "npm run build:web".' }
    ]);
  });

  it("requires a pinned Jev model and an https Frankensurf URL when enabled", () => {
    const vars = { ...validConfig({}).vars, TYPESAFE_MODEL: "jev-latest", DISABLE_FRANKENSURF: "false", FRANKENSURF_URL: "http://surf.example" };

    expect(findDeployConfigIssues(validConfig({ vars }))).toEqual([
      { path: "vars.TYPESAFE_MODEL", message: 'TYPESAFE_MODEL must be a pinned Jev version such as "jev-1.14.0".' },
      { path: "vars.FRANKENSURF_URL", message: "FRANKENSURF_URL must be an https:// URL when Frankensurf is enabled." }
    ]);
  });

  it("accepts real resource IDs and safe production vars", () => {
    expect(findDeployConfigIssues(validConfig({}))).toEqual([]);
  });

  it("accepts explicit anonymous production mode with image conversion disabled", () => {
    expect(
      findDeployConfigIssues(
        validConfig({
          vars: {
            ENVIRONMENT: "production",
            REQUIRE_AUTH: "false",
            ALLOW_ANON: "true",
            DISABLE_IMAGE_CONVERSION: "true",
            TYPESAFE_MODEL: "jev-1.14.0"
          }
        })
      )
    ).toEqual([]);
  });
});

interface ConfigOverrides {
  d1Id?: string;
  kvId?: string;
  vars?: Record<string, string>;
}

function validConfig(overrides: ConfigOverrides) {
  return {
    browser: { binding: "BROWSER" },
    build: { command: "npm run build:web" },
    assets: { binding: "ASSETS", directory: "./dist/web", html_handling: "none" },
    d1_databases: [{ binding: "DB", database_id: overrides.d1Id ?? "d1-real-id" }],
    kv_namespaces: [{ binding: "CACHE_KV", id: overrides.kvId ?? "kv-real-id" }],
    vars: overrides.vars ?? {
      ENVIRONMENT: "production",
      REQUIRE_AUTH: "true",
      ALLOW_ANON: "false",
      DISABLE_IMAGE_CONVERSION: "true",
      TYPESAFE_MODEL: "jev-1.14.0"
    }
  };
}
