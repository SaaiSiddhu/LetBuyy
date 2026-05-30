import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const governedEnvironments = new Set(["dev", "staging", "production"]);
const args = process.argv.slice(2);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function flagValue(name) {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  return args[index + 1];
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

const config = flagValue("--config");
const environment = flagValue("--env");

if (!config) fail("--config is required for governed Worker deployment");
if (!environment) fail("--env is required for governed Worker deployment");
if (!governedEnvironments.has(environment)) fail(`invalid --env ${environment}; expected dev, staging, or production`);

const capabilityCheck = spawnSync(process.execPath, [
  path.join(repoRoot, "infrastructure/scripts/cloudflare/provider-capability-validator.mjs"),
  `--environment=${environment}`,
  "--execute",
], {
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (capabilityCheck.status !== 0) {
  process.exit(capabilityCheck.status ?? 1);
}

const configPath = path.resolve(config);
const relativeConfigPath = path.relative(repoRoot, configPath).split(path.sep).join("/");
const configSegments = relativeConfigPath.split("/");
const packageDir = configSegments[0] === "services" && configSegments[1]
  ? path.join(repoRoot, configSegments[0], configSegments[1])
  : process.cwd();

const passthrough = [];
for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === "--config" || arg === "--env") {
    index += 1;
    continue;
  }
  passthrough.push(arg);
}

const result = spawnSync("pnpm", ["--dir", packageDir, "exec", "wrangler", "deploy", "--config", configPath, "--env", environment, "--keep-vars", ...passthrough], {
  stdio: "inherit",
  shell: process.platform === "win32",
});

process.exit(result.status ?? 1);
