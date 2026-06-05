import {
  createReporter,
  exists,
  readFile,
  readJson,
} from "./governance-common.mjs";

const reporter = createReporter("Queue lifecycle validator");

const manifestPath = "config/runtime/queue-lifecycle-manifest.json";
const schemaPath = "config/runtime/queue-lifecycle-manifest.schema.json";
const manifest = readJson(manifestPath);
const apiWrangler = readFile("services/api-gateway/wrangler.toml");
const queueWrangler = readFile("services/queue-workers/wrangler.toml");
const gatewayQueueTriggerSource = readFile("services/api-gateway/src/execution/cloudflare-queue-triggers.ts");
const gatewayIndexSource = readFile("services/api-gateway/src/index.ts");
const queueAdapterSource = readFile("packages/infrastructure/queue-adapter/index.ts");

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function section(text, environment) {
  const marker = `[env.${environment}]`;
  const start = text.indexOf(marker);
  if (start < 0) return "";
  const rest = text.slice(start);
  const next = rest.slice(marker.length).search(/\n\[env\.(staging|production)\]/);
  return next >= 0 ? rest.slice(0, marker.length + next) : rest;
}

function arrayTableBlocks(text, tableName) {
  const marker = `[[${tableName}]]`;
  const pattern = new RegExp(`^\\s*${escapeRegExp(marker)}\\s*$`, "gm");
  const starts = [...text.matchAll(pattern)].map((match) => match.index);
  return starts.map((start, index) => {
    const nextStart = starts[index + 1] ?? text.slice(start + marker.length).search(/\n\[/);
    if (typeof nextStart === "number" && nextStart >= 0 && index === starts.length - 1) {
      return text.slice(start, start + marker.length + nextStart);
    }
    return text.slice(start, nextStart ?? undefined);
  });
}

function stringValue(block, key) {
  return block.match(new RegExp(`^\\s*${escapeRegExp(key)}\\s*=\\s*"([^"]+)"`, "m"))?.[1] || "";
}

function numberValue(block, key) {
  const raw = block.match(new RegExp(`^\\s*${escapeRegExp(key)}\\s*=\\s*([0-9]+)`, "m"))?.[1];
  return raw ? Number(raw) : undefined;
}

reporter.assert(exists(manifestPath), `Missing queue lifecycle manifest: ${manifestPath}`);
reporter.assert(exists(schemaPath), `Missing queue lifecycle schema: ${schemaPath}`);
reporter.assert(manifest?.$schema === schemaPath, "Queue lifecycle manifest must reference its checked-in schema");
reporter.assert(manifest?.mode === "governance-contract-not-live-evidence", "Queue lifecycle manifest must not claim live evidence");
reporter.assert(manifest?.producerConfig === "services/api-gateway/wrangler.toml", "Queue manifest must bind API Gateway producer config");
reporter.assert(manifest?.consumerConfig === "services/queue-workers/wrangler.toml", "Queue manifest must bind Queue Workers consumer config");
reporter.assert(manifest?.deterministicRecovery?.clockSource === "caller-supplied-runtime-time", "Queue recovery must require caller-supplied runtime time");
reporter.assert(manifest?.failurePolicy === "fail-closed", "Queue lifecycle must fail closed");
reporter.assert(
  gatewayIndexSource.includes("planScheduledDispatchQueueTriggers") && gatewayIndexSource.includes("createCloudflareQueueProducer"),
  "API Gateway scheduled dispatcher must produce Cloudflare queue trigger messages",
);
reporter.assert(
  queueAdapterSource.includes("jobType?: string") && queueAdapterSource.includes("jobType: message.jobType"),
  "Cloudflare queue adapter must preserve trigger jobType for queue-workers",
);

const queueSource = readFile("packages/distributed-runtime/src/queue-runtime.ts");
for (const fragment of [
  "QueueRuntimeClock",
  "nowMs: number",
  "caller-supplied deterministic runtime time",
  "availableAt: string",
  "createdAt: string",
  "this.clock.nowMs()",
  "this.clock.nowIso()",
]) {
  reporter.assert(queueSource.includes(fragment), `Queue runtime missing deterministic recovery fragment: ${fragment}`);
}

for (const forbidden of [
  "now = Date.now()",
  "input.availableAt || new Date().toISOString()",
  "createdAt: new Date().toISOString()",
  "queueRetryAvailableAt(message.attempts + 1, this.policy.retry)",
]) {
  reporter.assert(!queueSource.includes(forbidden), `Queue runtime must not use implicit time fragment: ${forbidden}`);
}

const queueOpsSource = readFile("packages/distributed-runtime/src/queue-operations-runtime.ts");
reporter.assert(queueOpsSource.includes("nowMs: number"), "Queue recovery operations must require caller-supplied nowMs");
reporter.assert(queueOpsSource.includes("planQueueRecovery(message, this.policy, nowMs)"), "Queue recovery operations must pass deterministic nowMs");

for (const environment of Object.keys(manifest?.environments || {})) {
  const apiSection = section(apiWrangler, environment);
  const consumerSection = section(queueWrangler, environment);
  reporter.assert(apiSection.includes(`[env.${environment}.vars]`), `API queue producer env missing vars: ${environment}`);
  reporter.assert(consumerSection.includes(`[env.${environment}.vars]`), `Queue consumer env missing vars: ${environment}`);

  const producerBlocks = arrayTableBlocks(apiSection, `env.${environment}.queues.producers`);
  const consumerBlocks = arrayTableBlocks(consumerSection, `env.${environment}.queues.consumers`);

  for (const queue of manifest?.queues || []) {
    const queueName = queue.names?.[environment];
    const dlqName = queue.deadLetterNames?.[environment];
    const producer = producerBlocks.find((block) => stringValue(block, "binding") === queue.producerBinding);
    const consumer = consumerBlocks.find((block) => stringValue(block, "queue") === queueName);

    reporter.assert(Boolean(queueName), `Queue manifest missing name for ${queue.logicalName}/${environment}`);
    reporter.assert(Boolean(dlqName), `Queue manifest missing DLQ name for ${queue.logicalName}/${environment}`);
    reporter.assert(Boolean(producer), `API Gateway missing queue producer binding ${queue.producerBinding} for ${environment}`);
    reporter.assert(
      gatewayQueueTriggerSource.includes(`'${queue.producerBinding}'`),
      `API Gateway source missing queue trigger send plan for ${queue.producerBinding}`,
    );
    reporter.assert(stringValue(producer || "", "queue") === queueName, `API Gateway producer queue drift for ${queue.logicalName}/${environment}`);
    reporter.assert(Boolean(consumer), `Queue Workers missing consumer for ${queueName}`);
    reporter.assert(stringValue(consumer || "", "dead_letter_queue") === dlqName, `Queue consumer DLQ drift for ${queueName}`);
    reporter.assert(numberValue(consumer || "", "max_retries") === queue.retry?.maxRetries?.[environment], `Queue max_retries drift for ${queueName}`);
    reporter.assert(numberValue(consumer || "", "retry_delay") === queue.retry?.retryDelaySeconds, `Queue retry_delay drift for ${queueName}`);
    reporter.assert(queue.poisonMessagePolicy === "dead-letter-after-retry-exhaustion", `Queue poison-message policy must be fail-closed: ${queue.logicalName}`);
    reporter.assert(Boolean(queue.replayIntegrity), `Queue replay integrity policy required: ${queue.logicalName}`);

    if (environment !== "production") {
      reporter.assert(!apiSection.includes(`queue = "${queue.names.production}"`), `Lower env API must not bind production queue ${queue.names.production}`);
      reporter.assert(!consumerSection.includes(`queue = "${queue.names.production}"`), `Lower env consumer must not bind production queue ${queue.names.production}`);
    } else {
      for (const lower of ["staging"]) {
        reporter.assert(!apiSection.includes(`queue = "${queue.names[lower]}"`), `Production API must not bind ${lower} queue ${queue.names[lower]}`);
        reporter.assert(!consumerSection.includes(`queue = "${queue.names[lower]}"`), `Production consumer must not bind ${lower} queue ${queue.names[lower]}`);
      }
    }
  }

  const dlqName = manifest?.deadLetterQueue?.names?.[environment];
  const dlqConsumer = consumerBlocks.find((block) => stringValue(block, "queue") === dlqName);
  reporter.assert(Boolean(dlqConsumer), `Queue Workers missing dead-letter consumer for ${environment}`);
  reporter.assert(numberValue(dlqConsumer || "", "max_retries") === manifest?.deadLetterQueue?.maxRetries?.[environment], `DLQ max_retries drift for ${environment}`);
  reporter.assert(numberValue(dlqConsumer || "", "retry_delay") === manifest?.deadLetterQueue?.retryDelaySeconds, `DLQ retry_delay drift for ${environment}`);
}

reporter.finish(`${manifest?.queues?.length || 0} queue lifecycle contracts checked across ${Object.keys(manifest?.environments || {}).length} environments`);
