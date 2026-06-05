import {
  createReporter,
  hasSqlFunction,
  hasSqlTable,
  readFile,
  readActiveSupabaseSchemaMigration,
} from "./governance-common.mjs";

const reporter = createReporter("Event schema validator");

const eventEnvelope = readFile("packages/distributed-runtime/src/event-envelope-runtime.ts");
const eventVersioning = readFile("packages/distributed-runtime/src/event-versioning-runtime.ts");
const domainEventContracts = readFile("packages/event-core/src/index.ts");
const eventStoreMigration = readActiveSupabaseSchemaMigration();
const operationalMigration = eventStoreMigration;
const normalizedEventStoreMigration = eventStoreMigration.toLowerCase();

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

reporter.assert(hasSqlTable(eventStoreMigration, "distributed_event_store"), "Distributed event store migration missing replay-safe persistence table: distributed_event_store");
for (const eventType of [
  "theme.purchase.payment_order_created",
  "theme.purchase.completed",
  "theme.draft.saved",
  "theme.draft.discarded",
]) {
  reporter.assert(domainEventContracts.includes(`'${eventType}'`), `Domain event contracts missing emitted theme event: ${eventType}`);
}
for (const reservedPayoutEvent of ["payout.released", "payout.failed"]) {
  const eventIndex = domainEventContracts.indexOf(`eventType: '${reservedPayoutEvent}'`);
  const eventBlock = eventIndex >= 0 ? domainEventContracts.slice(eventIndex, eventIndex + 700) : "";
  reporter.assert(eventBlock.includes("implementationStatus: 'reserved-human-gated'"), `Payout event must be marked reserved-human-gated: ${reservedPayoutEvent}`);
  reporter.assert(eventBlock.includes("payout credentials"), `Payout reserved event must name credential/policy gate: ${reservedPayoutEvent}`);
}
for (const fragment of [
  "event_id uuid not null",
  "schema_version integer default 1 not null",
  "replayable boolean default true not null",
  "retention_class text default 'hot'::text not null",
  "unique (stream_name, stream_position)",
  "unique (stream_name, idempotency_key)",
  "correlation_id text not null",
  "producer text not null",
]) {
  reporter.assert(normalizedEventStoreMigration.includes(fragment), `Distributed event store migration missing replay-safe persistence fragment: ${fragment}`);
}

for (const fragment of [
  "append_distributed_event",
  "validate_event_stream_consistency",
  "gap_count",
  "duplicate_count",
  "event_store_integrity_checks",
]) {
  reporter.assert(
    (fragment === "append_distributed_event" ? hasSqlFunction(eventStoreMigration, fragment) : eventStoreMigration.includes(fragment)) ||
      (fragment === "validate_event_stream_consistency" ? hasSqlFunction(operationalMigration, fragment) : operationalMigration.includes(fragment)),
    `Event store integrity lifecycle missing fragment: ${fragment}`,
  );
}

reporter.finish("Event envelope, versioning, append-only storage, and integrity schemas checked");
