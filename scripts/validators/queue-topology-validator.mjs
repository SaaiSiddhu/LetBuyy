import {
  createReporter,
  readFile,
  readJson,
} from "./governance-common.mjs";

const reporter = createReporter("Queue topology validator");
const topology = readJson("config/runtime/cloudflare-topology.json");
const manifest = readJson("config/runtime/queue-lifecycle-manifest.json");
const apiWrangler = readFile("services/api-gateway/wrangler.toml");
const queueWrangler = readFile("services/queue-workers/wrangler.toml");
const queueTerraform = readFile("infrastructure/cloudflare/queues.tf");

const runtimeQueue = manifest.queues.find((queue) => queue.logicalName === "runtime");
reporter.assert(Boolean(runtimeQueue), "Queue lifecycle manifest must include runtime provider queue");
reporter.assert(runtimeQueue?.producerBinding === "RUNTIME_QUEUE", "Runtime provider queue must use RUNTIME_QUEUE binding");
reporter.assert(runtimeQueue?.poisonMessagePolicy === "dead-letter-after-retry-exhaustion", "Runtime provider queue must dead-letter poison messages");

for (const environment of ["dev", "staging", "production"]) {
  const env = topology.environments[environment];
  reporter.assert(runtimeQueue.names[environment] === env.runtimeQueue, `Runtime queue name drift for ${environment}`);
  reporter.assert(runtimeQueue.deadLetterNames[environment] === env.deadLetterQueue, `Runtime queue DLQ name drift for ${environment}`);
  reporter.assert(apiWrangler.includes(`queue = "${env.runtimeQueue}"`), `API Gateway missing runtime queue producer for ${environment}`);
  reporter.assert(queueWrangler.includes(`queue = "${env.runtimeQueue}"`), `Queue Workers missing runtime queue consumer for ${environment}`);
  reporter.assert(queueWrangler.includes(`dead_letter_queue = "${env.deadLetterQueue}"`), `Queue Workers missing runtime queue DLQ for ${environment}`);
  reporter.assert(queueWrangler.includes(`queue = "${env.deadLetterQueue}"`), `Queue Workers missing runtime dead-letter consumer for ${environment}`);
  reporter.assert(queueTerraform.includes(env.runtimeQueue), `Terraform missing runtime queue ${env.runtimeQueue}`);
  reporter.assert(queueTerraform.includes(env.deadLetterQueue), `Terraform missing runtime DLQ ${env.deadLetterQueue}`);
}

for (const fragment of [
  'resource "cloudflare_queue" "foundation_runtime"',
  'resource "cloudflare_queue" "foundation_dead_letters"',
  'resource "cloudflare_queue_consumer" "foundation_runtime"',
  'resource "cloudflare_queue_consumer" "foundation_dead_letters"',
]) {
  reporter.assert(queueTerraform.includes(fragment), `Queue Terraform missing ${fragment}`);
}

reporter.finish("Queue topology and runtime provider queue governance checked");
