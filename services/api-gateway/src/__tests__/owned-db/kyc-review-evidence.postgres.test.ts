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
    env.ENVIRONMENT = 'staging';
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
    await gateway.settle();
});
