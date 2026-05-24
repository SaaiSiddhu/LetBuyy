import fs from "node:fs";
import path from "node:path";
import {
  aliasAppRoots,
  canonicalAppRoots,
  canonicalServiceRoots,
  createReporter,
  exists,
  getTrackedFiles,
  hasOnlyOwnershipFile,
  root,
} from "./governance-common.mjs";

const reporter = createReporter("Runtime validator");
const trackedFiles = getTrackedFiles();

const allowedAppRoots = new Set([...canonicalAppRoots, ...aliasAppRoots]);
const appEntries = fs.readdirSync(path.join(root, "apps"), { withFileTypes: true });

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

  if (aliasAppRoots.includes(appRoot)) {
    reporter.assert(hasOnlyOwnershipFile(appRoot, trackedFiles), `Alias app root must contain only AGENTS.md: ${appRoot}`);
  }
}

for (const appRoot of canonicalAppRoots.filter((candidate) => !candidate.includes("/shopper-app"))) {
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
