import {
  createReporter,
  exists,
  readFile,
  readJson,
} from "./governance-common.mjs";

const reporter = createReporter("Convergence math validator");

const manifestPath = "config/runtime/convergence-invariants.json";
const schemaPath = "config/runtime/convergence-invariants.schema.json";
const manifest = readJson(manifestPath);
const engine = manifest?.engine || {};
const equilibrium = manifest?.equilibrium || {};

reporter.assert(exists(manifestPath), `Missing convergence invariants manifest: ${manifestPath}`);
reporter.assert(exists(schemaPath), `Missing convergence invariants schema: ${schemaPath}`);
reporter.assert(manifest?.$schema === schemaPath, "Convergence invariants must reference their schema");
reporter.assert(manifest?.mode === "governance-contract-not-live-evidence", "Convergence invariants must not claim live evidence");
reporter.assert(manifest?.failurePolicy === "fail-closed", "Convergence invariants must fail closed");
reporter.assert(engine.engineSource === "packages/distributed-runtime/src/convergence-math-runtime.ts", "Convergence math engine must live in distributed-runtime");
reporter.assert(engine.compiler === "compileConvergenceEquilibrium", "Convergence math must name compiler");
reporter.assert(engine.assertionFunction === "assertConvergenceEquilibrium", "Convergence math must name assertion");
reporter.assert(equilibrium.fixedPointPolicy === "deterministic-equilibrium-required", "Convergence must require deterministic equilibrium");
reporter.assert(equilibrium.checksumValidation === "fixedPointChecksum-and-equilibriumChecksum", "Convergence must checksum fixed point and equilibrium");

for (const invariant of manifest?.invariants || []) {
  reporter.assert(Boolean(invariant.sourceOfTruth), `Convergence invariant missing source of truth: ${invariant.invariantId}`);
  reporter.assert(Boolean(invariant.derivedState), `Convergence invariant missing derived state: ${invariant.invariantId}`);
  reporter.assert(Boolean(invariant.expression), `Convergence invariant missing expression: ${invariant.invariantId}`);
}

const source = readFile(engine.engineSource || "");
for (const fragment of [
  "compileConvergenceEquilibrium",
  "assertConvergenceEquilibrium",
  "Convergence instability exists",
  "fixedPointChecksum",
  "equilibriumChecksum",
]) {
  reporter.assert(source.includes(fragment), `Convergence math source missing fragment: ${fragment}`);
}

reporter.finish(`${manifest?.invariants?.length || 0} convergence invariants checked`);
