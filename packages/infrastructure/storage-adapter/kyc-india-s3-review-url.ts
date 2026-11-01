import { kycIndiaHex, signKycIndiaS3String } from './kyc-india-sigv4';
import type { KycIndiaContentType } from './kyc-india-s3-post';

/** A short-lived, version-specific reviewer download ticket; no object bytes enter the Gateway. */
export interface KycIndiaS3ReviewUrlInput {
  siteId: string;
  documentType: 'business_pan' | 'gst_certificate' | 'bank_proof' | 'address_proof' | 'identity_proof';
  receiptId: string;
  versionId: string;
  bucket: string;
  region: 'ap-south-1';
  contentType: KycIndiaContentType;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  expiresInSeconds?: number;
}

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const BUCKET = /^(?=.{3,63}$)[a-z0-9](?:[a-z0-9-]*[a-z0-9])$/;

function encode(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g,
    char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function invalid(): never { throw new Error('KYC_INDIA_REVIEW_URL_INVALID'); }

export async function signKycIndiaS3ReviewUrl(
  input: KycIndiaS3ReviewUrlInput,
  clock: () => Date = () => new Date(),
): Promise<string> {
  const ttl = input.expiresInSeconds ?? 30;
  if (!UUID.test(input.siteId) || !UUID.test(input.receiptId)
    || !['business_pan', 'gst_certificate', 'bank_proof', 'address_proof', 'identity_proof'].includes(input.documentType)
    || !BUCKET.test(input.bucket) || input.region !== 'ap-south-1'
    || !['application/pdf', 'image/jpeg', 'image/png'].includes(input.contentType)
    || !/^[A-Z0-9]{12,64}$/.test(input.accessKeyId)
    || !input.secretAccessKey || input.secretAccessKey.length < 16
    || input.sessionToken !== undefined && (!input.sessionToken || input.sessionToken.length > 4096)
    || !input.versionId || input.versionId === 'null' || input.versionId.length > 1024
    || /[\u0000-\u001f\u007f]/.test(input.versionId)
    || !Number.isSafeInteger(ttl) || ttl < 10 || ttl > 60) invalid();
  const now = clock();
  if (!Number.isFinite(now.getTime())) invalid();
  const amzDate = now.toISOString().replace(/[-:]|\.\d{3}/g, '');
  const date = amzDate.slice(0, 8);
  const scope = `${date}/ap-south-1/s3/aws4_request`;
  const extension = input.contentType === 'application/pdf' ? 'pdf'
    : input.contentType === 'image/jpeg' ? 'jpg' : 'png';
  const host = `${input.bucket}.s3.ap-south-1.amazonaws.com`;
  const path = `/kyc/${input.siteId}/${input.documentType}/${input.receiptId}`;
  const parameters: Record<string, string> = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${input.accessKeyId}/${scope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(ttl),
    'X-Amz-SignedHeaders': 'host',
    'response-cache-control': 'private, no-store, max-age=0',
    'response-content-disposition': `attachment; filename="kyc-evidence.${extension}"`,
    'response-content-type': input.contentType,
    versionId: input.versionId,
  };
  if (input.sessionToken) parameters['X-Amz-Security-Token'] = input.sessionToken;
  const query = Object.entries(parameters).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([name, value]) => `${encode(name)}=${encode(value)}`).join('&');
  const canonicalRequest = `GET\n${path}\n${query}\nhost:${host}\n\nhost\nUNSIGNED-PAYLOAD`;
  const canonicalHash = kycIndiaHex(new Uint8Array(await crypto.subtle.digest('SHA-256',
    new TextEncoder().encode(canonicalRequest))));
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${canonicalHash}`;
  const signature = await signKycIndiaS3String(input.secretAccessKey, date, stringToSign);
  return `https://${host}${path}?${query}&X-Amz-Signature=${signature}`;
}
