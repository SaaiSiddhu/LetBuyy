import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import {
    evaluateMarketplaceReviewChecks,
    buildMarketplaceReviewAutomatedChecks,
} from '@letbuyy/shared-types';

const testDir = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(testDir, '..');
const repositoryRoot = join(testDir, '../../../..');

function source(path: string): string {
    return readFileSync(join(srcRoot, path), 'utf8');
}

function repositorySource(path: string): string {
    return readFileSync(join(repositoryRoot, path), 'utf8');
}

test('review check migration creates check runs with service RLS and partner-owner read', () => {
    const migrationSource = repositorySource('database/supabase/migrations/128_internal_os_review_check_runs.sql');

    assert.match(migrationSource, /CREATE TABLE IF NOT EXISTS public\.review_check_runs/);
    assert.match(migrationSource, /review_record_id uuid NOT NULL REFERENCES public\.marketplace_review_records\(id\)/);
    assert.match(migrationSource, /check_type text NOT NULL CHECK/);
    assert.match(migrationSource, /theme_accessibility/);
    assert.match(migrationSource, /app_oauth_pkce/);
    assert.match(migrationSource, /CREATE TRIGGER update_review_check_runs_updated_at/);
    assert.match(migrationSource, /EXECUTE FUNCTION public\.update_updated_at\(\)/);
    assert.match(migrationSource, /ALTER TABLE public\.review_check_runs ENABLE ROW LEVEL SECURITY/);
    assert.match(migrationSource, /review_check_runs_service_role_all/);
    assert.match(migrationSource, /auth\.role\(\) = 'service_role'/);
    assert.match(migrationSource, /review_check_runs_partner_owner_read/);
    assert.match(migrationSource, /r\.partner_user_id = auth\.uid\(\)/);
    assert.doesNotMatch(migrationSource, /USING\s*\(true\)/i);
});

