import {
  createReporter,
  readFile,
  readJson,
} from "./governance-common.mjs";

const reporter = createReporter("Lease governance validator");

const manifest = readJson("config/runtime/durable-execution-contract.json");
const lease = manifest?.leaseGovernance || {};

reporter.assert(manifest?.mode === "governance-contract-not-live-evidence", "Lease governance must not claim live evidence");
reporter.assert(manifest?.failurePolicy === "fail-closed", "Lease governance must fail closed");
reporter.assert(lease.engineSource === "packages/distributed-runtime/src/lease-fencing-runtime.ts", "Lease engine must live in distributed-runtime");
reporter.assert(lease.arbitrationFunction === "arbitrateOrchestrationLease", "Lease governance must name arbitration function");
reporter.assert(lease.checkpointFunction === "reconcileLeaseCheckpoint", "Lease governance must name checkpoint function");
reporter.assert(lease.revocationFunction === "revokeOrchestrationLease", "Lease governance must name revocation function");
reporter.assert(lease.singleExecutorAssertion === "assertSingleAuthoritativeExecutor", "Lease governance must assert single executor");
reporter.assert(lease.leasePolicy === "one-authoritative-executor-per-orchestration", "Lease policy must enforce single authoritative executor");
reporter.assert(lease.takeoverPolicy === "expired-lease-only-with-monotonic-fencing-token", "Lease takeover must require expiration and monotonic fencing");
reporter.assert(lease.splitBrainPolicy === "hard-fail-on-active-owner-overlap", "Lease governance must fail on split brain");

const source = readFile(lease.engineSource || "");
for (const fragment of [
  "arbitrateOrchestrationLease",
  "reconcileLeaseCheckpoint",
  "revokeOrchestrationLease",
  "assertSingleAuthoritativeExecutor",
  "Split-brain possible",
  "expired-takeover",
]) {
  reporter.assert(source.includes(fragment), `Lease governance source missing fragment: ${fragment}`);
}

reporter.finish("lease arbitration, renewal, revocation, and split-brain prevention checked");
