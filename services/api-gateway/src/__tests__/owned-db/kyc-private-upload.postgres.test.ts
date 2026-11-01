import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test, { after } from 'node:test';
import { randomUUID } from 'node:crypto';
import { requireOwnedDatabase } from './owned-db-support';
import { Gateway, gatewayEnv, newIdentityKeys, signedIdentityHeaders, tapRest } from './gateway-harness';
import { newSyntheticTenant, seedSyntheticTenant } from './synthetic-tenant';
import { drainKycPrivateObjectCleanup, reserveKycPrivateObject } from '../../lib/kyc-private-object-cleanup';
import { getSupabaseAdminFromEnv } from '../../lib/supabase';
import worker from '../../index';

const owned = requireOwnedDatabase();
let gateway: Gateway;
after(async () => { await gateway?.settle(); });

test('KYC file upload remains private, tenant-owned and pending provider evidence', async () => {
    const cleanupMigration = readFileSync(new URL('../../../../../database/supabase/migrations/420_kyc_private_object_cleanup.sql', import.meta.url), 'utf8');
    const cleanupRollback = readFileSync(new URL('../../../../../database/supabase/rollback/420_kyc_private_object_cleanup.rollback.sql', import.meta.url), 'utf8');
    owned.psql(cleanupRollback);
    const preflightTenant = newSyntheticTenant('kyc-preflight');
    seedSyntheticTenant(owned.psql, preflightTenant);
    owned.psql(`INSERT INTO merchant_kyc_documents(site_id,document_type,status,provider,provider_mode,metadata)
        VALUES ('${preflightTenant.siteId}','identity_proof','submitted','letbuyy_sandbox_kyc','sandbox',
        '{"private_object_key":"kyc/another-site/identity_proof/unsafe"}'::jsonb);`);
    assert.match(owned.psqlExpectError(cleanupMigration), /Existing private KYC object key needs a reviewed site-bound migration/,
        'the migration stops before schema change when an existing private key is outside its site');
    owned.psql(`UPDATE merchant_kyc_documents SET metadata='{}'::jsonb
        WHERE site_id='${preflightTenant.siteId}' AND document_type='identity_proof';`);
    owned.psql(cleanupMigration);
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
    let putCalls = 0;
    let pauseUploads: (() => Promise<void>) | null = null;
    let failDeleteKey: string | null = null;
    let failDeleteCount = 0;
    const bucket = {
        put: async (key: string, bytes: Uint8Array) => {
            putCalls += 1;
            assert.equal(owned.psql(`SELECT status FROM kyc_private_object_cleanup_jobs WHERE object_key='${key}';`),
                'pending', 'a durable cleanup receipt exists before private bytes reach R2');
            if (pauseUploads) await pauseUploads();
            objects.set(key, bytes);
        },
        delete: async (key: string) => {
            if (key === failDeleteKey && failDeleteCount-- > 0) {
                throw new Error('synthetic R2 deletion outage');
            }
            objects.delete(key);
        },
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
    const currentKey = JSON.parse(owned.psql(`SELECT metadata::text FROM merchant_kyc_documents
        WHERE site_id='${tenant.siteId}' AND document_type='business_pan';`)).private_object_key as string;
    assert.equal(owned.psql(`SELECT purpose || ':' || status || ':' || outcome FROM kyc_private_object_cleanup_jobs
        WHERE object_key='${currentKey}';`), 'upload_reservation:completed:retained');
    // Reproduce an interrupted upload after R2 put but before its evidence row.
    const abandonedKey = `kyc/${tenant.siteId}/business_pan/${randomUUID()}`;
    await reserveKycPrivateObject(getSupabaseAdminFromEnv(gateway.env), tenant.siteId, abandonedKey);
    objects.set(abandonedKey, new TextEncoder().encode('%PDF-1.7\ninterrupted'));
    owned.psql(`UPDATE kyc_private_object_cleanup_jobs SET next_attempt_at=now()
        WHERE object_key='${abandonedKey}';`);
    const abandonedCleanup = await drainKycPrivateObjectCleanup(gateway.env);
    assert.equal(abandonedCleanup.deleted, 1, 'the retry worker removes abandoned private bytes');
    assert.equal(objects.has(abandonedKey), false);
    assert.equal(owned.psql(`SELECT status || ':' || outcome FROM kyc_private_object_cleanup_jobs
        WHERE object_key='${abandonedKey}';`), 'completed:deleted');
    // Reproduce a crash after the evidence row commits but before its receipt closes.
    owned.psql(`UPDATE kyc_private_object_cleanup_jobs SET status='pending', outcome=NULL, completed_at=NULL,
        next_attempt_at=now() WHERE object_key='${currentKey}';`);
    const retainedCleanup = await drainKycPrivateObjectCleanup(gateway.env);
    assert.equal(retainedCleanup.deleted, 0, 'the retry worker preserves a current document');
    assert.equal(objects.has(currentKey), true);
    assert.equal(owned.psql(`SELECT status || ':' || outcome FROM kyc_private_object_cleanup_jobs
        WHERE object_key='${currentKey}';`), 'completed:retained');
    owned.psql(`ALTER TABLE public.kyc_private_object_cleanup_jobs
        ADD CONSTRAINT kyc_receipt_outage_fixture CHECK (purpose <> 'upload_reservation') NOT VALID;`);
    try {
        const objectCount = objects.size;
        const putCallCount = putCalls;
        const receiptOutage = await upload(tenant.siteId, pdf());
        assert.equal(receiptOutage.status, 503, 'an unavailable cleanup receipt fails the upload closed');
        assert.equal(receiptOutage.json?.error?.code, 'KYC_RECEIPT_UNAVAILABLE');
        assert.equal(putCalls, putCallCount, 'the failed receipt never calls private storage');
        assert.equal(objects.size, objectCount, 'no private bytes are written without a durable receipt');
    } finally {
        owned.psql('ALTER TABLE public.kyc_private_object_cleanup_jobs DROP CONSTRAINT kyc_receipt_outage_fixture;');
    }
    const asAuthenticatedOwner = (sql: string) => owned.script(
        `SET ROLE authenticated; SET request.jwt.claim.sub = '${owner}'; ${sql}`);
    const ownerOverview = await gateway.request(`/v1/kyc?store_id=${tenant.siteId}`, {
        method: 'GET', headers: await signedIdentityHeaders(owner, `kyc-${owner}@example.invalid`, tenant.siteId),
    });
    assert.equal(ownerOverview.status, 200, 'positive control: the site owner reads sanitized KYC status through the Gateway');
    assert.equal(ownerOverview.json?.data.documents[0]?.status, 'submitted');
    assert.equal(ownerOverview.json?.data.private_upload_available, true);
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
    assert.equal(owned.psql(`SELECT status FROM kyc_private_object_cleanup_jobs WHERE object_key='${priorKey}';`),
        'completed', 'an immediate successful delete closes its durable cleanup record');
    assert.equal(owned.psql(`SELECT purpose || ':' || outcome FROM kyc_private_object_cleanup_jobs
        WHERE object_key='${priorKey}';`), 'replaced_object:deleted');
    const oldKeyReplay = await upload(tenant.siteId, pdf(), firstKey);
    assert.equal(oldKeyReplay.status, 409, 'a completed upload key must remain consumed after a newer document replaces it');
    assert.equal(oldKeyReplay.json?.error?.code, 'KYC_UPLOAD_SUPERSEDED');
    assert.equal(objects.size, 1);
    const keyBeforeDeleteOutage = JSON.parse(owned.psql(`SELECT metadata::text FROM merchant_kyc_documents
        WHERE site_id='${tenant.siteId}' AND document_type='business_pan';`)).private_object_key as string;
    failDeleteKey = keyBeforeDeleteOutage;
    failDeleteCount = 2;
    const replacementDuringDeleteOutage = await upload(tenant.siteId, pdf());
    assert.equal(replacementDuringDeleteOutage.status, 201,
        'a saved replacement remains a success when deleting its former private object fails');
    assert.equal(objects.size, 2, 'the failed R2 delete is visible in the owned fixture');
    assert.equal(owned.psql(`SELECT status FROM kyc_private_object_cleanup_jobs WHERE object_key='${keyBeforeDeleteOutage}';`),
        'pending', 'the row replacement atomically retained a durable cleanup claim');
    const firstCleanup = await drainKycPrivateObjectCleanup(gateway.env);
    assert.equal(firstCleanup.deleted, 0);
    assert.equal(firstCleanup.deferred, 1);
    assert.equal(objects.size, 2, 'a second R2 outage retains the durable retry and both private objects');
    assert.equal(owned.psql(`SELECT attempts FROM kyc_private_object_cleanup_jobs WHERE object_key='${keyBeforeDeleteOutage}';`), '1');
    owned.psql(`UPDATE kyc_private_object_cleanup_jobs SET next_attempt_at=now()
        WHERE object_key='${keyBeforeDeleteOutage}';`);
    const scheduledTasks: Promise<unknown>[] = [];
    worker.scheduled({ cron: '*/15 * * * *', scheduledTime: Date.now() } as ScheduledController,
        gateway.env, { waitUntil(work: Promise<unknown>) { scheduledTasks.push(Promise.resolve(work)); } } as ExecutionContext);
    await Promise.all(scheduledTasks);
    assert.equal(objects.size, 1, 'scheduled retry removes only the unreferenced old object');
    assert.equal(owned.psql(`SELECT status FROM kyc_private_object_cleanup_jobs WHERE object_key='${keyBeforeDeleteOutage}';`),
        'completed');
    assert.match(owned.psqlExpectError(cleanupRollback), /KYC private cleanup records exist; retain the retry queue/);
    try {
        assert.equal(asAuthenticatedOwner('SELECT count(*) FROM public.kyc_private_object_cleanup_jobs;'), '0');
    } catch (error) {
        assert.match(String(error), /permission denied|row-level security/);
    }
    assert.match(owned.psqlExpectError(`SET ROLE authenticated; SET request.jwt.claim.sub = '${owner}';
        SELECT count(*) FROM public.list_due_kyc_private_cleanup_v1(20);`), /permission denied/,
    'an authenticated merchant cannot enumerate the cross-site cleanup queue');
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
    const refreshKey = randomUUID();
    const refreshHeaders = async () => ({
        ...await signedIdentityHeaders(owner, `kyc-${owner}@example.invalid`, tenant.siteId),
        'X-Idempotency-Key': refreshKey,
    });
    const noRefreshKey = await signedIdentityHeaders(owner, `kyc-${owner}@example.invalid`, tenant.siteId);
    const missingRefreshKey = await gateway.request(`/v1/kyc/documents/${replaced.json!.data.document.id}/refresh?store_id=${tenant.siteId}`,
        { method: 'POST', headers: noRefreshKey });
    assert.equal(missingRefreshKey.status, 400, missingRefreshKey.text);
    owned.psql(`UPDATE merchant_kyc_documents SET metadata = metadata || '{"provider_unavailable":true,"sandbox":false}'::jsonb
        WHERE site_id='${tenant.siteId}' AND document_type='business_pan';`);
    const refreshed = await gateway.request(`/v1/kyc/documents/${replaced.json!.data.document.id}/refresh?store_id=${tenant.siteId}`, { method: 'POST', headers: await refreshHeaders() });
    assert.equal(refreshed.status, 200, refreshed.text);
    assert.equal(owned.psql(`SELECT status FROM idempotency_keys WHERE site_id='${tenant.siteId}'
        AND scope='kyc:document-refresh:${replaced.json!.data.document.id}'
        AND key='${refreshKey}';`), 'completed');
    const checkedAt = owned.psql(`SELECT metadata->>'provider_checked_at' FROM merchant_kyc_documents
        WHERE id='${replaced.json!.data.document.id}';`);
    const refreshReplay = await gateway.request(`/v1/kyc/documents/${replaced.json!.data.document.id}/refresh?store_id=${tenant.siteId}`,
        { method: 'POST', headers: await refreshHeaders() });
    assert.equal(refreshReplay.status, 200, refreshReplay.text);
    assert.equal(owned.psql(`SELECT metadata->>'provider_checked_at' FROM merchant_kyc_documents
        WHERE id='${replaced.json!.data.document.id}';`), checkedAt,
    'a completed refresh key must not perform another provider lookup or KYC write');
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
        const concurrentRetry = await gateway.request(`/v1/kyc/documents/${replaced.json!.data.document.id}/refresh?store_id=${tenant.siteId}`,
            { method: 'POST', headers: { ...await signedIdentityHeaders(owner, `kyc-${owner}@example.invalid`, tenant.siteId),
                'X-Idempotency-Key': racingHeaders['X-Idempotency-Key'] } });
        assert.equal(concurrentRetry.status, 409, concurrentRetry.text);
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
    const supersededRefresh = await gateway.request(`/v1/kyc/documents/${replaced.json!.data.document.id}/refresh?store_id=${tenant.siteId}`,
        { method: 'POST', headers: await refreshHeaders() });
    assert.equal(supersededRefresh.status, 409, 'a prior refresh key cannot operate on replacement evidence');
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
    const unavailableOverview = await gateway.request(`/v1/kyc?store_id=${tenant.siteId}`, {
        method: 'GET', headers: await signedIdentityHeaders(owner, `kyc-${owner}@example.invalid`, tenant.siteId),
    }, noBucket);
    assert.equal(unavailableOverview.status, 200, unavailableOverview.text);
    assert.equal(unavailableOverview.json?.data.private_upload_available, false);
    assert.match(unavailableOverview.json?.data.next_action || '', /Private document upload is unavailable/);
    const historicalUrl = 'https://example.invalid/legacy-identity-proof';
    owned.psql(`INSERT INTO merchant_kyc_documents
        (site_id,document_type,document_number_last4,status,provider,provider_mode,file_url,metadata)
        VALUES ('${tenant.siteId}','identity_proof','1234','submitted','letbuyy_sandbox_kyc','sandbox',
            '${historicalUrl}','{}'::jsonb);`);
    const historicalId = owned.psql(`SELECT id FROM merchant_kyc_documents
        WHERE site_id='${tenant.siteId}' AND document_type='identity_proof';`);
    const historicalRefreshHeaders = await signedIdentityHeaders(owner, `kyc-${owner}@example.invalid`, tenant.siteId);
    historicalRefreshHeaders['X-Idempotency-Key'] = randomUUID();
    const historicalRefresh = await gateway.request(`/v1/kyc/documents/${historicalId}/refresh?store_id=${tenant.siteId}`,
        { method: 'POST', headers: historicalRefreshHeaders });
    assert.equal(historicalRefresh.status, 200, historicalRefresh.text);
    assert.equal(historicalRefresh.json?.data.document.status, 'needs_review',
        'final-four digits and a legacy link cannot count as uploaded evidence');
    assert.equal(historicalRefresh.json?.data.document.has_private_upload, false);
    assert.ok(!historicalRefresh.text.includes(historicalUrl), 'the legacy URL is never returned as a download link');
});

test('canonical business edits atomically revoke only affected KYC evidence until a new upload', async () => {
    const tenant = newSyntheticTenant('kyc-change');
    seedSyntheticTenant(owned.psql, tenant, { gst: true });
    const owner = randomUUID();
    owned.psql(`INSERT INTO users_custom(id,email,email_verified,full_name)
        VALUES ('${owner}','kyc-${owner}@example.invalid',true,'Synthetic KYC owner');
        UPDATE sites SET custom_user_id='${owner}' WHERE id='${tenant.siteId}';`);
    for (const documentType of ['business_pan', 'gst_certificate', 'bank_proof', 'address_proof']) {
        owned.psql(`INSERT INTO merchant_kyc_documents(site_id,document_type,document_number_last4,status,
            provider,provider_mode,provider_reference,metadata,verified_at)
            VALUES ('${tenant.siteId}','${documentType}','1234','verified','signzy','live',
            'synthetic-${documentType}',jsonb_build_object('provider_verified',true,'private_object_key',
            'kyc/${tenant.siteId}/${documentType}/synthetic','malware_scan_status','clean'),now());`);
    }
    const objects = new Map<string, Uint8Array>();
    const bucket = {
        put: async (key: string, bytes: Uint8Array) => { objects.set(key, bytes); },
        delete: async (key: string) => { objects.delete(key); },
    };
    const profileGateway = new Gateway(gatewayEnv(owned, await newIdentityKeys(), {
        KYC_PROVIDER_MODE: 'live', KYC_PROVIDER: 'signzy', KYC_PRIVATE_BUCKET: bucket,
    }));
    const headers = async () => signedIdentityHeaders(owner, `kyc-${owner}@example.invalid`, tenant.siteId);
    const overview = async () => profileGateway.request(`/v1/kyc?store_id=${tenant.siteId}`, {
        method: 'GET', headers: await headers(),
    });
    const patchStore = async (body: Record<string, unknown>) => profileGateway.request(`/v1/stores/${tenant.siteId}`, {
        method: 'PATCH', headers: { ...await headers(), 'X-Idempotency-Key': randomUUID() },
        body: JSON.stringify(body),
    });
    const readDoc = (response: Awaited<ReturnType<typeof overview>>, type: string) =>
        response.json?.data.documents.find((row: { document_type: string }) => row.document_type === type);
    try {
        const before = await overview();
        assert.equal(before.status, 200, before.text);
        assert.equal(before.json?.data.overall_status, 'verified', 'synthetic approvals are a positive control only');
        let version = Number(owned.psql(`SELECT version FROM sites WHERE id='${tenant.siteId}';`));
        const publicEdit = await patchStore({ version, name: 'Changed synthetic storefront name',
            business_profile: { trade_name: 'Changed synthetic trade name', email: 'synthetic@example.invalid' },
        });
        assert.equal(publicEdit.status, 200, publicEdit.text);
        version = publicEdit.json!.data.version;
        assert.equal((await overview()).json?.data.overall_status, 'verified',
            'public-facing edits do not revoke unrelated private identity evidence');
        const legalEdit = await patchStore({ version, legal_name: 'Changed synthetic legal name' });
        assert.equal(legalEdit.status, 200, legalEdit.text);
        version = legalEdit.json!.data.version;
        const afterLegal = await overview();
        assert.equal(afterLegal.json?.data.overall_status, 'needs_review');
        assert.equal(readDoc(afterLegal, 'business_pan')?.requires_resubmission, true);
        assert.equal(readDoc(afterLegal, 'business_pan')?.status, 'needs_review');
        assert.equal(readDoc(afterLegal, 'bank_proof')?.status, 'verified');
        assert.equal(readDoc(afterLegal, 'gst_certificate')?.status, 'verified');
        assert.match(afterLegal.json?.data.next_action || '', /Business details changed/);
        assert.equal(owned.psql(`SELECT provider_reference IS NULL AND verified_at IS NULL
            FROM merchant_kyc_documents WHERE site_id='${tenant.siteId}' AND document_type='business_pan';`), 't');
        const panId = readDoc(afterLegal, 'business_pan')!.id;
        const oldRefresh = await profileGateway.request(`/v1/kyc/documents/${panId}/refresh?store_id=${tenant.siteId}`, {
            method: 'POST', headers: { ...await headers(), 'X-Idempotency-Key': randomUUID() },
        });
        assert.equal(oldRefresh.status, 200, oldRefresh.text);
        assert.equal(oldRefresh.json?.data.document.requires_resubmission, true);
        assert.equal(oldRefresh.json?.data.document.status, 'needs_review');
        assert.equal(owned.psql(`SELECT count(*) FROM idempotency_keys WHERE site_id='${tenant.siteId}'
            AND scope='kyc:document-refresh:${panId}';`), '0', 'stale proof cannot start provider review');

        const gstEdit = await patchStore({ version, gstin: null, gst_state_code: null });
        assert.equal(gstEdit.status, 200, gstEdit.text);
        version = gstEdit.json!.data.version;
        assert.equal(readDoc(await overview(), 'gst_certificate')?.requires_resubmission, true);
        const addressEdit = await patchStore({ version, invoice_address: {
            line1: 'Changed synthetic supplier road', city: 'Bengaluru', state: 'Karnataka',
            state_code: '29', zip: '560001', country: 'IN',
        } });
        assert.equal(addressEdit.status, 200, addressEdit.text);
        const afterAddress = await overview();
        assert.equal(readDoc(afterAddress, 'address_proof')?.requires_resubmission, true);
        assert.equal(readDoc(afterAddress, 'bank_proof')?.status, 'verified');

        const form = new FormData();
        form.set('store_id', tenant.siteId);
        form.set('document_type', 'business_pan');
        form.set('document_number_last4', '1234');
        form.set('file', new File([new TextEncoder().encode('%PDF-1.7\nreplacement')], 'replacement.pdf', { type: 'application/pdf' }));
        const uploadHeaders: Record<string, string> = { ...await headers(), 'X-Idempotency-Key': randomUUID() };
        delete uploadHeaders['Content-Type'];
        const replacement = await profileGateway.request('/v1/kyc/documents/upload', {
            method: 'POST', headers: uploadHeaders, body: form,
        });
        assert.equal(replacement.status, 201, replacement.text);
        assert.equal(replacement.json?.data.document.requires_resubmission, false);
        assert.equal(replacement.json?.data.document.status, 'submitted');
        assert.equal(replacement.json?.data.document.evidence_scan_status, 'pending');
        assert.equal(objects.size, 1);
        assert.ok(!replacement.text.includes('private_object_key'));
        const unsafeRollback = readFileSync(new URL('../../../../../database/supabase/rollback/418_kyc_profile_change_revocation.rollback.sql', import.meta.url), 'utf8');
        assert.match(owned.psqlExpectError(unsafeRollback), /KYC evidence exists; retain profile-change revocation/);
    } finally {
        await profileGateway.settle();
    }
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

test('live mode without an explicitly selected provider reports outage instead of manual review', async () => {
    const tenant = newSyntheticTenant('kyc-unconfigured');
    seedSyntheticTenant(owned.psql, tenant);
    const owner = randomUUID(), email = `kyc-unconfigured-${owner}@example.invalid`;
    owned.psql(`INSERT INTO users_custom(id,email,email_verified,full_name) VALUES
        ('${owner}','${email}',true,'Synthetic KYC owner');
        UPDATE sites SET custom_user_id='${owner}' WHERE id='${tenant.siteId}';`);
    const objects = new Map<string, Uint8Array>();
    const liveGateway = new Gateway(gatewayEnv(owned, await newIdentityKeys(), {
        KYC_PROVIDER_MODE: 'live',
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
            form.set('file', new File([new TextEncoder().encode('%PDF-1.7\nsynthetic evidence')],
                `${documentType}.pdf`, { type: 'application/pdf' }));
            const uploaded = await liveGateway.request('/v1/kyc/documents/upload', {
                method: 'POST', headers: { ...headers, 'X-Idempotency-Key': randomUUID() }, body: form,
            });
            assert.equal(uploaded.status, 201, uploaded.text);
            assert.equal(uploaded.json?.data.document.provider, 'unconfigured');
            assert.equal(uploaded.json?.data.document.provider_mode, 'live');
            assert.equal(uploaded.json?.data.document.status, 'submitted');
            assert.equal(uploaded.json?.data.document.provider_unavailable, true);
        }
        assert.equal(objects.size, 3);
        owned.psql(`UPDATE merchant_kyc_documents
            SET metadata=jsonb_set(metadata,'{malware_scan_status}','"clean"'::jsonb)
            WHERE site_id='${tenant.siteId}';`);
        const afterScan = await liveGateway.request(`/v1/kyc?store_id=${tenant.siteId}`, {
            method: 'GET', headers: await signedIdentityHeaders(owner, email, tenant.siteId),
        });
        assert.equal(afterScan.status, 200, afterScan.text);
        assert.match(afterScan.json?.data.next_action || '', /provider is unavailable/i,
            'a clean scan must not leave an unconfigured provider looking like active review');
        const panId = owned.psql(`SELECT id FROM merchant_kyc_documents
            WHERE site_id='${tenant.siteId}' AND document_type='business_pan';`);
        const refreshed = await liveGateway.request(`/v1/kyc/documents/${panId}/refresh?store_id=${tenant.siteId}`, {
            method: 'POST', headers: { ...await signedIdentityHeaders(owner, email, tenant.siteId),
                'X-Idempotency-Key': randomUUID() },
        });
        assert.equal(refreshed.status, 200, refreshed.text);
        assert.equal(refreshed.json?.data.document.provider, 'unconfigured');
        assert.equal(refreshed.json?.data.document.provider_unavailable, true);
        assert.equal(refreshed.json?.data.document.status, 'submitted');
        assert.equal(refreshed.json?.data.document.verified_at, null);
        assert.equal(refreshed.json?.data.overview.overall_status, 'in_progress');
        assert.match(refreshed.json?.data.overview.next_action || '', /provider is unavailable/i);
        assert.equal(owned.psql(`SELECT provider = 'unconfigured' AND provider_reference IS NULL
            AND verified_at IS NULL AND metadata->>'manual_review_required' = 'false'
            FROM merchant_kyc_documents WHERE id='${panId}';`), 't');
        assert.doesNotMatch(refreshed.text, /private_object_key|sha256|kyc\/[0-9a-f-]{36}\//);
    } finally {
        await liveGateway.settle();
    }
});

test('KYC API follows canonical GST registration when declaring required evidence and overall status', async () => {
    const tenant = newSyntheticTenant('kyc-gst-registration');
    seedSyntheticTenant(owned.psql, tenant);
    const owner = randomUUID(), email = `kyc-gst-${owner}@example.invalid`;
    owned.psql(`INSERT INTO users_custom(id,email,email_verified,full_name) VALUES
        ('${owner}','${email}',true,'Synthetic GST KYC owner');
        UPDATE sites SET custom_user_id='${owner}' WHERE id='${tenant.siteId}';`);
    const registrationGateway = new Gateway(gatewayEnv(owned, await newIdentityKeys(), {
        KYC_PROVIDER_MODE: 'live', KYC_PROVIDER: 'signzy',
        KYC_PRIVATE_BUCKET: {
            put: async () => undefined,
            delete: async () => undefined,
        },
    }));
    const overview = async () => registrationGateway.request(`/v1/kyc?store_id=${tenant.siteId}`, {
        method: 'GET', headers: await signedIdentityHeaders(owner, email, tenant.siteId),
    });
    const gstRequirement = (result: Awaited<ReturnType<typeof overview>>) =>
        result.json?.data.required_documents.find((item: { document_type: string }) => item.document_type === 'gst_certificate');
    try {
        const before = await overview();
        assert.equal(before.status, 200, before.text);
        assert.equal(gstRequirement(before)?.required, false);
        assert.equal(before.json?.data.required_documents.find((item: { document_type: string }) =>
            item.document_type === 'identity_proof')?.required, false);
        for (const documentType of ['business_pan', 'bank_proof', 'address_proof']) {
            owned.psql(`INSERT INTO merchant_kyc_documents(site_id,document_type,document_number_last4,status,
                provider,provider_mode,provider_reference,metadata,verified_at)
                VALUES ('${tenant.siteId}','${documentType}','1234','verified','signzy','live',
                'fixture-${documentType}',jsonb_build_object('provider_verified',true,'private_object_key',
                'kyc/${tenant.siteId}/${documentType}/fixture','malware_scan_status','clean'),now());`);
        }
        const unregistered = await overview();
        assert.equal(unregistered.status, 200, unregistered.text);
        assert.equal(unregistered.json?.data.overall_status, 'verified');
        owned.psql(`UPDATE sites SET gstin='27ABCDE1234F1Z5',gst_state_code='27' WHERE id='${tenant.siteId}';`);
        const registeredMissingCertificate = await overview();
        assert.equal(registeredMissingCertificate.status, 200, registeredMissingCertificate.text);
        assert.equal(gstRequirement(registeredMissingCertificate)?.required, true);
        assert.equal(registeredMissingCertificate.json?.data.overall_status, 'in_progress');
        assert.match(registeredMissingCertificate.json?.data.next_action || '', /remaining required documents/i);
        owned.psql(`INSERT INTO merchant_kyc_documents(site_id,document_type,document_number_last4,status,
            provider,provider_mode,provider_reference,metadata,verified_at)
            VALUES ('${tenant.siteId}','gst_certificate','1234','verified','signzy','live',
            'fixture-gst',jsonb_build_object('provider_verified',true,'private_object_key',
            'kyc/${tenant.siteId}/gst_certificate/fixture','malware_scan_status','clean'),now());`);
        const registeredComplete = await overview();
        assert.equal(registeredComplete.status, 200, registeredComplete.text);
        assert.equal(registeredComplete.json?.data.overall_status, 'verified');
        owned.psql(`UPDATE merchant_kyc_documents SET status='rejected',verified_at=NULL
            WHERE site_id='${tenant.siteId}' AND document_type='gst_certificate';`);
        const registeredRejected = await overview();
        assert.equal(registeredRejected.json?.data.overall_status, 'rejected');
        owned.psql(`UPDATE sites SET gstin=NULL,gst_state_code=NULL WHERE id='${tenant.siteId}';`);
        const unregisteredAgain = await overview();
        assert.equal(gstRequirement(unregisteredAgain)?.required, false);
        assert.equal(unregisteredAgain.json?.data.overall_status, 'verified');
    } finally {
        await registrationGateway.settle();
    }
});
