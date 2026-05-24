import {
  createReporter,
  generatedArtifactPattern,
  getTrackedFiles,
} from "./governance-common.mjs";

const reporter = createReporter("Generated artifact validator");
const trackedFiles = getTrackedFiles();

const offenders = trackedFiles.filter((file) => generatedArtifactPattern.test(file));

reporter.assert(
  offenders.length === 0,
  `Generated artifacts must not be tracked: ${offenders.slice(0, 20).join(", ")}`,
);

reporter.finish(`${trackedFiles.length} tracked files scanned`);
