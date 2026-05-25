import {
  createReporter,
  debugArtifactPattern,
  forbiddenRuntimeRoots,
  forbiddenRuntimeSubtrees,
  generatedArtifactPattern,
  getTrackedFiles,
  startsWithPrefix,
} from "./governance-common.mjs";

const reporter = createReporter("Generated artifact validator");
const trackedFiles = getTrackedFiles();

const forbiddenRuntimePrefixes = [...forbiddenRuntimeRoots, ...forbiddenRuntimeSubtrees];
const offenders = trackedFiles.filter(
  (file) =>
    generatedArtifactPattern.test(file) ||
    debugArtifactPattern.test(file) ||
    forbiddenRuntimePrefixes.some((prefix) => startsWithPrefix(file, prefix)),
);

reporter.assert(
  offenders.length === 0,
  `Generated, debug, or forbidden topology artifacts must not be tracked: ${offenders.slice(0, 20).join(", ")}`,
);

reporter.finish(`${trackedFiles.length} tracked files scanned`);
