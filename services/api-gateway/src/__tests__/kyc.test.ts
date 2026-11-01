import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
    createKycVerificationAdapter,
    KycProviderUnavailableError,
} from '@letbuyy/infrastructure/kyc-verification-adapter';
import { deriveKycOverallStatus } from '../routes/kyc';
import { acceptsLiveKycApproval } from '../lib/kyc-evidence-status';

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

test('KYC route requires private evidence, scopes it to a tenant, and stores provider status', () => {
    assert.match(kycSource, /router\.get\('\/'/);
    assert.match(kycSource, /router\.post\('\/documents'/);
    assert.match(kycSource, /KYC_PRIVATE_UPLOAD_REQUIRED/);
    assert.match(kycSource, /router\.post\('\/documents\/upload'/);
    assert.match(kycSource, /router\.post\('\/documents\/:id\/refresh'/);
    assert.match(kycSource, /resolveTenantContextForOwnedSite\(c,\s*query\.store_id\)/);
    assert.match(kycSource, /resolveTenantContextForOwnedSite\(c,\s*input\.data\.store_id\)/);
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

test('KYC adapter is sandbox-first, manual-review aware, and fail-closed for automated live providers', async () => {
    assert.match(adapterSource, /export function createKycVerificationAdapter/);
    assert.match(adapterSource, /credentials\.mode === 'live' && credentials\.provider === 'manual'/);
    assert.doesNotMatch(adapterSource, /KYC_LIVE_PROVIDER_CREDENTIALS_REQUIRED/);
    assert.match(adapterSource, /automated live KYC provider integration is unavailable/);
    assert.match(adapterSource, /KYC_LIVE_PROVIDER_UNAVAILABLE/);
    assert.doesNotMatch(adapterSource, /live_provider_stub/);
    assert.match(adapterSource, /status: hasEvidence \? 'submitted' : 'needs_review'/);
    assert.match(adapterSource, /manual_review_required: true/);

    const manual = createKycVerificationAdapter({ provider: 'manual', mode: 'live' });
    const result = await manual.verifyDocument({
        siteId: '11111111-1111-4111-8111-111111111111',
        documentId: '22222222-2222-4222-8222-222222222222',
        documentType: 'business_pan',
        documentNumberLast4: '1234',
    });
    assert.equal(result.status, 'needs_review');
    assert.equal(result.provider, 'manual');
    assert.equal(result.providerMode, 'live');
    assert.equal(result.metadata.manual_review_required, true);
    assert.match(result.providerReference, /^kyc_manual_review_/);

    const sandbox = createKycVerificationAdapter({ provider: 'letbuyy_sandbox_kyc', mode: 'sandbox' });
    const sandboxResult = await sandbox.verifyDocument({
        siteId: '11111111-1111-4111-8111-111111111111',
        documentId: '22222222-2222-4222-8222-222222222222',
        documentType: 'bank_proof',
        documentNumberLast4: '1234',
    });
    assert.equal(sandboxResult.status, 'submitted');
    assert.equal(sandboxResult.providerMode, 'sandbox');

    assert.throws(
        () => createKycVerificationAdapter({ provider: 'signzy', mode: 'live', apiKey: 'provider-key' }),
        KycProviderUnavailableError,
    );
});

test('sandbox and provider-unavailable records never complete business verification', () => {
    const documents = ['business_pan', 'bank_proof', 'address_proof'].map((document_type) => ({
        document_type,
        status: 'verified',
        provider_mode: 'sandbox',
        provider: 'letbuyy_sandbox_kyc',
        provider_reference: `sandbox-${document_type}`,
        metadata: { sandbox: true } as Record<string, unknown>,
    }));
    const status = () => deriveKycOverallStatus(documents as unknown as Parameters<typeof deriveKycOverallStatus>[0]);
    assert.notEqual(status(), 'verified');
    documents.forEach((row) => { row.provider_mode = 'live'; row.provider = 'signzy'; row.metadata = { provider_unavailable: true }; });
    assert.notEqual(status(), 'verified');
    documents.forEach((row) => { row.metadata = { sandbox: false }; row.provider_reference = ''; });
    assert.notEqual(status(), 'verified');
    documents.forEach((row) => { row.provider_reference = `provider-${row.document_type}`; });
    assert.notEqual(status(), 'verified');
    documents.forEach((row) => { row.metadata = { provider_verified: true, private_object_key: `kyc/site/${row.document_type}/file`, malware_scan_status: 'pending' }; });
    assert.notEqual(status(), 'verified', 'provider approval cannot bypass a pending safety scan');
    documents.forEach((row) => { row.metadata.malware_scan_status = 'clean'; });
    assert.equal(status(), 'verified');
    // A replaced bank proof revokes the combined approval even while PAN and
    // address evidence retain their provider decisions.
    documents[1]!.status = 'submitted';
    documents[1]!.provider_reference = '';
    documents[1]!.metadata = { provider_review_required: true };
    assert.equal(status(), 'in_progress');
    documents[1]!.status = 'rejected';
    assert.equal(status(), 'rejected');
    documents[1]!.status = 'verified';
    documents[1]!.provider_reference = 'provider-bank_proof';
    documents[1]!.metadata = { provider_verified: true, private_object_key: 'kyc/site/bank_proof/file', malware_scan_status: 'clean' };
    assert.equal(status(), 'verified');
    documents[0]!.metadata = { provider_verified: true, private_object_key: 'kyc/site/business_pan/file', malware_scan_status: 'clean', provider_unavailable: true };
    assert.equal(status(), 'needs_review', 'an untrusted old approval must agree with its Needs review document badge');
});

test('GST registration makes its certificate a required KYC approval without reviving an optional rejection', () => {
    const documents = ['business_pan', 'bank_proof', 'address_proof'].map((document_type) => ({
        document_type,
        status: 'verified',
        provider_mode: 'live',
        provider: 'signzy',
        provider_reference: `synthetic-${document_type}`,
        metadata: { provider_verified: true, private_object_key: `kyc/site/${document_type}/fixture`, malware_scan_status: 'clean' },
    }));
    const rows = documents as unknown as Parameters<typeof deriveKycOverallStatus>[0];
    assert.equal(deriveKycOverallStatus(rows, false), 'verified');
    assert.equal(deriveKycOverallStatus(rows, true), 'in_progress',
        'a later GST registration must require its certificate before the business remains verified');
    documents.push({
        document_type: 'gst_certificate', status: 'verified', provider_mode: 'live', provider: 'signzy',
        provider_reference: 'synthetic-gst',
        metadata: { provider_verified: true, private_object_key: 'kyc/site/gst_certificate/fixture', malware_scan_status: 'clean' },
    });
    assert.equal(deriveKycOverallStatus(rows, true), 'verified');
    documents[3]!.status = 'rejected';
    assert.equal(deriveKycOverallStatus(rows, true), 'rejected');
    assert.equal(deriveKycOverallStatus(rows, false), 'verified',
        'a rejected optional GST certificate does not block an unregistered merchant');
});

test('a provider status alone cannot authorize a stored KYC verified timestamp', () => {
    const evidence = {
        status: 'submitted' as const,
        provider: 'signzy',
        provider_mode: 'live' as const,
        metadata: { private_object_key: 'kyc/site/business_pan/object', malware_scan_status: 'clean' },
    };
    const result = {
        status: 'verified' as const,
        provider: 'signzy' as const,
        providerMode: 'live' as const,
        providerReference: 'provider-lookup-reference',
        metadata: { provider_verified: true },
    };
    assert.equal(acceptsLiveKycApproval(evidence, result), true);
    assert.equal(acceptsLiveKycApproval(evidence, { ...result, providerReference: '' }), false);
    assert.equal(acceptsLiveKycApproval(evidence, { ...result, providerMode: 'sandbox' }), false);
    assert.equal(acceptsLiveKycApproval(evidence, { ...result, provider: 'manual' }), false);
    assert.equal(acceptsLiveKycApproval(evidence, { ...result, status: 'submitted' }), false);
    assert.equal(acceptsLiveKycApproval(evidence, { ...result, metadata: {} }), false);
    assert.equal(acceptsLiveKycApproval(evidence, { ...result, metadata: { provider_verified: true, provider_unavailable: true } }), false);
    assert.equal(acceptsLiveKycApproval({ ...evidence, metadata: { ...evidence.metadata, malware_scan_status: 'pending' } }, result), false);
    assert.equal(acceptsLiveKycApproval({ ...evidence, metadata: { malware_scan_status: 'clean' } }, result), false);
    assert.equal(acceptsLiveKycApproval({ ...evidence, metadata: {
        ...evidence.metadata, profile_change_requires_resubmission: true,
    } }, result), false, 'old evidence cannot regain approval after a business profile change');
    assert.equal(acceptsLiveKycApproval({ ...evidence, metadata: { malware_scan_status: 'pending' } }, {
        ...result, metadata: { provider_verified: true, private_object_key: 'provider-claimed-object', malware_scan_status: 'clean' },
    }), false, 'provider metadata cannot forge the trusted upload pointer or scanner verdict');
});
