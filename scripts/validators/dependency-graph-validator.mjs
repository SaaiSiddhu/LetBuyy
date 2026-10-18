import path from "node:path";
import ts from "typescript";
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

const reporter = createReporter("Dependency graph validator");
const trackedFiles = [...new Set([...getTrackedFiles(), ...listWorkspaceFiles()])].sort();
const governedRoots = new Set([...canonicalRuntimeRoots, ...workspacePackageRoots]);
const packageNameToRoot = new Map();

for (const file of trackedFiles.filter((candidate) => candidate.endsWith("/package.json") || candidate === "package.json")) {
  const json = readJson(file);
  if (json?.name) packageNameToRoot.set(json.name, packageRootForManifest(file));
}

for (const file of trackedFiles.filter((candidate) => candidate.endsWith("/pubspec.yaml") || candidate === "pubspec.yaml")) {
  const text = readFile(file);
  const match = text.match(/^name:\s*([A-Za-z0-9_]+)/m);
  if (match) packageNameToRoot.set(match[1], path.posix.dirname(file));
}

function internalPackageRootFromSpecifier(specifier) {
  if (specifier.startsWith("package:")) {
    const packageName = specifier.slice("package:".length).split("/")[0];
    return packageNameToRoot.get(packageName) ?? null;
  }

  const segments = specifier.split("/");
  const packageName = specifier.startsWith("@") ? segments.slice(0, 2).join("/") : segments[0];
  return packageNameToRoot.get(packageName) ?? null;
}

function resolvedSourceTarget(file, specifier) {
  const relative = resolveRelativeImport(file, specifier);
  if (relative) return trackedTargetForResolvedImport(trackedFiles, relative);

  const alias = resolveAliasImport(file, specifier);
  if (alias) return trackedTargetForResolvedImport(trackedFiles, alias);

  const packageRoot = internalPackageRootFromSpecifier(specifier);
  if (packageRoot) return packageRoot;

  return null;
}

const edges = new Map([...governedRoots].map((root) => [root, new Set()]));

