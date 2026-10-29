import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test, { after } from 'node:test';
import { randomUUID } from 'node:crypto';
import { requireOwnedDatabase } from './owned-db-support';
import { Gateway, gatewayEnv, newIdentityKeys, signedIdentityHeaders } from './gateway-harness';
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
    const upload = async (siteId: string, file: File, key = randomUUID()) => {
        const headers = await signedIdentityHeaders(owner, `kyc-${owner}@example.invalid`, siteId);
        delete headers['Content-Type'];
        headers['X-Idempotency-Key'] = key;
        const form = new FormData();
        form.set('store_id', siteId);
        form.set('document_type', 'business_pan');
        form.set('document_number_last4', '1234');
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
    assert.ok(!first.text.includes('private_object_key'));
    assert.ok(!first.text.includes('kyc/'));
    assert.equal(objects.size, 1);
    const asAuthenticatedOwner = (sql: string) => execFileSync('docker', [
        'exec', owned.container, 'psql', '-U', 'postgres', '-d', owned.database, '-v', 'ON_ERROR_STOP=1',
        '-qAt', '-c', `SET ROLE authenticated; SET request.jwt.claim.sub = '${owner}'; ${sql}`,
    ], { encoding: 'utf8', timeout: 15_000 }).trim();
    assert.equal(asAuthenticatedOwner(`SELECT auth.uid()::text || '|' || count(*)::text FROM public.merchant_kyc_documents
        WHERE site_id='${tenant.siteId}' AND document_type='business_pan' GROUP BY auth.uid();`), `${owner}|1`,
        'positive control: the authenticated site owner can read its own KYC status');
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
    assert.match(saved.private_object_key, new RegExp(`^kyc/${tenant.siteId}/business_pan/`));
    const priorKey = saved.private_object_key;
    const replaced = await upload(tenant.siteId, pdf());
    assert.equal(replaced.status, 201, replaced.text);
    assert.equal(objects.size, 1);
    assert.equal(objects.has(priorKey), false);
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
    const refreshed = await gateway.request(`/v1/kyc/documents/${replaced.json!.data.document.id}/refresh?store_id=${tenant.siteId}`, { method: 'POST', headers: refreshHeaders });
    assert.equal(refreshed.status, 200, refreshed.text);
    assert.equal(refreshed.json?.data.document.has_private_upload, true);
    const refreshedMeta = JSON.parse(owned.psql(`SELECT metadata::text FROM merchant_kyc_documents WHERE site_id='${tenant.siteId}';`));
    assert.equal(objects.has(refreshedMeta.private_object_key), true);
    assert.equal(refreshedMeta.provider_verified, false);
    assert.equal(refreshed.json?.data.overview.overall_status, 'in_progress');
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
    const noBucket = gatewayEnv(owned, await newIdentityKeys());
    const headers = await signedIdentityHeaders(owner, `kyc-${owner}@example.invalid`, tenant.siteId);
    delete headers['Content-Type'];
    headers['X-Idempotency-Key'] = randomUUID();
    const form = new FormData(); form.set('store_id', tenant.siteId); form.set('document_type', 'bank_proof'); form.set('document_number_last4', '1234'); form.set('file', pdf());
    const unavailable = await gateway.request('/v1/kyc/documents/upload', { method: 'POST', headers, body: form }, noBucket);
    assert.equal(unavailable.status, 503, unavailable.text);
});
