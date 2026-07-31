// LB-10 dispatch — the cancelled/refunded templates (lb10-order-emails) now need a producer that renders +
// enqueues the email, the orders status-update handler must invoke it, and the worker must recognise the jobs.
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

test('LB-10: the order status-update handler dispatches the lifecycle email for cancelled/refunded', () => {
  assert.match(orders, /import \{ enqueueOrderLifecycleEmail \} from '\.\.\/lib\/order-confirmation-email'/);
  // wired inside the PATCH /:id transition, gated on the terminal statuses, best-effort (try/catch)
  assert.match(orders, /body\.status === 'cancelled' \|\| body\.status === 'refunded'/);
  const handler = orders.slice(orders.indexOf("router.patch('/:id'"));
  assert.match(handler, /await enqueueOrderLifecycleEmail\(c\.env, db, \{[\s\S]{0,200}kind: body\.status/);
});

test('LB-10: the queue worker treats the cancelled/refunded jobs as transactional emails', () => {
  const fn = worker.slice(worker.indexOf('function isTransactionalEmailJob'), worker.indexOf('function isTransactionalEmailJob') + 320);
  assert.match(fn, /jobType === 'email\.order_cancelled'/);
  assert.match(fn, /jobType === 'email\.order_refunded'/);
});

// Dispatch-gap closure: every terminal cancel/refund path (not just PATCH /:id) must notify the customer.
test('LB-10: the canonical refund/complete path also dispatches the refunded email', () => {
  const completeHandler = orders.slice(
    orders.indexOf("router.post('/:id/refund/complete'"),
    orders.indexOf("router.post('/:id/refund'"),
  );
  assert.match(completeHandler, /enqueueOrderLifecycleEmail\(c\.env, db, \{[\s\S]{0,160}kind: 'refunded'/);
});

test('LB-10: both COD cancellation paths (reject + timeout) dispatch the cancelled email', () => {
  const risk = read('services/api-gateway/src/routes/order-risk.ts');
  assert.match(risk, /import \{ enqueueOrderLifecycleEmail \} from '\.\.\/lib\/order-confirmation-email'/);
  const matches = risk.match(/enqueueOrderLifecycleEmail\(c\.env, db, \{[\s\S]{0,160}kind: 'cancelled'/g) || [];
  assert.ok(matches.length >= 2, 'COD reject and COD timeout must each enqueue the cancelled email');
});
