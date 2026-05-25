import {
  createReporter,
  exists,
  readFile,
  readJson,
} from "./governance-common.mjs";

const reporter = createReporter("Replay evolution validator");

const manifestPath = "config/runtime/replay-evolution-manifest.json";
const schemaPath = "config/runtime/replay-evolution-manifest.schema.json";
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
    for (const key of Object.keys(value).sort()) {
      if (value[key] === undefined) throw new Error("undefined is not stable JSON");
      output[key] = canonicalize(value[key]);
    }
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

reporter.assert(exists(manifestPath), `Missing replay evolution manifest: ${manifestPath}`);
reporter.assert(exists(schemaPath), `Missing replay evolution schema: ${schemaPath}`);
reporter.assert(manifest?.$schema === schemaPath, "Replay evolution manifest must reference its checked-in schema");
reporter.assert(manifest?.mode === "governance-contract-not-live-evidence", "Replay evolution manifest must not claim live evidence");
reporter.assert(manifest?.serializer?.name === "stable-json-sorted-keys", "Replay evolution must use stable sorted JSON");
reporter.assert(manifest?.serializer?.checksum === "fnv1a32-stable-json", "Replay evolution must use repository-owned deterministic checksum");
reporter.assert(manifest?.serializer?.eventTimeSource === "producer-supplied-occurredAt-only", "Replay evolution must require producer time");

const eventFamilies = manifest?.eventFamilies || [];
const familyByType = new Map(eventFamilies.map((family) => [family.eventType, family]));
reporter.assert(eventFamilies.length >= 3, "Replay evolution manifest must cover core checkout event family");

for (const family of eventFamilies) {
  reporter.assert(family.ownerPackage?.startsWith("@letbuyy/"), `Event family must name owning package: ${family.eventType}`);
  reporter.assert(Number.isInteger(family.latestVersion) && family.latestVersion >= 1, `Event family must declare latestVersion: ${family.eventType}`);
  reporter.assert(family.evolutionPolicy === "additive-only-or-explicit-transform-before-replay", `Event family must be additive or explicitly transformed: ${family.eventType}`);

  const versions = family.versions || [];
  reporter.assert(versions.some((version) => version.version === family.latestVersion), `Event family missing current version descriptor: ${family.eventType}`);
  for (const version of versions) {
    reporter.assert(version.replaySafe === true, `Event version must be marked replay-safe: ${family.eventType} v${version.version}`);
    reporter.assert(Array.isArray(version.compatibleWith) && version.compatibleWith.includes(family.latestVersion), `Event version must declare compatibility with latest: ${family.eventType} v${version.version}`);
    reporter.assert(Array.isArray(version.migrationRequiredFrom), `Event version must declare migrationRequiredFrom: ${family.eventType} v${version.version}`);
    const expected = checksum({
      event_type: family.eventType,
      schema_version: version.version,
      payload: version.fixture?.payload,
    });
    reporter.assert(
      version.fixture?.checksum === expected,
      `Replay fixture checksum drift for ${family.eventType} v${version.version}: expected ${expected}`,
    );
  }
}

for (const matrix of manifest?.compatibilityMatrix || []) {
  const family = familyByType.get(matrix.eventType);
  reporter.assert(Boolean(family), `Compatibility matrix references unknown event type: ${matrix.eventType}`);
  reporter.assert(matrix.status === "compatible", `Compatibility matrix must not contain unsupported replay path: ${matrix.eventType} ${matrix.fromVersion}->${matrix.toVersion}`);
  reporter.assert(matrix.transform === "identity" || matrix.transform?.startsWith("packages/"), `Compatibility transform must be identity or package-owned: ${matrix.eventType}`);
}

for (const snapshot of manifest?.deterministicSnapshots || []) {
  reporter.assert(snapshot.description?.includes("not live production evidence"), `Replay snapshot must not imply live evidence: ${snapshot.snapshotId}`);
  let previousGlobalPosition = 0;
  for (const event of snapshot.events || []) {
    const family = familyByType.get(event.eventType);
    reporter.assert(Boolean(family), `Replay snapshot references unknown event type: ${event.eventType}`);
    reporter.assert(event.schemaVersion <= family?.latestVersion, `Replay snapshot uses future schema version: ${event.eventType}`);
    reporter.assert(event.globalPosition > previousGlobalPosition, `Replay snapshot global positions must be strictly ordered: ${snapshot.snapshotId}`);
    previousGlobalPosition = event.globalPosition;
  }
  reporter.assert(snapshot.expectedProjection?.stateChecksum, `Replay snapshot missing expected projection checksum: ${snapshot.snapshotId}`);
}

const eventEnvelope = readFile("packages/distributed-runtime/src/event-envelope-runtime.ts");
for (const fragment of ["stableReplaySerialize", "replayPayloadChecksum", "producer-supplied occurredAt"]) {
  reporter.assert(eventEnvelope.includes(fragment), `Event envelope must expose replay evolution primitive: ${fragment}`);
}

reporter.finish(`${eventFamilies.length} event families and ${(manifest?.deterministicSnapshots || []).length} deterministic snapshots checked`);
