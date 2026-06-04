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

function readJson(path) {
  return JSON.parse(read(path));
}

function arrayTableBlocks(toml, table) {
  const marker = `[[${table}]]`;
  const blocks = [];
  let index = toml.indexOf(marker);

  while (index >= 0) {
    const start = index + marker.length;
    const nextTable = toml.indexOf("[[", start);
    const nextSection = toml.indexOf("\n[", start);
    const candidates = [nextTable, nextSection].filter((candidate) => candidate >= 0);
    const end = candidates.length > 0 ? Math.min(...candidates) : toml.length;
    blocks.push(toml.slice(start, end));
    index = toml.indexOf(marker, end);
  }

  return blocks;
}

function getString(block, key) {
  const match = block.match(new RegExp(`^\\s*${key}\\s*=\\s*"([^"]+)"`, "m"));
  return match?.[1] || null;
}

function getNumber(block, key) {
  const match = block.match(new RegExp(`^\\s*${key}\\s*=\\s*(\\d+)`, "m"));
  return match ? Number(match[1]) : null;
}

function requireEnv(names) {
  const missing = names.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables for --execute: ${missing.join(", ")}`);
  }
}

async function cloudflareGet(accountId, path) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}${path}`, {
    headers: {
      Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
      "Content-Type": "application/json",
    },
  });
  const body = await response.json().catch(() => ({}));
  assert(response.ok && body.success !== false, `Cloudflare API ${path} failed with ${response.status}`);
  return body.result;
}

const topology = readJson("config/runtime/production-topology.json");
const cloudflareTopology = readJson("config/runtime/cloudflare-topology.json");
const foundationProductionQueues = new Set(["letbuyy-production-queue", "letbuyy-production-dead-letter-queue"]);
const expectedQueues = topology.queueProvider.queues.filter((queue) => !foundationProductionQueues.has(queue));
const deadLetterQueue = expectedQueues.find((queue) => queue.includes("dead-letters"));
const primaryQueues = expectedQueues.filter((queue) => queue !== deadLetterQueue);
const apiWrangler = read(topology.queueProvider.producerConfig);
const queueWrangler = read(topology.queueProvider.consumerConfig);
const queueTerraform = read(topology.queueProvider.terraform);
const storageTerraform = read("infrastructure/cloudflare/storage.tf");
const cloudflareEnv = cloudflareTopology.environments?.[environment];

assert(["staging", "production"].includes(environment), "--environment must be staging or production");
assert(Boolean(cloudflareEnv), `Cloudflare topology missing environment ${environment}`);
assert(deadLetterQueue, "production topology must declare a dead-letter queue");

const queueFamilyNames = {
  "letbuyy-events-production": {
    staging: "letbuyy-events-staging",
    production: "letbuyy-events-production",
  },
  "letbuyy-analytics-queue-production": {
    staging: "letbuyy-analytics-queue-staging",
    production: "letbuyy-analytics-queue-production",
  },
  "letbuyy-search-queue-production": {
    staging: "letbuyy-search-queue-staging",
    production: "letbuyy-search-queue-production",
  },
  "letbuyy-notifications-queue-production": {
    staging: "letbuyy-notifications-queue-staging",
    production: "letbuyy-notifications-queue-production",
  },
  "letbuyy-dead-letters-production": {
    staging: "letbuyy-dead-letters-staging",
    production: "letbuyy-dead-letters-production",
  },
};

function environmentQueueName(queue) {
  return queueFamilyNames[queue]?.[environment] || queue;
}

function scriptName(base) {
  if (environment === "production") return base;
  if (base === "letbuyy-api") return `letbuyy-api-${environment}`;
  if (base === "letbuyy-webhook") return `letbuyy-webhook-${environment}`;
  return `letbuyy-queue-workers-${environment}`;
}

function apiRouteForEnvironment() {
  if (environment === "production") return "api.letbuyy.store";
  return "api.staging.letbuyy.store";
}

function webhookRouteForEnvironment() {
  if (environment === "production") return "webhooks.letbuyy.store";
  return "webhooks.staging.letbuyy.store";
}

function cacheTitleForEnvironment() {
  return cloudflareEnv.kv;
}

function r2BucketForEnvironment() {
  return cloudflareEnv.r2;
}

function d1DatabaseForEnvironment() {
  return cloudflareEnv.d1;
}

const producerTable = `env.${environment}.queues.producers`;
const consumerTable = `env.${environment}.queues.consumers`;
const producers = arrayTableBlocks(apiWrangler, producerTable).map((block) => ({
  binding: getString(block, "binding"),
  queue: getString(block, "queue"),
}));
const consumers = arrayTableBlocks(queueWrangler, consumerTable).map((block) => ({
  queue: getString(block, "queue"),
  deadLetterQueue: getString(block, "dead_letter_queue"),
  maxConcurrency: getNumber(block, "max_concurrency"),
  maxRetries: getNumber(block, "max_retries"),
  retryDelay: getNumber(block, "retry_delay"),
}));

for (const queue of primaryQueues) {
  const environmentQueue = environmentQueueName(queue);
  assert(
    producers.some((producer) => producer.queue === environmentQueue),
    `API Gateway must produce to ${environmentQueue}`,
  );
  const consumer = consumers.find((candidate) => candidate.queue === environmentQueue);
  assert(consumer, `Queue worker must consume ${environmentQueue}`);
  assert(
    consumer.deadLetterQueue === environmentQueueName(deadLetterQueue),
    `Queue ${environmentQueue} must route failures to the environment DLQ`,
  );
  assert(consumer.maxConcurrency && consumer.maxConcurrency > 0, `Queue ${environmentQueue} must enforce max_concurrency`);
  assert(consumer.maxRetries && consumer.maxRetries > 0, `Queue ${environmentQueue} must enforce max_retries`);
  assert(consumer.retryDelay && consumer.retryDelay > 0, `Queue ${environmentQueue} must enforce retry_delay`);
}

