import { z } from 'zod';
import { UuidSchema, EmailSchema, PaginationQuery } from './common.schema';

export const CreateCustomerSchema = z.object({
    store_id: UuidSchema,
    email: EmailSchema,
    first_name: z.string().min(1).max(100).trim(),
    last_name: z.string().max(100).trim().optional(),
    phone: z.string().max(20).optional(),
    notes: z.string().max(1000).optional(),
    tags: z.array(z.string().max(50)).max(20).default([]),
    accepts_marketing: z.boolean().default(false),
});

export const UpdateCustomerSchema = z.object({
    first_name: z.string().min(1).max(100).trim().optional(),
    last_name: z.string().max(100).trim().optional(),
    phone: z.string().max(20).optional(),
    notes: z.string().max(1000).optional(),
    tags: z.array(z.string().max(50)).max(20).optional(),
    accepts_marketing: z.boolean().optional(),
});

export const CreateCustomerAddressSchema = z.object({
    store_id: UuidSchema,
    customer_phone: z.string().max(20).optional(),
    full_name: z.string().min(1).max(200).trim(),
    address_line1: z.string().min(1).max(500),
    address_line2: z.string().max(500).optional().nullable(),
    city: z.string().min(1).max(100),
    state: z.string().min(1).max(100),
    postal_code: z.string().min(3).max(20),
    country: z.string().length(2).toUpperCase().default('IN'),
    landmark: z.string().max(255).optional().nullable(),
    is_default: z.boolean().default(false),
    label: z.string().max(50).optional(), // 'home', 'work', etc.
});

export const ListCustomersQuery = PaginationQuery.extend({
    store_id: UuidSchema.optional(),
    search: z.string().max(200).optional(),
    tag: z.string().max(50).optional(),
    has_orders: z.coerce.boolean().optional(),
});
