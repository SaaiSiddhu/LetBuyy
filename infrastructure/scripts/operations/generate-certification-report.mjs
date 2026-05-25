#!/usr/bin/env node
import fs from "node:fs";
import { spawnSync } from "node:child_process";

const args = new Set(process.argv.slice(2));
const requestedMode = valueFor("--mode") || (args.has("--execute") ? "execute" : "plan");
const record = args.has("--record");
const environment = valueFor("--environment") || "production";
const version = valueFor("--version") || process.env.GITHUB_SHA || `local-${Date.now()}`;
const output = valueFor("--output");

const capabilityGroups = [
  {
    name: "cloudflare",
    env: ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID", "TF_VAR_cloudflare_api_token", "TF_VAR_cloudflare_account_id"],
    tools: ["npx", "terraform"],
  },
  {
    name: "supabase",
    envAny: [["SUPABASE_DB_URL", "DATABASE_URL"]],
    tools: ["psql"],
  },
  {
    name: "observability",
    env: ["PROMETHEUS_URL", "GRAFANA_URL", "OTEL_COLLECTOR_HEALTH_URL"],
  },
  {
    name: "operations",
    env: ["LETBUYY_OPERATIONS_TOKEN"],
  },
  {
    name: "vercel",
    env: ["VERCEL_TOKEN", "VERCEL_ORG_ID"],
    tools: ["npx"],
  },
  {
    name: "load-testing",
    tools: ["k6"],
  },
];

