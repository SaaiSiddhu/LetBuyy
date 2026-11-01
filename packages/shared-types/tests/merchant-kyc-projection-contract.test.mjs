import assert from 'node:assert/strict';
import test from 'node:test';
import { MerchantKycDocumentSchema, MerchantKycOverviewSchema } from '../src/index.ts';

const siteId = '11111111-1111-4111-8111-111111111111';
const document = {
  id: '22222222-2222-4222-8222-222222222222',
  site_id: siteId,
  document_type: 'business_pan',
  status: 'submitted',
  provider: 'letbuyy_sandbox_kyc',
  provider_mode: 'sandbox',
  provider_reference: null,
  has_private_upload: true,
  evidence_scan_status: 'pending',
  provider_unavailable: false,
  requires_resubmission: false,
  document_number_last4: '123F',
  rejection_reason: null,
  submitted_at: '2026-11-01T07:00:00+00:00',
  verified_at: null,
  rejected_at: null,
  created_at: '2026-11-01T07:00:00+00:00',
  updated_at: '2026-11-01T07:00:00+00:00',
  deleted_at: null,
};

test('merchant KYC projection accepts PostgREST timestamps and explicit upload admission', () => {
  const overview = {
    site_id: siteId,
    overall_status: 'in_progress',
    provider_mode: 'sandbox',
    private_upload_available: false,
    india_direct_upload_available: false,
    required_documents: [{ document_type: 'business_pan', title: 'Business PAN', required: true, status: 'submitted' }],
    documents: [document],
    next_action: 'Private document upload is unavailable.',
  };
  assert.deepEqual(MerchantKycOverviewSchema.parse(overview), overview);
  assert.equal(MerchantKycOverviewSchema.safeParse({ ...overview, private_upload_available: undefined }).success, false);
  assert.equal(MerchantKycOverviewSchema.safeParse({ ...overview, india_direct_upload_available: 'true' }).success, false);
});

test('merchant KYC projection rejects private storage and legacy link fields', () => {
  for (const extra of [
    { file_url: 'https://example.invalid/identity.pdf' },
    { file_name: 'identity.pdf' },
    { metadata: { private_object_key: 'kyc/site/document/key' } },
    { private_object_key: 'kyc/site/document/key' },
    { full_pan: 'ABCDE1234F' },
    { created_by: siteId },
  ]) {
    assert.equal(MerchantKycDocumentSchema.safeParse({ ...document, ...extra }).success, false, Object.keys(extra)[0]);
  }
  assert.equal(MerchantKycDocumentSchema.safeParse({ ...document, has_private_upload: undefined }).success, false);
  assert.equal(MerchantKycDocumentSchema.safeParse({ ...document, submitted_at: 'not-a-timestamp' }).success, false);
});
