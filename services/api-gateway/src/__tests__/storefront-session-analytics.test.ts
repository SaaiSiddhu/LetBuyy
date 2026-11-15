import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function source(path: string): string {
    return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

function repositorySource(path: string): string {
    return readFileSync(new URL(`../../../../${path}`, import.meta.url), 'utf8');
}

const storefrontPublicRoutes = source('routes/storefront/public-routes.ts');
const analyticsRoute = source('routes/analytics.ts');
const sharedTypes = repositorySource('packages/shared-types/src/index.ts');
const tsClient = repositorySource('packages/typescript/api-client/src/index.ts');
const dartClient = repositorySource('packages/dart/api_client/lib/src/api_client.dart');
const mobileService = repositorySource('apps/merchant/mobile/lib/services/analytics_service.dart');
const mobileScreen = repositorySource('apps/merchant/mobile/lib/screens/analytics/analytics_screen.dart');
const migration = repositorySource('database/supabase/migrations/155_storefront_session_analytics.sql');
const rollback = repositorySource('database/supabase/rollback/155_storefront_session_analytics.rollback.sql');

test('storefront public beacon enqueues real analytics jobs without activating analytics-pipeline', () => {
    assert.match(storefrontPublicRoutes, /router\.post\('\/:subdomain\/analytics\/beacon'/);
    assert.match(storefrontPublicRoutes, /StorefrontAnalyticsBeaconSchema\.safeParse/);
    assert.match(storefrontPublicRoutes, /loadPublishedStore\(c,\s*c\.req\.param\('subdomain'\)\)/);
    assert.match(storefrontPublicRoutes, /\.from\('platform_queue_jobs'\)[\s\S]*queue_name:\s*'analytics-events'/);
    assert.match(storefrontPublicRoutes, /STOREFRONT_BEACON_EVENT_TYPES/);
    assert.match(storefrontPublicRoutes, /normalizeTrafficSource/);
    assert.match(storefrontPublicRoutes, /deviceFromUserAgent/);
    assert.match(storefrontPublicRoutes, /sample_weight/);
    assert.match(storefrontPublicRoutes, /ignoreDuplicates:\s*true/);
    assert.doesNotMatch(storefrontPublicRoutes, /analytics-pipeline/);
});

test('merchant traffic-source report reads rollups and stays tenant checked', () => {
    assert.match(analyticsRoute, /router\.get\('\/traffic-sources'/);
    assert.match(analyticsRoute, /assertStoreReportAccess\(c,\s*auth\.user,\s*storeId\)/);
    assert.match(analyticsRoute, /TRAFFIC_SOURCE_METRICS/);
    assert.match(analyticsRoute, /storefront\.traffic\.source/);
    assert.match(analyticsRoute, /storefront\.sessions\.started/);
    assert.match(analyticsRoute, /analytics_rollups_daily/);
    assert.match(analyticsRoute, /waiting_for_events/);
    assert.doesNotMatch(analyticsRoute, /coming soon/i);
});

test('shared clients and mobile render real traffic sources with honest empty state', () => {
    assert.match(sharedTypes, /StorefrontAnalyticsBeaconSchema/);
    assert.match(sharedTypes, /StorefrontAnalyticsBeaconResultSchema/);
    assert.match(sharedTypes, /AnalyticsTrafficSourcesSchema/);
    assert.match(tsClient, /analyticsBeacon:\s*\(subdomain: string, input: StorefrontAnalyticsBeacon/);
    assert.match(tsClient, /trafficSources:\s*\(query: AnalyticsTrafficSourcesQuery/);
    assert.match(dartClient, /Future<JsonMap> analyticsBeacon/);
    assert.match(dartClient, /Future<JsonMap> trafficSources/);
    assert.match(mobileService, /class TrafficSourceEntry/);
    assert.match(mobileService, /_api\.analytics\.trafficSources/);
    assert.match(mobileScreen, /!analytics\.trafficSourcesAvailable[\s\S]*Traffic attribution unavailable for this period/);
    assert.match(mobileScreen, /analytics\.trafficSources\.isEmpty[\s\S]*No traffic sources returned for this period/);
    assert.match(mobileScreen, /if \(source\.percentageAvailable\)/);
    assert.match(mobileScreen, /LinearProgressIndicator/);
    assert.doesNotMatch(mobileScreen, /Traffic sources unavailable/);
    assert.doesNotMatch(mobileScreen, /coming soon/i);
});

test('storefront session analytics migration is replayable and reversible', () => {
    assert.match(migration, /ALTER TABLE public\.analytics_event_stream FORCE ROW LEVEL SECURITY/);
    assert.match(migration, /DROP POLICY IF EXISTS analytics_event_stream_tenant_site_guc/);
    assert.match(migration, /CREATE POLICY analytics_event_stream_tenant_site_guc/);
    assert.match(migration, /CREATE INDEX IF NOT EXISTS idx_analytics_event_stream_storefront_source/);
    assert.match(migration, /CREATE INDEX IF NOT EXISTS idx_analytics_rollups_daily_storefront_source/);
    assert.match(rollback, /DROP INDEX IF EXISTS public\.idx_analytics_rollups_daily_storefront_source/);
    assert.match(rollback, /DROP POLICY IF EXISTS analytics_event_stream_tenant_site_guc/);
});
