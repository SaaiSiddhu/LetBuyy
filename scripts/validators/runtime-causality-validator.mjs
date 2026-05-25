import {
  createReporter,
  exists,
  readFile,
  readJson,
} from "./governance-common.mjs";

const reporter = createReporter("Runtime causality validator");

const manifestPath = "config/runtime/runtime-causality-graph.json";
const schemaPath = "config/runtime/runtime-causality-graph.schema.json";
const manifest = readJson(manifestPath);
const engine = manifest?.engine || {};
const graph = manifest?.graph || {};

reporter.assert(exists(manifestPath), `Missing runtime causality graph: ${manifestPath}`);
reporter.assert(exists(schemaPath), `Missing runtime causality graph schema: ${schemaPath}`);
reporter.assert(manifest?.$schema === schemaPath, "Runtime causality graph must reference its schema");
reporter.assert(manifest?.mode === "governance-contract-not-live-evidence", "Runtime causality graph must not claim live evidence");
reporter.assert(manifest?.failurePolicy === "fail-closed", "Runtime causality graph must fail closed");
reporter.assert(engine.engineSource === "packages/distributed-runtime/src/runtime-causality-graph-runtime.ts", "Runtime causality engine must live in distributed-runtime");
reporter.assert(engine.compiler === "compileRuntimeCausalityGraph", "Runtime causality manifest must name compiler");
reporter.assert(engine.validator === "assertRuntimeCausalityGraph", "Runtime causality manifest must name validator");
reporter.assert((manifest?.lineageSources || []).length >= 7, "Runtime causality must bind all lineage sources");
reporter.assert(graph.temporalOrderingPolicy === "producer-supplied-time-and-global-position-only", "Runtime causality must use deterministic temporal ordering");
reporter.assert(graph.ancestryReconciliation === "all-lineage-sources-must-have-manifest-lineage-entry", "Runtime causality must reconcile ancestry through manifest lineage");

for (const kind of ["deployment", "replay", "queue", "projection", "rollback", "reconciliation", "execution", "temporal"]) {
  reporter.assert((graph.nodes || []).some((node) => node.kind === kind), `Runtime causality graph missing node kind: ${kind}`);
}

const source = readFile(engine.engineSource || "");
for (const fragment of [
  "compileRuntimeCausalityGraph",
  "assertRuntimeCausalityGraph",
  "causalityChecksum",
  "broken causal ancestry",
  "causality loops",
]) {
  reporter.assert(source.includes(fragment), `Runtime causality source missing fragment: ${fragment}`);
}

reporter.finish("runtime causality graph, temporal ordering, and lineage ancestry checked");
