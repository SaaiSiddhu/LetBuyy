import {
  createReporter,
  exists,
  readFile,
  readJson,
} from "./governance-common.mjs";

const reporter = createReporter("Projection recovery validator");

const manifestPath = "config/runtime/projection-recovery-manifest.json";
const schemaPath = "config/runtime/projection-recovery-manifest.schema.json";
const manifest = readJson(manifestPath);

function canonicalize(value) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("non-finite number");
    return value;
  }
  if (Array.isArray(value)) return value.map((item) => canonicalize(item));
  if (typeof value === "object") {
    const output = {};
    for (const key of Object.keys(value).sort()) output[key] = canonicalize(value[key]);
    return output;
  }
  throw new Error(`non-json value ${typeof value}`);
}

function checksum(value) {
  const serialized = JSON.stringify(canonicalize(value));
  let hash = 0x811c9dc5;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

reporter.assert(exists(manifestPath), `Missing projection recovery manifest: ${manifestPath}`);
reporter.assert(exists(schemaPath), `Missing projection recovery schema: ${schemaPath}`);
reporter.assert(manifest?.$schema === schemaPath, "Projection recovery manifest must reference its checked-in schema");
reporter.assert(manifest?.mode === "governance-contract-not-live-evidence", "Projection recovery manifest must not claim live evidence");
reporter.assert(manifest?.rebuildRuntime?.hashAlgorithm === "fnv1a32-stable-json", "Projection recovery must use deterministic hash");
reporter.assert(manifest?.rebuildRuntime?.serialization === "stable-json-sorted-keys", "Projection recovery must use stable serialization");

const rebuildSource = readFile("packages/projection-runtime/src/projection-rebuild-runtime.ts");
for (const fragment of [
  "projectionIntegrityHash",
  "assertProjectionRecoverySnapshot",
  "replayPayloadChecksum",
  "integrityHash",
]) {
  reporter.assert(rebuildSource.includes(fragment), `Projection rebuild runtime missing recovery fragment: ${fragment}`);
}

const checkpointSource = readFile("packages/projection-runtime/src/projection-checkpoint-runtime.ts");
reporter.assert(checkpointSource.includes("caller-supplied recordedAt"), "Projection checkpoints must use caller-supplied recordedAt");
reporter.assert(!checkpointSource.includes("new Date().toISOString()"), "Projection checkpoint runtime must not stamp wall-clock time internally");

const replayEvents = new Set((readJson("config/runtime/replay-evolution-manifest.json")?.eventFamilies || []).map((family) => family.eventType));

for (const projection of manifest?.projections || []) {
  reporter.assert(projection.ownerPackage === "@letbuyy/projection-runtime", `Projection must be owned by projection-runtime: ${projection.projectionName}`);
  reporter.assert(projection.ownerRuntime === "services/queue-workers", `Projection recovery runtime must be queue-workers: ${projection.projectionName}`);
  reporter.assert(projection.checkpointPolicy?.sourceEventIdRequired === true, `Projection checkpoint must require sourceEventId: ${projection.projectionName}`);
  reporter.assert(projection.checkpointPolicy?.sourceGlobalPositionRequired === true, `Projection checkpoint must require sourceGlobalPosition: ${projection.projectionName}`);
  reporter.assert(projection.checkpointPolicy?.recordedAtSource === "caller-supplied-runtime-time", `Projection checkpoint time must be caller-supplied: ${projection.projectionName}`);
  reporter.assert(projection.rebuildPolicy?.sourceOfTruth === "append-only-event-store", `Projection rebuild source must be append-only event store: ${projection.projectionName}`);
  reporter.assert(projection.rebuildPolicy?.failOnHashMismatch === true, `Projection rebuild must fail on hash mismatch: ${projection.projectionName}`);

  for (const eventType of projection.sourceEvents || []) {
    reporter.assert(replayEvents.has(eventType), `Projection source event must exist in replay evolution manifest: ${projection.projectionName} -> ${eventType}`);
  }

  for (const snapshot of projection.integritySnapshots || []) {
    const expected = checksum({
      freshness: snapshot.freshness,
      identity: snapshot.identity,
      readModel: snapshot.readModel,
    });
    reporter.assert(snapshot.description?.includes("not live production evidence"), `Projection snapshot must not imply live evidence: ${snapshot.snapshotId}`);
    reporter.assert(snapshot.integrityHash === expected, `Projection recovery hash drift for ${snapshot.snapshotId}: expected ${expected}`);
    reporter.assert(snapshot.identity?.projectionVersion === projection.projectionVersion, `Projection snapshot version mismatch: ${snapshot.snapshotId}`);
    reporter.assert(snapshot.freshness?.sourceGlobalPosition > 0, `Projection snapshot must include source global position: ${snapshot.snapshotId}`);
  }
}

reporter.finish(`${manifest?.projections?.length || 0} projection recovery contracts checked`);
