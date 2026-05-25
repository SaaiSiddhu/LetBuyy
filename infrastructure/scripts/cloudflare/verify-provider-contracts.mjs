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
const expectedQueues = topology.queueProvider.queues;
const deadLetterQueue = expectedQueues.find((queue) => queue.includes("dead-letters"));
const primaryQueues = expectedQueues.filter((queue) => queue !== deadLetterQueue);
const apiWrangler = read(topology.queueProvider.producerConfig);
const queueWrangler = read(topology.queueProvider.consumerConfig);
const queueTerraform = read(topology.queueProvider.terraform);
const storageTerraform = read("infrastructure/cloudflare/storage.tf");

assert(["dev", "staging", "production"].includes(environment), "--environment must be dev, staging, or production");
assert(deadLetterQueue, "production topology must declare a dead-letter queue");

function environmentQueueName(queue) {
  if (environment === "production") return queue;
  return `${queue}-${environment}`;
}

function scriptName(base) {
  if (environment === "production") return base;
  if (base === "letbuyy-api") return `letbuyy-api-${environment}`;
  if (base === "letbuyy-webhooks") return `letbuyy-webhooks-${environment}`;
  return `letbuyy-queue-workers-${environment}`;
}

function apiRouteForEnvironment() {
  if (environment === "production") return "api.letbuyy.store";
  if (environment === "staging") return "api.staging.letbuyy.store";
  return "api-dev.letbuyy.store";
}

function webhookRouteForEnvironment() {
  if (environment === "production") return "webhooks.letbuyy.store";
  if (environment === "staging") return "webhooks.staging.letbuyy.store";
  return "webhooks-dev.letbuyy.store";
}

function cacheTitleForEnvironment() {
  if (environment === "production") return "letbuyy-runtime-cache";
  return `letbuyy-runtime-cache-${environment}`;
}

function r2BucketForEnvironment() {
  if (environment === "production") return "letbuyy-production-storage";
  if (environment === "staging") return "letbuyy-staging-storage";
  return "letbuyy-dev-storage";
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

assert(apiWrangler.includes(apiRouteForEnvironment()), `API Gateway route missing for ${environment}`);
assert(read("services/webhook-service/wrangler.toml").includes(webhookRouteForEnvironment()), `Webhook route missing for ${environment}`);
assert(storageTerraform.includes(cacheTitleForEnvironment()), `Cloudflare KV namespace missing for ${environment}`);
assert(storageTerraform.includes(r2BucketForEnvironment()), `Cloudflare R2 bucket missing for ${environment}`);

for (const terraformFragment of [
  'resource "cloudflare_queue" "runtime"',
  'resource "cloudflare_queue" "dead_letters"',
  'resource "cloudflare_queue_consumer" "runtime"',
  'resource "cloudflare_queue_consumer" "dead_letters"',
]) {
  assert(queueTerraform.includes(terraformFragment), `Cloudflare Terraform missing ${terraformFragment}`);
}

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

  const kvNamespaces = await cloudflareGet(accountId, "/storage/kv/namespaces");
  const kvTitles = new Set((Array.isArray(kvNamespaces) ? kvNamespaces : []).map((namespace) => namespace.title || namespace.name));
  assert(kvTitles.has(cacheTitleForEnvironment()), `Cloudflare account is missing KV namespace ${cacheTitleForEnvironment()}`);

  const r2Buckets = await cloudflareGet(accountId, "/r2/buckets");
  const r2BucketNames = new Set((Array.isArray(r2Buckets?.buckets) ? r2Buckets.buckets : Array.isArray(r2Buckets) ? r2Buckets : []).map((bucket) => bucket.name));
  assert(r2BucketNames.has(r2BucketForEnvironment()), `Cloudflare account is missing R2 bucket ${r2BucketForEnvironment()}`);

  for (const baseScriptName of ["letbuyy-api", "letbuyy-webhooks", "letbuyy-queue-workers"]) {
    await cloudflareGet(accountId, `/workers/scripts/${scriptName(baseScriptName)}`);
  }
}

console.log(`[cloudflare-provider-contracts] ${environment} provider contracts passed`);
