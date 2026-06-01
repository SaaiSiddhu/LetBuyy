import { z } from 'zod';
import { EmailSchema } from '@letbuyy/shared-types';

const PasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password cannot exceed 128 characters')
  .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Must contain at least one special character');

export const SignUpSchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
  name: z.string().min(1).max(200).trim().optional(),
});

export const SignInSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1, 'Password is required'),
});

export const OtpRequestSchema = z.object({
  email: EmailSchema,
});

export const OtpVerifySchema = z.object({
  email: EmailSchema,
  token: z.string().length(6, 'OTP must be 6 digits').regex(/^\d{6}$/),
});

export const PasswordResetRequestSchema = z.object({
  email: EmailSchema,
});

export const PasswordUpdateSchema = z.object({
  password: PasswordSchema,
});

export type ActorType = 'shopper' | 'customer' | 'merchant' | 'partner' | 'platform-employee' | 'platform-operator' | 'service';
export type SessionKind = 'merchant' | 'customer' | 'employee' | 'service';
export type PermissionAction = 'read' | 'create' | 'update' | 'delete' | 'manage';

export interface ActorIdentity {
  actor_id: string;
  actor_type: ActorType;
  site_id?: string;
  email?: string;
  roles: string[];
  permissions: Permission[];
}

export interface Permission {
  resource: string;
  action: PermissionAction;
  scope?: 'own' | 'site' | 'platform';
}

export interface SessionContract {
  session_id: string;
  actor: ActorIdentity;
  kind: SessionKind;
  expires_at: string;
  issued_at: string;
  request_id?: string;
}

export interface RbacPolicy {
  role: string;
  permissions: Permission[];
  description?: string;
}

export interface CustomerCredential {
  email?: string;
  phone?: string;
  passwordHash: string;
  createdAt: string;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  phone?: string;
  avatar_url?: string;
  subscription_tier: 'free' | 'starter' | 'business' | 'enterprise';
  created_at: string;
  updated_at: string;
}

export type SignUpInput = z.infer<typeof SignUpSchema>;
export type SignInInput = z.infer<typeof SignInSchema>;
export type OtpRequestInput = z.infer<typeof OtpRequestSchema>;
export type OtpVerifyInput = z.infer<typeof OtpVerifySchema>;
export type PasswordResetRequestInput = z.infer<typeof PasswordResetRequestSchema>;
export type PasswordUpdateInput = z.infer<typeof PasswordUpdateSchema>;

export type AuthTokenType = 'email_verify' | 'magic_link' | 'password_reset';

export const AUTH_TOKEN_EXPIRY_MS: Record<AuthTokenType, number> = {
  email_verify: 60 * 60 * 1000,
  magic_link: 15 * 60 * 1000,
  password_reset: 60 * 60 * 1000,
};

export const AUTH_OTP_EXPIRY_MS = 10 * 60 * 1000;
export const AUTH_SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
export const LETBUYY_MERCHANT_SESSION_COOKIE = 'lb_session';
export const LETBUYY_CUSTOMER_SESSION_COOKIE = 'lb_customer_session';
export const LETBUYY_PLATFORM_SESSION_COOKIE = 'lb_console_session';
export const LETBUYY_CUSTOMER_SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
export const LETBUYY_INTERNAL_AUTH_MAX_AGE_MS = 5 * 60 * 1000;
export const LETBUYY_PLATFORM_SESSION_TTL_SECONDS = 8 * 60 * 60;
export const LETBUYY_PLATFORM_MAGIC_LINK_TTL_SECONDS = 15 * 60;

const SAFE_SESSION_TOKEN_PATTERN = /^[A-Za-z0-9._~-]+$/;
const INTERNAL_SESSION_HEADER_PREFIX = 'X-LetBuyy-Internal';
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export type LetbuyyCookieSessionKind = 'merchant' | 'customer';

export type LetbuyySessionVerificationStatus =
  | 'accepted'
  | 'missing'
  | 'malformed'
  | 'expired'
  | 'invalid_signature'
  | 'misconfigured';

