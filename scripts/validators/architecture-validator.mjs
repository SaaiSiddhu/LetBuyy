import {
  canonicalAppRoots,
  canonicalServiceRoots,
  createReporter,
  deprecatedTrackedPrefixes,
  domainPackageRoots,
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
  "config/env/README.md",
  "config/env/environment-governance.md",
  "scripts/validate-governance.mjs",
  "scripts/validate-architecture.mjs",
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
