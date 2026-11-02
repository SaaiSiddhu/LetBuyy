import assert from 'node:assert/strict';
import test from 'node:test';
import { requireOwnedDatabase } from './owned-db-support';
import { consoleFixture } from './console-session-fixture';
import { newSyntheticTenant, seedSyntheticTenant } from './synthetic-tenant';

const owned = requireOwnedDatabase();

test('a current stepped-up Console operator can audit and download only the requested private KYC document', async () => {
    const tenant = newSyntheticTenant('kyc-review');
    const other = newSyntheticTenant('kyc-review-other');
    seedSyntheticTenant(owned.psql, tenant);
    seedSyntheticTenant(owned.psql, other);
    const documentId = crypto.randomUUID();
    const staleDocumentId = crypto.randomUUID();
    const privateKey = `kyc/${tenant.siteId}/business_pan/${crypto.randomUUID()}`;
    owned.psql(`INSERT INTO merchant_kyc_documents(id,site_id,document_type,status,provider,provider_mode,
        document_number_last4,metadata) VALUES ('${documentId}','${tenant.siteId}','business_pan','submitted',
        'letbuyy_sandbox_kyc','sandbox','1234',
        '{"private_object_key":"${privateKey}","sha256":"secret-digest","content_type":"application/pdf","malware_scan_status":"clean"}'::jsonb);
        INSERT INTO merchant_kyc_documents(id,site_id,document_type,status,provider,provider_mode,
        document_number_last4,metadata) VALUES ('${staleDocumentId}','${tenant.siteId}','bank_proof','verified',
        'signzy','live','4321','{"provider_verified":true}'::jsonb);`);
    const fixture = await consoleFixture(owned);
    const { gateway, env } = fixture;
    let objectReads = 0;
    env.KYC_PRIVATE_BUCKET = {
        get: async (key: string) => {
            objectReads++;
            assert.equal(key, privateKey);
            return { body: new Blob(['%PDF-1.7\nprivate-test-evidence']).stream() };
        },
    } as unknown as R2Bucket;
    const reviewer = await fixture.actor('super');
    const viewer = await fixture.actor('viewer');
    const reason = encodeURIComponent('Reviewing submitted PAN evidence');
    const listPath = `/v1/internal/console/kyc/sites/${tenant.siteId}/documents?reason=${reason}`;
    const filePath = `/v1/internal/console/kyc/sites/${tenant.siteId}/documents/${documentId}/file?reason=${reason}`;

    const missingReason = await gateway.request(`/v1/internal/console/kyc/sites/${tenant.siteId}/documents`, { headers: reviewer.headers });
    assert.equal(missingReason.status, 400);
    const noSession = await gateway.request(filePath, { headers: { Authorization: reviewer.headers.Authorization } });
    assert.equal(noSession.status, 401);
    const noScope = await gateway.request(filePath, { headers: viewer.headers });
    assert.equal(noScope.status, 403);
    const foreignSite = await gateway.request(`/v1/internal/console/kyc/sites/${other.siteId}/documents/${documentId}/file?reason=${reason}`, { headers: reviewer.headers });
    assert.equal(foreignSite.status, 404);
    assert.equal(objectReads, 0);

    const list = await gateway.request(listPath, { headers: reviewer.headers });
    assert.equal(list.status, 200, list.text);
    const rows = list.json?.data?.data || [];
    assert.equal(rows.find((row: { id: string }) => row.id === documentId)?.has_private_upload, true);
    assert.equal(rows.find((row: { id: string }) => row.id === staleDocumentId)?.status, 'needs_review',
        'review queue must not present a stale verified row without a provider reference as approved');
    assert.equal(rows.find((row: { id: string }) => row.id === staleDocumentId)?.malware_scan_status, 'pending');
    assert.ok(!list.text.includes(privateKey));
    assert.ok(!list.text.includes('secret-digest'));
    const file = await gateway.request(filePath, { headers: reviewer.headers });
    assert.equal(file.status, 200, file.text);
    assert.equal(file.text, '%PDF-1.7\nprivate-test-evidence');
    assert.equal(file.headers.get('content-type'), 'application/pdf');
    assert.match(file.headers.get('content-disposition') || '', /^attachment;/);
    assert.match(file.headers.get('cache-control') || '', /no-store/);
    assert.equal(objectReads, 1);
    const indiaReceipt = crypto.randomUUID();
    const indiaScanEvent = crypto.randomUUID();
    const indiaDocument = crypto.randomUUID();
    const indiaKey = `kyc/${other.siteId}/business_pan/${indiaReceipt}`;
    owned.psql(`INSERT INTO kyc_private_object_cleanup_jobs
        (id,site_id,object_key,purpose,storage_provider,document_type,expected_sha256_hex,
         expected_bytes,expected_content_type,reference_last4,upload_idempotency_key,
         intent_expires_at,next_attempt_at,object_version_id,head_verified_at,
         status,outcome,completed_at,scan_event_id,scan_verdict,scan_completed_at,created_by,updated_by)
      VALUES ('${indiaReceipt}','${other.siteId}','${indiaKey}','upload_reservation','aws_s3_mumbai',
        'business_pan','${'a'.repeat(64)}',1234,'application/pdf','1234','${crypto.randomUUID()}',
        now()+interval '3 minutes',now()+interval '6 minutes','synthetic-version',now(),
        'completed','retained',now(),'${indiaScanEvent}','clean',now(),'${reviewer.id}','${reviewer.id}');
      INSERT INTO merchant_kyc_documents(id,site_id,document_type,status,provider,provider_mode,
        document_number_last4,metadata) VALUES ('${indiaDocument}','${other.siteId}',
        'business_pan','submitted','letbuyy_sandbox_kyc','sandbox','1234',
        '{"private_storage_provider":"aws_s3_mumbai","private_object_key":"${indiaKey}",
          "private_upload_receipt_id":"${indiaReceipt}","scan_event_id":"${indiaScanEvent}",
          "private_object_version_id":"synthetic-version","sha256":"${'a'.repeat(64)}",
          "byte_size":1234,"content_type":"application/pdf","malware_scan_status":"clean"}'::jsonb);`);
    const indiaFile = await gateway.request(
        `/v1/internal/console/kyc/sites/${other.siteId}/documents/${indiaDocument}/file?reason=${reason}`,
        { headers: reviewer.headers });
    assert.equal(indiaFile.status, 503, 'R2 review must refuse a Mumbai S3 document even when marked clean');
    assert.equal(indiaFile.json?.error?.code, 'KYC_INDIA_REVIEW_UNAVAILABLE');
    assert.equal(objectReads, 1, 'the R2 bucket is never asked for India evidence');
    env.KYC_INDIA_REVIEW_ENABLED = 'true';
    env.KYC_INDIA_BUCKET = 'letbuyy-kyc-mumbai-synthetic';
    env.KYC_INDIA_REVIEW_ACCESS_KEY_ID = 'AKIAIOSFODNN7EXAMPLE';
    env.KYC_INDIA_REVIEW_SECRET_ACCESS_KEY = 'synthetic-review-secret-for-tests';
    const indiaTicket = await gateway.request(
        `/v1/internal/console/kyc/sites/${other.siteId}/documents/${indiaDocument}/file?reason=${reason}`,
        { headers: reviewer.headers });
    assert.equal(indiaTicket.status, 302, indiaTicket.text);
    const location = new URL(indiaTicket.headers.get('location') || '');
    assert.equal(location.host, 'letbuyy-kyc-mumbai-synthetic.s3.ap-south-1.amazonaws.com');
    assert.equal(location.pathname, `/${indiaKey}`);
    assert.equal(location.searchParams.get('versionId'), 'synthetic-version');
    assert.equal(location.searchParams.get('X-Amz-Expires'), '30');
    assert.match(location.searchParams.get('X-Amz-Signature') || '', /^[a-f0-9]{64}$/);
    assert.match(indiaTicket.headers.get('cache-control') || '', /no-store/);
    assert.equal(objectReads, 1, 'India document bytes never pass through the R2 adapter');
    assert.equal(owned.psql(`SELECT count(*) FROM audit_logs WHERE actor_id='${reviewer.id}'
        AND action='kyc.evidence.download_ticket' AND resource_id='${indiaDocument}';`), '1');
    env.ENVIRONMENT = 'staging';
    const stagingTicket = await gateway.request(
        `/v1/internal/console/kyc/sites/${other.siteId}/documents/${indiaDocument}/file?reason=${reason}`,
        { headers: reviewer.headers });
    assert.equal(stagingTicket.status, 503, 'synthetic reviewer credentials cannot activate staging');
    const wrongRegionRead = await gateway.request(filePath, { headers: reviewer.headers });
    assert.equal(wrongRegionRead.status, 503, 'deployed R2 must not release India-only document bytes');
    assert.equal(objectReads, 1);
    env.ENVIRONMENT = 'test';
    const quarantined = await gateway.request(`/v1/internal/console/kyc/sites/${tenant.siteId}/documents/${staleDocumentId}/file?reason=${reason}`, { headers: reviewer.headers });
    assert.equal(quarantined.status, 503, 'a row without a private object is unavailable');
    owned.psql(`UPDATE merchant_kyc_documents SET metadata=metadata-'malware_scan_status'
        WHERE id='${documentId}';`);
    const pendingScan = await gateway.request(filePath, { headers: reviewer.headers });
    assert.equal(pendingScan.status, 409, 'unscanned private evidence must stay quarantined');
    assert.equal(objectReads, 1);
    owned.psql(`UPDATE merchant_kyc_documents SET metadata=jsonb_set(metadata,'{malware_scan_status}','"clean"'::jsonb)
        WHERE id='${documentId}';`);
    assert.equal(owned.psql(`SELECT count(*) FROM audit_logs WHERE actor_id='${reviewer.id}'
        AND action='kyc.evidence.list' AND resource_id='${tenant.siteId}';`), '1');
    assert.equal(owned.psql(`SELECT count(*) FROM audit_logs WHERE actor_id='${reviewer.id}'
        AND action='kyc.evidence.download' AND resource_id='${documentId}'
        AND metadata->>'reason'='Reviewing submitted PAN evidence';`), '1');
    owned.psql('REVOKE INSERT ON public.audit_logs FROM service_role;');
    const auditUnavailable = await gateway.request(filePath, { headers: reviewer.headers });
    assert.equal(auditUnavailable.status, 503, 'audit failure must stop the private file response');
    assert.equal(objectReads, 1, 'storage must not be read after an audit failure');
    const indiaAuditUnavailable = await gateway.request(
        `/v1/internal/console/kyc/sites/${other.siteId}/documents/${indiaDocument}/file?reason=${reason}`,
        { headers: reviewer.headers });
    assert.equal(indiaAuditUnavailable.status, 503, 'audit failure must stop an India download ticket');
    assert.equal(indiaAuditUnavailable.headers.get('location'), null);
    await gateway.settle();
});
