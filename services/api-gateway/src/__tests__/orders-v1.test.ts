import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const indexSource = readFileSync(new URL('../index.ts', import.meta.url), 'utf8');
const ordersSource = readFileSync(new URL('../routes/orders.ts', import.meta.url), 'utf8');
const orderRiskSource = readFileSync(new URL('../routes/order-risk.ts', import.meta.url), 'utf8');
const schemaSource = readFileSync(new URL('../schemas/order.schema.ts', import.meta.url), 'utf8');
const checkoutCoreSource = readFileSync(new URL('../../../../packages/checkout-core/src/index.ts', import.meta.url), 'utf8');
const migrationSource = readFileSync(new URL('../../../../database/supabase/migrations/147_executable_order_state_risk.sql', import.meta.url), 'utf8');
const rollbackSource = readFileSync(new URL('../../../../database/supabase/rollback/147_executable_order_state_risk.rollback.sql', import.meta.url), 'utf8');
const humanRequiredSource = readFileSync(new URL('../../../../tests/executable/human-required-live-paths.test.mjs', import.meta.url), 'utf8');

test('Task 005 order/risk routes are mounted in the monolith only', () => {
    assert.match(indexSource, /import ordersRouter from '\.\/routes\/orders'/);
    assert.match(indexSource, /import \{ orderCodRouter, orderRiskRouter \} from '\.\/routes\/order-risk'/);
    assert.match(indexSource, /api\.route\('\/orders', ordersRouter\)/);
    assert.match(indexSource, /api\.route\('\/orders', orderCodRouter\)/);
    assert.match(indexSource, /api\.route\('\/risk', orderRiskRouter\)/);
    assert.match(orderRiskSource, /export const orderRiskRouter = new Hono/);
    assert.match(orderRiskSource, /export const orderCodRouter = new Hono/);
    assert.match(orderRiskSource, /orderRiskRouter\.post\('\/assess'/);
    assert.match(orderRiskSource, /orderCodRouter\.post\('\/:id\/cod\/confirm'/);
    assert.match(orderRiskSource, /orderCodRouter\.post\('\/:id\/cod\/timeout'/);
});

test('Task 005 risk is heuristic and COD confirmation is sandbox WhatsApp gated', () => {
    assert.match(checkoutCoreSource, /export function assessOrderRisk/);
    assert.match(checkoutCoreSource, /prior_rto/);
    assert.match(checkoutCoreSource, /request_cod_confirmation/);
    assert.match(orderRiskSource, /letbuyy_sandbox/);
    assert.match(orderRiskSource, /mode:\s*'sandbox'/);
    assert.match(orderRiskSource, /HR-WHATSAPP-LIVE/);
    assert.match(orderRiskSource, /cod\.confirmation_requested/);
    assert.match(orderRiskSource, /order\.confirmed_cod/);
    assert.match(humanRequiredSource, /HR-WHATSAPP-LIVE/);
    assert.doesNotMatch(orderRiskSource, /fraudMl|fraud_ml|model_provider/i);
    assert.doesNotMatch(orderRiskSource, /mock_whatsapp/);
});

test('Task 005 order schemas expose risk and COD contracts through the gateway facade', () => {
    assert.match(schemaSource, /OrderRiskAssessmentSchema/);
    assert.match(schemaSource, /CodConfirmationSchema/);
    assert.match(schemaSource, /CodTimeoutSchema/);
    assert.match(checkoutCoreSource, /export const OrderRiskAssessmentSchema/);
    assert.match(checkoutCoreSource, /export const CodConfirmationSchema/);
    assert.match(checkoutCoreSource, /export const CodTimeoutSchema/);
    assert.match(checkoutCoreSource, /cancellation_reason: z\.string\(\)\.max\(500\)\.optional\(\)/);
    assert.match(checkoutCoreSource, /metadata\.cancellation_reason/);
    assert.match(ordersSource, /'risk_score'/);
    assert.match(ordersSource, /'risk_level'/);
    assert.match(ordersSource, /'fulfillment_state'/);
    assert.match(ordersSource, /'cod_confirmation_status'/);
    assert.match(ordersSource, /'rto_status'/);
});

test('Task 005 migration adds immutable order state, risk tables, COD requests, RLS, and rollback', () => {
    assert.match(migrationSource, /ADD COLUMN IF NOT EXISTS order_source text/);
    assert.match(migrationSource, /CREATE TABLE IF NOT EXISTS public\.order_risk_assessments/);
    assert.match(migrationSource, /CREATE TABLE IF NOT EXISTS public\.cod_confirmation_requests/);
    assert.match(migrationSource, /prevent_checkout_order_immutable_update/);
    assert.match(migrationSource, /checkout order commercial fields are immutable/);
    assert.match(migrationSource, /ALTER TABLE public\.orders FORCE ROW LEVEL SECURITY/);
    assert.match(migrationSource, /ALTER TABLE public\.fulfillment_orders FORCE ROW LEVEL SECURITY/);
    assert.match(migrationSource, /ALTER TABLE public\.returns FORCE ROW LEVEL SECURITY/);
    assert.match(migrationSource, /public\.current_site_id\(\)/);
    assert.doesNotMatch(migrationSource, /PARTITION BY/i);
    assert.match(rollbackSource, /DROP TABLE IF EXISTS public\.cod_confirmation_requests/);
    assert.match(rollbackSource, /DROP COLUMN IF EXISTS order_source/);
    assert.match(rollbackSource, /pending_cod/);
});
