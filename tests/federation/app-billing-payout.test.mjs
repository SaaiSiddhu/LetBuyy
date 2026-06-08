import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { readAppStoreRouteSource } from '../helpers/app-store-route-source.mjs';

const BILLING_CORE_SOURCE = readFileSync('packages/billing-core/src/index.ts', 'utf8');
const SHARED_TYPES_SOURCE = readFileSync('packages/shared-types/src/index.ts', 'utf8');
const API_CLIENT_SOURCE = readFileSync('packages/typescript/api-client/src/index.ts', 'utf8');
const APP_STORE_ROUTE_SOURCE = readAppStoreRouteSource();
const EVENT_CORE_SOURCE = readFileSync('packages/event-core/src/index.ts', 'utf8');
const QUEUE_EXECUTION_SOURCE = readFileSync('services/api-gateway/src/execution/queue-execution.adapter.ts', 'utf8');
const BASELINE_SCHEMA = readFileSync('database/supabase/migrations/000_baseline.sql', 'utf8');
const PRICING_POLICY_MIGRATION = readFileSync('database/supabase/migrations/092_app_marketplace_pricing_policy.sql', 'utf8');

test('app billing contracts are owned by billing-core, shared-types, and api-client', () => {
  assert.match(BILLING_CORE_SOURCE, /CreateAppBillingChargeSchema/);
  assert.match(BILLING_CORE_SOURCE, /ApproveAppBillingChargeSchema/);
  assert.match(BILLING_CORE_SOURCE, /planIndiaAppChargePayout/);
  assert.match(BILLING_CORE_SOURCE, /DEFAULT_APP_REVENUE_SHARE_BPS = 8500/);
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

test('app billing approval does not fabricate provider success references', () => {
  assert.doesNotMatch(APP_STORE_ROUTE_SOURCE, /rzp_route_test_/);
  assert.match(APP_STORE_ROUTE_SOURCE, /APP_BILLING_PROVIDER_UNCONFIGURED/);
  assert.match(APP_STORE_ROUTE_SOURCE, /APP_BILLING_PROVIDER_PROOF_REQUIRED/);
  assert.match(APP_STORE_ROUTE_SOURCE, /APP_BILLING_PROVIDER_SIGNATURE_INVALID/);
  assert.match(APP_STORE_ROUTE_SOURCE, /createRazorpayOrder/);
  assert.match(APP_STORE_ROUTE_SOURCE, /getRazorpayOrderNotes/);
  assert.match(APP_STORE_ROUTE_SOURCE, /hmacSha256Hex/);
  assert.match(APP_STORE_ROUTE_SOURCE, /status: 'approved'[\s\S]*provider_status: 'payment_required'/);
  assert.match(APP_STORE_ROUTE_SOURCE, /status: 'active'[\s\S]*provider_status: 'verified'/);
  assert.match(APP_STORE_ROUTE_SOURCE, /ledger_event: null/);
});

test('event spine activates payout ledger only after merchant-approved app charges', () => {
  assert.match(EVENT_CORE_SOURCE, /'app\.charge\.created':[\s\S]*consumers: \['analytics', 'notifications', 'webhook-service'\]/);
  assert.match(EVENT_CORE_SOURCE, /'app\.charge\.activated':[\s\S]*consumers: \['analytics', 'notifications', 'payout-ledger', 'webhook-service'\]/);

  assert.match(QUEUE_EXECUTION_SOURCE, /eventType === 'app\.charge\.activated'/);
  assert.doesNotMatch(QUEUE_EXECUTION_SOURCE, /eventType === 'app\.charge\.created' \|\| eventType === 'app\.charge\.activated'/);
  assert.match(QUEUE_EXECUTION_SOURCE, /partner_payout_ledger_entries/);
  assert.match(QUEUE_EXECUTION_SOURCE, /const ledgerMetadata = \{/);
  assert.match(QUEUE_EXECUTION_SOURCE, /rail,\s+metadata: ledgerMetadata/);
  assert.match(QUEUE_EXECUTION_SOURCE, /partner_gst_minor/);
  assert.match(EVENT_CORE_SOURCE, /provider_reference: z\.string\(\)\.trim\(\)\.min\(1\)\.max\(200\)\.optional\(\)/);
  assert.match(EVENT_CORE_SOURCE, /provider_mode: z\.enum\(\['test', 'live'\]\)\.default\('test'\)/);
  assert.match(QUEUE_EXECUTION_SOURCE, /payout_provider_mode: providerMode/);
  assert.doesNotMatch(QUEUE_EXECUTION_SOURCE, /payout_provider_mode: 'test'/);
  assert.match(QUEUE_EXECUTION_SOURCE, /planSandboxAppPayoutTransfer/);
  assert.match(QUEUE_EXECUTION_SOURCE, /eventType: 'payout\.released'/);
});

test('app billing migration records INR charges and India payout rails', () => {
  assert.match(BASELINE_SCHEMA, /CREATE TABLE public\.app_billing_charges/);
  assert.match(BASELINE_SCHEMA, /app_billing_charges_billing_mode_check[\s\S]*'recurring'::text, 'usage'::text/);
  assert.match(BASELINE_SCHEMA, /currency text DEFAULT 'INR'::text NOT NULL/);
  assert.match(BASELINE_SCHEMA, /partner_gst_minor integer DEFAULT 0 NOT NULL/);
  assert.match(BASELINE_SCHEMA, /payout_rail text DEFAULT 'razorpay_route'::text NOT NULL/);
  assert.match(BASELINE_SCHEMA, /app_billing_charges_site_id_idempotency_key_key UNIQUE \(site_id, idempotency_key\)/);
  assert.match(BASELINE_SCHEMA, /update_app_billing_charges_updated_at[\s\S]*EXECUTE FUNCTION public\.update_updated_at\(\)/);
  assert.match(PRICING_POLICY_MIGRATION, /ALTER COLUMN revenue_share_bps SET DEFAULT 8500/);
  assert.match(PRICING_POLICY_MIGRATION, /partner_payout_ledger_entries_charge_id_fkey/);
  assert.match(PRICING_POLICY_MIGRATION, /partner_payout_ledger_entries_source_event_id_fkey/);
});
