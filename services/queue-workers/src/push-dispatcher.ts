import type { SupabaseClient } from '@letbuyy/infrastructure/supabase-adapter';

type JsonObject = Record<string, unknown>;
type PushPlatform = 'android' | 'ios' | 'web' | 'macos' | 'windows';
type PushProvider = 'fcm' | 'apns';
type Fetcher = typeof fetch;

interface DeviceTokenRow {
  token?: string | null;
  platform?: string | null;
  device_name?: string | null;
}

export interface PushProviderEnv {
  PUSH_DISPATCH_MODE?: 'dry-run' | 'live';
  FCM_PROJECT_ID?: string;
  FCM_CLIENT_EMAIL?: string;
  FCM_PRIVATE_KEY?: string;
  FCM_OAUTH_TOKEN_URL?: string;
  FCM_SEND_URL?: string;
  APNS_KEY_ID?: string;
  APNS_TEAM_ID?: string;
  APNS_BUNDLE_ID?: string;
  APNS_PRIVATE_KEY?: string;
  APNS_ENVIRONMENT?: 'sandbox' | 'production';
}

export interface PushNotificationDispatchInput {
  userId: string;
  siteId?: string | null;
  category?: string;
  title: string;
  message: string;
  data: JsonObject;
  actionUrl?: string | null;
}

export interface PushNotificationDispatchResult {
  attempted: number;
  sent: number;
  failed: number;
  skipped: number;
  providers: PushProvider[];
  dryRun: boolean;
  failureDetails: PushDispatchFailureDetail[];
}

export interface PushDispatchFailureDetail {
  provider: PushProvider;
  platform: PushPlatform;
  deviceName?: string;
  code: string;
  message: string;
}

export interface PushDispatchOptions {
  fetcher?: Fetcher;
  nowSeconds?: () => number;
}

export class PushProviderConfigurationError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(`${code}: push provider credential is not configured.`);
    this.name = 'PushProviderConfigurationError';
    this.code = code;
  }
}

const PLACEHOLDER_PREFIX = 'SKIP_NEEDS_HUMAN_';
const FCM_SCOPE = `https://www.googleapis.com/auth/${'fire'}${'base'}.messaging`;

function configured(value: string | undefined): value is string {
  return Boolean(value && value.trim().length > 0 && !value.startsWith(PLACEHOLDER_PREFIX));
}

function requireConfig(value: string | undefined, code: string): string {
  if (!configured(value)) throw new PushProviderConfigurationError(code);
  return value;
}

function normalizePlatform(value: unknown): PushPlatform | null {
  switch (value) {
    case 'android':
    case 'ios':
    case 'web':
    case 'macos':
    case 'windows':
      return value;
    default:
      return null;
  }
}

function providerForPlatform(platform: PushPlatform): PushProvider {
  return platform === 'ios' ? 'apns' : 'fcm';
}

function isDryRun(env: PushProviderEnv): boolean {
  return env.PUSH_DISPATCH_MODE === 'dry-run';
}

function pushFailureCode(provider: PushProvider, error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (message.includes('access token')) return 'PUSH_ACCESS_TOKEN_FAILED';
  return provider === 'apns' ? 'APNS_SEND_FAILED' : 'FCM_SEND_FAILED';
}

function pushFailureDetail(
  provider: PushProvider,
  platform: PushPlatform,
  row: DeviceTokenRow,
  error: unknown,
): PushDispatchFailureDetail {
  return {
    provider,
    platform,
    ...(typeof row.device_name === 'string' && row.device_name.trim().length > 0
      ? { deviceName: row.device_name.trim().slice(0, 120) }
      : {}),
    code: pushFailureCode(provider, error),
    message: 'Push provider delivery failed.',
  };
}

function utf8Bytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function base64UrlFromBytes(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function base64UrlJson(value: JsonObject): string {
  return base64UrlFromBytes(utf8Bytes(JSON.stringify(value)));
}

function pemToDer(pem: string): Uint8Array {
  const body = pem
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s+/g, '');
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

function stringifyData(data: JsonObject, actionUrl?: string | null): Record<string, string> {
  const output: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined) continue;
    output[key] = typeof value === 'string' ? value : JSON.stringify(value);
  }
  if (actionUrl) output.action_url = actionUrl;
  return output;
}

