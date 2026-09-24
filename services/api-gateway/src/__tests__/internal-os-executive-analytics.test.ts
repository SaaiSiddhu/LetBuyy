import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { isExecutiveAnalyticsStale } from '@letbuyy/shared-types';

const testDir = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(testDir, '..');
const repositoryRoot = join(testDir, '../../../..');

function source(path: string): string {
    return readFileSync(join(srcRoot, path), 'utf8');
}

function repositorySource(path: string): string {
    return readFileSync(join(repositoryRoot, path), 'utf8');
}

test('executive analytics migration creates rollup tables with service-role and super-admin RLS', () => {
    const migrationSource = repositorySource('database/supabase/migrations/169_internal_os_executive_analytics_rollups.sql');

    for (const table of ['metric_rollups', 'mrr_arr_rollups', 'cohort_snapshots', 'funnel_steps']) {
        assert.match(migrationSource, new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}`));
        assert.match(migrationSource, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`));
        assert.match(migrationSource, new RegExp(`${table}_service_role_all`));
        assert.match(migrationSource, new RegExp(`${table}_super_admin_read`));
        assert.match(migrationSource, new RegExp(`update_${table}_updated_at`));
    }

    assert.match(migrationSource, /EXECUTE FUNCTION public\.update_updated_at\(\)/);
    assert.match(migrationSource, /auth\.role\(\) = 'service_role'/);
    assert.match(migrationSource, /public\.is_super_admin\(\)/);
    assert.match(migrationSource, /definition_version text NOT NULL DEFAULT 'internal_exec_v1'/);
    assert.doesNotMatch(migrationSource, /USING\s*\(true\)/i);
    assert.doesNotMatch(migrationSource, /CREATE TABLE public\.stores/);
});

test('internal console exposes rollup-backed executive analytics endpoints with read audit and stale states', () => {
    const routeSource = source('routes/internal-console.ts');
    const clientSource = repositorySource('packages/typescript/api-client/src/index.ts');

    for (const endpoint of [
        "router.get('/analytics/mrr'",
        "router.get('/analytics/funnels'",
        "router.get('/analytics/cohorts'",
        "router.get('/analytics/company-health'",
        "router.get('/analytics/cohorts/:cohortMonth/merchants'",
    ]) {
        assert.match(routeSource, new RegExp(endpoint.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }

    assert.match(routeSource, /mrr_arr_rollups/);
    assert.match(routeSource, /funnel_steps/);
    assert.match(routeSource, /cohort_snapshots/);
    assert.match(routeSource, /metric_rollups/);
    assert.match(routeSource, /isExecutiveAnalyticsStale/);
    assert.match(routeSource, /executive_analytics\.mrr\.read/);
    assert.match(routeSource, /executive_analytics\.funnels\.read/);
    assert.match(routeSource, /executive_analytics\.cohorts\.read/);
    assert.match(routeSource, /executive_analytics\.company_health\.read/);
    assert.match(routeSource, /executive_analytics\.cohort_merchants\.read/);
    assert.match(routeSource, /validateSensitiveReason/);
    assert.match(routeSource, /REASON_REQUIRED/);

    for (const method of [
        'executiveMrr',
        'executiveFunnels',
        'executiveCohorts',
        'executiveCompanyHealth',
        'executiveCohortMerchants',
    ]) {
        assert.match(clientSource, new RegExp(method));
    }
});

test('console analytics, revenue, and dashboard pages consume rollups instead of unavailable placeholders', () => {
    const analyticsPage = repositorySource('apps/internal/console/src/app/(dashboard)/analytics/page.tsx');
    const revenuePage = repositorySource('apps/internal/console/src/app/(dashboard)/revenue/page.tsx');
    const dashboardPage = repositorySource('apps/internal/console/src/app/(dashboard)/dashboard/page.tsx');

    for (const page of [analyticsPage, revenuePage, dashboardPage]) {
        assert.match(page, /\/internal\/console\/analytics\/mrr/);
        assert.doesNotMatch(page, /SkipBackendPanel/);
        assert.doesNotMatch(page, /SKIP/i);
    }

    assert.match(analyticsPage, /\/internal\/console\/analytics\/funnels/);
    assert.match(analyticsPage, /\/internal\/console\/analytics\/cohorts/);
    assert.match(analyticsPage, /\/internal\/console\/analytics\/company-health/);
    assert.match(analyticsPage, /Reason-captured cohort drill-through/);
    assert.match(revenuePage, /Revenue Mix/);
    assert.match(dashboardPage, /Company Health/);
});

test('shared stale helper marks missing and old rollups stale', () => {
    const reference = new Date('2026-06-08T12:00:00.000Z');

    assert.equal(isExecutiveAnalyticsStale(null, reference), true);
    assert.equal(isExecutiveAnalyticsStale('2026-06-06T00:00:00.000Z', reference, 36), true);
    assert.equal(isExecutiveAnalyticsStale('2026-06-08T00:00:00.000Z', reference, 36), false);
});
