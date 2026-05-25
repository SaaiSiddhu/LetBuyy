import {
  createReporter,
  readFile,
  readJson,
} from "./governance-common.mjs";

const reporter = createReporter("Queue convergence validator");

const intelligence = readJson("config/runtime/runtime-survivability-intelligence.json");
const convergence = intelligence?.queueConvergence || {};
const queueLifecycle = readJson(convergence.queueLifecycleManifest || "config/runtime/queue-lifecycle-manifest.json");

reporter.assert(intelligence?.mode === "governance-contract-not-live-evidence", "Queue convergence must not claim live evidence");
reporter.assert(convergence.engineSource === "packages/distributed-runtime/src/queue-convergence-runtime.ts", "Queue convergence engine must live in distributed-runtime");
reporter.assert(convergence.queueLifecycleManifest === "config/runtime/queue-lifecycle-manifest.json", "Queue convergence must bind queue lifecycle manifest");
reporter.assert(convergence.convergenceFunction === "planQueueConvergence", "Queue convergence must name planner");
reporter.assert(convergence.assertionFunction === "assertQueueConvergence", "Queue convergence must name assertion");
reporter.assert(convergence.idempotencyRequired === true, "Queue convergence must require idempotency");
reporter.assert(convergence.eventualConvergencePolicy === "redrive-or-rebuild-until-hashes-align", "Queue convergence must define deterministic recovery path");

const source = readFile(convergence.engineSource || "");
for (const fragment of [
  "planQueueConvergence",
  "assertQueueConvergence",
  "eventStoreHash",
  "queueHash",
  "projectionHash",
  "block-missing-idempotency",
  "redrive-undelivered",
  "rebuild-stale-projection",
]) {
  reporter.assert(source.includes(fragment), `Queue convergence engine missing fragment: ${fragment}`);
}

for (const state of ["event-store", "projection", "queue-processing"]) {
  reporter.assert((convergence.stateEquality || []).includes(state), `Queue convergence missing state equality dimension: ${state}`);
}
for (const hash of ["eventStoreHash", "queueHash", "projectionHash"]) {
  reporter.assert((convergence.hashes || []).includes(hash), `Queue convergence missing hash: ${hash}`);
}
for (const queue of queueLifecycle?.queues || []) {
  reporter.assert(queue.replayIntegrity, `Queue convergence requires replay integrity policy: ${queue.logicalName}`);
}

reporter.finish(`${queueLifecycle?.queues?.length || 0} queue convergence contracts checked`);
