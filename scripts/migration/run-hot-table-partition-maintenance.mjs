#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    environment: { type: "string" },
    execute: { type: "boolean", default: false },
    "months-ahead": { type: "string", default: "3" },
  },
});

const environment = values.environment;
const execute = values.execute === true;
const monthsAhead = Number.parseInt(values["months-ahead"], 10);
const environmentDbUrlEnv = {
  staging: "STAGING_DB_CONNECTION_STRING",
  production: "PRODUCTION_DB_CONNECTION_STRING",
};

if (!environment || !["staging", "production"].includes(environment)) {
  throw new Error("--environment is required and must be staging or production");
}

if (!Number.isInteger(monthsAhead) || monthsAhead < 0 || monthsAhead > 24) {
  throw new Error("--months-ahead must be an integer between 0 and 24");
}

const sql = `
WITH ensured AS (
  SELECT public.ensure_next_hot_table_partitions(${monthsAhead}) AS result
),
detached AS (
  SELECT public.detach_expired_hot_table_partitions() AS result
)
SELECT jsonb_build_object(
  'ensured', (SELECT result FROM ensured),
  'detached', (SELECT result FROM detached)
)::text AS maintenance_result;
`.trim();

function envNameFor(targetEnvironment) {
  return environmentDbUrlEnv[targetEnvironment];
}

function databaseUrlFor(targetEnvironment) {
  return process.env.SUPABASE_DB_URL || process.env[envNameFor(targetEnvironment)];
}

function psqlEnv(databaseUrl) {
  const url = new URL(databaseUrl);
  const database = decodeURIComponent(url.pathname.replace(/^\//, "") || "postgres");
  const sslMode = url.searchParams.get("sslmode") || "require";

  return {
    PGHOST: url.hostname,
    PGPORT: url.port || "5432",
    PGDATABASE: database,
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGSSLMODE: sslMode,
    PGCONNECT_TIMEOUT: "15",
  };
}

if (!execute) {
  console.log(`[partition-maintenance] plan environment=${environment} monthsAhead=${monthsAhead}`);
  console.log("[partition-maintenance] planned SQL: SELECT public.ensure_next_hot_table_partitions($1); SELECT public.detach_expired_hot_table_partitions();");
  console.log("[partition-maintenance] pass --execute with SUPABASE_DB_URL or the environment-specific DB connection string to run it.");
  process.exit(0);
}

const databaseUrl = databaseUrlFor(environment);
if (!databaseUrl) {
  throw new Error(`Missing SUPABASE_DB_URL or ${envNameFor(environment)} for partition maintenance`);
}

console.log(`[partition-maintenance] running environment=${environment} monthsAhead=${monthsAhead}`);

const result = spawnSync(
  "psql",
  ["--set", "ON_ERROR_STOP=1", "--no-psqlrc", "--tuples-only", "--no-align", "--command", sql],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      ...psqlEnv(databaseUrl),
    },
  },
);

if (result.status !== 0) {
  throw new Error(`Partition maintenance failed for ${environment}`);
}

console.log(`[partition-maintenance] completed environment=${environment}`);
