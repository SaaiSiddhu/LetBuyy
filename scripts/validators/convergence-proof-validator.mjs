import {
  createReporter,
  readFile,
  readJson,
} from "./governance-common.mjs";

const reporter = createReporter("Convergence proof validator");

const manifest = readJson("config/runtime/durable-execution-contract.json");
const proof = manifest?.convergenceProof || {};

reporter.assert(manifest?.mode === "governance-contract-not-live-evidence", "Convergence proof must not claim live evidence");
reporter.assert(manifest?.failurePolicy === "fail-closed", "Convergence proof must fail closed");
reporter.assert(proof.engineSource === "packages/distributed-runtime/src/convergence-proof-runtime.ts", "Convergence proof engine must live in distributed-runtime");
reporter.assert(proof.proofFunction === "compileConvergenceProof", "Convergence proof must name proof compiler");
reporter.assert(proof.assertionFunction === "assertConvergenceProof", "Convergence proof must name assertion function");
reporter.assert(proof.boundedPolicy === "observed-iterations-must-not-exceed-max-iterations", "Convergence proof must be bounded");
reporter.assert(proof.livenessPolicy === "positive-bound-required-for-orchestration-liveness", "Convergence proof must govern liveness");
reporter.assert(proof.deadlockPolicy === "acyclic-dag-and-terminal-fixed-point-required", "Convergence proof must prevent deadlock");
reporter.assert(proof.equilibriumPolicy === "fixed-point-and-theorem-checksum-required", "Convergence proof must require theorem checksums");

const source = readFile(proof.engineSource || "");
for (const fragment of [
  "compileConvergenceProof",
  "assertConvergenceProof",
  "convergence unbounded",
  "DAG cycles possible",
  "equilibrium unstable",
  "theoremChecksum",
]) {
  reporter.assert(source.includes(fragment), `Convergence proof source missing fragment: ${fragment}`);
}

reporter.finish("bounded convergence, liveness, acyclic DAG, and theorem checksum governance checked");
