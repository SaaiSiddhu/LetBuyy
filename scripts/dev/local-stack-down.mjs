#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, unlinkSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const runRoot = join(repoRoot, ".tmp", "federation-stack");
const pidsFile = join(runRoot, "pids.json");
const fallbackProjectId = "letbuyy-federation-local";

function run(command, args, options = {}) {
  const printable = [command, ...args].join(" ");
  console.log(`[federation-stack] ${printable}`);
  return spawnSync(command, args, {
    cwd: options.cwd || repoRoot,
    env: process.env,
    stdio: options.stdio || "inherit",
    encoding: "utf8",
  });
}

function stopProcess(pid) {
  if (!pid) return;
  try {
    process.kill(-pid, "SIGTERM");
    console.log(`[federation-stack] stopped process group ${pid}`);
  } catch {
    try {
      process.kill(pid, "SIGTERM");
      console.log(`[federation-stack] stopped pid ${pid}`);
    } catch {
      console.log(`[federation-stack] pid ${pid} was not running`);
    }
  }
}

let projectId = fallbackProjectId;
if (existsSync(pidsFile)) {
  const state = JSON.parse(readFileSync(pidsFile, "utf8"));
  projectId = state.projectId || fallbackProjectId;
  for (const entry of state.processes || []) {
    stopProcess(entry.pid);
  }
}

run("supabase", ["stop", "--project-id", projectId, "--no-backup"]);

try {
  unlinkSync(join(repoRoot, "services", "api-gateway", ".dev.vars"));
} catch {
  // ignored: .dev.vars is local-only and may not exist
}

rmSync(runRoot, { recursive: true, force: true });
console.log("[federation-stack] local federation stack stopped");
