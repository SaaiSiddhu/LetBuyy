import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import { signKycIndiaS3Post, type KycIndiaS3PostInput } from './kyc-india-s3-post';

const input: KycIndiaS3PostInput = {
  siteId: '7ad09d4c-e370-4d9e-becd-4567458f31b9',
  documentType: 'business_pan',
  objectId: 'e0f956ac-5a4e-4f44-9da0-6384614752ce',
  bucket: 'letbuyy-kyc-mumbai-synthetic',
  region: 'ap-south-1',
  accessKeyId: 'SYNTHETICKEY12345678',
  secretAccessKey: 'synthetic-private-signing-secret-for-tests',
  sessionToken: 'synthetic-session-token',
  contentType: 'application/pdf',
  expectedBytes: 1234,
  sha256Hex: 'a'.repeat(64),
};
const testClock = () => new Date('2026-11-01T02:03:04.000Z');

test('India KYC POST policy binds one key, checksum, region, size cap and short expiry', async () => {
  const signed = await signKycIndiaS3Post(input, testClock);
  assert.equal(signed.method, 'POST');
  assert.equal(signed.url, 'https://letbuyy-kyc-mumbai-synthetic.s3.ap-south-1.amazonaws.com/');
  assert.equal(signed.objectKey, `kyc/${input.siteId}/business_pan/${input.objectId}`);
  assert.equal(signed.fields.key, signed.objectKey);
  assert.equal(signed.fields['x-amz-date'], '20261101T020304Z');
  assert.equal(signed.fields['x-amz-credential'],
    'SYNTHETICKEY12345678/20261101/ap-south-1/s3/aws4_request');
  assert.equal(signed.fields['x-amz-checksum-sha256'], Buffer.from('aa'.repeat(32), 'hex').toString('base64'));
  assert.equal(signed.fields['x-amz-security-token'], 'synthetic-session-token');
  assert.equal(signed.expiresAt, '2026-11-01T02:06:04.000Z');
  const policy = JSON.parse(Buffer.from(signed.fields.policy, 'base64').toString('utf8')) as {
    expiration: string; conditions: unknown[];
  };
  assert.equal(policy.expiration, signed.expiresAt);
  assert.deepEqual(policy.conditions, [
    { bucket: input.bucket },
    { key: signed.objectKey },
    { 'Content-Type': input.contentType },
    ['content-length-range', 1, 5 * 1024 * 1024],
    { 'x-amz-checksum-algorithm': 'SHA256' },
    { 'x-amz-checksum-sha256': signed.fields['x-amz-checksum-sha256'] },
    { 'x-amz-server-side-encryption': 'AES256' },
    { success_action_status: '201' },
    { 'x-amz-algorithm': 'AWS4-HMAC-SHA256' },
    { 'x-amz-credential': signed.fields['x-amz-credential'] },
    { 'x-amz-date': signed.fields['x-amz-date'] },
    { 'x-amz-security-token': 'synthetic-session-token' },
  ]);
  const hmac = (key: Buffer | string, value: string) => createHmac('sha256', key).update(value).digest();
  const dateKey = hmac('AWS4' + input.secretAccessKey, '20261101');
  const regionKey = hmac(dateKey, 'ap-south-1');
  const serviceKey = hmac(regionKey, 's3');
  const signingKey = hmac(serviceKey, 'aws4_request');
  assert.equal(signed.fields['x-amz-signature'], hmac(signingKey, signed.fields.policy).toString('hex'));
  assert.doesNotMatch(JSON.stringify(signed), /synthetic-private-signing-secret-for-tests/);
});

test('India KYC signer rejects other regions, malformed identifiers and unsafe upload envelopes', async () => {
  const cases: Array<Partial<KycIndiaS3PostInput>> = [
    { region: 'us-east-1' as KycIndiaS3PostInput['region'] },
    { siteId: '../other-site' },
    { objectId: 'not-a-uuid' },
    { bucket: 'public.example.com' },
    { contentType: 'text/html' as KycIndiaS3PostInput['contentType'] },
    { expectedBytes: 0 },
    { expectedBytes: 5 * 1024 * 1024 + 1 },
    { sha256Hex: 'invalid' },
    { expiresInSeconds: 301 },
    { expiresInSeconds: 1 },
    { sessionToken: '' },
    { sessionToken: undefined },
    { sessionToken: 'x'.repeat(4097) },
  ];
  for (const change of cases) {
    await assert.rejects(signKycIndiaS3Post({ ...input, ...change }, testClock), /KYC_INDIA_S3_POST_INVALID/,
      JSON.stringify(change));
  }
});
