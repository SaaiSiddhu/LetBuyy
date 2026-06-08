import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { readAppStoreRouteSource, readStorefrontRouteSource } from '../helpers/app-store-route-source.mjs';

const EVENT_CORE = 'packages/event-core/src/index.ts';
const ORCHESTRATION_EVENTS = 'packages/orchestration/src/event-runtime.ts';
const GATEWAY_EVENT_ADAPTER = 'services/api-gateway/src/execution/event-execution.adapter.ts';
const QUEUE_EXECUTION_ADAPTER = 'services/api-gateway/src/execution/queue-execution.adapter.ts';
const QUEUE_WORKER_CONSUMER = 'services/queue-workers/src/platform-queue-consumer.ts';
const QUEUE_WORKER_ENTRYPOINT = 'services/queue-workers/src/index.ts';
const NOTIFICATION_CORE = 'packages/notification-core/src/index.ts';
const PRODUCT_ROUTE = 'services/api-gateway/src/routes/products.ts';
const ORDER_ROUTE = 'services/api-gateway/src/routes/orders.ts';
const PAYMENTS_ROUTE = 'services/api-gateway/src/routes/payments.ts';
const ONBOARDING_ROUTE = 'services/api-gateway/src/routes/onboarding.ts';
const STORES_ROUTE = 'services/api-gateway/src/routes/stores.ts';
const STOREFRONT_ROUTE = 'services/api-gateway/src/routes/storefront.ts';
const THEMES_ROUTE = 'services/api-gateway/src/routes/themes.ts';
const THEME_EXECUTION_ADAPTER = 'services/api-gateway/src/execution/theme-execution.adapter.ts';
const BASELINE_SCHEMA = 'database/supabase/migrations/000_baseline.sql';

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
    'app.submitted',
    'app.approved',
    'app.rejected',
    'app.charge.created',
    'app.charge.activated',
    'theme.submitted',
    'theme.approved',
    'theme.rejected',
    'theme.installed',
    'theme.purchase.payment_order_created',
    'theme.purchase.completed',
    'theme.draft.saved',
    'theme.draft.discarded',
    'payout.ledger_entry.created',
    'payout.released',
    'payout.failed',
  ];

  for (const eventType of expectedEvents) {
    assert.match(source, new RegExp(`'${eventType.replaceAll('.', '\\.')}'`), eventType);
  }

  assert.match(source, /export const DOMAIN_EVENT_CONTRACTS/);
  assert.match(source, /export const DOMAIN_EVENT_CONTRACTS: Record<DomainEventType, DomainEventContract>/);
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

test('queue consumers drive analytics, search, notifications, and payout ledger side effects', () => {
  const queueSource = read(QUEUE_EXECUTION_ADAPTER);
  const queueWorkerSource = read(QUEUE_WORKER_CONSUMER);
  const queueWorkerEntrypoint = read(QUEUE_WORKER_ENTRYPOINT);
  const notificationSource = read(NOTIFICATION_CORE);
  const baselineSchema = read(BASELINE_SCHEMA);

  assert.match(queueSource, /type ConsumableQueueName = 'analytics-events' \| 'search-indexing' \| 'payment-events'/);
  assert.match(queueSource, /processAnalyticsJob/);
  assert.match(queueSource, /from\('analytics_event_stream'\)/);
  assert.match(queueSource, /processSearchJob/);
  assert.match(queueSource, /from\('search_documents'\)/);
  assert.match(queueSource, /planInAppNotificationForEvent/);
  assert.match(queueSource, /from\('notifications'\)\.insert/);
  assert.match(queueSource, /processPaymentJob/);
  assert.match(queueSource, /partner_payout_ledger_entries/);
  assert.match(queueSource, /eventType: 'payout\.ledger_entry\.created'/);

  assert.match(queueWorkerEntrypoint, /consumePlatformQueuesForCloudflareQueue/);
  assert.match(queueWorkerSource, /claim_platform_queue_jobs/);
  assert.match(queueWorkerSource, /type PlatformQueueName = 'analytics-events' \| 'search-indexing' \| 'payment-events'/);
  assert.match(queueWorkerSource, /from\('analytics_event_stream'\)/);
  assert.match(queueWorkerSource, /from\('search_documents'\)/);
  assert.match(queueWorkerSource, /from\('notifications'\)\.insert/);
  assert.match(queueWorkerSource, /partner_payout_ledger_entries/);
  assert.match(queueWorkerSource, /eventType: 'payout\.ledger_entry\.created'/);
  assert.match(queueWorkerSource, /complete_platform_queue_job/);
  assert.match(queueWorkerSource, /fail_platform_queue_job/);

  assert.match(notificationSource, /export function planInAppNotificationForEvent/);
  assert.match(notificationSource, /case 'order\.created'/);
  assert.match(notificationSource, /case 'app\.installed'/);
  assert.match(notificationSource, /case 'app\.approved'/);
  assert.match(notificationSource, /case 'theme\.installed'/);
  assert.match(notificationSource, /case 'theme\.rejected'/);

  assert.match(baselineSchema, /CREATE TABLE public\.partner_payout_ledger_entries/);
  assert.match(baselineSchema, /amount_minor integer NOT NULL/);
  assert.match(baselineSchema, /currency text DEFAULT 'INR'::text NOT NULL/);
  assert.match(baselineSchema, /update_partner_payout_ledger_entries_updated_at[\s\S]*EXECUTE FUNCTION public\.update_updated_at\(\)/);
});

test('gateway validates registered event payloads before outbox writes', () => {
  const source = read(GATEWAY_EVENT_ADAPTER);

  assert.match(source, /getDomainEventContract/);
  assert.match(source, /parseDomainEventPayload/);
  assert.match(source, /Event .* must use aggregate type/);
  assert.match(source, /schema_version: contract\?\.schemaVersion \|\| 1/);
});

