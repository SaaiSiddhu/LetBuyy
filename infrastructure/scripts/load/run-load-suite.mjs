#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const environment = valueFor("--environment") || "staging";
const execute = process.argv.includes("--execute");

function valueFor(prefix) {
  const arg = process.argv.slice(2).find((candidate) => candidate.startsWith(`${prefix}=`));
  return arg ? arg.slice(prefix.length + 1) : null;
}

const tests = [
  {
    tool: "k6",
    command: "k6",
    args: ["run", "infrastructure/scripts/load/k6-checkout-concurrency.js"],
  },
  {
    tool: "k6",
    command: "k6",
    args: ["run", "infrastructure/scripts/load/k6-queue-throughput.js"],
  },
  {
    tool: "k6",
    command: "k6",
    args: ["run", "infrastructure/scripts/load/k6-replay-stress.js"],
  },
  {
    tool: "locust",
    command: "locust",
    args: [
      "--headless",
      "-f",
      "infrastructure/scripts/load/locust-checkout-concurrency.py",
      "-u",
      "100",
      "-r",
      "10",
      "-t",
      "1m",
    ],
  },
  {
    tool: "gatling",
    command: "gatling",
    args: [
      "-s",
      "CheckoutConcurrencySimulation",
      "-sf",
      "infrastructure/scripts/load/gatling",
      "-rf",
      "artifacts/live-certification/gatling",
    ],
  },
];

if (!execute) {
  for (const test of tests) console.log(`[load-suite] planned ${test.tool} ${test.args.join(" ")} for ${environment}`);
  process.exit(0);
}

if (!process.env.LETBUYY_OPERATIONS_TOKEN) {
  throw new Error("LETBUYY_OPERATIONS_TOKEN is required for executable load validation");
}

for (const test of tests) {
  const toolCheck = spawnSync("bash", ["-lc", `command -v ${test.command}`], { stdio: "ignore" });
  if (toolCheck.status !== 0) {
    throw new Error(`${test.tool} is required for executable load validation`);
  }

  const result = spawnSync(test.command, test.args, {
    stdio: "inherit",
    env: {
      ...process.env,
      LETBUYY_API_BASE_URL: process.env.LETBUYY_API_BASE_URL || (environment === "production" ? "https://api.letbuyy.store" : "https://api.staging.letbuyy.store"),
    },
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
