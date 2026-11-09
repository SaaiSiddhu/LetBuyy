import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test, { after } from 'node:test';
import { requireOwnedDatabase } from './owned-db-support';
import { Gateway, gatewayEnv, newIdentityKeys, signedIdentityHeaders } from './gateway-harness';
import { newSyntheticTenant, seedSyntheticTenant } from './synthetic-tenant';
import { drainKycIndiaObjectCleanup } from '../../lib/kyc-india-object-cleanup';

const owned = requireOwnedDatabase();
const forward = readFileSync(new URL('../../../../../database/supabase/migrations/428_kyc_india_cleanup_due.sql', import.meta.url), 'utf8');
const rollback = readFileSync(new URL('../../../../../database/supabase/rollback/428_kyc_india_cleanup_due.rollback.sql', import.meta.url), 'utf8');
const retentionForward = readFileSync(new URL('../../../../../database/supabase/migrations/429_kyc_india_pending_retention.sql', import.meta.url), 'utf8');
const retentionRollback = readFileSync(new URL('../../../../../database/supabase/rollback/429_kyc_india_pending_retention.rollback.sql', import.meta.url), 'utf8');
const closureForward = readFileSync(new URL('../../../../../database/supabase/migrations/430_kyc_store_closure_cleanup.sql', import.meta.url), 'utf8');
const closureRollback = readFileSync(new URL('../../../../../database/supabase/rollback/430_kyc_store_closure_cleanup.rollback.sql', import.meta.url), 'utf8');
const deadlineForward = readFileSync(new URL('../../../../../database/supabase/migrations/431_kyc_india_deletion_deadline.sql', import.meta.url), 'utf8');
const deadlineRollback = readFileSync(new URL('../../../../../database/supabase/rollback/431_kyc_india_deletion_deadline.rollback.sql', import.meta.url), 'utf8');
const holdForward = readFileSync(new URL('../../../../../database/supabase/migrations/432_kyc_india_exact_legal_hold.sql', import.meta.url), 'utf8');
const holdRollback = readFileSync(new URL('../../../../../database/supabase/rollback/432_kyc_india_exact_legal_hold.rollback.sql', import.meta.url), 'utf8');
let gateway: Gateway;
after(async () => { await gateway?.settle(); });

