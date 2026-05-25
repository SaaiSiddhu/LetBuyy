import {
  createReporter,
  readFile,
  readJson,
} from "./governance-common.mjs";

const reporter = createReporter("Rollback intelligence validator");

const manifest = readJson("config/runtime/runtime-survivability-intelligence.json");
const rollback = manifest?.rollbackIntelligence || {};
const orchestration = readJson("config/runtime/runtime-orchestration-manifest.json")?.rollbackOrchestration || {};

reporter.assert(manifest?.mode === "governance-contract-not-live-evidence", "Rollback intelligence must not claim live evidence");
reporter.assert(rollback.engineSource === "packages/distributed-runtime/src/rollback-intelligence-runtime.ts", "Rollback intelligence must live in distributed-runtime");
reporter.assert(rollback.baseRollbackEngine === "packages/distributed-runtime/src/rollback-orchestration-runtime.ts", "Rollback intelligence must build on rollback orchestration");
reporter.assert(rollback.dagCompiler === "compileRollbackDag", "Rollback intelligence must name DAG compiler");
reporter.assert(rollback.simulationEngine === "simulateRollback", "Rollback intelligence must name simulation engine");
reporter.assert(rollback.convergenceValidator === "assertRollbackDagSafe", "Rollback intelligence must name convergence validator");

const source = readFile(rollback.engineSource || "");
for (const fragment of [
  "compileRollbackDag",
  "simulateRollback",
  "assertRollbackDagSafe",
  "Rollback dependency cycle exists",
  "blastRadius",
  "simulationChecksum",
]) {
  reporter.assert(source.includes(fragment), `Rollback intelligence engine missing fragment: ${fragment}`);
}

const requiredCompatibility = ["replay", "projection", "queue", "migration", "deployment-lineage"];
for (const dimension of requiredCompatibility) {
  reporter.assert((rollback.requiredCompatibility || []).includes(dimension), `Rollback intelligence missing compatibility dimension: ${dimension}`);
  for (const step of orchestration.steps || []) {
    reporter.assert((step.preserves || []).includes(dimension), `Rollback orchestration step does not preserve ${dimension}: ${step.runtimeRoot}`);
  }
}

const roots = new Set((orchestration.steps || []).map((step) => step.runtimeRoot));
for (const edge of rollback.dependencyEdges || []) {
  reporter.assert(roots.has(edge.fromRuntimeRoot), `Rollback DAG edge source missing orchestration step: ${edge.fromRuntimeRoot}`);
  reporter.assert(roots.has(edge.toRuntimeRoot), `Rollback DAG edge target missing orchestration step: ${edge.toRuntimeRoot}`);
  reporter.assert(edge.fromRuntimeRoot !== edge.toRuntimeRoot, `Rollback DAG self edge forbidden: ${edge.fromRuntimeRoot}`);
}

reporter.finish(`${rollback.dependencyEdges?.length || 0} rollback DAG edges checked`);
