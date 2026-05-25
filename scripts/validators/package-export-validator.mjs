import path from "node:path";
import {
  createReporter,
  extractSpecifiers,
  getTrackedFiles,
  listWorkspaceFiles,
  packageRootForManifest,
  readFile,
  readJson,
  resolveRelativeImport,
  rootForFile,
  sourceExtensions,
  trackedTargetForResolvedImport,
} from "./governance-common.mjs";

const reporter = createReporter("Package export validator");
const files = [...new Set([...getTrackedFiles(), ...listWorkspaceFiles()])].sort();
const packageNameToManifest = new Map();
const packageRootToManifest = new Map();

for (const file of files.filter((candidate) => candidate.endsWith("/package.json") && candidate !== "package.json")) {
  const manifest = readJson(file);
  if (!manifest?.name) continue;
  const root = packageRootForManifest(file);
  packageNameToManifest.set(manifest.name, { root, manifest, file });
  packageRootToManifest.set(root, { root, manifest, file });
}

function packageSpecifierParts(specifier) {
  if (specifier.startsWith(".") || specifier.startsWith("@/") || specifier.startsWith("node:")) return null;
  const segments = specifier.split("/");
  const packageName = specifier.startsWith("@") ? segments.slice(0, 2).join("/") : segments[0];
  const subpathSegments = specifier.startsWith("@") ? segments.slice(2) : segments.slice(1);
  return { packageName, subpath: subpathSegments.length ? `./${subpathSegments.join("/")}` : "." };
}

function exportedSubpaths(manifest) {
  if (typeof manifest.exports === "string") return new Set(["."]);
  if (manifest.exports && typeof manifest.exports === "object") return new Set(Object.keys(manifest.exports));
  return new Set();
}

for (const { root, manifest, file } of packageRootToManifest.values()) {
  if (!root.startsWith("packages/")) continue;
  if (!files.includes(`${root}/src/index.ts`)) continue;

  const exports = exportedSubpaths(manifest);
  reporter.assert(exports.has("."), `Package must explicitly export its public root API: ${file}`);
  reporter.assert(
    manifest.main === "./src/index.ts" || manifest.exports,
    `Package must route consumers through source public API or exports: ${file}`,
  );
}

for (const file of files.filter((candidate) => sourceExtensions.has(path.extname(candidate)) && path.extname(candidate) !== ".dart")) {
  if (!file.startsWith("apps/") && !file.startsWith("services/") && !file.startsWith("packages/")) continue;

  for (const specifier of extractSpecifiers(readFile(file))) {
    const relative = resolveRelativeImport(file, specifier);
    if (relative) {
      const target = trackedTargetForResolvedImport(files, relative);
      const fromRoot = rootForFile(file);
      const toRoot = rootForFile(target);
      if (fromRoot !== toRoot && fromRoot.startsWith("packages/") && toRoot.startsWith("packages/")) {
        reporter.errors.push(`Packages must import other packages through public exports, not relative paths: ${file} -> ${specifier}`);
      }
      continue;
    }

    const parts = packageSpecifierParts(specifier);
    if (!parts || !packageNameToManifest.has(parts.packageName)) continue;

    const { manifest } = packageNameToManifest.get(parts.packageName);
    const exports = exportedSubpaths(manifest);
    reporter.assert(
      exports.has(parts.subpath),
      `${file} imports non-exported package subpath ${specifier}; add an explicit export or use the package public API`,
    );
    reporter.assert(!parts.subpath.startsWith("./src"), `${file} imports package internals through ${specifier}`);
  }
}

reporter.finish(`${packageRootToManifest.size} manifests and package import subpaths checked`);
