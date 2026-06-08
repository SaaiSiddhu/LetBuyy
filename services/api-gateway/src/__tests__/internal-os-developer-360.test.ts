import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { checkSegregationOfDuty } from '../middleware/rbac';

const testDir = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(testDir, '..');
const repositoryRoot = join(testDir, '../../../..');

function source(path: string): string {
    return readFileSync(join(srcRoot, path), 'utf8');
}

function repositorySource(path: string): string {
    return readFileSync(join(repositoryRoot, path), 'utf8');
}

test('developer 360 migration creates reconciliation and dispute tables with payout holds and real RLS', () => {
    const migrationSource = repositorySource('database/supabase/migrations/134_internal_os_developer_360_payout_reconciliation.sql');

    for (const table of ['payout_reconciliation_records', 'payout_disputes']) {
        assert.match(migrationSource, new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}`));
        assert.match(migrationSource, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`));
        assert.match(migrationSource, new RegExp(`${table}_service_role_all`));
        assert.match(migrationSource, new RegExp(`update_${table}_updated_at`));
        assert.match(migrationSource, /auth\.role\(\) = 'service_role'/);
    }

    assert.match(migrationSource, /ALTER TABLE public\.partner_payout_ledger_entries/);
    assert.match(migrationSource, /ADD COLUMN IF NOT EXISTS held_at timestamptz/);
    assert.match(migrationSource, /hold_metadata jsonb NOT NULL DEFAULT '\{\}'::jsonb/);
    assert.match(migrationSource, /REFERENCES public\.app_developers\(id\)/);
    assert.match(migrationSource, /REFERENCES public\.app_billing_charges\(id\)/);
    assert.match(migrationSource, /REFERENCES public\.sites\(id\)/);
    assert.match(migrationSource, /app_developers d\s+WHERE d\.id = payout_reconciliation_records\.partner_id/);
    assert.match(migrationSource, /d\.user_id = auth\.uid\(\)/);
    assert.match(migrationSource, /public\.is_super_admin\(\)/);
    assert.match(migrationSource, /e\.user_id = auth\.uid\(\)/);
    assert.match(migrationSource, /EXECUTE FUNCTION public\.update_updated_at\(\)/);
    assert.doesNotMatch(migrationSource, /USING\s*\(true\)/i);
    assert.doesNotMatch(migrationSource, /CREATE TABLE public\.stores/);
});

test('developer operations routes are mounted with scoped guards, dual-control, holds, reconciliation, disputes, and audit', () => {
    const indexSource = source('index.ts');
    const routeSource = source('routes/operations/developers.ts');
    const helperSource = source('lib/internal-developer-ops.ts');
    const internalConsoleSource = source('routes/internal-console.ts');
    const internalConsoleDeveloperSource = source('routes/internal-console/developers.ts');

    assert.match(indexSource, /operationsDevelopersRouter/);
    assert.match(indexSource, /api\.route\('\/operations\/developers',\s*operationsDevelopersRouter\)/);
    assert.match(internalConsoleSource, /internalConsoleDevelopersRouter/);
    assert.match(internalConsoleSource, /router\.route\('\/developers',\s*internalConsoleDevelopersRouter\)/);
    assert.match(internalConsoleDeveloperSource, /router\.get\('\/:developerId\/overview'/);

    for (const endpoint of [
        "router.get('/search'",
        "router.get('/:developerId/overview'",
        "router.post('/:developerId/moderation'",
        "router.post('/:developerId/payouts/:payoutId/release'",
        "router.post('/:developerId/reconciliation/run'",
        "router.get('/:developerId/reconciliation'",
        "router.post('/:developerId/disputes'",
        "router.patch('/:developerId/disputes/:disputeId'",
    ]) {
        assert.match(routeSource, new RegExp(endpoint.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }

    assert.match(routeSource, /requirePermission\('developer:view'\)/);
    assert.match(routeSource, /requirePermission\('developer:manage'/);
    assert.match(routeSource, /requirePermission\('developer:manage', 'payout:release'\)/);
    assert.match(routeSource, /validateSensitiveReason/);
    assert.match(routeSource, /checkSegregationOfDuty/);
    assert.match(routeSource, /targetAction:\s*'developer\.suspend'/);
    assert.match(routeSource, /targetAction:\s*'payout\.release'/);
    assert.match(routeSource, /held_at:\s*now/);
    assert.match(routeSource, /source:\s*'developer_suspension'/);
    assert.match(routeSource, /dry_run_provider_pending/);
    assert.match(routeSource, /payout_disputes/);
    assert.match(routeSource, /payout_reconciliation_records/);
    assert.match(routeSource, /writeDeveloperAudit/);
    assert.match(helperSource, /buildDeveloperOverview/);
    assert.match(helperSource, /reconcileDeveloperPayouts/);
    assert.match(helperSource, /app_billing_charges/);
    assert.match(helperSource, /partner_payout_ledger_entries/);
    assert.match(helperSource, /developer\.view/);
});

test('developer suspension and payout release require distinct second approvers', () => {
    const actorId = '11111111-1111-1111-1111-111111111111';

    assert.deepEqual(checkSegregationOfDuty({
        actorId,
        targetAction: 'developer.suspend',
    }), {
        ok: false,
        code: 'DUAL_CONTROL_REQUIRED',
        message: 'This action requires a second approver distinct from the requesting operator.',
    });

    assert.equal(checkSegregationOfDuty({
        actorId,
        targetAction: 'payout.release',
        secondaryApproverId: actorId,
    }).ok, false);

    assert.equal(checkSegregationOfDuty({
        actorId,
        targetAction: 'payout.release',
        secondaryApproverId: '22222222-2222-2222-2222-222222222222',
    }).ok, true);
});

test('developer 360 API client and operations portal are wired to real backend paths', () => {
    const clientSource = repositorySource('packages/typescript/api-client/src/index.ts');
    const pageSource = repositorySource('apps/platform-operations-portal/src/app/(dashboard)/developers/page.tsx');
    const layoutSource = repositorySource('apps/platform-operations-portal/src/app/(dashboard)/layout.tsx');
    const dashboardSource = repositorySource('apps/platform-operations-portal/src/app/(dashboard)/page.tsx');

    for (const method of [
        'developerSearch',
        'developerOverview',
        'moderateDeveloper',
        'approveDeveloperPayoutRelease',
        'runDeveloperPayoutReconciliation',
        'developerPayoutReconciliation',
        'developerPayoutDisputes',
        'createDeveloperPayoutDispute',
        'updateDeveloperPayoutDispute',
    ]) {
        assert.match(clientSource, new RegExp(method));
    }

    assert.match(clientSource, /\/operations\/developers\/search/);
    assert.match(clientSource, /\/internal\/console\/developers\/search/);
    assert.match(pageSource, /Developer 360/);
    assert.match(pageSource, /moderateDeveloper/);
    assert.match(pageSource, /approveDeveloperPayoutRelease/);
    assert.match(pageSource, /runDeveloperPayoutReconciliation/);
    assert.match(pageSource, /createDeveloperPayoutDispute/);
    assert.match(layoutSource, /href="\/developers"/);
    assert.match(dashboardSource, /href="\/developers"/);
    assert.doesNotMatch(pageSource, /SkipBackendPanel/);
    assert.doesNotMatch(pageSource, /SKIPPED/i);
});
