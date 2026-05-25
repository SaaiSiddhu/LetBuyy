import {
  createReporter,
  readFile,
  readJson,
} from "./governance-common.mjs";

const reporter = createReporter("Adaptive throttling validator");

const manifest = readJson("config/runtime/durable-execution-contract.json");
const throttling = manifest?.adaptiveRecoveryThrottling || {};

reporter.assert(manifest?.mode === "governance-contract-not-live-evidence", "Adaptive throttling must not claim live evidence");
reporter.assert(manifest?.failurePolicy === "fail-closed", "Adaptive throttling must fail closed");
reporter.assert(throttling.engineSource === "packages/distributed-runtime/src/adaptive-recovery-throttling-runtime.ts", "Adaptive throttling engine must live in distributed-runtime");
reporter.assert(throttling.allocatorFunction === "allocateAdaptiveRecoveryBudgets", "Adaptive throttling must name allocator function");
reporter.assert(throttling.assertionFunction === "assertAdaptiveRecoveryThrottling", "Adaptive throttling must name assertion function");
reporter.assert(throttling.governorPolicy === "deterministic-token-bucket-recovery-governor", "Adaptive throttling must use deterministic token bucket governance");
for (const kind of ["replay", "compensation", "queue-rebuild"]) {
  reporter.assert((throttling.stormPrevention || []).includes(kind), `Adaptive throttling storm prevention missing: ${kind}`);
}
reporter.assert(throttling.budgetPolicy === "weighted-by-backlog-error-rate-and-priority", "Adaptive throttling budget policy must be deterministic");
reporter.assert(throttling.starvationPolicy === "at-least-one-token-per-active-kind", "Adaptive throttling must prevent starvation");

const source = readFile(throttling.engineSource || "");
for (const fragment of [
  "allocateAdaptiveRecoveryBudgets",
  "assertAdaptiveRecoveryThrottling",
  "throttling nondeterministic",
  "replay storms possible",
  "compensation storms possible",
  "recovery starvation exists",
]) {
  reporter.assert(source.includes(fragment), `Adaptive throttling source missing fragment: ${fragment}`);
}

reporter.finish("adaptive recovery token buckets, storm prevention, and starvation policy checked");
