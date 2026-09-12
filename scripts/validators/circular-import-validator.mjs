import path from "node:path";
import {
  canonicalRuntimeRoots,
  createReporter,
  extractSpecifiers,
  getTrackedFiles,
  listWorkspaceFiles,
  packageRootForManifest,
  readFile,
  readJson,
  resolveAliasImport,
  resolveRelativeImport,
  rootForFile,
  sourceExtensions,
  trackedTargetForResolvedImport,
  workspacePackageRoots,
  formatOffenderList,
} from "./governance-common.mjs";

const reporter = createReporter("Circular import validator");
const files = [...new Set([...getTrackedFiles(), ...listWorkspaceFiles()])].sort();
const governedRoots = new Set([...canonicalRuntimeRoots, ...workspacePackageRoots]);
const packageNameToRoot = new Map();

for (const file of files.filter((candidate) => candidate.endsWith("/package.json") || candidate.endsWith("/pubspec.yaml"))) {
  if (file.endsWith("/package.json")) {
    const manifest = readJson(file);
    if (manifest?.name) packageNameToRoot.set(manifest.name, packageRootForManifest(file));
    continue;
  }

  const match = readFile(file).match(/^name:\s*([A-Za-z0-9_]+)/m);
  if (match) packageNameToRoot.set(match[1], path.posix.dirname(file));
}

function internalRootFromSpecifier(file, specifier) {
  const relative = resolveRelativeImport(file, specifier);
  if (relative) {
    const target = trackedTargetForResolvedImport(files, relative);
    return target ? rootForFile(target) : null;
  }

  const alias = resolveAliasImport(file, specifier);
  if (alias) {
    const target = trackedTargetForResolvedImport(files, alias);
    return target ? rootForFile(target) : null;
  }

  if (specifier.startsWith("package:")) {
    const packageName = specifier.slice("package:".length).split("/")[0];
    return packageNameToRoot.get(packageName) ?? null;
  }

  const segments = specifier.split("/");
  const packageName = specifier.startsWith("@") ? segments.slice(0, 2).join("/") : segments[0];
  return packageNameToRoot.get(packageName) ?? null;
}

const edges = new Map([...governedRoots].map((root) => [root, new Set()]));

function addEdge(fromRoot, toRoot) {
  if (!governedRoots.has(fromRoot) || !governedRoots.has(toRoot) || fromRoot === toRoot) return;
  edges.get(fromRoot)?.add(toRoot);
}

for (const file of files.filter((candidate) => sourceExtensions.has(path.extname(candidate)))) {
  const fromRoot = rootForFile(file);
  if (!governedRoots.has(fromRoot)) continue;

  for (const specifier of extractSpecifiers(readFile(file))) {
    const toRoot = internalRootFromSpecifier(file, specifier);
    if (toRoot) addEdge(fromRoot, toRoot);
  }
}

for (const file of files.filter((candidate) => candidate.endsWith("/package.json") && candidate !== "package.json")) {
  const fromRoot = packageRootForManifest(file);
  if (!governedRoots.has(fromRoot)) continue;

  const manifest = readJson(file) ?? {};
  for (const block of [manifest.dependencies, manifest.peerDependencies, manifest.optionalDependencies]) {
    for (const dependencyName of Object.keys(block ?? {})) {
      const toRoot = packageNameToRoot.get(dependencyName);
      if (toRoot) addEdge(fromRoot, toRoot);
    }
  }
}

const cycles = [];
const visited = new Set();
const visiting = new Set();
const stack = [];

function visit(root) {
  if (visiting.has(root)) {
    const start = stack.indexOf(root);
    cycles.push([...stack.slice(start), root].join(" -> "));
    return;
  }

  if (visited.has(root)) return;

  visiting.add(root);
  stack.push(root);
  for (const next of [...(edges.get(root) ?? [])].sort()) visit(next);
  stack.pop();
  visiting.delete(root);
  visited.add(root);
}

for (const root of [...governedRoots].sort()) visit(root);

reporter.assert(cycles.length === 0, `Circular runtime/package imports detected: ${formatOffenderList(cycles, 10, "; ")}`);
reporter.finish(`${governedRoots.size} governed roots checked for circular imports`);
