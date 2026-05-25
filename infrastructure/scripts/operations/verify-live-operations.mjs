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

function apiBase() {
  if (process.env.LETBUYY_API_BASE_URL) return process.env.LETBUYY_API_BASE_URL.replace(/\/$/, "");
  if (environment === "production") return "https://api.letbuyy.store";
  if (environment === "staging") return "https://api.staging.letbuyy.store";
  return "https://api-dev.letbuyy.store";
}

async function getOperations(path) {
  assert(process.env.LETBUYY_OPERATIONS_TOKEN, "Missing LETBUYY_OPERATIONS_TOKEN for live operations verification");
  const response = await fetch(`${apiBase()}/v1/operations${path}`, {
    headers: {
      Authorization: `Bearer ${process.env.LETBUYY_OPERATIONS_TOKEN}`,
      "X-Request-ID": `phase4-live-verify-${Date.now()}`,
    },
  });
  const text = await response.text();
  assert(response.ok, `operations GET ${path} returned ${response.status}: ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : {};
}

assert(["dev", "staging", "production"].includes(environment), "--environment must be dev, staging, or production");

const routeSource = read("services/api-gateway/src/routes/operations.ts");
const dashboardSource = read("apps/platform-console/src/app/(dashboard)/operations/page.tsx");

for (const routeFragment of [
  "/runtime/overview",
  "/runtime/queues/:queueName",
  "/runtime/replays",
  "/runtime/control-commands",
  "/runtime/incidents",
  "/runtime/failover-drills",
  "/runtime/chaos-experiments",
  "/runtime/load-tests",
  "/runtime/deployments",
  "/runtime/readiness-gates",
  "/runtime/deployment-health-gates",
  "/runtime/event-store/integrity",
  "/runtime/event-store/archive",
  "/runtime/dashboards",
  "/runtime/sre/error-budgets",
  "/runtime/security/enforcement-events",
  "/runtime/regional-routing-overrides",
  "/runtime/certification-reports",
]) {
  assert(routeSource.includes(routeFragment), `Operations API is missing live route ${routeFragment}`);
}

for (const dashboardFragment of [
  "PLATFORM_CONSOLE_API_TOKEN",
  "/v1/operations/runtime/overview?limit=30",
  "cache: 'no-store'",
  "Operations API unavailable",
  "Live runtime projections",
  "Operational Certification",
]) {
  assert(dashboardSource.includes(dashboardFragment), `Operations dashboard is missing live data contract: ${dashboardFragment}`);
}

assert(
  !/(mockData|fixtureData|from ['"].*mock|from ['"].*fixture|static sample data)/i.test(dashboardSource),
  "Operations dashboard must not depend on mock or fixture data",
);

if (execute) {
  const overview = await getOperations("/runtime/overview?limit=10");
  const data = overview?.data || {};
  for (const key of [
    "health",
    "queues",
    "incidents",
    "deployments",
    "deployment_health_gates",
    "event_store_integrity",
    "security_events",
    "error_budgets",
    "regional_routing_overrides",
    "alerts",
    "failover_drills",
    "chaos_experiments",
    "load_tests",
    "slos",
    "readiness_gates",
    "dashboards",
    "certification_reports",
  ]) {
    assert(Array.isArray(data[key]), `Operations overview live response is missing array field ${key}`);
  }

  await getOperations("/runtime/replays?limit=10");
  await getOperations("/runtime/event-store/integrity?stream_name=letbuyy-runtime-certification&limit=100");
}

console.log(`[live-operations] ${environment} ${execute ? "execute" : "plan"} operations verification passed`);