export interface LetbuyySessionVerificationResult<TPayload = unknown> {
  accepted: boolean;
  status: LetbuyySessionVerificationStatus;
  kind: LetbuyyCookieSessionKind;
  token?: string;
  payload?: TPayload;
  reason?: string;
}

export interface LetbuyyInternalSessionHeaderPlan {
  ok: boolean;
  status: LetbuyySessionVerificationStatus;
  headers?: Record<string, string>;
  signature?: string;
  timestamp?: string;
  reason?: string;
}

export interface LetbuyyInternalSessionHeaderInput {
  sessionToken?: string | null;
  timestamp?: string | null;
  signature?: string | null;
  secret?: string | null;
  nowMs?: number;
  maxAgeMs?: number;
}

export interface CustomerSessionSubject {
  id: string;
  storeId: string;
  email: string;
  fullName: string | null;
}

export interface LetbuyyCustomerSessionPayload {
  sub: string;
  storeId: string;
  email: string;
  name: string | null;
  iat: number;
  exp: number;
}

export interface CustomerSessionTokenOptions {
  ttlSeconds?: number;
  nowSeconds?: number;
}

export interface LetbuyyPlatformSessionPayload {
  type: 'platform_session';
  email: string;
  userId: string | null;
  mfaVerified: boolean;
  issuedAt: number;
  exp: number;
}

export interface LetbuyyPlatformMagicLinkPayload {
  type: 'platform_magic_link';
  email: string;
  exp: number;
}

export interface LetbuyyPlatformSessionTokenOptions {
  ttlSeconds?: number;
  nowSeconds?: number;
}

export interface LetbuyyPlatformTokenVerificationResult<TPayload> {
  accepted: boolean;
  status: LetbuyySessionVerificationStatus;
  token?: string;
  payload?: TPayload;
  reason?: string;
}

export const LETBUYY_APP_ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
export const LETBUYY_APP_ACCESS_TOKEN_ISSUER = 'letbuyy-app-platform';
export const LETBUYY_APP_ACCESS_TOKEN_AUDIENCE = 'letbuyy-commerce-api';

export interface AppScopedAccessTokenSubject {
  appId: string;
  installationId: string;
  storeId: string;
  installedBy: string;
  scopes: string[];
}

export interface AppScopedAccessTokenOptions {
  ttlSeconds?: number;
  nowSeconds?: number;
  tokenId?: string;
}

export interface AppScopedAccessTokenVerificationOptions {
  nowSeconds?: number;
  requiredScopes?: string[];
}

export interface LetbuyyAppAccessTokenPayload {
  iss: typeof LETBUYY_APP_ACCESS_TOKEN_ISSUER;
  aud: typeof LETBUYY_APP_ACCESS_TOKEN_AUDIENCE;
  sub: string;
  appId: string;
  installationId: string;
  storeId: string;
  installedBy: string;
  scopes: string[];
  iat: number;
  exp: number;
  jti: string;
}

export type AppScopedTokenVerificationStatus =
  | 'accepted'
  | 'missing'
  | 'malformed'
  | 'expired'
  | 'invalid_signature'
  | 'misconfigured'
  | 'insufficient_scope';

export interface AppScopedAccessTokenVerificationResult {
  accepted: boolean;
  status: AppScopedTokenVerificationStatus;
  token?: string;
  payload?: LetbuyyAppAccessTokenPayload;
  reason?: string;
}

export interface CustomUserEnsurePlan {
  email: string;
  updates: Record<string, unknown>;
  insert: {
    email: string;
    email_verified: boolean;
    full_name: string | null;
    avatar_url: string | null;
    auth_provider: string;
  };
}

export interface EmployeeInviteRecord {
  id: string;
  store_id: string;
  email: string;
  role?: string | null;
  expires_at: string;
}

export interface EmployeeInviteAcceptanceInsert {
  user_id: string;
  store_id: string;
  email: string;
  role: string;
  status: 'active';
}

export interface EmployeeStaffCreateInsert {
  store_id: string;
  email: string;
  full_name: string;
  role: string;
  status: 'invited';
  is_active: true;
  created_by: string;
}

export interface EmployeeInviteInsert {
  store_id: string;
  email: string;
  role: string;
  token: string;
  invited_by: string;
  expires_at: string;
}