test('India cleanup drains only unreferenced exact-key versions and retains current evidence', async () => {
    owned.psql(holdRollback);
    owned.psql(deadlineRollback);
    owned.psql(closureRollback);
    owned.psql(retentionRollback);
    owned.psql(rollback);
    owned.psql(forward);
    owned.psql(retentionForward);
    owned.psql(closureForward);
    owned.psql(deadlineForward);
    owned.psql(holdForward);
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
        { scanned: 0, deleted: 0, retained: 0, deferred: 0, expired: 0,
          overdue: 0, held: 0, holdReviewOverdue: 0, holdExpired: 0, oldestDueAt: null },
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
    assert.deepEqual(result, { scanned: 3, deleted: 1, retained: 1, deferred: 1, expired: 0,
      overdue: 0, held: 0, holdReviewOverdue: 0, holdExpired: 0, oldestDueAt: null });
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
    const expired = randomUUID(), fresh = randomUUID(), expiredDocument = randomUUID();
    owned.psql(intent(site.siteId, expired, false, 'address_proof'));
    owned.psql(`UPDATE kyc_private_object_cleanup_jobs SET
      created_at=now()-interval '31 days 10 minutes',
      intent_expires_at=now()-interval '31 days 7 minutes',
      next_attempt_at=now()-interval '31 days 5 minutes',
      head_verified_at=now()-interval '31 days 4 minutes',
      status='completed',outcome='retained',
      completed_at=now()-interval '31 days 3 minutes'
      WHERE id='${expired}';
      INSERT INTO merchant_kyc_documents(id,site_id,document_type,status,provider,provider_mode,
        document_number_last4,submitted_at,metadata) VALUES ('${expiredDocument}','${site.siteId}',
        'address_proof','submitted','letbuyy_sandbox_kyc','sandbox','1234',now()-interval '31 days',
        '{"private_storage_provider":"aws_s3_mumbai",
          "private_object_key":"kyc/${site.siteId}/address_proof/${expired}",
          "private_upload_receipt_id":"${expired}","private_object_version_id":"synthetic-version",
          "sha256":"${'a'.repeat(64)}","byte_size":1234,
          "content_type":"application/pdf","malware_scan_status":"pending"}'::jsonb);`);
    assert.match(owned.psqlExpectError(`BEGIN; SET LOCAL ROLE app_tenant;
      SET LOCAL app.site_id='${site.siteId}';
      SELECT public.expire_kyc_india_pending_v1(20); COMMIT;`), /permission denied/);
    const expiredResult = await drainKycIndiaObjectCleanup(env, 20,
      (async (input: { receiptId: string; siteId: string }) => {
        assert.equal(input.receiptId, expired);
        assert.equal(input.siteId, site.siteId);
        return { deleted: 1, remaining: false };
      }) as typeof import('@letbuyy/infrastructure/storage-adapter').cleanupKycIndiaS3ObjectVersions);
    assert.deepEqual(expiredResult, { scanned: 1, deleted: 1, retained: 0, deferred: 0, expired: 1,
      overdue: 0, held: 0, holdReviewOverdue: 0, holdExpired: 0, oldestDueAt: null });
    assert.equal(owned.psql(`SELECT status||':'||(metadata->>'retention_reason')||':'||
      (metadata->>'retention_requires_resubmission')||':'||
      coalesce(metadata->>'private_object_key','cleared')
      FROM merchant_kyc_documents WHERE id='${expiredDocument}';`),
    'needs_review:pending_timeout:true:cleared');
    assert.equal(owned.psql(`SELECT purpose||':'||status||':'||outcome
      FROM kyc_private_object_cleanup_jobs WHERE id='${expired}';`),
    'replaced_object:completed:deleted');
    assert.equal(owned.psql(`SELECT retention_expired_at IS NOT NULL
      FROM kyc_private_object_cleanup_jobs WHERE id='${expired}';`), 't');
    const owner = randomUUID();
    owned.psql(`INSERT INTO users_custom(id,email,email_verified,full_name) VALUES
      ('${owner}','kyc-retention-${owner}@example.invalid',true,'Synthetic KYC owner');
      UPDATE sites SET custom_user_id='${owner}' WHERE id='${site.siteId}';`);
    const activeHold = randomUUID();
    owned.psql(`INSERT INTO kyc_india_legal_holds
      (id,site_id,receipt_id,authority_type,authority_reference,reason,request_key,
       review_at,expires_at,created_by,updated_by)
      VALUES ('${activeHold}','${site.siteId}','${retained}','statutory',
       'SYN-ACTIVE-ORDER','Synthetic active evidence preservation','${randomUUID()}',
       now()+interval '1 day',now()+interval '2 days','${owner}','${owner}');`);
    assert.equal(Number(JSON.parse(owned.psql(`SELECT public.kyc_india_cleanup_overdue_v1();`)).held_count), 1,
      'review monitoring includes a retained document before deletion is queued');
    owned.psql(`UPDATE kyc_india_legal_holds
      SET released_at=now(),released_by='${owner}',release_request_key='${randomUUID()}',
        release_reason='Synthetic active order withdrawn',updated_by='${owner}'
      WHERE id='${activeHold}';`);
    gateway = new Gateway({ ...env, KYC_INDIA_UPLOAD_ENABLED: 'true',
      KYC_INDIA_UPLOAD_ROLE_ARN: 'arn:aws:iam::123456789012:role/owned-test-upload',
      KYC_INDIA_STS_ACCESS_KEY_ID: 'AKIAIOSFODNN7EXAMPLE',
      KYC_INDIA_STS_SECRET_ACCESS_KEY: 'synthetic-upload-secret-for-tests',
      KYC_INDIA_HEAD_ACCESS_KEY_ID: 'AKIAIOSFODNN7EXAMPLE',
      KYC_INDIA_HEAD_SECRET_ACCESS_KEY: 'synthetic-head-secret-for-tests',
    });
    const headers = await signedIdentityHeaders(owner, `kyc-retention-${owner}@example.invalid`, site.siteId);
    const overview = await gateway.request(`/v1/kyc?store_id=${site.siteId}`, { headers });
    assert.equal(overview.status, 200, overview.text);
    assert.equal(overview.json?.data.india_direct_upload_available, true);
    assert.equal(overview.json?.data.documents.find((row: { document_type: string }) =>
      row.document_type === 'address_proof')?.requires_resubmission, true);
    assert.match(overview.json?.data.next_action, /expired after 30 days.*Upload a fresh document/);
    assert.ok(!overview.text.includes(`kyc/${site.siteId}/address_proof/${expired}`));
    const refreshHeaders = await signedIdentityHeaders(owner,
      `kyc-retention-${owner}@example.invalid`, site.siteId);
    const refreshed = await gateway.request(`/v1/kyc/documents/${expiredDocument}/refresh?store_id=${site.siteId}`,
      { method: 'POST', headers: { ...refreshHeaders, 'X-Idempotency-Key': randomUUID() } });
    assert.equal(refreshed.status, 200, refreshed.text);
    assert.equal(refreshed.json?.data.document.requires_resubmission, true);
    assert.match(refreshed.json?.data.overview.next_action, /expired after 30 days.*Upload a fresh document/);
    assert.equal(owned.psql(`SELECT public.record_kyc_india_scan_v1('${site.siteId}',
      '${expired}','synthetic-version','${randomUUID()}','clean',now());`), 'stale');
    assert.match(owned.psqlExpectError(`UPDATE merchant_kyc_documents SET status='verified',
      provider_reference='stale-provider-result',verified_at=now()
      WHERE id='${expiredDocument}';`), /requires a new private upload/);
    assert.match(owned.psqlExpectError(retentionRollback),
      /India KYC pending attempts expired; preserve retention guard/);
    owned.psql(intent(site.siteId, fresh, false, 'address_proof'));
    owned.psql(`UPDATE kyc_private_object_cleanup_jobs SET status='completed',
      outcome='retained',completed_at=now() WHERE id='${fresh}';
      UPDATE merchant_kyc_documents SET status='submitted',submitted_at=now(),
      metadata='{"private_storage_provider":"aws_s3_mumbai",
        "private_object_key":"kyc/${site.siteId}/address_proof/${fresh}",
        "private_upload_receipt_id":"${fresh}","private_object_version_id":"synthetic-version",
        "sha256":"${'a'.repeat(64)}","byte_size":1234,
        "content_type":"application/pdf","malware_scan_status":"pending"}'::jsonb
      WHERE id='${expiredDocument}';`);
    assert.equal(owned.psql(`SELECT status||':'||coalesce(metadata->>'retention_reason','fresh')
      FROM merchant_kyc_documents WHERE id='${expiredDocument}';`), 'submitted:fresh');
    assert.match(owned.psqlExpectError(retentionRollback),
      /India KYC pending attempts expired; preserve retention guard/,
      'a later resubmission cannot hide the earlier retention cutover');
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
    const foreignHeaders = await signedIdentityHeaders(owner,
      `kyc-retention-${owner}@example.invalid`, site.siteId);
    const foreignClose = await gateway.request(`/v1/stores/${foreign.siteId}`,
      { method: 'DELETE', headers: { ...foreignHeaders, 'X-Idempotency-Key': randomUUID() } });
    assert.equal(foreignClose.status, 403, foreignClose.text);
    assert.equal(owned.psql(`SELECT deleted_at IS NULL FROM sites WHERE id='${foreign.siteId}';`), 't');
    const closeHeaders = await signedIdentityHeaders(owner,
      `kyc-retention-${owner}@example.invalid`, site.siteId);
    const closed = await gateway.request(`/v1/stores/${site.siteId}`,
      { method: 'DELETE', headers: { ...closeHeaders, 'X-Idempotency-Key': randomUUID() } });
    assert.equal(closed.status, 200, closed.text);
    assert.equal(closed.json?.data.closed, true);
    assert.equal(owned.psql(`SELECT status||':'||published::text||':'||(deleted_at IS NOT NULL)::text
      FROM sites WHERE id='${site.siteId}';`), 'suspended:false:true');
    assert.equal(owned.psql(`SELECT count(*) FROM merchant_kyc_documents
      WHERE site_id='${site.siteId}' AND metadata->>'private_object_key' IS NOT NULL;`), '0');
    assert.equal(owned.psql(`SELECT count(*) FROM merchant_kyc_documents
      WHERE site_id='${site.siteId}' AND (metadata ? 'sha256' OR metadata ? 'private_storage_provider'
        OR file_url IS NOT NULL OR file_name IS NOT NULL);`), '0');
    assert.equal(owned.psql(`SELECT count(*) FROM kyc_private_object_cleanup_jobs
      WHERE site_id='${site.siteId}' AND closure_requested_at IS NOT NULL
        AND purpose='replaced_object' AND status='pending';`), '3');
    assert.equal(owned.psql(`SELECT status||':'||(metadata->>'retention_reason')
      FROM merchant_kyc_documents WHERE id='${proofDocument}';`), 'needs_review:account_closed');
    const postCloseHeaders = await signedIdentityHeaders(owner,
      `kyc-retention-${owner}@example.invalid`, site.siteId);
    const postClose = await gateway.request(`/v1/kyc?store_id=${site.siteId}`, { headers: postCloseHeaders });
    assert.ok([403, 404].includes(postClose.status), postClose.text);
    assert.match(owned.psqlExpectError(`UPDATE merchant_kyc_documents SET status='verified',
      verified_at=now() WHERE id='${proofDocument}';`), /Closed store KYC requires a new private upload/);
    assert.match(owned.psqlExpectError(closureRollback),
      /Store closure processed KYC evidence; preserve deletion guard/);
    const closureDrain = await drainKycIndiaObjectCleanup(env, 20,
      (async () => ({ deleted: 1, remaining: false })) as typeof import('@letbuyy/infrastructure/storage-adapter').cleanupKycIndiaS3ObjectVersions);
    assert.ok(closureDrain.deleted >= 3);
    assert.equal(owned.psql(`SELECT count(*) FROM kyc_private_object_cleanup_jobs
      WHERE site_id='${site.siteId}' AND closure_requested_at IS NOT NULL
        AND status='completed' AND outcome='deleted';`), '3');

    const oldReplacement = randomUUID(), oldOrphan = randomUUID();
    owned.psql(`INSERT INTO kyc_private_object_cleanup_jobs
      (id,site_id,object_key,purpose,storage_provider,document_type,object_version_id,
       created_at,next_attempt_at,deletion_requested_at)
      VALUES ('${oldReplacement}','${site.siteId}',
       'kyc/${site.siteId}/identity_proof/${oldReplacement}','replaced_object',
       'aws_s3_mumbai','identity_proof','synthetic-version',
       now()-interval '25 hours',now()+interval '1 hour',now()-interval '25 hours');`);
    owned.psql(intent(site.siteId, oldOrphan, false, 'gst_certificate'));
    owned.psql(`UPDATE kyc_private_object_cleanup_jobs SET
      created_at=now()-interval '26 hours',
      intent_expires_at=now()-interval '26 hours'+interval '3 minutes',
      next_attempt_at=now()+interval '1 hour' WHERE id='${oldOrphan}';`);
    const overdue = JSON.parse(owned.psql(`SELECT public.kyc_india_cleanup_overdue_v1();`));
    assert.equal(Number(overdue.overdue_count), 2);
    assert.ok(Date.parse(overdue.oldest_due_at) < Date.now());
    assert.ok(!JSON.stringify(overdue).includes(oldReplacement));
    assert.match(owned.psqlExpectError(`BEGIN; SET LOCAL ROLE app_tenant;
      SET LOCAL app.site_id='${site.siteId}';
      SELECT public.kyc_india_cleanup_overdue_v1(); COMMIT;`), /permission denied/);
    assert.match(owned.psqlExpectError(`UPDATE kyc_private_object_cleanup_jobs
      SET deletion_requested_at=now() WHERE id='${oldReplacement}';`),
      /deletion request time is immutable/);
    const overdueResult = await drainKycIndiaObjectCleanup(env, 20,
      (async () => { throw new Error('No future retry should run'); }) as typeof import('@letbuyy/infrastructure/storage-adapter').cleanupKycIndiaS3ObjectVersions);
    assert.equal(overdueResult.scanned, 0);
    assert.equal(overdueResult.overdue, 2);
    assert.equal(overdueResult.held, 0);
    assert.ok(overdueResult.oldestDueAt);
    assert.match(owned.psqlExpectError(deadlineRollback),
      /India KYC deletion deadlines exist; retain the deadline monitor/);

    owned.psql(`UPDATE kyc_private_object_cleanup_jobs
      SET next_attempt_at=now()-interval '1 minute' WHERE id='${oldReplacement}';`);
    const holdId = randomUUID();
    owned.psql(`INSERT INTO kyc_india_legal_holds
      (id,site_id,receipt_id,authority_type,authority_reference,reason,request_key,
       review_at,expires_at,created_by,updated_by)
      VALUES ('${holdId}','${site.siteId}','${oldReplacement}','court_order',
       'SYN-COURT-ORDER-123','Synthetic preservation order for exact receipt','${randomUUID()}',
       now()+interval '1 day',now()+interval '2 days','${owner}','${owner}');`);
    assert.equal(owned.psql(`SELECT count(*) FROM public.list_due_kyc_india_cleanup_v1(20)
      WHERE id='${oldReplacement}';`), '0', 'held receipt cannot starve the due queue');
    assert.equal(owned.psql(`SELECT public.claim_due_kyc_india_cleanup_v1(
      '${oldReplacement}','${site.siteId}');`), 'held', 'claim rechecks a new hold under receipt lock');
    const heldResult = await drainKycIndiaObjectCleanup(env, 20,
      (async () => { throw new Error('A held receipt must not reach S3'); }) as typeof import('@letbuyy/infrastructure/storage-adapter').cleanupKycIndiaS3ObjectVersions);
    assert.equal(heldResult.held, 1);
    assert.equal(heldResult.holdReviewOverdue, 0);
    assert.equal(heldResult.holdExpired, 0);
    assert.equal(heldResult.overdue, 1, 'the unrelated orphan still breaches its deadline');
    assert.match(owned.psqlExpectError(`BEGIN; SET LOCAL ROLE app_tenant;
      SET LOCAL app.site_id='${site.siteId}';
      SELECT count(*) FROM public.kyc_india_legal_holds; COMMIT;`), /permission denied/);
    assert.match(owned.psqlExpectError(`INSERT INTO kyc_india_legal_holds
      (site_id,receipt_id,authority_type,authority_reference,reason,request_key,
       review_at,expires_at,created_by,updated_by)
      VALUES ('${foreign.siteId}','${oldReplacement}','statutory',
       'SYN-FOREIGN-HOLD','Synthetic cross-tenant hold request','${randomUUID()}',
       now()+interval '1 day',now()+interval '2 days','${owner}','${owner}');`),
      /receipt is not holdable/);
    assert.match(owned.psqlExpectError(`UPDATE kyc_india_legal_holds
      SET expires_at=now()+interval '1 year' WHERE id='${holdId}';`),
      /append-only except release/);
    owned.psql(`UPDATE kyc_india_legal_holds
      SET released_at=now(),released_by='${owner}',release_request_key='${randomUUID()}',
        release_reason='Synthetic order was withdrawn',updated_by='${owner}'
      WHERE id='${holdId}';`);
    assert.equal(owned.psql(`SELECT public.claim_due_kyc_india_cleanup_v1(
      '${oldReplacement}','${site.siteId}');`), 'delete', 'release resumes the exact cleanup');
    assert.match(owned.psqlExpectError(`INSERT INTO kyc_india_legal_holds
      (site_id,receipt_id,authority_type,authority_reference,reason,request_key,
       review_at,expires_at,created_by,updated_by)
      VALUES ('${site.siteId}','${oldReplacement}','court_order',
       'SYN-LATE-ORDER-123','Synthetic too-late hold request','${randomUUID()}',
       now()+interval '1 day',now()+interval '2 days','${owner}','${owner}');`),
      /receipt is not holdable/);
    owned.psql(`INSERT INTO kyc_india_legal_holds
      (site_id,receipt_id,authority_type,authority_reference,reason,request_key,
       created_at,review_at,expires_at,created_by,updated_by)
      VALUES ('${site.siteId}','${oldOrphan}','statutory',
       'SYN-OVERDUE-ORDER','Synthetic order awaiting manual release','${randomUUID()}',
       now()-interval '3 days',now()-interval '2 days',now()-interval '1 day',
       '${owner}','${owner}');`);
    assert.equal(owned.psql(`SELECT public.claim_due_kyc_india_cleanup_v1(
      '${oldOrphan}','${site.siteId}');`), 'stale', 'the future retry is not due');
    owned.psql(`UPDATE kyc_private_object_cleanup_jobs
      SET next_attempt_at=now()-interval '1 minute' WHERE id='${oldOrphan}';`);
    assert.equal(owned.psql(`SELECT public.claim_due_kyc_india_cleanup_v1(
      '${oldOrphan}','${site.siteId}');`), 'held', 'expiry alone cannot authorize deletion');
    const expiredHold = await drainKycIndiaObjectCleanup(env, 20,
      (async () => { throw new Error('An expired, unreleased hold must not reach S3'); }) as typeof import('@letbuyy/infrastructure/storage-adapter').cleanupKycIndiaS3ObjectVersions);
    assert.equal(expiredHold.held, 1);
    assert.equal(expiredHold.holdReviewOverdue, 1);
    assert.equal(expiredHold.holdExpired, 1);
    assert.match(owned.psqlExpectError(holdRollback),
      /India KYC legal holds exist; retain exact hold enforcement/);
});
