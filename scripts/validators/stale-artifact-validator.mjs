import {
  createReporter,
  debugArtifactPattern,
  forbiddenRuntimeRoots,
  forbiddenRuntimeSubtrees,
  generatedArtifactPattern,
  listWorkspaceFiles,
  getUntrackedFiles,
  startsWithPrefix,
} from "./governance-common.mjs";

const reporter = createReporter("Stale artifact validator");
const untrackedFiles = getUntrackedFiles();
const workspaceFiles = listWorkspaceFiles();

const localScanArtifactPattern =
  /^(deep-tree|domain-map|env-map|garbage-map|heavy-files|import-map|package-map|root-governance|runtime-map|topology|tsconfig-map)\.txt$|^(debug|tmp|temp|scratch|analysis)[-.].*\.(txt|log|json|md|mjs|js|ts)$/;
const forbiddenRuntimePrefixes = [...forbiddenRuntimeRoots, ...forbiddenRuntimeSubtrees];
const offenders = [
  ...untrackedFiles.filter((file) => generatedArtifactPattern.test(file) || localScanArtifactPattern.test(file)),
  ...workspaceFiles.filter(
    (file) =>
      debugArtifactPattern.test(file) ||
      forbiddenRuntimePrefixes.some((prefix) => startsWithPrefix(file, prefix)),
  ),
];

reporter.assert(
  offenders.length === 0,
  `Untracked/generated/debug/forbidden topology artifacts must be removed or promoted intentionally: ${[...new Set(offenders)].slice(0, 20).join(", ")}`,
);

reporter.finish(`${untrackedFiles.length} untracked non-ignored files and ${workspaceFiles.length} workspace files scanned`);