export type AuthPlanResult<T> =
  | { ok: true; value: T }
  | { ok: false; message: string };

export function normalizeAuthEmail(value: unknown): string {
  return String(value || '').toLowerCase().trim();
}

export function getLetbuyyInternalAuthSecret(env: {
  INTERNAL_API_SECRET?: string | null;
  AUTH_SECRET?: string | null;
}): string | undefined {
  return env.INTERNAL_API_SECRET || env.AUTH_SECRET || undefined;
}

export function isAuthUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(value);
}

export function isSafeAuthEmail(value: string | undefined): value is string {
  return !!value && value.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function verifyLetbuyySessionCookieValue(
  kind: LetbuyyCookieSessionKind,
  token: string | null | undefined,
): LetbuyySessionVerificationResult {
  if (!token) {
    return { accepted: false, status: 'missing', kind, reason: 'Session cookie is missing' };
  }

  const normalizedToken = token.trim();
  if (normalizedToken !== token || normalizedToken.length > 4096) {
    return { accepted: false, status: 'malformed', kind, reason: 'Session cookie has invalid whitespace or length' };
  }

  if (kind === 'merchant' && normalizedToken.length < 32) {
    return { accepted: false, status: 'malformed', kind, reason: 'Merchant session token is too short' };
  }

  if (kind === 'customer' && normalizedToken.split('.').length !== 3) {
    return { accepted: false, status: 'malformed', kind, reason: 'Customer session token is not a JWT' };
  }

  if (!SAFE_SESSION_TOKEN_PATTERN.test(normalizedToken)) {
    return { accepted: false, status: 'malformed', kind, reason: 'Session cookie contains unsupported characters' };
  }

  return { accepted: true, status: 'accepted', kind, token: normalizedToken };
}

export function isFreshLetbuyyInternalTimestamp(
  timestampHeader: string | null | undefined,
  nowMs = Date.now(),
  maxAgeMs = LETBUYY_INTERNAL_AUTH_MAX_AGE_MS,
): boolean {
  if (!timestampHeader) return false;
  const timestamp = Number(timestampHeader);
  return Number.isFinite(timestamp) && Math.abs(nowMs - timestamp) <= maxAgeMs;
}

export function bytesToHex(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return [...view].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function timingSafeEqualHex(left: string | null | undefined, right: string | null | undefined): boolean {
  if (!left || !right || left.length !== right.length) return false;

  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return mismatch === 0;
}

export async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  return bytesToHex(await hmacSha256Bytes(secret, payload));
}

export async function verifyLetbuyySignedPayload(
  secret: string | null | undefined,
  payload: string,
  signature: string | null | undefined,
): Promise<boolean> {
  if (!secret || !signature) return false;
  const expectedSignature = await hmacSha256Hex(secret, payload);
  return timingSafeEqualHex(expectedSignature, signature);
}

export async function createLetbuyyInternalSessionHeaders(
  sessionToken: string | null | undefined,
  secret: string | null | undefined,
  nowMs = Date.now(),
): Promise<LetbuyyInternalSessionHeaderPlan> {
  const verification = verifyLetbuyySessionCookieValue('merchant', sessionToken);
  if (!verification.accepted || !verification.token) {
    return { ok: false, status: verification.status, reason: verification.reason };
  }

  if (!secret) {
    return { ok: false, status: 'misconfigured', reason: 'Internal auth secret is not configured' };
  }

  const timestamp = nowMs.toString();
  const signature = await hmacSha256Hex(secret, internalSessionSigningPayload(verification.token, timestamp));

  return {
    ok: true,
    status: 'accepted',
    timestamp,
    signature,
    headers: {
      [`${INTERNAL_SESSION_HEADER_PREFIX}-Session-Token`]: verification.token,
      [`${INTERNAL_SESSION_HEADER_PREFIX}-Timestamp`]: timestamp,
      [`${INTERNAL_SESSION_HEADER_PREFIX}-Signature`]: signature,
    },
  };
}

export async function verifyLetbuyyInternalSessionHeaders(
  input: LetbuyyInternalSessionHeaderInput,
): Promise<LetbuyySessionVerificationResult> {
  const verification = verifyLetbuyySessionCookieValue('merchant', input.sessionToken);
  if (!verification.accepted || !verification.token) return verification;

  if (!input.secret) {
    return { accepted: false, status: 'misconfigured', kind: 'merchant', reason: 'Internal auth secret is not configured' };
  }

  if (!isFreshLetbuyyInternalTimestamp(input.timestamp, input.nowMs, input.maxAgeMs)) {
    return { accepted: false, status: 'expired', kind: 'merchant', reason: 'Internal session signature timestamp is stale' };
  }

  const signed = await verifyLetbuyySignedPayload(
    input.secret,
    internalSessionSigningPayload(verification.token, String(input.timestamp)),
    input.signature,
  );

  if (!signed) {
    return { accepted: false, status: 'invalid_signature', kind: 'merchant', reason: 'Internal session signature is invalid' };
  }

  return verification;
}

export async function createCustomerSessionToken(
  customer: CustomerSessionSubject,
  secret: string,
  options: CustomerSessionTokenOptions = {},
): Promise<string> {
  const nowSeconds = options.nowSeconds ?? Math.floor(Date.now() / 1000);
  const ttlSeconds = options.ttlSeconds ?? LETBUYY_CUSTOMER_SESSION_TTL_SECONDS;
  const payload: LetbuyyCustomerSessionPayload = {
    sub: customer.id,
    storeId: customer.storeId,
    email: customer.email,
    name: customer.fullName,
    iat: nowSeconds,
    exp: nowSeconds + ttlSeconds,
  };
  const signingInput = `${base64UrlEncodeJson({ alg: 'HS256', typ: 'JWT' })}.${base64UrlEncodeJson(payload)}`;
  const signature = base64UrlEncodeBytes(await hmacSha256Bytes(secret, signingInput));

  return `${signingInput}.${signature}`;
}

export async function verifyCustomerSessionToken(
  token: string | null | undefined,
  secret: string | null | undefined,
  options: CustomerSessionTokenOptions = {},
): Promise<LetbuyySessionVerificationResult<LetbuyyCustomerSessionPayload>> {
  const cookieVerification = verifyLetbuyySessionCookieValue('customer', token);
  if (!cookieVerification.accepted || !cookieVerification.token) {
    return cookieVerification as LetbuyySessionVerificationResult<LetbuyyCustomerSessionPayload>;
  }

  if (!secret) {
    return { accepted: false, status: 'misconfigured', kind: 'customer', reason: 'Customer session secret is not configured' };
  }

  const [encodedHeader, encodedPayload, signature] = cookieVerification.token.split('.');
  let header: Record<string, unknown>;
  let payload: LetbuyyCustomerSessionPayload;

  try {
    header = JSON.parse(textDecoder.decode(base64UrlToBytes(encodedHeader))) as Record<string, unknown>;
    payload = JSON.parse(textDecoder.decode(base64UrlToBytes(encodedPayload))) as LetbuyyCustomerSessionPayload;
  } catch {
    return { accepted: false, status: 'malformed', kind: 'customer', reason: 'Customer session payload is not valid JSON' };
  }

  if (header.alg !== 'HS256') {
    return { accepted: false, status: 'malformed', kind: 'customer', reason: 'Customer session JWT algorithm is unsupported' };
  }

  const signed = await verifyCustomerJwtSignature(secret, `${encodedHeader}.${encodedPayload}`, signature);
  if (!signed) {
    return { accepted: false, status: 'invalid_signature', kind: 'customer', reason: 'Customer session signature is invalid' };
  }

  if (!isCustomerSessionPayload(payload)) {
    return { accepted: false, status: 'malformed', kind: 'customer', reason: 'Customer session payload is incomplete' };
  }

  const nowSeconds = options.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (payload.exp <= nowSeconds) {
    return { accepted: false, status: 'expired', kind: 'customer', reason: 'Customer session is expired' };
  }

  return {
    accepted: true,
    status: 'accepted',
    kind: 'customer',
    token: cookieVerification.token,
    payload,
  };
}

export async function createLetbuyyPlatformSessionToken(
  input: { email: string; userId?: string | null; mfaVerified: boolean },
  secret: string | null | undefined,
  options: LetbuyyPlatformSessionTokenOptions = {},
): Promise<string | null> {
  if (!secret) return null;
  const nowSeconds = options.nowSeconds ?? Math.floor(Date.now() / 1000);
  const ttlSeconds = options.ttlSeconds ?? LETBUYY_PLATFORM_SESSION_TTL_SECONDS;
  return signLetbuyyJsonPayload(
    {
      type: 'platform_session',
      email: normalizeAuthEmail(input.email),
      userId: input.userId || null,
      mfaVerified: input.mfaVerified,
      issuedAt: nowSeconds,
      exp: nowSeconds + ttlSeconds,
    } satisfies LetbuyyPlatformSessionPayload,
    secret,
  );
}

export async function verifyLetbuyyPlatformSessionToken(
  token: string | null | undefined,
  secret: string | null | undefined,
  options: LetbuyyPlatformSessionTokenOptions = {},
): Promise<LetbuyyPlatformTokenVerificationResult<LetbuyyPlatformSessionPayload>> {
  return verifyLetbuyyJsonPayload(
    token,
    secret,
    isPlatformSessionPayload,
    options.nowSeconds ?? Math.floor(Date.now() / 1000),
    'Platform session',
  );
}

export async function createLetbuyyPlatformMagicLinkToken(
  email: string,
  secret: string | null | undefined,
  options: LetbuyyPlatformSessionTokenOptions = {},
): Promise<string | null> {
  if (!secret) return null;
  const nowSeconds = options.nowSeconds ?? Math.floor(Date.now() / 1000);
  const ttlSeconds = options.ttlSeconds ?? LETBUYY_PLATFORM_MAGIC_LINK_TTL_SECONDS;
  return signLetbuyyJsonPayload(
    {
      type: 'platform_magic_link',
      email: normalizeAuthEmail(email),
      exp: nowSeconds + ttlSeconds,
    } satisfies LetbuyyPlatformMagicLinkPayload,
    secret,
  );
}

export async function verifyLetbuyyPlatformMagicLinkToken(
  token: string | null | undefined,
  secret: string | null | undefined,
  options: LetbuyyPlatformSessionTokenOptions = {},
): Promise<LetbuyyPlatformTokenVerificationResult<LetbuyyPlatformMagicLinkPayload>> {
  return verifyLetbuyyJsonPayload(
    token,
    secret,
    isPlatformMagicLinkPayload,
    options.nowSeconds ?? Math.floor(Date.now() / 1000),
    'Platform magic link',
  );
}

export async function createAppScopedAccessToken(
  subject: AppScopedAccessTokenSubject,
  secret: string,
  options: AppScopedAccessTokenOptions = {},
): Promise<string> {
  const nowSeconds = options.nowSeconds ?? Math.floor(Date.now() / 1000);
  const ttlSeconds = options.ttlSeconds ?? LETBUYY_APP_ACCESS_TOKEN_TTL_SECONDS;
  const scopes = normalizeAppAccessScopes(subject.scopes);
  const payload: LetbuyyAppAccessTokenPayload = {
    iss: LETBUYY_APP_ACCESS_TOKEN_ISSUER,
    aud: LETBUYY_APP_ACCESS_TOKEN_AUDIENCE,
    sub: subject.appId,
    appId: subject.appId,
    installationId: subject.installationId,
    storeId: subject.storeId,
    installedBy: subject.installedBy,
    scopes,
    iat: nowSeconds,
    exp: nowSeconds + ttlSeconds,
    jti: options.tokenId || crypto.randomUUID(),
  };
  const signingInput = `${base64UrlEncodeJson({ alg: 'HS256', typ: 'JWT' })}.${base64UrlEncodeJson(payload)}`;
  const signature = base64UrlEncodeBytes(await hmacSha256Bytes(secret, signingInput));

  return `${signingInput}.${signature}`;
}

export async function verifyAppScopedAccessToken(
  token: string | null | undefined,
  secret: string | null | undefined,
  options: AppScopedAccessTokenVerificationOptions = {},
): Promise<AppScopedAccessTokenVerificationResult> {
  if (!token) {
    return { accepted: false, status: 'missing', reason: 'App access token is missing' };
  }

  const normalizedToken = token.trim();
  if (normalizedToken !== token || normalizedToken.length > 4096 || normalizedToken.split('.').length !== 3) {
    return { accepted: false, status: 'malformed', reason: 'App access token is malformed' };
  }

  if (!secret) {
    return { accepted: false, status: 'misconfigured', reason: 'App token secret is not configured' };
  }

  const [encodedHeader, encodedPayload, signature] = normalizedToken.split('.');
  let header: Record<string, unknown>;
  let payload: LetbuyyAppAccessTokenPayload;

  try {
    header = JSON.parse(textDecoder.decode(base64UrlToBytes(encodedHeader))) as Record<string, unknown>;
    payload = JSON.parse(textDecoder.decode(base64UrlToBytes(encodedPayload))) as LetbuyyAppAccessTokenPayload;
  } catch {
    return { accepted: false, status: 'malformed', reason: 'App access token payload is not valid JSON' };
  }

  if (header.alg !== 'HS256' || !isAppAccessTokenPayload(payload)) {
    return { accepted: false, status: 'malformed', reason: 'App access token payload is incomplete' };
  }

  const signed = await verifyCustomerJwtSignature(secret, `${encodedHeader}.${encodedPayload}`, signature);
  if (!signed) {
    return { accepted: false, status: 'invalid_signature', reason: 'App access token signature is invalid' };
  }

  const nowSeconds = options.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (payload.exp <= nowSeconds) {
    return { accepted: false, status: 'expired', reason: 'App access token is expired' };
  }

  const requiredScopes = normalizeAppAccessScopes(options.requiredScopes || []);
  const hasRequiredScopes = requiredScopes.every((scope) => payload.scopes.includes(scope));
  if (!hasRequiredScopes) {
    return { accepted: false, status: 'insufficient_scope', reason: 'App access token is missing a required scope' };
  }

  return {
    accepted: true,
    status: 'accepted',
    token: normalizedToken,
    payload,
  };
}

function internalSessionSigningPayload(sessionToken: string, timestamp: string): string {
  return `session.${sessionToken}.${timestamp}`;
}

export async function sha256Hex(payload: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', textEncoder.encode(payload));
  return bytesToHex(new Uint8Array(digest));
}

async function hmacSha256Bytes(secret: string, payload: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, textEncoder.encode(payload));
  return new Uint8Array(signature);
}

