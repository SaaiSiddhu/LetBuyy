import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import {
    TRUST_SAFETY_DEFAULT_APPEAL_WINDOW_BUSINESS_DAYS,
    TRUST_SAFETY_RETENTION_EXEMPT_TABLES,
    TrustSafetyAppealStatusSchema,
    TrustSafetyEnforcementActionSchema,
} from '@letbuyy/shared-types';
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

test('trust safety shared defaults and enums support appeals and enforcement', () => {
    assert.equal(TRUST_SAFETY_DEFAULT_APPEAL_WINDOW_BUSINESS_DAYS, 7);
    assert.deepEqual(TRUST_SAFETY_RETENTION_EXEMPT_TABLES, [
        'ts_cases',
        'ts_case_events',
        'ts_evidence',
        'ts_appeals',
        'ts_takedowns',
    ]);
    assert.equal(TrustSafetyAppealStatusSchema.safeParse('overturned').success, true);
    assert.equal(TrustSafetyEnforcementActionSchema.safeParse('suspend_site').success, true);
});

test('trust safety migration creates retention-exempt case tables with real RLS', () => {
    const migrationSource = repositorySource('database/supabase/migrations/125_internal_os_trust_safety_cases.sql');

    for (const table of [
        'ts_policies',
        'ts_cases',
        'ts_case_events',
        'ts_evidence',
        'ts_appeals',
        'ts_takedowns',
    ]) {
        assert.match(migrationSource, new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}`));
        assert.match(migrationSource, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`));
        assert.match(migrationSource, new RegExp(`${table}_service_role_all`));
    }

    assert.match(migrationSource, /Writer: \/v1\/operations\/trust-safety\/\*/);
    assert.match(migrationSource, /retention-exempt/i);
    assert.match(migrationSource, /CREATE POLICY ts_cases_tenant_owner_read/);
    assert.match(migrationSource, /sites s\s+WHERE s\.id = ts_cases\.site_id/);
    assert.match(migrationSource, /s\.user_id = auth\.uid\(\)/);
    assert.match(migrationSource, /CREATE TRIGGER update_ts_cases_updated_at/);
    assert.doesNotMatch(migrationSource, /USING\s*\(true\)/i);
    assert.doesNotMatch(migrationSource, /CREATE TABLE public\.stores/);
});

test('trust safety gateway route is mounted with scoped guards, reason capture, SoD, and audit', () => {
    const indexSource = source('index.ts');
    const routeSource = source('routes/operations/trust-safety.ts');

    assert.match(indexSource, /operationsTrustSafetyRouter/);
    assert.match(indexSource, /api\.route\('\/operations\/trust-safety',\s*operationsTrustSafetyRouter\)/);
    assert.match(routeSource, /router\.get\('\/overview',\s*requirePermission\('ts:view'\)/);
    assert.match(routeSource, /router\.post\('\/cases',\s*requirePermission\('ts:enforce'\)/);
    assert.match(routeSource, /router\.post\('\/appeals\/:id\/decide',\s*requirePermission\('ts:appeal'\)/);
    assert.match(routeSource, /router\.post\('\/cases\/:id\/reinstate',\s*requirePermission\('ts:enforce'\)/);
    assert.match(routeSource, /validateSensitiveReason/);
    assert.match(routeSource, /checkSegregationOfDuty/);
    assert.match(routeSource, /targetAction:\s*'ts\.appeal\.decide'/);
    assert.match(routeSource, /targetAction:\s*'ts\.reinstate'/);
    assert.match(routeSource, /ts_case_events/);
    assert.match(routeSource, /audit_logs/);
    assert.match(routeSource, /notification_mode:\s*'dry_run'/);
});

test('trust safety appeal SoD rejects the enforcing reviewer', () => {
    const result = checkSegregationOfDuty({
        actorId: '11111111-1111-1111-1111-111111111111',
        targetAction: 'ts.appeal.decide',
        originalActorId: '11111111-1111-1111-1111-111111111111',
    });

    assert.equal(result.ok, false);
    assert.equal(result.code, 'SOD_REVIEWER_CONFLICT');
});

test('trust safety API client and operator pages are wired to real backend paths', () => {
    const clientSource = repositorySource('packages/typescript/api-client/src/index.ts');
    const consoleSource = repositorySource('apps/admin_web/src/app/(dashboard)/trust-safety/page.tsx');
    const opsSource = repositorySource('apps/platform-operations-portal/src/app/(dashboard)/trust-safety/page.tsx');
    const opsLayoutSource = repositorySource('apps/platform-operations-portal/src/app/(dashboard)/layout.tsx');

    assert.match(clientSource, /trustSafetyOverview/);
    assert.match(clientSource, /\/operations\/trust-safety\/overview/);
    assert.match(clientSource, /enforceTrustSafetyCase/);
    assert.match(clientSource, /decideTrustSafetyAppeal/);
    assert.match(consoleSource, /\/operations\/trust-safety\/overview/);
    assert.doesNotMatch(consoleSource, /SkipBackendPanel/);
    assert.match(opsSource, /openTrustSafetyCase/);
    assert.match(opsSource, /enforceTrustSafetyCase/);
    assert.match(opsSource, /reinstateTrustSafetyCase/);
    assert.match(opsLayoutSource, /href="\/trust-safety"|href:\s*'\/trust-safety'/);
});
