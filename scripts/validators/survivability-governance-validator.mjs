import {
  createReporter,
  exists,
  readFile,
  readJson,
} from "./governance-common.mjs";

const reporter = createReporter("Survivability governance validator");

const requiredFiles = [
  "config/runtime/survivability-execution.schema.json",
  "config/runtime/survivability-execution.json",
  "config/runtime/observability-platform.schema.json",
  "config/runtime/observability-platform.json",
  "config/runtime/multi-region-runtime.schema.json",
  "config/runtime/multi-region-runtime.json",
  "infrastructure/scripts/operations/run-survivability-suite.mjs",
  "infrastructure/scripts/operations/run-local-operational-proof.mjs",
  "infrastructure/scripts/operations/generate-certification-report.mjs",
  "infrastructure/scripts/operations/run-live-drills.mjs",
  "docs/governance/operational-resilience-governance.md",
  "docs/governance/deployment-proof-governance.md",
  "docs/governance/deterministic-runtime-governance.md",
  "docs/governance/infra-recovery-governance.md",
  "docs/runbooks/survivability-suite.md",
  "docs/runbooks/infra-recovery.md",
];

for (const file of requiredFiles) {
  reporter.assert(exists(file), `Missing survivability source file: ${file}`);
}

const survivability = readJson("config/runtime/survivability-execution.json");
const observability = readJson("config/runtime/observability-platform.json");
const multiRegion = readJson("config/runtime/multi-region-runtime.json");
const productionTopology = readJson("config/runtime/production-topology.json");

for (const category of survivability?.operationalProof?.requiredEvidenceCategories || []) {
  reporter.assert(
    ["deployment", "cloudflare", "supabase", "observability", "incident", "failover", "chaos", "load", "security", "dashboards", "control-plane", "sre", "event-store", "multi-region", "replay-runtime"].includes(category),
    `Unknown survivability evidence category: ${category}`,
  );
}

for (const forbidden of [
  "marking planned evidence as passed",
  "recording passed failover evidence without observed RTO/RPO",
  "recording passed load evidence without measured latency/error metrics",
  "recording passed chaos evidence without recovery observation",
]) {
  reporter.assert(
    survivability?.modePolicy?.forbidden?.includes(forbidden),
    `Survivability contract must forbid unsafe evidence behavior: ${forbidden}`,
  );
}

for (const stage of ["governance", "dependency", "typescript", "tests", "replay", "migrations", "cloudflare", "observability", "deployment", "rollback", "chaos", "load", "certification"]) {
  reporter.assert(
    (survivability?.requiredStages || []).some((candidate) => candidate.name === stage && candidate.script && candidate.evidence),
    `Survivability contract missing required stage: ${stage}`,
  );
}

for (const signal of ["traces", "metrics", "logs", "spans", "operational-events"]) {
  reporter.assert(observability?.signals?.includes(signal), `Observability platform missing signal: ${signal}`);
}

for (const lineage of ["request-lineage", "queue-lineage", "replay-lineage", "deployment-lineage", "tenant-lineage", "regional-lineage", "migration-lineage"]) {
  reporter.assert(observability?.lineage?.includes(lineage), `Observability platform missing lineage: ${lineage}`);
}

const prometheusRules = readFile("infrastructure/observability/prometheus-rules.yaml");
for (const alert of observability?.alerts || []) {
  reporter.assert(prometheusRules.includes(`alert: ${alert.name}`), `Prometheus rules missing observability contract alert: ${alert.name}`);
}

for (const dashboard of observability?.dashboards || []) {
  reporter.assert(exists(dashboard.path), `Observability contract references missing dashboard: ${dashboard.path}`);
  const dashboardText = readFile(dashboard.path);
  reporter.assert(/"targets"\s*:/.test(dashboardText), `Dashboard must declare live telemetry targets: ${dashboard.path}`);
  reporter.assert(/"expr"\s*:/.test(dashboardText) || /"rawSql"\s*:/.test(dashboardText), `Dashboard must use live Prometheus or operational projection queries: ${dashboard.path}`);
  for (const forbiddenSource of observability?.forbiddenDashboardSources || []) {
    reporter.assert(
      !dashboardText.toLowerCase().includes(forbiddenSource.toLowerCase()),
      `Dashboard must not use forbidden placeholder source ${forbiddenSource}: ${dashboard.path}`,
    );
  }
}

