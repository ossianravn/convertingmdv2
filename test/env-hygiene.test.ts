import { describe, expect, it } from "vitest";
import { findEnvHygieneIssues } from "../scripts/check-env-hygiene";

describe("env hygiene check", () => {
  it("accepts required local secret placeholders and ignore rules", () => {
    expect(
      findEnvHygieneIssues({
        devVarsExample: [
          "ADMIN_TOKEN=replace_me",
          "API_KEY_PEPPER=replace_me"
        ].join("\n"),
        gitignore: ["node_modules/", ".dev.vars", ".env", ".env.*"].join("\n")
      })
    ).toEqual([]);
  });

  it("rejects missing, duplicate, and non-placeholder example secrets", () => {
    const issues = findEnvHygieneIssues({
      devVarsExample: [
        "ADMIN_TOKEN=replace_me",
        "ADMIN_TOKEN=replace_me",
        "API_KEY_PEPPER=actual-secret"
      ].join("\n"),
      gitignore: [".dev.vars", ".env", ".env.*"].join("\n")
    });

    expect(issues).toEqual([
      {
        path: ".dev.vars.example.API_KEY_PEPPER",
        message: 'API_KEY_PEPPER must use the placeholder value "replace_me" in the example file.'
      },
      { path: ".dev.vars.example.ADMIN_TOKEN", message: "ADMIN_TOKEN must be listed only once." }
    ]);
  });

  it("rejects missing local env ignore rules", () => {
    const issues = findEnvHygieneIssues({
      devVarsExample: [
        "ADMIN_TOKEN=replace_me",
        "API_KEY_PEPPER=replace_me"
      ].join("\n"),
      gitignore: "node_modules/\n"
    });

    expect(issues).toEqual([
      { path: ".gitignore", message: ".dev.vars must be ignored." },
      { path: ".gitignore", message: ".env must be ignored." },
      { path: ".gitignore", message: ".env.* must be ignored." }
    ]);
  });
});
