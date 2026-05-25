import { setTimeout as delay } from "node:timers/promises";

const scenario = process.env.CHAOS_SCENARIO || "queue-outage";
const durationMs = Number(process.env.CHAOS_DURATION_MS || "60000");
const queueName = process.env.CHAOS_QUEUE_NAME || "letbuyy-events";

if (!Number.isFinite(durationMs) || durationMs < 1000) {
  throw new Error("CHAOS_DURATION_MS must be at least 1000");
}

console.info(JSON.stringify({
  level: "info",
  scenario,
  queue_name: queueName,
  action: "start",
  duration_ms: durationMs,
}));

await delay(durationMs);

console.info(JSON.stringify({
  level: "info",
  scenario,
  queue_name: queueName,
  action: "complete",
  expected_validation: [
    "queue lag alert fires",
    "DLQ redrive remains disabled until operator approval",
    "runtime health projection moves to degraded",
  ],
}));
