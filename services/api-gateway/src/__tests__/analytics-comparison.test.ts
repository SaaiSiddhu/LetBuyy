import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function repositorySource(path: string): string {
    return readFileSync(new URL(`../../../../${path}`, import.meta.url), 'utf8');
}

const routeSource = readFileSync(new URL('../routes/analytics.ts', import.meta.url), 'utf8');
const sharedTypes = repositorySource('packages/shared-types/src/index.ts');
const tsClient = repositorySource('packages/typescript/api-client/src/index.ts');
const dartClient = repositorySource('packages/dart/api_client/lib/src/api_client.dart');
const mobileService = repositorySource('apps/merchant_app/lib/services/analytics_service.dart');
const mobileScreen = repositorySource('apps/merchant_app/lib/screens/analytics/analytics_screen.dart');

test('analytics dashboard and revenue expose previous-period comparison data', () => {
    assert.match(routeSource, /comparison:\s*\{/);
    assert.match(routeSource, /previous_period:\s*\{/);
    assert.match(routeSource, /rollupRowsBetween\(rows,\s*previousSince,\s*currentSince\)/);
    assert.match(routeSource, /revenueChartFromRollupRows\(previousRows\)/);
    assert.match(routeSource, /metricDelta\(currentAverageOrderValue,\s*previousAverageOrderValue\)/);
});

test('shared and generated clients expose analytics comparison contracts', () => {
    assert.match(sharedTypes, /AnalyticsComparisonSchema/);
    assert.match(sharedTypes, /AnalyticsRevenueSchema/);
    assert.match(sharedTypes, /AnalyticsPeriodWindowSchema/);
    assert.match(tsClient, /AnalyticsRevenue/);
    assert.match(tsClient, /revenue:\s*\(query: AnalyticsQuery/);
    assert.match(dartClient, /Future<JsonMap> revenue\(QueryParams query/);
});

test('mobile analytics renders honest period comparison without fake data', () => {
    assert.match(mobileService, /class StoreAnalyticsComparison/);
    assert.match(mobileService, /StoreAnalyticsComparison\.fromGateway/);
    assert.match(mobileService, /_api\.analytics\.revenue/);
    assert.match(mobileScreen, /Period comparison/);
    assert.match(mobileScreen, /No comparison yet/);
    assert.match(mobileScreen, /dashArray:\s*const \[6,\s*4\]/);
    assert.doesNotMatch(mobileScreen, /coming soon/i);
});
