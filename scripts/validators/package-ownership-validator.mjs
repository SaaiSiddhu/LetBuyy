import path from "node:path";
import {
  createReporter,
  domainPackageRoots,
  exists,
  getTrackedFiles,
  packageRootForManifest,
  readJson,
} from "./governance-common.mjs";

const reporter = createReporter("Package ownership validator");
const trackedFiles = getTrackedFiles();

const packageManifests = trackedFiles.filter((file) => file.endsWith("/package.json") || file === "package.json");
const pubspecManifests = trackedFiles.filter((file) => file.endsWith("/pubspec.yaml") || file === "pubspec.yaml");

for (const file of packageManifests) {
  if (file === "package.json") continue;

  const root = packageRootForManifest(file);
  const json = readJson(file);

  reporter.assert(exists(`${root}/AGENTS.md`), `Package manifest lacks ownership file: ${root}/AGENTS.md`);
  reporter.assert(Boolean(json?.name), `Package manifest lacks name: ${file}`);

  if (root.startsWith("packages/typescript/")) {
    reporter.assert(exists(`${root}/src/index.ts`), `TypeScript package lacks public export boundary: ${root}/src/index.ts`);
    reporter.assert(Boolean(json?.scripts?.typecheck), `TypeScript package lacks typecheck script: ${file}`);
  }

  if (root.startsWith("apps/") || root.startsWith("services/")) {
    reporter.assert(Boolean(json?.private), `Runtime package must be private: ${file}`);
  }
}

for (const file of pubspecManifests) {
  if (file === "pubspec.yaml") continue;

  const root = path.posix.dirname(file);
  reporter.assert(exists(`${root}/AGENTS.md`), `Dart package/app lacks ownership file: ${root}/AGENTS.md`);
  reporter.assert(exists(`${root}/lib`) || root.includes("/test"), `Dart manifest lacks lib directory: ${root}`);
}

for (const root of domainPackageRoots) {
  reporter.assert(exists(`${root}/AGENTS.md`), `Governed package boundary lacks AGENTS.md: ${root}`);
}

reporter.finish(`${packageManifests.length + pubspecManifests.length} manifests scanned`);
