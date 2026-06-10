import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export const root = process.cwd();

export const sourceExtensions = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".mts",
  ".cts",
  ".dart",
]);

export const textExtensions = new Set([
  ...sourceExtensions,
  ".json",
  ".yaml",
  ".yml",
  ".toml",
  ".tf",
  ".md",
  ".sql",
  ".css",
  ".scss",
  ".sh",
  ".env",
  ".example",
  ".gitignore",
  ".npmrc",
]);

export const ignoredDirectoryNames = new Set([
  ".git",
  ".codex",
  ".analysis",
  ".tmp",
  "node_modules",
  ".next",
  ".turbo",
  ".dart_tool",
  "build",
  "dist",
  "coverage",
  ".cache",
  ".wrangler",
  ".vercel",
  ".symlinks",
  "Pods",
  "temp",
]);

export const canonicalAppRoots = [
  "apps/storefront-runtime",
  "apps/merchant-control-plane",
  "apps/identity-platform",
  "apps/marketing-site",
  "apps/platform-console",
  "apps/mobile/merchant-app",
];

export const frozenAppRoots = [
  "apps/app-marketplace",
  "apps/developer-portal",
  "apps/theme-marketplace",
  "apps/platform-operations-portal",
];

export const reservedMobileRuntimeRoots = [
  "apps/mobile/shopper-app",
  "apps/mobile/operator-app",
];

export const deprecatedAppAliasRoots = [
  "apps/admin",
  "apps/analytics",
  "apps/auth",
  "apps/checkout",
  "apps/internal",
  "apps/merchant",
  "apps/storefront",
];

export const forbiddenRuntimeRoots = [
  ...deprecatedAppAliasRoots,
  "apps/mobile/operator-team-app",
];

export const forbiddenRuntimeSubtrees = [
  "apps/storefront-runtime/consumer-storefront",
];

export const canonicalServiceRoots = [
  "services/api-gateway",
  "services/mobile-bff",
  "services/webhook-service",
  "services/queue-workers",
];

export const reservedServiceRoots = [
  "services/checkout-runtime",
  "services/search-service",
  "services/media-service",
  "services/notification-service",
  "services/event-bus",
  "services/analytics-pipeline",
];

export const canonicalRuntimeRoots = [
  ...canonicalAppRoots,
  ...canonicalServiceRoots,
];

export const domainPackageRoots = [
  "packages/commerce-core",
  "packages/checkout-core",
  "packages/payments",
  "packages/auth-core",
  "packages/identity-core",
  "packages/token-core",
  "packages/session-core",
  "packages/permission-core",
  "packages/organization-core",
  "packages/audit-core",
  "packages/tenant-core",
  "packages/cms-core",
  "packages/theme-engine",
  "packages/event-core",
  "packages/notification-core",
  "packages/billing-core",
  "packages/shared-types",
];

export const infrastructurePackageRoots = [
  "packages/infrastructure",
];

export const rejectedPackageRoots = [
  "packages/app-engine",
  "packages/application-services",
  "packages/distributed-runtime",
  "packages/extension-host",
  "packages/orchestration",
  "packages/projection-runtime",
  "packages/runtime-composition",
];

export const workspacePackageRoots = [
  "packages/typescript/api-client",
  "packages/typescript/api-types",
  "packages/typescript/ui",
  "packages/dart/core",
  "packages/dart/models",
  "packages/dart/ui_kit",
  ...infrastructurePackageRoots,
  ...domainPackageRoots,
];

export const activeRootPrefixes = [
  "apps/",
  "services/",
  "packages/",
  "database/",
  "infrastructure/",
  "scripts/",
];

export const deprecatedTrackedPrefixes = [
  "backend/",
  "apps/web/",
  "apps/flutter/",
];

export const generatedArtifactPattern =
  /(^|\/)(\.next|dist|build|coverage|\.turbo|\.cache|node_modules|\.dart_tool|\.wrangler|\.vercel|Pods|\.symlinks)(\/|$)|(^|\/)tsconfig\.tsbuildinfo$|\.tsbuildinfo$|(^|\/)\.DS_Store$|\.dill$|\.track\.dill$|\.apk$|\.aab$|\.ipa$|\.tar\.zst$/;

