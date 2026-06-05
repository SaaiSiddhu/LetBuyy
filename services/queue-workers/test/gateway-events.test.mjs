import assert from 'node:assert/strict';
import test from 'node:test';

import { emitGatewayDomainEvent } from '../../../packages/infrastructure/gateway-events-adapter/index.ts';

function captureGateway(status = 200, payload = { success: true }) {
  const calls = [];
  const env = {
    INTERNAL_API_SECRET: 'internal-secret',
    API_GATEWAY_SERVICE: {
      async fetch(input, init) {
        calls.push({
          input,
          init,
          body: JSON.parse(String(init?.body || '{}')),
        });
        return Response.json(payload, { status });
      },
    },
  };

  return { env, calls };
}

test('queue-workers emit payout domain events through the gateway owner', async () => {
  const { env, calls } = captureGateway();

  await emitGatewayDomainEvent(env, {
    storeId: 'site-1',
    aggregateType: 'payout',
    aggregateId: 'ledger-1',
    eventType: 'payout.ledger_entry.created',
    payload: {
      partner_id: 'partner-1',
      payout_id: 'ledger-1',
      ledger_entry_id: 'ledger-1',
      amount: { amount_minor: 1000, currency: 'INR' },
      rail: 'razorpay_route',
    },
    idempotencyKey: 'payout-ledger:charge-1',
    requestId: 'request-1',
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].input, 'https://api-gateway/v1/internal/events/domain');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.headers['X-Internal-API-Secret'], 'internal-secret');
  assert.deepEqual(calls[0].body, {
    storeId: 'site-1',
    aggregateType: 'payout',
    aggregateId: 'ledger-1',
    eventType: 'payout.ledger_entry.created',
    payload: {
      partner_id: 'partner-1',
      payout_id: 'ledger-1',
      ledger_entry_id: 'ledger-1',
      amount: { amount_minor: 1000, currency: 'INR' },
      rail: 'razorpay_route',
    },
    idempotencyKey: 'payout-ledger:charge-1',
    requestId: 'request-1',
  });
});

test('queue-workers domain event emission fails closed without binding or secret', async () => {
  await assert.rejects(
    () => emitGatewayDomainEvent({
      INTERNAL_API_SECRET: 'internal-secret',
    }, {
      aggregateType: 'payout',
      aggregateId: 'ledger-1',
      eventType: 'payout.ledger_entry.created',
      idempotencyKey: 'idem-1',
    }),
    /API_GATEWAY_SERVICE binding is required/,
  );

  await assert.rejects(
    () => emitGatewayDomainEvent({
      API_GATEWAY_SERVICE: captureGateway().env.API_GATEWAY_SERVICE,
    }, {
      aggregateType: 'payout',
      aggregateId: 'ledger-1',
      eventType: 'payout.ledger_entry.created',
      idempotencyKey: 'idem-1',
    }),
    /INTERNAL_API_SECRET is required/,
  );
});
