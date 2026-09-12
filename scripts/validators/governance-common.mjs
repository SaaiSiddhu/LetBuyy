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

// Updated 2026-09-02 (Phase M, Stage 6): the former apps/storefront-runtime,
// apps/merchant-control-plane, apps/mobile/merchant-app, and
// apps/platform-console are now apps/customer_web, apps/merchant_web,
// apps/merchant_app, and apps/admin_web respectively (renamed on disk,
// Stage 3). apps/customer_app and apps/admin_app were new additions
// established the same stage (no prior ACTIVE/SUPPORTING classification to
// rename from). See CLAUDE.md's "Six-App Target Topology" section and
// docs/migration/repository_consolidation/10_merge_execution_journal.md.
//
// Updated 2026-09-05 (phase FB-1): apps/admin_app moved from here to
// reservedMobileRuntimeRoots. Its implementation was 100% Firestore-backed and
// had never shipped a signed release; the owner's decision of 2026-09-05 retires
// Firebase completely, so the source was deleted and the root reduced to the
// manifest-only reserved shape. The NAME is deliberately kept -- the Constitution
// admits it as one of six product-facing roots -- but it is now a reserved root,
// which means no-reserved-service-activation-validator fails the gate on any
// source file added under it until a named trigger and human approval reactivate
// it. apps/admin_web is the active admin surface (D-4).
export const canonicalAppRoots = [
  "apps/customer_web",
  "apps/merchant_web",
  "apps/identity-platform",
  "apps/marketing-site",
  "apps/admin_web",
  "apps/merchant_app",
  "apps/customer_app",
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
  // Reserved by phase FB-1 (2026-09-05), not a placeholder that never held source:
  // the Firestore implementation was deleted and this root reduced to
  // AGENTS.md + runtime.manifest.json. See apps/admin_app/AGENTS.md.
  "apps/admin_app",
];

// apps/phase_2/* (Constitution amendment, 2026-09-02, Gap 4): product capabilities
// outside the six-app core. Not ACTIVE, not RESERVED (holds real source), not
// FROZEN. See CLAUDE.md's "Six-App Target Topology" section.
export const phase2AppRoots = [
  "apps/phase_2/rider_app",
  "apps/phase_2/store_ops_app",
];

