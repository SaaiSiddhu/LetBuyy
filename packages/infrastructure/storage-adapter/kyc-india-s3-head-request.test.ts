import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';
import test from 'node:test';
import { headKycIndiaS3Object, type KycIndiaS3HeadRequest } from './kyc-india-s3-head-request';

const input: KycIndiaS3HeadRequest = {
  siteId: '7ad09d4c-e370-4d9e-becd-4567458f31b9',
  documentType: 'business_pan',
  intentId: 'e0f956ac-5a4e-4f44-9da0-6384614752ce',
  bucket: 'letbuyy-kyc-mumbai-synthetic',
  expectedBucketOwner: '123456789012',
  region: 'ap-south-1',
  accessKeyId: 'SYNTHETICKEY12345678',
  secretAccessKey: 'synthetic-private-signing-secret-for-tests',
  sessionToken: 'synthetic-backend-session',
  versionId: 'test/version+id=',
  expectedBytes: 1234,
  contentType: 'application/pdf',
  sha256Hex: 'a'.repeat(64),
};

test('backend HEAD signs exact Mumbai version and accepts matching checksum, owner and encryption', async () => {
  let calls = 0;
  const fetcher = (async (url: RequestInfo | URL, init?: RequestInit) => {
    calls++;
    assert.equal(String(url), `https://${input.bucket}.s3.ap-south-1.amazonaws.com/kyc/${input.siteId}/business_pan/${input.intentId}?versionId=test%2Fversion%2Bid%3D`);
    assert.equal(init?.method, 'HEAD');
    assert.equal(init?.redirect, 'manual');
    const headers = new Headers(init?.headers);
    assert.equal(headers.get('x-amz-checksum-mode'), 'ENABLED');
    assert.equal(headers.get('x-amz-expected-bucket-owner'), input.expectedBucketOwner);
    assert.equal(headers.get('x-amz-security-token'), input.sessionToken);
    assert.equal(headers.get('host'), null);
    assert.equal(headers.get('x-amz-date'), '20261101T020304Z');
    const names = ['host', 'x-amz-checksum-mode', 'x-amz-content-sha256', 'x-amz-date',
      'x-amz-expected-bucket-owner', 'x-amz-security-token'];
    const signedHeaders = names.join(';');
    const canonicalHeaders = names.map(name => `${name}:${name === 'host'
      ? `${input.bucket}.s3.ap-south-1.amazonaws.com` : headers.get(name)}\n`).join('');
    const empty = createHash('sha256').update('').digest('hex');
    const canonical = `HEAD\n/kyc/${input.siteId}/business_pan/${input.intentId}\nversionId=test%2Fversion%2Bid%3D\n${canonicalHeaders}\n${signedHeaders}\n${empty}`;
    const scope = '20261101/ap-south-1/s3/aws4_request';
    const stringToSign = `AWS4-HMAC-SHA256\n20261101T020304Z\n${scope}\n${createHash('sha256').update(canonical).digest('hex')}`;
    let key = createHmac('sha256', `AWS4${input.secretAccessKey}`).update('20261101').digest();
    for (const part of ['ap-south-1', 's3', 'aws4_request']) key = createHmac('sha256', key).update(part).digest();
    const expectedSignature = createHmac('sha256', key).update(stringToSign).digest('hex');
    assert.equal(headers.get('authorization'),
      `AWS4-HMAC-SHA256 Credential=${input.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${expectedSignature}`);
    return new Response(null, { status: 200, headers: {
      'x-amz-version-id': input.versionId,
      'content-length': String(input.expectedBytes),
      'content-type': input.contentType,
      'x-amz-checksum-sha256': Buffer.from('aa'.repeat(32), 'hex').toString('base64'),
      'x-amz-server-side-encryption': 'AES256',
    } });
  }) as typeof fetch;
  const verified = await headKycIndiaS3Object(input, fetcher,
    () => new Date('2026-11-01T02:03:04.000Z'));
  assert.equal(calls, 1);
  assert.deepEqual(verified, { versionId: input.versionId, byteSize: 1234,
    contentType: 'application/pdf', sha256Hex: 'a'.repeat(64), encryption: 'AES256' });
});

test('backend HEAD refuses unsafe identifiers before network and mismatched provider evidence', async () => {
  let calls = 0;
  const fetcher = (async () => { calls++; return new Response(null, { status: 302 }); }) as typeof fetch;
  for (const change of [{ region: 'us-east-1' }, { bucket: 'bad.example.com' },
    { expectedBucketOwner: '123' }, { versionId: 'null' }, { intentId: '../other' }]) {
    await assert.rejects(headKycIndiaS3Object({ ...input, ...change } as KycIndiaS3HeadRequest, fetcher),
      /KYC_INDIA_S3_HEAD_REQUEST_INVALID/);
  }
  assert.equal(calls, 0);
  await assert.rejects(headKycIndiaS3Object(input, fetcher), /KYC_INDIA_S3_HEAD_INVALID/);
  assert.equal(calls, 1);
});
