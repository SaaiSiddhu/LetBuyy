import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import {
    checkSegregationOfDuty,
    hasPermissionScope,
    resolveEffectivePermissionScopes,
    validateSensitiveReason,
} from '../middleware/rbac';

const testDir = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(testDir, '..');
const repositoryRoot = join(testDir, '../../../..');

function source(path: string): string {
    return readFileSync(join(srcRoot, path), 'utf8');
}

function repositorySource(path: string): string {
    return readFileSync(join(repositoryRoot, path), 'utf8');
}

test('manager defaults cannot release payouts without explicit scope or break-glass', () => {
    const resolved = resolveEffectivePermissionScopes({ role: 'manager' });

    assert.equal(hasPermissionScope(resolved.scopes, 'risk:decide'), true);
    assert.equal(hasPermissionScope(resolved.scopes, 'payout:release'), false);
});

test('break-glass scopes are active only before expiry', () => {
    const now = new Date('2026-06-08T00:00:00.000Z');
    const resolved = resolveEffectivePermissionScopes({
        role: 'manager',
        breakGlassGrants: [
            {
                id: 'active-grant',
                scope: 'payout:release',
                expires_at: '2026-06-08T01:00:00.000Z',
            },
            {
                id: 'expired-grant',
                scope: 'rbac:manage',
                expires_at: '2026-06-07T23:00:00.000Z',
            },
        ],
        now,
    });

    assert.equal(hasPermissionScope(resolved.scopes, 'payout:release'), true);
    assert.equal(hasPermissionScope(resolved.scopes, 'rbac:manage'), false);
    assert.deepEqual(resolved.breakGlassGrantIds, ['active-grant']);
});

test('super admins receive the admin scope set from the canonical permission tiers', () => {
    const resolved = resolveEffectivePermissionScopes({ isSuperAdmin: true });

    assert.equal(hasPermissionScope(resolved.scopes, 'rbac:manage'), true);
    assert.equal(hasPermissionScope(resolved.scopes, 'exec:pii'), true);
    assert.equal(hasPermissionScope(resolved.scopes, 'payout:release'), true);
});

test('segregation of duty rejects appeal self-review and missing second approver', () => {
    const appeal = checkSegregationOfDuty({
        actorId: 'operator-a',
        originalActorId: 'operator-a',
        targetAction: 'ts.appeal.decide',
    });
    const payout = checkSegregationOfDuty({
        actorId: 'operator-a',
        targetAction: 'payout.release',
    });
    const approved = checkSegregationOfDuty({
        actorId: 'operator-a',
        secondaryApproverId: 'operator-b',
        targetAction: 'payout.release',
    });

    assert.equal(appeal.ok, false);
    assert.equal(appeal.code, 'SOD_REVIEWER_CONFLICT');
    assert.equal(payout.ok, false);
    assert.equal(payout.code, 'DUAL_CONTROL_REQUIRED');
    assert.equal(approved.ok, true);
});

test('sensitive reasons must be explicit and bounded', () => {
    assert.equal(validateSensitiveReason('short'), null);
    assert.equal(validateSensitiveReason('merchant requested emergency review'), 'merchant requested emergency review');
    assert.equal(validateSensitiveReason(' '.repeat(12)), null);
});

test('internal OS RBAC routes and migration are wired to real guards and audit tables', () => {
    const indexSource = source('index.ts');
    const operationsSource = source('routes/operations.ts');
    const marketplaceReviewsSource = source('routes/operations/marketplace-reviews.ts');
    const rbacRouteSource = source('routes/operations/rbac.ts');
    const internalConsoleSource = source('routes/internal-console.ts');
    const migrationSource = repositorySource('database/supabase/migrations/113_internal_os_rbac_spine.sql');
    const sharedTypesSource = repositorySource('packages/shared-types/src/index.ts');

    assert.match(indexSource, /operationsRbacRouter/);
    assert.match(indexSource, /api\.route\('\/operations\/rbac',\s*operationsRbacRouter\)/);
    assert.match(indexSource, /operationsMarketplaceReviewsRouter/);
    assert.match(indexSource, /api\.route\('\/operations\/marketplace-reviews',\s*operationsMarketplaceReviewsRouter\)/);
    assert.match(marketplaceReviewsSource, /router\.get\('\/',\s*requirePermission\('review:view'\)/);
    assert.match(marketplaceReviewsSource, /router\.post\('\/:id\/decision',\s*requirePermission\('review:decide'\)/);
    assert.match(marketplaceReviewsSource, /REASON_REQUIRED/);
    assert.match(operationsSource, /router\.post\('\/runtime\/control-commands',\s*requirePermission\('incident:command'\)/);
    assert.match(operationsSource, /router\.post\('\/runtime\/incidents',\s*requirePermission\('incident:command'\)/);
    assert.match(rbacRouteSource, /router\.post\('\/break-glass'/);
    assert.match(rbacRouteSource, /audit_logs/);
    assert.match(internalConsoleSource, /router\.patch\('\/employees\/:id\/permissions'/);
    assert.match(migrationSource, /CREATE TABLE IF NOT EXISTS public\.break_glass_grants/);
    assert.match(migrationSource, /CREATE TABLE IF NOT EXISTS public\.access_review_records/);
    assert.match(migrationSource, /auth\.role\(\) = 'service_role'/);
    assert.match(migrationSource, /employees\.user_id = auth\.uid\(\)/);
    assert.match(sharedTypesSource, /InternalPermissionScopeSchema/);
    assert.match(sharedTypesSource, /payout:release/);
});
