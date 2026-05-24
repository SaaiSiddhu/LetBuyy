import {
  createReporter,
  generatedArtifactPattern,
  getUntrackedFiles,
} from "./governance-common.mjs";

const reporter = createReporter("Stale artifact validator");
const untrackedFiles = getUntrackedFiles();

const localScanArtifactPattern = /^(deep-tree|domain-map|env-map|garbage-map|heavy-files|import-map|package-map|root-governance|runtime-map|topology|tsconfig-map)\.txt$/;
const offenders = untrackedFiles.filter((file) => generatedArtifactPattern.test(file) || localScanArtifactPattern.test(file));

reporter.assert(
  offenders.length === 0,
  `Untracked generated governance artifacts must be removed or promoted intentionally: ${offenders.slice(0, 20).join(", ")}`,
);

reporter.finish(`${untrackedFiles.length} untracked non-ignored files scanned`);
