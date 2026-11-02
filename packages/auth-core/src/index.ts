import { z } from 'zod';
import { EmailSchema } from '@letbuyy/shared-types';
import { normalizeCustomerSessionId } from './customer-session';

export * from './customer-session';
export * from './storefront-access';

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

// The reset capability determines the account; browser input never selects a user.
export const MerchantPasswordResetSchema = PasswordUpdateSchema.extend({
  token: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();
export const MerchantPasswordResetCommitSchema = MerchantPasswordResetSchema.extend({
  purpose: z.literal('password_reset'),
}).strict();

export type ActorType = 'shopper' | 'customer' | 'merchant' | 'partner' | 'platform-employee' | 'platform-operator' | 'service';
export type SessionKind = 'merchant' | 'customer' | 'employee' | 'service';
export type PermissionAction = 'read' | 'create' | 'update' | 'delete' | 'manage';
export type RbacRoleCategory = 'store' | 'organization' | 'partner' | 'ops';
export type LetbuyyPredefinedRole = 'Administrator' | 'Merchandiser' | 'Support' | 'Partner' | 'Ops-Reviewer';

export interface ActorIdentity {
  actor_id: string;
  actor_type: ActorType;
  site_id?: string;
  email?: string;
  roles: string[];
  role_categories?: RbacRoleCategory[];
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
  category?: RbacRoleCategory;
  permissions: Permission[];
  description?: string;
}

export interface LetbuyyRoleDefinition {
  name: LetbuyyPredefinedRole;
  category: RbacRoleCategory;
  description: string;
}

export interface LetbuyyRoleAssignment {
  name: LetbuyyPredefinedRole;
  category: RbacRoleCategory;
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
/** One platform session contract, with isolated names for the staging deployment. */
export function resolveLetbuyyPlatformCookieNames(environment?: string) {
  const suffix = environment?.trim().toLowerCase() === 'staging' ? '_staging' : '';
  return {
    session: `${LETBUYY_MERCHANT_SESSION_COOKIE}${suffix}`,
    csrf: `letbuyy_csrf${suffix}`,
    legacyCsrf: `lb_csrf${suffix}`,
    accounts: `lb_accounts${suffix}`,
    device: `lb_device${suffix}`,
    passwordSetIntent: `lb_password_set_intent${suffix}`,
  } as const;
}
export const LETBUYY_CUSTOMER_SESSION_COOKIE = 'lb_customer_session';
/**
 * Marketplace buyer session (D-8, 2026-09-05).
 *
 * A THIRD name, deliberately. A buyer is neither a merchant nor a per-store customer: buyer auth must
 * never grant merchant rights (ART-05, SEC-R7), and a buyer spans sellers so it is not store-scoped
 * either. Reusing either existing name would put one realm's credential exactly where another's is
 * expected.
 *
 * This cookie is HOST-ONLY. cookies.ts sets a parent-domain attribute on the merchant cookie so the
 * platform apps share one login, and that same attribute here would transmit a shopper's credential
 * to admin, apps, themes, developer and console — none of which has any business receiving it. The
 * SSO convenience that justifies a parent domain for merchants is exactly what makes it wrong here.
 */
export const LETBUYY_BUYER_SESSION_COOKIE = 'lb_buyer_session';
/**
 * The header a buyer session travels in when there is no cookie to carry it: identity-platform
 * forwarding a buyer's token to the gateway, and non-browser clients. One constant for both ends,
 * so the name the gateway reads and the name its callers send cannot drift apart.
 */
export const LETBUYY_BUYER_SESSION_HEADER = 'X-LetBuyy-Buyer-Session';
/**
 * The buyer-session claim carrying buyer_accounts.session_epoch at issuance (APPID-P4a, migration
 * 257). identity-platform writes it; the gateway refuses a token whose epoch is not the account's
 * current one. One constant for both ends, for the same reason as the header above.
 */
export const LETBUYY_BUYER_SESSION_EPOCH_CLAIM = 'sep';
/** How long a platform buyer session lives: identity-platform's own cookie and the marketplace app's token alike. */
export const LETBUYY_BUYER_SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;

/**
 * A buyer's session AT ONE STOREFRONT (APPID-P4b). identity-platform mints it when a storefront
 * redeems a first-party authorization code, and it carries the site it was issued for. It is a
 * separate audience from the platform buyer session on purpose: a storefront keeps its session in a
 * cookie on the store's own host, and a merchant can repoint a custom domain at their own server, so
 * a platform-wide buyer token there would reach every seller's orders. The gateway accepts this one
 * only at its own site.
 */
export const LETBUYY_STOREFRONT_SESSION_AUDIENCE = 'letbuyy:storefront-session';
export const LETBUYY_STOREFRONT_SESSION_HEADER = 'X-LetBuyy-Storefront-Session';
export const LETBUYY_STOREFRONT_SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
/** The storefront's first-party client id and its one callback path, exact, on the store's own host. */
export const LETBUYY_STOREFRONT_CLIENT_ID = 'letbuyy-storefront';
export const LETBUYY_STOREFRONT_BUYER_CALLBACK_PATH = '/api/buyer-auth/callback';
/**
 * The marketplace app's first-party client (APPID-P4d, migration 259). A public client: it holds no
 * secret, so PKCE is what binds a code to the app that asked for it. It is platform-wide, so its code
 * names no site and it receives a platform buyer session. Its one callback uses the private-use scheme
 * that is the published applicationId reversed-domain name (RFC 8252 §7.1), with a single slash
 * because it names no host.
 */
export const LETBUYY_MARKETPLACE_APP_CLIENT_ID = 'letbuyy-marketplace-app';
export const LETBUYY_MARKETPLACE_APP_REDIRECT_URI = 'com.letbuyy.letbuyy:/oauth/callback';
export const LETBUYY_PLATFORM_SESSION_COOKIE = 'lb_console_session';
export const LETBUYY_CUSTOMER_SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
export const LETBUYY_INTERNAL_AUTH_MAX_AGE_MS = 5 * 60 * 1000;
export const LETBUYY_PLATFORM_SESSION_TTL_SECONDS = 8 * 60 * 60;
export const LETBUYY_PLATFORM_MAGIC_LINK_TTL_SECONDS = 15 * 60;
export const LETBUYY_CUSTOMER_FEDERATION_TTL_SECONDS = 15 * 60;
export const LETBUYY_PREDEFINED_ROLES: Record<LetbuyyPredefinedRole, LetbuyyRoleDefinition> = {
  Administrator: {
    name: 'Administrator',
    category: 'store',
    description: 'Full store administration for a merchant-owned site.',
  },
  Merchandiser: {
    name: 'Merchandiser',
    category: 'store',
    description: 'Catalog, inventory, content, and merchandising operations for a store.',
  },
  Support: {
    name: 'Support',
    category: 'organization',
    description: 'Organization support role for non-owner operational assistance.',
  },
  Partner: {
    name: 'Partner',
    category: 'partner',
    description: 'Partner developer or theme/app marketplace role.',
  },
  'Ops-Reviewer': {
    name: 'Ops-Reviewer',
    category: 'ops',
    description: 'Platform operations review and trust-and-safety role.',
  },
};

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
  | 'replayed'
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
  jti?: string;
  reason?: string;
}

export interface LetbuyyInternalAppHeaderInput {
  app: string;
  secret: string | null | undefined;
  nowMs?: number;
  jti?: string;
}

export interface LetbuyyInternalIdentityHeaderInput {
  userId: string;
  email: string;
  storeId?: string | null;
  secret: string | null | undefined;
  nowMs?: number;
}

export interface LetbuyyInternalSessionHeaderInput {
  sessionToken?: string | null;
  timestamp?: string | null;
  signature?: string | null;
  jti?: string | null;
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

export interface CustomerFederationSubject extends CustomerSessionSubject {
  origin?: string | null;
  returnTo?: string | null;
}

export interface LetbuyyCustomerFederationPayload {
  type: 'customer_federation';
  sub: string;
  storeId: string;
  email: string;
  name: string | null;
  origin: string | null;
  returnTo: string | null;
  iat: number;
  exp: number;
  jti: string;
}

export interface CustomerFederationTokenOptions {
  ttlSeconds?: number;
  nowSeconds?: number;
  tokenId?: string;
  origin?: string | null;
  returnTo?: string | null;
}

export interface CustomerFederationTokenStore {
  consume(tokenId: string, expiresAt: number): boolean | Promise<boolean>;
}

export type LetbuyyCustomerFederationTokenStatus = LetbuyySessionVerificationStatus | 'replayed';

export interface LetbuyyCustomerFederationVerificationResult
  extends LetbuyyPlatformTokenVerificationResult<LetbuyyCustomerFederationPayload> {}

export interface LetbuyyCustomerFederationRedemptionResult {
  accepted: boolean;
  status: LetbuyyCustomerFederationTokenStatus;
  token?: string;
  payload?: LetbuyyCustomerFederationPayload;
  customer?: CustomerSessionSubject;
  reason?: string;
}

export interface LetbuyyPlatformSessionPayload {
  type: 'platform_session';
  email: string;
  userId: string | null;
  mfaVerified: boolean;
  /** Durable Console session identity; legacy cookies lack this binding. */
  sessionId?: string;
  mfaVerifiedAt?: number | null;
  issuedAt: number;
  exp: number;
}

export interface LetbuyyPlatformMagicLinkPayload {
  type: 'platform_magic_link';
  email: string;
  exp: number;
  /** Unpredictable per-token identity (Phase 2 / Mandate 7, Section 6). Not a duplicate of `email`:
   *  this is what a single-use consumption table keys on, so replaying the SAME token twice is
   *  detected even though every field otherwise verifies -- the whole reason single-use enforcement
   *  needs its own identity, not the coarser (email, type) pair, which a legitimate second login
   *  attempt would also share. */
  jti: string;
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
export const LETBUYY_APP_AUTHORIZATION_CODE_TTL_SECONDS = 15 * 60;

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

export interface AppAuthorizationCodeSubject extends AppScopedAccessTokenSubject {
  clientId: string;
  redirectUri: string;
  state?: string | null;
}

export interface AppAuthorizationCodeOptions {
  ttlSeconds?: number;
  nowSeconds?: number;
  tokenId?: string;
}

export interface LetbuyyAppAuthorizationCodePayload {
  type: 'app_authorization_code';
  appId: string;
  clientId: string;
  installationId: string;
  storeId: string;
  installedBy: string;
  scopes: string[];
  redirectUri: string;
  state: string | null;
  iat: number;
  exp: number;
  jti: string;
}

export type AppAuthorizationCodeVerificationResult =
  LetbuyyPlatformTokenVerificationResult<LetbuyyAppAuthorizationCodePayload>;

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
  permissions?: { granted: string[] };
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
  LETBUYY_INTERNAL_API_SECRET?: string | null;
}): string | undefined {
  return env.INTERNAL_API_SECRET || env.LETBUYY_INTERNAL_API_SECRET || undefined;
}

export function isAuthUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function isSafeAuthEmail(value: string | undefined): value is string {
  return !!value && value.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function normalizeLetbuyyRoleName(value: unknown): LetbuyyPredefinedRole | null {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-');

  switch (normalized) {
    case 'administrator':
    case 'admin':
    case 'owner':
    case 'seller':
    case 'store-owner':
      return 'Administrator';
    case 'merchandiser':
    case 'editor':
    case 'staff':
    case 'catalog-manager':
      return 'Merchandiser';
    case 'support':
    case 'support-agent':
    case 'organization-support':
      return 'Support';
    case 'partner':
    case 'developer':
    case 'app-developer':
    case 'theme-developer':
      return 'Partner';
    case 'ops-reviewer':
    case 'ops':
    case 'operator':
    case 'platform-operator':
    case 'platform-employee':
    case 'super-admin':
      return 'Ops-Reviewer';
    default:
      return null;
  }
}

export function normalizeLetbuyyRoleAssignments(input: unknown): LetbuyyRoleAssignment[] {
  const candidates = Array.isArray(input) ? input : [input];
  const assignments = new Map<LetbuyyPredefinedRole, LetbuyyRoleAssignment>();

  for (const candidate of candidates) {
    const roleName = typeof candidate === 'object' && candidate !== null
      ? normalizeLetbuyyRoleName((candidate as { name?: unknown; role?: unknown; slug?: unknown }).name ?? (candidate as { role?: unknown }).role ?? (candidate as { slug?: unknown }).slug)
      : normalizeLetbuyyRoleName(candidate);

    if (!roleName) continue;

    const definition = LETBUYY_PREDEFINED_ROLES[roleName];
    assignments.set(roleName, {
      name: definition.name,
      category: definition.category,
    });
  }

  return [...assignments.values()];
}

export function getLetbuyyRoleCategories(assignments: LetbuyyRoleAssignment[]): RbacRoleCategory[] {
  return [...new Set(assignments.map((assignment) => assignment.category))].sort();
}

export function hasLetbuyyRoleCategory(assignments: LetbuyyRoleAssignment[], category: RbacRoleCategory): boolean {
  return assignments.some((assignment) => assignment.category === category);
}

export function hasAnyLetbuyyRoleCategory(assignments: LetbuyyRoleAssignment[], categories: RbacRoleCategory[]): boolean {
  return categories.some((category) => hasLetbuyyRoleCategory(assignments, category));
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

export function isSafeLetbuyyInternalJti(value: string | null | undefined): value is string {
  return Boolean(value && /^[A-Za-z0-9._~-]{16,128}$/.test(value));
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
  const jti = randomInternalJti();
  const signature = await hmacSha256Hex(secret, internalSessionSigningPayload(verification.token, timestamp, jti));

  return {
    ok: true,
    status: 'accepted',
    timestamp,
    jti,
    signature,
    headers: {
      [`${INTERNAL_SESSION_HEADER_PREFIX}-Session-Token`]: verification.token,
      [`${INTERNAL_SESSION_HEADER_PREFIX}-Timestamp`]: timestamp,
      [`${INTERNAL_SESSION_HEADER_PREFIX}-JTI`]: jti,
      [`${INTERNAL_SESSION_HEADER_PREFIX}-Signature`]: signature,
    },
  };
}

export async function createLetbuyyInternalAppHeaders(
  input: LetbuyyInternalAppHeaderInput,
): Promise<LetbuyyInternalSessionHeaderPlan> {
  if (!/^[a-z][a-z0-9-]{1,40}$/.test(input.app)) {
    return { ok: false, status: 'malformed', reason: 'Internal app name is malformed' };
  }

  if (!input.secret) {
    return { ok: false, status: 'misconfigured', reason: 'Internal auth secret is not configured' };
  }

  const timestamp = (input.nowMs ?? Date.now()).toString();
  const jti = input.jti || randomInternalJti();
  if (!isSafeLetbuyyInternalJti(jti)) {
    return { ok: false, status: 'malformed', reason: 'Internal auth replay id is malformed' };
  }

  const signature = await hmacSha256Hex(input.secret, internalAppSigningPayload(input.app, timestamp, jti));

  return {
    ok: true,
    status: 'accepted',
    timestamp,
    jti,
    signature,
    headers: {
      [`${INTERNAL_SESSION_HEADER_PREFIX}-App`]: input.app,
      [`${INTERNAL_SESSION_HEADER_PREFIX}-Timestamp`]: timestamp,
      [`${INTERNAL_SESSION_HEADER_PREFIX}-JTI`]: jti,
      [`${INTERNAL_SESSION_HEADER_PREFIX}-Signature`]: signature,
    },
  };
}

export async function createLetbuyyInternalIdentityHeaders(
  input: LetbuyyInternalIdentityHeaderInput,
): Promise<LetbuyyInternalSessionHeaderPlan> {
  if (!isAuthUuid(input.userId) || !isSafeAuthEmail(input.email)) {
    return { ok: false, status: 'malformed', reason: 'Internal identity is malformed' };
  }

  const storeId = input.storeId || '';
  if (storeId && !isAuthUuid(storeId)) {
    return { ok: false, status: 'malformed', reason: 'Internal identity store is malformed' };
  }

  if (!input.secret) {
    return { ok: false, status: 'misconfigured', reason: 'Internal auth secret is not configured' };
  }

  const timestamp = (input.nowMs ?? Date.now()).toString();
  const jti = randomInternalJti();
  const signature = await hmacSha256Hex(input.secret, internalIdentitySigningPayload(input.userId, input.email, storeId, timestamp, jti));

  return {
    ok: true,
    status: 'accepted',
    timestamp,
    jti,
    signature,
    headers: {
      [`${INTERNAL_SESSION_HEADER_PREFIX}-User-ID`]: input.userId,
      [`${INTERNAL_SESSION_HEADER_PREFIX}-Email`]: normalizeAuthEmail(input.email),
      [`${INTERNAL_SESSION_HEADER_PREFIX}-Timestamp`]: timestamp,
      [`${INTERNAL_SESSION_HEADER_PREFIX}-JTI`]: jti,
      [`${INTERNAL_SESSION_HEADER_PREFIX}-Signature`]: signature,
      ...(storeId ? { [`${INTERNAL_SESSION_HEADER_PREFIX}-Store-ID`]: storeId } : {}),
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

  if (!isSafeLetbuyyInternalJti(input.jti)) {
    return { accepted: false, status: 'malformed', kind: 'merchant', reason: 'Internal session replay id is missing or malformed' };
  }

  const signed = await verifyLetbuyySignedPayload(
    input.secret,
    internalSessionSigningPayload(verification.token, String(input.timestamp), input.jti),
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

export interface ShopperIdentityCookieContract {
  name: typeof LETBUYY_CUSTOMER_SESSION_COOKIE;
  hostOnly: true;
  sameSite: 'lax';
  path: '/';
  ttlSeconds: typeof LETBUYY_CUSTOMER_SESSION_TTL_SECONDS;
}

export interface ShopperIdentityProvider {
  readonly realm: 'storefront-host-only';
  readonly reservedFutureIssuerHost: string;
  readonly platformSessionReachable: false;
  readonly cookie: ShopperIdentityCookieContract;
  issueSessionToken(customer: CustomerSessionSubject, options?: CustomerSessionTokenOptions): Promise<string>;
  verifySessionToken(token: string | null | undefined, options?: CustomerSessionTokenOptions): Promise<LetbuyySessionVerificationResult<LetbuyyCustomerSessionPayload>>;
}

export function createHostOnlyShopperIdentityProvider(secret: string | null | undefined): ShopperIdentityProvider {
  const reservedFutureIssuerHost = ['id', 'letbuyy', 'store'].join('.');
  return {
    realm: 'storefront-host-only',
    reservedFutureIssuerHost,
    platformSessionReachable: false,
    cookie: {
      name: LETBUYY_CUSTOMER_SESSION_COOKIE,
      hostOnly: true,
      sameSite: 'lax',
      path: '/',
      ttlSeconds: LETBUYY_CUSTOMER_SESSION_TTL_SECONDS,
    },
    issueSessionToken(customer, options) {
      if (!secret) throw new Error('CUSTOMER_SESSION_SECRET is required for shopper identity');
      return createCustomerSessionToken(customer, secret, options);
    },
    verifySessionToken(token, options) {
      return verifyCustomerSessionToken(token, secret, options);
    },
  };
}

export async function createCustomerFederationToken(
  customer: CustomerFederationSubject,
  secret: string | null | undefined,
  options: CustomerFederationTokenOptions = {},
): Promise<string | null> {
  if (!secret) return null;
  const nowSeconds = options.nowSeconds ?? Math.floor(Date.now() / 1000);
  const ttlSeconds = options.ttlSeconds ?? LETBUYY_CUSTOMER_FEDERATION_TTL_SECONDS;
  return signLetbuyyJsonPayload(
    {
      type: 'customer_federation',
      sub: customer.id,
      storeId: customer.storeId,
      email: normalizeAuthEmail(customer.email),
      name: customer.fullName,
      origin: normalizeCustomerFederationUrl(options.origin ?? customer.origin),
      returnTo: normalizeCustomerFederationUrl(options.returnTo ?? customer.returnTo),
      iat: nowSeconds,
      exp: nowSeconds + ttlSeconds,
      jti: options.tokenId || crypto.randomUUID(),
    } satisfies LetbuyyCustomerFederationPayload,
    secret,
  );
}

export async function verifyCustomerFederationToken(
  token: string | null | undefined,
  secret: string | null | undefined,
  options: CustomerFederationTokenOptions = {},
): Promise<LetbuyyCustomerFederationVerificationResult> {
  return verifyLetbuyyJsonPayload(
    token,
    secret,
    isCustomerFederationPayload,
    options.nowSeconds ?? Math.floor(Date.now() / 1000),
    'Customer federation',
  );
}

export function customerSubjectFromFederationPayload(
  payload: LetbuyyCustomerFederationPayload,
): CustomerSessionSubject {
  return {
    id: payload.sub,
    storeId: payload.storeId,
    email: payload.email,
    fullName: payload.name,
  };
}

export async function redeemCustomerFederationToken(
  token: string | null | undefined,
  secret: string | null | undefined,
  store: CustomerFederationTokenStore,
  options: CustomerFederationTokenOptions = {},
): Promise<LetbuyyCustomerFederationRedemptionResult> {
  const verification = await verifyCustomerFederationToken(token, secret, options);
  if (!verification.accepted || !verification.payload) {
    return {
      accepted: false,
      status: verification.status,
      token: verification.token,
      reason: verification.reason,
    };
  }

  let consumed = false;
  try {
    consumed = await store.consume(verification.payload.jti, verification.payload.exp);
  } catch {
    return {
      accepted: false,
      status: 'misconfigured',
      token: verification.token,
      payload: verification.payload,
      reason: 'Customer federation token store rejected the consume operation',
    };
  }

  if (!consumed) {
    return {
      accepted: false,
      status: 'replayed',
      token: verification.token,
      payload: verification.payload,
      reason: 'Customer federation token was already redeemed',
    };
  }

  return {
    accepted: true,
    status: 'accepted',
    token: verification.token,
    payload: verification.payload,
    customer: customerSubjectFromFederationPayload(verification.payload),
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
      sessionId: crypto.randomUUID(),
      mfaVerifiedAt: input.mfaVerified ? nowSeconds : null,
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
  options: LetbuyyPlatformSessionTokenOptions & { jti?: string } = {},
): Promise<string | null> {
  if (!secret) return null;
  const nowSeconds = options.nowSeconds ?? Math.floor(Date.now() / 1000);
  const ttlSeconds = options.ttlSeconds ?? LETBUYY_PLATFORM_MAGIC_LINK_TTL_SECONDS;
  return signLetbuyyJsonPayload(
    {
      type: 'platform_magic_link',
      email: normalizeAuthEmail(email),
      exp: nowSeconds + ttlSeconds,
      jti: options.jti ?? crypto.randomUUID(),
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

export async function createAppAuthorizationCode(
  subject: AppAuthorizationCodeSubject,
  secret: string,
  options: AppAuthorizationCodeOptions = {},
): Promise<string> {
  const nowSeconds = options.nowSeconds ?? Math.floor(Date.now() / 1000);
  const ttlSeconds = options.ttlSeconds ?? LETBUYY_APP_AUTHORIZATION_CODE_TTL_SECONDS;
  const scopes = normalizeAppAccessScopes(subject.scopes);

  return signLetbuyyJsonPayload(
    {
      type: 'app_authorization_code',
      appId: subject.appId,
      clientId: subject.clientId,
      installationId: subject.installationId,
      storeId: subject.storeId,
      installedBy: subject.installedBy,
      scopes,
      redirectUri: subject.redirectUri,
      state: subject.state || null,
      iat: nowSeconds,
      exp: nowSeconds + ttlSeconds,
      jti: options.tokenId || crypto.randomUUID(),
    } satisfies LetbuyyAppAuthorizationCodePayload,
    secret,
  );
}

export async function verifyAppAuthorizationCode(
  code: string | null | undefined,
  secret: string | null | undefined,
  options: AppAuthorizationCodeOptions = {},
): Promise<AppAuthorizationCodeVerificationResult> {
  return verifyLetbuyyJsonPayload(
    code,
    secret,
    isAppAuthorizationCodePayload,
    options.nowSeconds ?? Math.floor(Date.now() / 1000),
    'App authorization code',
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

export function internalAppSigningPayload(app: string, timestamp: string, jti: string): string {
  return `app.${app}.${timestamp}.${jti}`;
}

export function internalIdentitySigningPayload(userId: string, email: string, storeId: string, timestamp: string, jti: string): string {
  return `${userId}.${normalizeAuthEmail(email)}.${storeId}.${timestamp}.${jti}`;
}

function internalSessionSigningPayload(sessionToken: string, timestamp: string, jti: string): string {
  return `session.${sessionToken}.${timestamp}.${jti}`;
}

function randomInternalJti(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
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

function normalizeCustomerFederationUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized || normalized.length > 2048 || /[\u0000-\u001F\u007F]/.test(normalized)) {
    return null;
  }
  return normalized;
}

function isCustomerSessionPayload(value: LetbuyyCustomerSessionPayload): value is LetbuyyCustomerSessionPayload {
  // Phase I4 (IRT-6): sub/storeId now reuse the primary verifier's own
  // normalizeCustomerSessionId (customer-session.ts) instead of a second,
  // weaker hand-written length/type check -- that duplication is how this
  // legacy path ended up strictly more permissive than the primary one.
  return Boolean(
    value &&
    normalizeCustomerSessionId(value.sub) &&
    normalizeCustomerSessionId(value.storeId) &&
    isSafeAuthEmail(value.email) &&
    (value.name === null || typeof value.name === 'string') &&
    Number.isFinite(value.iat) &&
    Number.isFinite(value.exp),
  );
}

function isCustomerFederationPayload(value: unknown): value is LetbuyyCustomerFederationPayload {
  const payload = value as LetbuyyCustomerFederationPayload;
  return Boolean(
    payload &&
    payload.type === 'customer_federation' &&
    typeof payload.sub === 'string' &&
    payload.sub.length > 0 &&
    typeof payload.storeId === 'string' &&
    payload.storeId.length > 0 &&
    isSafeAuthEmail(payload.email) &&
    (payload.name === null || typeof payload.name === 'string') &&
    (payload.origin === null || typeof payload.origin === 'string') &&
    (payload.returnTo === null || typeof payload.returnTo === 'string') &&
    Number.isFinite(payload.iat) &&
    Number.isFinite(payload.exp) &&
    typeof payload.jti === 'string' &&
    payload.jti.length > 0,
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
    (payload.sessionId === undefined || (typeof payload.sessionId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payload.sessionId))) &&
    (payload.mfaVerifiedAt === undefined || payload.mfaVerifiedAt === null ||
      (payload.mfaVerified && Number.isSafeInteger(payload.mfaVerifiedAt) && payload.mfaVerifiedAt >= payload.issuedAt && payload.mfaVerifiedAt < payload.exp)) &&
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
    Number.isFinite(payload.exp) &&
    typeof payload.jti === 'string' &&
    payload.jti.length >= 16,
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

function isAppAuthorizationCodePayload(value: unknown): value is LetbuyyAppAuthorizationCodePayload {
  const payload = value as LetbuyyAppAuthorizationCodePayload;
  return Boolean(
    payload &&
    payload.type === 'app_authorization_code' &&
    typeof payload.appId === 'string' &&
    payload.appId.length > 0 &&
    typeof payload.clientId === 'string' &&
    payload.clientId.length > 0 &&
    typeof payload.installationId === 'string' &&
    payload.installationId.length > 0 &&
    typeof payload.storeId === 'string' &&
    payload.storeId.length > 0 &&
    typeof payload.installedBy === 'string' &&
    payload.installedBy.length > 0 &&
    Array.isArray(payload.scopes) &&
    payload.scopes.every((scope) => typeof scope === 'string') &&
    typeof payload.redirectUri === 'string' &&
    payload.redirectUri.length > 0 &&
    (payload.state === null || typeof payload.state === 'string') &&
    Number.isFinite(payload.iat) &&
    Number.isFinite(payload.exp) &&
    typeof payload.jti === 'string' &&
    payload.jti.length > 0,
  );
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

export const LETBUYY_STAFF_INVITATION_TTL_MS = 24 * 60 * 60 * 1000;
const STAFF_INVITE_PREFIX = 'lb-staff-invite-v1';
export async function createMerchantStaffInvitationToken(inviteId: string, secret: string): Promise<string> {
  if (!isAuthUuid(inviteId) || secret.length < 32) throw new Error('Staff invitation signing is unavailable');
  const payload = `${STAFF_INVITE_PREFIX}.${inviteId}`;
  return `${payload}.${await hmacSha256Hex(secret, payload)}`;
}
export async function verifyMerchantStaffInvitationToken(token: unknown, secret: string): Promise<string | null> {
  if (typeof token !== 'string' || secret.length < 32) return null;
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== STAFF_INVITE_PREFIX || !isAuthUuid(parts[1]) || !/^[a-f0-9]{64}$/.test(parts[2])) return null;
  const expected = await createMerchantStaffInvitationToken(parts[1], secret);
  return timingSafeEqualHex(expected.split('.')[2], parts[2]) ? parts[1] : null;
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

/**
 * What a store owner may give their own staff (APPID-P5b): the store roles and permission keys the
 * merchant app offers (apps/merchant/web/src/lib/staff/roles.ts), and nothing else. A store's staff
 * row lives in the same `employees` table as the platform's own staff; these bounds keep a merchant
 * from writing a platform role or scope into it. The platform RBAC ignores store rows regardless.
 */
export const LETBUYY_STORE_STAFF_ROLES = ['manager', 'editor', 'fulfillment', 'marketing', 'support', 'viewer', 'staff'] as const;
export const LETBUYY_STORE_STAFF_PERMISSIONS = [
  'products:read', 'products:write', 'orders:read', 'orders:write', 'customers:read', 'customers:write',
  'content:write', 'marketing:write', 'shipping:write', 'returns:write', 'reports:read', 'settings:write',
] as const;

/** Server-owned defaults for the maintained staff role choices. Explicit
 * owner-selected store grants remain supported; unknown/platform roles grant nothing. */
export const LETBUYY_STORE_STAFF_ROLE_PERMISSIONS: Readonly<Record<(typeof LETBUYY_STORE_STAFF_ROLES)[number], readonly string[]>> = {
  manager: ['products:write','orders:write','customers:write','content:write','marketing:write','shipping:write','returns:write','reports:read','settings:write'],
  editor: ['products:write','content:write','reports:read'],
  fulfillment: ['orders:write','shipping:write','reports:read'],
  marketing: ['marketing:write','customers:read','reports:read'],
  support: ['orders:read','customers:write','returns:write'],
  viewer: ['products:read','orders:read','reports:read'],
  staff: [],
};
export function permissionsForStoreStaffRole(value: string): { granted: string[] } {
  return { granted: isStoreStaffRole(value) ? [...LETBUYY_STORE_STAFF_ROLE_PERMISSIONS[value]] : [] };
}

function isStoreStaffRole(value: unknown): value is (typeof LETBUYY_STORE_STAFF_ROLES)[number] {
  return typeof value === 'string' && (LETBUYY_STORE_STAFF_ROLES as readonly string[]).includes(value);
}

// Shared by planEmployeeStaffCreate and planEmployeeUpdate: { granted: [...] }, store permission
// keys only, no extra properties on the wrapper object. Absent (undefined) is a valid "no opinion"
// signal: role changes and creates use the server-owned default for the chosen role.
function parseStaffPermissions(body: Record<string, unknown>): AuthPlanResult<{ granted: string[] } | undefined> {
  if (body.permissions === undefined) return { ok: true, value: undefined };
  const permissions = body.permissions as { granted?: unknown } | null;
  const granted = permissions && typeof permissions === 'object' && !Array.isArray(permissions) ? permissions.granted : undefined;
  const onlyGranted = permissions && typeof permissions === 'object' && Object.keys(permissions).every((key) => key === 'granted');
  if (!onlyGranted || !Array.isArray(granted)
    || granted.some((key) => typeof key !== 'string' || !(LETBUYY_STORE_STAFF_PERMISSIONS as readonly string[]).includes(key))) {
    return { ok: false, message: 'permissions must be { granted: [...] } with store permission keys only' };
  }
  return { ok: true, value: { granted: [...new Set(granted as string[])] } };
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

  if (body.role !== undefined && body.role !== null && body.role !== '' && !isStoreStaffRole(body.role)) {
    return { ok: false, message: `role must be one of ${LETBUYY_STORE_STAFF_ROLES.join(', ')}` };
  }
  const role = isStoreStaffRole(body.role) ? body.role : 'editor';

  // Phase 2 / F2.5: the merchant-web create form already computes and sends
  // permissions: permissionsForRole(role) -- this was silently dropped here, so every staff member
  // ever created through the real product UI got employees.permissions = {} (the column default)
  // regardless of the role chosen, making the fail-closed RBAC gate (staff-permission.ts) refuse
  // every action for every new hire. Validated with the identical rule planEmployeeUpdate already
  // enforces, not a looser one for create.
  const permissionsResult = parseStaffPermissions(body);
  if (!permissionsResult.ok) return permissionsResult;
  if (body.full_name !== undefined && (typeof body.full_name !== 'string' || body.full_name.trim().length > 120)) {
    return { ok: false, message: 'full_name must be text of at most 120 characters' };
  }

  return {
    ok: true,
    value: {
      store_id: storeId,
      email,
      full_name: typeof body.full_name === 'string' && body.full_name.trim() ? body.full_name.trim() : email,
      role,
      status: 'invited',
      is_active: true,
      created_by: createdBy,
      permissions: permissionsResult.value ?? permissionsForStoreStaffRole(role),
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

export function planEmployeeUpdate(body: Record<string, unknown>): AuthPlanResult<Record<string, unknown>> {
  const updates: Record<string, unknown> = {};
  if (body.role !== undefined) {
    if (!isStoreStaffRole(body.role)) {
      return { ok: false, message: `role must be one of ${LETBUYY_STORE_STAFF_ROLES.join(', ')}` };
    }
    updates.role = body.role;
    if (body.permissions === undefined) updates.permissions = permissionsForStoreStaffRole(body.role);
  }
  if (body.permissions !== undefined) {
    const permissionsResult = parseStaffPermissions(body);
    if (!permissionsResult.ok) return permissionsResult;
    updates.permissions = permissionsResult.value;
  }
  if (Object.keys(updates).length === 0) {
    return { ok: false, message: 'role or permissions required' };
  }
  return { ok: true, value: updates };
}

export function employeeRemovalPatch(deletedAt: string): Record<string, unknown> {
  return { deleted_at: deletedAt, status: 'removed', is_active: false };
}


// Commerce's two server-owned store-access operations use a distinct, request-bound
// capability. This never represents a buyer/merchant session or another internal API.
export const STOREFRONT_INTERNAL_CALLER = 'commerce-storefront';
export const STOREFRONT_INTERNAL_REQUEST_VERSION = 'storefront-request-v1';
export const STOREFRONT_INTERNAL_REQUEST_MAX_AGE_MS = 60_000;
export const STOREFRONT_INTERNAL_REQUEST_MAX_BODY_BYTES = 8192;

export function isBoundStorefrontRequestTarget(method: string, url: string): boolean {
  try {
    const target = new URL(url);
    return (method === 'GET' && target.pathname === '/v1/internal/store-access/resolve')
      || (method === 'POST' && target.pathname === '/v1/internal/store-access/verify');
  } catch { return false; }
}

async function boundStorefrontSigningPayload(input: {
  method: string; url: string; body?: string | Uint8Array; timestamp: string; jti: string;
}): Promise<string | null> {
  if (!isBoundStorefrontRequestTarget(input.method, input.url)) return null;
  const bytes = typeof input.body === 'string' ? new TextEncoder().encode(input.body) : new Uint8Array(input.body ?? []);
  if (bytes.byteLength > STOREFRONT_INTERNAL_REQUEST_MAX_BODY_BYTES || input.method === 'GET' && bytes.byteLength !== 0) return null;
  const target = new URL(input.url);
  const digest = bytesToHex(await crypto.subtle.digest('SHA-256', bytes));
  return JSON.stringify([STOREFRONT_INTERNAL_REQUEST_VERSION, STOREFRONT_INTERNAL_CALLER, 'storefront',
    input.method, target.pathname + target.search, digest, input.timestamp, input.jti]);
}

export async function createBoundStorefrontRequestHeaders(input: {
  secret: string; method: string; url: string; body?: string; nowMs?: number; jti?: string;
}): Promise<Record<string, string>> {
  if (input.secret.trim().length < 32) throw new Error('Dedicated storefront request secret is not configured');
  const timestamp = String(input.nowMs ?? Date.now()), jti = input.jti ?? randomInternalJti();
  if (!/^\d{13}$/.test(timestamp) || !isSafeLetbuyyInternalJti(jti)) throw new Error('Invalid storefront request metadata');
  const payload = await boundStorefrontSigningPayload({ ...input, timestamp, jti });
  if (!payload) throw new Error('Unsupported storefront internal request');
  return {
    'X-LetBuyy-Internal-Version': STOREFRONT_INTERNAL_REQUEST_VERSION,
    'X-LetBuyy-Internal-Caller': STOREFRONT_INTERNAL_CALLER,
    'X-LetBuyy-Internal-App': 'storefront',
    'X-LetBuyy-Internal-Timestamp': timestamp,
    'X-LetBuyy-Internal-JTI': jti,
    'X-LetBuyy-Internal-Signature': await hmacSha256Hex(input.secret, payload),
  };
}

export async function verifyBoundStorefrontRequestSignature(input: {
  secret: string | undefined; method: string; url: string; body?: Uint8Array;
  headers: Headers; nowMs?: number;
}): Promise<{ status: 'accepted'; jti: string } | { status: 'misconfigured' | 'malformed' | 'expired' | 'invalid' }> {
  if (!input.secret || input.secret.trim().length < 32) return { status: 'misconfigured' };
  const timestamp = input.headers.get('X-LetBuyy-Internal-Timestamp'), jti = input.headers.get('X-LetBuyy-Internal-JTI');
  if (input.headers.get('X-LetBuyy-Internal-Version') !== STOREFRONT_INTERNAL_REQUEST_VERSION
    || input.headers.get('X-LetBuyy-Internal-Caller') !== STOREFRONT_INTERNAL_CALLER
    || input.headers.get('X-LetBuyy-Internal-App') !== 'storefront'
    || !timestamp || !/^\d{13}$/.test(timestamp) || !isSafeLetbuyyInternalJti(jti)) return { status: 'malformed' };
  if (!isFreshLetbuyyInternalTimestamp(timestamp, input.nowMs, STOREFRONT_INTERNAL_REQUEST_MAX_AGE_MS)) return { status: 'expired' };
  const payload = await boundStorefrontSigningPayload({ ...input, timestamp, jti });
  const signature = input.headers.get('X-LetBuyy-Internal-Signature');
  if (!payload || !signature || !/^[a-f0-9]{64}$/.test(signature)
    || !timingSafeEqualHex(await hmacSha256Hex(input.secret, payload), signature)) return { status: 'invalid' };
  return { status: 'accepted', jti };
}


// One queue-owned platform job. This capability cannot represent an Identity app.
export const DOMAIN_RECONCILE_INTERNAL_CALLER = 'queue-workers-domain-reconcile';
export const DOMAIN_RECONCILE_REQUEST_VERSION = 'domain-reconcile-request-v1';
export const DOMAIN_RECONCILE_REQUEST_MAX_AGE_MS = 120_000;
export const DOMAIN_RECONCILE_REQUEST_MAX_BODY_BYTES = 512;
export type DomainReconcileEnvironment = 'development' | 'staging' | 'production';
export function domainReconcileEnvironment(flags: { ENVIRONMENT?: string; APP_ENV?: string; DEPLOYMENT_ENV?: string }): DomainReconcileEnvironment | undefined {
  const environment = flags.ENVIRONMENT;
  if (!['development', 'staging', 'production'].includes(environment || '')
    || [flags.APP_ENV, flags.DEPLOYMENT_ENV].some(value => value !== undefined && value !== environment)) return undefined;
  return environment as DomainReconcileEnvironment;
}
export function isBoundDomainReconcileTarget(method: string, url: string): boolean {
  try { const target = new URL(url); return method === 'POST' && target.pathname === '/v1/internal/custom-domain-reconcile/run'; }
  catch { return false; }
}
function validDomainReconcileSecret(secret: string | undefined): secret is string {
  return Boolean(secret && secret.trim().length >= 32 && !/SKIP_NEEDS_HUMAN|replace-with/i.test(secret));
}
async function domainReconcilePayload(input: { environment: DomainReconcileEnvironment; method: string; url: string;
  body?: string | Uint8Array; timestamp: string; jti: string }): Promise<string | null> {
  if (!isBoundDomainReconcileTarget(input.method, input.url) || !domainReconcileEnvironment({ ENVIRONMENT: input.environment })) return null;
  const bytes = typeof input.body === 'string' ? new TextEncoder().encode(input.body) : new Uint8Array(input.body ?? []);
  if (bytes.byteLength > DOMAIN_RECONCILE_REQUEST_MAX_BODY_BYTES) return null;
  const target = new URL(input.url);
  if (!['https:', 'http:'].includes(target.protocol) || target.username || target.password) return null;
  return JSON.stringify([DOMAIN_RECONCILE_REQUEST_VERSION, DOMAIN_RECONCILE_INTERNAL_CALLER, 'api-gateway:domain-reconcile', input.environment,
    input.method, target.pathname + target.search, bytesToHex(await crypto.subtle.digest('SHA-256', bytes)), input.timestamp, input.jti]);
}
export async function createBoundDomainReconcileHeaders(input: { secret: string; environment: DomainReconcileEnvironment;
  method: string; url: string; body?: string; nowMs?: number; jti?: string }): Promise<Record<string, string>> {
  if (!validDomainReconcileSecret(input.secret)) throw new Error('Dedicated domain reconciliation secret is not configured');
  const timestamp = String(input.nowMs ?? Date.now()), jti = input.jti ?? randomInternalJti();
  if (!/^\d{13}$/.test(timestamp) || !isSafeLetbuyyInternalJti(jti)) throw new Error('Invalid domain reconciliation request metadata');
  const payload = await domainReconcilePayload({ ...input, timestamp, jti });
  if (!payload) throw new Error('Unsupported domain reconciliation request');
  return { 'X-LetBuyy-Internal-Version': DOMAIN_RECONCILE_REQUEST_VERSION, 'X-LetBuyy-Internal-Caller': DOMAIN_RECONCILE_INTERNAL_CALLER,
    'X-LetBuyy-Internal-App': 'api-gateway:domain-reconcile', 'X-LetBuyy-Internal-Environment': input.environment,
    'X-LetBuyy-Internal-Timestamp': timestamp, 'X-LetBuyy-Internal-JTI': jti,
    'X-LetBuyy-Internal-Signature': await hmacSha256Hex(input.secret, payload) };
}
export async function verifyBoundDomainReconcileSignature(input: { secret: string | undefined; environment: DomainReconcileEnvironment;
  method: string; url: string; body?: Uint8Array; headers: Headers; nowMs?: number }):
  Promise<{ status: 'accepted'; jti: string } | { status: 'misconfigured' | 'malformed' | 'expired' | 'invalid' }> {
  if (!validDomainReconcileSecret(input.secret) || !domainReconcileEnvironment({ ENVIRONMENT: input.environment })) return { status: 'misconfigured' };
  const timestamp = input.headers.get('X-LetBuyy-Internal-Timestamp'), jti = input.headers.get('X-LetBuyy-Internal-JTI');
  if (input.headers.get('X-LetBuyy-Internal-Version') !== DOMAIN_RECONCILE_REQUEST_VERSION
    || input.headers.get('X-LetBuyy-Internal-Caller') !== DOMAIN_RECONCILE_INTERNAL_CALLER
    || input.headers.get('X-LetBuyy-Internal-App') !== 'api-gateway:domain-reconcile'
    || input.headers.get('X-LetBuyy-Internal-Environment') !== input.environment
    || !timestamp || !/^\d{13}$/.test(timestamp) || !isSafeLetbuyyInternalJti(jti)) return { status: 'malformed' };
  if (!isFreshLetbuyyInternalTimestamp(timestamp, input.nowMs, DOMAIN_RECONCILE_REQUEST_MAX_AGE_MS)) return { status: 'expired' };
  const payload = await domainReconcilePayload({ ...input, timestamp, jti });
  const signature = input.headers.get('X-LetBuyy-Internal-Signature');
  if (!payload || !signature || !/^[a-f0-9]{64}$/.test(signature)
    || !timingSafeEqualHex(await hmacSha256Hex(input.secret, payload), signature)) return { status: 'invalid' };
  return { status: 'accepted', jti };
}

export * from './merchant-buyer-connection';
export * from './merchant-native';

export const NOTIFICATION_REQUEST_PATH = '/v1/internal/notification-jobs/execute';
export const NOTIFICATION_REQUEST_MAX_BYTES = 512_000;
export const NOTIFICATION_REQUEST_MAX_AGE_MS = 120_000;
export const NOTIFICATION_INTERNAL_CALLER = 'queue-workers-notifications';
const VERSION = 'notification-job-request-v1';
type NotificationRequestEnvironment = 'development' | 'staging' | 'production';
type NotificationRequestInput = { secret: string | undefined; environment: NotificationRequestEnvironment; method: string; url: string; body: Uint8Array };
const validNotificationRequestSecret = (secret: string | undefined): secret is string => !!secret && secret.trim().length >= 32 && !/placeholder|replace-with|skip_needs_human/i.test(secret);
export function isNotificationRequestTarget(method: string, url: string): boolean {
  try { const u = new URL(url); return method === 'POST' && u.pathname === NOTIFICATION_REQUEST_PATH && !u.search && !u.hash && !u.username && !u.password; }
  catch { return false; }
}
async function notificationRequestSignature(input: NotificationRequestInput, timestamp: string, jti: string) {
  if (!validNotificationRequestSecret(input.secret) || !isNotificationRequestTarget(input.method, input.url)
    || !['development', 'staging', 'production'].includes(input.environment) || input.body.byteLength > NOTIFICATION_REQUEST_MAX_BYTES) return null;
  // Domain separation grants no Identity, app-session or other internal signature.
  const key = await hmacSha256Hex(input.secret, 'letbuyy:queue-notification-transport:v1');
  const digest = bytesToHex(await crypto.subtle.digest('SHA-256', new Uint8Array(input.body).buffer));
  return hmacSha256Hex(key, JSON.stringify([VERSION, NOTIFICATION_INTERNAL_CALLER, 'api-gateway:notification-jobs',
    input.environment, input.method, NOTIFICATION_REQUEST_PATH, digest, timestamp, jti]));
}
export async function createNotificationRequestHeaders(input: NotificationRequestInput & { nowMs?: number; jti?: string }) {
  const timestamp = String(input.nowMs ?? Date.now()), jti = input.jti ?? crypto.randomUUID();
  if (!/^\d{13}$/.test(timestamp) || !isSafeLetbuyyInternalJti(jti)) throw new Error('Invalid notification request metadata');
  const signed = await notificationRequestSignature(input, timestamp, jti);
  if (!signed) throw new Error('Notification transport is not configured');
  return { 'Content-Type': 'application/json', 'X-LetBuyy-Notification-Version': VERSION,
    'X-LetBuyy-Notification-Environment': input.environment, 'X-LetBuyy-Notification-Timestamp': timestamp,
    'X-LetBuyy-Notification-JTI': jti, 'X-LetBuyy-Notification-Signature': signed };
}
export async function verifyNotificationRequest(input: NotificationRequestInput & { headers: Headers; nowMs?: number }):
  Promise<{ status: 'accepted'; jti: string } | { status: 'denied' | 'unavailable' }> {
  if (!validNotificationRequestSecret(input.secret)) return { status: 'unavailable' };
  const timestamp = input.headers.get('X-LetBuyy-Notification-Timestamp'), jti = input.headers.get('X-LetBuyy-Notification-JTI');
  if (input.headers.get('X-LetBuyy-Notification-Version') !== VERSION
    || input.headers.get('X-LetBuyy-Notification-Environment') !== input.environment
    || !timestamp || !/^\d{13}$/.test(timestamp) || !isSafeLetbuyyInternalJti(jti)
    || !isFreshLetbuyyInternalTimestamp(timestamp, input.nowMs, NOTIFICATION_REQUEST_MAX_AGE_MS)) return { status: 'denied' };
  const actual = input.headers.get('X-LetBuyy-Notification-Signature'), expected = await notificationRequestSignature(input, timestamp, jti);
  return actual && /^[a-f0-9]{64}$/.test(actual) && expected && timingSafeEqualHex(expected, actual)
    ? { status: 'accepted', jti } : { status: 'denied' };
}

// Fixed product-import recovery transport. A dedicated key grants this one
// operation only; it is never accepted as Identity, Console or app authority.
export const PRODUCT_IMPORT_INTERNAL_CALLER = 'queue-workers-product-import';
export const PRODUCT_IMPORT_REQUEST_PATH = '/v1/internal/product-import/run';
export const PRODUCT_IMPORT_REQUEST_MAX_BYTES = 64;
export const PRODUCT_IMPORT_REQUEST_MAX_AGE_MS = 120_000;
const PRODUCT_IMPORT_REQUEST_VERSION = 'product-import-request-v1';
export function isProductImportRequestTarget(method: string, url: string): boolean {
  try { const u = new URL(url); return method === 'POST' && u.pathname === PRODUCT_IMPORT_REQUEST_PATH
    && !u.search && !u.hash && !u.username && !u.password && ['https:', 'http:'].includes(u.protocol); }
  catch { return false; }
}
export function validProductImportRequestSecret(secret: string | undefined): secret is string {
  return !!secret && secret.trim().length >= 32 && !/placeholder|replace-with|skip_needs_human/i.test(secret);
}
type ProductImportRequestInput = { secret: string | undefined; environment: DomainReconcileEnvironment;
  method: string; url: string; body: Uint8Array };
async function productImportRequestSignature(input: ProductImportRequestInput, timestamp: string, jti: string) {
  if (!validProductImportRequestSecret(input.secret) || !isProductImportRequestTarget(input.method,input.url)
    || !domainReconcileEnvironment({ENVIRONMENT:input.environment}) || input.body.byteLength > PRODUCT_IMPORT_REQUEST_MAX_BYTES) return null;
  const key = await hmacSha256Hex(input.secret,'letbuyy:queue-product-import-transport:v1');
  const digest = bytesToHex(await crypto.subtle.digest('SHA-256',new Uint8Array(input.body).buffer));
  return hmacSha256Hex(key,JSON.stringify([PRODUCT_IMPORT_REQUEST_VERSION,PRODUCT_IMPORT_INTERNAL_CALLER,
    'api-gateway:product-import',input.environment,input.method,PRODUCT_IMPORT_REQUEST_PATH,digest,timestamp,jti]));
}
export async function createProductImportRequestHeaders(input: ProductImportRequestInput & {nowMs?:number;jti?:string}) {
  const timestamp = String(input.nowMs ?? Date.now()), jti = input.jti ?? crypto.randomUUID();
  if (!/^\d{13}$/.test(timestamp) || !isSafeLetbuyyInternalJti(jti)) throw new Error('Invalid import request metadata');
  const signature = await productImportRequestSignature(input,timestamp,jti);
  if (!signature) throw new Error('Product import transport is not configured');
  return {'Content-Type':'application/json','X-LetBuyy-Internal-Version':PRODUCT_IMPORT_REQUEST_VERSION,
    'X-LetBuyy-Internal-Caller':PRODUCT_IMPORT_INTERNAL_CALLER,'X-LetBuyy-Internal-App':'api-gateway:product-import',
    'X-LetBuyy-Internal-Environment':input.environment,'X-LetBuyy-Internal-Timestamp':timestamp,
    'X-LetBuyy-Internal-JTI':jti,'X-LetBuyy-Internal-Signature':signature};
}
export async function verifyProductImportRequest(input: ProductImportRequestInput & {headers:Headers;nowMs?:number}):
 Promise<{status:'accepted';jti:string}|{status:'denied'|'unavailable'}> {
  if (!validProductImportRequestSecret(input.secret)) return {status:'unavailable'};
  const timestamp = input.headers.get('X-LetBuyy-Internal-Timestamp'),jti = input.headers.get('X-LetBuyy-Internal-JTI');
  if (input.headers.get('X-LetBuyy-Internal-Version') !== PRODUCT_IMPORT_REQUEST_VERSION
    || input.headers.get('X-LetBuyy-Internal-Caller') !== PRODUCT_IMPORT_INTERNAL_CALLER
    || input.headers.get('X-LetBuyy-Internal-App') !== 'api-gateway:product-import'
    || input.headers.get('X-LetBuyy-Internal-Environment') !== input.environment
    || !timestamp || !/^\d{13}$/.test(timestamp) || !isSafeLetbuyyInternalJti(jti)
    || !isFreshLetbuyyInternalTimestamp(timestamp,input.nowMs,PRODUCT_IMPORT_REQUEST_MAX_AGE_MS)) return {status:'denied'};
  const actual=input.headers.get('X-LetBuyy-Internal-Signature'),expected=await productImportRequestSignature(input,timestamp,jti);
  return actual && /^[a-f0-9]{64}$/.test(actual) && expected && timingSafeEqualHex(expected,actual)
    ? {status:'accepted',jti}:{status:'denied'};
}
