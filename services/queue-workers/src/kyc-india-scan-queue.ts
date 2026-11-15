import { createSupabaseServiceClient, type SupabaseServiceEnv } from '@letbuyy/infrastructure/supabase-adapter';
import { parseKycIndiaGuardDutyEvent } from '@letbuyy/infrastructure/storage-adapter';

/** Test-only SQS pull. AWS IAM and the exact EventBridge queue policy are deployment gates. */
export interface KycIndiaScanQueueEnv extends SupabaseServiceEnv {
  ENVIRONMENT: string;
  KYC_INDIA_SCAN_QUEUE_ENABLED?: string;
  KYC_INDIA_SCAN_QUEUE_URL?: string;
  KYC_INDIA_ACCOUNT_ID?: string;
  KYC_INDIA_BUCKET?: string;
  KYC_INDIA_GUARDDUTY_PLAN_ARN?: string;
  KYC_INDIA_SQS_ACCESS_KEY_ID?: string;
  KYC_INDIA_SQS_SECRET_ACCESS_KEY?: string;
  KYC_INDIA_SQS_SESSION_TOKEN?: string;
}

type Rpc = (args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
const encoder = new TextEncoder();
const accountPattern = /^[0-9]{12}$/;
const keyPattern = /^[A-Z0-9]{12,64}$/;

function invalid(): never { throw new Error('KYC_INDIA_SCAN_QUEUE_INVALID'); }
function unavailable(): never { throw new Error('KYC_INDIA_SCAN_QUEUE_UNAVAILABLE'); }
function hex(value: Uint8Array): string {
  return [...value].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
async function sha256(value: string): Promise<string> {
  return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))));
}
async function hmac(key: Uint8Array, value: string): Promise<Uint8Array> {
  const imported = await crypto.subtle.importKey('raw', key as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', imported, encoder.encode(value)));
}

function configuration(env: KycIndiaScanQueueEnv): { queueUrl: string; account: string; bucket: string; planArn: string } {
  const account = env.KYC_INDIA_ACCOUNT_ID || '';
  const bucket = env.KYC_INDIA_BUCKET || '';
  const queueUrl = env.KYC_INDIA_SCAN_QUEUE_URL || '';
  const planArn = env.KYC_INDIA_GUARDDUTY_PLAN_ARN || '';
  if (!accountPattern.test(account) || !/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket)
    || !/^https:\/\/sqs\.ap-south-1\.amazonaws\.com\/[0-9]{12}\/[A-Za-z0-9_-]+$/.test(queueUrl)
    || new URL(queueUrl).pathname.split('/')[1] !== account
    || !planArn.startsWith(`arn:aws:guardduty:ap-south-1:${account}:malware-protection-plan/`)
    || !keyPattern.test(env.KYC_INDIA_SQS_ACCESS_KEY_ID || '')
    || (env.KYC_INDIA_SQS_SECRET_ACCESS_KEY || '').length < 16
    || env.KYC_INDIA_SQS_SESSION_TOKEN !== undefined && !env.KYC_INDIA_SQS_SESSION_TOKEN) invalid();
  return { account, bucket, queueUrl, planArn };
}

