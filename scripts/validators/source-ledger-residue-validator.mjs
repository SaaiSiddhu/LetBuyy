import {
  createReporter,
  listWorkspaceFiles,
} from "./governance-common.mjs";

const reporter = createReporter("Source ledger residue validator");

const sourceResidue = listWorkspaceFiles(["apps", "services", "packages"])
  .filter((file) => /(^|\/)CODEX[^/]*\.md$/.test(file));

for (const file of sourceResidue) {
  reporter.assert(false, `${file} must be archived outside active runtime/package source trees`);
}

const rootResidue = listWorkspaceFiles(["."])
  .filter((file) => /^CODEX[^/]*\.md$/.test(file));

for (const file of rootResidue) {
  reporter.assert(false, `${file} must be archived; root CODEX ledgers/status/mission files are no longer live authority`);
}

reporter.finish("CODEX ledger residue checked");