test('marketplace review operations are split into a guarded sub-router with checks and audit', () => {
    const indexSource = source('index.ts');
    const operationsSource = source('routes/operations.ts');
    const routeSource = source('routes/operations/marketplace-reviews.ts');

    assert.match(indexSource, /operationsMarketplaceReviewsRouter/);
    assert.match(indexSource, /api\.route\('\/operations\/marketplace-reviews'/);
    assert.doesNotMatch(operationsSource, /router\.get\('\/marketplace-reviews'/);
    assert.match(routeSource, /router\.get\('\/',\s*requirePermission\('review:view'\)/);
    assert.match(routeSource, /router\.get\('\/:id',\s*requirePermission\('review:view'\)/);
    assert.match(routeSource, /router\.post\('\/:id\/claim',\s*requirePermission\('review:decide'\)/);
    assert.match(routeSource, /router\.patch\('\/:id\/assign',\s*requirePermission\('review:decide'\)/);
    assert.match(routeSource, /router\.post\('\/:id\/comments',\s*requirePermission\('review:decide'\)/);
    assert.match(routeSource, /router\.post\('\/:id\/run-checks',\s*requirePermission\('review:decide'\)/);
    assert.match(routeSource, /router\.post\('\/:id\/decision',\s*requirePermission\('review:decide'\)/);
    assert.match(routeSource, /logSensitiveRead/);
    assert.match(routeSource, /validateSensitiveReason/);
    assert.match(routeSource, /review_check_runs/);
    assert.match(routeSource, /buildMarketplaceReviewAutomatedChecks/);
    assert.match(routeSource, /evaluateMarketplaceReviewChecks/);
    assert.match(routeSource, /REVIEW_CHECKS_REQUIRED/);
    assert.match(routeSource, /REVIEW_CHECKS_BLOCKING/);
    assert.match(routeSource, /marketplace\.review\.check_run/);
    assert.match(routeSource, /marketplace\.review\.decision/);
});

test('shared deterministic review checks hard-fail risky app and weak theme submissions', () => {
    const appChecks = evaluateMarketplaceReviewChecks({
        submission_type: 'app',
        metadata: { data_collection_declared: false },
        resource: {
            api_scopes: ['customers:read', '*'],
            oauth_redirect_uris: ['http://example.com/callback'],
            data_handling: {},
        },
    });
    const appSummary = buildMarketplaceReviewAutomatedChecks({ source: 'test', checks: appChecks });

    assert.equal(appSummary.status, 'failed');
    assert.ok(appSummary.hard_fail_count >= 2);
    assert.ok(appChecks.some((check) => check.check_type === 'app_scope_minimization' && check.hard_fail));
    assert.ok(appChecks.some((check) => check.check_type === 'app_redirect_uri_allowlist' && check.hard_fail));

    const themeChecks = evaluateMarketplaceReviewChecks({
        submission_type: 'theme',
        metadata: { qa: { performance_score: 55, accessibility_score: 88, unsafe_scripts: ['eval'] } },
        resource: { package_manifest: {} },
    });
    const themeSummary = buildMarketplaceReviewAutomatedChecks({ source: 'test', checks: themeChecks });

    assert.equal(themeSummary.status, 'failed');
    assert.ok(themeChecks.some((check) => check.check_type === 'theme_performance_budget' && check.hard_fail));
    assert.ok(themeChecks.some((check) => check.check_type === 'theme_accessibility' && check.hard_fail));
    assert.ok(themeChecks.some((check) => check.check_type === 'theme_security' && check.hard_fail));
});

test('api client and operations portal expose reviewer workflow methods', () => {
    const clientSource = repositorySource('packages/typescript/api-client/src/index.ts');
    const pageSource = repositorySource('apps/frozen/operations-portal/src/app/(dashboard)/operations/page.tsx');
    const consoleGovernanceSource = repositorySource('apps/internal/console/src/app/(dashboard)/marketplace-governance/page.tsx');
    const consoleWorkspaceSource = repositorySource('apps/internal/console/src/components/_local-ui/console-workspace.tsx');

    for (const method of [
        'marketplaceReview',
        'claimMarketplaceReview',
        'assignMarketplaceReview',
        'commentMarketplaceReview',
        'runMarketplaceReviewChecks',
        'decideMarketplaceReview',
    ]) {
        assert.match(clientSource, new RegExp(method));
        assert.match(pageSource, new RegExp(method));
    }

    assert.match(pageSource, /CheckRunsPanel/);
    assert.match(pageSource, /Approval is blocked until checks have run/);
    assert.match(pageSource, /formatIndiaDateTime/);
    assert.match(consoleGovernanceSource, /fetchConsoleApi<MarketplaceReviewListResult>/);
    assert.match(consoleGovernanceSource, /Hard check failures/);
    assert.match(consoleGovernanceSource, /Reviewer decisions stay in the employee operations portal/);
    assert.doesNotMatch(pageSource, /SkipBackendPanel/);
    assert.doesNotMatch(pageSource, /SKIP/i);
    assert.doesNotMatch(consoleGovernanceSource, /SkipBackendPanel/);
    assert.doesNotMatch(consoleGovernanceSource, /SKIP/i);
    assert.doesNotMatch(consoleWorkspaceSource, /\[SKIP -- NEEDS BACKEND\]/);
});

test('queue worker handles marketplace review check jobs', () => {
    const workerSource = repositorySource('services/queue-workers/src/review-checks.ts');
    const indexSource = repositorySource('services/queue-workers/src/index.ts');

    assert.match(workerSource, /export function isReviewCheckJob/);
    assert.match(workerSource, /marketplace\.review\.run_checks/);
    assert.match(workerSource, /review_check_runs/);
    assert.match(workerSource, /marketplace_review_records/);
    assert.match(workerSource, /evaluateMarketplaceReviewChecks/);
    assert.match(workerSource, /buildMarketplaceReviewAutomatedChecks/);
    assert.match(workerSource, /marketplace\.review\.check_run/);
    assert.match(indexSource, /processReviewCheckDeliveries/);
    assert.match(indexSource, /review_check_result/);
});
