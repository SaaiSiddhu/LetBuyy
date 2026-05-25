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
  { pattern: /\bTRUNCATE\b/i, message: "TRUNCATE is forbidden in replayable migrations" },
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

reporter.finish("Supabase migration history checked for destructive replay hazards");
