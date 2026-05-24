import fs from "node:fs";
import path from "node:path";
import {
  canonicalAppRoots,
  canonicalServiceRoots,
  createReporter,
  exists,
  forbiddenRuntimeRoots,
  forbiddenRuntimeSubtrees,
  getTrackedFiles,
  root,
  startsWithPrefix,
} from "./governance-common.mjs";

const reporter = createReporter("Runtime validator");
const trackedFiles = getTrackedFiles();

const allowedAppRoots = new Set(canonicalAppRoots);
const appEntries = fs.readdirSync(path.join(root, "apps"), { withFileTypes: true });
const forbiddenRuntimePrefixes = [...forbiddenRuntimeRoots, ...forbiddenRuntimeSubtrees];

for (const forbiddenRoot of forbiddenRuntimePrefixes) {
  const trackedOffenders = trackedFiles.filter((file) => startsWithPrefix(file, forbiddenRoot));
  reporter.assert(!exists(forbiddenRoot), `Forbidden runtime topology path exists: ${forbiddenRoot}`);
  reporter.assert(
    trackedOffenders.length === 0,
    `Forbidden runtime topology path has tracked files: ${forbiddenRoot} (${trackedOffenders.slice(0, 5).join(", ")})`,
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

  reporter.assert(allowedAppRoots.has(appRoot), `Unexpected app runtime root: ${appRoot}`);
}

for (const appRoot of canonicalAppRoots) {
  reporter.assert(exists(appRoot), `Missing app runtime root: ${appRoot}`);
  reporter.assert(exists(`${appRoot}/AGENTS.md`), `Missing app runtime AGENTS.md: ${appRoot}`);
}

for (const serviceRoot of canonicalServiceRoots) {
  reporter.assert(exists(`${serviceRoot}/AGENTS.md`), `Missing service runtime AGENTS.md: ${serviceRoot}`);

  const hasSource = trackedFiles.some((file) => file.startsWith(`${serviceRoot}/src/`));
  if (hasSource) {
    reporter.assert(exists(`${serviceRoot}/package.json`), `Active service source requires package manifest: ${serviceRoot}/package.json`);
  }
}

reporter.finish(`${canonicalAppRoots.length + canonicalServiceRoots.length} canonical runtime roots checked`);
