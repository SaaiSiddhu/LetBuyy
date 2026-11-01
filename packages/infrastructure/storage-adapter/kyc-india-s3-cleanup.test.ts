import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';
import test from 'node:test';
import { cleanupKycIndiaS3ObjectVersions, type KycIndiaS3CleanupInput } from './kyc-india-s3-cleanup';

const input: KycIndiaS3CleanupInput = {
  siteId: 'd7194463-3cdb-4e2a-850b-cb048986adad',
  documentType: 'business_pan', receiptId: '2c73a536-4dc4-4df1-92d4-89d0c8b51d99',
  bucket: 'private-kyc-mumbai', expectedBucketOwner: '123456789012', region: 'ap-south-1',
  accessKeyId: 'AKIAIOSFODNN7EXAMPLE', secretAccessKey: 'synthetic-cleanup-secret-for-tests',
};
const key = `kyc/${input.siteId}/${input.documentType}/${input.receiptId}`;
const at = () => new Date('2026-11-01T12:00:00.000Z');
const xml = (body: string, truncated = false) =>
  `<?xml version="1.0" encoding="UTF-8"?><ListVersionsResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><IsTruncated>${truncated}</IsTruncated>${body}</ListVersionsResult>`;
const version = (id: string, name = 'Version', objectKey = key) =>
  `<${name}><Key>${objectKey}</Key><VersionId>${id}</VersionId></${name}>`;

function verifySignature(url: URL, options: RequestInit) {
  const headers = new Headers(options.headers);
  assert.equal(headers.get('x-amz-expected-bucket-owner'), input.expectedBucketOwner);
  const auth = headers.get('authorization') || '';
  const signed = auth.match(/SignedHeaders=([^,]+), Signature=([a-f0-9]{64})$/);
  assert.ok(signed);
  const names = signed[1].split(';');
  const canonicalHeaders = names.map(name => `${name}:${name === 'host' ? url.host : headers.get(name)}\n`).join('');
  const canonical = `${options.method}\n${url.pathname}\n${url.search.slice(1)}\n${canonicalHeaders}\n${signed[1]}\n${headers.get('x-amz-content-sha256')}`;
  const scope = '20261101/ap-south-1/s3/aws4_request';
  const toSign = `AWS4-HMAC-SHA256\n20261101T120000Z\n${scope}\n${createHash('sha256').update(canonical).digest('hex')}`;
  let hmacKey: Buffer = Buffer.from(`AWS4${input.secretAccessKey}`);
  for (const part of ['20261101', 'ap-south-1', 's3', 'aws4_request'])
    hmacKey = createHmac('sha256', hmacKey).update(part).digest();
  assert.equal(signed[2], createHmac('sha256', hmacKey).update(toSign).digest('hex'));
}

test('cleanup lists exact Mumbai key, deletes each version and marker, and confirms empty', async () => {
  const calls: string[] = [];
  const fetcher: typeof fetch = async (request, options) => {
    const url = new URL(String(request));
    calls.push(`${options?.method} ${url.pathname}${url.search}`);
    assert.equal(url.host, 'private-kyc-mumbai.s3.ap-south-1.amazonaws.com');
    assert.equal(options?.redirect, 'manual');
    verifySignature(url, options!);
    if (options?.method === 'GET') return new Response(xml(calls.length === 1
      ? version('version-1') + version('marker-2', 'DeleteMarker') : ''), { status: 200 });
    assert.equal(url.pathname, `/${key}`);
    assert.ok(['version-1', 'marker-2'].includes(url.searchParams.get('versionId') || ''));
    return new Response(null, { status: 204,
      headers: { 'x-amz-version-id': url.searchParams.get('versionId')! } });
  };
  assert.deepEqual(await cleanupKycIndiaS3ObjectVersions(input, fetcher, at),
    { deleted: 2, remaining: false });
  assert.equal(calls.length, 4);
  assert.ok(calls[0].includes('max-keys=50&prefix='));
  assert.ok(calls[0].endsWith('&versions='));
  assert.equal(calls.filter(call => call.startsWith('DELETE')).length, 2);
});

test('cleanup refuses foreign keys, null versions, provider outages and partial deletion', async () => {
  for (const body of [version('version-1', 'Version', `kyc/foreign/business_pan/${input.receiptId}`),
    version('null'), '<Version><Key>' + key + '</Key></Version>']) {
    await assert.rejects(cleanupKycIndiaS3ObjectVersions(input,
      async () => new Response(xml(body), { status: 200 }) as Response, at),
    /KYC_INDIA_S3_CLEANUP_UNAVAILABLE/);
  }
  await assert.rejects(cleanupKycIndiaS3ObjectVersions(input,
    async () => new Response('failure', { status: 503 }), at), /KYC_INDIA_S3_CLEANUP_UNAVAILABLE/);
  let deletes = 0;
  await assert.rejects(cleanupKycIndiaS3ObjectVersions(input, async (_request, options) => {
    if (options?.method === 'GET') return new Response(xml(version('version-1')), { status: 200 });
    deletes++;
    return new Response('denied', { status: 403 });
  }, at), /KYC_INDIA_S3_CLEANUP_UNAVAILABLE/);
  assert.equal(deletes, 1);
  await assert.rejects(cleanupKycIndiaS3ObjectVersions({ ...input, region: 'us-east-1' as 'ap-south-1' },
    async () => { throw new Error('must not call S3'); }, at), /KYC_INDIA_S3_CLEANUP_INVALID/);
});

test('cleanup remains open until a follow-up version listing is empty', async () => {
  let lists = 0;
  const fetcher: typeof fetch = async (_request, options) => {
    if (options?.method === 'DELETE') return new Response(null, { status: 204 });
    lists++;
    return new Response(xml(version(lists === 1 ? 'version-1' : 'version-2'), true), { status: 200 });
  };
  assert.deepEqual(await cleanupKycIndiaS3ObjectVersions(input, fetcher, at),
    { deleted: 1, remaining: true });
  assert.equal(lists, 2);
  assert.deepEqual(await cleanupKycIndiaS3ObjectVersions(input,
    async () => new Response(xml(''), { status: 200 }), at),
    { deleted: 0, remaining: false }, 'an upload that never reached S3 can close only after an empty listing');
});
