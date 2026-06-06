import {
  createReporter,
  exists,
  getTrackedFiles,
  readFile,
} from "./governance-common.mjs";

const reporter = createReporter("Migration safety validator");

function stripSqlComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/--.*$/gm, "");
}

const forbiddenPatterns = [
  { pattern: /\bDROP\s+TABLE\b/i, message: "DROP TABLE is forbidden in replayable migrations; use additive compatibility or explicit repair runbooks" },
  { pattern: /\bDROP\s+SCHEMA\b/i, message: "DROP SCHEMA is forbidden in replayable migrations" },
  { pattern: /\bALTER\s+TABLE\b[\s\S]*?\bDROP\s+COLUMN\b/i, message: "DROP COLUMN is forbidden in replayable migrations; use expand/contract with compatibility views" },
  { pattern: /\bTRUNCATE\b/i, message: "TRUNCATE is forbidden in replayable migrations" },
  { pattern: /\bALTER\s+TABLE\b[\s\S]*?\bRENAME\s+COLUMN\b/i, message: "RENAME COLUMN is forbidden in replayable migrations; add compatible columns and backfill first" },
  { pattern: /\bALTER\s+TABLE\s+(?!.*\bIF\s+EXISTS\b)[A-Za-z_][A-Za-z0-9_]*\s+RENAME\s+TO\b/i, message: "Physical table renames are forbidden in replayable migrations; use compatibility views and phased cutovers" },
  { pattern: /\bALTER\s+TABLE\s+sites\s+RENAME\s+TO\s+stores\b/i, message: "sites must not be renamed to stores; stores is UI/API language only" },
  { pattern: /\bALTER\s+TABLE\s+stores\s+RENAME\s+TO\s+sites\b/i, message: "physical sites/stores rename cycles are forbidden" },
  { pattern: /\bCREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+stores\b/i, message: "stores table is forbidden; use sites table plus stores view/API terminology" },
];

for (const file of getTrackedFiles().filter((candidate) => candidate.startsWith("database/supabase/migrations/") && candidate.endsWith(".sql"))) {
  const sql = stripSqlComments(readFile(file));
  for (const { pattern, message } of forbiddenPatterns) {
    reporter.assert(!pattern.test(sql), `${file}: ${message}`);
  }
}

reporter.assert(exists("database/supabase/config.toml"), "Canonical Supabase config must live under database/supabase/config.toml");
reporter.assert(exists("database/supabase/migrations/000_baseline.sql"), "Canonical Supabase migration root must include database/supabase/migrations/000_baseline.sql");
reporter.assert(!exists("supabase/config.toml"), "Root supabase/config.toml is retired; archive duplicate configs under docs/archive instead");
reporter.assert(!exists("supabase/migrations"), "Root supabase/migrations is forbidden; migrations live under database/supabase/migrations");

const partitionMigration = readFile("database/supabase/migrations/079_partition_worker_request_logs.sql");
const partitionDriver = readFile("scripts/migration/run-hot-table-partition-maintenance.mjs");
const partitionWorkflow = readFile(".github/workflows/hot-table-partition-maintenance.yml");

for (const fragment of [
  "public.ensure_next_hot_table_partitions",
  "public.detach_expired_hot_table_partitions",
  "configure the external scheduler",
]) {
  reporter.assert(partitionMigration.includes(fragment), `Partition lifecycle migration missing fragment: ${fragment}`);
}

for (const fragment of [
  "ensure_next_hot_table_partitions(${monthsAhead})",
  "detach_expired_hot_table_partitions()",
  "spawnSync(",
  "\"psql\"",
  "PGPASSWORD",
  "SUPABASE_DB_URL",
  "PRODUCTION_DB_CONNECTION_STRING",
]) {
  reporter.assert(partitionDriver.includes(fragment), `Partition maintenance driver missing fragment: ${fragment}`);
}

for (const fragment of [
  "cron: \"15 2 1 * *\"",
  "production-migrations",
  "STAGING_DB_CONNECTION_STRING",
  "PRODUCTION_DB_CONNECTION_STRING",
  "run-hot-table-partition-maintenance.mjs",
  "--months-ahead=3",
]) {
  reporter.assert(partitionWorkflow.includes(fragment), `Partition maintenance workflow missing fragment: ${fragment}`);
}

const orchestration = readFile("infrastructure/deployment/migration-orchestration.yaml");
for (const fragment of [
  "run SQL dry run against staging branch",
  "backup: require-pitr-checkpoint-before-apply",
  "rollbackManifest",
  "event-store integrity check recorded",
  "production readiness gate run recorded",
  "strategy: forward-fix-preferred",
]) {
  reporter.assert(orchestration.includes(fragment), `Migration orchestration must define safety fragment: ${fragment}`);
}

reporter.finish("Supabase migration history checked for destructive replay hazards");
