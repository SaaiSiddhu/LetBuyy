import {
  createReporter,
  listWorkspaceFiles,
  readFile,
} from "./governance-common.mjs";

const reporter = createReporter("Commission bps zero validator");

const activeFiles = listWorkspaceFiles(["apps", "services", "packages", "config", "database"])
  .filter((file) => /\.(ts|tsx|js|jsx|mjs|cjs|sql|json|toml|yaml|yml|dart)$/.test(file))
  .filter((file) => !file.includes("/test/") && !file.includes("__tests__") && !file.includes("integration_test/"))
  .filter((file) => !file.startsWith("database/supabase/rollback/"))
  .filter((file) => !file.startsWith("database/supabase/seeds/"));

const activeOffenders = [];
for (const file of activeFiles) {
  const text = readFile(file);
  if (!/(commission_bps|commissionBps|gmv_percentage|transaction fee|GMV rake)/i.test(text)) continue;
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (
      /\bcommission_bps\b[^;\n]{0,120}\bDEFAULT\s+(?!0\b)[1-9]\d*\b/i.test(line) ||
      /\bcommission_bps\b\s*[:=]\s*(?!0\b)[1-9]\d*\b/i.test(line) ||
      /\bcommissionBps\b\s*[:=]\s*(?!0\b)[1-9]\d*\b/i.test(line) ||
      /\b(?:commission_bps|commissionBps)\b[^\n]{0,80}\?\?\s*(?!0\b)[1-9]\d*\b/i.test(line) ||
      /\bALTER\s+COLUMN\s+commission_bps\s+SET\s+DEFAULT\s+(?!0\b)[1-9]\d*\b/i.test(line) ||
      /gmv_percentage\s*=\s*[1-9]/i.test(line) ||
      /[1-9](?:\.\d+)?%\s+transaction fee/i.test(line) ||
      /\bcommission[_-]?rate\b\s*[:=]\s*(?!0(?:\.0+)?\b)[1-9]\d*(?:\.\d+)?\b/i.test(line) ||
      /\bplatform[_-]?commission\b\s*[:=]\s*(?!0(?:\.0+)?\b)[1-9]\d*(?:\.\d+)?\b/i.test(line)
    ) {
      activeOffenders.push(`${file}:${index + 1}: ${line.trim()}`);
    }
  });
}

reporter.assert(
  activeOffenders.length === 0,
  `Non-zero commission/GMV fee defaults are forbidden:\n${activeOffenders.slice(0, 20).join("\n")}`,
);

const migration162 = readFile("database/supabase/migrations/162_phase_a_commission_zero.sql");
reporter.assert(
  /ALTER\s+TABLE\s+public\.commission_schedules[\s\S]*ALTER\s+COLUMN\s+commission_bps\s+SET\s+DEFAULT\s+0/i.test(migration162),
  "Migration 162 must set commission_schedules.commission_bps default to 0",
);
reporter.assert(
  /ALTER\s+TABLE\s+public\.commission_reconciliation_entries[\s\S]*ALTER\s+COLUMN\s+commission_bps\s+SET\s+DEFAULT\s+0/i.test(migration162),
  "Migration 162 must set commission_reconciliation_entries.commission_bps default to 0",
);

const rollback162 = readFile("database/supabase/rollback/162_phase_a_commission_zero.rollback.sql");
reporter.assert(
  rollback162.includes("ALTER COLUMN commission_bps SET DEFAULT 300"),
  "Migration 162 must have an explicit rollback file",
);

reporter.finish("commission_bps remains zero in active defaults");
