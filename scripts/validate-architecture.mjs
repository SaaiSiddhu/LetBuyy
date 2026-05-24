import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const canonicalRoots = [
  "apps/storefront-runtime",
  "apps/merchant-control-plane",
  "apps/identity-platform",
  "apps/app-marketplace",
  "apps/theme-marketplace",
  "apps/marketing-site",
  "apps/platform-console",
  "apps/platform-operations-portal",
  "apps/mobile/shopper-app",
  "apps/mobile/merchant-app",
  "apps/mobile/operator-app",
  "apps/mobile/operator-team-app",
  "services/api-gateway",
  "services/checkout-runtime",
  "services/webhook-service",
  "services/queue-workers",
  "services/notification-service",
  "services/search-service",
  "services/media-service",
  "services/analytics-pipeline",
  "services/event-bus",
  "database/supabase/migrations",
  "database/supabase/seeds",
  "database/supabase/verification",
  "legacy/firebase",
  "infrastructure/cloudflare",
  "infrastructure/deployment",
  "infrastructure/observability",
  "infrastructure/monitoring",
  "infrastructure/dns",
  "infrastructure/security",
  "infrastructure/ci-cd",
  "docs/governance",
  "docs/architecture",
  "docs/implementation",
  "docs/runtime",
  "docs/audits",
  "docs/research",
  "docs/archive",
];

const domainPackageRoots = [
  "packages/commerce-core",
  "packages/checkout-core",
  "packages/auth-core",
  "packages/tenant-core",
  "packages/cms-core",
  "packages/theme-engine",
  "packages/app-engine",
  "packages/analytics-core",
  "packages/event-core",
  "packages/search-core",
  "packages/notification-core",
  "packages/billing-core",
  "packages/ui-system",
  "packages/shared-types",
  "packages/shared-utils",
  "packages/mobile-core",
  "packages/mobile-models",
  "packages/mobile-services",
  "packages/mobile-ui-kit",
];

const mandatoryGovernanceFiles = [
  "docs/governance/repository-topology.md",
  "docs/governance/runtime-governance.md",
  "docs/governance/actor-governance.md",
  "docs/governance/domain-governance.md",
  "docs/governance/dependency-governance.md",
  "docs/governance/package-governance.md",
  "docs/governance/runtime-boundaries.md",
  "docs/governance/migration-governance.md",
  "docs/governance/naming-governance.md",
  "docs/governance/platform-operations-governance.md",
  "docs/governance/architecture-enforcement.md",
  "scripts/validate-architecture.mjs",
  ".github/workflows/architecture-governance.yml",
  ".github/CODEOWNERS",
];

const deprecatedTrackedRoots = [
  "backend/",
  "apps/web/",
  "apps/flutter/",
];

