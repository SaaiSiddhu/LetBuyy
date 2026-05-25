#!/usr/bin/env node
const experimentType = valueFor("--type");
const environment = valueFor("--environment") || "staging";
const blastRadius = valueFor("--blast-radius") || "single-runtime";
const status = valueFor("--status") || "planned";
const apiBase = process.env.LETBUYY_API_BASE_URL || (
  environment === "production"
    ? "https://api.letbuyy.store"
    : environment === "staging"
      ? "https://api.staging.letbuyy.store"
      : "https://api-dev.letbuyy.store"
);

const supportedTypes = new Set([
  "queue-outage",
  "provider-outage",
  "replay-corruption",
  "cache-failure",
  "regional-outage",
  "workflow-recovery",
  "dlq-flood",
  "telemetry-outage",
]);

function valueFor(prefix) {
  const arg = process.argv.slice(2).find((candidate) => candidate.startsWith(`${prefix}=`));
  return arg ? arg.slice(prefix.length + 1) : null;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(supportedTypes.has(experimentType), `--type must be one of: ${Array.from(supportedTypes).join(", ")}`);
assert(["dev", "staging", "production"].includes(environment), "--environment must be dev, staging, or production");
assert(process.env.LETBUYY_OPERATIONS_TOKEN, "LETBUYY_OPERATIONS_TOKEN is required");

const experimentId = valueFor("--id") || `${experimentType}-${environment}-${Date.now()}`;
const result = {
  requested_by: "chaos-runner",
  recovery_validation: "operations control-plane must record pass/fail and linked incident when applicable",
  guardrail_source: "infrastructure/security/production-security-controls.yaml",
};

const response = await fetch(`${apiBase}/v1/operations/runtime/chaos-experiments`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.LETBUYY_OPERATIONS_TOKEN}`,
    "Content-Type": "application/json",
    "X-Request-ID": experimentId,
  },
  body: JSON.stringify({
    experiment_id: experimentId,
    experiment_type: experimentType,
    environment,
    blast_radius: blastRadius,
    status,
    guardrails: {
      max_customer_impact: blastRadius === "global-readonly" ? "read-only traffic only" : "bounded blast radius",
      abort_on_sev1: true,
      requires_commander: environment === "production",
    },
    result,
  }),
});

if (!response.ok) {
  const text = await response.text();
  throw new Error(`chaos experiment recording failed: ${response.status} ${text}`);
}

console.log(await response.text());
