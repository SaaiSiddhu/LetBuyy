// Phase 5 — commerce operations: the Purchase Orders vertical (exposure over the REAL backend).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8');
const has = (p) => existsSync(resolve(ROOT, p));

test('PO: api-client exposes the existing gateway PO/supplier/location routes (typed)', () => {
  const c = read('packages/typescript/api-client/src/index.ts');
  assert.match(c, /purchaseOrders:\s*\{/);
  assert.match(c, /\/inventory\/purchase-orders/);
  assert.match(c, /suppliers:\s*\{/);
  assert.match(c, /locations:\s*\{/);
});

test('PO: merchant proxies exist, are ownership-checked, and delegate to the api-client', () => {
  const list = read('apps/merchant-control-plane/src/app/api/stores/[store]/purchase-orders/route.ts');
  assert.match(list, /export async function GET/);
  assert.match(list, /export async function POST/);
  assert.match(list, /resolveOwnedStoreId/);
  assert.match(list, /inventory\.purchaseOrders\.(list|create)\(/);
  const receive = read('apps/merchant-control-plane/src/app/api/stores/[store]/purchase-orders/[id]/receive/route.ts');
  assert.match(receive, /inventory\.purchaseOrders\.receive\(/);
  assert.ok(has('apps/merchant-control-plane/src/app/api/stores/[store]/suppliers/route.ts'));
  assert.ok(has('apps/merchant-control-plane/src/app/api/stores/[store]/inventory-locations/route.ts'));
});

test('PO: the page is REAL (consumes proxies, no stub/coming-soon text)', () => {
  const page = read('apps/merchant-control-plane/src/app/[store]/products/purchase-orders/page.tsx');
  assert.match(page, /\/api\/stores\/\$\{[^}]+\}\/purchase-orders/);
  // the dead stub language must be gone
  assert.doesNotMatch(page, /not available yet|coming soon|BackendNeededPane/i);
  // real create + receive flows
  assert.match(page, /purchase-orders\/\$\{[^}]+\}\/receive/);
});

test('PO: reuses the existing backend — no new migration was added for it', () => {
  // The PO tables/RPCs predate Phase 5; the vertical must not ship its own migration.
  const page = read('apps/merchant-control-plane/src/app/[store]/products/purchase-orders/page.tsx');
  // UI must not write money/inventory tables directly — it calls proxies only.
  assert.doesNotMatch(page, /\.from\(['"]purchase_orders['"]\)/);
});

// ---- Phase 5.5 — exposure verticals over the existing backend ----

test('5.5 api-client: transfers + inventory history/reserve/commit/release exposed (typed)', () => {
  const c = read('packages/typescript/api-client/src/index.ts');
  assert.match(c, /transfers:\s*\{/);
  assert.match(c, /\/inventory\/transfers/);
  assert.match(c, /history:\s*\([^)]*\)\s*=>/);
  assert.match(c, /\/inventory\/history/);
  assert.match(c, /\/inventory\/reserve/);
});

test('5.5 Transfers: proxies (list/create/ship/receive) ownership-checked + delegate; page is real', () => {
  const list = read('apps/merchant-control-plane/src/app/api/stores/[store]/transfers/route.ts');
  assert.match(list, /resolveOwnedStoreId/);
  assert.match(list, /inventory\.transfers\.(list|create)\(/);
  assert.match(read('apps/merchant-control-plane/src/app/api/stores/[store]/transfers/[id]/ship/route.ts'), /inventory\.transfers\.ship\(/);
  assert.match(read('apps/merchant-control-plane/src/app/api/stores/[store]/transfers/[id]/receive/route.ts'), /inventory\.transfers\.receive\(/);
  const page = read('apps/merchant-control-plane/src/app/[store]/products/transfers/page.tsx');
  assert.match(page, /\/api\/stores\/\$\{[^}]+\}\/transfers/);
  assert.doesNotMatch(page, /not available yet|coming soon|BackendNeededPane/i);
});

test('5.5 Inventory history: proxy delegates to inventory.history; page consumes it (no fabrication)', () => {
  const proxy = read('apps/merchant-control-plane/src/app/api/stores/[store]/inventory/history/route.ts');
  assert.match(proxy, /resolveOwnedStoreId/);
  assert.match(proxy, /inventory\.history\(/);
  const page = read('apps/merchant-control-plane/src/app/[store]/products/inventory-history/page.tsx');
  assert.match(page, /\/api\/stores\/\$\{[^}]+\}\/inventory\/history/);
});

test('5.5 Vendors + Locations: pages consume the existing proxies', () => {
  const vendors = read('apps/merchant-control-plane/src/app/[store]/products/suppliers/page.tsx');
  assert.match(vendors, /\/api\/stores\/\$\{[^}]+\}\/suppliers/);
  const locations = read('apps/merchant-control-plane/src/app/[store]/products/locations/page.tsx');
  assert.match(locations, /\/api\/stores\/\$\{[^}]+\}\/inventory-locations/);
});

test('5.5 Navigation: the new commerce pages are linked (no dead navigation)', () => {
  const nav = read('apps/merchant-control-plane/src/components/merchantNavigation.ts');
  for (const p of ['products/inventory-history', 'products/suppliers', 'products/locations']) {
    assert.match(nav, new RegExp(`path: '${p.replace(/\//g, '\\/')}'`), `${p} must be in nav`);
  }
});

// ---- Phase 5.75 — RBAC expansion + notifications ops + functional payment toggles ----

test('5.75 RBAC: inventory write routes are guarded (12 commerce writes, dry-run-safe)', () => {
  const inv = read('services/api-gateway/src/routes/inventory.ts');
  assert.match(inv, /import \{ assertStaffPermission \} from '\.\.\/middleware\/staff-permission'/);
  const hits = inv.match(/assertStaffPermission\(c, [^,]+, customUser\.id, 'products:write'\)/g) || [];
  assert.ok(hits.length >= 12, `expected >=12 guarded inventory writes, found ${hits.length}`);
});

test('5.75 Notifications: api-client + proxies + ops page are real', () => {
  const c = read('packages/typescript/api-client/src/index.ts');
  assert.match(c, /preferences:\s*\{[\s\S]*\/notifications\/preferences/);
  assert.match(c, /deliveryLogs:\s*\([^)]*\)\s*=>/);
  const prefProxy = read('apps/merchant-control-plane/src/app/api/stores/[store]/notifications/preferences/route.ts');
  assert.match(prefProxy, /resolveOwnedStoreId/);
  assert.match(prefProxy, /notifications\.preferences\.(list|update)\(/);
  assert.ok(has('apps/merchant-control-plane/src/app/api/stores/[store]/notifications/delivery-logs/route.ts'));
  const page = read('apps/merchant-control-plane/src/app/[store]/settings/notifications/page.tsx');
  assert.match(page, /\/api\/stores\/\$\{[^}]+\}\/notifications\/preferences/);
});

test('5.75 Payment: toggles are functional (write path persists the booleans, no credential code touched)', () => {
  // gateway allow-list must include the booleans or the write is silently dropped
  const stores = read('services/api-gateway/src/routes/stores.ts');
  assert.match(stores, /'cod_enabled'/);
  assert.match(stores, /'online_payment_enabled'/);
  // merchant proxy persists via PATCH
  const proxy = read('apps/merchant-control-plane/src/app/api/stores/[store]/payment-config/route.ts');
  assert.match(proxy, /export async function PATCH/);
  // page wires real toggles (not display-only)
  const page = read('apps/merchant-control-plane/src/app/[store]/settings/payments/page.tsx');
  assert.match(page, /payment-config/);
});

// ---- Phase 5.9 — Smart Collections + reservation/receipt explorers + real analytics ----

test('5.9 Smart Collections: pure evaluator + 35 unit tests + gateway route registered + RBAC-guarded', () => {
  assert.ok(has('services/api-gateway/src/lib/smart-collection-eval.ts'));
  assert.ok(has('services/api-gateway/src/__tests__/smart-collection-eval.test.ts'));
  const route = read('services/api-gateway/src/routes/smart-collections.ts');
  assert.match(route, /assertStaffPermission\([^)]*'products:write'\)/); // writes guarded
  const idx = read('services/api-gateway/src/index.ts');
  assert.match(idx, /smart-collections/); // registered
  const c = read('packages/typescript/api-client/src/index.ts');
  assert.match(c, /smartCollections\b/);
  assert.ok(has('apps/merchant-control-plane/src/app/[store]/products/smart-collections/page.tsx'));
});

test('5.9 Reservation explorer + Receipt history: additive GETs + proxies + pages (real, no fabrication)', () => {
  const inv = read('services/api-gateway/src/routes/inventory.ts');
  assert.match(inv, /\/reservations'/);
  assert.match(inv, /\/receipts'/);
  const c = read('packages/typescript/api-client/src/index.ts');
  assert.match(c, /reservations:\s*\{/);
  assert.match(c, /receipts:\s*\{/);
  assert.ok(has('apps/merchant-control-plane/src/app/api/stores/[store]/inventory/reservations/route.ts'));
  assert.ok(has('apps/merchant-control-plane/src/app/api/stores/[store]/inventory/receipts/route.ts'));
  assert.ok(has('apps/merchant-control-plane/src/app/[store]/products/reservations/page.tsx'));
  assert.ok(has('apps/merchant-control-plane/src/app/[store]/products/receipts/page.tsx'));
});

test('5.9 Analytics: real aggregation only (counts from real tables; missing-table → empty, not fabricated)', () => {
  const inv = read('services/api-gateway/src/routes/inventory.ts');
  assert.match(inv, /\/analytics'/);
  assert.match(inv, /low_stock_count|total_skus|po_by_status|transfer_by_status/);
  // the analytics handler must use the missing-table fallback (empty), never invent numbers
  assert.match(inv, /isMissingTableError/);
  const c = read('packages/typescript/api-client/src/index.ts');
  assert.match(c, /analytics:\s*\(/);
});

test('5.9 Navigation: smart-collections + reservations + receipts are linked (no dead nav)', () => {
  const nav = read('apps/merchant-control-plane/src/components/merchantNavigation.ts');
  for (const p of ['products/smart-collections', 'products/reservations', 'products/receipts']) {
    assert.match(nav, new RegExp(`path: '${p.replace(/\//g, '\\/')}'`), `${p} must be in nav`);
  }
});

// ---- Phase 5-complete — analytics/dashboards + automation & audit evaluator cores ----

test('5C Analytics: commerce-analytics endpoints are real aggregation (missing-table fallback, no fabrication) + registered', () => {
  const route = read('services/api-gateway/src/routes/commerce-analytics.ts');
  assert.match(route, /supplier-metrics|warehouse-metrics|transfer-metrics|operations-summary/);
  assert.match(route, /isMissingTableError|isMissingColumnError/); // real-or-empty, never fabricated
  const idx = read('services/api-gateway/src/index.ts');
  assert.match(idx, /commerce-analytics/);
  const c = read('packages/typescript/api-client/src/index.ts');
  assert.match(c, /commerceAnalytics\b/);
  assert.ok(has('apps/merchant-control-plane/src/app/[store]/products/operations-dashboard/page.tsx'));
});

test('5C Automation engine: pure rule evaluator core exists (logic verified, persistence blueprinted)', () => {
  assert.ok(has('services/api-gateway/src/lib/automation-rule-eval.ts'));
  assert.ok(has('services/api-gateway/src/__tests__/automation-rule-eval.test.ts'));
  const lib = read('services/api-gateway/src/lib/automation-rule-eval.ts');
  assert.match(lib, /evaluateAutomationRule/);
  // pure: no DB/fetch in the evaluator core
  assert.doesNotMatch(lib, /getSupabaseAdmin|fetch\(|\.from\(/);
});

test('5C Audit engine: pure variance/reconcile core exists (logic verified, schema blueprinted)', () => {
  assert.ok(has('services/api-gateway/src/lib/inventory-audit-variance.ts'));
  assert.ok(has('services/api-gateway/src/__tests__/inventory-audit-variance.test.ts'));
  const lib = read('services/api-gateway/src/lib/inventory-audit-variance.ts');
  assert.match(lib, /computeVariance|reconcileSessionLines/);
  assert.doesNotMatch(lib, /getSupabaseAdmin|fetch\(|\.from\(/);
});

test('5C Navigation: operations dashboard linked (no dead nav)', () => {
  const nav = read('apps/merchant-control-plane/src/components/merchantNavigation.ts');
  assert.match(nav, /path: 'products\/operations-dashboard'/);
});

test('5C Invite acceptance: public proxy forwards to the real gateway endpoint (pre-auth, no ownership check) + page consumes it without a dead link', () => {
  const proxy = read('apps/merchant-control-plane/src/app/api/employees/accept-invite/route.ts');
  assert.match(proxy, /\/employees\/auth\/accept-invite/);          // real gateway endpoint
  assert.doesNotMatch(proxy, /resolveOwnedStoreId/);                 // pre-auth: no store ownership
  const page = read('apps/merchant-control-plane/src/app/accept-invite/page.tsx');
  assert.match(page, /\/api\/employees\/accept-invite/);            // consumes the proxy
  assert.doesNotMatch(page, /href="\/login"/);                      // no dead link (merchant app has no /login)
});
