import {
  createReporter,
  debugArtifactPattern,
  isForbiddenRuntimePath,
  generatedArtifactPattern,
  getTrackedFiles,
  startsWithPrefix,
  formatOffenderList,
} from "./governance-common.mjs";

const reporter = createReporter("Generated artifact validator");
const trackedFiles = getTrackedFiles();

const staleRepairScriptPattern = /(^|\/)fix_markdown\.py$/;
const offenders = trackedFiles.filter(
  (file) =>
    generatedArtifactPattern.test(file) ||
    debugArtifactPattern.test(file) ||
    staleRepairScriptPattern.test(file) ||
    isForbiddenRuntimePath(file),
);

reporter.assert(
  offenders.length === 0,
  `Generated, debug, or forbidden topology artifacts must not be tracked: ${formatOffenderList(offenders, 20)}`,
);

reporter.finish(`${trackedFiles.length} tracked files scanned`);
