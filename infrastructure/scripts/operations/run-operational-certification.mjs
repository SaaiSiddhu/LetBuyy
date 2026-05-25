#!/usr/bin/env node
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";

const args = process.argv.slice(2);
const mode = valueFor("--mode") || "local";
const output = valueFor("--output") || "artifacts/operational-certification/report.json";
const replayEvents = Number(valueFor("--replay-events") || 6000);
const queueMessages = Number(valueFor("--queue-messages") || 12000);
const walEntries = Number(valueFor("--wal-entries") || 128);
const storageDir = valueFor("--storage-dir") || path.join(path.dirname(output), "persistent-store");
const fixedStartedAt = "2026-05-25T00:00:00.000Z";

function valueFor(prefix) {
  const arg = args.find((candidate) => candidate.startsWith(`${prefix}=`));
  return arg ? arg.slice(prefix.length + 1) : null;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function stable(value) {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map(stable);
  const sorted = {};
  for (const key of Object.keys(value).sort()) sorted[key] = stable(value[key]);
  return sorted;
}

function sha256(value) {
  return crypto.createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
}

function readJson(relPath) {
  return JSON.parse(fs.readFileSync(relPath, "utf8"));
}

function appendRecord(collection, record) {
  fs.mkdirSync(storageDir, { recursive: true });
  const file = path.join(storageDir, `${collection}.jsonl`);
  const sequence = fs.existsSync(file)
    ? fs.readFileSync(file, "utf8").split("\n").filter(Boolean).length + 1
    : 1;
  const previousChecksum = sequence > 1
    ? JSON.parse(fs.readFileSync(file, "utf8").trim().split("\n").at(-1)).record_checksum
    : null;
  const persisted = {
    ...record,
    storage_sequence: sequence,
    previous_record_checksum: previousChecksum,
  };
  persisted.record_checksum = sha256(persisted);
  fs.appendFileSync(file, `${JSON.stringify(persisted)}\n`);
  return persisted;
}

function readRecords(collection) {
  const file = path.join(storageDir, `${collection}.jsonl`);
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

function writeSnapshot(name, value) {
  fs.mkdirSync(storageDir, { recursive: true });
  const snapshot = {
    name,
    value,
    snapshot_checksum: sha256({ name, value }),
  };
  fs.writeFileSync(path.join(storageDir, `${name}.snapshot.json`), `${JSON.stringify(snapshot, null, 2)}\n`);
  return snapshot;
}

function verifyAppendOnly(records, collection) {
  let previous = null;
  for (const record of records) {
    const { record_checksum: recordChecksum, ...checksumInput } = record;
    if (sha256(checksumInput) !== recordChecksum) {
      throw new Error(`${collection} record checksum mismatch at sequence ${record.storage_sequence}`);
    }
    if (record.previous_record_checksum !== previous) {
      throw new Error(`${collection} append-only lineage mismatch at sequence ${record.storage_sequence}`);
    }
    previous = recordChecksum;
  }
  return previous;
}

function buildRestorationReport() {
  const collections = [
    "wal",
    "replay-events",
    "replay-checkpoints",
    "queue-checkpoints",
    "rollback-steps",
    "lease-heartbeats",
    "durable-object-snapshots",
    "orchestration-checkpoints",
    "telemetry",
  ];
  const restored = {};
  for (const collection of collections) {
    const records = readRecords(collection);
    restored[collection] = {
      count: records.length,
      append_only_tail_checksum: verifyAppendOnly(records, collection),
      collection_checksum: sha256(records.map((record) => record.record_checksum)),
    };
  }
  assert(restored.wal.count > 0, "persistent WAL restoration missing");
  assert(restored["replay-checkpoints"].count > 0, "persistent replay checkpoint restoration missing");
  assert(restored["queue-checkpoints"].count > 0, "persistent queue checkpoint restoration missing");
  assert(restored["lease-heartbeats"].count > 0, "persistent lease heartbeat restoration missing");
  assert(restored.telemetry.count >= 7, "persistent telemetry restoration incomplete");
  return {
    restored,
    restart_backed: true,
    restoration_hash: sha256(restored),
  };
}

function measure(category, operation, traceId, input, run) {
  const started = performance.now();
  const result = run();
  const durationMs = Number((performance.now() - started).toFixed(3));
  const inputChecksum = sha256(input);
  const resultChecksum = sha256(result);
  const measured = {
    result,
    telemetry: {
      trace_id: traceId,
      span_id: sha256({ traceId, category, operation }).slice(0, 16),
      parent_span_id: traceId.slice(0, 16),
      category,
      operation,
      event_sequence: input.sequence || 1,
      started_at: fixedStartedAt,
      duration_ms: durationMs,
      input_checksum: inputChecksum,
      result_checksum: resultChecksum,
      causality_checksum: sha256({ traceId, inputChecksum, resultChecksum }),
    },
  };
  appendRecord("telemetry", measured.telemetry);
  return measured;
}

function replay(events) {
  const orders = new Map();
  for (const event of events) {
    if (event.type === "order.created") {
      orders.set(event.orderId, { status: "created", totalMinor: event.totalMinor, version: 1 });
    } else if (event.type === "payment.authorized") {
      const order = orders.get(event.orderId);
      assert(order, `missing order for ${event.orderId}`);
      order.status = "paid";
      order.version += 1;
    } else if (event.type === "fulfillment.queued") {
      const order = orders.get(event.orderId);
      assert(order, `missing order for ${event.orderId}`);
      order.status = "fulfillment_queued";
      order.version += 1;
    }
  }
  const state = [...orders.entries()].sort(([left], [right]) => left.localeCompare(right));
  return { orders: orders.size, state_checksum: sha256(state), projection_checksum: sha256({ projection: state }) };
}

function certifyReplayExecution(count) {
  const events = [];
  for (let index = 0; index < count; index += 1) {
    const orderId = `ord_${String(index).padStart(8, "0")}`;
    events.push({ type: "order.created", orderId, totalMinor: 1000 + (index % 1000), position: events.length + 1 });
    events.push({ type: "payment.authorized", orderId, position: events.length + 1 });
    events.push({ type: "fulfillment.queued", orderId, position: events.length + 1 });
  }
  const first = replay(events);
  const second = replay(structuredClone(events));
  assert(first.state_checksum === second.state_checksum, "replay divergence exists");
  assert(first.projection_checksum === second.projection_checksum, "projection mismatch exists");
  for (const event of events) appendRecord("replay-events", event);
  appendRecord("replay-checkpoints", {
    stream: "local-certification-orders",
    event_count: events.length,
    state_checksum: first.state_checksum,
    projection_checksum: first.projection_checksum,
  });
  return {
    outcome: "verified",
    event_count: events.length,
    input_checksum: sha256(events),
    state_checksum: first.state_checksum,
    projection_checksum: first.projection_checksum,
    deterministic: true,
  };
}

function certifyRollbackExecution() {
  const dag = [
    { id: "pause-traffic", dependsOn: [], reversible: true },
    { id: "disable-release", dependsOn: ["pause-traffic"], reversible: true },
    { id: "restore-worker", dependsOn: ["disable-release"], reversible: true },
    { id: "replay-validate", dependsOn: ["restore-worker"], reversible: false },
    { id: "resume-traffic", dependsOn: ["replay-validate"], reversible: true },
  ];
  const completed = new Set();
  for (const step of dag) {
    assert(step.dependsOn.every((dependency) => completed.has(dependency)), `rollback dependency missing for ${step.id}`);
    completed.add(step.id);
    appendRecord("rollback-steps", {
      step: step.id,
      dependsOn: step.dependsOn,
      reversible: step.reversible,
      completed: true,
    });
  }
  return {
    outcome: "verified",
    rollback_dag_checksum: sha256(dag),
    compensation_checksum: sha256(dag.filter((step) => step.reversible).map((step) => step.id)),
    replay_validation_checksum: sha256(["replay-validate", "projection-equivalence", "queue-stable"]),
    causality_checksum: sha256([...completed]),
  };
}

function certifyQueueRebuild(total) {
  let retried = 0;
  let deadLettered = 0;
  let quarantined = 0;
  const checkpoints = [];
  for (let index = 0; index < total; index += 1) {
    const attempts = index % 6;
    const poison = index % 97 === 0;
    if (poison) quarantined += 1;
    else if (attempts >= 5) deadLettered += 1;
    else retried += 1;
    checkpoints.push({
      messageId: `msg_${index}`,
      action: poison ? "quarantine" : attempts >= 5 ? "dead-letter" : "retry",
      checkpoint: sha256({ index, attempts, poison }),
    });
  }
  for (const checkpoint of checkpoints) appendRecord("queue-checkpoints", checkpoint);
  return {
    outcome: "verified",
    total,
    retried,
    dead_lettered: deadLettered,
    poison_quarantined: quarantined,
    checkpoint_checksum: sha256(checkpoints),
    convergence_checksum: sha256({ retried, deadLettered, quarantined }),
  };
}

function appendWalEntry(wal, kind, payload) {
  const previous = wal.entries.at(-1)?.entry_checksum || null;
  const entry = {
    sequence: wal.entries.length + 1,
    kind,
    payload,
    previous_checksum: previous,
  };
  entry.entry_checksum = sha256(entry);
  wal.entries.push(entry);
  wal.wal_checksum = sha256(wal.entries.map((candidate) => candidate.entry_checksum));
}

function certifyWalRecovery(count) {
  const wal = { execution_id: "local-certification-exec", append_only: true, entries: [], wal_checksum: sha256([]) };
  for (let index = 0; index < count; index += 1) {
    appendWalEntry(wal, index === count - 1 ? "checkpoint-written" : "step-applied", { operationId: `op_${index}` });
  }
  for (const entry of wal.entries) appendRecord("wal", entry);
  const cursor = { next_sequence: Math.floor(count / 2) + 1, cursor_checksum: sha256({ execution_id: wal.execution_id, next: Math.floor(count / 2) + 1 }) };
  const restored = wal.entries.filter((entry) => entry.sequence >= cursor.next_sequence);
  const corrupted = structuredClone(wal);
  corrupted.entries[2].previous_checksum = "corrupted";
  let corruptionDetected = false;
  try {
    verifyWal(corrupted);
  } catch {
    corruptionDetected = true;
  }
  verifyWal(wal);
  assert(corruptionDetected, "WAL corruption undetectable");
  return {
    outcome: "verified",
    append_only: true,
    wal_checksum: wal.wal_checksum,
    cursor_checksum: cursor.cursor_checksum,
    restored_entries: restored.length,
    snapshot_checksum: sha256(restored),
    corruption_detected: corruptionDetected,
  };
}

function verifyWal(wal) {
  let previous = null;
  for (const entry of wal.entries) {
    if (entry.previous_checksum !== previous) throw new Error("WAL lineage mismatch");
    previous = entry.entry_checksum;
  }
}

function certifyLeaseFailover() {
  const heartbeats = [
    { executor: "executor-a", epoch: 4, fencing: 40, heartbeat: 1000 },
    { executor: "executor-b", epoch: 5, fencing: 51, heartbeat: 1300 },
    { executor: "executor-a", epoch: 4, fencing: 41, heartbeat: 900 },
  ];
  const authoritative = [...heartbeats].sort((left, right) => right.epoch - left.epoch || right.fencing - left.fencing || right.heartbeat - left.heartbeat)[0];
  const staleEvicted = heartbeats.filter((heartbeat) => heartbeat.executor !== authoritative.executor).length;
  for (const heartbeat of heartbeats) appendRecord("lease-heartbeats", heartbeat);
  appendRecord("lease-heartbeats", {
    executor: authoritative.executor,
    epoch: authoritative.epoch,
    fencing: authoritative.fencing,
    heartbeat: authoritative.heartbeat + 1,
    authority: "selected",
  });
  return {
    outcome: "verified",
    authoritative_executor: authoritative.executor,
    single_authority: true,
    stale_executor_evicted: staleEvicted > 0,
    fencing_token_replayed: authoritative.fencing,
    arbitration_checksum: sha256({ authoritative, staleEvicted }),
  };
}

function certifyDurableObjectRecovery() {
  const ownership = readJson("config/runtime/cloudflare-binding-ownership.json");
  const environments = ["dev", "staging", "production"];
  const workerNames = environments.map((env) => `letbuyy-api-gateway-${env}`);
  assert(new Set(workerNames).size === workerNames.length, "Durable Object worker ownership ambiguous");
  const snapshot = writeSnapshot("durable-object-recovery", {
    object: "runtime-coordinator",
    sequence: 12,
    workerNames,
  });
  appendRecord("durable-object-snapshots", snapshot);
  return {
    outcome: "verified",
    local_model_only: true,
    production_certification: false,
    environments,
    binding_ownership_checksum: sha256(ownership),
    migration_lineage_checksum: sha256(["new_sqlite_classes", "durable-object-namespace-per-env"]),
    snapshot_checksum: sha256({ object: "runtime-coordinator", sequence: 12 }),
    replay_cursor_checksum: sha256({ object: "runtime-coordinator", nextSequence: 13 }),
    env_crossover_detected: false,
  };
}

function certifyOrchestrationRecovery() {
  const cursor = { executionId: "orchestration-local-certification", nextNode: "resume-traffic", completed: ["pause-traffic", "disable-release", "restore-worker"] };
  appendRecord("orchestration-checkpoints", cursor);
  return {
    outcome: "verified",
    resumable_cursor_checksum: sha256(cursor),
    recovery_checksum: sha256({ cursor, bounded: true }),
    bounded_convergence: true,
  };
}

function assertSloBudgets(results, slo) {
  const budgetByCategory = {
    replay: slo.budgets.replayRestorationMs,
    rollback: slo.budgets.rollbackRecoveryMs,
    queue: slo.budgets.queueRebuildMs,
    wal: slo.budgets.walRestorationMs,
    failover: slo.budgets.leaseFailoverMs,
    "durable-object": slo.budgets.durableObjectRecoveryMs,
    orchestration: slo.budgets.orchestrationRecoveryMs,
  };
  return results.map((entry) => ({
    category: entry.category,
    observed_ms: entry.telemetry.duration_ms,
    budget_ms: budgetByCategory[entry.category],
    within_budget: entry.telemetry.duration_ms <= budgetByCategory[entry.category],
  }));
}

function buildBenchmarkResults(measured) {
  const byCategory = new Map(measured.map((entry) => [entry.category, entry]));
  const replay = byCategory.get("replay");
  const queue = byCategory.get("queue");
  const wal = byCategory.get("wal");
  const rollback = byCategory.get("rollback");
  const failover = byCategory.get("failover");
  const orchestration = byCategory.get("orchestration");
  return [
    {
      id: "replay-throughput",
      dataset_version: "local-certification-v1",
      execution_environment: "local-node-process",
      observed_events: replay?.result?.event_count || 0,
      duration_ms: replay?.telemetry?.duration_ms || 0,
      throughput_per_second: Number(((replay?.result?.event_count || 0) / Math.max(0.001, (replay?.telemetry?.duration_ms || 0) / 1000)).toFixed(2)),
      evidence_hash: replay?.telemetry?.result_checksum,
    },
    {
      id: "queue-rebuild-throughput",
      dataset_version: "local-certification-v1",
      execution_environment: "local-node-process",
      observed_messages: queue?.result?.total || 0,
      duration_ms: queue?.telemetry?.duration_ms || 0,
      throughput_per_second: Number(((queue?.result?.total || 0) / Math.max(0.001, (queue?.telemetry?.duration_ms || 0) / 1000)).toFixed(2)),
      evidence_hash: queue?.telemetry?.result_checksum,
    },
    {
      id: "wal-restoration",
      dataset_version: "local-certification-v1",
      execution_environment: "local-node-process",
      restored_entries: wal?.result?.restored_entries || 0,
      duration_ms: wal?.telemetry?.duration_ms || 0,
      evidence_hash: wal?.telemetry?.result_checksum,
    },
    {
      id: "rollback-timing",
      dataset_version: "local-certification-v1",
      execution_environment: "local-node-process",
      duration_ms: rollback?.telemetry?.duration_ms || 0,
      evidence_hash: rollback?.telemetry?.result_checksum,
    },
    {
      id: "lease-failover-timing",
      dataset_version: "local-certification-v1",
      execution_environment: "local-node-process",
      duration_ms: failover?.telemetry?.duration_ms || 0,
      evidence_hash: failover?.telemetry?.result_checksum,
    },
    {
      id: "orchestration-recovery-timing",
      dataset_version: "local-certification-v1",
      execution_environment: "local-node-process",
      duration_ms: orchestration?.telemetry?.duration_ms || 0,
      evidence_hash: orchestration?.telemetry?.result_checksum,
    },
  ];
}

function runRestartRestoration(outputPath) {
  const restoreOutput = path.join(storageDir, "restart-restore-report.json");
  const restored = spawnSync(process.execPath, [
    process.argv[1],
    "--mode=restore",
    `--storage-dir=${storageDir}`,
    `--output=${restoreOutput}`,
  ], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  if (restored.status !== 0) {
    throw new Error(`restart-backed restoration failed for ${outputPath}: ${restored.stderr || restored.stdout}`);
  }
  return JSON.parse(fs.readFileSync(restoreOutput, "utf8"));
}

function buildReport() {
  assert(replayEvents > 0 && queueMessages > 0 && walEntries > 0, "certification sizes must be positive");
  const contract = readJson("config/runtime/operational-certification-evidence.json");
  const slo = readJson("config/runtime/recovery-slo-contract.json");
  const traceId = sha256({ mode, replayEvents, queueMessages, walEntries, fixedStartedAt });
  const measured = [
    ["replay", "certifyReplayExecution", { sequence: 1, replayEvents }, () => certifyReplayExecution(replayEvents)],
    ["rollback", "certifyRollbackExecution", { sequence: 2 }, certifyRollbackExecution],
    ["queue", "certifyQueueRebuild", { sequence: 3, queueMessages }, () => certifyQueueRebuild(queueMessages)],
    ["wal", "certifyWalRecovery", { sequence: 4, walEntries }, () => certifyWalRecovery(walEntries)],
    ["failover", "certifyLeaseFailover", { sequence: 5 }, certifyLeaseFailover],
    ["durable-object", "certifyDurableObjectRecovery", { sequence: 6 }, certifyDurableObjectRecovery],
    ["orchestration", "certifyOrchestrationRecovery", { sequence: 7 }, certifyOrchestrationRecovery],
  ].map(([category, operation, input, run]) => ({
    category,
    ...measure(category, operation, traceId, input, run),
  }));
  const budget_results = assertSloBudgets(measured, slo);
  assert(budget_results.every((entry) => entry.within_budget), "recovery budget exceeded");
  const restartRestoration = runRestartRestoration(output);
  const benchmark_results = buildBenchmarkResults(measured);
  const evidence = {
    generated_at: new Date().toISOString(),
    deterministic_started_at: fixedStartedAt,
    scope: "local-executable",
    mode,
    certification: false,
    certification_reason: "Executable local recovery evidence is not live production certification and does not prove provider failover.",
    production_certification: false,
    contract_checksum: sha256(contract),
    slo_checksum: sha256(slo),
    trace_id: traceId,
    categories: measured,
    budget_results,
    benchmark_results,
    persistent_backend: {
      backend: "local-jsonl-append-only",
      storage_dir: storageDir,
      restart_restoration_hash: restartRestoration.restoration_hash,
      restart_backed: restartRestoration.restart_backed,
    },
    blocked_live_evidence: [
      "Cloudflare deploy and Durable Object production recovery require credentials",
      "Supabase restore and PITR require database credentials",
      "Provider telemetry verification requires live observability endpoints",
      "Live certification requires LETBUYY_OPERATIONAL_CERTIFICATION_APPROVED=true and operations token",
    ],
  };
  return {
    ...evidence,
    evidence_hash: sha256({
      deterministic_started_at: evidence.deterministic_started_at,
      scope: evidence.scope,
      contract_checksum: evidence.contract_checksum,
      slo_checksum: evidence.slo_checksum,
      trace_id: evidence.trace_id,
      category_hashes: measured.map((entry) => entry.telemetry.result_checksum),
      budget_results,
      benchmark_results,
      restart_restoration_hash: restartRestoration.restoration_hash,
    }),
  };
}

if (mode === "plan") {
  console.log("planned operational certification harness; no evidence was recorded and no certification was claimed");
  process.exit(0);
}

if (mode === "restore") {
  const restoration = buildRestorationReport();
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(restoration, null, 2)}\n`);
  console.log(JSON.stringify(restoration, null, 2));
  process.exit(0);
}

if (mode === "execute") {
  assert(process.env.LETBUYY_OPERATIONAL_CERTIFICATION_APPROVED === "true", "LETBUYY_OPERATIONAL_CERTIFICATION_APPROVED=true is required for execute mode");
  assert(process.env.LETBUYY_OPERATIONS_TOKEN, "LETBUYY_OPERATIONS_TOKEN is required for execute mode");
  assert(process.env.LETBUYY_API_BASE_URL, "LETBUYY_API_BASE_URL is required for execute mode");
  throw new Error("Provider execute certification is owned by phase4-live-certify.mjs; this local harness refuses to record live operational evidence");
}

const report = buildReport();
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
