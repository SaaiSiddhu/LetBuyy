import {
  createReporter,
  readFile,
  readJson,
} from "./governance-common.mjs";

const reporter = createReporter("Lease heartbeat validator");

const manifest = readJson("config/runtime/durable-execution-contract.json");
const heartbeat = manifest?.leaseHeartbeat || {};

reporter.assert(manifest?.mode === "governance-contract-not-live-evidence", "Lease heartbeat must not claim live evidence");
reporter.assert(manifest?.failurePolicy === "fail-closed", "Lease heartbeat must fail closed");
reporter.assert(heartbeat.engineSource === "packages/distributed-runtime/src/lease-heartbeat-runtime.ts", "Lease heartbeat engine must live in distributed-runtime");
reporter.assert(heartbeat.heartbeatFunction === "recordLeaseHeartbeat", "Lease heartbeat must name heartbeat function");
reporter.assert(heartbeat.reconciliationFunction === "reconcileLeaseHeartbeats", "Lease heartbeat must name reconciliation function");
reporter.assert(heartbeat.assertionFunction === "assertLeaseHeartbeatSafe", "Lease heartbeat must name safety assertion");
reporter.assert(heartbeat.heartbeatPolicy === "monotonic-heartbeat-sequence-per-lease-owner", "Lease heartbeat sequence must be monotonic");
reporter.assert(heartbeat.staleExecutorPolicy === "evict-expired-heartbeat-before-takeover", "Stale executor eviction must precede takeover");
reporter.assert(heartbeat.starvationPolicy === "oldest-expired-lease-takeover-before-new-work", "Lease starvation prevention must be governed");
reporter.assert(heartbeat.driftPolicy === "heartbeat-checksum-and-epoch-validation-required", "Heartbeat drift validation must be required");

const source = readFile(heartbeat.engineSource || "");
for (const fragment of [
  "recordLeaseHeartbeat",
  "reconcileLeaseHeartbeats",
  "assertLeaseHeartbeatSafe",
  "heartbeat drift validation missing",
  "evictedWorkers",
  "takeoverRequired",
]) {
  reporter.assert(source.includes(fragment), `Lease heartbeat source missing fragment: ${fragment}`);
}

reporter.finish("lease heartbeat reconciliation, stale executor eviction, and drift validation checked");
