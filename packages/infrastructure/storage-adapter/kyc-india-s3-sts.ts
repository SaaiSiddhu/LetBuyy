/** Backend-only AWS STS issuer for one direct-to-Mumbai KYC upload key. */
export interface KycIndiaUploadRoleInput {
  siteId: string;
  documentType: 'business_pan' | 'gst_certificate' | 'bank_proof' | 'address_proof' | 'identity_proof';
  intentId: string;
  bucket: string;
  expectedBucketOwner: string;
  roleArn: string;
  sourceAccessKeyId: string;
  sourceSecretAccessKey: string;
  sourceSessionToken?: string;
}

export interface KycIndiaUploadCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  expiresAt: string;
  objectKey: string;
}

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const BUCKET = /^(?=.{3,63}$)[a-z0-9](?:[a-z0-9-]*[a-z0-9])$/;

function invalid(): never { throw new Error('KYC_INDIA_STS_INVALID'); }
function unavailable(): never { throw new Error('KYC_INDIA_STS_UNAVAILABLE'); }

async function hmac(key: Uint8Array, value: string): Promise<Uint8Array> {
  const imported = await crypto.subtle.importKey('raw', key as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', imported, new TextEncoder().encode(value)));
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

function oneXmlField(xml: string, tag: string): string {
  const values = [...xml.matchAll(new RegExp(`<${tag}>([^<]{1,4096})<\\/${tag}>`, 'g'))];
  if (values.length !== 1) unavailable();
  const value = values[0][1].trim();
  if (!value || value.includes('&')) unavailable();
  return value;
}

export function kycIndiaUploadSessionPolicy(bucket: string, objectKey: string): string {
  if (!BUCKET.test(bucket) || !/^kyc\/[a-f0-9-]{36}\/(business_pan|gst_certificate|bank_proof|address_proof|identity_proof)\/[a-f0-9-]{36}$/.test(objectKey)) invalid();
  return JSON.stringify({
    Version: '2012-10-17',
    Statement: [{ Effect: 'Allow', Action: 's3:PutObject',
      Resource: `arn:aws:s3:::${bucket}/${objectKey}`,
      Condition: { StringEquals: { 's3:x-amz-server-side-encryption': 'AES256' } } }],
  });
}

export async function assumeKycIndiaUploadRole(
  input: KycIndiaUploadRoleInput,
  fetcher: typeof fetch = fetch,
  clock: () => Date = () => new Date(),
): Promise<KycIndiaUploadCredentials> {
  if (!UUID.test(input.siteId) || !UUID.test(input.intentId)
    || !['business_pan', 'gst_certificate', 'bank_proof', 'address_proof', 'identity_proof'].includes(input.documentType)
    || !BUCKET.test(input.bucket) || !/^\d{12}$/.test(input.expectedBucketOwner)
    || !new RegExp(`^arn:aws:iam::${input.expectedBucketOwner}:role\\/[A-Za-z0-9_+=,.@\\/-]{1,256}$`).test(input.roleArn)
    || !/^[A-Z0-9]{12,64}$/.test(input.sourceAccessKeyId)
    || typeof input.sourceSecretAccessKey !== 'string' || input.sourceSecretAccessKey.length < 16
    || input.sourceSessionToken !== undefined && (!input.sourceSessionToken || input.sourceSessionToken.length > 4096)) invalid();
  const now = clock();
  if (!Number.isFinite(now.getTime())) invalid();
  const amzDate = now.toISOString().replace(/[-:]|\.\d{3}/g, '');
  const date = amzDate.slice(0, 8);
  const objectKey = `kyc/${input.siteId}/${input.documentType}/${input.intentId}`;
  const policy = kycIndiaUploadSessionPolicy(input.bucket, objectKey);
  const body = new URLSearchParams({ Action: 'AssumeRole', Version: '2011-06-15',
    RoleArn: input.roleArn, RoleSessionName: `kyc-${input.intentId}`, DurationSeconds: '900', Policy: policy }).toString();
  const payloadHash = hex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body))));
  const host = 'sts.ap-south-1.amazonaws.com';
  const headers: Record<string, string> = { host,
    'content-type': 'application/x-www-form-urlencoded; charset=utf-8',
    'x-amz-content-sha256': payloadHash, 'x-amz-date': amzDate };
  if (input.sourceSessionToken) headers['x-amz-security-token'] = input.sourceSessionToken;
  const signedHeaders = Object.keys(headers).sort().join(';');
  const canonicalHeaders = Object.keys(headers).sort().map(name => `${name}:${headers[name]}\n`).join('');
  const canonical = `POST\n/\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
  const canonicalHash = hex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical))));
  const scope = `${date}/ap-south-1/sts/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${canonicalHash}`;
  let key = await hmac(new TextEncoder().encode(`AWS4${input.sourceSecretAccessKey}`), date);
  for (const part of ['ap-south-1', 'sts', 'aws4_request']) key = await hmac(key, part);
  const signature = hex(await hmac(key, stringToSign));
  const { host: _canonicalHost, ...requestHeaders } = headers;
  requestHeaders.authorization = `AWS4-HMAC-SHA256 Credential=${input.sourceAccessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const response = await fetcher(`https://${host}/`, { method: 'POST', headers: requestHeaders,
    body, redirect: 'manual', signal: AbortSignal.timeout(5000) });
  if (response.status !== 200 || !response.headers.get('content-type')?.toLowerCase().includes('xml')) unavailable();
  const contentLength = response.headers.get('content-length');
  if (contentLength && Number(contentLength) > 65536) unavailable();
  const xml = await response.text();
  if (xml.length > 65536 || !/<AssumeRoleResponse\b/.test(xml)
    || !/<AssumeRoleResult>/.test(xml) || !/<Credentials>/.test(xml)) unavailable();
  const accessKeyId = oneXmlField(xml, 'AccessKeyId');
  const secretAccessKey = oneXmlField(xml, 'SecretAccessKey');
  const sessionToken = oneXmlField(xml, 'SessionToken');
  const expiresAt = oneXmlField(xml, 'Expiration');
  const expiration = Date.parse(expiresAt);
  if (!/^[A-Z0-9]{12,64}$/.test(accessKeyId)
    || secretAccessKey.length < 16 || !/^[A-Za-z0-9/+=]{8,4096}$/.test(sessionToken)
    || !Number.isFinite(expiration) || expiration < now.getTime() + 10 * 60_000
    || expiration > now.getTime() + 20 * 60_000) unavailable();
  return { accessKeyId, secretAccessKey, sessionToken, expiresAt, objectKey };
}
