import {
  createReporter,
  readFile,
  readJson,
} from "./governance-common.mjs";

const reporter = createReporter("Compensation governance validator");

const manifest = readJson("config/runtime/distributed-execution-contract.json");
const compensation = manifest?.compensationGovernance || {};

reporter.assert(manifest?.mode === "governance-contract-not-live-evidence", "Compensation governance must not claim live evidence");
reporter.assert(manifest?.failurePolicy === "fail-closed", "Compensation governance must fail closed");
reporter.assert(compensation.engineSource === "packages/distributed-runtime/src/compensation-saga-runtime.ts", "Compensation engine must live in distributed-runtime");
reporter.assert(compensation.stepFactory === "createCompensationStep", "Compensation must name step factory");
reporter.assert(compensation.dagCompiler === "compileCompensationDag", "Compensation must name DAG compiler");
reporter.assert(compensation.assertionFunction === "assertCompensationDagSafe", "Compensation must name assertion");
reporter.assert(compensation.rollbackLineageManifest === "config/runtime/deployment-lineage-manifest.json", "Compensation must bind rollback lineage manifest");
reporter.assert(compensation.irreversibleOperationPolicy === "operator-approval-required-and-checksummed", "Irreversible operations must require approval and checksum");
reporter.assert(compensation.partialRollbackPolicy === "compensate-reversible-steps-before-forward-fix", "Partial rollback compensation policy must be explicit");

const rollbackLineage = readJson(compensation.rollbackLineageManifest || "");
reporter.assert(rollbackLineage?.integrityRules?.rollbackMustNotMutateEventStore === true, "Compensation must preserve event-store immutability through rollback lineage");

const source = readFile(compensation.engineSource || "");
for (const fragment of [
  "createCompensationStep",
  "compileCompensationDag",
  "assertCompensationDagSafe",
  "Compensation DAG cycles exist",
  "Irreversible operation untracked",
  "compensationChecksum",
]) {
  reporter.assert(source.includes(fragment), `Compensation governance source missing fragment: ${fragment}`);
}

reporter.finish("compensation DAG, irreversible operation governance, and rollback lineage checked");
