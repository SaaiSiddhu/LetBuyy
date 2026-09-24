import path from "node:path";
import {
  createReporter,
  extractSpecifiers,
  isForbiddenRuntimePath,
  getTrackedFiles,
  packageRootForManifest,
  readFile,
  readJson,
  resolveAliasImport,
  resolveRelativeImport,
  rootForFile,
  sourceExtensions,
  startsWithPrefix,
  trackedTargetForResolvedImport,
} from "./governance-common.mjs";

const reporter = createReporter("Import validator");
const trackedFiles = getTrackedFiles();

const packageNameToRoot = new Map();
for (const file of trackedFiles.filter((candidate) => candidate.endsWith("/package.json") || candidate === "package.json")) {
  const json = readJson(file);
  if (json?.name) packageNameToRoot.set(json.name, packageRootForManifest(file));
}

function resolvePackageSpecifier(specifier) {
  const segments = specifier.split("/");
  const packageName = specifier.startsWith("@") ? segments.slice(0, 2).join("/") : segments[0];
  return packageNameToRoot.get(packageName) ?? null;
}

function resolvedTarget(file, specifier) {
  const relative = resolveRelativeImport(file, specifier);
  if (relative) return trackedTargetForResolvedImport(trackedFiles, relative);

  const alias = resolveAliasImport(file, specifier);
  if (alias) return trackedTargetForResolvedImport(trackedFiles, alias);

  const packageRoot = resolvePackageSpecifier(specifier);
  if (packageRoot) return packageRoot;

  return specifier;
}

const sourceFiles = trackedFiles.filter((file) => sourceExtensions.has(path.extname(file)));

for (const file of sourceFiles) {
  const ownerRoot = rootForFile(file);
  const specifiers = extractSpecifiers(readFile(file));

  for (const specifier of specifiers) {
    const target = resolvedTarget(file, specifier);
    const targetRoot = rootForFile(target);

    if (isForbiddenRuntimePath(target) || specifier.includes("consumer-storefront")) {
      reporter.errors.push(`Imports may not target deprecated runtime topology: ${file} -> ${specifier}`);
    }

    if (file.startsWith("apps/") && target.startsWith("apps/") && targetRoot !== ownerRoot) {
      reporter.errors.push(`Apps may not import apps: ${file} -> ${specifier}`);
    }

    if (file.startsWith("services/") && target.startsWith("apps/")) {
      reporter.errors.push(`Services may not import apps: ${file} -> ${specifier}`);
    }

    if (file.startsWith("packages/") && (target.startsWith("apps/") || target.startsWith("services/"))) {
      reporter.errors.push(`Shared packages may not import runtime code: ${file} -> ${specifier}`);
    }

    if ((file.startsWith("apps/") || file.startsWith("services/") || file.startsWith("packages/")) && target.startsWith("legacy/")) {
      reporter.errors.push(`Active code may not import legacy code: ${file} -> ${specifier}`);
    }

    if ((file.startsWith("apps/") || file.startsWith("services/") || file.startsWith("packages/")) && target.startsWith("infrastructure/")) {
      reporter.errors.push(`Runtime code may not import infrastructure code: ${file} -> ${specifier}`);
    }
  }
}

reporter.finish(`${sourceFiles.length} source files scanned`);
