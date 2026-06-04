import {
  createReporter,
  exists,
  readFile,
  readJson,
} from "./governance-common.mjs";

const evidencePath = "config/runtime/operational-certification-evidence.json";
const sloPath = "config/runtime/recovery-slo-contract.json";
const harnessPath = "infrastructure/scripts/operations/run-operational-certification.mjs";

export function validateOperationalCertification(kind) {
  const reporter = createReporter(kind.reporterName);
  const evidence = readJson(evidencePath);
  const slo = readJson(sloPath);
  const harness = readFile(harnessPath);
  const gitignore = readFile(".gitignore");
  const packageJson = readJson("package.json");
  const runtimeSource = readFile("packages/distributed-runtime/src/operational-certification-runtime.ts");

  for (const file of [
    "config/runtime/operational-certification-evidence.schema.json",
    evidencePath,
    "config/runtime/recovery-slo-contract.schema.json",
    sloPath,
    harnessPath,
    "packages/distributed-runtime/src/operational-certification-runtime.ts",
  ]) {
    reporter.assert(exists(file), `Missing operational certification source file: ${file}`);
  }

  reporter.assert(evidence?.mode === "staging-executable-evidence-not-production-certification", "Operational evidence contract must not claim production certification");
  reporter.assert(evidence?.harness?.productionCertification === false, "Operational certification harness contract must mark productionCertification false");
  reporter.assert(evidence?.artifactPolicy?.trackedArtifactsForbidden === true, "Operational certification artifacts must be forbidden from tracking");
  reporter.assert(gitignore.includes("artifacts/operational-certification/"), "Operational certification evidence artifacts must be ignored");
  reporter.assert(slo?.mode === "staging-executable-evidence-not-production-certification", "Recovery SLO contract must be staging evidence scoped");
  reporter.assert(slo?.failurePolicy === "fail-closed", "Recovery SLO contract must fail closed");

  for (const fragment of [
    "scope: \"staging-executable\"",
    "certification: false",
    "production_certification: false",
    "blocked_live_evidence",
    "LETBUYY_OPERATIONAL_CERTIFICATION_APPROVED",
    "refuses to record live operational evidence",
  ]) {
    reporter.assert(harness.includes(fragment), `Operational certification harness missing safety fragment: ${fragment}`);
  }
  reporter.assert(
    evidence?.telemetry?.lineagePolicies?.includes("timing-is-observed-not-synthetic"),
    "Operational evidence contract must distinguish observed timing from synthetic timing",
  );

  reporter.assert(
    packageJson?.scripts?.["validate:operational-certification"] === "node scripts/validators/replay-certification-validator.mjs && node scripts/validators/rollback-certification-validator.mjs && node scripts/validators/queue-certification-validator.mjs && node scripts/validators/wal-certification-validator.mjs && node scripts/validators/failover-certification-validator.mjs && node scripts/validators/recovery-slo-validator.mjs && node scripts/validators/operational-evidence-validator.mjs && node scripts/validators/telemetry-lineage-validator.mjs && node scripts/validators/durable-object-certification-validator.mjs && node scripts/validators/recovery-budget-validator.mjs && node scripts/validators/persistence-certification-validator.mjs && node scripts/validators/replay-throughput-validator.mjs && node scripts/validators/queue-rebuild-execution-validator.mjs && node scripts/validators/rollback-execution-validator.mjs && node scripts/validators/telemetry-pipeline-validator.mjs && node scripts/validators/benchmark-lineage-validator.mjs && node scripts/validators/operational-evidence-lineage-validator.mjs && node scripts/validators/cloudflare-execution-certification-validator.mjs && node scripts/validators/recovery-drill-execution-validator.mjs && node scripts/validators/lease-contention-validator.mjs",
    "Root package must expose the full operational certification validator chain",
  );
  reporter.assert(
    !Object.keys(packageJson?.scripts || {}).some((scriptName) => scriptName.includes("certify:operational") && scriptName.endsWith(":local")),
    "Root package must not expose retired operational certification execution",
  );

  if (kind.category) {
    const category = evidence?.certificationCategories?.find((candidate) => candidate.id === kind.category);
    reporter.assert(Boolean(category), `Operational evidence contract missing category: ${kind.category}`);
    reporter.assert(category?.validator === kind.validator, `Operational evidence category ${kind.category} must bind ${kind.validator}`);
    reporter.assert(harness.includes(category?.runnerFunction || "__missing__"), `Operational certification harness missing runner function: ${category?.runnerFunction}`);
    for (const required of kind.requiredEvidence || []) {
      reporter.assert(category?.requiredEvidence?.includes(required), `Operational certification category ${kind.category} missing evidence contract: ${required}`);
    }
  }

  if (kind.telemetry) {
    for (const field of [
      "trace_id",
      "span_id",
      "parent_span_id",
      "duration_ms",
      "input_checksum",
      "result_checksum",
      "causality_checksum",
    ]) {
      reporter.assert(evidence?.telemetry?.requiredFields?.includes(field), `Telemetry evidence contract missing field: ${field}`);
    }
    for (const fragment of [
      "createOperationalTelemetryEvent",
      "causalityChecksum",
      "assertOperationalEvidenceManifest",
    ]) {
      reporter.assert(runtimeSource.includes(fragment), `Operational telemetry runtime missing fragment: ${fragment}`);
    }
  }

  if (kind.slo) {
    for (const budget of [
      "replayRestorationMs",
      "queueRebuildMs",
      "rollbackRecoveryMs",
      "walRestorationMs",
      "orchestrationRecoveryMs",
      "leaseFailoverMs",
      "durableObjectRecoveryMs",
    ]) {
      reporter.assert(Number(slo?.budgets?.[budget]) > 0, `Recovery SLO budget must be positive: ${budget}`);
    }
    reporter.assert(slo?.boundedConvergence?.requiresFixedPoint === true, "Recovery SLO must require fixed-point convergence");
    reporter.assert(slo?.boundedConvergence?.requiresTelemetryLineage === true, "Recovery SLO must require telemetry lineage");
  }

  if (kind.budget) {
    reporter.assert(harness.includes("assertSloBudgets"), "Operational certification harness must compare observed timings to recovery budgets");
    reporter.assert(harness.includes("within_budget"), "Operational certification evidence must record within_budget results");
    reporter.assert(slo?.recoveryBudgetGovernance?.productionCertificationPolicy?.includes("not production SLO certification"), "Recovery budget governance must distinguish staging evidence from production SLO certification");
  }

  if (kind.finalValidator) {
    reporter.assert(
      evidence?.finalCertificationValidators?.includes(kind.finalValidator),
      `Operational evidence contract missing final certification validator: ${kind.finalValidator}`,
    );
    for (const fragment of kind.harnessFragments || []) {
      reporter.assert(harness.includes(fragment), `Operational certification harness missing execution fragment: ${fragment}`);
    }
    for (const field of kind.contractFields || []) {
      reporter.assert(Boolean(field.split(".").reduce((value, key) => value?.[key], evidence)), `Operational evidence contract missing field: ${field}`);
    }
    for (const field of kind.sloFields || []) {
      reporter.assert(Boolean(field.split(".").reduce((value, key) => value?.[key], slo)), `Recovery SLO contract missing field: ${field}`);
    }
  }

  reporter.finish(kind.summary);
}
