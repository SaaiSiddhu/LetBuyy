import fs from "node:fs";
import path from "node:path";
import {
  canonicalAppRoots,
  canonicalServiceRoots,
  createReporter,
  exists,
  forbiddenRuntimeRoots,
  forbiddenRuntimeSubtrees,
  frozenAppRoots,
  getTrackedFiles,
  phase2AppRoots,
  reservedMobileRuntimeRoots,
  root,
  startsWithPrefix,
  formatOffenderList,
} from "./governance-common.mjs";

const reporter = createReporter("Runtime validator");
const trackedFiles = getTrackedFiles();

const allowedAppRoots = new Set([...canonicalAppRoots, ...frozenAppRoots, ...reservedMobileRuntimeRoots]);
const allowedPhase2Roots = new Set(phase2AppRoots);
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

for (const entry of appEntries) {
  if (!entry.isDirectory()) continue;
  const appRoot = `apps/${entry.name}`;

  if (entry.name === "mobile") {
    const mobileEntries = fs.readdirSync(path.join(root, "apps/mobile"), { withFileTypes: true });
    for (const mobileEntry of mobileEntries) {
      if (!mobileEntry.isDirectory()) continue;
      const mobileRoot = `apps/mobile/${mobileEntry.name}`;
      reporter.assert(allowedAppRoots.has(mobileRoot), `Unexpected mobile app runtime root: ${mobileRoot}`);
    }
    continue;
  }

  if (entry.name === "phase_2") {
    const phase2Entries = fs.readdirSync(path.join(root, "apps/phase_2"), { withFileTypes: true });
    for (const phase2Entry of phase2Entries) {
      if (!phase2Entry.isDirectory()) continue;
      const phase2Root = `apps/phase_2/${phase2Entry.name}`;
      reporter.assert(allowedPhase2Roots.has(phase2Root), `Unexpected phase_2 app runtime root: ${phase2Root}`);
    }
    continue;
  }

  reporter.assert(allowedAppRoots.has(appRoot), `Unexpected app runtime root: ${appRoot}`);
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
