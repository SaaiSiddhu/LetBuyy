import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const testDir = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(testDir, '..');
const repositoryRoot = join(testDir, '../../../..');

function source(path: string): string {
    return readFileSync(join(srcRoot, path), 'utf8');
}

function repositorySource(path: string): string {
    return readFileSync(join(repositoryRoot, path), 'utf8');
}

test('Task 015 security route is mounted with DSR export/erase and mock step-up challenge APIs', () => {
    const indexSource = source('index.ts');
    const securityRoute = source('routes/security.ts');

    assert.match(indexSource, /import securityRouter from '\.\/routes\/security'/);
    assert.match(indexSource, /api\.route\('\/security', securityRouter\)/);
    assert.match(indexSource, /LETBUYY_KMS_MODE\?: 'mock' \| 'live'/);
    assert.match(securityRoute, /router\.post\('\/step-up\/challenges'/);
    assert.match(securityRoute, /router\.post\('\/dsr\/export'/);
    assert.match(securityRoute, /router\.post\('\/dsr\/erase'/);
    assert.match(securityRoute, /resolveTenantContextForOwnedSite/);
    assert.match(securityRoute, /createManualDataSubjectRequest/);
    assert.match(securityRoute, /updateDataSubjectRequest/);
    assert.match(securityRoute, /encryptFieldWithKms/);
    assert.match(securityRoute, /customer\.dsr_requested/);
    assert.match(securityRoute, /auth\.stepup/);
});

test('Task 015 payout and refund sensitive actions require shared step-up evidence', () => {
    const securityControls = source('lib/security-controls.ts');
    const paymentsRoute = source('routes/payments.ts');
    const payoutsRoute = source('routes/payouts.ts');

    assert.match(securityControls, /export function verifySensitiveActionStepUp/);
    assert.match(securityControls, /STEP_UP_WINDOW_MS = 10 \* 60 \* 1000/);
    assert.match(paymentsRoute, /verifySensitiveActionStepUp\(\{[\s\S]*action: 'refund\.approve'/);
    assert.match(paymentsRoute, /STEP_UP_REQUIRED|stepUpErrorBody/);
    assert.match(payoutsRoute, /verifySensitiveActionStepUp\(\{[\s\S]*action: 'payout\.release'/);
    assert.match(payoutsRoute, /STEP_UP_REQUIRED|stepUpErrorBody/);
});

test('Task 015 migration adds consent, encrypted DSR, store-credit, step-up, and maker-checker tables with RLS', () => {
    const migration = repositorySource('database/supabase/migrations/153_executable_identity_security.sql');
    const rollback = repositorySource('database/supabase/rollback/153_executable_identity_security.rollback.sql');

    assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.consents/);
    assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.store_credit/);
    assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.store_credit_ledger_entries/);
    assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.customer_dsr_exports/);
    assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.step_up_challenges/);
    assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.sensitive_action_approvals/);
    assert.match(migration, /encrypted_email text/);
    assert.match(migration, /encrypted_payload text/);
    assert.match(migration, /encrypted_identifier text/);
    assert.match(migration, /FORCE ROW LEVEL SECURITY/);
    assert.match(migration, /site_id = public\.current_site_id\(\)/);
    assert.match(migration, /store_id = public\.current_site_id\(\)/);
    assert.match(migration, /EXECUTE FUNCTION public\.update_updated_at\(\)/);
    assert.doesNotMatch(migration, /PARTITION BY/i);

    assert.match(rollback, /DROP TABLE IF EXISTS public\.sensitive_action_approvals/);
    assert.match(rollback, /DROP TABLE IF EXISTS public\.step_up_challenges/);
    assert.match(rollback, /DROP TABLE IF EXISTS public\.customer_dsr_exports/);
    assert.match(rollback, /DROP TABLE IF EXISTS public\.store_credit/);
    assert.match(rollback, /DROP TABLE IF EXISTS public\.consents/);
});

test('Task 015 event catalog and live-path registry cover auth/security outcomes', () => {
    const eventCore = repositorySource('packages/event-core/src/index.ts');
    const humanRequired = repositorySource('EXECUTABLE_HUMAN_REQUIRED.md');
    const liveSkips = repositorySource('tests/executable/human-required-live-paths.test.mjs');
    const operationsPage = repositorySource('apps/platform-operations-portal/src/app/(dashboard)/operations/page.tsx');

    assert.match(eventCore, /'auth\.login'/);
    assert.match(eventCore, /'auth\.stepup'/);
    assert.match(eventCore, /'customer\.dsr_requested'/);
    assert.match(humanRequired, /HR-KMS-LIVE/);
    assert.match(humanRequired, /HR-TURNSTILE-LIVE/);
    assert.match(humanRequired, /HR-LEGAL-DPDP-PA/);
    assert.match(liveSkips, /\[HUMAN-REQUIRED] HR-TURNSTILE-LIVE/);
    assert.match(liveSkips, /\[HUMAN-REQUIRED] HR-LEGAL-DPDP-PA/);
    assert.match(operationsPage, /formatIndiaDateTime/);
    assert.doesNotMatch(operationsPage, /function formatDate|const formatDate/);
});
