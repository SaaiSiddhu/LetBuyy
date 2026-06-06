import path from "node:path";
import {
  createReporter,
  domainPackageRoots,
  exists,
  getTrackedFiles,
  packageRootForManifest,
  readFile,
  readJson,
} from "./governance-common.mjs";

const reporter = createReporter("Package ownership validator");
const trackedFiles = getTrackedFiles();

const activeTrackedFiles = trackedFiles.filter((file) => !file.startsWith("docs/archive/"));
const packageManifests = activeTrackedFiles.filter((file) => file.endsWith("/package.json") || file === "package.json");
const pubspecManifests = activeTrackedFiles.filter((file) => file.endsWith("/pubspec.yaml") || file === "pubspec.yaml");
const packageOwnershipRoots = new Set(domainPackageRoots);

function assertPackageOwnershipContract(root) {
  const agentsPath = `${root}/AGENTS.md`;
  const content = readFile(agentsPath);

  reporter.assert(content.includes("Purpose:"), `Package ownership file must define Purpose: ${agentsPath}`);
  reporter.assert(
    content.includes("Ownership Rules") || content.includes("Rules:"),
    `Package ownership file must define ownership rules: ${agentsPath}`,
  );
  reporter.assert(
    content.includes("Forbidden Imports") || content.includes("No imports from"),
    `Package ownership file must define forbidden imports: ${agentsPath}`,
  );
  reporter.assert(content.includes("Runtime Authority"), `Package ownership file must define runtime authority: ${agentsPath}`);
  reporter.assert(content.includes("Migration Notes"), `Package ownership file must define migration notes: ${agentsPath}`);
}

for (const file of packageManifests) {
  if (file === "package.json") continue;

  const root = packageRootForManifest(file);
  if (root.startsWith("packages/")) packageOwnershipRoots.add(root);
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
  if (root.startsWith("packages/")) packageOwnershipRoots.add(root);
  reporter.assert(exists(`${root}/AGENTS.md`), `Dart package/app lacks ownership file: ${root}/AGENTS.md`);
  reporter.assert(exists(`${root}/lib`) || root.includes("/test"), `Dart manifest lacks lib directory: ${root}`);
}

for (const root of domainPackageRoots) {
  reporter.assert(exists(`${root}/AGENTS.md`), `Governed package boundary lacks AGENTS.md: ${root}`);
}

for (const root of packageOwnershipRoots) {
  reporter.assert(exists(`${root}/AGENTS.md`), `Package boundary lacks AGENTS.md: ${root}`);
  if (exists(`${root}/AGENTS.md`)) assertPackageOwnershipContract(root);
}

reporter.finish(`${packageManifests.length + pubspecManifests.length} manifests scanned`);
