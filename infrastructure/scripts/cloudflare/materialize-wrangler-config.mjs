#!/usr/bin/env node
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const args = new Set(process.argv.slice(2));
const configPath = valueFor("--config");
const environment = valueFor("--environment") || "dev";
const outputPath = valueFor("--output");
const requireRealBindings = args.has("--require-real-bindings");

function valueFor(prefix) {
  const arg = process.argv.slice(2).find((candidate) => candidate.startsWith(`${prefix}=`));
  return arg ? arg.slice(prefix.length + 1) : null;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readTerraformOutput(outputName) {
  const result = spawnSync("terraform", [
    "-chdir=infrastructure/cloudflare",
    "output",
    "-json",
    outputName,
  ], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.status !== 0 || !result.stdout.trim()) return {};

  try {
    return JSON.parse(result.stdout);
  } catch {
    return {};
  }
}

function readTerraformCacheNamespaceIds() {
  return readTerraformOutput("letbuyy_runtime_cache_namespace_ids");
}

function readTerraformD1DatabaseIds() {
  return readTerraformOutput("letbuyy_runtime_d1_database_ids");
}

function cacheNamespaceIdFor(envName) {
  const envKey = envName.toUpperCase();
  const explicit = process.env[`LETBUYY_RUNTIME_CACHE_${envKey}_NAMESPACE_ID`];
  if (explicit) return explicit;

  const terraformIds = readTerraformCacheNamespaceIds();
  return terraformIds[envName] || "";
}

function d1DatabaseIdFor(envName) {
  const envKey = envName.toUpperCase();
  const explicit = process.env[`LETBUYY_RUNTIME_D1_${envKey}_DATABASE_ID`];
  if (explicit) return explicit;

  const terraformIds = readTerraformD1DatabaseIds();
  return terraformIds[envName] || "";
}

assert(configPath, "--config is required");
assert(outputPath, "--output is required");
assert(["dev", "staging", "production"].includes(environment), "--environment must be dev, staging, or production");
assert(fs.existsSync(configPath), `Wrangler config not found: ${configPath}`);

const placeholder = `__LETBUYY_RUNTIME_CACHE_${environment.toUpperCase()}_NAMESPACE_ID__`;
let config = fs.readFileSync(configPath, "utf8");

const configDir = path.dirname(configPath);
const outputDir = path.dirname(outputPath);
config = config.replace(/^main\s*=\s*"([^"]+)"/m, (_match, mainPath) => {
  const absoluteMainPath = path.resolve(configDir, mainPath);
  const relativeMainPath = path.relative(outputDir, absoluteMainPath).replaceAll(path.sep, "/");
  return `main = "${relativeMainPath}"`;
});

if (config.includes(placeholder)) {
  const namespaceId = cacheNamespaceIdFor(environment);
  if (!namespaceId) {
    assert(
      !requireRealBindings,
      `Missing KV namespace id for ${environment}. Set LETBUYY_RUNTIME_CACHE_${environment.toUpperCase()}_NAMESPACE_ID or apply infrastructure/cloudflare Terraform first.`,
    );
    console.warn(`[materialize-wrangler] leaving ${placeholder} unresolved for plan-only ${environment} config`);
  } else {
    config = config.replaceAll(placeholder, namespaceId);
  }
}

const d1Placeholder = `__LETBUYY_RUNTIME_D1_${environment.toUpperCase()}_DATABASE_ID__`;
if (config.includes(d1Placeholder)) {
  const databaseId = d1DatabaseIdFor(environment);
  if (!databaseId) {
    assert(
      !requireRealBindings,
      `Missing D1 database id for ${environment}. Set LETBUYY_RUNTIME_D1_${environment.toUpperCase()}_DATABASE_ID or apply infrastructure/cloudflare Terraform first.`,
    );
    console.warn(`[materialize-wrangler] leaving ${d1Placeholder} unresolved for plan-only ${environment} config`);
  } else {
    config = config.replaceAll(d1Placeholder, databaseId);
  }
}

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputPath, config);
console.log(`[materialize-wrangler] wrote ${outputPath} for ${environment}`);
