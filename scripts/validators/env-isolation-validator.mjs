import {
  createReporter,
  readFile,
  readJson,
} from "./governance-common.mjs";

const reporter = createReporter("Environment isolation validator");

const lifecycle = readJson("config/runtime/environment-lifecycle.json");
reporter.assert(
  JSON.stringify(lifecycle?.promotionOrder) === JSON.stringify(["local", "development", "staging", "production"]),
  "Environment lifecycle must preserve local -> development -> staging -> production promotion order",
);

for (const resource of [
  "secrets",
  "databases",
  "queues",
  "event stores",
  "replay checkpoints",
  "telemetry backends",
  "provider accounts",
  "deployment credentials",
]) {
  reporter.assert(lifecycle?.isolationRules?.mustSeparate?.includes(resource), `Environment lifecycle must separate ${resource}`);
}

const environments = new Map((lifecycle?.environments || []).map((environment) => [environment.name, environment]));
for (const name of ["local", "development", "staging", "production"]) {
  reporter.assert(environments.has(name), `Environment lifecycle missing ${name}`);
}

const local = environments.get("local");
reporter.assert(local?.evidence?.certifiableAsLive === false, "Local environment must never be certifiable as live");
reporter.assert(local?.providers?.sideEffectPolicy === "sandbox-only", "Local environment must be sandbox-only");

const production = environments.get("production");
reporter.assert(production?.evidence?.certifiableAsLive === true, "Production environment must require live evidence before certification");
reporter.assert(production?.providers?.sideEffectPolicy === "governed-live-only-after-execute-mode", "Production providers must be execute-mode gated");

for (const file of [
  "services/api-gateway/wrangler.toml",
  "services/webhook-service/wrangler.toml",
  "services/queue-workers/wrangler.toml",
]) {
  const text = readFile(file);
  for (const environment of ["dev", "staging", "production"]) {
    reporter.assert(text.includes(`[env.${environment}.vars]`), `${file}: Cloudflare ${environment} vars must be explicit`);
    reporter.assert(text.includes(`[env.${environment}.placement]`), `${file}: Cloudflare ${environment} placement must be explicit`);
    reporter.assert(text.includes(`[env.${environment}.observability]`), `${file}: Cloudflare ${environment} telemetry config must be explicit`);
  }

  const topLevel = text.split(/\n\[env\.dev\]/)[0] ?? "";
  for (const forbiddenProductionResource of [
    'queue = "letbuyy-events-production"',
    'queue = "letbuyy-analytics-queue-production"',
    'queue = "letbuyy-search-queue-production"',
    'queue = "letbuyy-notifications-queue-production"',
    'queue = "letbuyy-dead-letters-production"',
    'queue = "letbuyy-production-queue"',
    'queue = "letbuyy-production-dead-letter-queue"',
    'bucket_name = "letbuyy-media-production"',
  ]) {
    reporter.assert(!topLevel.includes(forbiddenProductionResource), `${file}: local/top-level config must not bind ${forbiddenProductionResource}`);
  }
}

reporter.finish("Environment lifecycle and Cloudflare non-production isolation gates checked");
