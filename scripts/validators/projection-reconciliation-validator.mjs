import {
  createReporter,
  readFile,
  readJson,
} from "./governance-common.mjs";

const reporter = createReporter("Projection reconciliation validator");

const manifest = readJson("config/runtime/runtime-orchestration-manifest.json");
const reconciliation = manifest?.projectionReconciliation || {};
const recovery = readJson(reconciliation.recoveryManifest || "config/runtime/projection-recovery-manifest.json");

reporter.assert(manifest?.mode === "governance-contract-not-live-evidence", "Projection reconciliation must not claim live evidence");
reporter.assert(reconciliation.engineSource === "packages/projection-runtime/src/projection-reconciliation-runtime.ts", "Projection reconciliation must use package-owned engine");
reporter.assert(reconciliation.recoveryManifest === "config/runtime/projection-recovery-manifest.json", "Projection reconciliation must bind projection recovery manifest");
reporter.assert(reconciliation.ownerRuntime === "services/queue-workers", "Projection reconciliation must be owned by queue workers");
reporter.assert(reconciliation.hashValidation === "projectionIntegrityHash", "Projection reconciliation must use deterministic projection hash");
reporter.assert(reconciliation.checkpointValidation === "sourceGlobalPosition-required", "Projection reconciliation must require source global position");

const source = readFile(reconciliation.engineSource || "");
for (const fragment of [
  "reconcileProjectionRecovery",
  "block-owner-drift",
  "restore-snapshot",
  "assertProjectionRecoverySnapshot",
  "projection snapshot integrity failed",
]) {
  reporter.assert(source.includes(fragment), `Projection reconciliation engine missing fragment: ${fragment}`);
}

for (const action of ["none", "rebuild", "restore-snapshot", "block-owner-drift"]) {
  reporter.assert((reconciliation.requiredActions || []).includes(action), `Projection reconciliation missing action: ${action}`);
}

for (const projection of recovery?.projections || []) {
  reporter.assert(projection.ownerRuntime === reconciliation.ownerRuntime, `Projection owner runtime drift: ${projection.projectionName}`);
  reporter.assert((projection.integritySnapshots || []).length > 0, `Projection reconciliation requires integrity snapshots: ${projection.projectionName}`);
  reporter.assert(projection.rebuildPolicy?.failOnHashMismatch === true, `Projection reconciliation must fail on hash mismatch: ${projection.projectionName}`);
}

reporter.finish(`${recovery?.projections?.length || 0} projection reconciliation contracts checked`);
