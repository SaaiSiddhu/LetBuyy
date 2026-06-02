import {
  createReporter,
  hasSqlTable,
  readFile,
  readActiveSupabaseSchemaMigration,
} from "./governance-common.mjs";

const reporter = createReporter("Projection integrity validator");

const projectionStore = readFile("packages/projection-runtime/src/projection-store.ts");
const projectionReplay = readFile("packages/projection-runtime/src/projection-replay-runtime.ts");
const projectionConsistency = readFile("packages/projection-runtime/src/projection-consistency-runtime.ts");
const runtimeMigration = readActiveSupabaseSchemaMigration();
const normalizedRuntimeMigration = runtimeMigration.toLowerCase();

for (const fragment of [
  "sourceEventId?: string | null",
  "sourceGlobalPosition?: number | null",
  "sourceStreamPosition?: number | null",
  "Projection store record requires sourceEventId",
  "Projection store record requires sourceGlobalPosition",
  "stableReplaySerialize(record.readModel)",
]) {
  reporter.assert(projectionStore.includes(fragment), `Projection store must enforce replay source metadata fragment: ${fragment}`);
}

for (const fragment of [
  "assertProjectionReplayRecord",
  "assertReplaySafeEventEnvelope(event)",
  "sourceEventId !== event.event_id",
  "sourceGlobalPosition !== event.global_position",
  "sourceStreamPosition !== event.stream_position",
  "stableReplaySerialize(record.readModel)",
]) {
  reporter.assert(projectionReplay.includes(fragment), `Projection replay must enforce source integrity fragment: ${fragment}`);
}

for (const fragment of [
  "sourceGlobalPosition === undefined",
  "version-mismatch",
  "projection exceeds query staleness budget",
  "Projection consistency check failed",
]) {
  reporter.assert(projectionConsistency.includes(fragment), `Projection consistency validator missing fragment: ${fragment}`);
}

reporter.assert(hasSqlTable(runtimeMigration, "projection_store"), "Projection persistence migration missing table: projection_store");
reporter.assert(hasSqlTable(runtimeMigration, "projection_rebuilds"), "Projection persistence migration missing table: projection_rebuilds");
for (const fragment of [
  "source_event_id uuid",
  "source_global_position bigint",
  "source_stream_position bigint",
  "unique (projection_name, projection_version, site_id, object_type, object_id)",
]) {
  reporter.assert(normalizedRuntimeMigration.includes(fragment), `Projection persistence migration missing fragment: ${fragment}`);
}

reporter.finish("Projection replay source metadata, consistency, and persistence gates checked");
