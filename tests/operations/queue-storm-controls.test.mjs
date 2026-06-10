import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const queueWorkerSource = readFileSync('services/queue-workers/src/index.ts', 'utf8');
const platformConsumerSource = readFileSync('services/queue-workers/src/platform-queue-consumer.ts', 'utf8');
const wranglerConfig = readFileSync('services/queue-workers/wrangler.toml', 'utf8');
const quarantineMigration = readFileSync('database/supabase/migrations/089_quarantine_platform_queue_job.sql', 'utf8');

function blockAfter(source, marker, length = 2200) {
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${marker} exists`);
  return source.slice(start, start + length);
}

test('Cloudflare queue poison messages are persisted as dead-lettered and acked', () => {
  assert.match(queueWorkerSource, /class QueueProcessingError extends Error/);
  assert.match(queueWorkerSource, /function isDeterministicQueueError/);
  assert.match(queueWorkerSource, /function quarantinedDelivery/);
  assert.match(queueWorkerSource, /jobType: 'runtime\.queue\.delivery\.invalid'/);
  assert.match(queueWorkerSource, /status: 'dead-lettered'/);
  assert.match(queueWorkerSource, /quarantine_reason/);

  const normalizeBlock = blockAfter(queueWorkerSource, 'function normalizeDeliveries');
  assert.match(normalizeBlock, /isDeterministicQueueError\(error\)/);
  assert.match(normalizeBlock, /return quarantinedDelivery\(batch, message, error\)/);

  const queueHandlerBlock = blockAfter(queueWorkerSource, 'async queue(batch, env)', 2800);
  assert.match(queueHandlerBlock, /const deliveries = await normalizeDeliveries\(env, batch\)/);
  assert.match(queueHandlerBlock, /await persistQueueBatch\(env, deliveries\)/);
  assert.match(queueHandlerBlock, /for \(const delivery of deliveries\) delivery\.message\.ack\(\)/);
  assert.match(queueHandlerBlock, /quarantined: deliveries\.filter/);
});

test('platform queue fan-out is explicit and defaults off for generic trigger queues', () => {
  const mapperBlock = blockAfter(platformConsumerSource, 'export function platformQueueNamesForCloudflareQueue');
  assert.match(mapperBlock, /allowGenericFanout\?: boolean/);
  assert.match(mapperBlock, /return options\.allowGenericFanout \? \['analytics-events', 'search-indexing', 'payment-events'\] : \[\]/);

  const consumerBlock = blockAfter(platformConsumerSource, 'export async function consumePlatformQueuesForCloudflareQueue');
  assert.match(consumerBlock, /allowGenericFanout: genericFanoutEnabled\(env\)/);
  assert.match(platformConsumerSource, /PLATFORM_QUEUE_DRAIN_GENERIC_FANOUT/);
  assert.match(wranglerConfig, /PLATFORM_QUEUE_DRAIN_GENERIC_FANOUT = "off"/);
});

test('platform queue drains use per-batch budgets and circuit breakers', () => {
  assert.match(platformConsumerSource, /const queueCircuitBreakers = new Map<PlatformQueueName, QueueCircuitState>\(\)/);
  assert.match(platformConsumerSource, /function drainBudget/);
  assert.match(platformConsumerSource, /PLATFORM_QUEUE_DRAIN_BUDGET_PER_BATCH/);
  assert.match(platformConsumerSource, /function recordQueueDrainFailure/);
  assert.match(platformConsumerSource, /PLATFORM_QUEUE_CIRCUIT_FAILURE_THRESHOLD/);
  assert.match(platformConsumerSource, /PLATFORM_QUEUE_CIRCUIT_OPEN_SECONDS/);

  const consumeQueuesBlock = blockAfter(platformConsumerSource, 'async consumeQueues', 3200);
  assert.match(consumeQueuesBlock, /let remainingBudget = totalBudget/);
  assert.match(consumeQueuesBlock, /remainingBudget <= 0/);
  assert.match(consumeQueuesBlock, /skippedReason: 'budget_exhausted'/);
  assert.match(consumeQueuesBlock, /isCircuitOpen\(queueName\)/);
  assert.match(consumeQueuesBlock, /skippedReason: 'circuit_open'/);
  assert.match(consumeQueuesBlock, /recordQueueDrainFailure\(this\.env, queueName\)/);
});

test('deterministic platform job failures quarantine immediately', () => {
  assert.match(platformConsumerSource, /class DeterministicQueueJobError extends Error/);
  assert.match(platformConsumerSource, /function isDeterministicQueueJobError/);
  assert.match(platformConsumerSource, /await this\.quarantineJob\(workerId, job, error\)/);
  assert.match(platformConsumerSource, /p_error_message: error instanceof Error \? error\.message : 'Queue job failed deterministic validation'/);
  assert.match(platformConsumerSource, /quarantine_platform_queue_job/);

  assert.match(quarantineMigration, /CREATE OR REPLACE FUNCTION public\.quarantine_platform_queue_job/);
  assert.match(quarantineMigration, /SET status = 'dead'/);
  assert.match(quarantineMigration, /'quarantined', true/);
  assert.match(quarantineMigration, /status = 'running'/);
  assert.match(quarantineMigration, /locked_by = p_worker_id/);
});

test('production queue concurrency is capped during outage retries', () => {
  const productionConfig = wranglerConfig.slice(wranglerConfig.indexOf('[env.production]'));
  const productionConcurrency = [...productionConfig.matchAll(/max_concurrency = (\d+)/g)]
    .map((match) => Number(match[1]));

  assert.ok(productionConcurrency.length >= 6, 'production queue consumers are configured');
  for (const concurrency of productionConcurrency) {
    assert.ok(concurrency <= 10, `production queue max_concurrency ${concurrency} must stay <= 10`);
  }
});
