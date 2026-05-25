import {
  createReporter,
  readFile,
  readJson,
} from "./governance-common.mjs";

const reporter = createReporter("Fencing token validator");

const manifest = readJson("config/runtime/durable-execution-contract.json");
const fencing = manifest?.fencingGovernance || {};

reporter.assert(manifest?.mode === "governance-contract-not-live-evidence", "Fencing governance must not claim live evidence");
reporter.assert(manifest?.failurePolicy === "fail-closed", "Fencing governance must fail closed");
reporter.assert(fencing.engineSource === "packages/distributed-runtime/src/lease-fencing-runtime.ts", "Fencing engine must live in distributed-runtime");
reporter.assert(fencing.tokenFunction === "createFencingToken", "Fencing governance must name token function");
reporter.assert(fencing.validationFunction === "validateFencingToken", "Fencing governance must name validation function");
reporter.assert(fencing.tokenPolicy === "monotonic-increment-only", "Fencing tokens must be monotonic");
reporter.assert(fencing.epochLineage === "workerEpoch-plus-leaseVersion-plus-fencingToken", "Fencing must preserve epoch lineage");
reporter.assert(fencing.staleTokenPolicy === "reject-before-operation-apply", "Stale fencing tokens must be rejected before apply");

const source = readFile(fencing.engineSource || "");
for (const fragment of [
  "createFencingToken",
  "validateFencingToken",
  "Fencing validation missing or stale",
  "workerEpoch",
  "leaseVersion",
  "fencingToken",
]) {
  reporter.assert(source.includes(fragment), `Fencing source missing fragment: ${fragment}`);
}

reporter.finish("monotonic fencing token and worker epoch governance checked");
