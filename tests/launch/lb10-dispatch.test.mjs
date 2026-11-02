// LB-10 dispatch follows the canonical transactional order-email outbox.
// The earlier direct route enqueue was retired when migration 402 made the
// order mutation and delivery intent one database transaction.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (path) => readFileSync(resolve(ROOT, path), 'utf8');
const capture = read('database/supabase/migrations/402_atomic_order_lifecycle_email.sql');
const orders = read('services/api-gateway/src/routes/orders.ts');
const risk = read('services/api-gateway/src/routes/order-risk.ts');
const worker = read('services/queue-workers/src/platform-queue-consumer.ts');
const delivery = read('services/queue-workers/src/order-lifecycle-email.ts');

test('LB-10: order changes capture one transactional, immutable-context email intent', () => {
  assert.match(capture, /CREATE CONSTRAINT TRIGGER order_lifecycle_email_v1 AFTER INSERT OR UPDATE ON public\.orders\s+DEFERRABLE INITIALLY DEFERRED/);
  assert.match(capture, /intent_key:='order-email-v1:'\|\|o\.store_id::text\|\|':'\|\|o\.id::text\|\|':'\|\|txid_current\(\)::text/);
  assert.match(capture, /WHEN o\.status='cancelled' THEN 'cancelled'/);
  assert.match(capture, /WHEN o\.refund_status IS DISTINCT FROM OLD\.refund_status THEN 'refund_updated'/);
  assert.match(capture, /'store_name',s\.name/);
  assert.match(capture, /INSERT INTO public\.email_logs[\s\S]*?INSERT INTO public\.outbox_events[\s\S]*?'order\.lifecycle_email_queued'/);
});

test('LB-10: merchant transitions and refund completion use the order mutation trigger without a second sender', () => {
  assert.match(orders, /const data = await service\.transitionStatus\(orderId, tenant, body\.status, body\)/);
  assert.match(orders, /const \{data,replayed\} = await service\.completeRefund\(orderId, tenant, body, stepUp\.metadata\)/);
  assert.doesNotMatch(orders, /enqueueOrderLifecycleEmail\(/);
});

test('LB-10: COD reject and timeout both persist cancellation through the order table', () => {
  const reject = risk.slice(risk.indexOf("orderCodRouter.post('/:id/cod/confirm'"), risk.indexOf("orderCodRouter.post('/:id/cod/timeout'"));
  const timeout = risk.slice(risk.indexOf("orderCodRouter.post('/:id/cod/timeout'"));
  assert.match(reject, /status: 'cancelled'[\s\S]*?\.from\('orders'\)\s*\.update\(updates\)/);
  assert.match(timeout, /\.from\('orders'\)\s*\.update\(\{[\s\S]*?status: 'cancelled'/);
  for (const path of [reject, timeout]) assert.match(path, /\.eq\('store_id', tenant\.siteId\)/);
  assert.doesNotMatch(risk, /enqueueOrderLifecycleEmail\(/);
});

test('LB-10: the existing queue worker sends only a leased snapshot and records the provider receipt', () => {
  assert.match(worker, /job\.job_type==='order\.lifecycle_email_queued'\)return sendOrderLifecycleEmail\(rpc,this\.env,job,workerId\)/);
  assert.match(delivery, /db\.rpc\('order_lifecycle_email_delivery_v1'/);
  assert.match(delivery, /db\.rpc\('seal_order_lifecycle_email_message_v1'/);
  assert.match(delivery, /sendResendEmail\(/);
  assert.match(delivery, /db\.rpc\('complete_order_lifecycle_email_v1'/);
});
