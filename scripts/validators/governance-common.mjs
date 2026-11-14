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

// Both maintained Next configs admit this exact per-run distDir shape. It is
// generated output just like .next, not application source. Keep other similarly
// named directories visible so this exclusion cannot hide ordinary source.
export const isNextSessionRuntimeDirectoryName = name => /^\.next-session-runtime-[a-zA-Z0-9-]+$/.test(name);
export function isIgnoredDirectoryName(name) {
  return ignoredDirectoryNames.has(name) || isNextSessionRuntimeDirectoryName(name);
}

// Constitution Amendment 3 (2026-09-24, D-APP-LAYOUT, decisions.md §2g): application roots live
// under GROUPING CONTAINERS. A container is never an application root and holds nothing but its
// approved roots (see appGroupContainers below). Phase M's flat six-app paths (2026-09-02) and the
// phase_2 tier are superseded as PATHS; the six-app product model stands. The executable history of
// the moves is the APPID-P1 commit series; docs/archive keeps the old paths as written.
//
// apps/reserved/operator-mobile (formerly apps/admin_app) has been RESERVED since phase FB-1
// (2026-09-05): its Firestore implementation was deleted, the root is manifest-only, and
// no-reserved-service-activation-validator fails the gate on any source file added under it until a
// named trigger and human approval reactivate it. apps/internal/console is the one admin (D-4).
export const canonicalAppRoots = [
  "apps/commerce/web",
  "apps/merchant/web",
  "apps/platform/identity",
  "apps/marketing/web",
  "apps/internal/console",
  "apps/merchant/mobile",
  "apps/marketplace/mobile",
];

export const frozenAppRoots = [
  "apps/frozen/app-store",
  "apps/frozen/developer-portal",
  "apps/frozen/theme-store",
  "apps/frozen/operations-portal",
];

export const reservedMobileRuntimeRoots = [
  "apps/reserved/legacy-shopper-mobile",
  "apps/reserved/legacy-operator-mobile",
  // Reserved by phase FB-1 (2026-09-05), not a placeholder that never held source:
  // the Firestore implementation was deleted and this root reduced to
  // AGENTS.md + runtime.manifest.json. See apps/reserved/operator-mobile/AGENTS.md.
  "apps/reserved/operator-mobile",
];

// apps/deferred/* (Amendment 3; the role Amendment 1 gave apps/phase_2/*): product capabilities
// that hold real source but are not ACTIVE, not RESERVED and not FROZEN, and authorise no backend.
// Activation needs its own amendment and ARB approval.
export const deferredAppRoots = [
  "apps/deferred/delivery/mobile",
];

// reference/apps/* (Amendment 3, new REFERENCE class): preserved donor source. Never deployed,
// never a runtime, workspace, build or deploy member, never imported by an active application --
// yet still inside secret scanning (environment-validator scans every tracked file; since APPID-P2 no
// path prefix is exempt, and reference-isolation-validator.mjs enforces the rest of this sentence).
export const referenceRoot = "reference";
export const referenceAppRoots = [
  "reference/apps/marketplace-seller",
  "reference/apps/store-operations",
];

// Every grouping container and exactly what it may hold. A value is either an application root or
// a nested container (apps/deferred holds the apps/deferred/delivery container).
export const appGroupContainers = {
  "apps/marketplace": ["apps/marketplace/mobile"],
  "apps/merchant": ["apps/merchant/web", "apps/merchant/mobile"],
  "apps/commerce": ["apps/commerce/web"],
  "apps/platform": ["apps/platform/identity"],
  "apps/internal": ["apps/internal/console"],
  "apps/marketing": ["apps/marketing/web"],
  "apps/deferred": ["apps/deferred/delivery"],
  "apps/deferred/delivery": [...deferredAppRoots],
  "apps/frozen": [...frozenAppRoots],
  "apps/reserved": [...reservedMobileRuntimeRoots],
};

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

// The deprecated app aliases (ARCH-R10), as history recorded them.
export const deprecatedAppAliasRoots = [
  "apps/admin",
  "apps/analytics",
  "apps/auth",
  "apps/checkout",
  "apps/internal",
  "apps/merchant",
  "apps/storefront",
];

// Amendment 3's exact carve-out: two alias paths are permitted ONLY as grouping containers of these
// approved roots. Anything else under them -- a file directly in the container, a runtime root AT the
// container, or any other descendant -- is still forbidden runtime topology.
export const aliasContainerCarveOut = {
  "apps/merchant": ["apps/merchant/web", "apps/merchant/mobile"],
  "apps/internal": ["apps/internal/console"],
};

export const forbiddenRuntimeRoots = [
  ...deprecatedAppAliasRoots.filter((alias) => !(alias in aliasContainerCarveOut)),
  "apps/mobile/operator-team-app",
];

