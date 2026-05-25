import {
  canonicalAppRoots,
  canonicalServiceRoots,
  createReporter,
  deprecatedTrackedPrefixes,
  domainPackageRoots,
  executionPackageRoots,
  exists,
  forbiddenRuntimeRoots,
  forbiddenRuntimeSubtrees,
  getTrackedFiles,
  startsWithPrefix,
} from "./governance-common.mjs";

const reporter = createReporter("Architecture validator");
const trackedFiles = getTrackedFiles();

const mandatoryGovernanceFiles = [
  "AGENTS.md",
  ".gitattributes",
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
  "docs/governance/runtime-composition-governance.md",
  "docs/governance/execution-architecture-governance.md",
  "docs/governance/application-services-governance.md",
  "docs/governance/infrastructure-governance.md",
  "docs/governance/orchestration-governance.md",
  "docs/governance/query-layer-governance.md",
  "docs/governance/event-driven-governance.md",
  "docs/governance/event-runtime-governance.md",
  "docs/governance/outbox-governance.md",
  "docs/governance/workflow-governance.md",
  "docs/governance/execution-observability-governance.md",
  "docs/governance/distributed-execution-governance.md",
  "docs/governance/event-replay-governance.md",
  "docs/governance/execution-context-governance.md",
  "docs/governance/query-execution-governance.md",
  "docs/governance/workflow-recovery-governance.md",
  "docs/governance/async-execution-governance.md",
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
  "scripts/validators/execution-layer-validator.mjs",
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

for (const relPath of executionPackageRoots) {
  reporter.assert(exists(relPath), `Missing governed execution package root: ${relPath}`);
  reporter.assert(exists(`${relPath}/AGENTS.md`), `Missing execution package ownership file: ${relPath}/AGENTS.md`);
}

for (const relPath of mandatoryGovernanceFiles) {
  reporter.assert(exists(relPath), `Missing mandatory governance file: ${relPath}`);
}

for (const prefix of deprecatedTrackedPrefixes) {
  const offenders = trackedFiles.filter((file) => file.startsWith(prefix));
  reporter.assert(
    offenders.length === 0,
    `Deprecated active root has tracked files: ${prefix} (${offenders.slice(0, 5).join(", ")})`,
  );
}

for (const prefix of [...forbiddenRuntimeRoots, ...forbiddenRuntimeSubtrees]) {
  const offenders = trackedFiles.filter((file) => startsWithPrefix(file, prefix));
  reporter.assert(!exists(prefix), `Forbidden runtime topology path exists: ${prefix}`);
  reporter.assert(
    offenders.length === 0,
    `Forbidden runtime topology path has tracked files: ${prefix} (${offenders.slice(0, 5).join(", ")})`,
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
