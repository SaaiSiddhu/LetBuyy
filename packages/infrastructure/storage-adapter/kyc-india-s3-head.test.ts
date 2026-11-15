import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyKycIndiaS3Head, type KycIndiaS3HeadExpectation } from './kyc-india-s3-head';

const expected: KycIndiaS3HeadExpectation = {
  versionId: 'synthetic/version+1',
  expectedBytes: 1234,
  contentType: 'application/pdf',
  sha256Hex: 'a'.repeat(64),
};

function headResponse(headers: Record<string, string> = {}, status = 200): Response {
  return new Response(null, {
    status,
    headers: {
      'x-amz-version-id': expected.versionId,
      'content-length': String(expected.expectedBytes),
      'content-type': expected.contentType,
      'x-amz-checksum-sha256': Buffer.from('aa'.repeat(32), 'hex').toString('base64'),
      'x-amz-server-side-encryption': 'AES256',
      ...headers,
    },
  });
}

test('India KYC completion accepts only exact versioned HEAD metadata', () => {
  assert.deepEqual(verifyKycIndiaS3Head(expected, headResponse()), {
    versionId: expected.versionId,
    byteSize: expected.expectedBytes,
    contentType: expected.contentType,
    sha256Hex: expected.sha256Hex,
    encryption: 'AES256',
  });
});

test('India KYC completion rejects wrong or incomplete object metadata', () => {
  const cases: Array<[Record<string, string>, number]> = [
    [{ 'x-amz-version-id': 'later-overwrite' }, 200],
    [{ 'x-amz-version-id': 'null' }, 200],
    [{ 'content-length': '1235' }, 200],
    [{ 'content-length': 'not-a-number' }, 200],
    [{ 'content-type': 'text/html' }, 200],
    [{ 'x-amz-checksum-sha256': Buffer.from('bb'.repeat(32), 'hex').toString('base64') }, 200],
    [{ 'x-amz-server-side-encryption': 'aws:kms' }, 200],
    [{ 'x-amz-replication-status': 'PENDING' }, 200],
    [{}, 404],
  ];
  for (const [headers, status] of cases) {
    assert.throws(() => verifyKycIndiaS3Head(expected, headResponse(headers, status)),
      /KYC_INDIA_S3_HEAD_INVALID/, JSON.stringify({ headers, status }));
  }
  for (const header of ['x-amz-version-id', 'content-length', 'content-type',
    'x-amz-checksum-sha256', 'x-amz-server-side-encryption']) {
    const response = headResponse();
    response.headers.delete(header);
    assert.throws(() => verifyKycIndiaS3Head(expected, response),
      /KYC_INDIA_S3_HEAD_INVALID/, `missing ${header}`);
  }
  assert.throws(() => verifyKycIndiaS3Head({ ...expected, versionId: 'null' }, headResponse()),
    /KYC_INDIA_S3_HEAD_INVALID/);
});