export const forbiddenRuntimeSubtrees = [
  "apps/commerce/web/consumer-storefront",
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
  /(^|\/)(\.next(?:-session-runtime-[a-zA-Z0-9-]+)?|dist|build|coverage|\.turbo|\.cache|node_modules|\.dart_tool|\.wrangler|\.vercel|Pods|\.symlinks)(\/|$)|(^|\/)tsconfig\.tsbuildinfo$|\.tsbuildinfo$|(^|\/)\.DS_Store$|\.dill$|\.track\.dill$|\.apk$|\.aab$|\.ipa$|\.tar\.zst$/;

export const debugArtifactPattern =
  /(^|\/)(firebase-debug|firestore-debug|ui-debug|storage-debug|pubsub-debug)\.log$|(^|\/)[^/]*debug[^/]*\.log$|\.trace(\.json)?$|^docs\/architecture\/validation(\/|$)/;

export function execGit(args) {
  // Installed candidates can have several MiB of genuine untracked paths.
  // Keep the complete inventory and propagate failures; never classify a
  // truncated listing as an empty/clean repository.
  return execFileSync("git", args, { cwd: root, maxBuffer: 256 * 1024 * 1024 }).toString("utf8");
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

// Amendment 3: the single forbidden-runtime-path rule. True when the path sits under a prohibited root
// or subtree, or under a carved-out alias container anywhere other than one of its approved roots.
// The container directory itself (e.g. "apps/merchant") is not forbidden: it exists to hold them.
export function isForbiddenRuntimePath(file) {
  if ([...forbiddenRuntimeRoots, ...forbiddenRuntimeSubtrees].some((prefix) => startsWithPrefix(file, prefix))) return true;
  for (const [container, approved] of Object.entries(aliasContainerCarveOut)) {
    if (file === container) return false;
    if (startsWithPrefix(file, container) && !approved.some((rootPath) => startsWithPrefix(file, rootPath))) return true;
  }
  return false;
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
    if (fs.lstatSync(absDir).isSymbolicLink()) return;

    for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
      if (isIgnoredDirectoryName(entry.name)) continue;

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
    if (fs.lstatSync(absDir).isSymbolicLink()) return;

    for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
      const relPath = relDir ? `${relDir}/${entry.name}` : entry.name;
      const absPath = path.join(absDir, entry.name);

      if (entry.isDirectory()) {
        directories.push(normalizePath(relPath));
        if (!isIgnoredDirectoryName(entry.name)) walk(absPath, relPath);
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
    dir.split("/").some((segment) => artifactDirectoryNames.has(segment) || isNextSessionRuntimeDirectoryName(segment)),
  );
}

// F-STALEMETHOD-1. stale-artifact-validator's offenders, by source, computed in one place so the
// validator and tests/governance/ambient-red-attribution.test.mjs read the same set. The validator
// prints at most 20 offenders, so a test that parses its output is blind to the rest: a planted
// `.broken` file, queued behind 135 generated directories, was counted and never printed.
const localScanArtifactPattern =
  /^(deep-tree|domain-map|env-map|garbage-map|heavy-files|import-map|package-map|root-governance|runtime-map|topology|tsconfig-map)\.txt$|^(debug|tmp|temp|scratch|analysis)[-.].*\.(txt|log|json|md|mjs|js|ts)$/;
const staleBackupArtifactPattern = /\.broken$/;

export function collectStaleArtifactOffenders() {
  const untracked = getUntrackedFiles();
  const workspace = listWorkspaceFiles();
  const artifactDirectories = listLocalArtifactDirectories();
  return {
    untrackedScanned: untracked.length,
    workspaceScanned: workspace.length,
    // Report a generated tree once, at its root. The cleanup planner still has
    // to prove that root removable; tracked content or links remain refusals.
    // Stray generated files outside those trees retain their own finding.
    untrackedFiles: untracked.filter((file) =>
      (generatedArtifactPattern.test(file) || localScanArtifactPattern.test(file)) &&
      !artifactDirectories.some((dir) => file.startsWith(`${dir}/`))),
    artifactDirectories,
    workspaceFiles: workspace.filter(
      (file) =>
        debugArtifactPattern.test(file) ||
        staleBackupArtifactPattern.test(file) ||
        isForbiddenRuntimePath(file),
    ),
  };
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
  if (segments[0] === "apps") {
    // Amendment 3 (2026-09-24): application roots sit under grouping containers, so a root is found by
    // the governed lists, never by counting segments. A path under apps/ outside every governed root
    // (a leftover flat path, an unapproved child of a container) falls back to its first two
    // segments -- a "root" no allowlist contains, so every consumer fails loudly on it.
    const governedAppRoots = [...canonicalAppRoots, ...frozenAppRoots, ...reservedMobileRuntimeRoots, ...deferredAppRoots];
    const owner = governedAppRoots.find((appRoot) => relPath === appRoot || relPath.startsWith(`${appRoot}/`));
    return owner ?? segments.slice(0, 2).join("/");
  }
  if (segments[0] === "reference" && segments[1] === "apps" && segments.length > 2) return segments.slice(0, 3).join("/");
  if (segments[0] === "services") return segments.slice(0, 2).join("/");
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
