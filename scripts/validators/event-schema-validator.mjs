import {
  createReporter,
  readFile,
} from "./governance-common.mjs";

const reporter = createReporter("Event schema validator");

const eventEnvelope = readFile("packages/distributed-runtime/src/event-envelope-runtime.ts");
const eventVersioning = readFile("packages/distributed-runtime/src/event-versioning-runtime.ts");
const eventStoreMigration = readFile("database/supabase/migrations/059_distributed_runtime_operations_foundation.sql");
const operationalMigration = readFile("database/supabase/migrations/063_absolute_production_operationalization.sql");

for (const fragment of [
  "schema_version: number",
  "immutable: true",
  "replayable: boolean",
  "retention_class: EventRetentionClass",
  "correlation_id: string",
  "producer: string",
  "stream_position?: number",
  "global_position?: number",
]) {
  reporter.assert(eventEnvelope.includes(fragment), `Distributed event envelope missing schema field: ${fragment}`);
}

for (const fragment of [
  "compatibleWith: number[]",
  "replaySafe: boolean",
  "migrationRequiredFrom: number[]",
  "status: 'current' | 'compatible' | 'requires-migration' | 'unsupported'",
  "descriptor.replaySafe !== true",
]) {
  reporter.assert(eventVersioning.includes(fragment), `Event versioning missing replay compatibility contract: ${fragment}`);
}

for (const fragment of [
  "CREATE TABLE IF NOT EXISTS distributed_event_store",
  "event_id UUID NOT NULL UNIQUE",
  "schema_version INTEGER NOT NULL DEFAULT 1",
  "replayable BOOLEAN NOT NULL DEFAULT TRUE",
  "retention_class TEXT NOT NULL DEFAULT 'hot'",
  "UNIQUE(stream_name, stream_position)",
  "UNIQUE(stream_name, idempotency_key)",
  "correlation_id TEXT NOT NULL",
  "producer TEXT NOT NULL",
]) {
  reporter.assert(eventStoreMigration.includes(fragment), `Distributed event store migration missing replay-safe persistence fragment: ${fragment}`);
}

for (const fragment of [
  "CREATE OR REPLACE FUNCTION append_distributed_event",
  "validate_event_stream_consistency",
  "gap_count",
  "duplicate_count",
  "event_store_integrity_checks",
]) {
  reporter.assert(
    eventStoreMigration.includes(fragment) || operationalMigration.includes(fragment),
    `Event store integrity lifecycle missing fragment: ${fragment}`,
  );
}

reporter.finish("Event envelope, versioning, append-only storage, and integrity schemas checked");
