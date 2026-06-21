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
          DISABLE_IMAGE_CONVERSION: "false"
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
            DISABLE_IMAGE_CONVERSION: "true"
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
    d1_databases: [{ binding: "DB", database_id: overrides.d1Id ?? "d1-real-id" }],
    kv_namespaces: [{ binding: "CACHE_KV", id: overrides.kvId ?? "kv-real-id" }],
    vars: overrides.vars ?? {
      ENVIRONMENT: "production",
      REQUIRE_AUTH: "true",
      ALLOW_ANON: "false",
      DISABLE_IMAGE_CONVERSION: "true"
    }
  };
}
