import {
  createReporter,
  exists,
  readFile,
  readJson,
} from "./governance-common.mjs";

const reporter = createReporter("Cloudflare topology validator");

const topology = readJson("config/runtime/cloudflare-topology.json");
const ownership = readJson("config/runtime/resource-ownership-manifest.json");
const lineage = readJson("config/runtime/environment-lineage.json");
const runtimeTopology = readJson("config/runtime/runtime-topology.json");
const apiWrangler = readFile("services/api-gateway/wrangler.toml");
const webhookWrangler = readFile("services/webhook-service/wrangler.toml");
const queueWrangler = readFile("services/queue-workers/wrangler.toml");
const queuesTerraform = readFile("infrastructure/cloudflare/queues.tf");
const storageTerraform = readFile("infrastructure/cloudflare/storage.tf");

reporter.assert(exists("config/runtime/cloudflare-topology.schema.json"), "Cloudflare topology schema must exist");
reporter.assert(topology?.$schema === "config/runtime/cloudflare-topology.schema.json", "Cloudflare topology must reference checked-in schema");
reporter.assert(topology?.mode === "governance-contract-not-live-evidence", "Cloudflare topology must not claim live provider evidence");
reporter.assert(topology?.failurePolicy === "fail-closed", "Cloudflare topology must fail closed");
reporter.assert(topology?.wrangler?.requiredMajor === 4, "Cloudflare topology must require Wrangler 4");
reporter.assert(topology?.wrangler?.nodeMajor === 22, "Cloudflare topology must require Node 22");
reporter.assert(runtimeTopology?.cloudflareTopology === "config/runtime/cloudflare-topology.json", "Runtime topology must point at Cloudflare topology");
reporter.assert(ownership?.sourceTopology === "config/runtime/cloudflare-topology.json", "Resource ownership must point at Cloudflare topology");
reporter.assert(JSON.stringify(lineage?.promotionOrder) === JSON.stringify(["dev", "staging", "production"]), "Environment lineage must preserve dev -> staging -> production");

const seenResourceNames = new Map();
const resourceKeys = ["worker", "d1", "kv", "r2", "runtimeQueue", "deadLetterQueue", "durableObjectNamespace", "telemetryDataset", "replayStorage", "walStorage"];
const cacheKvPlaceholders = {
  dev: "__LETBUYY_RUNTIME_CACHE_DEV_NAMESPACE_ID__",
  staging: "STAGING_CACHE_KV_ID_PLACEHOLDER",
  production: "PRODUCTION_CACHE_KV_ID_PLACEHOLDER",
};

for (const environment of ["dev", "staging", "production"]) {
  const env = topology.environments?.[environment];
  reporter.assert(Boolean(env), `Cloudflare topology missing ${environment}`);
  reporter.assert(env.deploymentEnv === environment, `Cloudflare topology deploymentEnv drift for ${environment}`);

  for (const key of resourceKeys) {
    const value = env?.[key];
    const environmentToken = environment === "dev" ? "dev" : environment;
    const isEnvironmentScoped =
      typeof value === "string" &&
      (value.startsWith(env.resourcePrefix) || value.endsWith(`-${environmentToken}`) || value.includes(`-${environmentToken}-`));
    reporter.assert(isEnvironmentScoped, `Cloudflare ${environment}.${key} must be scoped to ${environment}`);
    const collision = seenResourceNames.get(value);
    reporter.assert(!collision, `Cloudflare resource name shared across environments: ${value}`);
    seenResourceNames.set(value, `${environment}.${key}`);
  }

  reporter.assert(apiWrangler.includes(`name = "${env.workers.apiGateway}"`), `API Gateway wrangler missing Worker ${env.workers.apiGateway}`);
  reporter.assert(webhookWrangler.includes(`name = "${env.workers.webhookService}"`), `Webhook wrangler missing Worker ${env.workers.webhookService}`);
  reporter.assert(queueWrangler.includes(`name = "${env.workers.queueWorkers}"`), `Queue wrangler missing Worker ${env.workers.queueWorkers}`);
  reporter.assert(apiWrangler.includes(env.d1), `API Gateway wrangler missing D1 ${env.d1}`);
  reporter.assert(apiWrangler.includes(cacheKvPlaceholders[environment]), `API Gateway wrangler missing KV placeholder for ${environment}`);
  reporter.assert(apiWrangler.includes(env.r2), `API Gateway wrangler missing R2 ${env.r2}`);
  reporter.assert(apiWrangler.includes(env.runtimeQueue), `API Gateway wrangler missing runtime queue ${env.runtimeQueue}`);
  reporter.assert(queueWrangler.includes(env.runtimeQueue), `Queue wrangler missing runtime queue ${env.runtimeQueue}`);
  reporter.assert(queueWrangler.includes(env.deadLetterQueue), `Queue wrangler missing runtime DLQ ${env.deadLetterQueue}`);
  reporter.assert(apiWrangler.includes(env.telemetryDataset), `API Gateway wrangler missing telemetry dataset ${env.telemetryDataset}`);
  reporter.assert(webhookWrangler.includes(env.telemetryDataset), `Webhook wrangler missing telemetry dataset ${env.telemetryDataset}`);
  reporter.assert(queueWrangler.includes(env.telemetryDataset), `Queue wrangler missing telemetry dataset ${env.telemetryDataset}`);

  for (const value of [env.d1, env.kv, env.r2]) {
    reporter.assert(storageTerraform.includes(value), `Storage Terraform missing Cloudflare resource ${value}`);
  }
  for (const value of [env.runtimeQueue, env.deadLetterQueue]) {
    reporter.assert(queuesTerraform.includes(value), `Queue Terraform missing Cloudflare resource ${value}`);
  }
}

for (const lower of ["dev", "staging"]) {
  const lowerSection = apiWrangler.slice(apiWrangler.indexOf(`[env.${lower}]`), apiWrangler.indexOf(lower === "dev" ? "[env.staging]" : "[env.production]"));
  const production = topology.environments.production;
  for (const key of ["d1", "r2", "runtimeQueue", "deadLetterQueue", "telemetryDataset"]) {
    reporter.assert(!lowerSection.includes(production[key]), `Lower environment ${lower} must not reference production ${key}: ${production[key]}`);
  }
}

reporter.finish(`${seenResourceNames.size} Cloudflare resource names checked`);
