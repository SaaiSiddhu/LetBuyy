import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';
import test from 'node:test';
import { assumeKycIndiaUploadRole, kycIndiaUploadSessionPolicy,
  type KycIndiaUploadRoleInput } from './kyc-india-s3-sts';

const input: KycIndiaUploadRoleInput = {
  siteId: '7ad09d4c-e370-4d9e-becd-4567458f31b9',
  documentType: 'business_pan',
  intentId: 'e0f956ac-5a4e-4f44-9da0-6384614752ce',
  bucket: 'letbuyy-kyc-mumbai-synthetic',
  expectedBucketOwner: '123456789012',
  roleArn: 'arn:aws:iam::123456789012:role/letbuyy-kyc-upload',
  sourceAccessKeyId: 'SYNTHETICKEY12345678',
  sourceSecretAccessKey: 'synthetic-source-secret-for-tests',
  sourceSessionToken: 'synthetic-source-session',
};
const objectKey = `kyc/${input.siteId}/business_pan/${input.intentId}`;
const testClock = () => new Date('2026-11-01T02:03:04.000Z');

test('STS request signs Mumbai endpoint and permits only one encrypted object upload', async () => {
  const policy = JSON.parse(kycIndiaUploadSessionPolicy(input.bucket, objectKey));
  assert.deepEqual(policy, { Version: '2012-10-17', Statement: [{ Effect: 'Allow',
    Action: 's3:PutObject', Resource: `arn:aws:s3:::${input.bucket}/${objectKey}`,
    Condition: { StringEquals: { 's3:x-amz-server-side-encryption': 'AES256' } } }] });
  let calls = 0;
  const fetcher = (async (url: RequestInfo | URL, init?: RequestInit) => {
    calls++;
    assert.equal(String(url), 'https://sts.ap-south-1.amazonaws.com/');
    assert.equal(init?.method, 'POST');
    assert.equal(init?.redirect, 'manual');
    const body = String(init?.body);
    const form = new URLSearchParams(body);
    assert.equal(form.get('Action'), 'AssumeRole');
    assert.equal(form.get('DurationSeconds'), '900');
    assert.equal(form.get('RoleArn'), input.roleArn);
    assert.equal(form.get('RoleSessionName'), `kyc-${input.intentId}`);
    assert.deepEqual(JSON.parse(form.get('Policy')!), policy);
    const headers = new Headers(init?.headers);
    assert.equal(headers.get('host'), null);
    assert.equal(headers.get('x-amz-security-token'), input.sourceSessionToken);
    assert.equal(headers.get('x-amz-date'), '20261101T020304Z');
    const payloadHash = createHash('sha256').update(body).digest('hex');
    assert.equal(headers.get('x-amz-content-sha256'), payloadHash);
    const names = ['content-type', 'host', 'x-amz-content-sha256', 'x-amz-date', 'x-amz-security-token'];
    const canonicalHeaders = names.map(name => `${name}:${name === 'host'
      ? 'sts.ap-south-1.amazonaws.com' : headers.get(name)}\n`).join('');
    const canonical = `POST\n/\n\n${canonicalHeaders}\n${names.join(';')}\n${payloadHash}`;
    const scope = '20261101/ap-south-1/sts/aws4_request';
    const stringToSign = `AWS4-HMAC-SHA256\n20261101T020304Z\n${scope}\n${createHash('sha256').update(canonical).digest('hex')}`;
    let key = createHmac('sha256', `AWS4${input.sourceSecretAccessKey}`).update('20261101').digest();
    for (const part of ['ap-south-1', 'sts', 'aws4_request']) key = createHmac('sha256', key).update(part).digest();
    const expectedSignature = createHmac('sha256', key).update(stringToSign).digest('hex');
    assert.equal(headers.get('authorization'),
      `AWS4-HMAC-SHA256 Credential=${input.sourceAccessKeyId}/${scope}, SignedHeaders=${names.join(';')}, Signature=${expectedSignature}`);
    return new Response(`<AssumeRoleResponse><AssumeRoleResult><Credentials>
      <AccessKeyId>ASIATEMPORARY12345678</AccessKeyId>
      <SecretAccessKey>synthetic-temporary-secret-123456</SecretAccessKey>
      <SessionToken>syntheticTempSession1234567890==</SessionToken>
      <Expiration>2026-11-01T02:18:04Z</Expiration>
      </Credentials></AssumeRoleResult></AssumeRoleResponse>`,
    { status: 200, headers: { 'content-type': 'text/xml' } });
  }) as typeof fetch;
  const issued = await assumeKycIndiaUploadRole(input, fetcher, testClock);
  assert.equal(calls, 1);
  assert.deepEqual(issued, { accessKeyId: 'ASIATEMPORARY12345678',
    secretAccessKey: 'synthetic-temporary-secret-123456',
    sessionToken: 'syntheticTempSession1234567890==', expiresAt: '2026-11-01T02:18:04Z', objectKey });
  assert.doesNotMatch(JSON.stringify(issued), /synthetic-source-secret-for-tests/);
});

test('STS issuer refuses cross-account roles and malformed scope before network', async () => {
  let calls = 0;
  const fetcher = (async () => { calls++; return new Response('', { status: 403 }); }) as typeof fetch;
  for (const change of [{ roleArn: 'arn:aws:iam::999999999999:role/other' },
    { bucket: 'public.example.com' }, { siteId: '../other' }, { intentId: '../other' },
    { sourceAccessKeyId: '' }, { expectedBucketOwner: '123' }]) {
    await assert.rejects(assumeKycIndiaUploadRole({ ...input, ...change }, fetcher, testClock),
      /KYC_INDIA_STS_INVALID/);
  }
  assert.equal(calls, 0);
  await assert.rejects(assumeKycIndiaUploadRole(input, fetcher, testClock), /KYC_INDIA_STS_UNAVAILABLE/);
  assert.equal(calls, 1);
});

test('STS issuer rejects a successful response with expired or duplicated credentials', async () => {
  for (const xml of [
    '<AssumeRoleResponse><AssumeRoleResult><Credentials><AccessKeyId>ASIATEMPORARY12345678</AccessKeyId><SecretAccessKey>synthetic-temporary-secret-123456</SecretAccessKey><SessionToken>syntheticTempSession1234567890==</SessionToken><Expiration>2026-11-01T02:04:04Z</Expiration></Credentials></AssumeRoleResult></AssumeRoleResponse>',
    '<AssumeRoleResponse><AssumeRoleResult><Credentials><AccessKeyId>ASIATEMPORARY12345678</AccessKeyId><AccessKeyId>ASIAOTHER12345678</AccessKeyId><SecretAccessKey>synthetic-temporary-secret-123456</SecretAccessKey><SessionToken>syntheticTempSession1234567890==</SessionToken><Expiration>2026-11-01T02:18:04Z</Expiration></Credentials></AssumeRoleResult></AssumeRoleResponse>',
  ]) {
    const fetcher = (async () => new Response(xml, { status: 200,
      headers: { 'content-type': 'text/xml' } })) as typeof fetch;
    await assert.rejects(assumeKycIndiaUploadRole(input, fetcher, testClock),
      /KYC_INDIA_STS_UNAVAILABLE/);
  }
});
