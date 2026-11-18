#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { isAbsolute } from "node:path";

const args = new Set(process.argv.slice(2));
const execute = args.has("--execute");
const environment = valueFor("--environment") || "staging";
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

assert(["staging", "production"].includes(environment), "--environment must be staging or production");
assert(major(process.versions.node) >= requiredNodeMajor, `Node ${requiredNodeMajor}+ is required for Wrangler 4 provider execution. Current Node is ${process.versions.node}`);

const pnpm = commandOutput("pnpm", ["-v"]);
assert(pnpm.status === 0, "pnpm must be available for workspace-safe Wrangler execution");

const wrangler = commandOutput("pnpm", ["--dir", "services/api-gateway", "exec", "wrangler", "--version"]);
assert(wrangler.status === 0, `wrangler --version failed: ${wrangler.stderr || "no stderr"}`);
const wranglerVersion = wrangler.stdout.match(/\d+\.\d+\.\d+/)?.[0] || "";
assert(major(wranglerVersion) >= requiredWranglerMajor, `Wrangler ${requiredWranglerMajor}+ is required. Current Wrangler is ${wranglerVersion || wrangler.stdout}`);

if (execute) {
  const authMode = process.env.LETBUYY_CLOUDFLARE_AUTH_MODE || "api-token";
  assert(["api-token", "oauth"].includes(authMode), "Unsupported Cloudflare authentication mode");
  const missing = ["CLOUDFLARE_ACCOUNT_ID", ...(authMode === "api-token" ? ["CLOUDFLARE_API_TOKEN"] : [])].filter((name) => !process.env[name]);
  assert(missing.length === 0, `Missing required Cloudflare provider environment variables: ${missing.join(", ")}`);
  assert(/^[0-9a-f]{32}$/.test(process.env.CLOUDFLARE_ACCOUNT_ID), "Cloudflare account ID must be explicit and valid");
  if (authMode === "oauth") {
    assert(!process.env.CLOUDFLARE_API_TOKEN && !process.env.CLOUDFLARE_API_KEY, "OAuth mode cannot mix token/key environment credentials");
    assert(process.env.XDG_CONFIG_HOME && isAbsolute(process.env.XDG_CONFIG_HOME), "OAuth execution requires an explicit absolute scoped CLI configuration");
  }
  if (environment === "production") {
    assert(process.env.LETBUYY_PROVIDER_MUTATION_APPROVED === "true", "Production provider mutation requires LETBUYY_PROVIDER_MUTATION_APPROVED=true");
  }
  // Wrangler owns credential loading/refresh. Never extract a stored token or
  // print provider output; only its public login/account metadata is consumed.
  const whoami = commandOutput("pnpm", ["--dir", "services/api-gateway", "exec", "wrangler", "whoami", "--json"]);
  assert(whoami.status === 0, "wrangler whoami failed; provider authentication is unavailable");
  let identity;
  try { identity = JSON.parse(whoami.stdout); } catch { throw new Error("Wrangler did not return structured identity metadata"); }
  assert(identity?.loggedIn === true && Array.isArray(identity.accounts), "Wrangler must prove an authenticated account");
  assert(identity.accounts.some((account) => account?.id === process.env.CLOUDFLARE_ACCOUNT_ID), "The requested Cloudflare account is not in the authenticated account set");
  if (authMode === "oauth") assert(identity.authType === "OAuth Token", "OAuth mode requires Wrangler's native OAuth login");
}

console.log(`[provider-capability-validator] ${environment} capabilities passed (${execute ? "execute" : "plan"} mode, wrangler ${wranglerVersion})`);
