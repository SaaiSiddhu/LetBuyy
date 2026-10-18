import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = dirname(fileURLToPath(import.meta.url));
const adapterSource = readFileSync(
  join(testDir, '../../services/api-gateway/src/execution/event-execution.adapter.ts'),
  'utf8',
);
const webhookSource = readFileSync(
  join(testDir, '../../services/webhook-service/src/index.ts'),
  'utf8',
);

test('gateway domain-event ingress rejects uncontracted event types before persistence', () => {
  assert.match(adapterSource, /if \(!contract\) {\s*throw new Error\(`Uncontracted domain event type:/);
  assert.doesNotMatch(adapterSource, /:\s*input\.payload \|\| \{\}/);
});

test('webhook payment events are normalized to contracted domain event names', () => {
  assert.match(webhookSource, /function normalizePaymentDomainEventType/);
  assert.match(webhookSource, /return "payment\.subscription\.activated"/);
  assert.match(webhookSource, /return "refund\.created"/);
  assert.match(webhookSource, /normalized === "refund\.processed"\) return "payment\.refunded"/);
  assert.match(webhookSource, /return "payment\.failed"/);
  assert.match(webhookSource, /return "payment\.captured"/);
  assert.match(webhookSource, /eventType: domainEventType/);
  assert.match(webhookSource, /provider_event_type: params\.eventType/);
});
