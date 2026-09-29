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
});

// The freeze rule (letbuyy-boundaries/no-new-next-api-route) reports EVERY app API route file that is absent from
// config/eslint/boundary-baseline.json, whatever its class -- gateway-proxy included. This test used to check only the
// app-local-* classes, on the belief (repeated in the inventory's change log) that the baseline was "for app-local-*
// only"; the lint lane disagreed and stayed red on four proxies for weeks with nothing else naming the cause. The two
// lists are one fact stated twice, so they must be equal: a route missing from the baseline is a lint error nobody
// reviewed, and a baseline entry with no route is a stale exemption that would silently pre-approve a future route.
test('the ESLint route baseline and the route inventory list exactly the same routes', () => {
  const baseline = JSON.parse(read('config/eslint/boundary-baseline.json')).apiRoutes;
  assert.equal(new Set(baseline).size, baseline.length, 'the baseline lists no route twice');
  const inventory = listAppApiRoutes();
  const baselineSet = new Set(baseline);
  const inventorySet = new Set(inventory);
  assert.deepEqual(inventory.filter((route) => !baselineSet.has(route)), [],
    'every inventoried route must be in config/eslint/boundary-baseline.json (add it in the same reviewed change as the ratchet bump)');
  assert.deepEqual(baseline.filter((route) => !inventorySet.has(route)), [],
    'every baseline entry must be a route that exists (remove the entry in the same change that removes the route)');
  assert.equal(baseline.length, APP_API_ROUTE_RATCHET, 'the baseline and the ratchet count agree');
});

test('storefront auto-create no longer accepts client-controlled order stats', () => {
  const route = read('apps/commerce/web/src/app/api/customer/auto-create/route.ts');
  const checkout = read('apps/commerce/web/src/app/store/[subdomain]/checkout/checkout-client.tsx');

  assert.doesNotMatch(route, /orderTotal|order_total|orderId|updateCustomerStats|@\/lib\/customer-service/);
  assert.match(route, /createStorefrontApiClient\(\)\.storefront\.findOrCreateCustomer/);
  assert.doesNotMatch(checkout, /orderTotal:|orderId: order\?\.id/);
});
