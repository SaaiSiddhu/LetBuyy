import assert from 'node:assert/strict';
import test from 'node:test';
import { parseKycIndiaGuardDutyEvent } from './kyc-india-guardduty-event';

const siteId = 'd7194463-3cdb-4e2a-850b-cb048986adad';
const receiptId = '2c73a536-4dc4-4df1-92d4-89d0c8b51d99';
const eventId = '9534cff7-e4d2-4329-9455-a487946e47c9';
const expected = {
  accountId: '123456789012', bucket: 'private-kyc-mumbai',
  planArn: 'arn:aws:guardduty:ap-south-1:123456789012:malware-protection-plan/plan123',
};
const event = () => ({
  id: eventId, source: 'aws.guardduty',
  'detail-type': 'GuardDuty Malware Protection Object Scan Result',
  account: expected.accountId, region: 'ap-south-1', time: '2026-11-01T12:00:00Z',
  resources: [expected.planArn],
  detail: {
    schemaVersion: '1.0', scanStatus: 'COMPLETED', resourceType: 'S3_OBJECT',
    s3ObjectDetails: {
      bucketName: expected.bucket,
      objectKey: `kyc/${siteId}/business_pan/${receiptId}`,
      versionId: 'synthetic-version+1',
    },
    scanResultDetails: { scanResultStatus: 'NO_THREATS_FOUND' },
  },
});

test('GuardDuty shape binds exact account, Mumbai plan, bucket, key and version', () => {
  assert.deepEqual(parseKycIndiaGuardDutyEvent(event(), expected), {
    eventId, siteId, documentType: 'business_pan', receiptId,
    objectKey: `kyc/${siteId}/business_pan/${receiptId}`,
    versionId: 'synthetic-version+1', verdict: 'clean', scannedAt: '2026-11-01T12:00:00Z',
  });
  for (const [status, scan, verdict] of [
    ['COMPLETED', 'THREATS_FOUND', 'rejected'],
    ['SKIPPED', 'NO_THREATS_FOUND', 'blocked'],
    ['FAILED', 'NO_THREATS_FOUND', 'blocked'],
    ['COMPLETED', 'UNSUPPORTED', 'blocked'],
    ['COMPLETED', 'ACCESS_DENIED', 'blocked'],
  ] as const) {
    const value = event();
    value.detail.scanStatus = status;
    value.detail.scanResultDetails.scanResultStatus = scan;
    assert.equal(parseKycIndiaGuardDutyEvent(value, expected).verdict, verdict);
  }
  const failedWithoutDetails = event();
  failedWithoutDetails.detail.scanStatus = 'FAILED';
  (failedWithoutDetails.detail as { scanResultDetails?: unknown }).scanResultDetails = undefined;
  assert.equal(parseKycIndiaGuardDutyEvent(failedWithoutDetails, expected).verdict, 'blocked');
});

test('malformed or cross-bound scan events cannot upgrade a document', () => {
  const mutations: Array<(value: ReturnType<typeof event>) => void> = [
    v => { v.account = '999999999999'; },
    v => { v.region = 'us-east-1'; },
    v => { v.resources = ['arn:aws:guardduty:ap-south-1:123456789012:malware-protection-plan/other']; },
    v => { v.detail.s3ObjectDetails.bucketName = 'other'; },
    v => { v.detail.s3ObjectDetails.objectKey = `kyc/${siteId}/business_pan/other`; },
    v => { v.detail.s3ObjectDetails.objectKey = `kyc/${siteId}/../${receiptId}`; },
    v => { v.detail.s3ObjectDetails.versionId = 'null'; },
    v => { v.detail.scanResultDetails.scanResultStatus = 'UNKNOWN'; },
    v => { v.source = 'untrusted'; },
  ];
  for (const mutate of mutations) {
    const value = event();
    mutate(value);
    assert.throws(() => parseKycIndiaGuardDutyEvent(value, expected), /KYC_INDIA_SCAN_EVENT_INVALID/);
  }
});
