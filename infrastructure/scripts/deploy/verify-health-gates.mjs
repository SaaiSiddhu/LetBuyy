#!/usr/bin/env node
import fs from "node:fs";

const args = new Set(process.argv.slice(2));
const environment = valueFor("--environment") || "production";
const preflightOnly = args.has("--preflight");

function valueFor(prefix) {
  const arg = process.argv.slice(2).find((candidate) => candidate.startsWith(`${prefix}=`));
  return arg ? arg.slice(prefix.length + 1) : null;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

const topology = readJson("config/runtime/production-topology.json");
assert(topology.environment === "production", "production topology must target production");

const requiredFiles = [
  topology.queueProvider.terraform,
  topology.queueProvider.producerConfig,
  topology.queueProvider.consumerConfig,
  topology.observabilityStack.collector,
  topology.observabilityStack.alerts,
  "infrastructure/deployment/release-promotion.yaml",
  "infrastructure/deployment/migration-orchestration.yaml",
  "infrastructure/security/production-security-controls.yaml",
];

for (const file of requiredFiles) {
  assert(fs.existsSync(file), `missing health-gate source file: ${file}`);
}

for (const runtime of topology.runtimes) {
  for (const manifest of runtime.deploymentManifests) {
    assert(fs.existsSync(manifest), `runtime ${runtime.runtimeRoot} references missing manifest ${manifest}`);
  }
}

if (preflightOnly) {
  console.log(`[health-gates] preflight passed for ${environment}`);
  process.exit(0);
}

const endpoints = environment === "production"
  ? [
      "https://api.letbuyy.store/v1/health",
      "https://webhooks.letbuyy.store/health",
      "https://accounts.letbuyy.store/",
      "https://letbuyy.store/",
      "https://console.letbuyy.store/",
    ]
  : [
      "https://api.staging.letbuyy.store/v1/health",
      "https://webhooks.staging.letbuyy.store/health",
    ];

for (const endpoint of endpoints) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(endpoint, { signal: controller.signal });
    assert(response.ok, `${endpoint} returned ${response.status}`);
    console.log(`[health-gates] ${endpoint} ${response.status}`);
  } finally {
    clearTimeout(timeout);
  }
}

if (process.env.LETBUYY_OPERATIONS_TOKEN) {
  const apiBase = environment === "production" ? "https://api.letbuyy.store" : "https://api.staging.letbuyy.store";
  const response = await fetch(`${apiBase}/v1/operations/runtime/overview?limit=10`, {
    headers: {
      Authorization: `Bearer ${process.env.LETBUYY_OPERATIONS_TOKEN}`,
      "X-Request-ID": `health-gate-${Date.now()}`,
    },
  });
  assert(response.ok, `operations overview returned ${response.status}`);
  console.log("[health-gates] operations overview reachable");
}
