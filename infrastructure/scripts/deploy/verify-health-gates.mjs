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
const observability = readJson("config/runtime/observability-platform.json");
assert(topology.environment === "production", "production topology must target production");
assert(["staging", "production"].includes(environment), "--environment must be staging or production");

const requiredFiles = [
  topology.queueProvider.terraform,
  topology.queueProvider.producerConfig,
  topology.queueProvider.consumerConfig,
  "infrastructure/observability/otel-collector.yaml",
  "infrastructure/observability/prometheus-rules.yaml",
  ...(observability.dashboards || []).map((dashboard) => dashboard.path),
  "infrastructure/deployment/release-promotion.yaml",
  "infrastructure/deployment/migration-orchestration.yaml",
  "infrastructure/security/production-security-controls.yaml",
];

for (const file of requiredFiles) {
  assert(fs.existsSync(file), `missing health-gate source file: ${file}`);
}

for (const runtime of topology.runtimes) {
  if (runtime.environment !== "production" || runtime.status !== "active") continue;
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
      "https://api.letbuyy.com/v1/health",
      "https://webhooks.letbuyy.com/health",
      "https://accounts.letbuyy.com/",
      "https://letbuyy.com/",
      "https://console.letbuyy.com/",
    ]
  : environment === "staging"
    ? [
      "https://api.staging.letbuyy.com/v1/health",
      "https://webhooks.staging.letbuyy.com/health",
    ]
    : [
      "https://api.staging.letbuyy.com/v1/health",
      "https://webhooks.staging.letbuyy.com/health",
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
  const apiBase = environment === "production"
    ? "https://api.letbuyy.com"
    : environment === "staging"
      ? "https://api.staging.letbuyy.com"
      : "https://api.staging.letbuyy.com";
  const response = await fetch(`${apiBase}/v1/operations/runtime/overview?limit=10`, {
    headers: {
      Authorization: `Bearer ${process.env.LETBUYY_OPERATIONS_TOKEN}`,
      "X-Request-ID": `health-gate-${Date.now()}`,
    },
  });
  assert(response.ok, `operations overview returned ${response.status}`);
  console.log("[health-gates] operations overview reachable");
}
