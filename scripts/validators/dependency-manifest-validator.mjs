import module from "node:module";
import path from "node:path";
import {
  createReporter,
  extractSpecifiers,
  getTrackedFiles,
  listWorkspaceFiles,
  packageRootForManifest,
  readFile,
  readJson,
  rootForFile,
  sourceExtensions,
} from "./governance-common.mjs";

const reporter = createReporter("Dependency manifest validator");
const files = [...new Set([...getTrackedFiles(), ...listWorkspaceFiles()])].sort();
const builtinModules = new Set([
  ...module.builtinModules,
  ...module.builtinModules.map((name) => `node:${name}`),
]);

const packageRoots = new Map();
const packageNames = new Map();

for (const file of files.filter((candidate) => candidate.endsWith("/package.json") && candidate !== "package.json")) {
  const root = packageRootForManifest(file);
  const manifest = readJson(file);
  if (!manifest?.name) continue;
  packageRoots.set(root, manifest);
  packageNames.set(manifest.name, root);
}

function packageNameForSpecifier(specifier) {
  if (
    specifier.startsWith(".") ||
    specifier.startsWith("@/") ||
    specifier.startsWith("node:") ||
    specifier.startsWith("package:") ||
    specifier.startsWith("http:") ||
    specifier.startsWith("https:")
  ) {
    return null;
  }

  if (builtinModules.has(specifier)) return null;
  const segments = specifier.split("/");
  return specifier.startsWith("@") ? segments.slice(0, 2).join("/") : segments[0];
}

function ownerPackageRoot(file) {
  const root = rootForFile(file);
  if (packageRoots.has(root)) return root;
  return null;
}

function declaredDependencyNames(manifest, includeDev) {
  return new Set([
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.peerDependencies ?? {}),
    ...Object.keys(manifest.optionalDependencies ?? {}),
    ...(includeDev ? Object.keys(manifest.devDependencies ?? {}) : []),
  ]);
}

function isDevOnlySource(file) {
  const base = path.posix.basename(file);
  return (
    file.includes("/test/") ||
    file.includes("/tests/") ||
    file.startsWith("tests/") ||
    base.includes(".config.") ||
    base === "eslint.config.mjs" ||
    base === "next.config.ts" ||
    base === "next.config.mjs" ||
    base === "postcss.config.mjs"
  );
}

for (const file of files.filter((candidate) => sourceExtensions.has(path.extname(candidate)) && path.extname(candidate) !== ".dart")) {
  if (!file.startsWith("apps/") && !file.startsWith("services/") && !file.startsWith("packages/")) continue;

  const ownerRoot = ownerPackageRoot(file);
  if (!ownerRoot) continue;

  const manifest = packageRoots.get(ownerRoot);
  const declared = declaredDependencyNames(manifest, isDevOnlySource(file));

  for (const specifier of extractSpecifiers(readFile(file))) {
    const dependencyName = packageNameForSpecifier(specifier);
    if (!dependencyName) continue;

    if (packageNames.has(dependencyName) && packageNames.get(dependencyName) === ownerRoot) continue;

    reporter.assert(
      declared.has(dependencyName),
      `${file} imports ${specifier}, but ${dependencyName} is not declared in ${ownerRoot}/package.json`,
    );
  }
}

reporter.finish(`${packageRoots.size} package manifests and source imports checked`);
