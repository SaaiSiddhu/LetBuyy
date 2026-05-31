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

export function isAuthUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(value);
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
