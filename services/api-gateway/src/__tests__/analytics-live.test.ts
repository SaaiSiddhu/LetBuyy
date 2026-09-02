import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const routeSource = readFileSync(new URL('../routes/analytics.ts', import.meta.url), 'utf8');
const sharedTypesSource = readFileSync(
    new URL('../../../../packages/shared-types/src/index.ts', import.meta.url),
    'utf8',
);
const tsClientSource = readFileSync(
    new URL('../../../../packages/typescript/api-client/src/index.ts', import.meta.url),
    'utf8',
);
const dartClientSource = readFileSync(
    new URL('../../../../packages/dart/api_client/lib/src/api_client.dart', import.meta.url),
    'utf8',
);
const mobileServiceSource = readFileSync(
    new URL('../../../../apps/merchant_app/lib/services/analytics_service.dart', import.meta.url),
    'utf8',
);
const mobileScreenSource = readFileSync(
    new URL('../../../../apps/merchant_app/lib/screens/analytics/analytics_screen.dart', import.meta.url),
    'utf8',
);

test('analytics live route is tenant checked and rollup backed', () => {
    assert.match(routeSource, /router\.get\('\/live'/);
    assert.match(routeSource, /canAccessStore\(db,\s*auth\.user,\s*storeId\)/);
    assert.match(routeSource, /LIVE_VIEW_METRICS/);
    assert.match(routeSource, /analytics_rollups_daily/);
    assert.match(routeSource, /updated_at/);
    assert.match(routeSource, /storefront\.sessions\.active/);
    assert.match(routeSource, /storefront\.page\.views/);
    assert.match(routeSource, /available:\s*false/);
    assert.doesNotMatch(routeSource, /coming soon/i);
});

test('shared and generated clients expose the live view contract', () => {
    assert.match(sharedTypesSource, /AnalyticsLiveViewSchema/);
    assert.match(sharedTypesSource, /AnalyticsLiveViewEntrySchema/);
    assert.match(sharedTypesSource, /AnalyticsLiveViewSignalSchema/);
    assert.match(tsClientSource, /AnalyticsLiveView/);
    assert.match(tsClientSource, /live:\s*\(query: AnalyticsLiveQuery/);
    assert.match(tsClientSource, /\/analytics\/live/);
    assert.match(dartClientSource, /Future<JsonMap> live\(QueryParams query/);
    assert.match(dartClientSource, /\/analytics\/live/);
});

test('mobile analytics screen renders live data with an honest empty state', () => {
    assert.match(mobileServiceSource, /class StoreLiveView/);
    assert.match(mobileServiceSource, /getLiveView/);
    assert.match(mobileServiceSource, /_api\.analytics\.live/);
    assert.match(mobileScreenSource, /Live View/);
    assert.match(mobileScreenSource, /Active now/);
    assert.match(mobileScreenSource, /No live traffic yet/);
    assert.match(mobileScreenSource, /Live storefront activity appears after traffic data is collected/);
    assert.doesNotMatch(mobileScreenSource, /coming soon/i);
    assert.doesNotMatch(mobileScreenSource, /SKIP_NEEDS_HUMAN/);
});
