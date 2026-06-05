import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getDomainEventContract,
  parseDomainEventPayload,
} from '../../packages/event-core/src/index';

const storeId = '11111111-1111-4111-8111-111111111111';
const themeId = '22222222-2222-4222-8222-222222222222';
const draftId = '33333333-3333-4333-8333-333333333333';

test('theme draft events validate emitted gateway payloads', () => {
  const contract = getDomainEventContract('theme.draft.saved');
  assert.equal(contract?.aggregateType, 'theme_draft');
  assert.deepEqual(contract?.consumers, ['analytics', 'webhook-service']);

  const payload = parseDomainEventPayload('theme.draft.saved', {
    store_id: storeId,
    theme_id: 'urban-kicks',
    template_key: 'index',
    draft_id: draftId,
    version: 3,
    theme_instance_id: null,
    theme_package_version_id: null,
    theme_instance_draft_id: null,
    client: 'web',
  });

  assert.equal(payload.store_id, storeId);
  assert.equal(payload.theme_id, 'urban-kicks');
  assert.equal(payload.version, 3);
});

test('theme purchase events require provider proof fields', () => {
  const contract = getDomainEventContract('theme.purchase.completed');
  assert.equal(contract?.aggregateType, 'theme_purchase');
  assert.deepEqual(contract?.consumers, ['analytics', 'notifications', 'webhook-service']);

  assert.throws(
    () => parseDomainEventPayload('theme.purchase.completed', {
      theme_id: themeId,
      theme_slug: 'urban-kicks',
      provider: 'razorpay',
      provider_order_id: 'order_123',
    }),
    /provider_payment_id/,
  );

  const payload = parseDomainEventPayload('theme.purchase.completed', {
    theme_id: themeId,
    theme_slug: 'urban-kicks',
    provider: 'razorpay',
    provider_order_id: 'order_123',
    provider_payment_id: 'pay_123',
  });

  assert.equal(payload.provider_payment_id, 'pay_123');
});

test('payout release events are explicit human-gated reserved contracts', () => {
  const released = getDomainEventContract('payout.released');
  const failed = getDomainEventContract('payout.failed');

  assert.equal(released?.implementationStatus, 'reserved-human-gated');
  assert.match(released?.reservedReason || '', /payout credentials/);
  assert.equal(failed?.implementationStatus, 'reserved-human-gated');
  assert.match(failed?.reservedReason || '', /payout credentials/);
});
