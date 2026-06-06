import { createReporter, readFile, readJson } from "./governance-common.mjs";

const reporter = createReporter("Observability producer validator");

const apiMiddleware = readFile("services/api-gateway/src/middleware/observability.ts");
const apiIndex = readFile("services/api-gateway/src/index.ts");
const queueWorker = readFile("services/queue-workers/src/index.ts");
const runtimeDashboard = readFile("infrastructure/observability/grafana-runtime-dashboard.json");
const queueDashboard = readFile("infrastructure/observability/grafana-queue-dashboard.json");
const replayDashboard = readFile("infrastructure/observability/grafana-replay-dashboard.json");
const sreDashboard = readFile("infrastructure/observability/grafana-sre-dashboard.json");
const runtimeGovernance = readFile("docs/governance/runtime-observability-governance.md");
const observabilityGovernance = readFile("docs/governance/observability-infrastructure-governance.md");
const observabilityContract = readJson("config/runtime/observability-platform.json");

for (const fragment of [
  "writeRuntimeTelemetryDataPoint(c.env.RUNTIME_TELEMETRY",
  "metricName: 'letbuyy.runtime.request'",
  "recordRuntimeMetric({",
  "metricName: 'letbuyy.runtime.request'",
]) {
  reporter.assert(apiMiddleware.includes(fragment), `API Gateway request telemetry producer missing ${fragment}`);
}

for (const fragment of [
  "function readReplayLagSnapshot",
  ".from('replay_operation_schedules')",
  "recordScheduledReplayLagMetric(env, db, dispatcherId)",
  "metricName: 'letbuyy.replay.lag.seconds'",
  "writeRuntimeTelemetryDataPoint(env.RUNTIME_TELEMETRY",
]) {
  reporter.assert(apiIndex.includes(fragment), `API Gateway replay-lag telemetry producer missing ${fragment}`);
}

for (const fragment of [
  "RUNTIME_TELEMETRY?: RuntimeTelemetryDatasetBinding",
  "metric_name: 'letbuyy.queue.delivery.batch'",
  "metric_name: 'letbuyy.queue.dead_letter.total'",
  "metricName: 'letbuyy.queue.delivery.batch'",
  "metricName: 'letbuyy.queue.dead_letter.total'",
  "writeRuntimeTelemetryDataPoint(env.RUNTIME_TELEMETRY",
]) {
  reporter.assert(queueWorker.includes(fragment), `Queue Workers telemetry producer missing ${fragment}`);
}

for (const [name, dashboard] of Object.entries({
  runtimeDashboard,
  queueDashboard,
  replayDashboard,
  sreDashboard,
})) {
  reporter.assert(dashboard.includes("runtime_telemetry_metrics") || dashboard.includes("sre_error_budget_snapshots"), `${name} must use emitted operational projections`);
  reporter.assert(!dashboard.includes("mockData") && !dashboard.includes("fixtureData"), `${name} must not use mock dashboard data`);
}

for (const metricName of [
  "letbuyy.runtime.request",
  "letbuyy.queue.delivery.batch",
  "letbuyy.queue.dead_letter.total",
  "letbuyy.replay.lag.seconds",
]) {
  reporter.assert(runtimeDashboard.includes(metricName) || queueDashboard.includes(metricName) || replayDashboard.includes(metricName), `Runtime dashboards missing emitted metric ${metricName}`);
  reporter.assert(runtimeGovernance.includes(metricName), `Runtime observability governance missing emitted metric ${metricName}`);
}

reporter.assert(
  observabilityGovernance.includes("Cloudflare Workers Analytics Engine") && observabilityGovernance.includes("runtime_telemetry_metrics"),
  "Observability governance must name the live runtime telemetry producer surfaces",
);

for (const dashboard of observabilityContract?.dashboards || []) {
  reporter.assert(dashboard.mustUseLiveTelemetry === true, `Observability dashboard must require live telemetry: ${dashboard.name}`);
}

reporter.finish("request, queue-DLQ, replay-lag telemetry producers checked");