const sourceExtensions = new Set([
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

const textExtensions = new Set([
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
]);

const allTrackedFiles = execFileSync("git", ["ls-files", "-z"], { cwd: root })
  .toString("utf8")
  .split("\0")
  .filter(Boolean)
  .sort();

const errors = [];
const warnings = [];

function exists(relPath) {
  return fs.existsSync(path.join(root, relPath));
}

function isTrackedUnder(prefix) {
  return allTrackedFiles.some((file) => file === prefix || file.startsWith(`${prefix}/`));
}

function hasTrackedFileUnder(prefix) {
  return allTrackedFiles.some((file) => file.startsWith(`${prefix}/`));
}

function readFile(relPath) {
  try {
    return fs.readFileSync(path.join(root, relPath), "utf8");
  } catch {
    return "";
  }
}

function dirname(relPath) {
  return path.posix.dirname(relPath);
}

function normalizePath(relPath) {
  return path.posix.normalize(relPath).replace(/^\.\//, "");
}

function rootSegment(relPath) {
  const segments = relPath.split("/");
  if (segments[0] === "apps" && segments[1] === "mobile") return segments.slice(0, 3).join("/");
  if (segments[0] === "apps" || segments[0] === "services") return segments.slice(0, 2).join("/");
  if (segments[0] === "packages") return segments.slice(0, 2).join("/");
  return segments[0];
}

function resolveRelativeImport(fromFile, specifier) {
  if (!specifier.startsWith(".")) return null;
  return normalizePath(path.posix.join(dirname(fromFile), specifier));
}

function extractSpecifiers(text) {
  const specifiers = [];
  const patterns = [
    /^\s*import\s+(?:[^'"]+\s+from\s+)?['"]([^'"]+)['"]/gm,
    /^\s*export\s+[^'"]+\s+from\s+['"]([^'"]+)['"]/gm,
    /\bimport\(\s*['"]([^'"]+)['"]\s*\)/gm,
    /\brequire\(\s*['"]([^'"]+)['"]\s*\)/gm,
  ];

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) specifiers.push(match[1]);
  }

  return [...new Set(specifiers)];
}

function trackedTargetForResolvedImport(resolved) {
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

function assert(condition, message) {
  if (!condition) errors.push(message);
}

for (const relPath of canonicalRoots) {
  assert(exists(relPath), `Missing canonical topology root: ${relPath}`);
}

for (const relPath of domainPackageRoots) {
  assert(exists(relPath), `Missing governed domain package root: ${relPath}`);
  assert(exists(`${relPath}/AGENTS.md`), `Missing domain package ownership file: ${relPath}/AGENTS.md`);
}

for (const relPath of mandatoryGovernanceFiles) {
  assert(exists(relPath), `Missing mandatory governance file: ${relPath}`);
}

for (const prefix of deprecatedTrackedRoots) {
  const offenders = allTrackedFiles.filter((file) => file.startsWith(prefix));
  assert(offenders.length === 0, `Deprecated root has tracked files: ${prefix} (${offenders.slice(0, 5).join(", ")})`);
}

for (const relPath of ["services/api-gateway/dist/index.js", "services/api-gateway/dist/index.js.map", "services/api-gateway/dist/README.md"]) {
  assert(!allTrackedFiles.includes(relPath), `Generated service artifact must not be tracked: ${relPath}`);
}

for (const serviceRoot of ["services/api-gateway", "services/webhook-service"]) {
  assert(exists(`${serviceRoot}/AGENTS.md`), `Missing service ownership file: ${serviceRoot}/AGENTS.md`);
  assert(exists(`${serviceRoot}/package.json`), `Missing service package manifest: ${serviceRoot}/package.json`);
}

const packageManifestRoots = allTrackedFiles
  .filter((file) => file.startsWith("packages/") && file.endsWith("/package.json"))
  .map((file) => path.posix.dirname(file));

for (const packageRoot of packageManifestRoots) {
  assert(exists(`${packageRoot}/AGENTS.md`), `Package manifest lacks ownership file: ${packageRoot}/AGENTS.md`);
  assert(exists(`${packageRoot}/src/index.ts`) || packageRoot.startsWith("packages/dart/"), `TypeScript package lacks public export boundary: ${packageRoot}/src/index.ts`);
}

const importScannedFiles = allTrackedFiles.filter((file) => sourceExtensions.has(path.extname(file)));

for (const file of importScannedFiles) {
  const text = readFile(file);
  const specifiers = extractSpecifiers(text);
  const ownerRoot = rootSegment(file);

  for (const specifier of specifiers) {
    if (specifier.includes("legacy/firebase") || specifier.startsWith("legacy/")) {
      assert(file.startsWith("legacy/"), `Active runtime imports legacy system: ${file} -> ${specifier}`);
    }

    const resolved = resolveRelativeImport(file, specifier);
    const target = resolved ? trackedTargetForResolvedImport(resolved) : specifier;
    const targetRoot = rootSegment(target);

    if (file.startsWith("apps/") && target.startsWith("apps/") && targetRoot !== ownerRoot) {
      errors.push(`Cross-app import is forbidden: ${file} -> ${specifier}`);
    }

    if (file.startsWith("packages/") && (target.startsWith("apps/") || target.startsWith("services/"))) {
      errors.push(`Shared package imports runtime code: ${file} -> ${specifier}`);
    }

    if ((file.startsWith("apps/") || file.startsWith("services/") || file.startsWith("packages/")) && target.startsWith("legacy/")) {
      errors.push(`Active code imports legacy boundary: ${file} -> ${specifier}`);
    }
  }
}

const trackedTextFiles = allTrackedFiles.filter((file) => textExtensions.has(path.extname(file)));
for (const file of trackedTextFiles) {
  if (file === "scripts/validate-architecture.mjs") continue;
  if (file.startsWith("docs/archive/")) continue;
  if (file.startsWith("docs/architecture/master-system-intelligence.md")) continue;
  if (file.startsWith("docs/architecture/repository-intelligence-report.json")) continue;
  if (
    !(
      file === "AGENTS.md" ||
      file === "docs/README.md" ||
      file.startsWith("docs/governance/") ||
      file.startsWith("apps/") && file.endsWith("/AGENTS.md") ||
      file.startsWith("packages/") && file.endsWith("/AGENTS.md") ||
      file.startsWith("services/") && file.endsWith("/AGENTS.md") ||
      file.startsWith("infrastructure/") && file.endsWith("/AGENTS.md") ||
      file.startsWith(".github/") ||
      file === "package.json" ||
      file === "pnpm-workspace.yaml" ||
      file === "vercel.json" ||
      file === "pubspec.yaml" ||
      file === "scripts/generate-repository-intelligence.mjs"
    )
  ) {
    continue;
  }

  const text = readFile(file);
  const staleReferences = [
    "apps/web/consumer/",
    "apps/web/administrative/",
    "apps/flutter/",
    "backend/workers/",
    "backend/supabase",
    "backend/_legacy",
  ].filter((needle) => text.includes(needle));

  if (staleReferences.length > 0) {
    warnings.push(`Stale topology reference in ${file}: ${staleReferences.join(", ")}`);
  }
}

if (!hasTrackedFileUnder("database/supabase/migrations")) {
  errors.push("Supabase migrations must live under database/supabase/migrations");
}

if (!isTrackedUnder("services/api-gateway/src/index.ts")) {
  errors.push("API gateway entrypoint missing: services/api-gateway/src/index.ts");
}

if (warnings.length) {
  console.warn("Architecture validation warnings:");
  for (const warning of warnings) console.warn(`- ${warning}`);
}

if (errors.length) {
  console.error("Architecture validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Architecture validation passed (${allTrackedFiles.length} tracked files scanned).`);