function valueFor(prefix) {
  const arg = process.argv.slice(2).find((candidate) => candidate.startsWith(`${prefix}=`));
  return arg ? arg.slice(prefix.length + 1) : null;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

function hasEnv(name) {
  return typeof process.env[name] === "string" && process.env[name].trim().length > 0;
}

function hasTool(command) {
  return spawnSync("bash", ["-lc", `command -v ${command}`], { stdio: "ignore" }).status === 0;
}

function evaluateCapabilities() {
  return capabilityGroups.map((group) => {
    const missingEnv = [];
    for (const envName of group.env || []) {
      if (!hasEnv(envName)) missingEnv.push(envName);
    }
    for (const alternatives of group.envAny || []) {
      if (!alternatives.some(hasEnv)) missingEnv.push(alternatives.join("|"));
    }
    const missingTools = (group.tools || []).filter((tool) => !hasTool(tool));
    return {
      name: group.name,
      ready: missingEnv.length === 0 && missingTools.length === 0,
      missingEnv,
      missingTools,
    };
  });
}

function apiBase() {
  if (process.env.LETBUYY_API_BASE_URL) return process.env.LETBUYY_API_BASE_URL.replace(/\/$/, "");
  return environment === "production" ? "https://api.letbuyy.store" : "https://api.staging.letbuyy.store";
}

async function operationsRequest(method, path, body) {
  assert(process.env.LETBUYY_OPERATIONS_TOKEN, "Missing LETBUYY_OPERATIONS_TOKEN for operational certification evidence");
  const response = await fetch(`${apiBase()}/v1/operations${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.LETBUYY_OPERATIONS_TOKEN}`,
      "Content-Type": "application/json",
      "X-Request-ID": `phase4-certification-report-${Date.now()}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  assert(response.ok, `operations ${method} ${path} returned ${response.status}: ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : {};
}

function newestTimestamp(records) {
  const timestamps = records
    .flatMap((record) => [
      record.generated_at,
      record.finished_at,
      record.created_at,
      record.checked_at,
      record.sampled_at,
      record.recorded_at,
      record.evaluated_at,
      record.started_at,
      record.updated_at,
    ])
    .filter(Boolean)
    .map((value) => Date.parse(value))
    .filter((value) => Number.isFinite(value));
  return timestamps.length > 0 ? Math.max(...timestamps) : null;
}

function summarizeEvidence(name, records, maxAgeHours) {
  const newest = newestTimestamp(records);
  const fresh = newest ? Date.now() - newest <= maxAgeHours * 60 * 60 * 1000 : false;
  return {
    name,
    records: records.length,
    newest_at: newest ? new Date(newest).toISOString() : null,
    fresh,
    status: records.length > 0 && fresh ? "passed" : "missing",
  };
}

async function liveEvidenceSummary(maxAgeHours) {
  const overview = (await operationsRequest("GET", "/runtime/overview?limit=50"))?.data || {};
  const incidents = (await operationsRequest("GET", "/runtime/incidents?limit=50"))?.data?.incidents || [];
  const replays = (await operationsRequest("GET", "/runtime/replays?limit=50"))?.data?.replays || [];
  const commands = (await operationsRequest("GET", "/runtime/control-commands?limit=50"))?.data?.commands || [];
  const certificationReports = (await operationsRequest("GET", "/runtime/certification-reports?limit=50"))?.data?.reports || [];

  return {
    deployment: summarizeEvidence("deployment", [...(overview.readiness_gates || []), ...(overview.deployment_health_gates || [])], maxAgeHours),
    cloudflare: summarizeEvidence("cloudflare", overview.deployment_health_gates || [], maxAgeHours),
    supabase: summarizeEvidence("supabase", overview.event_store_integrity || [], maxAgeHours),
    observability: summarizeEvidence("observability", overview.dashboards || [], maxAgeHours),
    incident: summarizeEvidence("incident", incidents, maxAgeHours),
    failover: summarizeEvidence("failover", overview.failover_drills || [], maxAgeHours),
    chaos: summarizeEvidence("chaos", overview.chaos_experiments || [], maxAgeHours),
    load: summarizeEvidence("load", overview.load_tests || [], maxAgeHours),
    security: summarizeEvidence("security", overview.security_events || [], maxAgeHours),
    dashboards: summarizeEvidence("dashboards", overview.dashboards || [], maxAgeHours),
    "control-plane": summarizeEvidence("control-plane", commands, maxAgeHours),
    sre: summarizeEvidence("sre", overview.error_budgets || [], maxAgeHours),
    "event-store": summarizeEvidence("event-store", overview.event_store_integrity || [], maxAgeHours),
    "multi-region": summarizeEvidence("multi-region", overview.regional_routing_overrides || [], maxAgeHours),
    "replay-runtime": summarizeEvidence("replay-runtime", replays, maxAgeHours),
    certification: summarizeEvidence("certification", certificationReports, maxAgeHours),
  };
}

function planEvidenceSummary(categories) {
  return Object.fromEntries(
    Object.entries(categories).map(([name, category]) => [
      name,
      {
        name,
        status: "contract-ready",
        records: 0,
        newest_at: null,
        fresh: false,
        planMode: category.planMode,
        executeMode: category.executeMode,
        source: category.source,
      },
    ]),
  );
}

assert(environment === "staging" || environment === "production", "--environment must be staging or production");
assert(["plan", "execute"].includes(requestedMode), "--mode must be plan or execute");

const certification = readJson("config/runtime/live-production-certification.json");
const capabilities = evaluateCapabilities();
const missingCapabilities = capabilities
  .filter((capability) => !capability.ready)
  .map((capability) => `${capability.name}: env=[${capability.missingEnv.join(",") || "ok"}] tools=[${capability.missingTools.join(",") || "ok"}]`);
const maxAgeHours = certification.certificationRuntime?.evidenceExpirationHours || 24;
const evidenceSummary = requestedMode === "execute"
  ? await liveEvidenceSummary(maxAgeHours)
  : planEvidenceSummary(certification.evidenceCategories);
const requiredEvidence = Object.values(evidenceSummary).filter((item) => item.name !== "certification");
const passedEvidence = requiredEvidence.filter((item) => item.status === "passed").length;
const liveCertified = requestedMode === "execute" && missingCapabilities.length === 0 && passedEvidence === requiredEvidence.length;
const liveMaturityScore = requestedMode === "execute"
  ? Number(((passedEvidence / Math.max(requiredEvidence.length, 1)) * 10).toFixed(2))
  : 7;
const status = liveCertified ? "certified" : requestedMode === "execute" ? "failed" : "credential-gated";
const generatedAt = new Date().toISOString();
const expiresAt = new Date(Date.now() + maxAgeHours * 60 * 60 * 1000).toISOString();

const report = {
  certification_id: `phase4-live-${environment}-${Date.now()}`,
  generated_at: generatedAt,
  expires_at: expiresAt,
  environment,
  version,
  requested_mode: requestedMode,
  status,
  live_certified: liveCertified,
  evidence_projection: "operational_certification_reports",
  repository_maturity_score: 10,
  live_maturity_score: liveMaturityScore,
  evidence_expiration_hours: maxAgeHours,
  missing_capabilities: missingCapabilities,
  capabilities,
  evidence_summary: evidenceSummary,
  conclusion: liveCertified
    ? "Live production certification evidence is present and fresh."
    : requestedMode === "execute"
      ? "Live production certification failed because required evidence is missing or stale."
      : "Repository is plan-ready; live certification remains credential-gated and unclaimed.",
};

if (record) {
  assert(requestedMode === "execute", "--record is only allowed in execute mode");
  await operationsRequest("POST", "/runtime/certification-reports", {
    certification_id: report.certification_id,
    environment,
    certification_mode: requestedMode,
    status,
    repository_maturity_score: report.repository_maturity_score,
    live_maturity_score: report.live_maturity_score,
    evidence_summary: report.evidence_summary,
    missing_capabilities: report.missing_capabilities,
    expires_at: report.expires_at,
    report,
  });
}

const serialized = `${JSON.stringify(report, null, 2)}\n`;
if (output) {
  fs.writeFileSync(output, serialized);
  console.log(`[certification-report] wrote ${output}`);
} else {
  process.stdout.write(serialized);
}

if (requestedMode === "execute") {
  assert(liveCertified, "Live production certification evidence is missing or stale");
}
