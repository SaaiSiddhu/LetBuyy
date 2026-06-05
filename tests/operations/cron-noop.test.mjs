import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const gatewayIndex = readFileSync('services/api-gateway/src/index.ts', 'utf8');
const wrangler = readFileSync('services/api-gateway/wrangler.toml', 'utf8');

function indexOf(fragment) {
  const index = gatewayIndex.indexOf(fragment);
  assert.notEqual(index, -1, `${fragment} exists`);
  return index;
}

test('scheduled dispatch performs a pending-work preflight before claims', () => {
  const preflightIndex = indexOf('hasPendingScheduledDispatchWork(');
  const dispatchIndex = indexOf('outbox.dispatchBatch(');
  const queueIndex = indexOf('queue.consumeQueues(');
  const webhookIndex = indexOf("WEBHOOK_SERVICE.fetch('https://webhook-service/webhook-deliveries/dispatch'");

  assert.ok(preflightIndex < dispatchIndex, 'preflight must run before outbox claim');
  assert.ok(preflightIndex < queueIndex, 'preflight must run before queue claim');
  assert.ok(preflightIndex < webhookIndex, 'preflight must run before webhook dispatch');
  assert.match(gatewayIndex, /if \(!pending\.hasWork\)/);
  assert.match(gatewayIndex, /reason: 'no_pending_work'/);
});

test('scheduled dispatch does not enqueue routine completion events when idle', () => {
  const noWorkIndex = indexOf('if (!pending.hasWork)');
  const completionIndex = indexOf("event_type: 'runtime.scheduled_dispatch.completed'");
  const hadWorkIndex = indexOf('const hadWork = scheduledDispatchHadWork(');

  assert.ok(noWorkIndex < hadWorkIndex, 'idle return must happen before work accounting');
  assert.ok(hadWorkIndex < completionIndex, 'completion event must be gated by work accounting');
  assert.match(gatewayIndex, /if \(hadWork\) \{/);
  assert.match(gatewayIndex, /completion_event_enqueued: hadWork/);
});

test('scheduled dispatch emits failure events separately from routine completion', () => {
  assert.match(gatewayIndex, /event_type: 'runtime\.scheduled_dispatch\.failed'/);
  assert.match(gatewayIndex, /scheduled\.outbox_dispatch\.failure_event/);
});

test('staging cron cadence is reduced while production remains one minute', () => {
  assert.match(wrangler, /\[triggers\]\ncrons = \["\*\/5 \* \* \* \*"\]/);
  assert.match(wrangler, /\[env\.staging\.triggers\]\ncrons = \["\*\/5 \* \* \* \*"\]/);
  assert.match(wrangler, /\[env\.production\.triggers\]\ncrons = \["\*\/1 \* \* \* \*"\]/);
});
