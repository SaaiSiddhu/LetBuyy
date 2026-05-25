import {
  createReporter,
  readFile,
} from "./governance-common.mjs";

const reporter = createReporter("Projection integrity validator");

const projectionStore = readFile("packages/projection-runtime/src/projection-store.ts");
const projectionReplay = readFile("packages/projection-runtime/src/projection-replay-runtime.ts");
const projectionConsistency = readFile("packages/projection-runtime/src/projection-consistency-runtime.ts");
const runtimeMigration = readFile("database/supabase/migrations/059_distributed_runtime_operations_foundation.sql");

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

for (const fragment of [
  "CREATE TABLE IF NOT EXISTS projection_store",
  "source_event_id UUID",
  "source_global_position BIGINT",
  "source_stream_position BIGINT",
  "UNIQUE(projection_name, projection_version, site_id, object_type, object_id)",
  "CREATE TABLE IF NOT EXISTS projection_rebuilds",
]) {
  reporter.assert(runtimeMigration.includes(fragment), `Projection persistence migration missing fragment: ${fragment}`);
}

reporter.finish("Projection replay source metadata, consistency, and persistence gates checked");
