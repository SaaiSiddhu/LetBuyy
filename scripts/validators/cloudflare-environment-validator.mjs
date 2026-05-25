import {
  createReporter,
  exists,
  readFile,
  readJson,
} from "./governance-common.mjs";

const reporter = createReporter("Cloudflare environment validator");

const workerConfigs = [
  {
    root: "services/api-gateway",
    config: "services/api-gateway/wrangler.toml",
    requiresRoutes: true,
    requiresProducerQueues: true,
    requiresConsumers: false,
    requiresKv: true,
    requiresR2: true,
  },
  {
    root: "services/webhook-service",
    config: "services/webhook-service/wrangler.toml",
    requiresRoutes: true,
    requiresProducerQueues: false,
    requiresConsumers: false,
    requiresKv: false,
    requiresR2: false,
  },
  {
    root: "services/queue-workers",
    config: "services/queue-workers/wrangler.toml",
    requiresRoutes: false,
    requiresProducerQueues: false,
    requiresConsumers: true,
    requiresKv: false,
    requiresR2: false,
  },
];

function section(text, name) {
  const start = text.indexOf(name);
  if (start < 0) return "";
  const rest = text.slice(start + name.length);
  const next = rest.search(/\n\[env\.(dev|staging|production)\]/);
  return next >= 0 ? rest.slice(0, next) : rest;
}

for (const worker of workerConfigs) {
  reporter.assert(exists(worker.config), `Missing Worker config: ${worker.config}`);
  const text = readFile(worker.config);
  const topLevel = text.split(/\n\[env\.dev\]/)[0] ?? "";
  const manifest = readJson(`${worker.root}/package.json`);

  reporter.assert(
    manifest?.scripts?.deploy?.includes("deploy-worker-runtime.mjs") && !/wrangler deploy(\s|$)/.test(manifest.scripts.deploy),
    `Worker deploy script must require explicit --env through deploy-worker-runtime.mjs: ${worker.root}/package.json`,
  );

  for (const environment of ["dev", "staging", "production"]) {
    const marker = `[env.${environment}]`;
    const envSection = section(text, marker);
    reporter.assert(envSection.length > 0, `Worker config missing ${marker}: ${worker.config}`);
    reporter.assert(envSection.includes(`ENVIRONMENT = "${environment === "dev" ? "development" : environment}"`), `Worker ${marker} must declare matching ENVIRONMENT: ${worker.config}`);

    if (worker.requiresRoutes) reporter.assert(envSection.includes("routes = ["), `Worker ${marker} must declare isolated routes: ${worker.config}`);
    if (worker.requiresProducerQueues) reporter.assert(envSection.includes(`[[env.${environment}.queues.producers]]`), `Worker ${marker} must declare queue producers: ${worker.config}`);
    if (worker.requiresConsumers) reporter.assert(envSection.includes(`[[env.${environment}.queues.consumers]]`), `Worker ${marker} must declare queue consumers: ${worker.config}`);
    if (worker.requiresKv) reporter.assert(envSection.includes(`[[env.${environment}.kv_namespaces]]`), `Worker ${marker} must declare isolated KV namespace: ${worker.config}`);
    if (worker.requiresR2) reporter.assert(envSection.includes(`[[env.${environment}.r2_buckets]]`), `Worker ${marker} must declare isolated R2 bucket: ${worker.config}`);
    reporter.assert(envSection.includes("[env.") ? true : envSection.includes("mode = \"smart\""), `Worker ${marker} must declare placement mode: ${worker.config}`);
  }

  if (topLevel.includes('ENVIRONMENT = "local"')) {
    reporter.assert(!topLevel.includes('queue = "letbuyy-events"'), `Local top-level config must not bind production events queue: ${worker.config}`);
    reporter.assert(!topLevel.includes('queue = "letbuyy-analytics"'), `Local top-level config must not bind production analytics queue: ${worker.config}`);
    reporter.assert(!topLevel.includes('queue = "letbuyy-search-indexing"'), `Local top-level config must not bind production search queue: ${worker.config}`);
    reporter.assert(!topLevel.includes('queue = "letbuyy-notifications"'), `Local top-level config must not bind production notification queue: ${worker.config}`);
    reporter.assert(!topLevel.includes('queue = "letbuyy-dead-letters"'), `Local top-level config must not bind production DLQ: ${worker.config}`);
    reporter.assert(!topLevel.includes('bucket_name = "letbuyy-production-storage"'), `Local top-level config must not bind production R2 bucket: ${worker.config}`);
  }
}

reporter.finish(`${workerConfigs.length} Cloudflare Worker configs checked`);