export const debugArtifactPattern =
  /(^|\/)(firebase-debug|firestore-debug|ui-debug|storage-debug|pubsub-debug)\.log$|(^|\/)[^/]*debug[^/]*\.log$|\.trace(\.json)?$|^docs\/architecture\/validation(\/|$)/;

export function execGit(args) {
  return execFileSync("git", args, { cwd: root }).toString("utf8");
}

export function getTrackedFiles() {
  return execGit(["ls-files", "-z"])
    .split("\0")
    .filter(Boolean)
    .filter((file) => fs.existsSync(path.join(root, file)))
    .sort();
}

export function getUntrackedFiles() {
  return execGit(["ls-files", "--others", "--exclude-standard", "-z"])
    .split("\0")
    .filter(Boolean)
    .sort();
}

export function startsWithPrefix(file, prefix) {
  return file === prefix || file.startsWith(`${prefix}/`);
}

export function listWorkspaceFiles(startDirs = [
  "apps",
  "packages",
  "services",
  "database",
  "infrastructure",
  "legacy",
  "docs",
  "scripts",
  "config",
]) {
  const files = [];

  function walk(absDir, relDir) {
    if (!fs.existsSync(absDir)) return;

    for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
      if (ignoredDirectoryNames.has(entry.name)) continue;

      const relPath = relDir ? `${relDir}/${entry.name}` : entry.name;
      const absPath = path.join(absDir, entry.name);

      if (entry.isDirectory()) {
        walk(absPath, relPath);
      } else if (entry.isFile()) {
        files.push(normalizePath(relPath));
      }
    }
  }

  for (const dir of startDirs) walk(path.join(root, dir), dir);
  return files.sort();
}

export function listWorkspaceDirectories(startDirs = [
  "apps",
  "packages",
  "services",
  "database",
  "infrastructure",
  "legacy",
  "docs",
  "scripts",
  "config",
]) {
  const directories = [];

  function walk(absDir, relDir) {
    if (!fs.existsSync(absDir)) return;

    for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
      const relPath = relDir ? `${relDir}/${entry.name}` : entry.name;
      const absPath = path.join(absDir, entry.name);

      if (entry.isDirectory()) {
        directories.push(normalizePath(relPath));
        if (!ignoredDirectoryNames.has(entry.name)) walk(absPath, relPath);
      }
    }
  }

  for (const dir of startDirs) walk(path.join(root, dir), dir);
  return directories.sort();
}

export function listLocalArtifactDirectories(startDirs = ["apps", "packages", "services"]) {
  const artifactDirectoryNames = new Set([
    "node_modules",
    ".next",
    ".turbo",
    ".dart_tool",
    "dist",
    "build",
    "coverage",
    ".cache",
    ".wrangler",
    ".vercel",
    ".symlinks",
    "Pods",
  ]);

  return listWorkspaceDirectories(startDirs).filter((dir) =>
    dir.split("/").some((segment) => artifactDirectoryNames.has(segment)),
  );
}

export function exists(relPath) {
  return fs.existsSync(path.join(root, relPath));
}

export function readFile(relPath) {
  try {
    return fs.readFileSync(path.join(root, relPath), "utf8");
  } catch {
    return "";
  }
}

export const activeSupabaseSchemaMigrationPath = "database/supabase/migrations/000_baseline.sql";

export function readActiveSupabaseSchemaMigration() {
  return readFile(activeSupabaseSchemaMigrationPath);
}

export function hasSqlTable(sql, tableName) {
  return new RegExp(`CREATE\\s+TABLE(?:\\s+IF\\s+NOT\\s+EXISTS)?\\s+(?:public\\.)?${tableName}\\b`, "i").test(sql);
}

export function hasSqlRls(sql, tableName) {
  return new RegExp(`ALTER\\s+TABLE(?:\\s+ONLY)?\\s+(?:public\\.)?${tableName}\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY`, "i").test(sql);
}

