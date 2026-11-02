/**
 * Candidate direct-to-S3 KYC upload ticket for the India-only evidence path.
 * This signs a browser POST policy; it does not activate a bucket, scanner, or
 * document intake. The Gateway must first persist a site-bound upload receipt.
 * Completion must HEAD the exact uploaded version and pin that version in the
 * evidence row: a POST policy is reusable until expiry and can overwrite a key.
 */
export type KycIndiaContentType = 'application/pdf' | 'image/jpeg' | 'image/png';

export interface KycIndiaS3PostInput {
  siteId: string;
  documentType: 'business_pan' | 'gst_certificate' | 'bank_proof' | 'address_proof' | 'identity_proof';
  objectId: string;
  bucket: string;
  region: 'ap-south-1';
  accessKeyId: string;
  secretAccessKey: string;
  /** Caller must supply a short-lived, exact-object-scoped STS credential. */
  sessionToken: string;
  contentType: KycIndiaContentType;
  expectedBytes: number;
  sha256Hex: string;
  expiresInSeconds?: number;
}

export interface KycIndiaS3Post {
  method: 'POST';
  url: string;
  fields: Record<string, string>;
  expiresAt: string;
  /** The exact key and object version must remain server-side after completion. */
  objectKey: string;
  maximumObjectBytes: number;
}

const MAX_BYTES = 5 * 1024 * 1024;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const BUCKET = /^(?=.{3,63}$)[a-z0-9](?:[a-z0-9-]*[a-z0-9])$/;
const HEX256 = /^[a-f0-9]{64}$/i;
const ALLOWED_TYPES = new Set<KycIndiaContentType>(['application/pdf', 'image/jpeg', 'image/png']);

function invalid(): never {
  throw new Error('KYC_INDIA_S3_POST_INVALID');
}

function base64(bytes: Uint8Array): string {
  return btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(''));
}

async function hmac(key: Uint8Array, value: string): Promise<Uint8Array> {
  const imported = await crypto.subtle.importKey('raw', key as BufferSource, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', imported, new TextEncoder().encode(value)));
}

async function signature(secret: string, date: string, policy: string): Promise<string> {
  let key = await hmac(new TextEncoder().encode('AWS4' + secret), date);
  key = await hmac(key, 'ap-south-1');
  key = await hmac(key, 's3');
  key = await hmac(key, 'aws4_request');
  return Array.from(await hmac(key, policy), byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function signKycIndiaS3Post(
  input: KycIndiaS3PostInput,
  clock: () => Date = () => new Date(),
): Promise<KycIndiaS3Post> {
  if (!UUID.test(input.siteId) || !UUID.test(input.objectId) || !BUCKET.test(input.bucket)
    || input.region !== 'ap-south-1' || !ALLOWED_TYPES.has(input.contentType)
    || !Number.isSafeInteger(input.expectedBytes) || input.expectedBytes < 1 || input.expectedBytes > MAX_BYTES
    || !HEX256.test(input.sha256Hex)
    || !/^[A-Z0-9]{12,64}$/.test(input.accessKeyId)
    || !input.secretAccessKey || input.secretAccessKey.length < 16
    || !input.sessionToken || input.sessionToken.length > 4096
    || !['business_pan', 'gst_certificate', 'bank_proof', 'address_proof', 'identity_proof'].includes(input.documentType)) invalid();
  const ttl = input.expiresInSeconds ?? 180;
  if (!Number.isSafeInteger(ttl) || ttl < 60 || ttl > 300) invalid();
  const now = clock();
  if (!Number.isFinite(now.getTime())) invalid();
  const expiresAt = new Date(now.getTime() + ttl * 1000).toISOString();
  const dateTime = now.toISOString().replace(/[-:]|\.\d{3}/g, '');
  const date = dateTime.slice(0, 8);
  const credential = `${input.accessKeyId}/${date}/ap-south-1/s3/aws4_request`;
  const objectKey = `kyc/${input.siteId}/${input.documentType}/${input.objectId}`;
  const sha256 = base64(Uint8Array.from(input.sha256Hex.match(/../g)!, part => Number.parseInt(part, 16)));
  const fields: Record<string, string> = {
    key: objectKey,
    'Content-Type': input.contentType,
    'x-amz-checksum-algorithm': 'SHA256',
    'x-amz-checksum-sha256': sha256,
    'x-amz-server-side-encryption': 'AES256',
    success_action_status: '201',
    'x-amz-algorithm': 'AWS4-HMAC-SHA256',
    'x-amz-credential': credential,
    'x-amz-date': dateTime,
  };
  fields['x-amz-security-token'] = input.sessionToken;
  const conditions: unknown[] = [
    { bucket: input.bucket },
    { key: fields.key },
    { 'Content-Type': fields['Content-Type'] },
    ['content-length-range', 1, MAX_BYTES],
    { 'x-amz-checksum-algorithm': fields['x-amz-checksum-algorithm'] },
    { 'x-amz-checksum-sha256': fields['x-amz-checksum-sha256'] },
    { 'x-amz-server-side-encryption': fields['x-amz-server-side-encryption'] },
    { success_action_status: fields.success_action_status },
    { 'x-amz-algorithm': fields['x-amz-algorithm'] },
    { 'x-amz-credential': fields['x-amz-credential'] },
    { 'x-amz-date': fields['x-amz-date'] },
  ];
  conditions.push({ 'x-amz-security-token': input.sessionToken });
  const policy = base64(new TextEncoder().encode(JSON.stringify({ expiration: expiresAt, conditions })));
  fields.policy = policy;
  fields['x-amz-signature'] = await signature(input.secretAccessKey, date, policy);
  return {
    method: 'POST',
    url: `https://${input.bucket}.s3.ap-south-1.amazonaws.com/`,
    fields,
    expiresAt,
    objectKey,
    maximumObjectBytes: MAX_BYTES,
  };
}
