#!/usr/bin/env node
import fs from "node:fs";

const args = new Set(process.argv.slice(2));
const execute = args.has("--execute");
const environment = valueFor("--environment") || "production";

function valueFor(prefix) {
  const arg = process.argv.slice(2).find((candidate) => candidate.startsWith(`${prefix}=`));
  return arg ? arg.slice(prefix.length + 1) : null;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  return fs.readFileSync(path, "utf8");
}

async function fetchOk(url, options = {}) {
  const response = await fetch(url, options);
  assert(response.ok, `${url} returned ${response.status}`);
  return response;
}

assert(["dev", "staging", "production"].includes(environment), "--environment must be dev, staging, or production");

const topology = JSON.parse(read("config/runtime/production-topology.json"));
const collector = read(topology.observabilityStack.collector);
for (const fragment of [
  "endpoint: 0.0.0.0:4318",
  "endpoint: 0.0.0.0:4317",
  "exporters:",
  "otlp/tempo:",
  "loki:",
  "prometheus:",
  "attributes/redaction:",
]) {
  assert(collector.includes(fragment), `OpenTelemetry collector missing ${fragment}`);
}

const rules = read(topology.observabilityStack.alerts);
for (const alertName of [
  "LetBuyyApiGatewayHighErrorRate",
  "LetBuyyQueueDeadLetterGrowth",
  "LetBuyyReplayLagHigh",
  "LetBuyyDeploymentGateFailed",
  "LetBuyyEventStoreIntegrityFailed",
  "LetBuyyErrorBudgetFreeze",
  "LetBuyyRegionalOverrideActive",
]) {
  assert(rules.includes(`alert: ${alertName}`), `Prometheus rules missing ${alertName}`);
}

for (const dashboardPath of topology.observabilityStack.dashboards) {
  const dashboard = JSON.parse(read(dashboardPath));
  assert(dashboard.title && dashboard.uid, `Grafana dashboard missing title or uid: ${dashboardPath}`);
  assert(Array.isArray(dashboard.panels) && dashboard.panels.length > 0, `Grafana dashboard has no panels: ${dashboardPath}`);
  for (const panel of dashboard.panels) {
    assert(panel.title && panel.type, `Grafana dashboard panel missing title/type: ${dashboardPath}`);
  }
}

if (execute) {
  const prometheusUrl = process.env.PROMETHEUS_URL;
  const grafanaUrl = process.env.GRAFANA_URL;
  const otelCollectorHealthUrl = process.env.OTEL_COLLECTOR_HEALTH_URL;
  assert(prometheusUrl, "Missing PROMETHEUS_URL for --execute");
  assert(grafanaUrl, "Missing GRAFANA_URL for --execute");
  assert(otelCollectorHealthUrl, "Missing OTEL_COLLECTOR_HEALTH_URL for --execute");

  await fetchOk(`${prometheusUrl.replace(/\/$/, "")}/-/ready`);
  await fetchOk(`${prometheusUrl.replace(/\/$/, "")}/api/v1/rules`);
  await fetchOk(`${otelCollectorHealthUrl.replace(/\/$/, "")}`);
  await fetchOk(`${grafanaUrl.replace(/\/$/, "")}/api/health`, {
    headers: process.env.GRAFANA_TOKEN ? { Authorization: `Bearer ${process.env.GRAFANA_TOKEN}` } : {},
  });
}

console.log(`[observability-rollout] ${environment} observability verification passed`);
