#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const environment = valueFor("--environment") || "staging";
const execute = process.argv.includes("--execute");

function valueFor(prefix) {
  const arg = process.argv.slice(2).find((candidate) => candidate.startsWith(`${prefix}=`));
  return arg ? arg.slice(prefix.length + 1) : null;
}

const tests = [
  "infrastructure/scripts/load/k6-checkout-concurrency.js",
  "infrastructure/scripts/load/k6-queue-throughput.js",
  "infrastructure/scripts/load/k6-replay-stress.js",
];

if (!execute) {
  for (const test of tests) console.log(`[load-suite] planned k6 run ${test} for ${environment}`);
  process.exit(0);
}

if (!process.env.LETBUYY_OPERATIONS_TOKEN) {
  throw new Error("LETBUYY_OPERATIONS_TOKEN is required for executable load validation");
}

for (const test of tests) {
  const result = spawnSync("k6", ["run", test], {
    stdio: "inherit",
    env: {
      ...process.env,
      LETBUYY_API_BASE_URL: process.env.LETBUYY_API_BASE_URL || (environment === "production" ? "https://api.letbuyy.store" : "https://api.staging.letbuyy.store"),
    },
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
