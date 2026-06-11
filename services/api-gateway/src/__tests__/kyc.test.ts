import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const indexSource = readFileSync(new URL('../index.ts', import.meta.url), 'utf8');
const kycSource = readFileSync(new URL('../routes/kyc.ts', import.meta.url), 'utf8');
const bffSource = readFileSync(new URL('../../../mobile-bff/src/index.ts', import.meta.url), 'utf8');
const migrationSource = readFileSync(new URL('../../../../database/supabase/migrations/120_mobile_kyc_documents.sql', import.meta.url), 'utf8');
const adapterSource = readFileSync(new URL('../../../../packages/infrastructure/kyc-verification-adapter/index.ts', import.meta.url), 'utf8');

test('merchant KYC route is mounted and mobile allowlisted', () => {
    assert.match(indexSource, /import kycRouter from '\.\/routes\/kyc'/);
    assert.match(indexSource, /api\.route\('\/kyc', kycRouter\)/);
    assert.match(bffSource, /'\/v1\/kyc'/);
});

test('KYC route is tenant-scoped and stores provider status', () => {
    assert.match(kycSource, /router\.get\('\/'/);
    assert.match(kycSource, /router\.post\('\/documents'/);
    assert.match(kycSource, /router\.post\('\/documents\/:id\/refresh'/);
    assert.match(kycSource, /resolveTenantContextForOwnedSite\(c,\s*query\.store_id\)/);
    assert.match(kycSource, /resolveTenantContextForOwnedSite\(c,\s*body\.store_id\)/);
    assert.match(kycSource, /\.from\('merchant_kyc_documents'\)[\s\S]*\.insert/);
    assert.match(kycSource, /\.from\('merchant_kyc_documents'\)[\s\S]*\.update/);
    assert.match(kycSource, /createKycVerificationAdapter/);
    assert.doesNotMatch(kycSource, /S-021|backend contract|SKIP-NEEDS-BACKEND/);
});

test('KYC migration declares tenant RLS and approved updated_at trigger', () => {
    assert.match(migrationSource, /CREATE TABLE IF NOT EXISTS public\.merchant_kyc_documents/);
    assert.match(migrationSource, /site_id uuid NOT NULL REFERENCES public\.sites\(id\)/);
    assert.match(migrationSource, /ALTER TABLE public\.merchant_kyc_documents ENABLE ROW LEVEL SECURITY/);
    assert.match(migrationSource, /CREATE POLICY merchant_kyc_documents_service_all ON public\.merchant_kyc_documents[\s\S]*FOR ALL TO service_role/);
    assert.match(migrationSource, /CREATE POLICY merchant_kyc_documents_site_owner_all ON public\.merchant_kyc_documents[\s\S]*FOR ALL TO authenticated/);
    assert.match(migrationSource, /update_merchant_kyc_documents_updated_at[\s\S]*EXECUTE FUNCTION public\.update_updated_at\(\)/);
});

test('KYC adapter is sandbox-first and fail-closed for live providers', () => {
    assert.match(adapterSource, /export function createKycVerificationAdapter/);
    assert.match(adapterSource, /credentials\.mode === 'live'/);
    assert.doesNotMatch(adapterSource, /KYC_LIVE_PROVIDER_CREDENTIALS_REQUIRED/);
    assert.match(adapterSource, /live KYC provider integration is unavailable/);
    assert.match(adapterSource, /KYC_LIVE_PROVIDER_UNAVAILABLE/);
    assert.doesNotMatch(adapterSource, /live_provider_stub/);
    assert.match(adapterSource, /status: hasEvidence \? 'verified' : 'needs_review'/);
});
