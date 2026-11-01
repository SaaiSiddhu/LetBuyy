import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test, { after, before } from 'node:test';
import { Gateway, gatewayEnv, newIdentityKeys, signedIdentityHeaders } from './gateway-harness';
import { closePooledSqlClients } from '@letbuyy/infrastructure/pooled-sql-adapter';
import { requireOwnedDatabase, startOwnedPooledSqlProxy,
  type OwnedPooledSqlProxy } from './owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant } from './synthetic-tenant';

const owned = requireOwnedDatabase();
let gateway: Gateway;
let pooled: OwnedPooledSqlProxy;
before(async () => { pooled = await startOwnedPooledSqlProxy(owned); });
after(async () => { await gateway?.settle(); await closePooledSqlClients(); await pooled?.stop(); });

test('real Gateway issues only an owned, durable, exact-key test ticket and refuses stale/cross-site attempts', async () => {
  const a = newSyntheticTenant('india-ticket-a');
  const b = newSyntheticTenant('india-ticket-b');
  seedSyntheticTenant(owned.psql, a);
  seedSyntheticTenant(owned.psql, b);
  const owner = randomUUID(), other = randomUUID();
  owned.psql(`INSERT INTO users_custom(id,email,email_verified,full_name) VALUES
    ('${owner}','owner-${owner}@example.invalid',true,'Synthetic owner'),
    ('${other}','other-${other}@example.invalid',true,'Synthetic other');
    UPDATE sites SET custom_user_id='${owner}' WHERE id='${a.siteId}';
    UPDATE sites SET custom_user_id='${other}' WHERE id='${b.siteId}';`);
  const env = gatewayEnv(owned, await newIdentityKeys(), {
    ...pooled.env(),
    KYC_INDIA_UPLOAD_ENABLED: 'true',
    KYC_INDIA_BUCKET: 'letbuyy-kyc-mumbai-synthetic',
    KYC_INDIA_ACCOUNT_ID: '123456789012',
    KYC_INDIA_UPLOAD_ROLE_ARN: 'arn:aws:iam::123456789012:role/letbuyy-kyc-upload',
    KYC_INDIA_STS_ACCESS_KEY_ID: 'SYNTHETICKEY12345678',
    KYC_INDIA_STS_SECRET_ACCESS_KEY: 'synthetic-sts-source-secret-for-tests',
    KYC_INDIA_HEAD_ACCESS_KEY_ID: 'SYNTHETICHEAD12345678',
    KYC_INDIA_HEAD_SECRET_ACCESS_KEY: 'synthetic-head-secret-for-tests',
  });
  gateway = new Gateway(env);
  const input = { store_id: a.siteId, document_type: 'business_pan', document_number_last4: '1234',
    content_type: 'application/pdf', byte_size: 1234, sha256_hex: 'a'.repeat(64) };
  const idempotencyKey = randomUUID();
  const request = async (siteId = a.siteId, body = input, key = idempotencyKey, actor = owner,
    requestEnv = env) => {
    const headers = await signedIdentityHeaders(actor, `owner-${actor}@example.invalid`, siteId);
    headers['X-Idempotency-Key'] = key;
    return gateway.request('/v1/kyc/documents/upload-intent', { method: 'POST', headers,
      body: JSON.stringify(body) }, requestEnv);
  };

  const closed = await request(a.siteId, input, randomUUID(), owner,
    { ...env, KYC_INDIA_UPLOAD_ENABLED: 'false' });
  assert.equal(closed.status, 503);
  assert.equal(closed.json?.error?.code, 'KYC_INDIA_UPLOAD_UNAVAILABLE');
  assert.equal(owned.psql(`SELECT count(*) FROM kyc_private_object_cleanup_jobs
    WHERE site_id='${a.siteId}' AND storage_provider='aws_s3_mumbai';`), '0');

  const original = globalThis.fetch;
  let stsCalls = 0;
  let stsOutage = false;
  let headCalls = 0;
  let headMode: 'clean' | 'mismatch' | 'outage' = 'clean';
  const versionId = 'synthetic/version+1';
  const syntheticSessionToken = ['synthetic', 'TempSession', '1234567890=='].join('');
  globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
    if (String(url).startsWith('https://letbuyy-kyc-mumbai-synthetic.s3.ap-south-1.amazonaws.com/kyc/')) {
      headCalls++;
      assert.equal(init?.method, 'HEAD');
      assert.equal(init?.redirect, 'manual');
      assert.equal(new URL(String(url)).searchParams.get('versionId'), versionId);
      const headers = new Headers(init?.headers);
      assert.equal(headers.get('x-amz-expected-bucket-owner'), '123456789012');
      assert.equal(headers.get('x-amz-checksum-mode'), 'ENABLED');
      assert.match(headers.get('authorization') || '', /^AWS4-HMAC-SHA256 Credential=SYNTHETICHEAD12345678\//);
      if (headMode === 'outage') return new Response(null, { status: 503 });
      return new Response(null, { status: 200, headers: {
        'x-amz-version-id': versionId,
        'content-length': '1234', 'content-type': 'application/pdf',
        'x-amz-checksum-sha256': Buffer.from((headMode === 'mismatch' ? 'bb' : 'aa').repeat(32), 'hex').toString('base64'),
        'x-amz-server-side-encryption': 'AES256',
      } });
    }
    if (String(url) !== 'https://sts.ap-south-1.amazonaws.com/') return original(url, init);
    stsCalls++;
    if (stsOutage) return new Response('', { status: 503 });
    assert.equal(init?.method, 'POST');
    assert.equal(init?.redirect, 'manual');
    const form = new URLSearchParams(String(init?.body));
    const policy = JSON.parse(form.get('Policy')!);
    assert.equal(policy.Statement.length, 1);
    assert.equal(policy.Statement[0].Action, 's3:PutObject');
    assert.match(policy.Statement[0].Resource,
      new RegExp(`^arn:aws:s3:::letbuyy-kyc-mumbai-synthetic/kyc/${a.siteId}/business_pan/[a-f0-9-]{36}$`));
    const key = String(policy.Statement[0].Resource).split(`${input.store_id}/`).at(-1);
    assert.match(key || '', /^business_pan\/[a-f0-9-]{36}$/);
    assert.equal(owned.psql(`SELECT count(*) FROM kyc_private_object_cleanup_jobs
      WHERE site_id='${a.siteId}' AND storage_provider='aws_s3_mumbai'
        AND object_key='kyc/${a.siteId}/${key}'
        AND purpose='upload_reservation' AND status='pending';`), '1',
    'durable receipt commits before STS is contacted');
    const expiresAt = new Date(Date.now() + 15 * 60_000).toISOString();
    return new Response(`<AssumeRoleResponse><AssumeRoleResult><Credentials>
      <AccessKeyId>ASIATEMPORARY12345678</AccessKeyId>
      <SecretAccessKey>synthetic-temporary-secret-123456</SecretAccessKey>
      <SessionToken>${syntheticSessionToken}</SessionToken>
      <Expiration>${expiresAt}</Expiration>
      </Credentials></AssumeRoleResult></AssumeRoleResponse>`,
    { status: 200, headers: { 'content-type': 'text/xml' } });
  }) as typeof fetch;
  try {
    const first = await request();
    assert.equal(first.status, 201, `${first.text} sts_calls=${stsCalls} receipt_count=${owned.psql(`SELECT count(*) FROM kyc_private_object_cleanup_jobs WHERE site_id='${a.siteId}' AND storage_provider='aws_s3_mumbai';`)}`);
    assert.equal(first.json?.data?.method, 'POST');
    assert.equal(first.json?.data?.fields?.key,
      `kyc/${a.siteId}/business_pan/${first.json?.data?.receipt_id}`);
    assert.equal(first.json?.data?.fields?.['x-amz-checksum-sha256'],
      Buffer.from('aa'.repeat(32), 'hex').toString('base64'));
    assert.doesNotMatch(first.text, /synthetic-(sts-source|temporary)-secret/);
    const same = await request();
    assert.equal(same.status, 201, same.text);
    assert.equal(same.json?.data?.receipt_id, first.json?.data?.receipt_id);
    assert.equal(owned.psql(`SELECT count(*) FROM kyc_private_object_cleanup_jobs
      WHERE site_id='${a.siteId}' AND storage_provider='aws_s3_mumbai';`), '1');
    const changed = await request(a.siteId, { ...input, sha256_hex: 'b'.repeat(64) });
    assert.equal(changed.status, 409, changed.text);
    const staff = await request(a.siteId, input, randomUUID(), other);
    assert.equal(staff.status, 403, staff.text);
    const forged = await request(b.siteId, { ...input, store_id: b.siteId }, randomUUID());
    assert.equal(forged.status, 403, forged.text);
    assert.equal(owned.psql(`SELECT count(*) FROM kyc_private_object_cleanup_jobs
      WHERE site_id='${b.siteId}' AND storage_provider='aws_s3_mumbai';`), '0');
    assert.equal(stsCalls, 2, 'only the two valid same-intent retries contact the provider');
    const outageKey = randomUUID();
    stsOutage = true;
    const unavailable = await request(a.siteId, input, outageKey);
    assert.equal(unavailable.status, 503, unavailable.text);
    assert.equal(owned.psql(`SELECT count(*) FROM kyc_private_object_cleanup_jobs
      WHERE site_id='${a.siteId}' AND upload_idempotency_key='${outageKey}';`), '1',
    'provider outage keeps the same pending receipt for a safe retry');
    stsOutage = false;
    const recovered = await request(a.siteId, input, outageKey);
    assert.equal(recovered.status, 201, recovered.text);
    assert.equal(owned.psql(`SELECT count(*) FROM kyc_private_object_cleanup_jobs
      WHERE site_id='${a.siteId}' AND upload_idempotency_key='${outageKey}';`), '1');
    const complete = async (receiptId: string, key = idempotencyKey,
      completionVersion = versionId, siteId = a.siteId, actor = owner) => {
      const headers = await signedIdentityHeaders(actor, `owner-${actor}@example.invalid`, siteId);
      headers['X-Idempotency-Key'] = key;
      return gateway.request('/v1/kyc/documents/upload-complete', {
        method: 'POST', headers,
        body: JSON.stringify({ store_id: siteId, receipt_id: receiptId, version_id: completionVersion }),
      });
    };
    const receiptId = String(first.json?.data?.receipt_id);
    const wrongKey = await complete(receiptId, randomUUID());
    assert.equal(wrongKey.status, 409, wrongKey.text);
    assert.equal(headCalls, 0);
    headMode = 'mismatch';
    const mismatch = await complete(receiptId);
    assert.equal(mismatch.status, 422, mismatch.text);
    assert.equal(owned.psql(`SELECT count(*) FROM merchant_kyc_documents WHERE site_id='${a.siteId}';`), '0');
    headMode = 'outage';
    const headOutage = await complete(receiptId);
    assert.equal(headOutage.status, 503, headOutage.text);
    assert.equal(owned.psql(`SELECT object_version_id IS NULL FROM kyc_private_object_cleanup_jobs WHERE id='${receiptId}';`), 't');
    headMode = 'clean';
    const submitted = await complete(receiptId);
    assert.equal(submitted.status, 201, submitted.text);
    assert.equal(submitted.json?.data?.document_status, 'submitted');
    assert.equal(submitted.json?.data?.evidence_scan_status, 'pending');
    assert.equal(submitted.json?.data?.replay, false);
    const evidence = JSON.parse(owned.psql(`SELECT metadata::text FROM merchant_kyc_documents
      WHERE site_id='${a.siteId}' AND document_type='business_pan';`));
    assert.equal(evidence.private_storage_provider, 'aws_s3_mumbai');
    assert.equal(evidence.private_upload_receipt_id, receiptId);
    assert.equal(evidence.private_object_version_id, versionId);
    assert.equal(evidence.malware_scan_status, 'pending');
    assert.equal(evidence.provider_verified, false);
    assert.equal(owned.psql(`SELECT status || ':' || outcome FROM kyc_private_object_cleanup_jobs
      WHERE id='${receiptId}';`), 'completed:retained');
    const readHeaders = await signedIdentityHeaders(owner, `owner-${owner}@example.invalid`, a.siteId);
    const overview = await gateway.request(`/v1/kyc?store_id=${a.siteId}`, { headers: readHeaders });
    assert.equal(overview.status, 200, overview.text);
    assert.equal(overview.json?.data?.overall_status, 'in_progress');
    assert.equal(overview.json?.data?.documents?.[0]?.evidence_scan_status, 'pending');
    assert.doesNotMatch(overview.text, /private_object_key|private_object_version_id|private_upload_receipt_id|sha256|kyc\//);
    const repeated = await complete(receiptId);
    assert.equal(repeated.status, 201, repeated.text);
    assert.equal(repeated.json?.data?.replay, true);
    assert.equal(headCalls, 3, 'a completed current receipt does not repeat provider HEAD');
    const wrongVersion = await complete(receiptId, idempotencyKey, 'another-version');
    assert.equal(wrongVersion.status, 409, wrongVersion.text);
    const foreignComplete = await complete(receiptId, idempotencyKey, versionId, b.siteId);
    assert.equal(foreignComplete.status, 403, foreignComplete.text);
    owned.psql(`UPDATE sites SET custom_user_id='${other}' WHERE id='${a.siteId}';`);
    const revoked = await request(a.siteId, input);
    assert.equal(revoked.status, 403, revoked.text);
    const revokedComplete = await complete(receiptId);
    assert.equal(revokedComplete.status, 403, revokedComplete.text);
    const nextOwnerTicket = await request(a.siteId, input, idempotencyKey, other);
    assert.equal(nextOwnerTicket.status, 409, nextOwnerTicket.text);
    const nextOwnerComplete = await complete(receiptId, idempotencyKey, versionId, a.siteId, other);
    assert.equal(nextOwnerComplete.status, 409, nextOwnerComplete.text);
    assert.equal(stsCalls, 4, 'revoked owner cannot refresh an earlier ticket');
  } finally { globalThis.fetch = original; }
});
