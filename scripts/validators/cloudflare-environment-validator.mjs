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

function sectionName(envSection) {
  return envSection.match(/^\s*name\s*=\s*"([^"]+)"/m)?.[1] || "";
}

function exactQueue(queueName) {
  return `queue = "${queueName}"`;
}

const productionQueues = [
  "letbuyy-events",
  "letbuyy-analytics",
  "letbuyy-search-indexing",
  "letbuyy-notifications",
  "letbuyy-dead-letters",
];

const expectedWorkerNames = {
  "services/api-gateway": {
    dev: "letbuyy-api-dev",
    staging: "letbuyy-api-staging",
    production: "letbuyy-api",
  },
  "services/webhook-service": {
    dev: "letbuyy-webhooks-dev",
    staging: "letbuyy-webhooks-staging",
    production: "letbuyy-webhooks",
  },
  "services/queue-workers": {
    dev: "letbuyy-queue-workers-dev",
    staging: "letbuyy-queue-workers-staging",
    production: "letbuyy-queue-workers",
  },
};

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
    const expectedEnvironmentName = environment === "dev" ? "development" : environment;
    reporter.assert(envSection.length > 0, `Worker config missing ${marker}: ${worker.config}`);
    reporter.assert(sectionName(envSection) === expectedWorkerNames[worker.root][environment], `Worker ${marker} must declare isolated Worker name ${expectedWorkerNames[worker.root][environment]}: ${worker.config}`);
    reporter.assert(envSection.includes(`[env.${environment}.vars]`), `Worker ${marker} must explicitly declare non-inheritable vars: ${worker.config}`);
    reporter.assert(envSection.includes(`ENVIRONMENT = "${expectedEnvironmentName}"`), `Worker ${marker} must declare matching ENVIRONMENT: ${worker.config}`);
    reporter.assert(envSection.includes(`DEPLOYMENT_ENV = "${environment}"`), `Worker ${marker} must declare matching DEPLOYMENT_ENV: ${worker.config}`);
    reporter.assert(envSection.includes(`[env.${environment}.observability]`), `Worker ${marker} must explicitly declare telemetry config: ${worker.config}`);
    reporter.assert(envSection.includes(`[env.${environment}.observability.logs]`), `Worker ${marker} must explicitly declare log telemetry config: ${worker.config}`);
    reporter.assert(envSection.includes(`[env.${environment}.placement]`) && envSection.includes('mode = "smart"'), `Worker ${marker} must declare placement mode: ${worker.config}`);
    reporter.assert(envSection.includes("workers_dev = false"), `Worker ${marker} must disable workers_dev routing: ${worker.config}`);

    if (worker.requiresRoutes) reporter.assert(envSection.includes("routes = ["), `Worker ${marker} must declare isolated routes: ${worker.config}`);
    if (worker.requiresProducerQueues) reporter.assert(envSection.includes(`[[env.${environment}.queues.producers]]`), `Worker ${marker} must declare queue producers: ${worker.config}`);
    if (worker.requiresConsumers) reporter.assert(envSection.includes(`[[env.${environment}.queues.consumers]]`), `Worker ${marker} must declare queue consumers: ${worker.config}`);
    if (worker.requiresKv) reporter.assert(envSection.includes(`[[env.${environment}.kv_namespaces]]`), `Worker ${marker} must declare isolated KV namespace: ${worker.config}`);
    if (worker.requiresR2) reporter.assert(envSection.includes(`[[env.${environment}.r2_buckets]]`), `Worker ${marker} must declare isolated R2 bucket: ${worker.config}`);

    if (worker.requiresProducerQueues || worker.requiresConsumers) {
      const queuesForWorker = worker.requiresConsumers
        ? productionQueues
        : productionQueues.filter((queue) => queue !== "letbuyy-dead-letters");
      for (const queue of queuesForWorker) {
        if (environment === "production") {
          reporter.assert(envSection.includes(exactQueue(queue)), `Worker ${marker} must bind production queue ${queue}: ${worker.config}`);
          reporter.assert(!envSection.includes(exactQueue(`${queue}-dev`)), `Worker ${marker} must not bind dev queue ${queue}-dev: ${worker.config}`);
          reporter.assert(!envSection.includes(exactQueue(`${queue}-staging`)), `Worker ${marker} must not bind staging queue ${queue}-staging: ${worker.config}`);
        } else {
          reporter.assert(!envSection.includes(exactQueue(queue)), `Worker ${marker} must not bind production queue ${queue}: ${worker.config}`);
          reporter.assert(envSection.includes(exactQueue(`${queue}-${environment}`)), `Worker ${marker} must bind isolated queue ${queue}-${environment}: ${worker.config}`);
        }
      }
    }

    if (worker.requiresR2) {
      const expectedBucket = environment === "production" ? "letbuyy-production-storage" : `letbuyy-${environment}-storage`;
      reporter.assert(envSection.includes(`bucket_name = "${expectedBucket}"`), `Worker ${marker} must bind isolated R2 bucket ${expectedBucket}: ${worker.config}`);
      if (environment !== "production") {
        reporter.assert(!envSection.includes('bucket_name = "letbuyy-production-storage"'), `Worker ${marker} must not bind production R2 bucket: ${worker.config}`);
      }
    }

    if (worker.requiresKv) {
      const placeholder = `__LETBUYY_RUNTIME_CACHE_${environment.toUpperCase()}_NAMESPACE_ID__`;
      reporter.assert(envSection.includes(`id = "${placeholder}"`), `Worker ${marker} must bind environment-specific KV namespace placeholder ${placeholder}: ${worker.config}`);
    }
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
