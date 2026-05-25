import {
  createReporter,
  readFile,
  readJson,
} from "./governance-common.mjs";

const reporter = createReporter("Projection rebuild validator");

const intelligence = readJson("config/runtime/runtime-survivability-intelligence.json");
const rebuild = intelligence?.projectionRebuildIntelligence || {};
const recovery = readJson(rebuild.projectionRecoveryManifest || "config/runtime/projection-recovery-manifest.json");

reporter.assert(intelligence?.mode === "governance-contract-not-live-evidence", "Projection rebuild intelligence must not claim live evidence");
reporter.assert(rebuild.engineSource === "packages/projection-runtime/src/projection-rebuild-planner-runtime.ts", "Projection rebuild planner must live in projection-runtime");
reporter.assert(rebuild.projectionRecoveryManifest === "config/runtime/projection-recovery-manifest.json", "Projection rebuild planner must bind recovery manifest");
reporter.assert(rebuild.planner === "planSelectiveProjectionRebuild", "Projection rebuild manifest must name planner");
reporter.assert(rebuild.boundedAssertion === "assertProjectionRebuildPlanBounded", "Projection rebuild manifest must name bounded assertion");
reporter.assert(rebuild.rebuildPolicy === "selective-window-before-full-rebuild", "Projection rebuild must prefer selective windows");
reporter.assert(Number.isInteger(rebuild.maxBatchSize) && rebuild.maxBatchSize > 0, "Projection rebuild max batch size must be explicit");

const source = readFile(rebuild.engineSource || "");
for (const fragment of [
  "planSelectiveProjectionRebuild",
  "assertProjectionRebuildPlanBounded",
  "Projection dependency cycle exists",
  "ReplayCursor",
  "planChecksum",
]) {
  reporter.assert(source.includes(fragment), `Projection rebuild planner missing fragment: ${fragment}`);
}

const projectionNames = new Set((recovery?.projections || []).map((projection) => projection.projectionName));
for (const candidate of rebuild.candidates || []) {
  reporter.assert(projectionNames.has(candidate.projectionName), `Projection rebuild candidate missing recovery manifest: ${candidate.projectionName}`);
  reporter.assert(candidate.lastHealthyGlobalPosition <= candidate.targetGlobalPosition, `Projection rebuild candidate cursor regresses: ${candidate.projectionName}`);
}
for (const edge of rebuild.dependencyGraph || []) {
  reporter.assert(edge.fromProjection !== edge.toProjection, `Projection dependency self-cycle forbidden: ${edge.fromProjection}`);
  reporter.assert(projectionNames.has(edge.fromProjection), `Projection dependency source missing manifest: ${edge.fromProjection}`);
  reporter.assert(projectionNames.has(edge.toProjection), `Projection dependency target missing manifest: ${edge.toProjection}`);
}

reporter.finish(`${rebuild.candidates?.length || 0} projection rebuild candidates checked`);
