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

test('compliance migration creates data-subject and audit export tables with real RLS', () => {
    const migrationSource = repositorySource('database/supabase/migrations/135_internal_os_compliance_data_subjects.sql');

    for (const table of ['data_subject_requests', 'audit_export_cursors']) {
        assert.match(migrationSource, new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}`));
        assert.match(migrationSource, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`));
        assert.match(migrationSource, new RegExp(`${table}_service_role_all`));
        assert.match(migrationSource, new RegExp(`update_${table}_updated_at`));
    }

    assert.match(migrationSource, /REFERENCES public\.sites\(id\)/);
    assert.match(migrationSource, /REFERENCES public\.employees\(id\)/);
    assert.match(migrationSource, /auth\.role\(\) = 'service_role'/);
    assert.match(migrationSource, /public\.is_super_admin\(\)/);
    assert.match(migrationSource, /e\.user_id = auth\.uid\(\)/);
    assert.match(migrationSource, /s\.user_id = auth\.uid\(\)/);
    assert.match(migrationSource, /retention_exempt_tables text\[\]/);
    assert.match(migrationSource, /ts_cases/);
    assert.match(migrationSource, /audit_export_cursors/);
    assert.match(migrationSource, /EXECUTE FUNCTION public\.update_updated_at\(\)/);
    assert.doesNotMatch(migrationSource, /USING\s*\(true\)/i);
    assert.doesNotMatch(migrationSource, /CREATE TABLE public\.stores/);
});

test('compliance internal console routes are mounted with reason capture, read audit, retention, and dry-run export', () => {
    const internalConsoleSource = source('routes/internal-console.ts');
    const routeSource = source('routes/internal-console/compliance.ts');
    const helperSource = source('lib/internal-compliance.ts');
    const webhookSource = source('routes/app-store/compliance-routes.ts');

    assert.match(internalConsoleSource, /internalConsoleComplianceRouter/);
    assert.match(internalConsoleSource, /router\.route\('\/compliance',\s*internalConsoleComplianceRouter\)/);

    for (const endpoint of [
        "router.get('/overview'",
        "router.get('/data-requests'",
        "router.post('/data-requests'",
        "router.get('/data-requests/:id'",
        "router.patch('/data-requests/:id'",
        "router.get('/retention-policy'",
        "router.get('/audit-exports'",
        "router.post('/audit-exports/run'",
    ]) {
        assert.match(routeSource, new RegExp(endpoint.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }

    assert.match(routeSource, /validateSensitiveReason/);
    assert.match(routeSource, /data_subject_request\.list/);
    assert.match(routeSource, /data_subject_request\.view/);
    assert.match(routeSource, /audit_kind:\s*'sensitive_read'/);
    assert.match(routeSource, /runAuditExportDryRun/);
    assert.match(helperSource, /COMPLIANCE_RETENTION_POLICY/);
    assert.match(helperSource, /TRUST_SAFETY_RETENTION_EXEMPT_TABLES/);
    assert.match(helperSource, /upsertDataSubjectRequestFromComplianceWebhook/);
    assert.match(helperSource, /data_subject_request\.intake/);
    assert.match(helperSource, /audit_export\.dry_run/);
    assert.match(helperSource, /sha256Hex/);
    assert.match(webhookSource, /upsertDataSubjectRequestFromComplianceWebhook/);
    assert.match(webhookSource, /data_subject_request_id/);
});

test('compliance API client and platform console expose the real workflow without unavailable placeholders', () => {
    const clientSource = repositorySource('packages/typescript/api-client/src/index.ts');
    const pageSource = repositorySource('apps/internal/console/src/app/(dashboard)/compliance/page.tsx');
    const layoutSource = repositorySource('apps/internal/console/src/components/ConsoleShell.tsx');
    const sharedTypesSource = repositorySource('packages/shared-types/src/index.ts');

    for (const method of [
        'complianceOverview',
        'complianceDataRequests',
        'complianceDataSubjectRequest',
        'createComplianceDataSubjectRequest',
        'updateComplianceDataSubjectRequest',
        'complianceRetentionPolicy',
        'complianceAuditExports',
        'runComplianceAuditExport',
    ]) {
        assert.match(clientSource, new RegExp(method));
    }

    assert.match(clientSource, /\/internal\/console\/compliance\/data-requests/);
    assert.match(clientSource, /\/internal\/console\/compliance\/audit-exports\/run/);
    assert.match(sharedTypesSource, /ComplianceDataSubjectStatusSchema/);
    assert.match(sharedTypesSource, /COMPLIANCE_DATA_REQUEST_DUE_DAYS = 30/);
    assert.match(sharedTypesSource, /COMPLIANCE_AUDIT_EXPORT_DRY_RUN_SINK/);
    assert.match(pageSource, /Data Subject & Audit Export/);
    assert.match(pageSource, /createDataSubjectRequest/);
    assert.match(pageSource, /updateDataSubjectRequest/);
    assert.match(pageSource, /runAuditExport/);
    assert.match(pageSource, /Retention policy/);
    assert.match(pageSource, /T&S enforcement records are explicitly retention-exempt/);
    assert.match(layoutSource, /href="\/compliance"|href:\s*'\/compliance'/);
    assert.doesNotMatch(pageSource, /SkipBackendPanel/);
    assert.doesNotMatch(pageSource, /SKIPPED/i);
});

test('compliance worker advances the dry-run audit export cursor', () => {
    const workerSource = repositorySource('services/queue-workers/src/compliance.ts');
    const indexSource = repositorySource('services/queue-workers/src/index.ts');

    assert.match(workerSource, /isComplianceAuditExportJob/);
    assert.match(workerSource, /compliance\.audit_export\.run/);
    assert.match(workerSource, /audit_export_cursors/);
    assert.match(workerSource, /audit_logs/);
    assert.match(workerSource, /COMPLIANCE_AUDIT_EXPORT_DRY_RUN_SINK/);
    assert.match(workerSource, /sha256Hex/);
    assert.match(workerSource, /audit_export\.dry_run/);
    assert.match(indexSource, /processComplianceDeliveries/);
    assert.match(indexSource, /runComplianceAuditExportDryRun/);
    assert.match(indexSource, /compliance_result/);
    assert.match(indexSource, /scheduled\.compliance_audit_export/);
});
