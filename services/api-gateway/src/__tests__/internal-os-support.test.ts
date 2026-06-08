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

test('support migration creates ticketing, SLA, macro, and CSAT tables with real RLS', () => {
    const migrationSource = repositorySource('database/supabase/migrations/127_internal_os_support_ticketing.sql');

    for (const table of ['support_tickets', 'ticket_messages', 'ticket_macros', 'ticket_sla_clocks', 'ticket_csat']) {
        assert.match(migrationSource, new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}`));
        assert.match(migrationSource, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`));
        assert.match(migrationSource, new RegExp(`${table}_service_role_all`));
    }

    assert.match(migrationSource, /site_id uuid REFERENCES public\.sites\(id\)/);
    assert.match(migrationSource, /assignee_id uuid REFERENCES public\.employees\(id\)/);
    assert.match(migrationSource, /linked_ts_case_id uuid REFERENCES public\.ts_cases\(id\)/);
    assert.match(migrationSource, /linked_incident_id uuid REFERENCES public\.production_incidents\(id\)/);
    assert.match(migrationSource, /CREATE TRIGGER update_support_tickets_updated_at/);
    assert.match(migrationSource, /CREATE TRIGGER update_ticket_messages_updated_at/);
    assert.match(migrationSource, /EXECUTE FUNCTION public\.update_updated_at\(\)/);
    assert.match(migrationSource, /support_tickets_tenant_owner_read/);
    assert.match(migrationSource, /s\.user_id = auth\.uid\(\)/);
    assert.match(migrationSource, /auth\.role\(\) = 'service_role'/);
    assert.doesNotMatch(migrationSource, /USING\s*\(true\)/i);
    assert.doesNotMatch(migrationSource, /CREATE TABLE public\.stores/);
});

test('support operations routes enforce scopes, reason capture, audit, SLA, CSAT, and T&S escalation', () => {
    const supportSource = source('routes/operations/support.ts');
    const indexSource = source('index.ts');
    const employeeSource = source('routes/employee.ts');

    assert.match(indexSource, /operationsSupportRouter/);
    assert.match(indexSource, /api\.route\('\/operations\/support'/);
    assert.match(supportSource, /router\.get\('\/overview'/);
    assert.match(supportSource, /router\.get\('\/tickets'/);
    assert.match(supportSource, /router\.post\('\/tickets'/);
    assert.match(supportSource, /router\.post\('\/tickets\/:id\/messages'/);
    assert.match(supportSource, /router\.patch\('\/tickets\/:id\/assign'/);
    assert.match(supportSource, /router\.post\('\/tickets\/:id\/escalate'/);
    assert.match(supportSource, /router\.post\('\/tickets\/:id\/resolve'/);
    assert.match(supportSource, /router\.post\('\/tickets\/:id\/csat'/);
    assert.match(supportSource, /router\.get\('\/macros'/);
    assert.match(supportSource, /router\.post\('\/macros'/);
    assert.match(supportSource, /requirePermission\('support:view'\)/);
    assert.match(supportSource, /requirePermission\('support:reply'\)/);
    assert.match(supportSource, /requirePermission\('support:manage'\)/);
    assert.match(supportSource, /validateSensitiveReason/);
    assert.match(supportSource, /logSensitiveRead/);
    assert.match(supportSource, /support\.ticket\.create/);
    assert.match(supportSource, /support\.ticket\.reply/);
    assert.match(supportSource, /support\.ticket\.escalate/);
    assert.match(supportSource, /support\.ticket\.resolve/);
    assert.match(supportSource, /support\.csat\.record/);
    assert.match(supportSource, /SUPPORT_DEFAULT_FIRST_RESPONSE_HOURS/);
    assert.match(supportSource, /SUPPORT_DEFAULT_RESOLUTION_BUSINESS_DAYS/);
    assert.match(supportSource, /SUPPORT_ESCALATION_KEYWORDS/);
    assert.match(supportSource, /openTrustSafetyCaseFromTicket/);
    assert.match(supportSource, /\.from\('ts_cases'\)/);
    assert.match(employeeSource, /SUPPORT_TICKETS_SCHEMA_UNAVAILABLE/);
    assert.doesNotMatch(employeeSource, /SUPPORT_TICKETS_UNAVAILABLE/);
});

test('support API client and operations portal expose real ticket workspace methods', () => {
    const clientSource = repositorySource('packages/typescript/api-client/src/index.ts');
    const ticketPageSource = repositorySource('apps/platform-operations-portal/src/app/(dashboard)/tickets/page.tsx');
    const dashboardSource = repositorySource('apps/platform-operations-portal/src/app/(dashboard)/page.tsx');
    const moduleProbeSource = repositorySource('apps/platform-operations-portal/src/lib/api/employee-modules.ts');

    for (const method of [
        'supportOverview',
        'supportTickets',
        'supportTicket',
        'createSupportTicket',
        'replySupportTicket',
        'assignSupportTicket',
        'escalateSupportTicket',
        'resolveSupportTicket',
        'recordSupportCsat',
        'supportMacros',
        'createSupportMacro',
    ]) {
        assert.match(clientSource, new RegExp(method));
    }

    assert.match(clientSource, /\/operations\/support\/tickets/);
    assert.match(ticketPageSource, /createSupportTicket/);
    assert.match(ticketPageSource, /replySupportTicket/);
    assert.match(ticketPageSource, /escalateSupportTicket/);
    assert.match(ticketPageSource, /recordSupportCsat/);
    assert.match(ticketPageSource, /merchant_context/);
    assert.match(ticketPageSource, /formatIndiaDateTime/);
    assert.doesNotMatch(ticketPageSource, /EmployeeModuleScreen/);
    assert.match(dashboardSource, /Live support workspace/);
    assert.match(moduleProbeSource, /api\.operations\.supportOverview\(\)/);
});

test('support automation worker is wired into queue processing', () => {
    const workerSource = repositorySource('services/queue-workers/src/support-automation.ts');
    const indexSource = repositorySource('services/queue-workers/src/index.ts');

    assert.match(workerSource, /support\.sla\.recompute/);
    assert.match(workerSource, /support\.csat\.dispatch/);
    assert.match(workerSource, /ticket_sla_clocks/);
    assert.match(workerSource, /ticket_csat/);
    assert.match(workerSource, /support\.sla\.recompute/);
    assert.match(workerSource, /support\.csat\.dispatch/);
    assert.match(indexSource, /processSupportAutomationDeliveries/);
    assert.match(indexSource, /support_automation_result/);
});
