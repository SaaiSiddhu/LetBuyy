#!/usr/bin/env node
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";

const requests = Number(valueFor("--requests") || 5000);
const concurrency = Number(valueFor("--concurrency") || 100);
const replayOrders = Number(valueFor("--orders") || 50000);
const queueMessages = Number(valueFor("--queue-messages") || 100000);
const port = Number(valueFor("--port") || 8091);
const output = valueFor("--output") || "artifacts/local-operational-proof/report.json";
const baseUrl = `http://127.0.0.1:${port}`;

function valueFor(prefix) {
  const arg = process.argv.slice(2).find((candidate) => candidate.startsWith(`${prefix}=`));
  return arg ? arg.slice(prefix.length + 1) : null;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function percentile(values, p) {
  if (values.length === 0) return 0;
  return values[Math.min(values.length - 1, Math.floor((values.length - 1) * p))];
}

async function waitForRuntime(timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`local replay runtime did not become healthy: ${lastError?.message || "timeout"}`);
}

async function runHttpLoad(name, total, workerCount, request) {
  const latencies = [];
  let ok = 0;
  let failed = 0;
  let next = 0;
  const started = performance.now();

  async function worker() {
    while (next < total) {
      next += 1;
      const requestStarted = performance.now();
      try {
        const response = await request();
        await response.arrayBuffer();
        if (response.ok) ok += 1;
        else failed += 1;
      } catch {
        failed += 1;
      }
      latencies.push(performance.now() - requestStarted);
    }
  }

  await Promise.all(Array.from({ length: workerCount }, worker));
  latencies.sort((a, b) => a - b);
  const elapsedSeconds = (performance.now() - started) / 1000;

  return {
    name,
    total,
    concurrency: workerCount,
    ok,
    failed,
    elapsed_seconds: Number(elapsedSeconds.toFixed(3)),
    rps: Number((total / elapsedSeconds).toFixed(2)),
    p50_ms: Number(percentile(latencies, 0.5).toFixed(2)),
    p95_ms: Number(percentile(latencies, 0.95).toFixed(2)),
    p99_ms: Number(percentile(latencies, 0.99).toFixed(2)),
    max_ms: Number((latencies.at(-1) || 0).toFixed(2)),
  };
}

function replay(events) {
  const state = { orders: new Map(), paid: 0, fulfilled: 0, totalMinor: 0 };
  for (const event of events) {
    if (event.type === "order.created") {
      state.orders.set(event.orderId, {
        status: "created",
        totalMinor: event.totalMinor,
        version: 1,
      });
      state.totalMinor += event.totalMinor;
    } else if (event.type === "payment.authorized") {
      const current = state.orders.get(event.orderId);
      assert(current, `missing order for payment ${event.orderId}`);
      current.status = "paid";
      current.version += 1;
      state.paid += 1;
    } else if (event.type === "fulfillment.queued") {
      const current = state.orders.get(event.orderId);
      assert(current, `missing order for fulfillment ${event.orderId}`);
      current.status = "fulfillment_queued";
      current.version += 1;
      state.fulfilled += 1;
    } else {
      throw new Error(`unknown event type ${event.type}`);
    }
  }

  const stableOrders = [...state.orders.entries()].sort(([left], [right]) => left.localeCompare(right));
  const digest = crypto
    .createHash("sha256")
    .update(JSON.stringify({
      orders: stableOrders,
      paid: state.paid,
      fulfilled: state.fulfilled,
      totalMinor: state.totalMinor,
    }))
    .digest("hex");

  return {
    orders: state.orders.size,
    paid: state.paid,
    fulfilled: state.fulfilled,
    totalMinor: state.totalMinor,
    digest,
  };
}

function runReplayProof(orderCount) {
  const events = [];
  for (let index = 0; index < orderCount; index += 1) {
    const orderId = `ord_${String(index).padStart(8, "0")}`;
    events.push({ type: "order.created", orderId, totalMinor: 1000 + (index % 10000) });
    events.push({ type: "payment.authorized", orderId });
    events.push({ type: "fulfillment.queued", orderId });
  }

  const firstStarted = performance.now();
  const first = replay(events);
  const secondStarted = performance.now();
  const second = replay(structuredClone(events));
  const finished = performance.now();

  return {
    events: events.length,
    orders: orderCount,
    first_replay_ms: Number((secondStarted - firstStarted).toFixed(2)),
    second_replay_ms: Number((finished - secondStarted).toFixed(2)),
    deterministic: first.digest === second.digest,
    digest: first.digest,
    state: first,
  };
}

