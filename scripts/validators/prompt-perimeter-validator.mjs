import path from "node:path";

import {
  createReporter,
  exists,
  getTrackedFiles,
  readFile,
} from "./governance-common.mjs";

const reporter = createReporter("Prompt perimeter validator");

const registryPath = "PROMPTS.md";
const canonicalExecutionPrompt = "CONVERGENCE_CLEANUP_2026_06_10/CODEX_FOUNDATION_STEPUP_MASTER_EXECUTION_PROMPT.md";
const promptDriftArchiveRoot = "docs/archive/prompt-drift-2026-06-10";
const archiveSentinel = "ARCHIVED — REJECTED ARCHITECTURE — DO NOT EXECUTE";

const registry = readFile(registryPath);
const trackedFiles = getTrackedFiles();

const rows = [];
for (const line of registry.split("\n")) {
  const match = line.match(/^\| ([^|]+) \| `([^`]+)` \| ([^|]+) \|/);
  if (!match || match[1] === "ID") continue;
  rows.push({
    id: match[1].trim(),
    path: match[2].trim(),
    className: match[3].trim(),
  });
}

const canonicalPaths = new Set(
  rows.filter((row) => row.className.startsWith("CANONICAL-")).map((row) => row.path),
);

function isPromptDriftEvidence(file) {
  const basename = path.posix.basename(file);
  return basename === "PROMPT_DRIFT_REPORT.md" || basename === "PROMPT_DRIFT_ELIMINATION_PLAN.md";
}

function isPromptClassFile(file) {
  if (!file.endsWith(".md")) return false;
  if (file === registryPath) return false;
  if (isPromptDriftEvidence(file)) return false;

  const basename = path.posix.basename(file, ".md");
  return /(^|[_-])(MISSION|PROMPT|BLUEPRINT)([_-]|$)/.test(basename) || /^TERMINAL[_-]/.test(basename);
}

function archiveHasSentinel(file) {
  if (readFile(file).includes(archiveSentinel)) return true;

  let dir = path.posix.dirname(file);
  while (dir.startsWith("docs/archive")) {
    const readme = `${dir}/README.md`;
    if (exists(readme) && readFile(readme).includes(archiveSentinel)) return true;
    if (dir === "docs/archive") break;
    dir = path.posix.dirname(dir);
  }

  return false;
}

reporter.assert(rows.length > 0, "PROMPTS.md must contain the prompt registry table");
reporter.assert(
  canonicalPaths.has(canonicalExecutionPrompt),
  `PROMPTS.md must register the foundation stepup prompt as canonical: ${canonicalExecutionPrompt}`,
);
reporter.assert(
  exists(promptDriftArchiveRoot) && exists(`${promptDriftArchiveRoot}/README.md`),
  "Prompt drift archive root and quarantine README must exist",
);

const deletedRowsStillPresent = rows
  .filter((row) => row.className.startsWith("DELETED-"))
  .filter((row) => !row.path.includes("*") && exists(row.path));

reporter.assert(
  deletedRowsStillPresent.length === 0,
  `Prompt registry rows marked deleted must not exist in the live tree: ${deletedRowsStillPresent
    .map((row) => `${row.id}:${row.path}`)
    .join(", ")}`,
);

const archivedRowsOutsideArchive = rows
  .filter((row) => row.className === "ARCHIVED-QUARANTINED")
  .filter((row) => !row.path.startsWith("docs/archive/"));

reporter.assert(
  archivedRowsOutsideArchive.length === 0,
  `Archived prompt registry rows must point under docs/archive: ${archivedRowsOutsideArchive
    .map((row) => `${row.id}:${row.path}`)
    .join(", ")}`,
);

const activePromptFiles = trackedFiles
  .filter(isPromptClassFile)
  .filter((file) => !file.startsWith("docs/archive/"));

const unregisteredActivePrompts = activePromptFiles.filter((file) => !canonicalPaths.has(file));

reporter.assert(
  unregisteredActivePrompts.length === 0,
  `Prompt-class files outside docs/archive must be canonical-registered in PROMPTS.md: ${unregisteredActivePrompts.join(
    ", ",
  )}`,
);

const archivedPromptFilesWithoutSentinel = trackedFiles
  .filter(isPromptClassFile)
  .filter((file) => file.startsWith("docs/archive/"))
  .filter((file) => !archiveHasSentinel(file));

reporter.assert(
  archivedPromptFilesWithoutSentinel.length === 0,
  `Archived prompt-class files must carry or inherit the quarantine sentinel: ${archivedPromptFilesWithoutSentinel
    .slice(0, 20)
    .join(", ")}`,
);

reporter.finish("canonical prompt registry, deleted hazards, and archive quarantine checked");
