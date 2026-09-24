import fs from "node:fs";
import path from "node:path";
import {
  canonicalAppRoots,
  canonicalServiceRoots,
  createReporter,
  exists,
  aliasContainerCarveOut,
  appGroupContainers,
  deferredAppRoots,
  forbiddenRuntimeRoots,
  forbiddenRuntimeSubtrees,
  frozenAppRoots,
  getTrackedFiles,
  isForbiddenRuntimePath,
  referenceAppRoots,
  referenceRoot,
  reservedMobileRuntimeRoots,
  root,
  startsWithPrefix,
  formatOffenderList,
} from "./governance-common.mjs";

const reporter = createReporter("Runtime validator");
const trackedFiles = getTrackedFiles();

const allowedAppRoots = new Set([...canonicalAppRoots, ...frozenAppRoots, ...reservedMobileRuntimeRoots, ...deferredAppRoots]);
const trackedSet = new Set(trackedFiles);
const appEntries = fs.readdirSync(path.join(root, "apps"), { withFileTypes: true });
const forbiddenRuntimePrefixes = [...forbiddenRuntimeRoots, ...forbiddenRuntimeSubtrees];

for (const forbiddenRoot of forbiddenRuntimePrefixes) {
  const trackedOffenders = trackedFiles.filter((file) => startsWithPrefix(file, forbiddenRoot));
  reporter.assert(!exists(forbiddenRoot), `Forbidden runtime topology path exists: ${forbiddenRoot}`);
  reporter.assert(
    trackedOffenders.length === 0,
    `Forbidden runtime topology path has tracked files: ${forbiddenRoot} (${formatOffenderList(trackedOffenders, 5)})`,
  );
}

// Amendment 3 (2026-09-24): the two carved-out alias containers may exist, but only to hold their
// approved roots. Any tracked file elsewhere under them is forbidden runtime topology.
for (const container of Object.keys(aliasContainerCarveOut)) {
  const trackedOffenders = trackedFiles.filter((file) => startsWithPrefix(file, container) && isForbiddenRuntimePath(file));
  reporter.assert(
    trackedOffenders.length === 0,
    `Carved-out alias container holds files outside its approved roots: ${container} (${formatOffenderList(trackedOffenders, 5)})`,
  );
}

// Every directory under apps/ is a grouping container, and every directory inside a container is one
// of that container's approved application roots or a nested container. This walks the FILESYSTEM on
// purpose: an old flat path kept alive only by ignored files (an .env.local, a keystore, a build
// cache) is exactly the leftover that must surface after a move.
function walkContainer(container) {
  const approved = new Set(appGroupContainers[container]);
  for (const child of fs.readdirSync(path.join(root, container), { withFileTypes: true })) {
    const childPath = `${container}/${child.name}`;
    if (!child.isDirectory()) {
      reporter.assert(!trackedSet.has(childPath), `A grouping container holds a tracked file (a container is never an application root): ${childPath}`);
      continue;
    }
    if (childPath in appGroupContainers) {
      reporter.assert(approved.has(childPath), `Unexpected nested container under ${container}: ${childPath}`);
      walkContainer(childPath);
      continue;
    }
    reporter.assert(approved.has(childPath) && allowedAppRoots.has(childPath), `Unexpected application root under ${container}: ${childPath}`);
  }
}

for (const entry of appEntries) {
  const top = `apps/${entry.name}`;
  if (!entry.isDirectory()) {
    reporter.assert(!trackedSet.has(top), `apps/ holds a tracked file outside every container: ${top}`);
    continue;
  }
  if (!(top in appGroupContainers)) {
    reporter.assert(false, `Unexpected directory under apps/ (not a grouping container): ${top}`);
    continue;
  }
  walkContainer(top);
}

// reference/ (Amendment 3's REFERENCE class): nothing but reference/apps/<approved donor>.
if (exists(referenceRoot)) {
  for (const entry of fs.readdirSync(path.join(root, referenceRoot), { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    reporter.assert(entry.name === "apps", `Unexpected directory under ${referenceRoot}/: ${referenceRoot}/${entry.name}`);
  }
  const referenceApps = path.join(root, referenceRoot, "apps");
  if (fs.existsSync(referenceApps)) {
    for (const entry of fs.readdirSync(referenceApps, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const referencePath = `${referenceRoot}/apps/${entry.name}`;
      reporter.assert(referenceAppRoots.includes(referencePath), `Unexpected reference root: ${referencePath}`);
    }
  }
}
for (const referencePath of referenceAppRoots) {
  reporter.assert(exists(referencePath), `Missing reference root: ${referencePath}`);
}
for (const deferredRoot of deferredAppRoots) {
  reporter.assert(exists(deferredRoot), `Missing deferred application root: ${deferredRoot}`);
}

for (const appRoot of canonicalAppRoots) {
  reporter.assert(exists(appRoot), `Missing app runtime root: ${appRoot}`);
  reporter.assert(exists(`${appRoot}/AGENTS.md`), `Missing app runtime AGENTS.md: ${appRoot}`);
  reporter.assert(exists(`${appRoot}/runtime.manifest.json`), `Missing app runtime manifest: ${appRoot}/runtime.manifest.json`);
}

for (const runtimeRoot of reservedMobileRuntimeRoots) {
  reporter.assert(exists(runtimeRoot), `Missing reserved mobile runtime root: ${runtimeRoot}`);
  reporter.assert(exists(`${runtimeRoot}/AGENTS.md`), `Missing reserved mobile runtime AGENTS.md: ${runtimeRoot}`);
  reporter.assert(exists(`${runtimeRoot}/runtime.manifest.json`), `Missing reserved mobile runtime manifest: ${runtimeRoot}/runtime.manifest.json`);

  const allowedFiles = new Set([
    `${runtimeRoot}/AGENTS.md`,
    `${runtimeRoot}/runtime.manifest.json`,
  ]);
  const sourceFiles = trackedFiles.filter((file) => startsWithPrefix(file, runtimeRoot) && !allowedFiles.has(file));
  reporter.assert(
    sourceFiles.length === 0,
    `Reserved mobile runtime root must remain manifest-and-AGENTS-only: ${runtimeRoot} (${formatOffenderList(sourceFiles, 5)})`,
  );
}

for (const serviceRoot of canonicalServiceRoots) {
  reporter.assert(exists(`${serviceRoot}/AGENTS.md`), `Missing service runtime AGENTS.md: ${serviceRoot}`);
  reporter.assert(exists(`${serviceRoot}/runtime.manifest.json`), `Missing service runtime manifest: ${serviceRoot}/runtime.manifest.json`);

  const hasSource = trackedFiles.some((file) => file.startsWith(`${serviceRoot}/src/`));
  if (hasSource) {
    reporter.assert(exists(`${serviceRoot}/package.json`), `Active service source requires package manifest: ${serviceRoot}/package.json`);
  }
}

reporter.finish(`${canonicalAppRoots.length + canonicalServiceRoots.length} canonical runtime roots checked`);
