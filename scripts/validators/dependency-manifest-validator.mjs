import module from "node:module";
import fs from "node:fs";
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
  root,
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
    file.includes("/__tests__/") ||
    file.includes("/test/") ||
    file.includes("/tests/") ||
    file.startsWith("tests/") ||
    /\.(?:test|spec)\.(?:[cm]?[jt]s|[jt]sx)$/.test(base) ||
    (file.includes("/.storybook/") && /^(?:main|preview|manager)\.(?:[cm]?[jt]s|[jt]sx)$/.test(base)) ||
    base.includes(".config.") ||
    base === "eslint.config.mjs" ||
    base === "next.config.ts" ||
    base === "next.config.mjs" ||
    base === "postcss.config.mjs"
  );
}

// Node package imports are declarations, not undeclared npm package names.
// Validate every conditional target: no blanket # escape, missing local file,
// undeclared external dependency, cross-package traversal or alias cycle.
function packageImportTargets(manifest, specifier, seen = new Set()) {
  if (seen.has(specifier)) return [null];
  const next = new Set(seen).add(specifier);
  const entry = manifest.imports?.[specifier];
  function collect(value) {
    if (typeof value === "string") return value.startsWith("#") ? packageImportTargets(manifest, value, next) : [value];
    if (value && typeof value === "object" && !Array.isArray(value)) return Object.values(value).flatMap(collect);
    return value === null ? [] : [null];
  }
  return collect(entry);
}
function validatePackageImport(file, specifier, ownerRoot, manifest, declared) {
  const targets = packageImportTargets(manifest, specifier);
  reporter.assert(targets.length > 0 && targets.every(target => typeof target === "string"), `${file} imports ${specifier}, but no resolvable exact package imports declaration exists`);
  for (const target of targets.filter(target => typeof target === "string")) {
    if (target.startsWith("./")) {
      const owner = fs.realpathSync(path.resolve(root, ownerRoot));
      let resolved;
      try { resolved = fs.realpathSync(path.resolve(owner, target)); } catch { resolved = null; }
      reporter.assert(Boolean(resolved && resolved.startsWith(owner + path.sep) && fs.statSync(resolved).isFile()),
        `${file} package import ${specifier} has missing or out-of-package local target ${target}`);
    } else {
      const dependency = packageNameForSpecifier(target);
      reporter.assert(builtinModules.has(target) || Boolean(dependency && declared.has(dependency)),
        `${file} package import ${specifier} targets undeclared dependency ${target}`);
    }
  }
}

for (const file of files.filter((candidate) => sourceExtensions.has(path.extname(candidate)) && path.extname(candidate) !== ".dart")) {
  if (!file.startsWith("apps/") && !file.startsWith("services/") && !file.startsWith("packages/")) continue;

  const ownerRoot = ownerPackageRoot(file);
  if (!ownerRoot) continue;

  const manifest = packageRoots.get(ownerRoot);
  const declared = declaredDependencyNames(manifest, isDevOnlySource(file));

  for (const specifier of extractSpecifiers(readFile(file))) {
    if (specifier.startsWith("#")) { validatePackageImport(file, specifier, ownerRoot, manifest, declared); continue; }
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
