import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');

function repoPath(path) {
  return join(repoRoot, path);
}

const APP_STORE_ROUTE_SOURCES = [
  'services/api-gateway/src/routes/app-store.ts',
  'services/api-gateway/src/routes/app-store/extension-routes.ts',
  'services/api-gateway/src/routes/app-store/billing-oauth-routes.ts',
  // F-ROUTELEN-5: billing-oauth-routes.ts was 22 lines under the route-file limit, so
  // activateExpiredTrialCharge — which emits the app.charge.activated outbox row — moved here.
  // This guard caught that move, which is what it is for: the marker must stay inside the
  // app-store split, and the split now has one more module.
  'services/api-gateway/src/routes/app-store/billing-trial.ts',
  'services/api-gateway/src/routes/app-store/install-lifecycle-routes.ts',
  'services/api-gateway/src/routes/app-store/compliance-routes.ts',
  'services/api-gateway/src/routes/app-store/developer-tooling-routes.ts',
  'services/api-gateway/src/routes/app-store/developer-routes.ts',
  'services/api-gateway/src/routes/app-store/shared.ts',
];

export function readAppStoreRouteSource() {
  return APP_STORE_ROUTE_SOURCES
    .map(repoPath)
    .filter((path) => existsSync(path))
    .map((path) => readFileSync(path, 'utf8'))
    .join('\n');
}

export function readAppStoreRootSource() {
  return readFileSync(repoPath('services/api-gateway/src/routes/app-store.ts'), 'utf8');
}

const STOREFRONT_ROUTE_SOURCES = [
  'services/api-gateway/src/routes/storefront.ts',
  'services/api-gateway/src/routes/storefront/internal-payment-routes.ts',
  'services/api-gateway/src/routes/storefront/public-routes.ts',
  'services/api-gateway/src/routes/storefront/checkout-payment-routes.ts',
  'services/api-gateway/src/routes/storefront/customer-engagement-routes.ts',
];

export function readStorefrontRouteSource() {
  return STOREFRONT_ROUTE_SOURCES
    .map(repoPath)
    .filter((path) => existsSync(path))
    .map((path) => readFileSync(path, 'utf8'))
    .join('\n');
}

export function readStorefrontRootSource() {
  return readFileSync(repoPath('services/api-gateway/src/routes/storefront.ts'), 'utf8');
}
