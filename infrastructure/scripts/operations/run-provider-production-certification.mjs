#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { performance } from "node:perf_hooks";

const args = new Set(process.argv.slice(2));
const modeArg = valueFor("--mode") || (args.has("--execute") ? "execute" : "auto");
const environment = valueFor("--environment") || "production";
const output = valueFor("--output") || `artifacts/provider-evidence/${environment}/provider-execution-report.json`;
const artifactDir = valueFor("--artifact-dir") || path.dirname(output);
const version = valueFor("--version") || process.env.GITHUB_SHA || `local-${Date.now()}`;
const traceId = sha256({ version, environment, started_at: "provider-production-certification" });

const capabilityGroups = [
  {
    name: "operator-approval",
    env: ["LETBUYY_PROVIDER_CERTIFICATION_APPROVED"],
    validator: () => process.env.LETBUYY_PROVIDER_CERTIFICATION_APPROVED === "true",
  },
  {
    name: "provider-mutation-approval",
    env: ["LETBUYY_PROVIDER_MUTATION_APPROVED"],
    validator: () => process.env.LETBUYY_PROVIDER_MUTATION_APPROVED === "true",
  },
  {
    name: "node-runtime",
    validator: () => Number(process.versions.node.split(".")[0]) >= 22,
    details: `current=${process.versions.node} required>=22.0.0`,
  },
  {
    name: "cloudflare",
    env: ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"],
    tools: ["pnpm"],
  },
  {
    name: "supabase",
    envAny: [["SUPABASE_DB_URL", "DATABASE_URL"]],
    tools: ["psql"],
  },
  {
    name: "telemetry",
    env: ["OTEL_COLLECTOR_HEALTH_URL"],
    tools: ["curl"],
  },
  {
    name: "operations-api",
    env: ["LETBUYY_OPERATIONS_TOKEN"],
  },
  {
    name: "governed-package-runtime",
    tools: ["pnpm"],
  },
];

function valueFor(prefix) {
  const arg = process.argv.slice(2).find((candidate) => candidate.startsWith(`${prefix}=`));
  return arg ? arg.slice(prefix.length + 1) : null;
}

function sha256(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
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
    const validatorReady = group.validator ? group.validator() : true;
    return {
      name: group.name,
      ready: missingEnv.length === 0 && missingTools.length === 0 && validatorReady,
      missingEnv,
      missingTools,
      details: group.details || null,
      approval: validatorReady ? "ok" : "not-approved-or-runtime-incompatible",
    };
  });
}

function redactedArgs(commandArgs) {
  const secretValues = [
    "CLOUDFLARE_API_TOKEN",
    "SUPABASE_DB_URL",
    "DATABASE_URL",
    "LETBUYY_OPERATIONS_TOKEN",
  ].map((name) => process.env[name]).filter(Boolean);
  return commandArgs.map((arg) => secretValues.some((secret) => arg.includes(secret)) ? "__REDACTED__" : arg);
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function runCommandStep(id, command, commandArgs, options = {}) {
  const started = performance.now();
  const result = spawnSync(command, commandArgs, {
    cwd: process.cwd(),
    encoding: "utf8",
    env: { ...process.env, ...(options.env || {}) },
  });
  const durationMs = Number((performance.now() - started).toFixed(3));
  const stdoutFile = path.join(artifactDir, `${id}.stdout.txt`);
  const stderrFile = path.join(artifactDir, `${id}.stderr.txt`);
  fs.mkdirSync(artifactDir, { recursive: true });
  fs.writeFileSync(stdoutFile, result.stdout || "");
  fs.writeFileSync(stderrFile, result.stderr || "");
  const evidence = {
    id,
    provider: options.provider || "local-command",
    environment,
    command,
    args: redactedArgs(commandArgs),
    exit_status: result.status,
    duration_ms: durationMs,
    stdout_hash: sha256(result.stdout || ""),
    stderr_hash: sha256(result.stderr || ""),
    artifact_hash: sha256({ stdout: result.stdout || "", stderr: result.stderr || "", status: result.status }),
    trace_id: traceId,
  };
  writeJson(path.join(artifactDir, `${id}.evidence.json`), evidence);
  assert(result.status === 0, `${id} failed with status ${result.status}`);
  return evidence;
}

function plannedProviderSteps() {
  return [
    "pnpm --dir services/api-gateway exec wrangler whoami",
    "phase4-live-certify execute with provider mutation approval",
    "Supabase certification verification SQL via psql",
    "OpenTelemetry collector health and trace ingestion verification",
    "provider-backed replay, rollback, queue rebuild, WAL restoration, failover, partition, and recovery drill evidence archival",
  ];
}

assert(["auto", "plan", "execute"].includes(modeArg), "--mode must be auto, plan, or execute");
assert(["dev", "staging", "production"].includes(environment), "--environment must be dev, staging, or production");

const capabilities = evaluateCapabilities();
const executeReady = capabilities.every((capability) => capability.ready);
const mode = modeArg === "auto" ? (executeReady ? "execute" : "plan") : modeArg;

if (modeArg === "execute" && !executeReady) {
  const missing = capabilities
    .filter((capability) => !capability.ready)
    .map((capability) => `${capability.name}: env=[${capability.missingEnv.join(",") || "ok"}] tools=[${capability.missingTools.join(",") || "ok"}] approval=${capability.approval}${capability.details ? ` ${capability.details}` : ""}`)
    .join("; ");
  throw new Error(`Cannot run provider-backed production certification in execute mode. Missing capabilities: ${missing}`);
}

if (mode !== "execute") {
  const report = {
    generated_at: new Date().toISOString(),
    environment,
    version,
    mode,
    certification: false,
    provider_certification: false,
    certification_reason: "Provider-backed production certification was not executed. This report is a credential-gated execution plan only.",
    capability_summary: capabilities,
    planned_provider_steps: plannedProviderSteps(),
    blocked_live_evidence: capabilities.filter((capability) => !capability.ready).map((capability) => capability.name),
    trace_id: traceId,
    evidence_hash: sha256({ environment, version, mode, capabilities, steps: plannedProviderSteps() }),
  };
  writeJson(output, report);
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

const evidence = [];
evidence.push(runCommandStep("cloudflare-whoami", "pnpm", ["--dir", "services/api-gateway", "exec", "wrangler", "whoami"], { provider: "cloudflare" }));
evidence.push(runCommandStep("phase4-live-certify", process.execPath, [
  "infrastructure/scripts/operations/phase4-live-certify.mjs",
  `--environment=${environment}`,
  "--mode=execute",
  `--version=${version}`,
  `--report-output=${path.join(artifactDir, "phase4-live-report.json")}`,
], { provider: "letbuyy-operations" }));
evidence.push(runCommandStep("supabase-certification-verify", "psql", [
  process.env.SUPABASE_DB_URL || process.env.DATABASE_URL,
  "-f",
  "database/supabase/verification/064_live_production_certification.sql",
], { provider: "supabase" }));
evidence.push(runCommandStep("otel-health", "curl", ["-fsS", process.env.OTEL_COLLECTOR_HEALTH_URL], { provider: "observability" }));

const report = {
  generated_at: new Date().toISOString(),
  environment,
  version,
  mode,
  certification: true,
  provider_certification: true,
  trace_id: traceId,
  evidence,
  evidence_hash: sha256(evidence.map((entry) => entry.artifact_hash)),
};
writeJson(output, report);
console.log(JSON.stringify(report, null, 2));