export function hasSqlFunction(sql, functionName) {
  return new RegExp(`CREATE(?:\\s+OR\\s+REPLACE)?\\s+FUNCTION\\s+(?:public\\.)?${functionName}\\b`, "i").test(sql);
}

export function readJson(relPath) {
  try {
    return JSON.parse(readFile(relPath));
  } catch {
    return null;
  }
}

export function normalizePath(relPath) {
  return path.posix.normalize(relPath).replace(/^\.\//, "");
}

export function dirname(relPath) {
  return path.posix.dirname(relPath);
}

export function rootSegment(relPath) {
  const segments = relPath.split("/");
  if (segments[0] === "apps" && segments[1] === "mobile") return segments.slice(0, 3).join("/");
  if (segments[0] === "apps" || segments[0] === "services") return segments.slice(0, 2).join("/");
  if (segments[0] === "packages" && segments[1] === "typescript") return segments.slice(0, 3).join("/");
  if (segments[0] === "packages" && segments[1] === "dart") return segments.slice(0, 3).join("/");
  if (segments[0] === "packages") return segments.slice(0, 2).join("/");
  return segments[0];
}

export function rootForFile(file) {
  return rootSegment(file);
}

export function packageRootForManifest(file) {
  return path.posix.dirname(file);
}

export function resolveRelativeImport(fromFile, specifier) {
  if (!specifier.startsWith(".")) return null;
  return normalizePath(path.posix.join(dirname(fromFile), specifier));
}

export function resolveAliasImport(fromFile, specifier) {
  if (!specifier.startsWith("@/")) return null;
  const ownerRoot = rootForFile(fromFile);
  if (!ownerRoot.startsWith("apps/") && !ownerRoot.startsWith("services/")) return null;
  return normalizePath(path.posix.join(ownerRoot, "src", specifier.slice(2)));
}

export function trackedTargetForResolvedImport(allTrackedFiles, resolved) {
  const candidates = [
    resolved,
    `${resolved}.ts`,
    `${resolved}.tsx`,
    `${resolved}.js`,
    `${resolved}.jsx`,
    `${resolved}.mjs`,
    `${resolved}.cjs`,
    `${resolved}.dart`,
    `${resolved}/index.ts`,
    `${resolved}/index.tsx`,
    `${resolved}/index.js`,
    `${resolved}/index.jsx`,
    `${resolved}/index.mjs`,
    `${resolved}/mod.ts`,
  ];

  return candidates.find((candidate) => allTrackedFiles.includes(candidate)) ?? resolved;
}

export function extractSpecifiers(text) {
  const specifiers = [];
  const patterns = [
    /^\s*import\s+(?:type\s+)?(?:[^'"]+\s+from\s+)?['"]([^'"]+)['"]/gm,
    /^\s*export\s+(?:type\s+)?[^'"]+\s+from\s+['"]([^'"]+)['"]/gm,
    /\bimport\(\s*['"]([^'"]+)['"]\s*\)/gm,
    /\brequire\(\s*['"]([^'"]+)['"]\s*\)/gm,
  ];

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) specifiers.push(match[1]);
  }

  return [...new Set(specifiers)];
}

export function hasOnlyOwnershipFile(rootPath, trackedFiles) {
  const files = trackedFiles.filter((file) => file.startsWith(`${rootPath}/`));
  return files.length === 1 && files[0] === `${rootPath}/AGENTS.md`;
}

export function pathHasIgnoredSegment(relPath) {
  return relPath.split("/").some((segment) => ignoredDirectoryNames.has(segment));
}

export function createReporter(name) {
  const errors = [];
  const warnings = [];

  return {
    errors,
    warnings,
    assert(condition, message) {
      if (!condition) errors.push(message);
    },
    warn(condition, message) {
      if (!condition) warnings.push(message);
    },
    finish(summary) {
      if (warnings.length) {
        console.warn(`${name} warnings:`);
        for (const warning of warnings) console.warn(`- ${warning}`);
      }

      if (errors.length) {
        console.error(`${name} failed:`);
        for (const error of errors) console.error(`- ${error}`);
        process.exit(1);
      }

      console.log(`${name} passed${summary ? ` (${summary})` : ""}.`);
    },
  };
}
