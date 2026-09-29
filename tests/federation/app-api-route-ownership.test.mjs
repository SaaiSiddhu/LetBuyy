import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  APP_API_ROUTE_CLASSES,
  APP_API_ROUTE_RATCHET,
  classifyAppApiRoute,
  inventoryViolations,
  listAppApiRoutes,
  ownershipCounts,
} from '../../scripts/validators/app-api-route-inventory.mjs';

function read(path) {
  return readFileSync(path, 'utf8');
}

// The route count used to be mirrored as a literal in five tests (189, 188, 188, 188 ...), each of which
// went stale the first time the count moved, so the check was a source-text match on a number nobody
// maintained. The ratchet now lives once, in scripts/validators/app-api-route-inventory.mjs; these tests
// enforce what the number stands for: every route on disk is classified, none is listed twice, the count
// matches the reviewed ratchet, the classes are the known ones, and drift is rejected.
test('app-local API route ownership is validator-enforced', () => {
  const validator = read('scripts/validators/domain-boundary-validator.mjs');
  const inventory = read('scripts/validators/app-api-route-inventory.mjs');
  const doc = read('docs/governance/app-api-route-ownership.md');

  assert.match(doc, /P4-4 API Ownership Consolidation/);
  assert.match(doc, /gateway-proxy/);
  assert.match(doc, /app-local-session/);
  assert.match(doc, /blocked-local-safety/);
  assert.match(validator, /inventoryViolations\(appApiRoutes\)/, 'the validator delegates the ratchet and classification to the inventory module');
  assert.match(inventory, /export const APP_API_ROUTE_RATCHET = \d+;/);
  assert.match(validator, /directDbOrProviderMutationPattern/);
  assert.match(validator, /appLocalCommerceLogicPattern/);
  assert.match(validator, /Storefront app API routes must call the typed gateway client directly, not customer-service helpers/);
});

test('domain boundary validator rejects app-local API ownership drift', () => {
  const result = spawnSync(process.execPath, ['scripts/validators/domain-boundary-validator.mjs'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, new RegExp(`${APP_API_ROUTE_RATCHET} app API route ownership records checked`));

  // The tree is in lockstep with the ratchet, with no unclassified or duplicated route.
  const routes = listAppApiRoutes();
  assert.equal(routes.length, APP_API_ROUTE_RATCHET);
  assert.deepEqual(inventoryViolations(routes), []);

  // ... and every kind of drift is refused, without touching the tree.
  const stray = 'apps/commerce/web/src/app/api/zz-unreviewed/route.ts';
  const unclassifiable = 'apps/marketplace/mobile/src/app/api/zz-unreviewed/route.ts';
  const violations = (list) => inventoryViolations(list).join('\n');
  assert.match(violations([...routes, stray]), new RegExp(`expected ${APP_API_ROUTE_RATCHET}, found ${APP_API_ROUTE_RATCHET + 1}`), 'an added route needs a reviewed ratchet bump');
  assert.match(violations(routes.slice(1)), new RegExp(`expected ${APP_API_ROUTE_RATCHET}, found ${APP_API_ROUTE_RATCHET - 1}`), 'a removed route needs a reviewed ratchet bump');
  assert.match(violations([...routes, unclassifiable]), /lacks ownership classification/, 'a route no rule classifies is refused');
  assert.match(violations([...routes.slice(1), unclassifiable]), /lacks ownership classification/, 'a swap that keeps the count still fails on classification');
  assert.match(violations([...routes, routes[0]]), /listed twice/, 'a duplicate registration is refused');
});

test('every route class is a known class, and the sensitive classes hold exactly what was reviewed', () => {
  const routes = listAppApiRoutes();
  const counts = ownershipCounts(routes);
  for (const classification of counts.keys()) {
    assert.ok(APP_API_ROUTE_CLASSES.includes(classification), `${classification} is a known route class`);
  }
  assert.ok(counts.get('gateway-proxy') > 0);
  // The two routes a local safety block exists for; a third one must be a decision, not an accident.
  assert.deepEqual(
    routes.filter((route) => classifyAppApiRoute(route) === 'blocked-local-safety'),
    ['apps/commerce/web/src/app/api/seed/route.ts', 'apps/commerce/web/src/app/api/themes/install/route.ts'],
  );
  // Each app-local class is an exception to "backend behaviour lives in the gateway" and is allowlisted one
  // route at a time in config/eslint/boundary-baseline.json (letbuyy-boundaries/no-new-next-api-route).
  const baseline = new Set(JSON.parse(read('config/eslint/boundary-baseline.json')).apiRoutes);
  const notAllowlisted = routes.filter((route) => String(classifyAppApiRoute(route)).startsWith('app-local-') && !baseline.has(route));
  assert.deepEqual(notAllowlisted, [], 'an app-local route must be individually allowlisted in the boundary baseline');
});

test('storefront auto-create no longer accepts client-controlled order stats', () => {
  const route = read('apps/commerce/web/src/app/api/customer/auto-create/route.ts');
  const checkout = read('apps/commerce/web/src/app/store/[subdomain]/checkout/checkout-client.tsx');

  assert.doesNotMatch(route, /orderTotal|order_total|orderId|updateCustomerStats|@\/lib\/customer-service/);
  assert.match(route, /createStorefrontApiClient\(\)\.storefront\.findOrCreateCustomer/);
  assert.doesNotMatch(checkout, /orderTotal:|orderId: order\?\.id/);
});
