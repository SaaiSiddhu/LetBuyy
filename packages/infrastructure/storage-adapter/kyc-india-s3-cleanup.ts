import { SaxesParser } from 'saxes';
import { kycIndiaHex, signKycIndiaS3String } from './kyc-india-sigv4';

/** Server-only candidate for removing every S3 version of an unreferenced KYC key. */
export interface KycIndiaS3CleanupInput {
  siteId: string;
  documentType: 'business_pan' | 'gst_certificate' | 'bank_proof' | 'address_proof' | 'identity_proof';
  receiptId: string;
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

function invalid(): never { throw new Error('KYC_INDIA_S3_CLEANUP_INVALID'); }
function unavailable(): never { throw new Error('KYC_INDIA_S3_CLEANUP_UNAVAILABLE'); }
function encode(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g,
    char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}
function validVersion(value: string): boolean {
  return value !== 'null' && value.length > 0 && value.length <= 1024
    && !/[\u0000-\u001f\u007f]/.test(value);
}

function parseVersions(xml: string, expectedKey: string): { versions: string[]; truncated: boolean } {
  if (xml.length > 131_072) unavailable();
  const versions: string[] = [];
  let truncated: boolean | undefined;
  const stack: string[] = [];
  let key = '';
  let version = '';
  let field = '';
  const parser = new SaxesParser();
  parser.on('doctype', invalid);
  parser.on('error', unavailable);
  parser.on('opentag', tag => {
    stack.push(tag.name);
    field = '';
    if (stack.length > 5) invalid();
    if (stack.length === 2 && (tag.name === 'Version' || tag.name === 'DeleteMarker')) {
      key = '';
      version = '';
    }
  });
  parser.on('text', value => { field += value; });
  parser.on('closetag', tag => {
    const path = stack.join('/');
    if (path === 'ListVersionsResult/IsTruncated') {
      if (field !== 'true' && field !== 'false') invalid();
      truncated = field === 'true';
    }
    if (path === 'ListVersionsResult/Version/Key'
      || path === 'ListVersionsResult/DeleteMarker/Key') key = field;
    if (path === 'ListVersionsResult/Version/VersionId'
      || path === 'ListVersionsResult/DeleteMarker/VersionId') version = field;
    if (stack.length === 2 && (tag.name === 'Version' || tag.name === 'DeleteMarker')) {
      if (key !== expectedKey || !validVersion(version) || versions.length >= 50) invalid();
      versions.push(version);
    }
    stack.pop();
    field = '';
  });
  try { parser.write(xml).close(); } catch { unavailable(); }
  if (truncated === undefined || stack.length !== 0 || truncated && versions.length === 0) unavailable();
  return { versions, truncated };
}

async function signedRequest(input: KycIndiaS3CleanupInput, method: 'GET' | 'DELETE',
  path: string, query: string, fetcher: typeof fetch, clock: () => Date): Promise<Response> {
  const now = clock();
  if (!Number.isFinite(now.getTime())) invalid();
  const amzDate = now.toISOString().replace(/[-:]|\.\d{3}/g, '');
  const date = amzDate.slice(0, 8);
  const host = `${input.bucket}.s3.ap-south-1.amazonaws.com`;
  const headers: Record<string, string> = {
    host,
    'x-amz-content-sha256': EMPTY_SHA256,
    'x-amz-date': amzDate,
    'x-amz-expected-bucket-owner': input.expectedBucketOwner,
  };
  if (input.sessionToken) headers['x-amz-security-token'] = input.sessionToken;
  const signedHeaders = Object.keys(headers).sort().join(';');
  const canonicalHeaders = Object.keys(headers).sort().map(name => `${name}:${headers[name]}\n`).join('');
  const canonicalRequest = `${method}\n${path}\n${query}\n${canonicalHeaders}\n${signedHeaders}\n${EMPTY_SHA256}`;
  const canonicalHash = kycIndiaHex(new Uint8Array(await crypto.subtle.digest('SHA-256',
    new TextEncoder().encode(canonicalRequest))));
  const scope = `${date}/ap-south-1/s3/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${canonicalHash}`;
  headers.authorization = `AWS4-HMAC-SHA256 Credential=${input.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${await signKycIndiaS3String(input.secretAccessKey, date, stringToSign)}`;
  const { host: _host, ...requestHeaders } = headers;
  return fetcher(`https://${host}${path}?${query}`, {
    method, headers: requestHeaders, redirect: 'manual', signal: AbortSignal.timeout(5000),
  });
}

/** One bounded pass; caller must retry until `remaining` is false before closing its receipt. */
export async function cleanupKycIndiaS3ObjectVersions(input: KycIndiaS3CleanupInput,
  fetcher: typeof fetch = fetch, clock: () => Date = () => new Date()): Promise<{
    deleted: number; remaining: boolean;
  }> {
  if (!UUID.test(input.siteId) || !UUID.test(input.receiptId)
    || !['business_pan', 'gst_certificate', 'bank_proof', 'address_proof', 'identity_proof'].includes(input.documentType)
    || !BUCKET.test(input.bucket) || input.region !== 'ap-south-1'
    || !/^\d{12}$/.test(input.expectedBucketOwner)
    || !/^[A-Z0-9]{12,64}$/.test(input.accessKeyId)
    || typeof input.secretAccessKey !== 'string' || input.secretAccessKey.length < 16
    || input.sessionToken !== undefined && (!input.sessionToken || input.sessionToken.length > 4096)) invalid();
  const key = `kyc/${input.siteId}/${input.documentType}/${input.receiptId}`;
  const listQuery = `max-keys=50&prefix=${encode(key)}&versions=`;
  const list = async () => {
    const response = await signedRequest(input, 'GET', '/', listQuery, fetcher, clock);
    if (response.status !== 200 || (Number(response.headers.get('content-length')) || 0) > 131_072) unavailable();
    return parseVersions(await response.text(), key);
  };
  const first = await list();
  for (const version of first.versions) {
    const response = await signedRequest(input, 'DELETE', `/${key}`,
      `versionId=${encode(version)}`, fetcher, clock);
    if (response.status !== 204) unavailable();
    const returnedVersion = response.headers.get('x-amz-version-id');
    if (returnedVersion && returnedVersion !== version) unavailable();
  }
  const after = first.versions.length > 0 ? await list() : first;
  return { deleted: first.versions.length,
    remaining: after.versions.length > 0 || after.truncated };
}