async function sqsRequest(env: KycIndiaScanQueueEnv, operation: 'ReceiveMessage' | 'DeleteMessage',
  body: Record<string, unknown>, fetcher: typeof fetch, clock: () => Date): Promise<unknown> {
  const now = clock();
  if (!Number.isFinite(now.getTime())) invalid();
  const amzDate = now.toISOString().replace(/[-:]|\.\d{3}/g, '');
  const date = amzDate.slice(0, 8);
  const payload = JSON.stringify(body);
  const payloadHash = await sha256(payload);
  const host = 'sqs.ap-south-1.amazonaws.com';
  const headers: Record<string, string> = {
    'content-type': 'application/x-amz-json-1.0', host,
    'x-amz-date': amzDate, 'x-amz-target': `AmazonSQS.${operation}`,
  };
  if (env.KYC_INDIA_SQS_SESSION_TOKEN) headers['x-amz-security-token'] = env.KYC_INDIA_SQS_SESSION_TOKEN;
  const names = Object.keys(headers).sort();
  const signedHeaders = names.join(';');
  const canonical = `POST\n/\n\n${names.map(name => `${name}:${headers[name]}\n`).join('')}\n${signedHeaders}\n${payloadHash}`;
  const scope = `${date}/ap-south-1/sqs/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${await sha256(canonical)}`;
  let signingKey = await hmac(encoder.encode(`AWS4${env.KYC_INDIA_SQS_SECRET_ACCESS_KEY}`), date);
  for (const part of ['ap-south-1', 'sqs', 'aws4_request']) signingKey = await hmac(signingKey, part);
  headers.authorization = `AWS4-HMAC-SHA256 Credential=${env.KYC_INDIA_SQS_ACCESS_KEY_ID}/${scope}, SignedHeaders=${signedHeaders}, Signature=${hex(await hmac(signingKey, stringToSign))}`;
  const { host: _host, ...requestHeaders } = headers;
  const response = await fetcher(`https://${host}/`, {
    method: 'POST', headers: requestHeaders, body: payload,
    redirect: 'manual', signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok || response.redirected || response.status !== 200) unavailable();
  const text = await response.text();
  if (text.length > 131_072) unavailable();
  try { return text ? JSON.parse(text) as unknown : {}; } catch { return unavailable(); }
}

/** Delete only after the service-only DB function accepts a current result. */
export async function consumeKycIndiaScanQueue(env: KycIndiaScanQueueEnv,
  fetcher: typeof fetch = fetch, clock: () => Date = () => new Date(),
  rpc: Rpc = async args => createSupabaseServiceClient(env).rpc('record_kyc_india_scan_v1', args)
): Promise<{ received: number; applied: number; acknowledged: number; retry: number }> {
  if (env.ENVIRONMENT !== 'test' || env.KYC_INDIA_SCAN_QUEUE_ENABLED !== 'true')
    return { received: 0, applied: 0, acknowledged: 0, retry: 0 };
  const config = configuration(env);
  const response = await sqsRequest(env, 'ReceiveMessage', {
    QueueUrl: config.queueUrl, MaxNumberOfMessages: 5,
    // Five-minute visibility bounds retry pressure while preserving the
    // one-hour upload-completion window with an appropriately sized AWS DLQ.
    VisibilityTimeout: 300, WaitTimeSeconds: 0,
    MessageSystemAttributeNames: ['ApproximateReceiveCount'],
  }, fetcher, clock);
  if (!response || typeof response !== 'object' || Array.isArray(response)) unavailable();
  const messages = (response as { Messages?: unknown }).Messages;
  if (messages !== undefined && (!Array.isArray(messages) || messages.length > 5)) unavailable();
  const result = { received: messages?.length || 0, applied: 0, acknowledged: 0, retry: 0 };
  for (const item of messages || []) {
    try {
      if (!item || typeof item !== 'object' || Array.isArray(item)) invalid();
      const message = item as Record<string, unknown>;
      if (typeof message.ReceiptHandle !== 'string' || !message.ReceiptHandle
        || typeof message.Body !== 'string' || message.Body.length > 32_768) invalid();
      const event = parseKycIndiaGuardDutyEvent(JSON.parse(message.Body), {
        accountId: config.account, bucket: config.bucket, planArn: config.planArn,
      });
      // Unknown, skipped, or failed scans remain pending; SQS redrives them for investigation.
      if (event.verdict === 'blocked') invalid();
      const { data, error } = await rpc({
        p_site: event.siteId, p_receipt: event.receiptId, p_version: event.versionId,
        p_event: event.eventId, p_verdict: event.verdict, p_scanned_at: event.scannedAt,
      });
      // The scanner can beat upload-complete. Keep this message until the
      // receipt is attached, or AWS redrives it for investigation.
      if (!error && data === 'pending') {
        result.retry++;
        continue;
      }
      if (error || !['applied', 'replay', 'unchanged', 'stale'].includes(String(data))) unavailable();
      if (data === 'applied') result.applied++;
      await sqsRequest(env, 'DeleteMessage', {
        QueueUrl: config.queueUrl, ReceiptHandle: message.ReceiptHandle,
      }, fetcher, clock);
      result.acknowledged++;
    } catch {
      result.retry++;
    }
  }
  return result;
}
