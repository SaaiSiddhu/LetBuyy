import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { scoreRiskSignals } from '@letbuyy/shared-types';

const testDir = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(testDir, '..');
const repositoryRoot = join(testDir, '../../../..');

function source(path: string): string {
    return readFileSync(join(srcRoot, path), 'utf8');
}

function repositorySource(path: string): string {
    return readFileSync(join(repositoryRoot, path), 'utf8');
}

test('risk score bands are deterministic and explainable', () => {
    const benign = scoreRiskSignals([]);
    const medium = scoreRiskSignals([
        { signal_type: 'signup_velocity', severity: 'high' },
    ]);
    const high = scoreRiskSignals([
        { signal_type: 'signup_velocity', severity: 'high', evidence: { count: 8 } },
        { signal_type: 'shared_banned_device', severity: 'high', evidence: { device_fingerprint: 'redacted' } },
    ]);

    assert.equal(benign.score, 0);
    assert.equal(benign.band, 'low');
    assert.equal(medium.score, 42);
    assert.equal(medium.band, 'medium');
    assert.equal(high.band, 'high');
    assert.equal(high.auto_restrict, true);
    assert.equal(high.breakdown.signals.length, 2);
    assert.deepEqual(high.breakdown.threshold, { auto_restrict: 75 });
});

test('risk migration creates real RLS-protected tables and default rules', () => {
    const migrationSource = repositorySource('database/supabase/migrations/124_internal_os_risk_detection.sql');

    for (const table of [
        'risk_rules',
        'risk_signals',
        'risk_scores',
        'velocity_counters',
        'chargeback_events',
        'risk_action_events',
    ]) {
        assert.match(migrationSource, new RegExp(`CREATE TABLE public\\.${table}`));
        assert.match(migrationSource, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`));
    }

    assert.match(migrationSource, /CREATE TRIGGER update_risk_scores_updated_at/);
    assert.match(migrationSource, /CREATE POLICY risk_scores_service_all/);
    assert.match(migrationSource, /CREATE POLICY risk_scores_site_owner_read/);
    assert.match(migrationSource, /sites\.user_id = auth\.uid\(\)/);
    assert.match(migrationSource, /INSERT INTO public\.risk_rules/);
    assert.match(migrationSource, /'Chargeback rate breach'/);
    assert.doesNotMatch(migrationSource, /CREATE TABLE public\.stores/);
});

test('risk gateway route is mounted with scoped guards, reason capture, and explainable actions', () => {
    const indexSource = source('index.ts');
    const routeSource = source('routes/operations/risk.ts');

    assert.match(indexSource, /operationsRiskRouter/);
    assert.match(indexSource, /api\.route\('\/operations\/risk',\s*operationsRiskRouter\)/);
    assert.match(routeSource, /router\.get\('\/overview',\s*requirePermission\('risk:view'\)/);
    assert.match(routeSource, /router\.post\('\/score',\s*requirePermission\('risk:decide'\)/);
    assert.match(routeSource, /router\.patch\('\/rules\/:id',\s*requirePermission\('risk:rules'\)/);
    assert.match(routeSource, /validateSensitiveReason/);
    assert.match(routeSource, /status:\s*'frozen'/);
    assert.match(routeSource, /ts_case_open_requested/);
    assert.match(routeSource, /risk_action_events/);
    assert.match(routeSource, /audit_logs/);
});

test('risk queue worker uses shared scoring and handles risk.score.entity jobs', () => {
    const workerSource = repositorySource('services/queue-workers/src/risk-scoring.ts');
    const indexSource = repositorySource('services/queue-workers/src/index.ts');
    const packageSource = repositorySource('services/queue-workers/package.json');
    const manifestSource = repositorySource('services/queue-workers/runtime.manifest.json');

    assert.match(workerSource, /scoreRiskSignals/);
    assert.match(workerSource, /risk\.score\.entity/);
    assert.match(workerSource, /upsertSupabaseRows<JsonRecord>\(env,\s*'risk_scores'/);
    assert.match(workerSource, /risk_action_events/);
    assert.match(workerSource, /ts_case_open_requested/);
    assert.doesNotMatch(workerSource, /patchSupabaseRows\(env,\s*'sites'/);
    assert.match(workerSource, /openTrustSafetyCaseFromRisk/);
    assert.match(workerSource, /insertSupabaseRows<JsonRecord>\(env,\s*'ts_cases'/);
    assert.match(indexSource, /processRiskScoringDeliveries/);
    assert.match(packageSource, /"@letbuyy\/shared-types": "workspace:\*"/);
    assert.match(manifestSource, /"@letbuyy\/shared-types"/);
});
