import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { requireOwnedDatabase } from './owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant } from './synthetic-tenant';

const owned = requireOwnedDatabase();
const forward = readFileSync(new URL('../../../../../database/supabase/migrations/421_kyc_india_upload_intent.sql', import.meta.url), 'utf8');
const rollback = readFileSync(new URL('../../../../../database/supabase/rollback/421_kyc_india_upload_intent.rollback.sql', import.meta.url), 'utf8');

function intent(siteId: string, id: string, key: string, documentType = 'business_pan'): string {
  return `INSERT INTO public.kyc_private_object_cleanup_jobs
    (id,site_id,object_key,purpose,storage_provider,document_type,expected_sha256_hex,
     expected_bytes,expected_content_type,reference_last4,upload_idempotency_key,
     intent_expires_at,next_attempt_at,created_by,updated_by)
    VALUES ('${id}','${siteId}','kyc/${siteId}/${documentType}/${id}',
      'upload_reservation','aws_s3_mumbai','${documentType}','${'a'.repeat(64)}',
      1234,'application/pdf','1234','${key}',now()+interval '3 minutes',
      now()+interval '1 hour','${randomUUID()}','${randomUUID()}');`;
}

function asTenant(siteId: string, statement: string): string {
  return `BEGIN; SET LOCAL ROLE app_tenant; SET LOCAL app.site_id = '${siteId}'; ${statement} COMMIT;`;
}

