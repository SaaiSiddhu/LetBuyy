import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const tenantTransaction = readFileSync(new URL('../lib/tenant-transaction.ts', import.meta.url), 'utf8');
const tenantContext = readFileSync(new URL('../lib/tenant-context.ts', import.meta.url), 'utf8');
const d4Migration = readFileSync(
    new URL('../../../../database/supabase/migrations/164_d4_tenant_role_guc.sql', import.meta.url),
    'utf8',
);
const d4Rollback = readFileSync(
    new URL('../../../../database/supabase/rollback/164_d4_tenant_role_guc.rollback.sql', import.meta.url),
    'utf8',
);
const queueWorker = readFileSync(new URL('../../../../services/queue-workers/src/index.ts', import.meta.url), 'utf8');
const queueSigner = readFileSync(new URL('../lib/queue-tenant-envelope.ts', import.meta.url), 'utf8');
const productionDeploy = readFileSync(new URL('../../../../.github/workflows/production-deploy.yml', import.meta.url), 'utf8');
const stagingDeploy = readFileSync(new URL('../../../../.github/workflows/staging-deploy.yml', import.meta.url), 'utf8');

test('D4 app tenant role and GUC migration are paired and non-bypass', () => {
    assert.match(d4Migration, /CREATE ROLE app_tenant NOLOGIN NOBYPASSRLS/);
    assert.match(d4Migration, /GRANT app_tenant TO postgres/);
    assert.match(d4Migration, /GRANT app_tenant TO service_role/);
    assert.match(d4Migration, /ALTER TABLE public\.%I FORCE ROW LEVEL SECURITY/);
    assert.match(d4Migration, /TO app_tenant USING \(%s\) WITH CHECK \(%s\)/);
    assert.match(d4Migration, /public\.current_site_id\(\)/);
    assert.match(d4Migration, /app_tenant_product_variants_guc/);
    assert.match(d4Migration, /app_tenant_product_options_guc/);

    assert.match(d4Rollback, /DROP POLICY IF EXISTS app_tenant_sites_guc/);
    assert.match(d4Rollback, /REVOKE app_tenant FROM postgres/);
    assert.match(d4Rollback, /DROP ROLE IF EXISTS app_tenant/);
});

test('D4 gateway exposes a real pooled SQL tenant transaction seam', () => {
    assert.match(tenantTransaction, /getPooledSql/);
    assert.match(tenantTransaction, /TenantTransactionUnavailableError/);
    assert.match(tenantTransaction, /refusing to fake SET LOCAL app\.site_id over Supabase REST/);
    assert.match(tenantTransaction, /SET LOCAL ROLE app_tenant/);
    assert.match(tenantTransaction, /tenantGucSetLocalStatement\(tenant\.siteId\)/);
    assert.match(tenantTransaction, /set_config\(\$1, \$2, true\)/);
    assert.match(tenantContext, /withResolvedTenantTx/);
});

test('D4 queue tenant scope must be signed, not taken from payload alone', () => {
    assert.match(queueSigner, /signQueueTenantEnvelope/);
    assert.match(queueSigner, /QUEUE_TENANT_ENVELOPE_SECRET/);
    assert.match(queueSigner, /HMAC/);

    assert.match(queueWorker, /verifiedTenantSiteId/);
    assert.match(queueWorker, /payloadHasTenantScope/);
    assert.match(queueWorker, /Tenant-scoped queue message requires signed tenant envelope/);
    assert.match(queueWorker, /Tenant envelope signature is invalid/);
    assert.match(queueWorker, /constantTimeEqual/);
    assert.match(queueWorker, /quarantinedDelivery/);

    assert.match(productionDeploy, /PRODUCTION_QUEUE_TENANT_ENVELOPE_SECRET/);
    assert.match(stagingDeploy, /STAGING_QUEUE_TENANT_ENVELOPE_SECRET/);
});