test('store creation surfaces emit registered store.created events', () => {
  const onboardingSource = read(ONBOARDING_ROUTE);
  const storesSource = read(STORES_ROUTE);

  for (const source of [onboardingSource, storesSource]) {
    assert.match(source, /new EventExecutionAdapter\(db\)\.emitDomainEvent/);
    assert.match(source, /eventType: 'store\.created'/);
    assert.match(source, /aggregateType: 'store'/);
    assert.match(source, /site_id: input\.store\.id/);
    assert.match(source, /store_slug: input\.store\.subdomain/);
    assert.match(source, /owner_user_id: input\.ownerUserId/);
    assert.match(source, /emitStoreCreatedEvent\(db/);
  }
});

test('product gateway mutations emit registered product events', () => {
  const source = read(PRODUCT_ROUTE);

  assert.match(source, /new EventExecutionAdapter\(db\)\.emitDomainEvent/);
  assert.match(source, /eventType: 'product\.created'/);
  assert.match(source, /eventType: 'product\.updated'/);
  assert.match(source, /eventType: 'product\.deleted'/);
  assert.match(source, /aggregateType: 'product'/);
  assert.match(source, /site_id: storeId/);
  assert.match(source, /product_id: productId/);
});

test('order gateway mutations emit registered order lifecycle events', () => {
  const source = read(ORDER_ROUTE);

  assert.match(source, /new EventExecutionAdapter\(db\)\.emitDomainEvent/);
  assert.match(source, /eventType: 'order\.created'/);
  assert.match(source, /'order\.paid'/);
  assert.match(source, /'order\.fulfilled'/);
  assert.match(source, /'order\.cancelled'/);
  assert.match(source, /'order\.refunded'/);
  assert.match(source, /aggregateType: 'order'/);
  assert.match(source, /site_id: input\.siteId/);
  assert.match(source, /order_id: orderId/);
});

test('public storefront checkout emits order.created through the gateway outbox', () => {
  const source = readStorefrontRouteSource();

  assert.match(source, /new EventExecutionAdapter\(db\)\.emitDomainEvent/);
  assert.match(source, /eventType: 'order\.created'/);
  assert.match(source, /aggregateType: 'order'/);
  assert.match(source, /site_id: input\.storeId/);
  assert.match(source, /order_id: input\.order\.id/);
  assert.match(source, /emitStorefrontOrderCreatedEvent\(db/);
});

test('payment confirmations emit registered order.paid events', () => {
  const paymentsSource = read(PAYMENTS_ROUTE);
  const storefrontSource = readStorefrontRouteSource();

  assert.match(paymentsSource, /new EventExecutionAdapter\(db\)\.emitDomainEvent/);
  assert.match(paymentsSource, /eventType: 'order\.paid'/);
  assert.match(paymentsSource, /aggregateType: 'order'/);
  assert.match(paymentsSource, /site_id: siteId/);
  assert.match(paymentsSource, /order_id: orderId/);
  assert.match(paymentsSource, /emitOrderPaidEvent\(c\.env,\s*db/);

  assert.match(storefrontSource, /emitStorefrontOrderPaidEvent/);
  assert.match(storefrontSource, /eventType: 'order\.paid'/);
  assert.match(storefrontSource, /aggregateType: 'order'/);
  assert.match(storefrontSource, /site_id: storeId/);
  assert.match(storefrontSource, /order_id: order\.id \|\| input\.orderId/);
});

test('app install and uninstall producers use registered app lifecycle contracts', () => {
  const source = readAppStoreRouteSource();

  assert.match(source, /new EventExecutionAdapter\(db\)\.emitDomainEvent/);
  assert.match(source, /eventType: input\.eventType/);
  assert.match(source, /eventType: 'app\.installed'/);
  assert.match(source, /eventType: 'app\.uninstalled'/);
  assert.match(source, /aggregateType: 'app'/);
  assert.match(source, /site_id: input\.storeId/);
  assert.match(source, /app_id: appId/);
  assert.match(source, /installation_id: input\.installationId/);
});

test('app submissions emit registered app.submitted review events', () => {
  const source = readAppStoreRouteSource();

  assert.match(source, /new EventExecutionAdapter\(db\)\.emitDomainEvent/);
  assert.match(source, /eventType: 'app\.submitted'/);
  assert.match(source, /aggregateType: 'app'/);
  assert.match(source, /app_id: app\.id/);
  assert.match(source, /partner_id: developer\.id/);
  assert.match(source, /review_id: reviewRecord\.id/);
});

test('theme package upload emits registered theme.submitted events', () => {
  const source = read(THEMES_ROUTE);

  assert.match(source, /new EventExecutionAdapter\(db\)\.emitDomainEvent/);
  assert.match(source, /eventType: 'theme\.submitted'/);
  assert.match(source, /aggregateType: 'theme'/);
  assert.match(source, /theme_package_id: themePackageId/);
  assert.match(source, /theme_version_id: themeVersionId/);
  assert.match(source, /partner_id: input\.partnerId/);
});

test('theme install producer uses registered theme.installed payload fields', () => {
  const source = read(THEME_EXECUTION_ADAPTER);

  assert.match(source, /new EventExecutionAdapter\(this\.db\)/);
  assert.match(source, /events\.emitDomainEvent/);
  assert.match(source, /eventType: 'theme\.installed'/);
  assert.match(source, /aggregateType: 'theme'/);
  assert.match(source, /site_id: input\.store_id/);
  assert.match(source, /theme_package_id: runtime\.themePackageId/);
  assert.match(source, /theme_version_id: runtime\.themePackageVersionId/);
  assert.match(source, /installation_id: installationId/);
});
