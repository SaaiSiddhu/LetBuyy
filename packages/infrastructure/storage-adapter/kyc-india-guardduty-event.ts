/** Shape validation only. The caller must authenticate the AWS delivery channel. */
export interface KycIndiaGuardDutyExpectation {
  accountId: string;
  bucket: string;
  planArn: string;
}

export interface KycIndiaScanResult {
  eventId: string;
  siteId: string;
  documentType: 'business_pan' | 'gst_certificate' | 'bank_proof' | 'address_proof' | 'identity_proof';
  receiptId: string;
  objectKey: string;
  versionId: string;
  verdict: 'clean' | 'rejected' | 'blocked';
  scannedAt: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACCOUNT = /^[0-9]{12}$/;
const TYPES = ['business_pan', 'gst_certificate', 'bank_proof', 'address_proof', 'identity_proof'] as const;

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('KYC_INDIA_SCAN_EVENT_INVALID');
  return value as Record<string, unknown>;
}

/** Never interpret this parser's output as proof of an authenticated AWS event. */
export function parseKycIndiaGuardDutyEvent(raw: unknown, expected: KycIndiaGuardDutyExpectation): KycIndiaScanResult {
  const event = record(raw);
  const detail = record(event.detail);
  const object = record(detail.s3ObjectDetails);
  const result = detail.scanResultDetails === undefined ? {} : record(detail.scanResultDetails);
  const planArn = `arn:aws:guardduty:ap-south-1:${expected.accountId}:malware-protection-plan/`;
  const key = object.objectKey;
  const parts = typeof key === 'string' ? key.split('/') : [];
  const version = object.versionId;
  const status = detail.scanStatus;
  const scan = result.scanResultStatus;
  const time = event.time;
  const resources = event.resources;
  if (!ACCOUNT.test(expected.accountId) || !expected.bucket
    || !expected.planArn.startsWith(planArn) || expected.planArn.length <= planArn.length
    || event.source !== 'aws.guardduty'
    || event['detail-type'] !== 'GuardDuty Malware Protection Object Scan Result'
    || event.account !== expected.accountId || event.region !== 'ap-south-1'
    || !UUID.test(String(event.id || ''))
    || !Array.isArray(resources) || resources.length !== 1 || resources[0] !== expected.planArn
    || detail.schemaVersion !== '1.0' || detail.resourceType !== 'S3_OBJECT'
    || object.bucketName !== expected.bucket
    || parts.length !== 4 || parts[0] !== 'kyc' || !UUID.test(parts[1] || '')
    || !TYPES.includes(parts[2] as typeof TYPES[number]) || !UUID.test(parts[3] || '')
    || typeof version !== 'string' || !version || version === 'null'
    || version.length > 1024 || /[\u0000-\u001f\u007f]/.test(version)
    || typeof time !== 'string' || !Number.isFinite(Date.parse(time))
    || !['COMPLETED', 'SKIPPED', 'FAILED'].includes(String(status))
    || (scan !== undefined && !['NO_THREATS_FOUND', 'THREATS_FOUND', 'UNSUPPORTED', 'ACCESS_DENIED', 'FAILED'].includes(String(scan)))
    || (status === 'COMPLETED' && scan === undefined)) {
    throw new Error('KYC_INDIA_SCAN_EVENT_INVALID');
  }
  const verdict = status === 'COMPLETED' && scan === 'NO_THREATS_FOUND' ? 'clean'
    : status === 'COMPLETED' && scan === 'THREATS_FOUND' ? 'rejected' : 'blocked';
  return {
    eventId: String(event.id), siteId: parts[1]!, documentType: parts[2] as KycIndiaScanResult['documentType'],
    receiptId: parts[3]!, objectKey: key as string, versionId: version,
    verdict, scannedAt: time,
  };
}
