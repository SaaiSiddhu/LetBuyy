import {
  createReporter,
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
