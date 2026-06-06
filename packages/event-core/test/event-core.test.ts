import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DOMAIN_EVENT_TYPES,
  getDomainEventContract,
  parseDomainEventPayload,
  validateDomainEventEnvelope,
} from '../src/index.ts';

const ORDER_ID = '11111111-1111-4111-8111-111111111111';

test('domain event registry contracts every accepted event type', () => {
  for (const eventType of DOMAIN_EVENT_TYPES) {
    const contract = getDomainEventContract(eventType);
    assert.ok(contract, `${eventType} must have a contract`);
    assert.equal(contract.eventType, eventType);
    assert.equal(contract.schemaVersion, 1);
  }

  assert.equal(getDomainEventContract('payment.unknown'), null);
  assert.equal(getDomainEventContract('payout.released')?.implementationStatus, 'reserved-human-gated');
  assert.equal(getDomainEventContract('payout.failed')?.implementationStatus, 'reserved-human-gated');
});

test('payment event envelopes reject raw uncontracted or mismatched payloads', () => {
  const envelope = validateDomainEventEnvelope({
    event_id: 'evt_payment_001',
    event_type: 'payment.captured',
    source_runtime: 'webhook-service',
    aggregate_type: 'order',
    aggregate_id: ORDER_ID,
    occurred_at: '2026-06-06T00:00:00.000Z',
    payload: {
      provider: 'razorpay',
      provider_event_id: 'pay_evt_001',
      order_id: ORDER_ID,
      payment_id: 'pay_001',
      payment_status: 'paid',
    },
  });

  assert.equal(envelope.event_type, 'payment.captured');
  assert.equal(envelope.payload.provider, 'razorpay');
  assert.throws(
    () => validateDomainEventEnvelope({ ...envelope, aggregate_type: 'payment' }),
    /Invalid aggregate type/,
  );
  assert.throws(
    () => validateDomainEventEnvelope({ ...envelope, schema_version: 2 }),
    /Unsupported schema version/,
  );
  assert.throws(
    () => parseDomainEventPayload('payment.captured', { provider: 'razorpay', order_id: ORDER_ID }),
    /provider_event_id/,
  );
});
