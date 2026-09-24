import {
  canonicalAppRoots,
  canonicalServiceRoots,
  createReporter,
  deprecatedTrackedPrefixes,
  domainPackageRoots,
  exists,
  aliasContainerCarveOut,
  forbiddenRuntimeRoots,
  forbiddenRuntimeSubtrees,
  getTrackedFiles,
  isForbiddenRuntimePath,
  rejectedPackageRoots,
  startsWithPrefix,
  formatOffenderList,
} from "./governance-common.mjs";
import fs from "node:fs";

const reporter = createReporter("Architecture validator");
const trackedFiles = getTrackedFiles();

const mandatoryGovernanceFiles = [
  "AGENTS.md",
  ".gitattributes",
  "GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md",
  "GOVERNANCE_REWRITE_2026_06_10/LETBUYY_AGENTS_V2.md",
  "GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CANONICAL_SYSTEMS.md",
  "GOVERNANCE_REWRITE_2026_06_10/LETBUYY_LEGACY_ELIMINATION_MASTER_PLAN.md",
  "GOVERNANCE_REWRITE_2026_06_10/LETBUYY_FOUNDATION_ROADMAP.md",
  "GOVERNANCE_REWRITE_2026_06_10/LETBUYY_UI_UX_GOVERNANCE.md",
  "docs/archive/root-governance-2026-06-10/directories/GOVERNANCE_HARDENING_2026_06_10/GOVERNANCE_HARDENING_PLAN.md",
  "docs/governance/repository-topology.md",
  "docs/governance/runtime-governance.md",
  "docs/governance/dependency-governance.md",
  "docs/governance/environment-governance.md",
  "docs/governance/build-artifact-governance.md",
  "docs/governance/import-governance.md",
  "docs/governance/package-governance.md",
  "docs/governance/runtime-boundaries.md",
  "docs/governance/architecture-enforcement.md",
  "docs/governance/git-governance.md",
  "docs/governance/topology-purification.md",
  "docs/governance/mobile-governance.md",
  "docs/governance/observability-governance.md",
  "docs/governance/theme-runtime-governance.md",
  "docs/governance/infrastructure-governance.md",
  "docs/governance/event-driven-governance.md",
  "docs/governance/outbox-governance.md",
  "docs/governance/storefront-execution-governance.md",
  "docs/governance/provider-isolation-governance.md",
  "docs/governance/tooling-governance.md",
  "docs/governance/runtime-manifest-governance.md",
  "config/env/README.md",
  "config/env/environment-governance.md",
  "config/env/governance/README.md",
  "config/env/ownership/runtime-env-ownership.json",
  "config/runtime/runtime-manifest.schema.json",
  "scripts/validate-governance.mjs",
  "scripts/validate-architecture.mjs",
  "scripts/validators/runtime-manifest-validator.mjs",
  "scripts/validators/dependency-graph-validator.mjs",
  "scripts/validators/provider-isolation-validator.mjs",
  "scripts/validators/tooling-governance-validator.mjs",
  ".github/workflows/architecture-governance.yml",
  ".github/CODEOWNERS",
];

for (const relPath of [...canonicalAppRoots, ...canonicalServiceRoots]) {
  reporter.assert(exists(relPath), `Missing canonical runtime root: ${relPath}`);
  reporter.assert(exists(`${relPath}/AGENTS.md`), `Missing runtime ownership file: ${relPath}/AGENTS.md`);
}

for (const relPath of domainPackageRoots) {
  reporter.assert(exists(relPath), `Missing governed domain package root: ${relPath}`);
  reporter.assert(exists(`${relPath}/AGENTS.md`), `Missing domain package ownership file: ${relPath}/AGENTS.md`);
}

for (const relPath of rejectedPackageRoots) {
  const liveImporters = trackedFiles.filter(
    (file) =>
      /^(apps|services)\//.test(file) &&
      /\.(ts|tsx|js|jsx|mjs|cjs|mts|cts|dart)$/.test(file) &&
      !file.includes("__tests__") &&
      !file.includes("/test/") &&
      !startsWithPrefix(file, relPath),
  );
  const packageName = `@letbuyy/${relPath.split("/").pop()}`;
  const offenders = liveImporters.filter((file) => {
    const text = exists(file) ? fs.readFileSync(file, "utf8") : "";
    return text.includes(packageName) || text.includes(relPath);
  });

  reporter.assert(
    offenders.length === 0,
    `Rejected package is imported by active runtime code: ${relPath} (${formatOffenderList(offenders, 5)})`,
  );
}

for (const relPath of mandatoryGovernanceFiles) {
  reporter.assert(exists(relPath), `Missing mandatory governance file: ${relPath}`);
}

for (const prefix of deprecatedTrackedPrefixes) {
  const offenders = trackedFiles.filter((file) => file.startsWith(prefix));
  reporter.assert(
    offenders.length === 0,
    `Deprecated active root has tracked files: ${prefix} (${formatOffenderList(offenders, 5)})`,
  );
}

for (const prefix of [...forbiddenRuntimeRoots, ...forbiddenRuntimeSubtrees]) {
  const offenders = trackedFiles.filter((file) => startsWithPrefix(file, prefix));
  reporter.assert(!exists(prefix), `Forbidden runtime topology path exists: ${prefix}`);
  reporter.assert(
    offenders.length === 0,
    `Forbidden runtime topology path has tracked files: ${prefix} (${formatOffenderList(offenders, 5)})`,
  );
}

// Amendment 3 (2026-09-24): apps/merchant and apps/internal are permitted ONLY as grouping containers
// of their approved roots. The container may exist; anything else beneath it may not.
for (const [container, approvedRoots] of Object.entries(aliasContainerCarveOut)) {
  const offenders = trackedFiles.filter((file) => startsWithPrefix(file, container) && isForbiddenRuntimePath(file));
  reporter.assert(
    offenders.length === 0,
    `Carved-out alias container ${container} may hold only ${approvedRoots.join(", ")} (${formatOffenderList(offenders, 5)})`,
  );
}

reporter.assert(
  trackedFiles.some((file) => file === "database/supabase/migrations/001_initial_schema.sql" || file.startsWith("database/supabase/migrations/")),
  "Supabase migrations must live under database/supabase/migrations",
);

reporter.assert(
  trackedFiles.includes("services/api-gateway/src/index.ts"),
  "API gateway entrypoint missing: services/api-gateway/src/index.ts",
);

reporter.finish(`${trackedFiles.length} tracked files scanned`);