function base64UrlEncodeJson(value: unknown): string {
  return base64UrlEncodeBytes(textEncoder.encode(JSON.stringify(value)));
}

function base64UrlEncodeBytes(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value: string): Uint8Array {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function signLetbuyyJsonPayload<TPayload extends { exp: number }>(payload: TPayload, secret: string): Promise<string> {
  const encodedPayload = base64UrlEncodeJson(payload);
  const signature = base64UrlEncodeBytes(await hmacSha256Bytes(secret, encodedPayload));
  return `${encodedPayload}.${signature}`;
}

async function verifyLetbuyyJsonPayload<TPayload extends { exp: number }>(
  token: string | null | undefined,
  secret: string | null | undefined,
  isPayload: (value: unknown) => value is TPayload,
  nowSeconds: number,
  label: string,
): Promise<LetbuyyPlatformTokenVerificationResult<TPayload>> {
  if (!token) {
    return { accepted: false, status: 'missing', reason: `${label} token is missing` };
  }

  if (!secret) {
    return { accepted: false, status: 'misconfigured', reason: `${label} secret is not configured` };
  }

  const normalizedToken = token.trim();
  if (
    normalizedToken !== token ||
    normalizedToken.length > 4096 ||
    normalizedToken.split('.').length !== 2 ||
    !SAFE_SESSION_TOKEN_PATTERN.test(normalizedToken)
  ) {
    return { accepted: false, status: 'malformed', reason: `${label} token is malformed` };
  }

  const [encodedPayload, signature] = normalizedToken.split('.');
  const expectedSignature = base64UrlEncodeBytes(await hmacSha256Bytes(secret, encodedPayload));
  if (!timingSafeEqualBase64Url(expectedSignature, signature)) {
    return { accepted: false, status: 'invalid_signature', reason: `${label} signature is invalid` };
  }

  let payload: unknown;
  try {
    payload = JSON.parse(textDecoder.decode(base64UrlToBytes(encodedPayload)));
  } catch {
    return { accepted: false, status: 'malformed', reason: `${label} payload is not valid JSON` };
  }

  if (!isPayload(payload)) {
    return { accepted: false, status: 'malformed', reason: `${label} payload is incomplete` };
  }

  if (payload.exp <= nowSeconds) {
    return { accepted: false, status: 'expired', reason: `${label} is expired` };
  }

  return {
    accepted: true,
    status: 'accepted',
    token: normalizedToken,
    payload,
  };
}

async function verifyCustomerJwtSignature(secret: string, signingInput: string, signature: string): Promise<boolean> {
  const expected = await hmacSha256Bytes(secret, signingInput);
  return timingSafeEqualBase64Url(base64UrlEncodeBytes(expected), signature);
}

function timingSafeEqualBase64Url(left: string, right: string): boolean {
  if (left.length !== right.length) return false;

  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return mismatch === 0;
}

function isCustomerSessionPayload(value: LetbuyyCustomerSessionPayload): value is LetbuyyCustomerSessionPayload {
  return Boolean(
    value &&
    typeof value.sub === 'string' &&
    value.sub.length > 0 &&
    typeof value.storeId === 'string' &&
    value.storeId.length > 0 &&
    isSafeAuthEmail(value.email) &&
    (value.name === null || typeof value.name === 'string') &&
    Number.isFinite(value.iat) &&
    Number.isFinite(value.exp),
  );
}

function isPlatformSessionPayload(value: unknown): value is LetbuyyPlatformSessionPayload {
  const payload = value as LetbuyyPlatformSessionPayload;
  return Boolean(
    payload &&
    payload.type === 'platform_session' &&
    isSafeAuthEmail(payload.email) &&
    (payload.userId === null || typeof payload.userId === 'string') &&
    typeof payload.mfaVerified === 'boolean' &&
    Number.isFinite(payload.issuedAt) &&
    Number.isFinite(payload.exp),
  );
}

function isPlatformMagicLinkPayload(value: unknown): value is LetbuyyPlatformMagicLinkPayload {
  const payload = value as LetbuyyPlatformMagicLinkPayload;
  return Boolean(
    payload &&
    payload.type === 'platform_magic_link' &&
    isSafeAuthEmail(payload.email) &&
    Number.isFinite(payload.exp),
  );
}

function normalizeAppAccessScopes(scopes: string[]): string[] {
  const normalized = new Set<string>();
  for (const scope of scopes) {
    const value = typeof scope === 'string' ? scope.trim() : '';
    if (value && value.length <= 120 && /^[a-z0-9:._*-]+$/i.test(value)) {
      normalized.add(value);
    }
  }
  return [...normalized].sort();
}

function isAppAccessTokenPayload(value: LetbuyyAppAccessTokenPayload): value is LetbuyyAppAccessTokenPayload {
  return Boolean(
    value &&
    value.iss === LETBUYY_APP_ACCESS_TOKEN_ISSUER &&
    value.aud === LETBUYY_APP_ACCESS_TOKEN_AUDIENCE &&
    typeof value.sub === 'string' &&
    value.sub.length > 0 &&
    typeof value.appId === 'string' &&
    value.appId === value.sub &&
    typeof value.installationId === 'string' &&
    value.installationId.length > 0 &&
    typeof value.storeId === 'string' &&
    value.storeId.length > 0 &&
    typeof value.installedBy === 'string' &&
    value.installedBy.length > 0 &&
    Array.isArray(value.scopes) &&
    value.scopes.every((scope) => typeof scope === 'string') &&
    Number.isFinite(value.iat) &&
    Number.isFinite(value.exp) &&
    typeof value.jti === 'string' &&
    value.jti.length > 0,
  );
}

export function isAuthTokenType(value: unknown): value is AuthTokenType {
  return typeof value === 'string' && value in AUTH_TOKEN_EXPIRY_MS;
}

export function parseAuthDeviceName(userAgent: string): string {
  const ua = userAgent.toLowerCase();
  let browser = 'Unknown Browser';
  if (ua.includes('chrome') && !ua.includes('edg')) browser = 'Chrome';
  else if (ua.includes('safari') && !ua.includes('chrome')) browser = 'Safari';
  else if (ua.includes('firefox')) browser = 'Firefox';
  else if (ua.includes('edg')) browser = 'Edge';

  let os = 'Unknown OS';
  if (ua.includes('iphone')) os = 'iPhone';
  else if (ua.includes('ipad')) os = 'iPad';
  else if (ua.includes('android')) os = 'Android';
  else if (ua.includes('mac')) os = 'macOS';
  else if (ua.includes('windows')) os = 'Windows';
  else if (ua.includes('linux')) os = 'Linux';

  return `${browser} on ${os}`;
}

export function planCustomUserEnsure(body: Record<string, unknown>, updatedAt: string): CustomUserEnsurePlan | null {
  const email = normalizeAuthEmail(body.email);
  if (!email) return null;

  const updates: Record<string, unknown> = {
    updated_at: updatedAt,
  };
  if (body.email_verified !== undefined) updates.email_verified = Boolean(body.email_verified);
  if (typeof body.full_name === 'string') updates.full_name = body.full_name;
  if (typeof body.avatar_url === 'string') updates.avatar_url = body.avatar_url;
  if (typeof body.auth_provider === 'string') updates.auth_provider = body.auth_provider;

  return {
    email,
    updates,
    insert: {
      email,
      email_verified: Boolean(body.email_verified),
      full_name: typeof body.full_name === 'string' ? body.full_name : null,
      avatar_url: typeof body.avatar_url === 'string' ? body.avatar_url : null,
      auth_provider: typeof body.auth_provider === 'string' ? body.auth_provider : 'email',
    },
  };
}

export function isEmployeeInviteExpired(invite: EmployeeInviteRecord, now: Date): boolean {
  return new Date(invite.expires_at) < now;
}

export function planEmployeeInviteAcceptance(
  invite: EmployeeInviteRecord,
  authUserId: string,
): EmployeeInviteAcceptanceInsert {
  return {
    user_id: authUserId,
    store_id: invite.store_id,
    email: invite.email,
    role: invite.role || 'staff',
    status: 'active',
  };
}

export function planEmployeeStaffCreate(
  body: Record<string, unknown>,
  createdBy: string,
): AuthPlanResult<EmployeeStaffCreateInsert> {
  const email = normalizeAuthEmail(body.email);
  const storeId = String(body.store_id || '');

  if (!email || !storeId) {
    return { ok: false, message: 'email and store_id required' };
  }

  const role = typeof body.role === 'string' && body.role ? body.role : 'editor';

  return {
    ok: true,
    value: {
      store_id: storeId,
      email,
      full_name: email,
      role,
      status: 'invited',
      is_active: true,
      created_by: createdBy,
    },
  };
}

export function planEmployeeInvite(
  body: Record<string, unknown>,
  invitedBy: string,
  token: string,
  expiresAt: string,
): AuthPlanResult<EmployeeInviteInsert> {
  const email = normalizeAuthEmail(body.email);
  const storeId = String(body.store_id || '');

  if (!email || !storeId) {
    return { ok: false, message: 'email and store_id required' };
  }

  const role = typeof body.role === 'string' && body.role ? body.role : 'staff';

  return {
    ok: true,
    value: {
      store_id: storeId,
      email,
      role,
      token,
      invited_by: invitedBy,
      expires_at: expiresAt,
    },
  };
}

export function planEmployeeUpdate(body: Record<string, unknown>): Record<string, unknown> {
  const updates: Record<string, unknown> = {};
  if (body.role) updates.role = body.role;
  if (body.permissions) updates.permissions = body.permissions;
  return updates;
}

export function employeeRemovalPatch(deletedAt: string): Record<string, unknown> {
  return { deleted_at: deletedAt, status: 'removed', is_active: false };
}
