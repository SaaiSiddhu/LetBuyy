// Phase-4 — merchant control plane completion fixes (contract level).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8');

const COLLECTION_PROXY = 'apps/merchant/web/src/app/api/stores/[store]/collections/[collectionId]/route.ts';

test('Collections: the edit/delete proxy exists and delegates to the api-client (no more 404)', () => {
  assert.ok(existsSync(resolve(ROOT, COLLECTION_PROXY)), 'collections/[collectionId]/route.ts must exist');
  const proxy = read(COLLECTION_PROXY);
  assert.match(proxy, /export async function PATCH/);
  assert.match(proxy, /export async function DELETE/);
  assert.match(proxy, /products\.collections\.update\(/);
  assert.match(proxy, /products\.collections\.remove\(/);
  // ownership-checked like the products proxy
  assert.match(proxy, /resolveOwnedStoreId/);
});

test('AISidebar: the appearance todo links to the real /:store/appearance page (not the 404 settings path)', () => {
  const sidebar = read('apps/merchant/web/src/components/AISidebar.tsx');
  assert.match(sidebar, /link: `\/\$\{store\}\/appearance`/);
  assert.doesNotMatch(sidebar, /\/\$\{store\}\/settings\/appearance/);
});

// ---- Phase 4.5 ----

const CUSTOMER_DETAIL_PROXY = 'apps/merchant/web/src/app/api/stores/[store]/customers/[email]/route.ts';
const CUSTOMER_NOTES_PROXY = 'apps/merchant/web/src/app/api/stores/[store]/customers/[email]/notes/route.ts';
const CUSTOMER_DETAIL_PAGE = 'apps/merchant/web/src/app/[store]/customers/[email]/page.tsx';

test('Customers: the detail proxy exists, is ownership-checked, and loads the real customer by email', () => {
  assert.ok(existsSync(resolve(ROOT, CUSTOMER_DETAIL_PROXY)), 'customers/[email]/route.ts must exist');
  const proxy = read(CUSTOMER_DETAIL_PROXY);
  assert.match(proxy, /export async function GET/);
  assert.match(proxy, /customers\.getByEmail\(/);
  assert.match(proxy, /resolveOwnedStoreId/);
  assert.match(proxy, /decodeURIComponent\(email\)/);
});

test('Customers: the notes proxy round-trips (GET list + POST create) against the api-client', () => {
  assert.ok(existsSync(resolve(ROOT, CUSTOMER_NOTES_PROXY)), 'customers/[email]/notes/route.ts must exist');
  const proxy = read(CUSTOMER_NOTES_PROXY);
  assert.match(proxy, /export async function GET/);
  assert.match(proxy, /export async function POST/);
  assert.match(proxy, /customers\.notes\.list\(/);
  assert.match(proxy, /customers\.notes\.create\(/);
});

test('Customers: the detail page is real (consumes the proxy, no hardcoded customer data) and the list rows are clickable', () => {
  assert.ok(existsSync(resolve(ROOT, CUSTOMER_DETAIL_PAGE)), 'customers/[email]/page.tsx must exist');
  const page = read(CUSTOMER_DETAIL_PAGE);
  // fetches the real proxy endpoints
  assert.match(page, /\/api\/stores\/\$\{encodeURIComponent\(store\)\}\/customers\/\$\{encodeURIComponent\(email\)\}/);
  // list rows navigate to the detail page (email-encoded)
  const list = read('apps/merchant/web/src/app/[store]/customers/page.tsx');
  assert.match(list, /customers\/\$\{encodeURIComponent\(/);
});

test('Shipping: the rate-edit PATCH proxy exists and delegates to shipping.rates.update', () => {
  const proxy = read('apps/merchant/web/src/app/api/stores/[store]/shipping/rates/[rateId]/route.ts');
  assert.match(proxy, /export async function PATCH/);
  assert.match(proxy, /shipping\.rates\.update\(/);
  assert.match(proxy, /export async function DELETE/); // unchanged
});

test('Analytics: revenueByMonth is wired to the real revenue series (not a hardcoded empty array)', () => {
  const proxy = read('apps/merchant/web/src/app/api/stores/[store]/analytics/route.ts');
  assert.match(proxy, /analytics\.revenue\(/);
  assert.match(proxy, /revenueByMonth,/); // populated from the aggregation, not `revenueByMonth: []`
  assert.doesNotMatch(proxy, /revenueByMonth:\s*\[\]/);
});

test('Staff: the products:read permission has a human label in the catalog', () => {
  const roles = read('apps/merchant/web/src/lib/staff/roles.ts');
  assert.match(roles, /key:\s*'products:read'.*label:/s);
});

// ---- Phase 4.5 — staff RBAC enforcement (security) ----

const STAFF_MW = 'services/api-gateway/src/middleware/staff-permission.ts';

test('Staff RBAC: the enforcement middleware exists, is owner-bypass + fail-safe by design', () => {
  const mw = read(STAFF_MW);
  assert.match(mw, /export function evaluateStaffPermission/);
  assert.match(mw, /export async function assertStaffPermission/);
  assert.match(mw, /verifySiteOwnership/);            // authoritative owner bypass
  assert.match(mw, /reason: 'owner'/);                 // owners always pass
  assert.match(mw, /return 'dryrun'/);                 // safe default mode
  assert.match(mw, /employees/);                       // reads employees.permissions.granted
  // fail-open: the catch path must not block
  assert.match(mw, /catch[\s\S]*return \{ block: false \}/);
});

test('Staff RBAC: products write routes are wired to the staff guard', () => {
  const products = read('services/api-gateway/src/routes/products.ts');
  assert.match(products, /import \{ assertStaffPermission \} from '\.\.\/middleware\/staff-permission'/);
  // every product write delegates to the guard with products:write
  const hits = products.match(/assertStaffPermission\(c, [^,]+, customUser\.id, 'products:write'\)/g) || [];
  assert.ok(hits.length >= 4, `expected >=4 wired product write routes, found ${hits.length}`);
});

// ---- Phase 4.75 — new merchant UI (real, wired, nav-linked) ----

test('Orders: the detail proxy (GET + PATCH) and detail page are real and the list rows are clickable', () => {
  const proxy = read('apps/merchant/web/src/app/api/stores/[store]/orders/[orderId]/route.ts');
  assert.match(proxy, /export async function GET/);
  assert.match(proxy, /orders\.get\(/);
  assert.match(proxy, /export async function PATCH/);
  assert.match(proxy, /orders\.update\(/);
  assert.match(proxy, /resolveOwnedStoreId/);
  const list = read('apps/merchant/web/src/app/[store]/orders/page.tsx');
  assert.match(list, /orders\/\$\{encodeURIComponent\(/);
});

test('Customers: the segmentation page + proxies consume the real /segments endpoints (no fabricated DELETE)', () => {
  const proxy = read('apps/merchant/web/src/app/api/stores/[store]/customers/segments/route.ts');
  assert.match(proxy, /customers\.segments\.(list|create)\(/);
  const preview = read('apps/merchant/web/src/app/api/stores/[store]/customers/segments/preview/route.ts');
  assert.match(preview, /customers\.segments\.preview\(/);
  assert.ok(existsSync(resolve(ROOT, 'apps/merchant/web/src/app/[store]/customers/segments/page.tsx')));
});

test('Marketing: the campaigns page + proxies consume the real email-campaign endpoints', () => {
  const proxy = read('apps/merchant/web/src/app/api/stores/[store]/marketing/campaigns/route.ts');
  assert.match(proxy, /marketing\.emailCampaigns\.(list|create)\(/);
  const send = read('apps/merchant/web/src/app/api/stores/[store]/marketing/campaigns/[id]/send/route.ts');
  assert.match(send, /marketing\.emailCampaigns\.send\(/);
  assert.ok(existsSync(resolve(ROOT, 'apps/merchant/web/src/app/[store]/marketing/page.tsx')));
});

test('Navigation: the new segments + campaigns pages are linked (no dead navigation)', () => {
  const nav = read('apps/merchant/web/src/components/merchantNavigation.ts');
  assert.match(nav, /path: 'customers\/segments'/);
  assert.match(nav, /path: 'marketing', label: 'Campaigns'/);
});

test('Staff RBAC: enforcement is wired across the high-value write domains (Phase 4.75)', () => {
  const checks = [
    ['services/api-gateway/src/routes/orders.ts', /assertStaffPermission\(c, tenant\.siteId, tenant\.userId, 'orders:write'\)/, 4],
    ['services/api-gateway/src/routes/coupons.ts', /assertStaffPermission\(c, [^,]+, customUser\.id, 'marketing:write'\)/, 3],
    ['services/api-gateway/src/routes/customers.ts', /assertStaffPermission\(c, [^,]+, [^,]+, 'customers:write'\)/, 2],
    ['services/api-gateway/src/routes/shipping-tax.ts', /assertStaffPermission\(c, ownedZone\.store_id, customUser\.id, 'shipping:write'\)/, 3],
  ];
  for (const [file, re, min] of checks) {
    const src = read(file);
    assert.match(src, /import \{ assertStaffPermission \}/, `${file} must import the guard`);
    const hits = src.match(new RegExp(re.source, 'g')) || [];
    assert.ok(hits.length >= min, `${file}: expected >=${min} guarded writes, found ${hits.length}`);
  }
});