// services/compatibility/* (Stage 5, Phase M, 2026-09-02): bounded,
// non-deployed compatibility bridges — verbatim copies of System A's Firebase
// Cloud Functions and System B's Cloudflare Workers, kept structurally under
// services/ pending a D-0 decision. Explicitly NOT wired into any canonical
// ACTIVE runtime (see each bridge's own README.md/AGENTS.md). Their direct
// provider SDK imports, non-canonical domain literals, and other
// convention deviations are inherited from their source systems verbatim and
// are intentionally not normalized to this repository's own conventions —
// doing so would defeat the point of an inert, D-0-pending bridge and risks
// introducing bugs in code this repository does not own. Validators that
// enforce live-runtime conventions should skip this prefix; validators that
// enforce genuine safety invariants (money/ledger/tenancy) must NOT skip it.
export const compatibilityBridgeRoots = [
  "services/compatibility",
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
  "apps/customer_web/consumer-storefront",
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

// TOOLING class (Constitution amendment, 2026-09-02, Gap 3 / Option B): the Central
// Intelligence System's own implementation — dev-time tooling, non-deployed,
// non-commerce. Named here so it is never misclassified as governed commerce
// infrastructure by a rule that assumes "everything under services/ or packages/ is
// backend." Not wired into any enforcement path in this change; classification only.
export const toolingRoots = [
  "services/lcis-api",
  "tools/graph-server",
  "tools/central-intelligence",
  "packages/lcis-adapters",
  "packages/lcis-business",
  "packages/lcis-cli",
  "packages/lcis-core",
  "packages/lcis-decision",
  "packages/lcis-engineering",
  "packages/lcis-execution",
  "packages/lcis-governance",
  "packages/lcis-live",
  "packages/lcis-mcp",
  "packages/lcis-operations",
  "packages/lcis-orchestration",
  "packages/lcis-performance",
  "packages/lcis-pr-check",
  "packages/lcis-quality",
  "packages/lcis-rootcause",
  "packages/lcis-security",
  "packages/lcis-tracking",
  "packages/lcis-twin",
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

// F-STALECOUNT-1. Every offender message in this tree rendered `list.slice(0, N).join(", ")`, so a
// reader saw N entries and had no way to know whether N was the count or the cap. That is the failure
// this programme names "a count is not a set", and it sat inside the lane that exists to enforce it —
// gate.sh:104 asks a reader to confirm stale-artifact's offenders are "100% generated dirs", which the
// truncated log cannot answer. Always say how many were withheld.
export function formatOffenderList(offenders, limit = 20, separator = ", ") {
  const unique = [...new Set(offenders)];
  const shown = unique.slice(0, limit);
  if (unique.length <= limit) return shown.join(separator);
  return `${shown.join(separator)} (showing ${shown.length} of ${unique.length}; ${unique.length - shown.length} more not listed)`;
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

function stripSourceComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*/g, "");
}

export function extractSpecifiers(text) {
  const clean = stripSourceComments(text);
  const specifiers = [];

  // 1. Static imports and exports (must start line, allowing multiline clauses)
  const staticPattern = /^\s*(?:import|export)\s+(?:type\s+)?(?:(?:\{[\s\S]*?\}|\*(\s+as\s+[\w$]+)?|[\w*\s,$]+)\s+from\s+)?['"]([^'"]+)['"]/gm;
  for (const match of clean.matchAll(staticPattern)) {
    const spec = match[2]?.trim();
    if (spec && !spec.includes("\n") && !spec.includes("${") && !spec.includes("\\")) {
      specifiers.push(spec);
    }
  }

  // 2. Type-only inline import('...')
  const inlineTypePattern = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/gm;
  for (const match of clean.matchAll(inlineTypePattern)) {
    const spec = match[1]?.trim();
    if (spec && !spec.includes("\n") && !spec.includes("${") && !spec.includes("\\")) {
      specifiers.push(spec);
    }
  }

  // 3. CommonJS require('...')
  const requirePattern = /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/gm;
  for (const match of clean.matchAll(requirePattern)) {
    const spec = match[1]?.trim();
    if (spec && !spec.includes("\n") && !spec.includes("${") && !spec.includes("\\")) {
      specifiers.push(spec);
    }
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

/**
 * Machine-readable marker the governance runner parses so that a non-blocking
 * finding can never be silent. Every advisory is surfaced in the gate matrix
 * under "DECLARED ADVISORIES".
 */
export const ADVISORY_MARKER = "##governance-advisory##";

export function createReporter(name) {
  const errors = [];
  const warnings = [];
  const advisories = [];

  return {
    errors,
    warnings,
    advisories,
    assert(condition, message) {
      if (!condition) errors.push(message);
    },
    /**
     * Record a finding that is non-blocking BY DECLARATION. Use this only when a
     * check is deliberately informational; a genuine invariant must use
     * assert() so it can block. Every advisory is emitted with
     * ADVISORY_MARKER and reported by scripts/validate-governance.mjs, so an
     * advisory is never a silent pass.
     */
    advisory(condition, message) {
      if (!condition) advisories.push(message);
    },
    /**
     * Deprecated alias for advisory(). Retained so any future caller is still
     * surfaced in the gate matrix instead of vanishing into stderr.
     */
    warn(condition, message) {
      if (!condition) {
        warnings.push(message);
        advisories.push(message);
      }
    },
    finish(summary) {
      if (advisories.length) {
        console.log(`${name} declared advisories (non-blocking by declaration):`);
        for (const advisory of advisories) {
          console.log(`- ${advisory}`);
          console.log(`${ADVISORY_MARKER} ${name}: ${advisory}`);
        }
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
