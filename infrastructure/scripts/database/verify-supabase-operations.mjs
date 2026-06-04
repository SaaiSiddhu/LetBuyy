#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";

const args = new Set(process.argv.slice(2));
const execute = args.has("--execute");
const environment = valueFor("--environment") || "production";
const verificationSqlFiles = [
  "database/supabase/verification/063_absolute_production_operationalization.sql",
  "database/supabase/verification/064_live_production_certification.sql",
];

function valueFor(prefix) {
  const arg = process.argv.slice(2).find((candidate) => candidate.startsWith(`${prefix}=`));
  return arg ? arg.slice(prefix.length + 1) : null;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function requireFile(path) {
  assert(fs.existsSync(path), `missing Supabase operational file: ${path}`);
}

assert(["staging", "production"].includes(environment), "--environment must be staging or production");

for (const file of [
  "database/supabase/migrations/062_production_rollout_operations.sql",
  "database/supabase/migrations/063_absolute_production_operationalization.sql",
  "database/supabase/migrations/064_live_production_certification.sql",
  ...verificationSqlFiles,
  "infrastructure/deployment/migration-orchestration.yaml",
]) {
  requireFile(file);
}

const topology = JSON.parse(read("config/runtime/production-topology.json"));
assert(
  topology.eventStoreProvider.migrations.includes("database/supabase/migrations/063_absolute_production_operationalization.sql"),
  "production topology must include migration 063",
);
assert(
  topology.eventStoreProvider.migrations.includes("database/supabase/migrations/064_live_production_certification.sql"),
  "production topology must include migration 064",
);

const migration = read("database/supabase/migrations/063_absolute_production_operationalization.sql");
for (const fragment of [
  "CREATE TABLE IF NOT EXISTS production_readiness_gate_runs",
  "CREATE TABLE IF NOT EXISTS event_store_integrity_checks",
  "CREATE OR REPLACE FUNCTION validate_event_stream_consistency",
  "CREATE OR REPLACE FUNCTION archive_distributed_events",
  "ALTER TABLE regional_routing_overrides ENABLE ROW LEVEL SECURITY",
]) {
  assert(migration.includes(fragment), `migration 063 missing ${fragment}`);
}

const verification = read("database/supabase/verification/063_absolute_production_operationalization.sql");
for (const fragment of [
  "validate_event_stream_consistency",
  "pg_policies",
  "production_readiness_gate_runs",
  "regional_routing_overrides",
]) {
  assert(verification.includes(fragment), `Supabase verification SQL missing ${fragment}`);
}

const certificationMigration = read("database/supabase/migrations/064_live_production_certification.sql");
for (const fragment of [
  "CREATE TABLE IF NOT EXISTS operational_certification_reports",
  "ALTER TABLE operational_certification_reports ENABLE ROW LEVEL SECURITY",
  "CREATE OR REPLACE FUNCTION record_operational_certification_report",
]) {
  assert(certificationMigration.includes(fragment), `migration 064 missing ${fragment}`);
}

const certificationVerification = read("database/supabase/verification/064_live_production_certification.sql");
for (const fragment of [
  "operational_certification_reports",
  "record_operational_certification_report",
  "pg_policies",
]) {
  assert(certificationVerification.includes(fragment), `Supabase certification verification SQL missing ${fragment}`);
}

if (execute) {
  const databaseUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
  assert(databaseUrl, "Missing SUPABASE_DB_URL or DATABASE_URL for --execute");
  for (const verificationSql of verificationSqlFiles) {
    const result = spawnSync("psql", [databaseUrl, "-v", "ON_ERROR_STOP=1", "-f", verificationSql], {
      stdio: "inherit",
      env: { ...process.env, PGAPPNAME: "letbuyy-phase4-ultimate-verifier" },
    });
    assert(result.status === 0, `psql verification failed for ${verificationSql} with status ${result.status}`);
  }
}

console.log(`[supabase-operations] ${environment} operational verification passed`);
