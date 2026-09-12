import {
  createReporter,
  debugArtifactPattern,
  forbiddenRuntimeRoots,
  forbiddenRuntimeSubtrees,
  generatedArtifactPattern,
  getTrackedFiles,
  startsWithPrefix,
  formatOffenderList,
} from "./governance-common.mjs";

const reporter = createReporter("Generated artifact validator");
const trackedFiles = getTrackedFiles();

const forbiddenRuntimePrefixes = [...forbiddenRuntimeRoots, ...forbiddenRuntimeSubtrees];
const staleRepairScriptPattern = /(^|\/)fix_markdown\.py$/;
const offenders = trackedFiles.filter(
  (file) =>
    generatedArtifactPattern.test(file) ||
    debugArtifactPattern.test(file) ||
    staleRepairScriptPattern.test(file) ||
    forbiddenRuntimePrefixes.some((prefix) => startsWithPrefix(file, prefix)),
);

reporter.assert(
  offenders.length === 0,
  `Generated, debug, or forbidden topology artifacts must not be tracked: ${formatOffenderList(offenders, 20)}`,
);

reporter.finish(`${trackedFiles.length} tracked files scanned`);
