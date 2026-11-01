import { verifyKycIndiaS3Head, type KycIndiaS3HeadExpectation,
  type KycIndiaS3VerifiedObject } from './kyc-india-s3-head';
import { kycIndiaHex, signKycIndiaS3String } from './kyc-india-sigv4';

/** Backend-only, version-pinned S3 HEAD. Credentials must never reach a browser. */
export interface KycIndiaS3HeadRequest extends KycIndiaS3HeadExpectation {
  siteId: string;
  documentType: 'business_pan' | 'gst_certificate' | 'bank_proof' | 'address_proof' | 'identity_proof';
  intentId: string;
  bucket: string;
  expectedBucketOwner: string;
  region: 'ap-south-1';
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
}

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const BUCKET = /^(?=.{3,63}$)[a-z0-9](?:[a-z0-9-]*[a-z0-9])$/;
const EMPTY_SHA256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

function invalid(): never { throw new Error('KYC_INDIA_S3_HEAD_REQUEST_INVALID'); }

export async function headKycIndiaS3Object(
  input: KycIndiaS3HeadRequest,
  fetcher: typeof fetch = fetch,
  clock: () => Date = () => new Date(),
): Promise<KycIndiaS3VerifiedObject> {
  if (!UUID.test(input.siteId) || !UUID.test(input.intentId)
    || !['business_pan', 'gst_certificate', 'bank_proof', 'address_proof', 'identity_proof'].includes(input.documentType)
    || !BUCKET.test(input.bucket) || input.region !== 'ap-south-1'
    || !/^\d{12}$/.test(input.expectedBucketOwner)
    || !/^[A-Z0-9]{12,64}$/.test(input.accessKeyId)
    || typeof input.secretAccessKey !== 'string' || input.secretAccessKey.length < 16
    || input.sessionToken !== undefined && (!input.sessionToken || input.sessionToken.length > 4096)
    || !input.versionId || input.versionId === 'null' || input.versionId.length > 1024
    || /[\u0000-\u001f\u007f]/.test(input.versionId)) invalid();

  const now = clock();
  if (!Number.isFinite(now.getTime())) invalid();
  const amzDate = now.toISOString().replace(/[-:]|\.\d{3}/g, '');
  const date = amzDate.slice(0, 8);
  const host = `${input.bucket}.s3.ap-south-1.amazonaws.com`;
  const objectKey = `kyc/${input.siteId}/${input.documentType}/${input.intentId}`;
  const path = `/${objectKey}`;
  const query = `versionId=${encodeURIComponent(input.versionId).replace(/[!'()*]/g,
    char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)}`;
  const headers: Record<string, string> = {
    host,
    'x-amz-checksum-mode': 'ENABLED',
    'x-amz-content-sha256': EMPTY_SHA256,
    'x-amz-date': amzDate,
    'x-amz-expected-bucket-owner': input.expectedBucketOwner,
  };
  if (input.sessionToken) headers['x-amz-security-token'] = input.sessionToken;
  const signedHeaders = Object.keys(headers).sort().join(';');
  const canonicalHeaders = Object.keys(headers).sort().map(name => `${name}:${headers[name]}\n`).join('');
  const canonicalRequest = `HEAD\n${path}\n${query}\n${canonicalHeaders}\n${signedHeaders}\n${EMPTY_SHA256}`;
  const canonicalHash = kycIndiaHex(new Uint8Array(await crypto.subtle.digest('SHA-256',
    new TextEncoder().encode(canonicalRequest))));
  const scope = `${date}/ap-south-1/s3/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${canonicalHash}`;
  headers.authorization = `AWS4-HMAC-SHA256 Credential=${input.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${await signKycIndiaS3String(input.secretAccessKey, date, stringToSign)}`;

  const { host: _canonicalHost, ...requestHeaders } = headers;
  const response = await fetcher(`https://${host}${path}?${query}`, {
    method: 'HEAD', headers: requestHeaders, redirect: 'manual', signal: AbortSignal.timeout(5000),
  });
  if (response.status >= 500) throw new Error('KYC_INDIA_S3_HEAD_UNAVAILABLE');
  return verifyKycIndiaS3Head(input, response);
}
