import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const EVENT_CORE = 'packages/event-core/src/index.ts';
const ORCHESTRATION_EVENTS = 'packages/orchestration/src/event-runtime.ts';

function read(path) {
  return readFileSync(path, 'utf8');
}

test('event-core declares the federation domain event registry', () => {
  const source = read(EVENT_CORE);
  const expectedEvents = [
    'store.created',
    'product.created',
    'product.updated',
    'product.deleted',
    'order.created',
    'order.paid',
    'order.fulfilled',
    'order.cancelled',
    'order.refunded',
    'app.installed',
    'app.uninstalled',
    'app.charge.created',
    'app.charge.activated',
    'theme.submitted',
    'theme.approved',
    'theme.installed',
    'payout.ledger_entry.created',
    'payout.released',
    'payout.failed',
  ];

  for (const eventType of expectedEvents) {
    assert.match(source, new RegExp(`'${eventType.replaceAll('.', '\\.')}'`), eventType);
  }

  assert.match(source, /export const DOMAIN_EVENT_CONTRACTS/);
  assert.match(source, /satisfies Record<DomainEventType, DomainEventContract>/);
  assert.match(source, /export const DOMAIN_EVENT_PRODUCER_CONSUMER_CONTRACTS/);
  assert.match(source, /export function validateDomainEventEnvelope/);
  assert.match(source, /payloadSchema: .*PayloadSchema/);
});

test('domain event contracts name producers and consumers for cross-app federation', () => {
  const source = read(EVENT_CORE);

  assert.match(source, /producer: 'identity-platform'/);
  assert.match(source, /producer: 'platform-console'/);
  assert.match(source, /producer: 'platform-operations-portal'/);
  assert.match(source, /producer: 'app-marketplace'/);
  assert.match(source, /producer: 'theme-marketplace'/);
  assert.match(source, /producer: 'queue-workers'/);
  assert.match(source, /consumers: \['analytics', 'notifications', 'search-indexing', 'webhook-service'\]/);
  assert.match(source, /consumers: \['analytics', 'notifications', 'payout-ledger', 'webhook-service'\]/);
});

test('orchestration queue fanout uses event-core contracts before legacy prefix rules', () => {
  const source = read(ORCHESTRATION_EVENTS);

  assert.match(source, /getDomainEventContract/);
  assert.match(source, /const contract = getDomainEventContract\(eventType\)/);
  assert.match(source, /queueNameForDomainEventConsumer/);
  assert.match(source, /case 'analytics':\s+return 'analytics-events'/);
  assert.match(source, /case 'search-indexing':\s+return 'search-indexing'/);
  assert.match(source, /case 'payout-ledger':\s+return 'payment-events'/);
});
