import {
  createReporter,
  readFile,
  readJson,
} from "./governance-common.mjs";

const reporter = createReporter("Operational storage validator");

const manifest = readJson("config/runtime/durable-execution-contract.json");
const storage = manifest?.operationalStorage || {};

reporter.assert(manifest?.mode === "governance-contract-not-live-evidence", "Operational storage must not claim live evidence");
reporter.assert(manifest?.failurePolicy === "fail-closed", "Operational storage must fail closed");
reporter.assert(storage.engineSource === "packages/distributed-runtime/src/operational-storage-runtime.ts", "Operational storage engine must live in distributed-runtime");
reporter.assert(storage.topologyCompiler === "compileOperationalStorageTopology", "Operational storage must name topology compiler");
reporter.assert(storage.assertionFunction === "assertOperationalStorageGovernance", "Operational storage must name assertion");
reporter.assert(storage.retentionPolicy === "retention-days-required-for-every-state-class", "Operational storage must require retention per class");
reporter.assert(storage.archivalPolicy === "wal-hot-then-cold-with-provenance-required", "Operational storage archival policy must require provenance");
reporter.assert(storage.persistenceProvenance === "archivalLineageChecksum", "Operational storage must checksum archival lineage");
for (const stateClass of ["execution-wal", "saga-wal", "replay-checkpoint", "lineage-archive", "lease-checkpoint"]) {
  reporter.assert((storage.stateClasses || []).includes(stateClass), `Operational storage state class missing: ${stateClass}`);
}

const source = readFile(storage.engineSource || "");
for (const fragment of [
  "compileOperationalStorageTopology",
  "assertOperationalStorageGovernance",
  "Storage ownership ambiguous",
  "WAL retention undefined",
  "Lineage retention incomplete",
  "archivalLineageChecksum",
]) {
  reporter.assert(source.includes(fragment), `Operational storage source missing fragment: ${fragment}`);
}

reporter.finish("operational persistence topology, retention, archival, and provenance checked");
