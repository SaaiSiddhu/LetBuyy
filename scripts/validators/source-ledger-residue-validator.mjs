import {
  createReporter,
  listWorkspaceFiles,
} from "./governance-common.mjs";

const reporter = createReporter("Source ledger residue validator");

const activeRootCodexFiles = new Set([
  "CODEX_FOUNDATION_HARDENING_LEDGER.md",
  "CODEX_FOUNDATION_HARDENING_MISSION_V2.md",
  "CODEX_FOUNDATION_HARDENING_STATUS.md",
  "CODEX_UI_FOUNDATION_LEDGER.md",
  "CODEX_UI_FOUNDATION_STATUS.md",
]);

const sourceResidue = listWorkspaceFiles(["apps", "services", "packages"])
  .filter((file) => /(^|\/)CODEX[^/]*\.md$/.test(file));

for (const file of sourceResidue) {
  reporter.assert(false, `${file} must be archived outside active runtime/package source trees`);
}

const rootResidue = listWorkspaceFiles(["."])
  .filter((file) => /^CODEX[^/]*\.md$/.test(file))
  .filter((file) => !activeRootCodexFiles.has(file));

for (const file of rootResidue) {
  reporter.assert(false, `${file} must be archived; only active V2 ledger/status/mission files may remain at root`);
}

reporter.finish("CODEX ledger residue checked");
