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
  "tests/migrations/migration-safety.test.mjs",
  "tests/replay/replay-determinism.test.mjs",
  "tests/operations/deployment-safety.test.mjs",
  "tests/ci/ci-simulation.test.mjs",
  "tests/contracts/runtime-lifecycle-contract.test.mjs",
  "tests/contracts/event-contracts.test.mjs",
  "tests/queues/queue-recovery.test.mjs",
  "tests/feature-flags/feature-flag-governance.test.mjs",
  "tests/chaos/degraded-mode.test.mjs",
  "tests/security/execution-mode.test.mjs",
  "tests/survivability/survivability-governance.test.mjs",
];

for (const file of requiredTestFiles) {
  reporter.assert(exists(file), `Missing enterprise test proof file: ${file}`);
}

const packageJson = readJson("package.json");
reporter.assert(packageJson?.scripts?.test?.includes("node --test"), "Root package.json must define node --test based governance test runner");
reporter.assert(Boolean(packageJson?.scripts?.["validate:tests"]), "Root package.json must define validate:tests");

reporter.finish(`${requiredTestFiles.length} required enterprise test proof files checked`);
