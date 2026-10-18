import {
  createReporter,
  exists,
  readFile,
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
  "tests/ci/workflow-trigger-coverage.test.mjs",
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
// The root `test` script is the wrapper, not an inline command chain: a `node --test ... && test:contracts`
// chain never ran the contract tests once the first part failed. What must still hold is what the chain
// was checked for -- a node --test governance runner and the TypeScript contract tests both run -- so
// those are checked where they now live.
const rootTestScript = packageJson?.scripts?.test ?? "";
const behavioralWrapper = exists("scripts/governance/test-behavioral.mjs") ? readFile("scripts/governance/test-behavioral.mjs") : "";
reporter.assert(/node scripts\/governance\/test-behavioral\.mjs/.test(rootTestScript), "Root package.json test script must run the governance test wrapper (scripts/governance/test-behavioral.mjs)");
reporter.assert(behavioralWrapper.includes("'--test', '--test-concurrency=1'"), "Root test wrapper must define a node --test based governance test runner");
reporter.assert(rootTestScript.includes("--with-contracts") && behavioralWrapper.includes("'test:contracts'"), "Root test runner must invoke TypeScript contract tests");
reporter.assert(packageJson?.scripts?.["test:contracts"] === "tsx --test tests/contracts/*.test.ts", "Root package.json must run tests/contracts/*.test.ts with tsx");
reporter.assert(Boolean(packageJson?.scripts?.["validate:tests"]), "Root package.json must define validate:tests");

// The gateway's acceptance runs the root's own contracts command from the repository root. Run from the
// package directory, tsx applies services/api-gateway/tsconfig.json at runtime, and its type-check `paths`
// send hono/factory to a declaration file, so a contract crashes on import. A path substring cannot tell
// the two apart: the stage itself must be `cd ../..` followed by the root's test:contracts command (the
// shape tests/governance/gateway-db-lane.test.mjs pins).
const apiGatewayPackageJson = readJson("services/api-gateway/package.json");
const apiGatewayTestStages = String(apiGatewayPackageJson?.scripts?.test ?? "").split("&&").map((stage) => stage.trim());
reporter.assert(
  apiGatewayTestStages.some((stage, index) => index > 0 && apiGatewayTestStages[index - 1] === "cd ../.." && stage === packageJson?.scripts?.["test:contracts"]),
  "API gateway workspace test script must execute root TypeScript contract tests under pnpm turbo test (`cd ../..`, then the root test:contracts command)",
);

reporter.finish(`${requiredTestFiles.length} required enterprise test proof files checked`);