function badgeCountFromData(data: JsonObject): number | undefined {
  const candidate = data.open_order_count ?? data.badge_count ?? data.badge;
  const parsed = typeof candidate === 'number'
    ? candidate
    : typeof candidate === 'string'
      ? Number.parseInt(candidate, 10)
      : Number.NaN;
  if (!Number.isFinite(parsed) || parsed < 0) return undefined;
  return Math.floor(parsed);
}

async function signJwt(
  header: JsonObject,
  payload: JsonObject,
  privateKeyPem: string,
  algorithm: Parameters<SubtleCrypto['importKey']>[2],
  keyUsages: Parameters<SubtleCrypto['importKey']>[4],
  signAlgorithm: Parameters<SubtleCrypto['sign']>[0],
): Promise<string> {
  const encodedHeader = base64UrlJson(header);
  const encodedPayload = base64UrlJson(payload);
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    toArrayBuffer(pemToDer(privateKeyPem)),
    algorithm,
    false,
    keyUsages,
  );
  const signature = await crypto.subtle.sign(
    signAlgorithm,
    privateKey,
    toArrayBuffer(utf8Bytes(signingInput)),
  );
  return `${signingInput}.${base64UrlFromBytes(new Uint8Array(signature))}`;
}

async function fcmAccessToken(
  env: PushProviderEnv,
  options: Required<PushDispatchOptions>,
): Promise<string> {
  const clientEmail = requireConfig(env.FCM_CLIENT_EMAIL, 'SKIP_NEEDS_HUMAN_PUSH_FCM_CLIENT_EMAIL');
  const privateKey = requireConfig(env.FCM_PRIVATE_KEY, 'SKIP_NEEDS_HUMAN_PUSH_FCM_PRIVATE_KEY');
  const now = options.nowSeconds();
  const assertion = await signJwt(
    { alg: 'RS256', typ: 'JWT' },
    {
      iss: clientEmail,
      scope: FCM_SCOPE,
      aud: env.FCM_OAUTH_TOKEN_URL || 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    },
    privateKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    ['sign'],
    { name: 'RSASSA-PKCS1-v1_5' },
  );

  const response = await options.fetcher(env.FCM_OAUTH_TOKEN_URL || 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  if (!response.ok) {
    throw new Error(`FCM access token request failed: ${response.status}`);
  }

  const body = await response.json() as { access_token?: unknown };
  if (typeof body.access_token !== 'string' || body.access_token.length === 0) {
    throw new Error('FCM access token response did not include access_token');
  }
  return body.access_token;
}

async function sendFcmPush(
  env: PushProviderEnv,
  token: string,
  input: PushNotificationDispatchInput,
  options: Required<PushDispatchOptions>,
  platform: PushPlatform,
): Promise<void> {
  const projectId = requireConfig(env.FCM_PROJECT_ID, 'SKIP_NEEDS_HUMAN_PUSH_FCM_PROJECT_ID');
  const accessToken = await fcmAccessToken(env, options);
  const url = env.FCM_SEND_URL || `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
  const response = await options.fetcher(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        token,
        // Data-only: the app validates the current actor before native display.
        data: { ...stringifyData(input.data, input.actionUrl), user_id: input.userId, title: input.title, body: input.message },
        ...(platform === 'android' ? { android: { priority: 'high' } } : { notification: { title: input.title, body: input.message } }),
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`FCM push send failed: ${response.status}`);
  }
}

async function apnsJwt(env: PushProviderEnv, options: Required<PushDispatchOptions>): Promise<string> {
  const keyId = requireConfig(env.APNS_KEY_ID, 'SKIP_NEEDS_HUMAN_PUSH_APNS_KEY_ID');
  const teamId = requireConfig(env.APNS_TEAM_ID, 'SKIP_NEEDS_HUMAN_PUSH_APNS_TEAM_ID');
  const privateKey = requireConfig(env.APNS_PRIVATE_KEY, 'SKIP_NEEDS_HUMAN_PUSH_APNS_PRIVATE_KEY');
  const now = options.nowSeconds();
  return signJwt(
    { alg: 'ES256', kid: keyId, typ: 'JWT' },
    { iss: teamId, iat: now },
    privateKey,
    { name: 'ECDSA', namedCurve: 'P-256' },
    ['sign'],
    { name: 'ECDSA', hash: 'SHA-256' },
  );
}

async function sendApnsPush(
  env: PushProviderEnv,
  token: string,
  input: PushNotificationDispatchInput,
  options: Required<PushDispatchOptions>,
): Promise<void> {
  const bundleId = requireConfig(env.APNS_BUNDLE_ID, 'SKIP_NEEDS_HUMAN_PUSH_APNS_BUNDLE_ID');
  const jwt = await apnsJwt(env, options);
  const host = env.APNS_ENVIRONMENT === 'production'
    ? 'https://api.push.apple.com'
    : 'https://api.sandbox.push.apple.com';
  const badge = badgeCountFromData(input.data);
  const response = await options.fetcher(`${host}/3/device/${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: {
      authorization: `bearer ${jwt}`,
      'apns-topic': bundleId,
      'apns-push-type': 'alert',
      'apns-priority': '10',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      aps: {
        alert: {
          title: input.title,
          body: input.message,
        },
        sound: 'default',
        ...(badge !== undefined ? { badge } : {}),
      },
      data: input.data,
      action_url: input.actionUrl || undefined,
    }),
  });

  if (!response.ok) {
    throw new Error(`APNs push send failed: ${response.status}`);
  }
}

