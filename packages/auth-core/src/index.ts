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
