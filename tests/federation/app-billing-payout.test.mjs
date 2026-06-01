import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const BILLING_CORE_SOURCE = readFileSync('packages/billing-core/src/index.ts', 'utf8');
const SHARED_TYPES_SOURCE = readFileSync('packages/shared-types/src/index.ts', 'utf8');
const API_CLIENT_SOURCE = readFileSync('packages/typescript/api-client/src/index.ts', 'utf8');
const APP_STORE_ROUTE_SOURCE = readFileSync('services/api-gateway/src/routes/app-store.ts', 'utf8');
const EVENT_CORE_SOURCE = readFileSync('packages/event-core/src/index.ts', 'utf8');
const QUEUE_EXECUTION_SOURCE = readFileSync('services/api-gateway/src/execution/queue-execution.adapter.ts', 'utf8');
const APP_BILLING_MIGRATION = readFileSync('database/supabase/migrations/071_app_billing_charges.sql', 'utf8');

test('app billing contracts are owned by billing-core, shared-types, and api-client', () => {
  assert.match(BILLING_CORE_SOURCE, /CreateAppBillingChargeSchema/);
  assert.match(BILLING_CORE_SOURCE, /ApproveAppBillingChargeSchema/);
  assert.match(BILLING_CORE_SOURCE, /planIndiaAppChargePayout/);
  assert.match(BILLING_CORE_SOURCE, /DEFAULT_APP_REVENUE_SHARE_BPS = 8000/);
  assert.match(BILLING_CORE_SOURCE, /DEFAULT_PARTNER_GST_BPS = 1800/);

  assert.match(SHARED_TYPES_SOURCE, /AppBillingChargeSchema/);
  assert.match(SHARED_TYPES_SOURCE, /AppBillingIndiaPayoutRailSchema/);
  assert.match(SHARED_TYPES_SOURCE, /AppBillingChargeResultSchema/);

  assert.match(API_CLIENT_SOURCE, /createCharge/);
  assert.match(API_CLIENT_SOURCE, /approveCharge/);
  assert.match(API_CLIENT_SOURCE, /AppBillingChargeApprovalResult/);
});

test('gateway exposes merchant approval and activation routes for app charges', () => {
  assert.match(APP_STORE_ROUTE_SOURCE, /\/installations\/:id\/charges/);
  assert.match(APP_STORE_ROUTE_SOURCE, /\/charges\/:id\/approve/);
  assert.match(APP_STORE_ROUTE_SOURCE, /CreateAppBillingChargeSchema\.safeParse/);
  assert.match(APP_STORE_ROUTE_SOURCE, /ApproveAppBillingChargeSchema\.safeParse/);
  assert.match(APP_STORE_ROUTE_SOURCE, /eventType: 'app\.charge\.created'/);
  assert.match(APP_STORE_ROUTE_SOURCE, /eventType: 'app\.charge\.activated'/);
  assert.match(APP_STORE_ROUTE_SOURCE, /payout_rail: stringOrNull\(indiaPayout\.payout_rail\) \|\| 'razorpay_route'/);
});

test('event spine activates payout ledger only after merchant-approved app charges', () => {
  assert.match(EVENT_CORE_SOURCE, /'app\.charge\.created':[\s\S]*consumers: \['analytics', 'notifications', 'webhook-service'\]/);
  assert.match(EVENT_CORE_SOURCE, /'app\.charge\.activated':[\s\S]*consumers: \['analytics', 'notifications', 'payout-ledger', 'webhook-service'\]/);

  assert.match(QUEUE_EXECUTION_SOURCE, /eventType === 'app\.charge\.activated'/);
  assert.doesNotMatch(QUEUE_EXECUTION_SOURCE, /eventType === 'app\.charge\.created' \|\| eventType === 'app\.charge\.activated'/);
  assert.match(QUEUE_EXECUTION_SOURCE, /partner_payout_ledger_entries/);
  assert.match(QUEUE_EXECUTION_SOURCE, /rail,\s+metadata: \{/);
  assert.match(QUEUE_EXECUTION_SOURCE, /partner_gst_minor/);
});

test('app billing migration records INR charges and India payout rails', () => {
  assert.match(APP_BILLING_MIGRATION, /CREATE TABLE IF NOT EXISTS app_billing_charges/);
  assert.match(APP_BILLING_MIGRATION, /billing_mode TEXT NOT NULL CHECK \(billing_mode IN \('recurring', 'usage'\)\)/);
  assert.match(APP_BILLING_MIGRATION, /currency TEXT NOT NULL DEFAULT 'INR'/);
  assert.match(APP_BILLING_MIGRATION, /partner_gst_minor INTEGER NOT NULL DEFAULT 0/);
  assert.match(APP_BILLING_MIGRATION, /payout_rail TEXT NOT NULL DEFAULT 'razorpay_route'/);
  assert.match(APP_BILLING_MIGRATION, /UNIQUE\(site_id, idempotency_key\)/);
  assert.match(APP_BILLING_MIGRATION, /EXECUTE FUNCTION update_updated_at\(\)/);
});
