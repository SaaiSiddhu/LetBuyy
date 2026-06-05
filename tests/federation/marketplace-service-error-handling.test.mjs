import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = new URL('../..', import.meta.url).pathname;

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

// H5 — marketplace service layers must surface a typed unavailable error
// instead of masking a backend outage as an empty catalog.

test('app catalog service returns a typed Result, not a fake-empty catalog (H5)', () => {
  const service = read('apps/app-marketplace/src/lib/app-service.ts');
  assert.match(service, /class MarketplaceUnavailableError extends Error/);
  assert.match(service, /Promise<MarketplaceResult<AppSearchResult>>/);
  assert.match(service, /return \{ ok: false, error: new MarketplaceUnavailableError\(\) \}/);
  // The old silent empty-catalog fallbacks must be gone from the list/search paths.
  assert.doesNotMatch(service, /if \(!catalog\) return \{ apps: \[\], total: 0/);
});

test('theme catalog service returns a typed Result, not a fake-empty catalog (H5)', () => {
  const service = read('apps/theme-marketplace/src/lib/theme-service.ts');
  assert.match(service, /class MarketplaceUnavailableError extends Error/);
  assert.match(service, /Promise<MarketplaceResult<ThemeSearchResult>>/);
  assert.match(service, /return \{ ok: false, error: new MarketplaceUnavailableError\(\) \}/);
});

test('catalog API routes return 503 when the backend is unavailable (H5)', () => {
  for (const path of [
    'apps/app-marketplace/src/app/api/apps/route.ts',
    'apps/app-marketplace/src/app/api/apps/search/route.ts',
    'apps/theme-marketplace/src/app/api/themes/route.ts',
  ]) {
    const route = read(path);
    assert.match(route, /if \(!result\.ok\)/, `${path} must branch on !result.ok`);
    assert.match(route, /status: 503/, `${path} must return 503 on outage`);
  }
});

test('catalog pages render an explicit, retryable error state (H5)', () => {
  assert.match(read('apps/app-marketplace/src/app/page.tsx'), /MarketplaceUnavailable/);
  assert.match(read('apps/theme-marketplace/src/app/page.tsx'), /MarketplaceUnavailable/);
  assert.match(read('apps/theme-marketplace/src/app/themes/page.tsx'), /MarketplaceUnavailable/);

  const appComponent = read('apps/app-marketplace/src/components/MarketplaceUnavailable.tsx');
  assert.match(appComponent, /router\.refresh\(\)/);
  assert.match(appComponent, /Try again/);

  const themeComponent = read('apps/theme-marketplace/src/components/marketplace-unavailable.tsx');
  assert.match(themeComponent, /router\.refresh\(\)/);
  assert.match(themeComponent, /Try again/);
});