const environmentDlq = environmentQueueName(deadLetterQueue);
const dlqConsumer = consumers.find((candidate) => candidate.queue === environmentDlq);
assert(dlqConsumer, `Queue worker must consume ${environmentDlq}`);
assert(!dlqConsumer.deadLetterQueue, "DLQ consumer must not route to another DLQ");

for (const queue of expectedQueues) {
  const environmentQueue = environmentQueueName(queue);
  assert(queueTerraform.includes(environmentQueue), `Terraform must declare Cloudflare queue ${environmentQueue}`);
}
for (const queue of [cloudflareEnv.runtimeQueue, cloudflareEnv.deadLetterQueue]) {
  if (queue === cloudflareEnv.runtimeQueue) {
    assert(producers.some((producer) => producer.queue === queue), `API Gateway must produce to runtime queue ${queue}`);
  }
  assert(consumers.some((consumer) => consumer.queue === queue), `Queue worker must consume runtime queue ${queue}`);
  assert(queueTerraform.includes(queue), `Terraform must declare Cloudflare runtime queue ${queue}`);
}

assert(apiWrangler.includes(apiRouteForEnvironment()), `API Gateway route missing for ${environment}`);
assert(read("services/webhook-service/wrangler.toml").includes(webhookRouteForEnvironment()), `Webhook route missing for ${environment}`);
assert(storageTerraform.includes(cacheTitleForEnvironment()), `Cloudflare KV namespace missing for ${environment}`);
assert(storageTerraform.includes(r2BucketForEnvironment()), `Cloudflare R2 bucket missing for ${environment}`);
assert(storageTerraform.includes(d1DatabaseForEnvironment()), `Cloudflare D1 database missing for ${environment}`);
assert(apiWrangler.includes(d1DatabaseForEnvironment()), `API Gateway D1 binding missing for ${environment}`);
assert(apiWrangler.includes(cloudflareEnv.telemetryDataset), `API Gateway telemetry dataset missing for ${environment}`);

for (const terraformFragment of [
  'resource "cloudflare_queue" "runtime"',
  'resource "cloudflare_queue" "dead_letters"',
  'resource "cloudflare_queue_consumer" "runtime"',
  'resource "cloudflare_queue_consumer" "dead_letters"',
  'resource "cloudflare_queue" "foundation_runtime"',
  'resource "cloudflare_queue" "foundation_dead_letters"',
]) {
  assert(queueTerraform.includes(terraformFragment), `Cloudflare Terraform missing ${terraformFragment}`);
}
assert(storageTerraform.includes('resource "cloudflare_d1_database" "runtime_d1"'), "Cloudflare Terraform missing D1 runtime database");

if (execute) {
  requireEnv(["CLOUDFLARE_API_TOKEN"]);
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || process.env.TF_VAR_cloudflare_account_id;
  assert(accountId, "Missing CLOUDFLARE_ACCOUNT_ID or TF_VAR_cloudflare_account_id for --execute");

  const queues = await cloudflareGet(accountId, "/queues");
  const queueNames = new Set((Array.isArray(queues) ? queues : []).map((queue) => queue.queue_name || queue.name));
  for (const queue of expectedQueues) {
    const environmentQueue = environmentQueueName(queue);
    assert(queueNames.has(environmentQueue), `Cloudflare account is missing queue ${environmentQueue}`);
  }
  for (const queue of [cloudflareEnv.runtimeQueue, cloudflareEnv.deadLetterQueue]) {
    assert(queueNames.has(queue), `Cloudflare account is missing queue ${queue}`);
  }

  const kvNamespaces = await cloudflareGet(accountId, "/storage/kv/namespaces");
  const kvTitles = new Set((Array.isArray(kvNamespaces) ? kvNamespaces : []).map((namespace) => namespace.title || namespace.name));
  assert(kvTitles.has(cacheTitleForEnvironment()), `Cloudflare account is missing KV namespace ${cacheTitleForEnvironment()}`);

  const r2Buckets = await cloudflareGet(accountId, "/r2/buckets");
  const r2BucketNames = new Set((Array.isArray(r2Buckets?.buckets) ? r2Buckets.buckets : Array.isArray(r2Buckets) ? r2Buckets : []).map((bucket) => bucket.name));
  assert(r2BucketNames.has(r2BucketForEnvironment()), `Cloudflare account is missing R2 bucket ${r2BucketForEnvironment()}`);

  const d1Databases = await cloudflareGet(accountId, "/d1/database");
  const d1DatabaseNames = new Set((Array.isArray(d1Databases) ? d1Databases : Array.isArray(d1Databases?.result) ? d1Databases.result : []).map((database) => database.name));
  assert(d1DatabaseNames.has(d1DatabaseForEnvironment()), `Cloudflare account is missing D1 database ${d1DatabaseForEnvironment()}`);

  for (const baseScriptName of ["letbuyy-api", "letbuyy-webhook", "letbuyy-queue-workers"]) {
    await cloudflareGet(accountId, `/workers/scripts/${scriptName(baseScriptName)}`);
  }
}

console.log(`[cloudflare-provider-contracts] ${environment} provider contracts passed`);
