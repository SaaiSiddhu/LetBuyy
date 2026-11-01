import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test, { after } from 'node:test';
import { randomUUID } from 'node:crypto';
import { requireOwnedDatabase } from './owned-db-support';
import { Gateway, gatewayEnv, newIdentityKeys, signedIdentityHeaders, tapRest } from './gateway-harness';
import { newSyntheticTenant, seedSyntheticTenant } from './synthetic-tenant';

const owned = requireOwnedDatabase();
let gateway: Gateway;
after(async () => { await gateway?.settle(); });

test('KYC file upload remains private, tenant-owned and pending provider evidence', async () => {
    const tenant = newSyntheticTenant('kyc-upload');
    const otherTenant = newSyntheticTenant('kyc-other');
    seedSyntheticTenant(owned.psql, tenant);
    seedSyntheticTenant(owned.psql, otherTenant);
    const owner = randomUUID(), other = randomUUID();
    owned.psql(`INSERT INTO users_custom(id,email,email_verified,full_name) VALUES
      ('${owner}','kyc-${owner}@example.invalid',true,'Synthetic KYC owner'),
      ('${other}','kyc-${other}@example.invalid',true,'Synthetic other owner');
      UPDATE sites SET custom_user_id='${owner}' WHERE id='${tenant.siteId}';
      UPDATE sites SET custom_user_id='${other}' WHERE id='${otherTenant.siteId}';`);
    const objects = new Map<string, Uint8Array>();
    let pauseUploads: (() => Promise<void>) | null = null;
    const bucket = {
        put: async (key: string, bytes: Uint8Array) => {
            if (pauseUploads) await pauseUploads();
            objects.set(key, bytes);
        },
        delete: async (key: string) => { objects.delete(key); },
    };
    gateway = new Gateway(gatewayEnv(owned, await newIdentityKeys(), { KYC_PRIVATE_BUCKET: bucket }));
    const legacyHeaders = await signedIdentityHeaders(owner, `kyc-${owner}@example.invalid`, tenant.siteId);
    legacyHeaders['X-Idempotency-Key'] = randomUUID();
    const legacy = await gateway.request('/v1/kyc/documents', { method: 'POST', headers: legacyHeaders,
        body: JSON.stringify({ store_id: tenant.siteId, document_type: 'business_pan', document_number_last4: '1234' }) });
    assert.equal(legacy.status, 410, 'last-four-only JSON submission cannot create KYC evidence');
    assert.equal(owned.psql(`SELECT count(*) FROM merchant_kyc_documents WHERE site_id='${tenant.siteId}';`), '0');
    const upload = async (siteId: string, file: File, key = randomUUID(), last4 = '1234') => {
        const headers = await signedIdentityHeaders(owner, `kyc-${owner}@example.invalid`, siteId);
        delete headers['Content-Type'];
        headers['X-Idempotency-Key'] = key;
        const form = new FormData();
        form.set('store_id', siteId);
        form.set('document_type', 'business_pan');
        form.set('document_number_last4', last4);
        form.set('file', file);
        return gateway.request('/v1/kyc/documents/upload', { method: 'POST', headers, body: form });
    };
    const pdf = () => new File([new TextEncoder().encode('%PDF-1.7\nsynthetic')], 'pan.pdf', { type: 'application/pdf' });
    const firstKey = randomUUID();
    const first = await upload(tenant.siteId, pdf(), firstKey);
    assert.equal(first.status, 201, first.text);
    assert.equal(first.json?.data.document.status, 'submitted');
    assert.equal(first.json?.data.document.has_private_upload, true);
    assert.equal(first.json?.data.overview.overall_status, 'in_progress');
    const unsafeRollback = readFileSync(new URL('../../../../../database/supabase/rollback/415_kyc_private_metadata_gateway_only.rollback.sql', import.meta.url), 'utf8');
    assert.match(owned.psqlExpectError(unsafeRollback), /KYC evidence exists; retain Gateway-only private metadata access/,
        'the rollback cannot reopen direct metadata reads after evidence has been recorded');
    assert.equal(owned.psql(`SELECT status FROM idempotency_keys WHERE site_id='${tenant.siteId}'
        AND scope='kyc:document-upload:business_pan' AND key='${firstKey}';`), 'completed');
    assert.ok(!first.text.includes('private_object_key'));
    assert.ok(!first.text.includes('kyc/'));
    assert.equal(objects.size, 1);
    const asAuthenticatedOwner = (sql: string) => owned.script(
        `SET ROLE authenticated; SET request.jwt.claim.sub = '${owner}'; ${sql}`);
    const ownerOverview = await gateway.request(`/v1/kyc?store_id=${tenant.siteId}`, {
        method: 'GET', headers: await signedIdentityHeaders(owner, `kyc-${owner}@example.invalid`, tenant.siteId),
    });
    assert.equal(ownerOverview.status, 200, 'positive control: the site owner reads sanitized KYC status through the Gateway');
    assert.equal(ownerOverview.json?.data.documents[0]?.status, 'submitted');
    assert.equal(ownerOverview.json?.data.documents[0]?.evidence_scan_status, 'pending');
    assert.equal(ownerOverview.json?.data.documents[0]?.provider_unavailable, false);
    assert.match(ownerOverview.json?.data.next_action || '', /not provider reviewed/);
    assert.ok(!ownerOverview.text.includes('private_object_key'));
    assert.equal(asAuthenticatedOwner(`SELECT count(*) FROM public.merchant_kyc_documents
        WHERE site_id='${tenant.siteId}' AND document_type='business_pan';`), '0',
        'the authenticated site owner cannot read private evidence metadata directly');
    const forgeSql = `UPDATE public.merchant_kyc_documents SET status='verified', provider='signzy', provider_mode='live',
        provider_reference='forged', metadata='{"provider_verified":true}'::jsonb
        WHERE site_id='${tenant.siteId}' AND document_type='business_pan' RETURNING id;`;
    try {
        assert.equal(asAuthenticatedOwner(forgeSql), '', 'authenticated merchant write matches no permitted KYC row');
    } catch (error) {
        assert.match(String(error), /KYC provider decisions are server managed|permission denied|row-level security/);
    }
    assert.equal(owned.psql(`SELECT status FROM merchant_kyc_documents WHERE site_id='${tenant.siteId}' AND document_type='business_pan';`),
        'submitted');
    const retry = await upload(tenant.siteId, pdf(), firstKey);
    assert.equal(retry.status, 200, retry.text);
    assert.equal(objects.size, 1);
    const conflictingRetry = await upload(tenant.siteId, new File([new TextEncoder().encode('%PDF-1.7\nchanged')], 'pan.pdf', { type: 'application/pdf' }), firstKey);
    assert.equal(conflictingRetry.status, 409, conflictingRetry.text);
    assert.equal(objects.size, 1);
    const saved = JSON.parse(owned.psql(`SELECT metadata::text FROM merchant_kyc_documents WHERE site_id='${tenant.siteId}';`));
    assert.equal(saved.malware_scan_status, 'pending', 'new uploads remain quarantined until a trusted scanner marks them clean');
    assert.match(saved.private_object_key, new RegExp(`^kyc/${tenant.siteId}/business_pan/`));
    const priorKey = saved.private_object_key;
    const replaced = await upload(tenant.siteId, pdf());
    assert.equal(replaced.status, 201, replaced.text);
    assert.equal(objects.size, 1);
    assert.equal(objects.has(priorKey), false);
    const oldKeyReplay = await upload(tenant.siteId, pdf(), firstKey);
    assert.equal(oldKeyReplay.status, 409, 'a completed upload key must remain consumed after a newer document replaces it');
    assert.equal(oldKeyReplay.json?.error?.code, 'KYC_UPLOAD_SUPERSEDED');
    assert.equal(objects.size, 1);
    const concurrentKey = randomUUID();
    let releaseClaimedUpload!: () => void;
    let claimedUploadArrived!: () => void;
    const claimedUploadHeld = new Promise<void>((resolve) => { releaseClaimedUpload = resolve; });
    const claimedUploadWaiting = new Promise<void>((resolve) => { claimedUploadArrived = resolve; });
    pauseUploads = async () => { claimedUploadArrived(); await claimedUploadHeld; };
    let claimedUpload: Awaited<ReturnType<Gateway['request']>> | undefined;
    try {
        const firstClaim = upload(tenant.siteId, pdf(), concurrentKey);
        await Promise.race([
            claimedUploadWaiting,
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('claimed upload did not reach private storage')), 15_000)),
        ]);
        const competingClaim = await upload(tenant.siteId, pdf(), concurrentKey);
        assert.equal(competingClaim.status, 409, 'a concurrent retry cannot start a second private upload');
        releaseClaimedUpload();
        claimedUpload = await firstClaim;
    } finally {
        releaseClaimedUpload();
        pauseUploads = null;
    }
    assert.equal(claimedUpload?.status, 201, claimedUpload?.text);
    assert.equal(objects.size, 1);
    let arrived = 0;
    let releaseUploads!: () => void;
    let bothArrived!: () => void;
    const held = new Promise<void>((resolve) => { releaseUploads = resolve; });
    const waiting = new Promise<void>((resolve) => { bothArrived = resolve; });
    pauseUploads = async () => { if (++arrived === 2) bothArrived(); await held; };
    const racing = [upload(tenant.siteId, pdf()), upload(tenant.siteId, pdf())];
    await waiting;
    releaseUploads();
    const raceResults = await Promise.all(racing);
    pauseUploads = null;
    assert.deepEqual(raceResults.map((result) => result.status).sort(), [201, 409], raceResults.map((result) => result.text).join('\n'));
    const winnerKey = JSON.parse(owned.psql(`SELECT metadata::text FROM merchant_kyc_documents WHERE site_id='${tenant.siteId}';`)).private_object_key;
    assert.equal(objects.size, 1);
    assert.equal(objects.has(winnerKey), true);
    const refreshHeaders = await signedIdentityHeaders(owner, `kyc-${owner}@example.invalid`, tenant.siteId);
    refreshHeaders['X-Idempotency-Key'] = randomUUID();
    owned.psql(`UPDATE merchant_kyc_documents SET metadata = metadata || '{"provider_unavailable":true,"sandbox":false}'::jsonb
        WHERE site_id='${tenant.siteId}' AND document_type='business_pan';`);
    const refreshed = await gateway.request(`/v1/kyc/documents/${replaced.json!.data.document.id}/refresh?store_id=${tenant.siteId}`, { method: 'POST', headers: refreshHeaders });
    assert.equal(refreshed.status, 200, refreshed.text);
    assert.equal(refreshed.json?.data.document.has_private_upload, true);
    const refreshedMeta = JSON.parse(owned.psql(`SELECT metadata::text FROM merchant_kyc_documents WHERE site_id='${tenant.siteId}';`));
    assert.equal(objects.has(refreshedMeta.private_object_key), true);
    assert.equal(refreshedMeta.provider_verified, false);
    assert.equal(refreshedMeta.provider_unavailable, false, 'a later provider response clears a stale outage flag');
    assert.equal(refreshedMeta.sandbox, true);
    assert.equal(refreshedMeta.malware_scan_status, 'pending', 'provider refresh cannot bypass the trusted scanner');
    assert.equal(owned.psql(`SELECT status || ':' || (verified_at IS NULL)::text FROM merchant_kyc_documents
        WHERE site_id='${tenant.siteId}' AND document_type='business_pan';`), 'submitted:true',
    'sandbox refresh cannot stamp a verified time in the canonical database');
    assert.equal(refreshed.json?.data.overview.overall_status, 'in_progress');
    let releaseStaleRefresh!: () => void;
    let staleRefreshArrived!: () => void;
    const staleRefreshHeld = new Promise<void>((resolve) => { releaseStaleRefresh = resolve; });
    const staleRefreshWaiting = new Promise<void>((resolve) => { staleRefreshArrived = resolve; });
    const restTap = tapRest(owned.restUrl, async (call, forward) => {
        if (call.resource === 'merchant_kyc_documents' && call.method === 'PATCH'
            && call.body.includes('"provider_verified"')) {
            staleRefreshArrived();
            await staleRefreshHeld;
        }
        return forward();
    });
    let staleRefresh: Awaited<ReturnType<Gateway['request']>> | undefined;
    let latestUpload: Awaited<ReturnType<Gateway['request']>> | undefined;
    try {
        const racingHeaders = await signedIdentityHeaders(owner, `kyc-${owner}@example.invalid`, tenant.siteId);
        racingHeaders['X-Idempotency-Key'] = randomUUID();
        const pendingRefresh = gateway.request(`/v1/kyc/documents/${replaced.json!.data.document.id}/refresh?store_id=${tenant.siteId}`,
            { method: 'POST', headers: racingHeaders });
        await Promise.race([
            staleRefreshWaiting,
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('refresh did not reach its KYC write')), 15_000)),
        ]);
        // The status request has read the old row but has not reached Postgres.
        // Replace its evidence before allowing the old provider result to write.
        await new Promise((resolve) => setTimeout(resolve, 5));
        latestUpload = await upload(tenant.siteId,
            new File([new TextEncoder().encode('%PDF-1.7\nreplacement while refresh waits')], 'new-pan.pdf', { type: 'application/pdf' }));
        releaseStaleRefresh();
        staleRefresh = await pendingRefresh;
    } finally {
        releaseStaleRefresh();
        restTap.restore();
    }
    assert.equal(latestUpload?.status, 201, latestUpload?.text);
    assert.equal(staleRefresh?.status, 409, staleRefresh?.text);
    const newestMeta = JSON.parse(owned.psql(`SELECT metadata::text FROM merchant_kyc_documents WHERE site_id='${tenant.siteId}';`));
    assert.equal(newestMeta.private_object_key, [...objects.keys()][0]);
    assert.equal(newestMeta.provider_verified, undefined);
    assert.equal(objects.size, 1, 'the old refresh must not resurrect a deleted private object');
    const otherHeaders = await signedIdentityHeaders(other, `kyc-${other}@example.invalid`, otherTenant.siteId);
    otherHeaders['X-Idempotency-Key'] = randomUUID();
    const foreignRefresh = await gateway.request(`/v1/kyc/documents/${replaced.json!.data.document.id}/refresh?store_id=${otherTenant.siteId}`, { method: 'POST', headers: otherHeaders });
    assert.equal(foreignRefresh.status, 404, foreignRefresh.text);
    assert.doesNotMatch(foreignRefresh.text, /private_object_key|kyc\//);
    const forged = await upload(otherTenant.siteId, pdf());
    assert.equal(forged.status, 403, forged.text);
    assert.equal(objects.size, 1);
    const invalid = await upload(tenant.siteId, new File(['not a PDF'], 'fake.pdf', { type: 'application/pdf' }));
    assert.equal(invalid.status, 415, invalid.text);
    assert.equal(objects.size, 1);
    const overlong = await upload(tenant.siteId, pdf(), randomUUID(), '12345');
    assert.equal(overlong.status, 400, overlong.text);
    assert.equal(objects.size, 1, 'overlong references must fail before a private object is written');
    assert.match(owned.psqlExpectError(`UPDATE merchant_kyc_documents SET document_number_last4='12345'
        WHERE site_id='${tenant.siteId}' AND document_type='business_pan';`), /merchant_kyc_documents_last4_check/,
    'the database must reject more than four reference characters');
    const noBucket = gatewayEnv(owned, await newIdentityKeys());
    const headers = await signedIdentityHeaders(owner, `kyc-${owner}@example.invalid`, tenant.siteId);
    delete headers['Content-Type'];
    headers['X-Idempotency-Key'] = randomUUID();
    const form = new FormData(); form.set('store_id', tenant.siteId); form.set('document_type', 'bank_proof'); form.set('document_number_last4', '1234'); form.set('file', pdf());
    const unavailable = await gateway.request('/v1/kyc/documents/upload', { method: 'POST', headers, body: form }, noBucket);
    assert.equal(unavailable.status, 503, unavailable.text);
});

