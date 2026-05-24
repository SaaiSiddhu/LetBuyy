import { z } from 'zod';
import { UuidSchema, MoneySchema } from './common.schema';

export const CreateShippingZoneSchema = z.object({
    store_id: UuidSchema,
    name: z.string().min(1).max(100).trim(),
    countries: z.array(z.string().min(2).max(100).trim()).min(1).max(250),
    states: z.array(z.string().max(100)).max(100).optional(),
    zip_codes: z.array(z.string().max(20)).max(500).optional(),
});

export const CreateShippingRateSchema = z.object({
    zone_id: UuidSchema,
    name: z.string().min(1).max(100).trim(),
    type: z.enum(['flat', 'weight_based', 'price_based', 'free']),
    price: MoneySchema.default(0),
    min_weight_grams: z.number().int().min(0).optional(),
    max_weight_grams: z.number().int().min(0).optional(),
    min_order_amount: MoneySchema.optional(),
    max_order_amount: MoneySchema.optional(),
    estimated_days_min: z.number().int().min(0).optional(),
    estimated_days_max: z.number().int().min(0).optional(),
    is_active: z.boolean().default(true),
});

export const CreateTaxRateSchema = z.object({
    store_id: UuidSchema,
    name: z.string().min(1).max(100).trim(),
    rate: z.number().min(0).max(100),
    country: z.string().length(2).toUpperCase().default('IN'),
    state: z.string().max(100).optional(),
    hsn_code: z.string().max(20).optional(),
    applies_to: z.enum(['all', 'shipping', 'products']).default('all'),
    is_compound: z.boolean().default(false),
    is_shipping: z.boolean().default(false),
    priority: z.number().int().min(0).default(0),
    is_active: z.boolean().default(true),
});
