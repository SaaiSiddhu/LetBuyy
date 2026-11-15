/**
 * Candidate S3 completion check for India-resident KYC evidence. The caller must
 * make an authenticated HEAD request for this exact object version against the
 * approved Mumbai bucket, with checksum mode ENABLED and expected bucket owner.
 * This function does not authenticate a network response or open document intake.
 */
import type { KycIndiaContentType } from './kyc-india-s3-post';

export interface KycIndiaS3HeadExpectation {
  versionId: string;
  expectedBytes: number;
  contentType: KycIndiaContentType;
  sha256Hex: string;
}

export interface KycIndiaS3VerifiedObject {
  versionId: string;
  byteSize: number;
  contentType: KycIndiaContentType;
  sha256Hex: string;
  encryption: 'AES256';
}

const MAX_BYTES = 5 * 1024 * 1024;
const SHA256_HEX = /^[0-9a-f]{64}$/i;

function invalid(): never {
  throw new Error('KYC_INDIA_S3_HEAD_INVALID');
}

export function verifyKycIndiaS3Head(
  expected: KycIndiaS3HeadExpectation,
  response: Response,
): KycIndiaS3VerifiedObject {
  if (response.status !== 200
    || !Number.isSafeInteger(expected.expectedBytes)
    || expected.expectedBytes < 1 || expected.expectedBytes > MAX_BYTES
    || !['application/pdf', 'image/jpeg', 'image/png'].includes(expected.contentType)
    || !SHA256_HEX.test(expected.sha256Hex)
    || !expected.versionId || expected.versionId === 'null'
    || expected.versionId.length > 1024 || /[\u0000-\u001f\u007f]/.test(expected.versionId)) invalid();

  const versionId = response.headers.get('x-amz-version-id');
  const contentLength = response.headers.get('content-length');
  const byteSize = contentLength === null ? NaN : Number(contentLength);
  const contentType = response.headers.get('content-type');
  const checksum = response.headers.get('x-amz-checksum-sha256');
  const encryption = response.headers.get('x-amz-server-side-encryption');
  const replication = response.headers.get('x-amz-replication-status');
  const expectedChecksum = btoa(Array.from(
    Uint8Array.from(expected.sha256Hex.match(/../g)!, part => Number.parseInt(part, 16)),
    byte => String.fromCharCode(byte),
  ).join(''));

  if (versionId !== expected.versionId || !Number.isSafeInteger(byteSize)
    || byteSize !== expected.expectedBytes || byteSize < 1 || byteSize > MAX_BYTES
    || contentType !== expected.contentType || checksum !== expectedChecksum
    || encryption !== 'AES256' || replication !== null) invalid();

  return {
    versionId,
    byteSize,
    contentType: expected.contentType,
    sha256Hex: expected.sha256Hex.toLowerCase(),
    encryption: 'AES256',
  };
}
