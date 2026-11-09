import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { requireOwnedDatabase } from './owned-db-support';
import { consoleFixture } from './console-session-fixture';
import { newSyntheticTenant, seedSyntheticTenant } from './synthetic-tenant';

const owned = requireOwnedDatabase();

test('exact India KYC hold uses current stepped-up Console authority, replay and audited release', async () => {
    const site = newSyntheticTenant('kyc-hold-a');
    const other = newSyntheticTenant('kyc-hold-b');
    seedSyntheticTenant(owned.psql, site);
    seedSyntheticTenant(owned.psql, other);
    const receiptId = randomUUID();
    owned.psql(`INSERT INTO kyc_private_object_cleanup_jobs
      (id,site_id,object_key,purpose,storage_provider,document_type,object_version_id,
       deletion_requested_at,next_attempt_at)
      VALUES ('${receiptId}','${site.siteId}',
       'kyc/${site.siteId}/business_pan/${receiptId}',
       'replaced_object','aws_s3_mumbai','business_pan','synthetic-version',
       now(),now()+interval '1 day');`);
    const fixture = await consoleFixture(owned);
    try {
        const admin = await fixture.actor('super');
        const viewer = await fixture.actor('viewer');
        const unelevated = await fixture.actor('super', false);
        const path = `/v1/internal/console/kyc/sites/${site.siteId}/receipts/${receiptId}/holds`;
        const requestKey = randomUUID();
        const body = {
            authorityType: 'court_order', authorityReference: 'SYN-ORDER-001',
            reason: 'Synthetic preservation order for one exact receipt',
            reviewAt: new Date(Date.now() + 86400_000).toISOString(),
            expiresAt: new Date(Date.now() + 2 * 86400_000).toISOString(),
            requestKey,
        };
        const post = (url: string, headers: Record<string, string>, value: unknown) =>
            fixture.gateway.request(url, { method: 'POST', headers, body: JSON.stringify(value) });
        assert.equal((await post(path, { Authorization: admin.headers.Authorization }, body)).status, 401);
        assert.equal((await post(path, viewer.headers, body)).status, 403);
        assert.notEqual((await post(path, unelevated.headers, body)).status, 201);
        const wrongSite = await post(
            `/v1/internal/console/kyc/sites/${other.siteId}/receipts/${receiptId}/holds`,
            admin.headers, body);
        assert.equal(wrongSite.status, 409, wrongSite.text);
        assert.equal(wrongSite.json?.error?.code, 'KYC_HOLD_TOO_LATE');
        const created = await post(path, admin.headers, body);
        assert.equal(created.status, 201, created.text);
        const holdId = created.json?.data?.hold_id as string;
        assert.match(holdId, /^[0-9a-f-]{36}$/);
        assert.equal(created.json?.data?.replayed, false);
        const reviewReason = encodeURIComponent('Review exact Mumbai hold and receipt');
        const receiptsPath = `/v1/internal/console/kyc/sites/${site.siteId}/receipts?reason=${reviewReason}`;
        const holdsPath = `/v1/internal/console/kyc/sites/${site.siteId}/holds?reason=${reviewReason}`;
        assert.equal((await fixture.gateway.request(receiptsPath, { headers: viewer.headers })).status, 403);
        assert.equal((await fixture.gateway.request(holdsPath, { headers: viewer.headers })).status, 403);
        const receiptRead = await fixture.gateway.request(receiptsPath, { headers: admin.headers });
        const holdRead = await fixture.gateway.request(holdsPath, { headers: admin.headers });
        assert.equal(receiptRead.status, 200, receiptRead.text);
        assert.equal(holdRead.status, 200, holdRead.text);
        assert.match(receiptRead.headers.get('cache-control') ?? '', /no-store/);
        assert.match(holdRead.headers.get('cache-control') ?? '', /no-store/);
        assert.equal(receiptRead.json?.data?.data?.find((row: { id: string }) => row.id === receiptId)?.holdable, false);
        assert.equal(holdRead.json?.data?.data?.find((row: { id: string }) => row.id === holdId)?.released_at, null);
        assert.ok(!receiptRead.text.includes(`kyc/${site.siteId}/business_pan/${receiptId}`), 'review list cannot expose object keys');
        assert.equal((await fixture.gateway.request(
            `/v1/internal/console/kyc/sites/${other.siteId}/holds?reason=${reviewReason}`,
            { headers: admin.headers })).json?.data?.total, 0);
        const replay = await post(path, admin.headers, body);
        assert.equal(replay.status, 200, replay.text);
        assert.equal(replay.json?.data?.hold_id, holdId);
        assert.equal(replay.json?.data?.replayed, true);
        const conflict = await post(path, admin.headers, { ...body, reason: 'A different reason with the same key' });
        assert.equal(conflict.status, 409, conflict.text);
        assert.equal(conflict.json?.error?.code, 'IDEMPOTENCY_CONFLICT');
        assert.equal(owned.psql(`SELECT count(*) FROM kyc_india_legal_holds WHERE receipt_id='${receiptId}';`), '1');
        assert.equal(owned.psql(`SELECT count(*) FROM audit_logs WHERE action='kyc.legal_hold.created' AND resource_id='${holdId}';`), '1');
        assert.match(owned.psqlExpectError(`BEGIN; SET LOCAL ROLE app_tenant;
          SET LOCAL app.site_id='${site.siteId}';
          SELECT public.create_kyc_india_legal_hold_v1(NULL,NULL,NULL,
            '${site.siteId}','${receiptId}','court_order','SYN-ORDER-001',
            'Synthetic forbidden tenant hold',now()+interval '1 day',
            now()+interval '2 days','${randomUUID()}'); COMMIT;`), /permission denied/);
        const releasePath = `${path}/${holdId}/release`;
        const release = { reason: 'Synthetic order withdrawn by authority', requestKey: randomUUID() };
        assert.equal((await post(releasePath, viewer.headers, release)).status, 403);
        const released = await post(releasePath, admin.headers, release);
        assert.equal(released.status, 200, released.text);
        assert.equal(released.json?.data?.replayed, false);
        const releaseReplay = await post(releasePath, admin.headers, release);
        assert.equal(releaseReplay.status, 200, releaseReplay.text);
        assert.equal(releaseReplay.json?.data?.replayed, true);
        assert.equal(owned.psql(`SELECT count(*) FROM audit_logs WHERE action='kyc.legal_hold.released' AND resource_id='${holdId}';`), '1');
        assert.equal(owned.psql(`SELECT count(*) FROM kyc_india_legal_holds WHERE id='${holdId}' AND released_at IS NOT NULL;`), '1');
        const afterRelease = await fixture.gateway.request(holdsPath, { headers: admin.headers });
        assert.equal(afterRelease.status, 200, afterRelease.text);
        assert.ok(afterRelease.json?.data?.data?.find((row: { id: string }) => row.id === holdId)?.released_at);
    } finally {
        await fixture.gateway.settle();
    }
});
