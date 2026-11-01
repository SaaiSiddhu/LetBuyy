import assert from 'node:assert/strict';
import { test } from 'node:test';
import { consumeKycIndiaScanQueue } from '../src/kyc-india-scan-queue.ts';

const site = 'd7194463-3cdb-4e2a-850b-cb048986adad';
const receipt = '2c73a536-4dc4-4df1-92d4-89d0c8b51d99';
const eventId = '9534cff7-e4d2-4329-9455-a487946e47c9';
const plan = 'arn:aws:guardduty:ap-south-1:123456789012:malware-protection-plan/plan123';
const env = {
  ENVIRONMENT: 'test', KYC_INDIA_SCAN_QUEUE_ENABLED: 'true',
  KYC_INDIA_SCAN_QUEUE_URL: 'https://sqs.ap-south-1.amazonaws.com/123456789012/kyc-scan-test',
  KYC_INDIA_ACCOUNT_ID: '123456789012', KYC_INDIA_BUCKET: 'private-kyc-mumbai',
  KYC_INDIA_GUARDDUTY_PLAN_ARN: plan,
  KYC_INDIA_SQS_ACCESS_KEY_ID: 'AKIAIOSFODNN7EXAMPLE',
  KYC_INDIA_SQS_SECRET_ACCESS_KEY: 'synthetic-sqs-secret-for-tests',
  SUPABASE_URL: 'http://127.0.0.1:54321', SUPABASE_SERVICE_ROLE_KEY: 'synthetic',
};
const event = (scan = 'NO_THREATS_FOUND') => ({
  id: eventId, source: 'aws.guardduty',
  'detail-type': 'GuardDuty Malware Protection Object Scan Result',
  account: '123456789012', region: 'ap-south-1', time: '2026-11-01T12:00:00Z',
  resources: [plan],
  detail: { schemaVersion: '1.0', scanStatus: 'COMPLETED', resourceType: 'S3_OBJECT',
    s3ObjectDetails: { bucketName: 'private-kyc-mumbai',
      objectKey: `kyc/${site}/business_pan/${receipt}`, versionId: 'synthetic-version+1' },
    scanResultDetails: { scanResultStatus: scan } },
});
const clock = () => new Date('2026-11-01T12:01:00Z');

test('disabled and deployed environments do not poll the queue', async () => {
  const noFetch = () => { throw new Error('must not fetch'); };
  const noRpc = () => { throw new Error('must not call database'); };
  for (const changed of [{ ENVIRONMENT: 'staging' }, { ENVIRONMENT: 'production' },
    { KYC_INDIA_SCAN_QUEUE_ENABLED: 'false' }]) {
    assert.deepEqual(await consumeKycIndiaScanQueue({ ...env, ...changed }, noFetch, clock, noRpc),
      { received: 0, applied: 0, acknowledged: 0, retry: 0 });
  }
});

test('signed Mumbai SQS pull applies exact event and ACKs after durable RPC', async () => {
  const order = [];
  const fetcher = async (url, options) => {
    assert.equal(url, 'https://sqs.ap-south-1.amazonaws.com/');
    assert.match(options.headers.authorization, /Credential=AKIAIOSFODNN7EXAMPLE\/20261101\/ap-south-1\/sqs\/aws4_request/);
    assert.match(options.headers.authorization, /SignedHeaders=content-type;host;x-amz-date;x-amz-target/);
    assert.equal(options.headers['x-amz-date'], '20261101T120100Z');
    const target = options.headers['x-amz-target'];
    const body = JSON.parse(options.body);
    if (target === 'AmazonSQS.ReceiveMessage') {
      order.push('receive');
      assert.equal(body.QueueUrl, env.KYC_INDIA_SCAN_QUEUE_URL);
      return Response.json({ Messages: [{ ReceiptHandle: 'synthetic-handle', Body: JSON.stringify(event()) }] });
    }
    assert.equal(target, 'AmazonSQS.DeleteMessage');
    assert.equal(body.ReceiptHandle, 'synthetic-handle');
    order.push('delete');
    return new Response('', { status: 200 });
  };
  const rpc = async args => {
    order.push('rpc');
    assert.deepEqual(args, { p_site: site, p_receipt: receipt,
      p_version: 'synthetic-version+1', p_event: eventId,
      p_verdict: 'clean', p_scanned_at: '2026-11-01T12:00:00Z' });
    return { data: 'applied', error: null };
  };
  assert.deepEqual(await consumeKycIndiaScanQueue(env, fetcher, clock, rpc),
    { received: 1, applied: 1, acknowledged: 1, retry: 0 });
  assert.deepEqual(order, ['receive', 'rpc', 'delete']);
});

test('forged, blocked and DB-failed events stay unacknowledged', async () => {
  for (const [body, dbResult, expectedCalls] of [
    [JSON.stringify({ ...event(), account: '999999999999' }), null, 0],
    [JSON.stringify(event('UNSUPPORTED')), null, 0],
    [JSON.stringify(event()), { data: null, error: { code: 'outage' } }, 1],
  ]) {
    let rpcCalls = 0;
    const fetcher = async (_url, options) => {
      assert.equal(options.headers['x-amz-target'], 'AmazonSQS.ReceiveMessage');
      return Response.json({ Messages: [{ ReceiptHandle: 'synthetic-handle', Body: body }] });
    };
    assert.deepEqual(await consumeKycIndiaScanQueue(env, fetcher, clock, async () => {
      rpcCalls++;
      return dbResult;
    }), { received: 1, applied: 0, acknowledged: 0, retry: 1 });
    assert.equal(rpcCalls, expectedCalls);
  }
});

test('cross-account queue and SQS outage fail closed', async () => {
  await assert.rejects(consumeKycIndiaScanQueue({ ...env,
    KYC_INDIA_SCAN_QUEUE_URL: 'https://sqs.ap-south-1.amazonaws.com/999999999999/other',
  }, () => { throw new Error('must not call'); }, clock), /KYC_INDIA_SCAN_QUEUE_INVALID/);
  await assert.rejects(consumeKycIndiaScanQueue(env,
    async () => new Response('unavailable', { status: 503 }), clock),
  /KYC_INDIA_SCAN_QUEUE_UNAVAILABLE/);
});
