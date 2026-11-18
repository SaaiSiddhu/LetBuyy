import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const queueWorkerSource = readFileSync('services/queue-workers/src/index.ts', 'utf8');
const bulkGraphQLSource = readFileSync('services/api-gateway/src/graphql/bulk.ts', 'utf8');

function countMatches(source, pattern) {
  return source.match(pattern)?.length || 0;
}

function blockAfter(source, marker) {
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${marker} exists`);
  return source.slice(start, start + 1800);
}

test('queue worker persists a Cloudflare batch with batched DB writes', () => {
  assert.match(queueWorkerSource, /interface NormalizedQueueDelivery/);
  assert.match(queueWorkerSource, /async function persistQueueBatch/);
  assert.match(queueWorkerSource, /deliveries\.map\(\(delivery\) => \(/);
  assert.match(queueWorkerSource, /async function recordQueueBatchMetric/);
  assert.match(queueWorkerSource, /metric_name: 'letbuyy\.queue\.delivery\.batch'/);
  assert.match(queueWorkerSource, /metric_name: 'letbuyy\.queue\.dead_letter\.total'/);
  assert.match(queueWorkerSource, /writeRuntimeTelemetryDataPoint\(env\.RUNTIME_TELEMETRY/);
  assert.match(queueWorkerSource, /const lagP95Ms = percentile/);
  assert.match(queueWorkerSource, /lag_p95_ms: lagP95Ms/);

  assert.equal(
    countMatches(queueWorkerSource, /upsertSupabaseRows\(env, 'distributed_queue_messages'/g),
    1,
    'distributed queue messages should be written with one batch upsert call',
  );
  assert.equal(
    countMatches(queueWorkerSource, /insertSupabaseRows\(env, 'runtime_telemetry_metrics'/g),
    1,
    'queue metrics should be written with one aggregate insert call',
  );
  assert.doesNotMatch(queueWorkerSource, /recordQueueLagMetric/);
});

test('queue worker drains platform queues once per Cloudflare batch', () => {
  const start = queueWorkerSource.indexOf('async queue(batch, env)');
  assert.notEqual(start, -1);
  const queueHandlerBlock = queueWorkerSource.slice(start, queueWorkerSource.indexOf('\n  async scheduled', start) === -1 ? undefined : queueWorkerSource.indexOf('\n  async scheduled', start));
  assert.match(queueHandlerBlock, /const deliveries = await normalizeDeliveries\(env, batch\)/);
  assert.match(queueHandlerBlock, /await persistQueueBatch\(env, deliveries\)/);
  assert.match(queueHandlerBlock, /await recordQueueBatchMetric\(env, batch, deliveries\)/);
  assert.match(queueHandlerBlock, /consumePlatformQueuesForCloudflareQueue\(env, \{/);
  assert.match(queueHandlerBlock, /workerId: `cloudflare:\$\{batch\.queue\}:batch:/);
  assert.match(queueHandlerBlock, /for \(const delivery of deliveries\) delivery\.message\.ack\(\)/);
  assert.doesNotMatch(queueHandlerBlock, /for \(const message of batch\.messages\)/);
  assert.equal(countMatches(queueHandlerBlock, /await consumePlatformQueuesForCloudflareQueue\(/g), 1);
  assert.ok(queueHandlerBlock.indexOf('await dispatchEmailDeliveries') < queueHandlerBlock.indexOf('await persistQueueBatch'), 'persist completion only after dispatch');
  assert.ok(queueHandlerBlock.indexOf('await persistQueueBatch') < queueHandlerBlock.indexOf('delivery.message.ack()'), 'ack only after durable completion');
});

test('GraphQL bulk operations use one waitUntil path and do not enqueue a dead queue job', () => {
  assert.match(bulkGraphQLSource, /c\.executionCtx\.waitUntil\(processGraphQLBulkOperation/);
  assert.match(bulkGraphQLSource, /processingPath: 'api-gateway\.waitUntil'/);
  assert.doesNotMatch(bulkGraphQLSource, /c\.env\.RUNTIME_QUEUE\.send/);
  assert.doesNotMatch(bulkGraphQLSource, /enqueueBulkOperation/);
  assert.doesNotMatch(bulkGraphQLSource, /queueEnqueued/);
});

test('GraphQL bulk mutations fail loudly instead of per-row HTTP fan-out', () => {
  const mutationBlock = blockAfter(bulkGraphQLSource, 'async function executeBulkMutation');
  assert.match(mutationBlock, /BULK_MUTATION_DIRECT_EXECUTION_REQUIRED/);
  assert.match(mutationBlock, /direct execution adapters/);
  assert.doesNotMatch(mutationBlock, /for \(const \[index, row\] of rows\.entries\(\)\)/);
  assert.doesNotMatch(mutationBlock, /executeGraphQLDocument\(c, delegate, operation\.query, rowVariables/);
});