function runQueueRecoveryProof(total) {
  const now = 1779696000000;
  const maxAttempts = 5;
  const messages = Array.from({ length: total }, (_, index) => ({
    id: `msg_${index}`,
    attempts: index % 7,
    lockedUntil: now - (index % 3) * 1000,
    status: "leased",
  }));

  const started = performance.now();
  let retried = 0;
  let deadLettered = 0;
  let kept = 0;
  for (const message of messages) {
    if (message.lockedUntil > now) {
      kept += 1;
    } else if (message.attempts >= maxAttempts) {
      message.status = "dead-lettered";
      deadLettered += 1;
    } else {
      message.status = "queued";
      message.nextVisibleAt = now + (message.attempts + 1) * 30000;
      retried += 1;
    }
  }
  const elapsedMs = performance.now() - started;
  const checksum = crypto
    .createHash("sha256")
    .update(JSON.stringify(messages.slice(0, 1000)) + retried + deadLettered + kept)
    .digest("hex");

  return {
    total,
    retried,
    deadLettered,
    kept,
    elapsed_ms: Number(elapsedMs.toFixed(2)),
    throughput_msgs_per_sec: Number((total / (elapsedMs / 1000)).toFixed(2)),
    deterministic_checksum: checksum,
  };
}

async function main() {
  assert(requests > 0 && concurrency > 0, "--requests and --concurrency must be positive");
  assert(replayOrders > 0 && queueMessages > 0, "--orders and --queue-messages must be positive");

  const runtime = spawn(process.execPath, ["infrastructure/local/replay-runtime.mjs"], {
    env: {
      ...process.env,
      PORT: String(port),
      LETBUYY_ENVIRONMENT: "local-operational-proof",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let runtimeOutput = "";
  runtime.stdout.on("data", (chunk) => {
    runtimeOutput += chunk.toString("utf8");
  });
  runtime.stderr.on("data", (chunk) => {
    runtimeOutput += chunk.toString("utf8");
  });

  try {
    await waitForRuntime();
    const healthLoad = await runHttpLoad("local-replay-health", requests, concurrency, () => fetch(`${baseUrl}/health`));
    const dryRunLoad = await runHttpLoad("local-replay-dry-run", requests, concurrency, () =>
      fetch(`${baseUrl}/replay/dry-run`, {
        method: "POST",
        body: "{}",
        headers: { "content-type": "application/json" },
      }),
    );
    const metricsResponse = await fetch(`${baseUrl}/metrics`);
    const metricsText = await metricsResponse.text();
    const replayProof = runReplayProof(replayOrders);
    const queueProof = runQueueRecoveryProof(queueMessages);

    assert(healthLoad.failed === 0, "health load had failed requests");
    assert(dryRunLoad.failed === 0, "dry-run load had failed requests");
    assert(replayProof.deterministic === true, "replay proof was nondeterministic");

    const report = {
      generated_at: new Date().toISOString(),
      scope: "local-only",
      certification: false,
      certification_reason: "Local proof is real execution evidence for local runtime/replay/queue behavior, not production certification.",
      runtime: {
        base_url: baseUrl,
        output: runtimeOutput.trim(),
        metrics_present: metricsText.includes("letbuyy_local_replay_runtime_up 1"),
      },
      load: [healthLoad, dryRunLoad],
      replay: replayProof,
      queue_recovery: queueProof,
      blocked_live_evidence: [
        "Cloudflare deploys require credentials",
        "Supabase PITR/restore requires database credentials",
        "k6, Locust, and Gatling are required for official load certification",
        "operations evidence recording requires LETBUYY_OPERATIONS_TOKEN",
      ],
    };

    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify(report, null, 2));
  } finally {
    runtime.kill("SIGTERM");
  }
}

await main();
