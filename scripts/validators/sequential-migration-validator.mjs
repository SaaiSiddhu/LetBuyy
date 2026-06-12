import { createReporter, getTrackedFiles, getUntrackedFiles } from "./governance-common.mjs";

const reporter = createReporter("Sequential migration validator");

// The baseline history starts at 000 and resumes at 073; migrations 001-072 are absent by design.
// Any gap or duplicate AFTER 073 is a sequencing violation.
const KNOWN_GAP_END = 72;

const MIG_DIR = "database/supabase/migrations/";

const trackedMigFiles = getTrackedFiles().filter(
  (f) => f.startsWith(MIG_DIR) && f.endsWith(".sql"),
);

// Untracked migrations on disk are a gate failure: they exist locally but are not committed,
// so the gate would pass in CI while a real schema divergence exists locally.
const untrackedMigFiles = getUntrackedFiles().filter(
  (f) => f.startsWith(MIG_DIR) && f.endsWith(".sql"),
);

for (const f of untrackedMigFiles) {
  reporter.assert(
    false,
    `Untracked migration file found on disk but not committed: ${f} — run 'git add ${f}' or delete it`,
  );
}

// Build the union for duplicate/gap checking so violations in untracked files are also caught.
const migFiles = [...new Set([...trackedMigFiles, ...untrackedMigFiles])];

const prefixes = [];
for (const f of migFiles) {
  const basename = f.split("/").pop();
  const m = basename.match(/^(\d+)_/);
  if (m) prefixes.push({ num: parseInt(m[1], 10), file: f });
}

// Check for duplicate numeric prefixes.
const byNum = {};
for (const { num, file } of prefixes) {
  if (!byNum[num]) byNum[num] = [];
  byNum[num].push(file);
}
for (const [num, files] of Object.entries(byNum)) {
  reporter.assert(
    files.length === 1,
    `Duplicate migration prefix ${num}: ${files.sort().join(", ")} — renumber the duplicate to the next free sequential slot`,
  );
}

// Check for new gaps after the known baseline exception.
const nums = [...new Set(prefixes.map((p) => p.num))].sort((a, b) => a - b);
const postBaseline = nums.filter((n) => n > KNOWN_GAP_END);
for (let i = 1; i < postBaseline.length; i++) {
  const prev = postBaseline[i - 1];
  const curr = postBaseline[i];
  reporter.assert(
    curr === prev + 1,
    `Migration sequence gap: ${prev} is followed by ${curr} — migrations ${prev + 1}..${curr - 1} are missing`,
  );
}

reporter.finish("Migration sequence checked: no untracked files, no duplicate prefixes, no gaps after baseline");