// Root integration fixtures may compose runtimes, but must never become a
// production dependency. Check physical relative targets and configured aliases
// independently of the production edge map (tests/ is deliberately not a runtime).
const compilerOptions = new Map();
const repoRoot = process.cwd();
const isRootTestPath = target => target === 'tests' || target.startsWith('tests/');
function importsRootTests(file, specifier, target) {
  if (target && isRootTestPath(target)) return true;
  if (isRootTestPath(specifier.replace(/^\//, ''))) return true;
  if (path.isAbsolute(specifier) && isRootTestPath(path.relative(repoRoot, specifier).split(path.sep).join('/'))) return true;
  const config = ts.findConfigFile(path.dirname(path.join(repoRoot, file)), ts.sys.fileExists);
  if (!config || path.relative(repoRoot, config).startsWith('..')) return false;
  if (!compilerOptions.has(config)) {
    const parsed = ts.readConfigFile(config, ts.sys.readFile);
    if (parsed.error) throw new Error(`Cannot read alias configuration: ${path.relative(repoRoot, config)}`);
    // Only options are needed; do not enumerate project/dependency trees.
    const options = ts.parseJsonConfigFileContent(parsed.config, {...ts.sys, readDirectory: () => []}, path.dirname(config)).options;
    compilerOptions.set(config, options);
  }
  const options = compilerOptions.get(config);
  const base = options.baseUrl ?? options.pathsBasePath ?? path.dirname(config);
  for (const [pattern, paths] of Object.entries(options.paths ?? {})) {
    const star = pattern.indexOf('*');
    const prefix = star < 0 ? pattern : pattern.slice(0, star), suffix = star < 0 ? '' : pattern.slice(star + 1);
    if (star < 0 ? specifier !== pattern : !specifier.startsWith(prefix) || !specifier.endsWith(suffix)) continue;
    const middle = star < 0 ? '' : specifier.slice(prefix.length, suffix ? -suffix.length : undefined);
    for (const mapped of paths) {
      const resolved = path.relative(repoRoot, path.resolve(base, mapped.replace('*', middle))).split(path.sep).join('/');
      if (isRootTestPath(resolved)) return true;
    }
  }
  return false;
}

function addEdge(fromRoot, toRoot, reason) {
  if (!governedRoots.has(fromRoot) || !governedRoots.has(toRoot) || fromRoot === toRoot) return;
  edges.get(fromRoot)?.add(toRoot);
  validateDirection(fromRoot, toRoot, reason);
}

function validateDirection(fromRoot, toRoot, reason) {
  if (fromRoot.startsWith("apps/") && toRoot.startsWith("apps/")) {
    reporter.errors.push(`Apps may not depend on apps: ${fromRoot} -> ${toRoot} (${reason})`);
  }

  if (fromRoot.startsWith("apps/") && toRoot.startsWith("services/")) {
    reporter.errors.push(`Apps may not import service runtime source: ${fromRoot} -> ${toRoot} (${reason})`);
  }

  if (fromRoot.startsWith("apps/") && toRoot === "packages/infrastructure") {
    reporter.errors.push(`Apps must use runtime composition or service APIs instead of infrastructure adapters: ${fromRoot} -> ${toRoot} (${reason})`);
  }

  if (fromRoot.startsWith("services/") && (toRoot.startsWith("apps/") || toRoot.startsWith("services/"))) {
    reporter.errors.push(`Services must remain runtime-independent: ${fromRoot} -> ${toRoot} (${reason})`);
  }

  if (fromRoot.startsWith("packages/") && (toRoot.startsWith("apps/") || toRoot.startsWith("services/"))) {
    reporter.errors.push(`Packages may not depend on runtime code: ${fromRoot} -> ${toRoot} (${reason})`);
  }

  const allowedPackageEdges = {
    "packages/typescript/api-client": ["packages/shared-types"],
    "packages/typescript/api-types": [
      "packages/auth-core",
      "packages/identity-core",
      "packages/token-core",
      "packages/session-core",
      "packages/permission-core",
      "packages/organization-core",
      "packages/audit-core",
      "packages/billing-core",
      "packages/checkout-core",
      "packages/payments",
      "packages/cms-core",
      "packages/commerce-core",
      "packages/event-core",
      "packages/notification-core",
      "packages/shared-types",
      "packages/tenant-core",
      "packages/theme-engine",
    ],
    "packages/typescript/ui": ["packages/typescript/api-types"],
    "packages/infrastructure": ["packages/payments"],
    "packages/auth-core": ["packages/shared-types"],
    "packages/identity-core": ["packages/auth-core", "packages/shared-types"],
    "packages/token-core": ["packages/auth-core", "packages/identity-core", "packages/shared-types"],
    "packages/session-core": ["packages/auth-core", "packages/identity-core", "packages/shared-types"],
    "packages/permission-core": ["packages/auth-core", "packages/identity-core", "packages/shared-types"],
    "packages/organization-core": ["packages/auth-core", "packages/identity-core", "packages/shared-types", "packages/tenant-core"],
    "packages/audit-core": ["packages/auth-core", "packages/identity-core", "packages/shared-types"],
    "packages/billing-core": ["packages/event-core", "packages/shared-types"],
    "packages/checkout-core": ["packages/commerce-core", "packages/shared-types"],
    "packages/payments": ["packages/shared-types"],
    "packages/cms-core": ["packages/shared-types"],
    "packages/commerce-core": ["packages/shared-types"],
    "packages/event-core": ["packages/shared-types"],
    "packages/notification-core": ["packages/event-core", "packages/shared-types"],
    "packages/shared-types": [],
    "packages/tenant-core": ["packages/shared-types", "packages/theme-engine"],
    "packages/theme-engine": ["packages/shared-types"],
    "packages/dart/core": [],
    "packages/dart/models": ["packages/dart/core"],
    "packages/dart/ui_kit": ["packages/dart/core", "packages/dart/models"],
  };

  if (fromRoot in allowedPackageEdges && !allowedPackageEdges[fromRoot].includes(toRoot)) {
    reporter.errors.push(`Package layer violation: ${fromRoot} -> ${toRoot} (${reason})`);
  }
}

for (const file of trackedFiles.filter((candidate) => sourceExtensions.has(path.extname(candidate)))) {
  const fromRoot = rootForFile(file);
  if (!governedRoots.has(fromRoot)) continue;

  for (const specifier of extractSpecifiers(readFile(file))) {
    const target = resolvedSourceTarget(file, specifier);
    if (importsRootTests(file, specifier, target)) {
      reporter.errors.push(`Runtime/package source may not import root test code: ${file} imports ${specifier}`);
      continue;
    }
    if (!target) continue;

    addEdge(fromRoot, rootForFile(target), `${file} imports ${specifier}`);
  }
}

for (const file of trackedFiles.filter((candidate) => candidate.endsWith("/package.json") && candidate !== "package.json")) {
  const fromRoot = packageRootForManifest(file);
  if (!governedRoots.has(fromRoot)) continue;

  const json = readJson(file) ?? {};
  const dependencyBlocks = [
    json.dependencies,
    json.devDependencies,
    json.peerDependencies,
    json.optionalDependencies,
  ];

  for (const block of dependencyBlocks) {
    for (const dependencyName of Object.keys(block ?? {})) {
      const toRoot = packageNameToRoot.get(dependencyName);
      if (toRoot && isRootTestPath(toRoot)) {
        reporter.errors.push(`Runtime/package manifests may not depend on root test code: ${file} declares ${dependencyName}`);
        continue;
      }
      if (toRoot) addEdge(fromRoot, toRoot, `${file} declares ${dependencyName}`);
    }
  }
}

for (const file of trackedFiles.filter((candidate) => candidate.endsWith("/pubspec.yaml") && candidate !== "pubspec.yaml")) {
  const fromRoot = path.posix.dirname(file);
  if (!governedRoots.has(fromRoot)) continue;

  const text = readFile(file);
  for (const [dependencyName, toRoot] of packageNameToRoot.entries()) {
    if (toRoot === fromRoot) continue;
    const dependencyPattern = new RegExp(`^\\s{2}${dependencyName}:\\s`, "m");
    if (dependencyPattern.test(text)) addEdge(fromRoot, toRoot, `${file} declares ${dependencyName}`);
  }
}

const visited = new Set();
const visiting = new Set();
const stack = [];
const cycles = [];

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

reporter.assert(cycles.length === 0, `Circular internal dependencies detected: ${formatOffenderList(cycles, 10, "; ")}`);

const edgeCount = [...edges.values()].reduce((count, targets) => count + targets.size, 0);
reporter.finish(`${governedRoots.size} governed roots and ${edgeCount} internal dependency edges checked`);
