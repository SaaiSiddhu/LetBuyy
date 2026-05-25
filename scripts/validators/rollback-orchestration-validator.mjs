import {
  createReporter,
  readFile,
  readJson,
} from "./governance-common.mjs";

const reporter = createReporter("Rollback orchestration validator");

const manifest = readJson("config/runtime/runtime-orchestration-manifest.json");
const rollback = manifest?.rollbackOrchestration || {};
const lineage = readJson(rollback.lineageManifest || "config/runtime/deployment-lineage-manifest.json");

reporter.assert(manifest?.mode === "governance-contract-not-live-evidence", "Rollback orchestration must not claim live evidence");
reporter.assert(rollback.engineSource === "packages/distributed-runtime/src/rollback-orchestration-runtime.ts", "Rollback orchestration must use package-owned engine");
reporter.assert(rollback.lineageManifest === "config/runtime/deployment-lineage-manifest.json", "Rollback orchestration must bind deployment lineage manifest");
reporter.assert(rollback.requiresPreviousVersionId === true, "Rollback orchestration must require previousVersionId");
reporter.assert(rollback.requiresReason === true, "Rollback orchestration must require reason");
reporter.assert(rollback.sequencing === "reverse-runtime-activation-for-worker-roots", "Rollback orchestration must declare deterministic sequencing");

const source = readFile(rollback.engineSource || "");
for (const fragment of [
  "buildRollbackOrchestrationPlan",
  "previousVersionId",
  "Rollback orchestration requires a reason",
  "deployment-lineage",
  "requires fail-closed gates",
]) {
  reporter.assert(source.includes(fragment), `Rollback orchestration engine missing fragment: ${fragment}`);
}

const requiredPreserves = ["replay", "projection", "queue", "migration", "deployment-lineage"];
const lineageRoots = new Set((lineage?.rollbackManifests || []).map((item) => item.runtimeRoot));
for (const step of rollback.steps || []) {
  reporter.assert(lineageRoots.has(step.runtimeRoot), `Rollback step missing lineage manifest root: ${step.runtimeRoot}`);
  reporter.assert(step.environment === "production", `Rollback orchestration step must be production-scoped until execute mode proves lower env rollback: ${step.runtimeRoot}`);
  reporter.assert((step.requiredGates || []).includes("validate:rollback"), `Rollback step missing validate:rollback gate: ${step.runtimeRoot}`);
  reporter.assert((step.requiredGates || []).includes("validate:replay"), `Rollback step missing validate:replay gate: ${step.runtimeRoot}`);
  reporter.assert((step.requiredGates || []).includes("validate:queues"), `Rollback step missing validate:queues gate: ${step.runtimeRoot}`);
  reporter.assert((step.requiredGates || []).includes("validate:migrations"), `Rollback step missing validate:migrations gate: ${step.runtimeRoot}`);
  for (const required of requiredPreserves) {
    reporter.assert((step.preserves || []).includes(required), `Rollback step must preserve ${required}: ${step.runtimeRoot}`);
  }
}

const orders = (rollback.steps || []).map((step) => step.order);
reporter.assert(new Set(orders).size === orders.length, "Rollback orchestration step orders must be unique");
reporter.assert((rollback.steps || []).length === (lineage?.rollbackManifests || []).length, "Rollback orchestration must cover every rollback lineage manifest");

reporter.finish(`${rollback.steps?.length || 0} rollback orchestration steps checked`);
