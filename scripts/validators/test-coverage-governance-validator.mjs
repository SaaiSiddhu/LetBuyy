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
  "tests/migrations/migration-safety.test.mjs",
  "tests/replay/replay-determinism.test.mjs",
  "tests/operations/deployment-safety.test.mjs",
  "tests/operations/production-deploy-workflow.test.mjs",
  "tests/operations/rate-limit-collapse.test.mjs",
  "tests/operations/rollback-lineage-governance.test.mjs",
  "tests/operations/runtime-governance.test.mjs",
  "tests/operations/queue-bulk-cost.test.mjs",
  "tests/operations/queue-storm-controls.test.mjs",
  "tests/ci/ci-simulation.test.mjs",
  "tests/contracts/runtime-lifecycle-contract.test.mjs",
  "tests/contracts/manifest-lineage-governance.test.mjs",
  "tests/contracts/event-contracts.test.mjs",
  "tests/queues/queue-recovery.test.mjs",
  "tests/feature-flags/feature-flag-governance.test.mjs",
  "tests/security/execution-mode.test.mjs",
];

for (const file of requiredTestFiles) {
  reporter.assert(exists(file), `Missing enterprise test proof file: ${file}`);
}

const packageJson = readJson("package.json");
reporter.assert(packageJson?.scripts?.test?.includes("node --test"), "Root package.json must define node --test based governance test runner");
reporter.assert(packageJson?.scripts?.test?.includes("test:contracts"), "Root test runner must invoke TypeScript contract tests");
reporter.assert(packageJson?.scripts?.["test:contracts"] === "tsx --test tests/contracts/*.test.ts", "Root package.json must run tests/contracts/*.test.ts with tsx");
reporter.assert(Boolean(packageJson?.scripts?.["validate:tests"]), "Root package.json must define validate:tests");

const apiGatewayPackageJson = readJson("services/api-gateway/package.json");
reporter.assert(
  apiGatewayPackageJson?.scripts?.test?.includes("../../tests/contracts/*.test.ts"),
  "API gateway workspace test script must execute root TypeScript contract tests under pnpm turbo test",
);

reporter.finish(`${requiredTestFiles.length} required enterprise test proof files checked`);
