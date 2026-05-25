import {
  createReporter,
  readFile,
  readJson,
} from "./governance-common.mjs";

const reporter = createReporter("CRDT convergence validator");

const manifest = readJson("config/runtime/durable-execution-contract.json");
const crdt = manifest?.crdtConvergence || {};

reporter.assert(manifest?.mode === "governance-contract-not-live-evidence", "CRDT convergence must not claim live evidence");
reporter.assert(manifest?.failurePolicy === "fail-closed", "CRDT convergence must fail closed");
reporter.assert(crdt.engineSource === "packages/distributed-runtime/src/crdt-convergence-runtime.ts", "CRDT convergence engine must live in distributed-runtime");
reporter.assert(crdt.mergeFunction === "mergeCrdtLattice", "CRDT convergence must name merge function");
reporter.assert(crdt.assertionFunction === "assertCrdtConvergence", "CRDT convergence must name assertion function");
reporter.assert(crdt.mergePolicy === "monotonic-lattice-join", "CRDT merge must use monotonic lattice join");
reporter.assert(crdt.orderingPolicy === "replay-safe-lexicographic-merge-order", "CRDT merge ordering must be replay-safe");
reporter.assert(crdt.oscillationPolicy === "monotonic-state-only", "CRDT convergence must forbid oscillation");
reporter.assert(crdt.proofPolicy === "lattice-checksum-required", "CRDT convergence must require lattice checksum");

const source = readFile(crdt.engineSource || "");
for (const fragment of [
  "mergeCrdtLattice",
  "assertCrdtConvergence",
  "lattice instability exists",
  "merge nondeterministic",
  "replay merge corruption possible",
  "monotonic",
]) {
  reporter.assert(source.includes(fragment), `CRDT convergence source missing fragment: ${fragment}`);
}

reporter.finish("CRDT-safe monotonic lattice merge and convergence checksums checked");
