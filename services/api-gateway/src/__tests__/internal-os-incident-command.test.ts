import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const testDir = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(testDir, '..');
const repositoryRoot = join(testDir, '../../../..');

function source(path: string): string {
    return readFileSync(join(srcRoot, path), 'utf8');
}

function repositorySource(path: string): string {
    return readFileSync(join(repositoryRoot, path), 'utf8');
}

test('incident command migration creates on-call and postmortem tables with real RLS', () => {
    const migrationSource = repositorySource('database/supabase/migrations/133_internal_os_incident_command.sql');

    for (const table of ['oncall_schedules', 'incident_postmortems']) {
        assert.match(migrationSource, new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}`));
        assert.match(migrationSource, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`));
        assert.match(migrationSource, new RegExp(`${table}_service_role_all`));
        assert.match(migrationSource, new RegExp(`update_${table}_updated_at`));
    }

    assert.match(migrationSource, /REFERENCES public\.production_incidents\(incident_id\)/);
    assert.match(migrationSource, /REFERENCES public\.employees\(id\)/);
    assert.match(migrationSource, /auth\.role\(\) = 'service_role'/);
    assert.match(migrationSource, /public\.is_super_admin\(\)/);
    assert.match(migrationSource, /e\.user_id = auth\.uid\(\)/);
    assert.match(migrationSource, /EXECUTE FUNCTION public\.update_updated_at\(\)/);
    assert.doesNotMatch(migrationSource, /USING\s*\(true\)/i);
    assert.doesNotMatch(migrationSource, /CREATE TABLE public\.stores/);
});

test('incident command routes are mounted with scope guards, reason capture, paging, and postmortem close gate', () => {
    const indexSource = source('index.ts');
    const routeSource = source('routes/operations/incident-command.ts');
    const operationsSource = source('routes/operations.ts');
    const eventCoreSource = repositorySource('packages/event-core/src/index.ts');

    assert.match(indexSource, /operationsIncidentCommandRouter/);
    assert.match(indexSource, /api\.route\('\/operations',\s*operationsIncidentCommandRouter\)/);

    for (const endpoint of [
        "router.get('/runtime/incidents/:incidentId'",
        "router.post('/runtime/incidents/:incidentId/events'",
        "router.post('/runtime/incidents/:incidentId/page'",
        "router.get('/oncall/schedules'",
        "router.post('/oncall/schedules'",
        "router.get('/oncall/current'",
        "router.post('/oncall/page'",
        "router.get('/postmortems'",
        "router.post('/postmortems'",
        "router.patch('/postmortems/:id'",
    ]) {
        assert.match(routeSource, new RegExp(endpoint.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }

    assert.match(routeSource, /requirePermission\('incident:view'\)/);
    assert.match(routeSource, /requirePermission\('incident:command'\)/);
    assert.match(routeSource, /validateSensitiveReason/);
    assert.match(routeSource, /logSensitiveRead/);
    assert.match(routeSource, /audit_logs/);
    assert.match(routeSource, /dry_run/);
    assert.match(routeSource, /production_incident_events/);
    assert.match(operationsSource, /router\.patch\('\/runtime\/incidents\/:incidentId\/status',\s*requirePermission\('incident:command'\)/);
    assert.match(operationsSource, /POSTMORTEM_REQUIRED/);
    assert.match(operationsSource, /checkSegregationOfDuty/);
    assert.match(operationsSource, /runtime\.control-command/);
    assert.match(operationsSource, /secondary_approver_id/);
    assert.match(operationsSource, /incident\.runtime_control_command\.submit/);
    assert.match(eventCoreSource, /secondary_approver_id/);
    assert.match(eventCoreSource, /reason: z\.string\(\)\.trim\(\)\.min\(8\)\.max\(500\)\.optional\(\)/);
});

test('api client and platform console expose the incident command surface without unavailable placeholders', () => {
    const clientSource = repositorySource('packages/typescript/api-client/src/index.ts');
    const operationsPage = repositorySource('apps/internal/console/src/app/(dashboard)/operations/page.tsx');

    for (const method of [
        'runtimeOverview',
        'submitRuntimeControlCommand',
        'runtimeIncidents',
        'createRuntimeIncident',
        'updateRuntimeIncidentStatus',
        'addRuntimeIncidentEvent',
        'pageRuntimeIncident',
        'oncallSchedules',
        'createOncallSchedule',
        'currentOncall',
        'dryRunOncallPage',
        'incidentPostmortems',
        'createIncidentPostmortem',
        'updateIncidentPostmortem',
    ]) {
        assert.match(clientSource, new RegExp(method));
    }

    assert.match(operationsPage, /Incident Command/);
    assert.match(operationsPage, /Runtime Controls/);
    assert.match(operationsPage, /On-Call/);
    assert.match(operationsPage, /Postmortems/);
    assert.match(operationsPage, /createIncident/);
    assert.match(operationsPage, /submitRuntimeControlCommand/);
    assert.match(operationsPage, /createOncallSchedule/);
    assert.match(operationsPage, /createPostmortem/);
    assert.doesNotMatch(operationsPage, /SkipBackendPanel/);
    assert.doesNotMatch(operationsPage, /SKIP/i);
});
