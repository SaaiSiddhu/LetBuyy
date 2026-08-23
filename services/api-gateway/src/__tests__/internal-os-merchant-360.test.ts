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

test('merchant 360 migration creates audited read-only impersonation sessions with real RLS', () => {
    const migrationSource = repositorySource('database/supabase/migrations/126_internal_os_merchant_360_impersonation.sql');

    assert.match(migrationSource, /CREATE TABLE IF NOT EXISTS public\.impersonation_sessions/);
    assert.match(migrationSource, /site_id uuid NOT NULL REFERENCES public\.sites\(id\)/);
    assert.match(migrationSource, /operator_id uuid NOT NULL/);
    assert.match(migrationSource, /reason text NOT NULL/);
    assert.match(migrationSource, /token_hash text NOT NULL UNIQUE/);
    assert.match(migrationSource, /CONSTRAINT impersonation_sessions_read_only_check CHECK \(read_only IS TRUE\)/);
    assert.match(migrationSource, /CREATE TRIGGER update_impersonation_sessions_updated_at/);
    assert.match(migrationSource, /EXECUTE FUNCTION public\.update_updated_at\(\)/);
    assert.match(migrationSource, /ALTER TABLE public\.impersonation_sessions ENABLE ROW LEVEL SECURITY/);
    assert.match(migrationSource, /impersonation_sessions_service_role_all/);
    assert.match(migrationSource, /auth\.role\(\) = 'service_role'::text/);
    assert.match(migrationSource, /CREATE POLICY impersonation_sessions_site_owner_read/);
    assert.match(migrationSource, /s\.id = impersonation_sessions\.site_id/);
    assert.match(migrationSource, /s\.user_id = auth\.uid\(\)/);
    assert.doesNotMatch(migrationSource, /USING\s*\(true\)/i);
    assert.doesNotMatch(migrationSource, /CREATE TABLE public\.stores/);
});

test('merchant 360 gateway routes aggregate context and audit sensitive reads/actions', () => {
    const routeSource = source('routes/internal-console.ts');

    assert.match(routeSource, /router\.get\('\/merchants\/search'/);
    assert.match(routeSource, /router\.get\('\/merchants\/:id\/overview'/);
    assert.match(routeSource, /router\.post\('\/merchants\/:id\/impersonation'/);
    assert.match(routeSource, /router\.post\('\/merchants\/:id\/impersonation\/:sessionId\/end'/);
    assert.match(routeSource, /router\.post\('\/merchants\/:id\/moderation'/);
    assert.match(routeSource, /action:\s*'merchant\.view'/);
    assert.match(routeSource, /action:\s*'merchant\.impersonation\.start'/);
    assert.match(routeSource, /action:\s*'merchant\.impersonation\.end'/);
    assert.match(routeSource, /'merchant\.suspend'/);
    assert.match(routeSource, /'merchant\.restore'/);
    assert.match(routeSource, /validateSensitiveReason/);
    assert.match(routeSource, /checkSegregationOfDuty/);
    assert.match(routeSource, /targetAction:\s*'merchant\.suspend'/);
    // S1 (SEC-R7): the impersonation token is a CSPRNG-generated opaque
    // credential, not an AUTH_SECRET-signed HMAC -- the signature was never
    // verified anywhere, so a random token gives the same real guarantee
    // (unguessable) without a shared symmetric signing secret.
    assert.match(routeSource, /generateImpersonationToken/);
    assert.match(routeSource, /crypto\.getRandomValues/);
    assert.doesNotMatch(routeSource, /hmacSha256Hex/);
    assert.doesNotMatch(routeSource, /AUTH_SECRET/);
    assert.match(routeSource, /sha256Hex/);
    assert.match(routeSource, /support:\s*\{\s*configured:\s*true/);
    assert.doesNotMatch(routeSource, /\.from\('stores'\)/);
});

test('merchant 360 API client exposes typed internal-console methods', () => {
    const clientSource = repositorySource('packages/typescript/api-client/src/index.ts');

    assert.match(clientSource, /InternalMerchantOverview/);
    assert.match(clientSource, /readonly internalConsole = \{/);
    assert.match(clientSource, /merchantSearch/);
    assert.match(clientSource, /\/internal\/console\/merchants\/search/);
    assert.match(clientSource, /merchantOverview/);
    assert.match(clientSource, /startMerchantImpersonation/);
    assert.match(clientSource, /endMerchantImpersonation/);
    assert.match(clientSource, /moderateMerchant/);
});

test('merchant 360 console surfaces replace placeholders with real links and actions', () => {
    const searchPageSource = repositorySource('apps/platform-console/src/app/(dashboard)/merchants/page.tsx');
    const detailPageSource = repositorySource('apps/platform-console/src/app/(dashboard)/merchants/[id]/page.tsx');
    const storesPageSource = repositorySource('apps/platform-console/src/app/(dashboard)/stores/page.tsx');
    const layoutSource = repositorySource('apps/platform-console/src/app/(dashboard)/layout.tsx');

    assert.match(searchPageSource, /\/internal\/console\/merchants\/search/);
    assert.match(searchPageSource, /href=\{`\/merchants\/\$\{row\.id\}`\}/);
    assert.match(detailPageSource, /\/internal\/console\/merchants\/\$\{id\}\/overview/);
    assert.match(detailPageSource, /startMerchantImpersonation/);
    assert.match(detailPageSource, /endMerchantImpersonation/);
    assert.match(detailPageSource, /moderateMerchant/);
    assert.match(detailPageSource, /secondary_approver_id/);
    assert.match(detailPageSource, /No support tickets are linked to this merchant/);
    assert.doesNotMatch(detailPageSource, /SkipBackendPanel/);
    assert.match(storesPageSource, /href=\{`\/merchants\/\$\{row\.id\}`\}/);
    assert.doesNotMatch(storesPageSource, /SkipBackendPanel/);
    assert.match(layoutSource, /href="\/merchants"\s+label="Merchant 360"|label:\s*'Merchant 360'[\s\S]*href:\s*'\/merchants'/);
});
