import {
  collectStaleArtifactOffenders,
  createReporter,
  formatOffenderList,
} from "./governance-common.mjs";

const reporter = createReporter("Stale artifact validator");
// Run alone, this flags every generated directory on disk. The gate lane deletes them immediately
// before this validator (scripts/validate-governance.mjs), and this check is that cleanup's
// post-condition. tests/governance/ambient-red-attribution.test.mjs classifies an individual run's
// red by that method (F-STALEMETHOD-1).
const found = collectStaleArtifactOffenders();
const offenders = [...found.untrackedFiles, ...found.artifactDirectories, ...found.workspaceFiles];

reporter.assert(
  offenders.length === 0,
  `Untracked/generated/debug/forbidden topology artifacts must be removed or promoted intentionally: ${formatOffenderList(offenders)}`,
);

reporter.finish(`${found.untrackedScanned} untracked non-ignored files and ${found.workspaceScanned} workspace files scanned`);
