import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';
import test from 'node:test';
import { signKycIndiaS3ReviewUrl, type KycIndiaS3ReviewUrlInput } from './kyc-india-s3-review-url';

const input: KycIndiaS3ReviewUrlInput = {
  siteId: 'd7194463-3cdb-4e2a-850b-cb048986adad',
  documentType: 'business_pan', receiptId: '2c73a536-4dc4-4df1-92d4-89d0c8b51d99',
  versionId: 'opaque/version+1', bucket: 'private-kyc-mumbai', region: 'ap-south-1',
  contentType: 'application/pdf', accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
  secretAccessKey: 'synthetic-secret-for-test-only', sessionToken: 'synthetic-token',
};
const at = () => new Date('2026-11-01T12:00:00.000Z');

test('review URL signs one exact Mumbai object version for thirty seconds', async () => {
  const signed = new URL(await signKycIndiaS3ReviewUrl(input, at));
  assert.equal(signed.origin, 'https://private-kyc-mumbai.s3.ap-south-1.amazonaws.com');
  assert.equal(signed.pathname,
    '/kyc/d7194463-3cdb-4e2a-850b-cb048986adad/business_pan/2c73a536-4dc4-4df1-92d4-89d0c8b51d99');
  assert.equal(signed.searchParams.get('versionId'), input.versionId);
  assert.equal(signed.searchParams.get('X-Amz-Expires'), '30');
  assert.equal(signed.searchParams.get('response-content-disposition'), 'attachment; filename="kyc-evidence.pdf"');
  assert.equal(signed.searchParams.get('response-cache-control'), 'private, no-store, max-age=0');
  assert.equal(signed.searchParams.get('X-Amz-Security-Token'), input.sessionToken);
  const signature = signed.searchParams.get('X-Amz-Signature');
  assert.match(signature || '', /^[a-f0-9]{64}$/);
  const query = signed.search.slice(1).replace(/&X-Amz-Signature=[a-f0-9]{64}$/, '');
  const canonical = `GET\n${signed.pathname}\n${query}\nhost:${signed.host}\n\nhost\nUNSIGNED-PAYLOAD`;
  const scope = '20261101/ap-south-1/s3/aws4_request';
  const toSign = `AWS4-HMAC-SHA256\n20261101T120000Z\n${scope}\n${createHash('sha256').update(canonical).digest('hex')}`;
  let key: Buffer = Buffer.from(`AWS4${input.secretAccessKey}`);
  for (const part of ['20261101', 'ap-south-1', 's3', 'aws4_request']) {
    key = createHmac('sha256', key).update(part).digest();
  }
  assert.equal(signature, createHmac('sha256', key).update(toSign).digest('hex'));
  assert.ok(!signed.href.includes(input.secretAccessKey), 'the signing secret never enters the URL');
});

test('review URL refuses scope and version ambiguity', async () => {
  for (const changed of [
    { ...input, region: 'us-east-1' as 'ap-south-1' },
    { ...input, bucket: 'private.kyc' },
    { ...input, siteId: 'other' },
    { ...input, versionId: 'null' },
    { ...input, versionId: 'opaque\nversion' },
    { ...input, contentType: 'text/html' as 'application/pdf' },
    { ...input, expiresInSeconds: 3600 },
  ]) {
    await assert.rejects(signKycIndiaS3ReviewUrl(changed, at), /KYC_INDIA_REVIEW_URL_INVALID/);
  }
});
