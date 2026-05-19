import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import process from "node:process";

const packageLockPath = new URL("../package-lock.json", import.meta.url);

const runNpm = (args) => {
  const result = spawnSync("npm", args, {
    stdio: "inherit",
    env: process.env,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

const readPackageLock = () => {
  const rawLock = readFileSync(packageLockPath, "utf8");
  return JSON.parse(rawLock);
};

const isGlibcRuntime = () => {
  const runtimeReport = process.report?.getReport();
  return Boolean(runtimeReport?.header?.glibcVersionRuntime);
};

const resolveRolldownBindingName = () => {
  if (process.platform !== "linux" || process.arch !== "x64") {
    return null;
  }

  return isGlibcRuntime()
    ? "@rolldown/binding-linux-x64-gnu"
    : "@rolldown/binding-linux-x64-musl";
};

const getLockedRolldownBindingSpec = (bindingName) => {
  const packageLock = readPackageLock();
  const optionalDependencies =
    packageLock.packages?.["node_modules/rolldown"]?.optionalDependencies;
  const bindingVersion = optionalDependencies?.[bindingName];

  if (typeof bindingVersion !== "string") {
    throw new Error(`Missing ${bindingName} in rolldown optional dependencies`);
  }

  return `${bindingName}@${bindingVersion}`;
};

const bindingPackagePath = (bindingName) =>
  `node_modules/${bindingName}/package.json`;

runNpm(["ci", "--ignore-scripts", "--include=dev", "--include=optional"]);

const bindingName = resolveRolldownBindingName();

if (!bindingName) {
  process.exit(0);
}

if (existsSync(bindingPackagePath(bindingName))) {
  process.exit(0);
}

const bindingSpec = getLockedRolldownBindingSpec(bindingName);
console.log(`Installing missing Rolldown native binding ${bindingSpec}`);
runNpm(["install", "--ignore-scripts", "--no-save", bindingSpec]);

if (!existsSync(bindingPackagePath(bindingName))) {
  throw new Error(`Failed to install ${bindingSpec}`);
}
