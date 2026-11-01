import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { requireOwnedDatabase } from './owned-db-support';
import { gatewayEnv, newIdentityKeys } from './gateway-harness';
import { newSyntheticTenant, seedSyntheticTenant } from './synthetic-tenant';
import { drainKycIndiaObjectCleanup } from '../../lib/kyc-india-object-cleanup';

const owned = requireOwnedDatabase();
const forward = readFileSync(new URL('../../../../../database/supabase/migrations/424_kyc_india_cleanup_due.sql', import.meta.url), 'utf8');
const rollback = readFileSync(new URL('../../../../../database/supabase/rollback/424_kyc_india_cleanup_due.rollback.sql', import.meta.url), 'utf8');

test('India cleanup drains only unreferenced exact-key versions and retains current evidence', async () => {
    owned.psql(rollback);
    owned.psql(forward);
    const site = newSyntheticTenant('india-cleanup');
    const foreign = newSyntheticTenant('india-cleanup-other');
    seedSyntheticTenant(owned.psql, site);
    seedSyntheticTenant(owned.psql, foreign);
    const orphan = randomUUID(), retained = randomUUID(), deferred = randomUUID(), notDue = randomUUID();
    const idempotency = () => randomUUID();
    const intent = (siteId: string, id: string, due: boolean, documentType = 'business_pan') => `INSERT INTO kyc_private_object_cleanup_jobs
      (id,site_id,object_key,purpose,storage_provider,document_type,expected_sha256_hex,
       expected_bytes,expected_content_type,reference_last4,upload_idempotency_key,
       created_at,intent_expires_at,next_attempt_at,object_version_id,head_verified_at,created_by,updated_by)
      VALUES ('${id}','${siteId}','kyc/${siteId}/${documentType}/${id}','upload_reservation',
       'aws_s3_mumbai','${documentType}','${'a'.repeat(64)}',1234,'application/pdf','1234',
       '${idempotency()}',now()-interval '10 minutes',now()-interval '7 minutes',
       ${due ? "now()-interval '4 minutes'" : "now()+interval '1 hour'"},
       'synthetic-version',now()-interval '6 minutes','${randomUUID()}','${randomUUID()}');`;
    owned.psql(intent(site.siteId, orphan, true) + intent(site.siteId, retained, false)
        + intent(site.siteId, deferred, true) + intent(foreign.siteId, notDue, false));
    owned.psql(`INSERT INTO merchant_kyc_documents(id,site_id,document_type,status,provider,provider_mode,
      document_number_last4,metadata) VALUES ('${randomUUID()}','${site.siteId}',
      'business_pan','submitted','letbuyy_sandbox_kyc','sandbox','1234',
      '{"private_storage_provider":"aws_s3_mumbai","private_object_key":"kyc/${site.siteId}/business_pan/${retained}",
        "private_object_version_id":"synthetic-version","sha256":"${'a'.repeat(64)}",
        "byte_size":1234,"content_type":"application/pdf","malware_scan_status":"pending"}'::jsonb);`);
    owned.psql(`UPDATE kyc_private_object_cleanup_jobs SET next_attempt_at=now()-interval '4 minutes'
      WHERE id='${retained}';`);
    const env = gatewayEnv(owned, await newIdentityKeys(), {
        KYC_INDIA_CLEANUP_ENABLED: 'true', KYC_INDIA_BUCKET: 'private-kyc-mumbai',
        KYC_INDIA_ACCOUNT_ID: '123456789012',
        KYC_INDIA_CLEANUP_ACCESS_KEY_ID: 'AKIAIOSFODNN7EXAMPLE',
        KYC_INDIA_CLEANUP_SECRET_ACCESS_KEY: 'synthetic-cleanup-secret-for-tests',
    });
    assert.deepEqual(await drainKycIndiaObjectCleanup({ ...env, ENVIRONMENT: 'staging' }),
        { scanned: 0, deleted: 0, retained: 0, deferred: 0 },
        'staging cannot activate the synthetic cleanup path');
    assert.match(owned.psqlExpectError(`BEGIN; SET LOCAL ROLE app_tenant;
      SET LOCAL app.site_id='${site.siteId}';
      SELECT count(*) FROM public.list_due_kyc_india_cleanup_v1(20); COMMIT;`),
    /permission denied/, 'merchants cannot enumerate India cleanup jobs');
    assert.equal(owned.psql(`SELECT count(*) FROM public.list_due_kyc_private_cleanup_v1(20);`), '0',
        'the R2 due list cannot claim Mumbai jobs');
    const calls: string[] = [];
    const cleaner = async (input: { receiptId: string; siteId: string; bucket: string }) => {
        calls.push(input.receiptId);
        assert.equal(input.siteId, site.siteId);
        assert.equal(input.bucket, 'private-kyc-mumbai');
        if (input.receiptId === deferred) throw new Error('synthetic S3 outage');
        return { deleted: 2, remaining: false };
    };
    const result = await drainKycIndiaObjectCleanup(env, 20,
        cleaner as typeof import('@letbuyy/infrastructure/storage-adapter').cleanupKycIndiaS3ObjectVersions);
    assert.deepEqual(result, { scanned: 3, deleted: 1, retained: 1, deferred: 1 });
    assert.deepEqual(calls.sort(), [deferred, orphan].sort());
    assert.equal(owned.psql(`SELECT status||':'||outcome FROM kyc_private_object_cleanup_jobs WHERE id='${orphan}';`),
        'completed:deleted');
    assert.equal(owned.psql(`SELECT status||':'||outcome FROM kyc_private_object_cleanup_jobs WHERE id='${retained}';`),
        'completed:retained');
    assert.equal(owned.psql(`SELECT status||':'||attempts FROM kyc_private_object_cleanup_jobs WHERE id='${deferred}';`),
        'deleting:1');
    assert.match(owned.psqlExpectError(`UPDATE merchant_kyc_documents
      SET metadata=jsonb_set(metadata,'{private_object_key}',
        '"kyc/${site.siteId}/business_pan/${deferred}"'::jsonb)
      WHERE site_id='${site.siteId}' AND document_type='business_pan';`),
    /verified site-bound upload receipt/, 'a deleting receipt cannot be reattached');
    assert.equal(owned.psql(`SELECT status FROM kyc_private_object_cleanup_jobs WHERE id='${notDue}';`), 'pending');
    const oldProof = randomUUID(), newProof = randomUUID(), proofDocument = randomUUID();
    const proofMetadata = (receipt: string) => JSON.stringify({
        private_storage_provider: 'aws_s3_mumbai',
        private_object_key: `kyc/${site.siteId}/identity_proof/${receipt}`,
        private_upload_receipt_id: receipt, private_object_version_id: 'synthetic-version',
        sha256: 'a'.repeat(64), byte_size: 1234, content_type: 'application/pdf',
        malware_scan_status: 'pending',
    });
    owned.psql(intent(site.siteId, oldProof, false, 'identity_proof'));
    owned.psql(`UPDATE kyc_private_object_cleanup_jobs
      SET status='completed',outcome='retained',completed_at=now() WHERE id='${oldProof}';
      INSERT INTO merchant_kyc_documents(id,site_id,document_type,status,provider,provider_mode,
        document_number_last4,metadata) VALUES ('${proofDocument}','${site.siteId}',
        'identity_proof','submitted','letbuyy_sandbox_kyc','sandbox','1234',
        '${proofMetadata(oldProof)}'::jsonb);`);
    const scanEvent = randomUUID();
    assert.equal(owned.psql(`SELECT public.record_kyc_india_scan_v1('${site.siteId}',
      '${oldProof}','synthetic-version','${scanEvent}','clean',now());`), 'applied');
    owned.psql(intent(site.siteId, newProof, false, 'identity_proof'));
    owned.psql(`UPDATE merchant_kyc_documents SET metadata='${proofMetadata(newProof)}'::jsonb,
      status='submitted' WHERE id='${proofDocument}';`);
    assert.equal(owned.psql(`SELECT purpose||':'||status||':'||scan_verdict
      FROM kyc_private_object_cleanup_jobs WHERE id='${oldProof}';`),
    'replaced_object:pending:clean', 'replacement keeps the scanner audit while queuing old bytes');
    assert.equal(owned.psql(`SELECT public.claim_due_kyc_india_cleanup_v1('${oldProof}','${site.siteId}');`),
      'delete', 'an unreferenced scanned old version can be claimed for deletion');
    assert.equal(owned.psql(`SELECT status FROM kyc_private_object_cleanup_jobs WHERE id='${oldProof}';`),
      'deleting');
    assert.match(owned.psqlExpectError(rollback), /India KYC receipts exist; retain version-aware cleanup/);
});
