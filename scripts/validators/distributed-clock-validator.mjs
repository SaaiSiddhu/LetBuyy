import {
  createReporter,
  readFile,
  readJson,
} from "./governance-common.mjs";

const reporter = createReporter("Distributed clock validator");

const manifest = readJson("config/runtime/durable-execution-contract.json");
const clock = manifest?.distributedClock || {};

reporter.assert(manifest?.mode === "governance-contract-not-live-evidence", "Distributed clock governance must not claim live evidence");
reporter.assert(manifest?.failurePolicy === "fail-closed", "Distributed clock governance must fail closed");
reporter.assert(clock.engineSource === "packages/distributed-runtime/src/distributed-clock-runtime.ts", "Distributed clock engine must live in distributed-runtime");
reporter.assert(clock.lamportTick === "tickLamportClock", "Distributed clock must name Lamport tick");
reporter.assert(clock.lamportMerge === "mergeLamportClock", "Distributed clock must name Lamport merge");
reporter.assert(clock.vectorMerge === "mergeVectorClock", "Distributed clock must name vector merge");
reporter.assert(clock.timestampArbitration === "arbitrateCausalityTimestamp", "Distributed clock must name timestamp arbitration");
reporter.assert(clock.assertionFunction === "assertTemporalOrderingStable", "Distributed clock must name ordering assertion");
reporter.assert(clock.clockPolicy === "producer-time-plus-lamport-and-vector-clock", "Distributed clock must combine producer time with logical clocks");
reporter.assert(clock.replayTemporalPolicy === "logical-clock-ordering-precedes-wall-clock-observation", "Replay temporal policy must prefer logical clocks");
for (const forbidden of ["Date.now", "new Date()", "Math.random"]) {
  reporter.assert((clock.forbiddenTemporalSources || []).includes(forbidden), `Distributed clock missing forbidden source: ${forbidden}`);
}

const source = readFile(clock.engineSource || "");
for (const fragment of [
  "tickLamportClock",
  "mergeLamportClock",
  "mergeVectorClock",
  "arbitrateCausalityTimestamp",
  "assertTemporalOrderingStable",
  "Logical clock instability exists",
]) {
  reporter.assert(source.includes(fragment), `Distributed clock source missing fragment: ${fragment}`);
}

reporter.finish("Lamport, vector clock, timestamp arbitration, and temporal ordering checked");
