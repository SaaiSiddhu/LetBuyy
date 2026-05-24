import { z } from 'zod';
import { UuidSchema, MoneySchema, PaginationQuery } from './common.schema';

export const CreateCouponSchema = z.object({
    store_id: UuidSchema,
    code: z.string().min(3).max(50).toUpperCase().regex(/^[A-Z0-9_-]+$/, 'Code must be alphanumeric'),
    description: z.string().max(500).optional(),
    type: z.enum(['percentage', 'fixed', 'free_shipping']),
    value: z.number().min(0),
    minimum_order_amount: MoneySchema.optional(),
    maximum_discount: MoneySchema.optional(),
    usage_limit: z.number().int().min(1).optional(),
    per_customer_limit: z.number().int().min(1).default(1),
    applicable_products: z.array(UuidSchema).max(100).optional(),
    applicable_categories: z.array(z.string().max(100)).max(20).optional(),
    starts_at: z.coerce.date().optional(),
    expires_at: z.coerce.date().optional(),
    is_active: z.boolean().default(true),
}).refine(
    (d) => d.type !== 'percentage' || (d.value >= 0 && d.value <= 100),
    { message: 'Percentage discount must be between 0 and 100', path: ['value'] }
);

export const ValidateCouponSchema = z.object({
    store_id: UuidSchema,
    code: z.string().min(1).max(50),
    order_total: MoneySchema,
    product_ids: z.array(UuidSchema).optional(),
    customer_id: UuidSchema.optional(),
});

export const ListCouponsQuery = PaginationQuery.extend({
    store_id: UuidSchema.optional(),
    status: z.enum(['active', 'expired', 'all']).default('all'),
});