const regionIds = new Set((multiRegion?.regions || []).map((region) => region.id));
for (const region of ["india", "apac", "eu", "us"]) {
  reporter.assert(regionIds.has(region), `Multi-region runtime contract missing region: ${region}`);
}

for (const pair of multiRegion?.failoverPairs || []) {
  reporter.assert(regionIds.has(pair.source), `Failover pair references unknown source region: ${pair.source}`);
  reporter.assert(regionIds.has(pair.target), `Failover pair references unknown target region: ${pair.target}`);
  reporter.assert(pair.replayRequired === true, `Failover pair must require replay validation: ${pair.source}->${pair.target}`);
  reporter.assert(Number(pair.rtoSeconds) > 0 && Number(pair.rpoSeconds) > 0, `Failover pair must declare positive RTO/RPO: ${pair.source}->${pair.target}`);
}

reporter.assert(
  productionTopology?.regions?.globalRegions?.length >= 4,
  "Production topology must project globalRegions from the multi-region runtime contract",
);

const liveDrills = readFile("infrastructure/scripts/operations/run-live-drills.mjs");
reporter.assert(
  !/status:\s*"passed"/.test(liveDrills),
  "Live drill runner must not hardcode passed evidence; measured systems must update pass state",
);
reporter.assert(
  liveDrills.includes("pass status requires measured") || liveDrills.includes("pass status requires observed"),
  "Live drill runner must document measured evidence requirement",
);

const certificationReport = readFile("infrastructure/scripts/operations/generate-certification-report.mjs");
for (const fragment of ["passing_records", "passingStatuses", "record.is_consistent", "signature_valid"]) {
  reporter.assert(certificationReport.includes(fragment), `Certification report must require passing live evidence fragment: ${fragment}`);
}
reporter.assert(
  certificationReport.includes("LETBUYY_SURVIVABILITY_EXECUTION_APPROVED"),
  "Certification report execute mode must include survivability operator approval in capability scoring",
);

const survivabilitySuite = readFile("infrastructure/scripts/operations/run-survivability-suite.mjs");
for (const fragment of [
  "LETBUYY_SURVIVABILITY_EXECUTION_APPROVED",
  "Cannot run survivability suite in execute mode",
  "phase4-live-certify.mjs",
  "validate:governance",
  "validate:production",
]) {
  reporter.assert(survivabilitySuite.includes(fragment), `Survivability suite missing execution-safety fragment: ${fragment}`);
}

const localProof = readFile("infrastructure/scripts/operations/run-local-operational-proof.mjs");
for (const fragment of [
  "scope: \"local-only\"",
  "certification: false",
  "runReplayProof",
  "runQueueRecoveryProof",
  "local-replay-dry-run",
  "blocked_live_evidence",
]) {
  reporter.assert(localProof.includes(fragment), `Local operational proof runner missing non-certification fragment: ${fragment}`);
}

const gitignore = readFile(".gitignore");
reporter.assert(
  gitignore.includes("artifacts/local-operational-proof/"),
  "Local operational proof evidence artifacts must be ignored",
);

const packageJson = readJson("package.json");
reporter.assert(
  packageJson?.scripts?.["proof:local"] === "node infrastructure/scripts/operations/run-local-operational-proof.mjs",
  "Root package must expose proof:local",
);

const rootPackage = readJson("package.json");
reporter.assert(
  rootPackage?.scripts?.["validate:survivability"] === "node scripts/validators/survivability-governance-validator.mjs",
  "Root package must expose validate:survivability",
);

for (const workflowPath of [
  ".github/workflows/architecture-governance.yml",
  ".github/workflows/production-rollout.yml",
  ".github/workflows/live-production-certification.yml",
]) {
  const workflow = readFile(workflowPath);
  reporter.assert(workflow.includes("validate:survivability"), `Workflow must run validate:survivability: ${workflowPath}`);
}

reporter.finish("survivability contracts, evidence policy, observability, multi-region, and CI gates checked");
