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
  globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
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
      <SessionToken>syntheticTempSession1234567890==</SessionToken>
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
    owned.psql(`UPDATE sites SET custom_user_id='${other}' WHERE id='${a.siteId}';`);
    const revoked = await request(a.siteId, input);
    assert.equal(revoked.status, 403, revoked.text);
    assert.equal(stsCalls, 4, 'revoked owner cannot refresh an earlier ticket');
  } finally { globalThis.fetch = original; }
});
