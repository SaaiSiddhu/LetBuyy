// LB-10 dispatch: preserve compatible templates/jobs while the canonical402 trigger
// captures one transactional intent and the existing platform queue consumes it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8');
const producer = read('services/api-gateway/src/lib/order-confirmation-email.ts');
const orders = read('services/api-gateway/src/routes/orders.ts');
const worker = read('services/queue-workers/src/index.ts');
const lifecycle=read('database/supabase/migrations/402_atomic_order_lifecycle_email.sql');
const consumer=read('services/queue-workers/src/platform-queue-consumer.ts');

test('LB-10: order-confirmation-email exports enqueueOrderLifecycleEmail for cancelled + refunded', () => {
  assert.match(producer, /export async function enqueueOrderLifecycleEmail/);
  assert.match(producer, /export type OrderLifecycleEmailKind = 'cancelled' \| 'refunded'/);
  // produces the matching job types
  assert.match(producer, /'email\.order_cancelled'/);
  assert.match(producer, /'email\.order_refunded'/);
});

test('LB-10: the producer renders a real recipient email (subject + greeting) and bails without an address', () => {
  // buildOrderLifecycleEmail returns null when there is no customer_email, mirroring order_confirmation
  assert.match(producer, /function buildOrderLifecycleEmail/);
  assert.match(producer, /if \(!recipient\) return null/);
  assert.match(producer, /Order \$\{orderLabel\} cancelled/);
  assert.match(producer, /Refund issued for order \$\{orderLabel\}/);
  // refunded uses the refund amount (falls back to order total)
  assert.match(producer, /money\(refundAmount \?\? order\.total, currency\)/);
});

test('LB-10: order transitions capture the email intent in the same database transaction', () => {
  const handler = orders.slice(orders.indexOf("router.patch('/:id'"));
  assert.match(handler,/await service\.transitionStatus\(orderId, tenant, body\.status, body\)/);
  assert.match(lifecycle,/CREATE CONSTRAINT TRIGGER order_lifecycle_email_v1 AFTER INSERT OR UPDATE ON public\.orders\s+DEFERRABLE INITIALLY DEFERRED/);
  assert.match(lifecycle,/WHEN o\.status='cancelled' THEN 'cancelled'/);
  assert.match(lifecycle,/WHEN o\.refund_status IS DISTINCT FROM OLD\.refund_status THEN 'refund_updated'/);
  assert.match(lifecycle,/INSERT INTO public\.outbox_events[\s\S]*?'order\.lifecycle_email_queued'/);
  assert.doesNotMatch(orders,/await enqueueOrderLifecycleEmail\(/,'a second post-commit sender would duplicate the canonical trigger');
});

test('LB-10: the queue worker treats the cancelled/refunded jobs as transactional emails', () => {
  const fn = worker.slice(worker.indexOf('function isTransactionalEmailJob'), worker.indexOf('function isTransactionalEmailJob') + 320);
  assert.match(fn, /jobType === 'email\.order_cancelled'/);
  assert.match(fn, /jobType === 'email\.order_refunded'/);
  assert.match(consumer,/job\.job_type==='order\.lifecycle_email_queued'\)return sendOrderLifecycleEmail\(rpc,this\.env,job,workerId\)/);
});

// Dispatch-gap closure: every terminal cancel/refund path (not just PATCH /:id) must notify the customer.
test('LB-10: canonical refund completion uses the same transactional intent without a second sender', () => {
  const completeHandler = orders.slice(
    orders.indexOf("router.post('/:id/refund/complete'"),
    orders.indexOf("router.post('/:id/refund'"),
  );
  assert.match(completeHandler,/await service\.completeRefund\(orderId, tenant, body, stepUp\.metadata\)/);
  assert.match(lifecycle,/o\.refund_status IS DISTINCT FROM OLD\.refund_status/);
  assert.match(lifecycle,/intent_key:='order-email-v1:'[\s\S]*?txid_current\(\)/);
  assert.doesNotMatch(completeHandler,/await enqueueOrderLifecycleEmail\(/);
});

test('LB-10: both COD cancellation paths update the order covered by the transactional intent trigger', () => {
  const risk = read('services/api-gateway/src/routes/order-risk.ts');
  assert.match(risk,/status: 'cancelled',\s*cod_confirmation_status: 'rejected'/);
  assert.match(risk,/status: 'cancelled',\s*cod_confirmation_status: 'expired'/);
  assert.match(risk,/\.from\('orders'\)\s*\.update\(updates\)/);
  assert.match(risk,/\.from\('orders'\)\s*\.update\(\{\s*status: 'cancelled'/);
  assert.match(lifecycle,/WHEN o\.status='cancelled' THEN 'cancelled'/);
  assert.doesNotMatch(risk,/await enqueueOrderLifecycleEmail\(/);
});