test('India upload intent is a durable, tenant-fenced extension of the existing receipt', () => {
  // The paired rollback is reversible only before real India evidence exists.
  owned.psql(rollback);
  owned.psql(forward);

  const a = newSyntheticTenant('kyc-india-a');
  const b = newSyntheticTenant('kyc-india-b');
  seedSyntheticTenant(owned.psql, a);
  seedSyntheticTenant(owned.psql, b);
  const aId = randomUUID(), bId = randomUUID(), key = randomUUID();
  owned.psql(intent(a.siteId, aId, key));
  owned.psql(intent(b.siteId, bId, randomUUID()));

  assert.match(owned.psql(asTenant(a.siteId, `SELECT
    (SELECT count(*) FROM public.kyc_private_object_cleanup_jobs WHERE site_id='${a.siteId}')::text
    || ':' ||
    (SELECT count(*) FROM public.kyc_private_object_cleanup_jobs WHERE site_id='${b.siteId}')::text;`)),
  /^1:0$/m, 'own-row positive control precedes cross-site denial');
  assert.match(owned.psqlExpectError(asTenant(a.siteId,
    `UPDATE public.kyc_private_object_cleanup_jobs SET status='completed' WHERE id='${aId}';`)),
  /permission denied/, 'the merchant pooled role cannot self-complete a receipt');
  const ownInsertId = randomUUID();
  owned.psql(asTenant(a.siteId, intent(a.siteId, ownInsertId, randomUUID())));
  assert.equal(owned.psql(`SELECT count(*) FROM public.kyc_private_object_cleanup_jobs
    WHERE id='${ownInsertId}' AND site_id='${a.siteId}';`), '1',
  'the same pooled role can create its own bounded intent');
  assert.match(owned.psqlExpectError(asTenant(a.siteId, intent(b.siteId, randomUUID(), randomUUID()))),
    /row-level security|permission denied/, 'a forged foreign-site insert is denied');

  assert.match(owned.psqlExpectError(intent(a.siteId, randomUUID(), key)),
    /kyc_india_upload_intent_idempotency_idx/, 'the same site/type/idempotency key cannot reserve twice');
  const malformedId = randomUUID();
  const malformed = intent(a.siteId, malformedId, randomUUID()).replace("'application/pdf'", "'text/html'");
  assert.match(owned.psqlExpectError(malformed), /kyc_india_upload_intent_check/);
  const missingDigest = intent(a.siteId, randomUUID(), randomUUID()).replace(`'${'a'.repeat(64)}'`, 'NULL');
  assert.match(owned.psqlExpectError(missingDigest), /kyc_india_upload_intent_check/,
    'a nullable SQL CHECK must not allow a missing checksum');
  const wrongSite = intent(a.siteId, randomUUID(), randomUUID()).replace(`kyc/${a.siteId}/`, `kyc/${b.siteId}/`);
  assert.match(owned.psqlExpectError(wrongSite), /kyc_india_upload_intent_check|kyc_private_cleanup_site_key/);

  assert.match(owned.psqlExpectError(`INSERT INTO public.merchant_kyc_documents
    (site_id,document_type,status,provider,provider_mode,metadata)
    VALUES ('${a.siteId}','identity_proof','submitted','letbuyy_sandbox_kyc','sandbox',
      '{"private_storage_provider":"aws_s3_mumbai"}'::jsonb);`),
  /verified site-bound upload receipt|merchant_kyc_india_object_version_check/,
  'a bare S3 POST cannot become accepted evidence');

  assert.match(owned.psqlExpectError(`UPDATE public.kyc_private_object_cleanup_jobs
    SET status='completed', outcome='retained', completed_at=now()
    WHERE id='${aId}';`), /kyc_india_upload_intent_check/,
  'an unverified object cannot complete the receipt');
  owned.psql(`UPDATE public.kyc_private_object_cleanup_jobs
    SET object_version_id='synthetic/version+1', head_verified_at=now(),
      status='completed', outcome='retained', completed_at=now()
    WHERE id='${aId}';`);

  const oldObject = randomUUID(), newObject = randomUUID();
  const meta = (objectId: string, version: string) => JSON.stringify({
    private_storage_provider: 'aws_s3_mumbai',
    private_object_key: `kyc/${a.siteId}/identity_proof/${objectId}`,
    private_object_version_id: version,
    sha256: 'a'.repeat(64), byte_size: 1234, content_type: 'application/pdf',
    malware_scan_status: 'pending',
  });
  assert.match(owned.psqlExpectError(`INSERT INTO public.merchant_kyc_documents
    (site_id,document_type,document_number_last4,status,provider,provider_mode,metadata)
    VALUES ('${a.siteId}','identity_proof','1234','submitted','letbuyy_sandbox_kyc','sandbox',
      '${meta(oldObject, 'old-version')}'::jsonb);`),
  /India KYC evidence requires a verified site-bound upload receipt/,
  'even valid-looking metadata cannot point at an object without a verified intent');
  owned.psql(intent(a.siteId, oldObject, randomUUID(), 'identity_proof'));
  owned.psql(`UPDATE public.kyc_private_object_cleanup_jobs
    SET object_version_id='old-version', head_verified_at=now()
    WHERE id='${oldObject}';`);
  owned.psql(`INSERT INTO public.merchant_kyc_documents
    (site_id,document_type,document_number_last4,status,provider,provider_mode,metadata)
    VALUES ('${a.siteId}','identity_proof','1234','submitted','letbuyy_sandbox_kyc','sandbox',
      '${meta(oldObject, 'old-version')}'::jsonb);`);
  owned.psql(intent(a.siteId, newObject, randomUUID(), 'identity_proof'));
  owned.psql(`UPDATE public.kyc_private_object_cleanup_jobs
    SET object_version_id='new-version', head_verified_at=now()
    WHERE id='${newObject}';`);
  owned.psql(`UPDATE public.merchant_kyc_documents
    SET metadata='${meta(newObject, 'new-version')}'::jsonb
    WHERE site_id='${a.siteId}' AND document_type='identity_proof';`);
  assert.equal(owned.psql(`SELECT storage_provider || ':' || object_version_id || ':' || purpose
    FROM public.kyc_private_object_cleanup_jobs
    WHERE site_id='${a.siteId}' AND object_key='kyc/${a.siteId}/identity_proof/${oldObject}';`),
  'aws_s3_mumbai:old-version:replaced_object',
  'the replacement retry records the exact old object version and provider');
  assert.match(owned.psqlExpectError(rollback),
    /India KYC object evidence exists; retain versioned upload receipts/,
    'rollback preserves pending India upload receipts');
});
