import {
  createReporter,
  listWorkspaceFiles,
} from "./governance-common.mjs";

const reporter = createReporter("Source ledger residue validator");

const activeRootCodexFiles = new Set([
  "CODEX_FOUNDATION_HARDENING_LEDGER.md",
  "CODEX_FOUNDATION_HARDENING_MISSION_V2.md",
  "CODEX_FOUNDATION_HARDENING_STATUS.md",
  "CODEX_FOUNDATION_STEPUP_LEDGER.md",
  "CODEX_FOUNDATION_STEPUP_STATUS.md",
  "CODEX_FOUNDATION_STEPUP_V2_MISSION.md",
  "CODEX_FOUNDATION_STEPUP_V2_LEDGER.md",
  "CODEX_FOUNDATION_STEPUP_V2_STATUS.md",
  "CODEX_DOMAIN_SPLIT_LEDGER.md",
  "CODEX_DOMAIN_SPLIT_STATUS.md",
  "CODEX_DOMAIN_FINALIZATION_LEDGER.md",
  "CODEX_DOMAIN_FINALIZATION_STATUS.md",
  "CODEX_APPS_MARKETPLACE_FOUNDATION_MISSION_V2.md",
  "CODEX_APPS_MARKETPLACE_FOUNDATION_V2_LEDGER.md",
  "CODEX_APPS_MARKETPLACE_FOUNDATION_V2_STATUS.md",
  "CODEX_APPS_MARKETPLACE_UIUX_LEDGER.md",
  "CODEX_APPS_MARKETPLACE_UIUX_STATUS.md",
  "CODEX_UI_FOUNDATION_LEDGER.md",
  "CODEX_UI_FOUNDATION_STATUS.md",
  "CODEX_LETBUYY_EXECUTABLE_BUILD_MISSION.md",
  "CODEX_EXECUTABLE_BUILD_LEDGER.md",
  "CODEX_EXECUTABLE_BUILD_STATUS.md",
  "EXECUTABLE_IMPLEMENTATION_REPORT.md",
  "EXECUTABLE_HUMAN_REQUIRED.md",
  "EXECUTABLE_IMPLEMENTATION_AUDIT.md",
  "EXECUTABLE_GAP_ANALYSIS.md",
  "EXECUTABLE_BUILD_PLAN.md",
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
