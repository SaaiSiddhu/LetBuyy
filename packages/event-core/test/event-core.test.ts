import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DOMAIN_EVENT_TYPES,
  getDomainEventContract,
  parseDomainEventPayload,
  validateDomainEventEnvelope,
  writeWithOutbox,
  type OutboxWritableTransaction,
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

test('scheduled merchant payout events require the tenant settlement and typed INR minor-unit amount', () => {
  const siteId = '11111111-1111-4111-8111-111111111111';
  const payoutId = '22222222-2222-4222-8222-222222222222';
  const settlementId = '33333333-3333-4333-8333-333333333333';
  assert.deepEqual(parseDomainEventPayload('payout.scheduled', {
    site_id: siteId,
    payout_id: payoutId,
    settlement_id: settlementId,
    amount: { amount_minor: 9882, currency: 'INR' },
    rail: 'razorpay_route',
  }), {
    site_id: siteId,
    payout_id: payoutId,
    settlement_id: settlementId,
    amount: { amount_minor: 9882, currency: 'INR' },
    rail: 'razorpay_route',
  });
  assert.throws(() => parseDomainEventPayload('payout.scheduled', {
    site_id: siteId,
    payout_id: payoutId,
    settlement_id: settlementId,
    amount: 9882,
    rail: 'razorpay_route',
  }));
});

test('V1 executable event catalog includes cart, checkout, settlement, notification, whatsapp, and audit contracts', () => {
  for (const eventType of [
    'cart.created',
    'checkout.completed',
    'inventory.reserved',
    'shipment.delivered',
    'settlement.recorded',
    'notification.sent',
    'wa.cod_confirmed',
    'billing.charged',
    'customer.dsr_requested',
    'media.processed',
    'audit.recorded',
  ] as const) {
    assert.ok(DOMAIN_EVENT_TYPES.includes(eventType));
    assert.equal(getDomainEventContract(eventType)?.schemaVersion, 1);
  }
});

test('writeWithOutbox validates the catalog and inserts one queued outbox row after domain work', async () => {
  const inserts: Record<string, unknown>[] = [];
  const tx: OutboxWritableTransaction = {
    from(table) {
      assert.equal(table, 'outbox_events');
      return {
        insert(row) {
          inserts.push(row);
          return {
            select() {
              return {
                async single() {
                  return { data: { id: 'outbox-1', event_type: row.event_type, status: row.status }, error: null };
                },
              };
            },
          };
        },
      };
    },
  };

  const result = await writeWithOutbox(
    tx,
    async () => ({ id: 'domain-row-1' }),
    {
      event_id: 'evt_cart_created_001',
      event_type: 'cart.created',
      source_runtime: 'api-gateway',
      site_id: '11111111-1111-4111-8111-111111111111',
      aggregate_type: 'cart',
      aggregate_id: '33333333-3333-4333-8333-333333333333',
      payload: {
        site_id: '11111111-1111-4111-8111-111111111111',
        cart_id: '33333333-3333-4333-8333-333333333333',
        channel: 'web',
      },
      idempotency_key: 'cart:created:33333333-3333-4333-8333-333333333333',
    },
  );

  assert.deepEqual(result.result, { id: 'domain-row-1' });
  assert.equal(result.outbox.status, 'queued');
  assert.equal(inserts.length, 1);
  assert.equal(inserts[0]?.site_id, '11111111-1111-4111-8111-111111111111');
  assert.equal(inserts[0]?.event_type, 'cart.created');
});

test('in-app notification events retain the canonical notification identity', () => {
  const payload = parseDomainEventPayload('notification.sent', {site_id: ORDER_ID, notification_id: ORDER_ID, channel: 'in_app'});
  assert.equal(payload.notification_id, ORDER_ID);
  assert.equal(payload.channel, 'in_app');
  assert.throws(() => parseDomainEventPayload('notification.sent', {site_id: ORDER_ID, channel: 'in_app'}), /notification_id/);
});
