#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";

const args = process.argv.slice(2);
const environment = flagValue("--env") || flagValue("--environment");
const config = flagValue("--config");
const commandIndex = args.findIndex((arg) => !arg.startsWith("--"));
const command = commandIndex >= 0 ? args[commandIndex] : null;
const passthrough = commandIndex >= 0 ? args.slice(commandIndex + 1) : [];
const allowedEnvironments = new Set(["dev", "staging", "production"]);
const envSensitiveCommands = new Set(["deploy", "dev", "types", "tail", "secret", "d1", "queues", "r2", "kv"]);

function flagValue(name) {
  const index = args.indexOf(name);
  if (index >= 0) return args[index + 1];
  const inline = args.find((arg) => arg.startsWith(`${name}=`));
  return inline ? inline.slice(name.length + 1) : undefined;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!command) fail("wrangler command is required");
if (envSensitiveCommands.has(command) && !environment) fail("--env is required for governed Wrangler execution");
if (environment && !allowedEnvironments.has(environment)) fail(`invalid --env ${environment}; expected dev, staging, or production`);

const wranglerArgs = [command, ...passthrough];
if (config && !wranglerArgs.includes("--config")) wranglerArgs.push("--config", config);
if (environment && !wranglerArgs.includes("--env")) wranglerArgs.push("--env", environment);

if (command === "deploy" && !environment) fail("wrangler deploy without --env is forbidden");

const packageDir = config?.startsWith("services/")
  ? config.split(path.sep).slice(0, 2).join(path.sep)
  : "services/api-gateway";

const result = spawnSync("pnpm", ["--dir", packageDir, "exec", "wrangler", ...wranglerArgs], {
  stdio: "inherit",
  env: process.env,
  shell: process.platform === "win32",
});

process.exit(result.status ?? 1);