test('live-mode provider outage stays pending after clean private evidence and exposes only redacted status', async () => {
    const tenant = newSyntheticTenant('kyc-live-outage');
    seedSyntheticTenant(owned.psql, tenant);
    const owner = randomUUID(), email = `kyc-live-${owner}@example.invalid`;
    owned.psql(`INSERT INTO users_custom(id,email,email_verified,full_name) VALUES
      ('${owner}','${email}',true,'Synthetic live KYC owner');
      UPDATE sites SET custom_user_id='${owner}' WHERE id='${tenant.siteId}';`);
    const objects = new Map<string, Uint8Array>();
    const liveGateway = new Gateway(gatewayEnv(owned, await newIdentityKeys(), {
        KYC_PROVIDER_MODE: 'live', KYC_PROVIDER: 'signzy', KYC_PROVIDER_API_KEY: 'synthetic-unapproved-key',
        KYC_PRIVATE_BUCKET: {
            put: async (key: string, bytes: Uint8Array) => { objects.set(key, bytes); },
            delete: async (key: string) => { objects.delete(key); },
        },
    }));
    try {
        for (const documentType of ['business_pan', 'bank_proof', 'address_proof']) {
            const headers = await signedIdentityHeaders(owner, email, tenant.siteId);
            delete headers['Content-Type'];
            const form = new FormData();
            form.set('store_id', tenant.siteId);
            form.set('document_type', documentType);
            form.set('document_number_last4', '1234');
            form.set('file', new File([new TextEncoder().encode('%PDF-1.7\nsynthetic private evidence')],
                `${documentType}.pdf`, { type: 'application/pdf' }));
            const uploaded = await liveGateway.request('/v1/kyc/documents/upload', {
                method: 'POST', headers: { ...headers, 'X-Idempotency-Key': randomUUID() }, body: form,
            });
            assert.equal(uploaded.status, 201, uploaded.text);
            assert.equal(uploaded.json?.data.document.status, 'submitted');
            assert.equal(uploaded.json?.data.document.evidence_scan_status, 'pending');
        }
        assert.equal(objects.size, 3);
        const panId = owned.psql(`SELECT id FROM merchant_kyc_documents
            WHERE site_id='${tenant.siteId}' AND document_type='business_pan';`);
        const pendingScan = await liveGateway.request(`/v1/kyc/documents/${panId}/refresh?store_id=${tenant.siteId}`, {
            method: 'POST', headers: { ...await signedIdentityHeaders(owner, email, tenant.siteId),
                'X-Idempotency-Key': randomUUID() },
        });
        assert.equal(pendingScan.status, 200, pendingScan.text);
        assert.equal(pendingScan.json?.data.document.evidence_scan_status, 'pending');
        assert.equal(pendingScan.json?.data.document.provider_unavailable, false);
        assert.match(pendingScan.json?.data.overview.next_action || '', /security scan is pending/i);
        assert.equal(owned.psql(`SELECT metadata ? 'provider_checked_at' FROM merchant_kyc_documents
            WHERE id='${panId}';`), 'f', 'a pending scan cannot reach provider verification');
        owned.psql(`UPDATE merchant_kyc_documents SET metadata=jsonb_set(metadata,'{malware_scan_status}','"rejected"'::jsonb)
            WHERE id='${panId}';`);
        const rejectedScan = await liveGateway.request(`/v1/kyc/documents/${panId}/refresh?store_id=${tenant.siteId}`, {
            method: 'POST', headers: { ...await signedIdentityHeaders(owner, email, tenant.siteId),
                'X-Idempotency-Key': randomUUID() },
        });
        assert.equal(rejectedScan.status, 200, rejectedScan.text);
        assert.equal(rejectedScan.json?.data.document.evidence_scan_status, 'rejected');
        assert.equal(rejectedScan.json?.data.document.provider_unavailable, false);
        assert.match(rejectedScan.json?.data.overview.next_action || '', /failed its security scan/i);
        assert.equal(owned.psql(`SELECT metadata ? 'provider_checked_at' FROM merchant_kyc_documents
            WHERE id='${panId}';`), 'f', 'a rejected scan cannot reach provider verification');
        // The fixture stands in for a trusted scanner. Clean evidence alone
        // still cannot make an unavailable provider approve a merchant.
        owned.psql(`UPDATE merchant_kyc_documents SET metadata=jsonb_set(metadata,'{malware_scan_status}','"clean"'::jsonb)
            WHERE site_id='${tenant.siteId}';`);
        const refreshed = await liveGateway.request(`/v1/kyc/documents/${panId}/refresh?store_id=${tenant.siteId}`, {
            method: 'POST', headers: { ...await signedIdentityHeaders(owner, email, tenant.siteId),
                'X-Idempotency-Key': randomUUID() },
        });
        assert.equal(refreshed.status, 200, refreshed.text);
        assert.equal(refreshed.json?.data.document.status, 'submitted');
        assert.equal(refreshed.json?.data.document.provider_unavailable, true);
        assert.equal(refreshed.json?.data.document.verified_at, null);
        assert.equal(refreshed.json?.data.overview.provider_mode, 'live');
        assert.equal(refreshed.json?.data.overview.overall_status, 'in_progress');
        assert.match(refreshed.json?.data.overview.next_action || '', /provider is unavailable/i);
        const stored = JSON.parse(owned.psql(`SELECT metadata::text FROM merchant_kyc_documents WHERE id='${panId}';`));
        assert.equal(stored.provider_verified, false);
        assert.equal(stored.provider_unavailable, true);
        assert.equal(stored.malware_scan_status, 'clean');
        assert.equal(objects.has(stored.private_object_key), true);
        assert.equal(owned.psql(`SELECT status || ':' || (verified_at IS NULL)::text FROM merchant_kyc_documents
            WHERE id='${panId}';`), 'submitted:true',
        'a provider outage cannot stamp a verified time in the canonical database');
        const readback = await liveGateway.request(`/v1/kyc?store_id=${tenant.siteId}`, {
            method: 'GET', headers: await signedIdentityHeaders(owner, email, tenant.siteId),
        });
        assert.equal(readback.status, 200, readback.text);
        assert.equal(readback.json?.data.overall_status, 'in_progress');
        assert.equal(readback.json?.data.documents.find((document: { document_type: string }) =>
            document.document_type === 'business_pan')?.provider_unavailable, true);
        assert.doesNotMatch(readback.text, /private_object_key|sha256|kyc\/[0-9a-f-]{36}\//);
    } finally {
        await liveGateway.settle();
    }
});
