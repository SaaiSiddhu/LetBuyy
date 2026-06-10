import {
  createReporter,
  readFile,
  readJson,
} from "./governance-common.mjs";

const reporter = createReporter("Environment isolation validator");

const lifecycle = readJson("config/runtime/environment-lifecycle.json");
reporter.assert(
  JSON.stringify(lifecycle?.promotionOrder) === JSON.stringify(["staging", "production"]),
  "Environment lifecycle must preserve staging -> production promotion order",
);

for (const resource of [
  "secrets",
  "databases",
  "queues",
  "telemetry backends",
  "provider accounts",
  "deployment credentials",
]) {
  reporter.assert(lifecycle?.isolationRules?.mustSeparate?.includes(resource), `Environment lifecycle must separate ${resource}`);
}

const environments = new Map((lifecycle?.environments || []).map((environment) => [environment.name, environment]));
for (const name of ["staging", "production"]) {
  reporter.assert(environments.has(name), `Environment lifecycle missing ${name}`);
}

const staging = environments.get("staging");
reporter.assert(staging?.evidence?.certifiableAsLive === false, "Staging environment must not be certifiable as live production");
reporter.assert(staging?.providers?.sideEffectPolicy === "no production mutation", "Staging environment must not mutate production providers");

const production = environments.get("production");
reporter.assert(production?.evidence?.certifiableAsLive === true, "Production environment must require live evidence before certification");
reporter.assert(production?.providers?.sideEffectPolicy === "governed-live-only-after-execute-mode", "Production providers must be execute-mode gated");

for (const file of [
  "services/api-gateway/wrangler.toml",
  "services/webhook-service/wrangler.toml",
  "services/queue-workers/wrangler.toml",
]) {
  const text = readFile(file);
  for (const environment of ["staging", "production"]) {
    reporter.assert(text.includes(`[env.${environment}.vars]`), `${file}: Cloudflare ${environment} vars must be explicit`);
    reporter.assert(text.includes(`[env.${environment}.placement]`), `${file}: Cloudflare ${environment} placement must be explicit`);
    reporter.assert(text.includes(`[env.${environment}.observability]`), `${file}: Cloudflare ${environment} telemetry config must be explicit`);
  }

  const topLevel = text.split(/\n\[env\.staging\]/)[0] ?? "";
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
    reporter.assert(!topLevel.includes(forbiddenProductionResource), `${file}: staging top-level config must not bind ${forbiddenProductionResource}`);
  }
}

reporter.finish("Environment lifecycle and Cloudflare non-production isolation gates checked");
