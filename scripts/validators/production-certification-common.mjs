import {
  createReporter,
  exists,
  readFile,
  readJson,
} from "./governance-common.mjs";

const contractPath = "config/runtime/production-certification-execution.json";
const runnerPath = "infrastructure/scripts/operations/run-provider-production-certification.mjs";

export function validateProductionCertification(kind) {
  const reporter = createReporter(kind.reporterName);
  const contract = readJson(contractPath);
  const runner = readFile(runnerPath);
  const gitignore = readFile(".gitignore");
  const packageJson = readJson("package.json");

  for (const file of [
    contractPath,
    "config/runtime/production-certification-execution.schema.json",
    runnerPath,
  ]) {
    reporter.assert(exists(file), `Missing production certification source file: ${file}`);
  }

  reporter.assert(contract?.mode === "provider-backed-execute-required", "Production certification must require provider-backed execution");
  reporter.assert(contract?.certificationMode === "credential-gated-provider-required", "Production certification must stay credential gated until provider evidence exists");
  reporter.assert(contract?.runner?.providerCertification === false, "Production runner contract must not claim provider certification by default");
  reporter.assert(contract?.artifactPolicy?.trackedArtifactsForbidden === true, "Production evidence artifacts must not be tracked");
  reporter.assert(contract?.artifactPolicy?.liveCertificationRequiresProviderEvidence === true, "Live certification must require provider evidence");
  reporter.assert(contract?.artifactPolicy?.stagingEvidenceCertification === false, "Staging evidence must not certify production");
  reporter.assert(contract?.artifactPolicy?.requiresImmutableArchive === true, "Production evidence must require immutable archive governance");
  reporter.assert(gitignore.includes("artifacts/production-certification/"), "Production certification artifacts must be ignored");
  reporter.assert(contract?.failurePolicy === "fail-closed", "Production certification contract must fail closed");

  for (const fragment of [
    "certification: false",
    "provider_certification: false",
    "Cannot run provider-backed production certification in execute mode",
    "LETBUYY_PROVIDER_CERTIFICATION_APPROVED",
    "LETBUYY_PROVIDER_MUTATION_APPROVED",
    "Number(process.versions.node.split(\".\")[0]) >= 22",
    "runCommandStep",
    "wrangler",
    "phase4-live-certify.mjs",
    "psql",
    "OTEL_COLLECTOR_HEALTH_URL",
  ]) {
    reporter.assert(runner.includes(fragment), `Production certification runner missing fail-closed fragment: ${fragment}`);
  }

  reporter.assert(
    packageJson?.scripts?.["validate:production-certification"] === "node scripts/validators/provider-execution-validator.mjs && node scripts/validators/distributed-contention-validator.mjs && node scripts/validators/replay-scale-validator.mjs && node scripts/validators/crash-recovery-validator.mjs && node scripts/validators/telemetry-ingestion-validator.mjs && node scripts/validators/benchmark-certification-validator.mjs && node scripts/validators/provider-failover-certification-validator.mjs && node scripts/validators/partition-recovery-validator.mjs && node scripts/validators/immutable-evidence-validator.mjs && node scripts/validators/production-recovery-drill-validator.mjs",
    "Root package must expose the full provider production certification validator chain",
  );
  reporter.assert(
    packageJson?.scripts?.["certify:production:provider"] === "node infrastructure/scripts/operations/run-provider-production-certification.mjs --environment=production --mode=auto",
    "Root package must expose provider production certification execution",
  );

  if (kind.category) {
    const category = contract?.providerEvidence?.categories?.find((candidate) => candidate.id === kind.category);
    reporter.assert(Boolean(category), `Production certification contract missing category: ${kind.category}`);
    reporter.assert(category?.validator === kind.validator, `Production certification category ${kind.category} must bind ${kind.validator}`);
    for (const evidence of kind.requiredEvidence || []) {
      reporter.assert(category?.requiredEvidence?.includes(evidence), `Production category ${kind.category} missing evidence: ${evidence}`);
    }
  }

  for (const field of kind.requiredProviderFields || []) {
    reporter.assert(contract?.providerEvidence?.requiredFields?.includes(field), `Provider evidence missing field: ${field}`);
  }

  for (const measurement of kind.requiredMeasurements || []) {
    reporter.assert(contract?.benchmarkDatasets?.requiredMeasurements?.includes(measurement), `Benchmark dataset missing measurement: ${measurement}`);
  }

  for (const cloudflareBinding of kind.requiredCloudflareBindings || []) {
    reporter.assert(contract?.cloudflareExecution?.requiredBindingClasses?.includes(cloudflareBinding), `Cloudflare execution missing binding class: ${cloudflareBinding}`);
  }

  reporter.finish(kind.summary);
}
