import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');

function repoPath(path) {
  return join(repoRoot, path);
}

// A route tree's source is the root module, then the modules split out beside it in registration order
// (some contract tests assert that order, so it is kept explicit), then EVERY other module in the
// directory. The lists this replaced were hand-kept and skipped any file that no longer existed: a module
// split out of the root (F-ROUTELEN-5 moved the trial activation into billing-trial.ts; the blog routes
// went to storefront-blog-routes.ts) silently left the search space, so a positive marker check went red
// because the code had moved and a negative one would have gone green for the same reason. Now a module
// added to the directory is searched the day it appears, and a listed module that does not exist is an
// error rather than a silent omission.
function routeTreeSource(rootFile, directory, orderedModules) {
  const onDisk = readdirSync(repoPath(directory)).filter((name) => name.endsWith('.ts')).map((name) => `${directory}/${name}`);
  const missing = orderedModules.filter((module) => !onDisk.includes(module));
  if (missing.length > 0) throw new Error(`the ordered route-module list names module(s) that do not exist: ${missing.join(', ')}`);
  const unlisted = onDisk.filter((module) => !orderedModules.includes(module)).sort();
  return [rootFile, ...orderedModules, ...unlisted].map((path) => readFileSync(repoPath(path), 'utf8')).join('\n');
}

const APP_STORE_DIR = 'services/api-gateway/src/routes/app-store';
const APP_STORE_MODULES_IN_REGISTRATION_ORDER = [
  `${APP_STORE_DIR}/extension-routes.ts`,
  `${APP_STORE_DIR}/billing-oauth-routes.ts`,
  // F-ROUTELEN-5: billing-oauth-routes.ts was 22 lines under the route-file limit, so
  // activateExpiredTrialCharge — which emits the app.charge.activated outbox row — moved here.
  // This guard caught that move, which is what it is for: the marker must stay inside the
  // app-store split, and the split now has one more module.
  `${APP_STORE_DIR}/billing-trial.ts`,
  `${APP_STORE_DIR}/install-lifecycle-routes.ts`,
  `${APP_STORE_DIR}/compliance-routes.ts`,
  `${APP_STORE_DIR}/developer-tooling-routes.ts`,
  `${APP_STORE_DIR}/developer-routes.ts`,
  `${APP_STORE_DIR}/shared.ts`,
];

export function readAppStoreRouteSource() {
  return routeTreeSource('services/api-gateway/src/routes/app-store.ts', APP_STORE_DIR, APP_STORE_MODULES_IN_REGISTRATION_ORDER);
}

export function readAppStoreRootSource() {
  return readFileSync(repoPath('services/api-gateway/src/routes/app-store.ts'), 'utf8');
}

const STOREFRONT_DIR = 'services/api-gateway/src/routes/storefront';
const STOREFRONT_MODULES_IN_REGISTRATION_ORDER = [
  `${STOREFRONT_DIR}/internal-payment-routes.ts`,
  `${STOREFRONT_DIR}/public-routes.ts`,
  `${STOREFRONT_DIR}/checkout-payment-routes.ts`,
  `${STOREFRONT_DIR}/customer-engagement-routes.ts`,
];

export function readStorefrontRouteSource() {
  return routeTreeSource('services/api-gateway/src/routes/storefront.ts', STOREFRONT_DIR, STOREFRONT_MODULES_IN_REGISTRATION_ORDER);
}

export function readStorefrontRootSource() {
  return readFileSync(repoPath('services/api-gateway/src/routes/storefront.ts'), 'utf8');
}
