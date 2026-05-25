import {
  createReporter,
  exists,
  readJson,
} from "./governance-common.mjs";

const reporter = createReporter("Test coverage governance validator");

const requiredTestFiles = [
  "tests/dependency/dependency-governance.test.mjs",
  "tests/typescript/typescript-governance.test.mjs",
  "tests/cloudflare/cloudflare-isolation.test.mjs",
  "tests/cloudflare/cloudflare-binding-governance.test.mjs",
  "tests/cloudflare/cloudflare-resource-lineage.test.mjs",
  "tests/cloudflare/cloudflare-execution-governance.test.mjs",
  "tests/migrations/migration-safety.test.mjs",
  "tests/replay/replay-determinism.test.mjs",
  "tests/replay/replay-evolution-governance.test.mjs",
  "tests/replay/replay-simulation.test.mjs",
  "tests/replay/replay-branch-governance.test.mjs",
  "tests/projections/projection-recovery-governance.test.mjs",
  "tests/projections/projection-reconciliation-governance.test.mjs",
  "tests/projections/projection-rebuild-planner.test.mjs",
  "tests/operations/deployment-safety.test.mjs",
  "tests/operations/orchestration-execution.test.mjs",
  "tests/operations/distributed-consistency.test.mjs",
  "tests/operations/orchestration-idempotency.test.mjs",
  "tests/operations/rollback-lineage-governance.test.mjs",
  "tests/operations/runtime-reconciliation.test.mjs",
  "tests/operations/reconciliation-convergence.test.mjs",
  "tests/operations/deployment-orchestration.test.mjs",
  "tests/operations/deployment-intelligence.test.mjs",
  "tests/operations/rollback-orchestration.test.mjs",
  "tests/operations/rollback-intelligence.test.mjs",
  "tests/operations/saturation-governance.test.mjs",
  "tests/operations/compensation-governance.test.mjs",
  "tests/operations/failure-domain-governance.test.mjs",
  "tests/operations/convergence-math.test.mjs",
  "tests/ci/ci-simulation.test.mjs",
  "tests/contracts/runtime-lifecycle-contract.test.mjs",
  "tests/contracts/runtime-state-machine-governance.test.mjs",
  "tests/contracts/runtime-transition-lineage.test.mjs",
  "tests/contracts/runtime-causality-graph.test.mjs",
  "tests/contracts/runtime-memory-model.test.mjs",
  "tests/contracts/manifest-lineage-governance.test.mjs",
  "tests/contracts/manifest-provenance.test.mjs",
  "tests/contracts/event-contracts.test.mjs",
  "tests/queues/queue-recovery.test.mjs",
  "tests/queues/queue-lifecycle-governance.test.mjs",
  "tests/queues/queue-recovery-orchestration.test.mjs",
  "tests/queues/queue-convergence.test.mjs",
  "tests/feature-flags/feature-flag-governance.test.mjs",
  "tests/chaos/degraded-mode.test.mjs",
  "tests/security/execution-mode.test.mjs",
  "tests/replay/replay-recovery-governance.test.mjs",
  "tests/survivability/survivability-governance.test.mjs",
  "tests/survivability/local-operational-proof.test.mjs",
  "tests/survivability/operational-proof-surface.test.mjs",
];

for (const file of requiredTestFiles) {
  reporter.assert(exists(file), `Missing enterprise test proof file: ${file}`);
}

const packageJson = readJson("package.json");
reporter.assert(packageJson?.scripts?.test?.includes("node --test"), "Root package.json must define node --test based governance test runner");
reporter.assert(Boolean(packageJson?.scripts?.["validate:tests"]), "Root package.json must define validate:tests");

reporter.finish(`${requiredTestFiles.length} required enterprise test proof files checked`);