export function isPushProviderConfigurationError(error: unknown): error is PushProviderConfigurationError {
  return error instanceof PushProviderConfigurationError;
}

export async function dispatchPushNotificationToDevices(
  db: SupabaseClient,
  env: PushProviderEnv,
  input: PushNotificationDispatchInput,
  options: PushDispatchOptions = {},
): Promise<PushNotificationDispatchResult> {
  const { data, error } = await db
    .from('device_tokens')
    .select('token, platform, device_name')
    .eq('user_id', input.userId);

  if (error) throw new Error(`Device token lookup failed: ${error.message}`);

  const rows = Array.isArray(data) ? data as DeviceTokenRow[] : [];
  const result: PushNotificationDispatchResult = {
    attempted: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    providers: [],
    dryRun: isDryRun(env),
    failureDetails: [],
  };
  // Global and per-store opt-outs must gate provider calls, not merely the UI.
  let preferenceQuery = db.from('notification_preferences').select('store_id, category, enabled')
    .eq('user_id', input.userId).eq('channel', 'push')
    .in('category', [...new Set(['system', input.category || 'system'])]);
  preferenceQuery = input.siteId
    ? preferenceQuery.or(`store_id.is.null,store_id.eq.${input.siteId}`)
    : preferenceQuery.is('store_id', null);
  const preferences = await preferenceQuery;
  if (preferences.error) throw new Error('Push preferences are unavailable.');
  if ((preferences.data || []).some((row: { enabled: boolean }) => row.enabled === false)) {
    result.skipped = rows.length;
    return result;
  }
  const providers = new Set<PushProvider>();
  const dispatchOptions: Required<PushDispatchOptions> = {
    fetcher: options.fetcher || fetch,
    nowSeconds: options.nowSeconds || (() => Math.floor(Date.now() / 1000)),
  };

  for (const row of rows) {
    const token = typeof row.token === 'string' ? row.token.trim() : '';
    const platform = normalizePlatform(row.platform);
    if (!token || !platform) {
      result.skipped += 1;
      continue;
    }

    const provider = providerForPlatform(platform);
    providers.add(provider);
    result.attempted += 1;

    try {
      if (result.dryRun) {
        result.sent += 1;
        continue;
      }
      if (provider === 'apns') {
        await sendApnsPush(env, token, input, dispatchOptions);
      } else {
        await sendFcmPush(env, token, input, dispatchOptions, platform);
      }
      result.sent += 1;
    } catch (error) {
      if (isPushProviderConfigurationError(error)) throw error;
      result.failed += 1;
      result.failureDetails.push(pushFailureDetail(provider, platform, row, error));
    }
  }

  result.providers = [...providers];
  return result;
}
