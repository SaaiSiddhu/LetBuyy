#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";

export const composeFile = path.posix.join("infrastructure", "local", "docker-compose.yml");
export const projectName = "letbuyy-local";

export function dockerComposeArgs(args) {
  return ["compose", "-f", composeFile, "--project-name", projectName, ...args];
}

export function run(command, args, options = {}) {
  const printable = [command, ...args].join(" ");
  console.log(`[local] ${printable}`);
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: options.stdio || "inherit",
    encoding: options.encoding || "utf8",
  });

  if (result.status !== 0) {
    throw new Error(`${printable} failed with status ${result.status}`);
  }

  return result;
}

export function ensureDockerAvailable() {
  const result = spawnSync("docker", ["compose", "version"], {
    cwd: process.cwd(),
    stdio: "ignore",
  });

  if (result.status !== 0) {
    throw new Error("Docker Compose is required for the LetBuyy local lifecycle stack.");
  }
}
