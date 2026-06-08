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

test('scheduled dispatch only enqueues routine completion events after forward progress', () => {
  const noWorkIndex = indexOf('if (!pending.hasWork)');
  const completionIndex = indexOf("event_type: 'runtime.scheduled_dispatch.completed'");
  const hadWorkIndex = indexOf('const hadWork = scheduledDispatchHadWork(');
  const forwardProgressIndex = indexOf('const hadForwardProgress =');
  const enqueueIndex = indexOf('enqueueScheduledDispatchTriggers(env, completedDispatchTriggerInput)');

  assert.ok(noWorkIndex < hadWorkIndex, 'idle return must happen before work accounting');
  assert.ok(hadWorkIndex < forwardProgressIndex, 'forward progress must be evaluated after work accounting');
  assert.ok(forwardProgressIndex < completionIndex, 'completion payload must be built after forward progress accounting');
  assert.ok(forwardProgressIndex < enqueueIndex, 'completion trigger enqueue must be gated by forward progress accounting');
  assert.match(gatewayIndex, /if \(hadForwardProgress\) \{/);
  assert.match(gatewayIndex, /completion_event_enqueued: hadForwardProgress/);
});

test('scheduled dispatch logs failures without queue-trigger churn', () => {
  assert.doesNotMatch(gatewayIndex, /event_type: 'runtime\.scheduled_dispatch\.failed'/);
  assert.doesNotMatch(gatewayIndex, /scheduled\.outbox_dispatch\.failure_event/);
  assert.match(gatewayIndex, /Scheduled outbox dispatch failed/);
  assert.match(gatewayIndex, /console\.error\(JSON\.stringify\(\{/);
});

test('default and staging cron are idle while production remains reduced cadence', () => {
  assert.match(wrangler, /\[triggers\]\ncrons = \[\]/);
  assert.match(wrangler, /\[env\.staging\.triggers\]\n# Beta free-tier: staging fully idled[\s\S]*?\ncrons = \[\]/);
  assert.match(wrangler, /\[env\.production\.triggers\]\n# Beta free-tier:[^\n]*\ncrons = \["\*\/15 \* \* \* \*"\]/);
});
