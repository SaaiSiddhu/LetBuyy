import { z } from 'zod';
import { EmailSchema } from './common.schema';

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
