import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { readAppStoreRouteSource } from '../helpers/app-store-route-source.mjs';

const APP_ENGINE = 'packages/shared-types/src/app-platform.ts';
const OUTBOX_ADAPTER = 'services/api-gateway/src/execution/outbox-execution.adapter.ts';
const WEBHOOK_SERVICE = 'services/webhook-service/src/index.ts';
const WEBHOOK_DISPATCH = 'services/webhook-service/src/app-lifecycle-dispatch.ts';
const LIFECYCLE_TEST = 'tests/app-platform/lifecycle.test.mjs';

function source(path) {
  return readFileSync(path, 'utf8');
}

test('app installs auto-subscribe app webhooks to mandatory compliance topics', () => {
  const appEngine = source(APP_ENGINE);
  const appStore = readAppStoreRouteSource();

  assert.match(appEngine, /MANDATORY_COMPLIANCE_WEBHOOK_TOPICS/);
  assert.match(appEngine, /'customers\/data_request'/);
  assert.match(appEngine, /'customers\/redact'/);
  assert.match(appEngine, /'shop\/redact'/);
  assert.match(appEngine, /mandatory_compliance_topics/);
  assert.match(appStore, /planAppWebhookSubscriptions/);
});

test('app compliance webhook producers dispatch mandatory topics through the gateway', () => {
  const appStore = readAppStoreRouteSource();

  assert.match(appStore, /\/compliance\/customers\/data-request/);
  assert.match(appStore, /\/compliance\/customers\/redact/);
  assert.match(appStore, /\/compliance\/shop\/redact/);
  assert.match(appStore, /eventType: 'shop\/redact'/);
  assert.match(appStore, /dispatchAppLifecycleSubscriptions\(c\.env/);
  assert.match(appStore, /appComplianceWebhookEventIdPrefix/);
});

test('webhook-service owns outbound HTTPS delivery and raw-body HMAC headers', () => {
  const webhookService = source(WEBHOOK_SERVICE);
  const webhookDispatch = source(WEBHOOK_DISPATCH);
  const outboxAdapter = source(OUTBOX_ADAPTER);

  assert.match(webhookService, /app\.post\("\/webhook-deliveries\/dispatch"/);
  assert.match(webhookService, /claim_webhook_deliveries/);
  assert.match(webhookService, /complete_webhook_delivery/);
  assert.match(webhookService, /fail_webhook_delivery/);
  assert.match(webhookDispatch, /X-LetBuyy-Hmac-SHA256/);
  assert.match(webhookDispatch, /verifyLetBuyyWebhookHmac/);
  assert.doesNotMatch(outboxAdapter, /fetcher\(delivery\.target_url/);
  assert.doesNotMatch(outboxAdapter, /sendWebhookDelivery/);
});

test('gateway dispatch endpoints delegate delivery to webhook-service', () => {
  const operations = source('services/api-gateway/src/routes/operations.ts');
  const gatewayIndex = source('services/api-gateway/src/index.ts');

  assert.match(operations, /WEBHOOK_SERVICE\.fetch\('https:\/\/webhook-service\/webhook-deliveries\/dispatch'/);
  assert.match(gatewayIndex, /WEBHOOK_SERVICE\.fetch\('https:\/\/webhook-service\/webhook-deliveries\/dispatch'/);
});

test('compliance webhook proof rejects invalid LetBuyy HMAC with 401', () => {
  const lifecycleTest = source(LIFECYCLE_TEST);

  assert.match(lifecycleTest, /customers\/redact/);
  assert.match(lifecycleTest, /verifyLetBuyyWebhookHmac/);
  assert.match(lifecycleTest, /invalidResponse\.status,\s*401/);
});
