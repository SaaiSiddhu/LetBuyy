import { z } from 'zod';

export const UuidSchema = z.string().uuid('Must be a valid UUID');

export const PaginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.string().max(50).optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const IdParam = z.object({
  id: UuidSchema,
});

export const SlugSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Slug must be lowercase with hyphens only');

export const EmailSchema = z.string().email().max(320).toLowerCase();

export const PhoneSchema = z
  .string()
  .regex(/^\+[1-9]\d{6,14}$/, 'Phone must be E.164 format: +XXXXXXXXXXX')
  .optional();

export const UrlSchema = z.string().url().max(2000);

export const MoneySchema = z
  .number()
  .min(0, 'Amount cannot be negative')
  .max(99_999_999.99, 'Amount exceeds maximum');

export const CurrencySchema = z.string().length(3).toUpperCase().default('INR');

export const AddressSchema = z.object({
  line1: z.string().min(1).max(500),
  line2: z.string().max(500).optional(),
  city: z.string().min(1).max(100),
  state: z.string().min(1).max(100),
  zip: z.string().min(3).max(20),
  country: z.string().length(2).toUpperCase().default('IN'),
});

export const SeoSchema = z.object({
  seo_title: z.string().max(70).optional(),
  seo_description: z.string().max(160).optional(),
  og_image_url: UrlSchema.optional(),
});

export type PaginationQueryInput = z.infer<typeof PaginationQuery>;
export type AddressInput = z.infer<typeof AddressSchema>;
export type CurrencyCode = z.infer<typeof CurrencySchema>;

export interface Address {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  phone?: string;
}

export interface ApiResponse<T> {
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  has_more: boolean;
}

export type JsonRecord = Record<string, unknown>;
