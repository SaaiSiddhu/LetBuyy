#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const args = new Set(process.argv.slice(2));
const execute = args.has("--execute");
const environment = valueFor("--environment") || "dev";
const requiredWranglerMajor = 4;
const requiredNodeMajor = 22;

function valueFor(prefix) {
  const arg = process.argv.slice(2).find((candidate) => candidate.startsWith(`${prefix}=`));
  return arg ? arg.slice(prefix.length + 1) : null;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function commandOutput(command, commandArgs) {
  const result = spawnSync(command, commandArgs, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  return {
    status: result.status ?? 1,
    stdout: (result.stdout || "").trim(),
    stderr: (result.stderr || "").trim(),
  };
}

function major(version) {
  return Number(String(version).replace(/^v/, "").split(".")[0]);
}

assert(["dev", "staging", "production"].includes(environment), "--environment must be dev, staging, or production");
assert(major(process.versions.node) >= requiredNodeMajor, `Node ${requiredNodeMajor}+ is required for Wrangler 4 provider execution. Current Node is ${process.versions.node}`);

const pnpm = commandOutput("pnpm", ["-v"]);
assert(pnpm.status === 0, "pnpm must be available for workspace-safe Wrangler execution");

const wrangler = commandOutput("pnpm", ["--dir", "services/api-gateway", "exec", "wrangler", "--version"]);
assert(wrangler.status === 0, `wrangler --version failed: ${wrangler.stderr || "no stderr"}`);
const wranglerVersion = wrangler.stdout.match(/\d+\.\d+\.\d+/)?.[0] || "";
assert(major(wranglerVersion) >= requiredWranglerMajor, `Wrangler ${requiredWranglerMajor}+ is required. Current Wrangler is ${wranglerVersion || wrangler.stdout}`);

if (execute) {
  const missing = ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"].filter((name) => !process.env[name]);
  assert(missing.length === 0, `Missing required Cloudflare provider environment variables: ${missing.join(", ")}`);
  if (environment === "production") {
    assert(process.env.LETBUYY_PROVIDER_MUTATION_APPROVED === "true", "Production provider mutation requires LETBUYY_PROVIDER_MUTATION_APPROVED=true");
  }
  const whoami = commandOutput("pnpm", ["--dir", "services/api-gateway", "exec", "wrangler", "whoami"]);
  assert(whoami.status === 0, `wrangler whoami failed: ${whoami.stderr || "provider auth invalid"}`);
}

console.log(`[provider-capability-validator] ${environment} capabilities passed (${execute ? "execute" : "plan"} mode, wrangler ${wranglerVersion})`);
