import { z } from 'zod';
import { UuidSchema, MoneySchema, UrlSchema } from './common.schema';

export const ProductVariantSchema = z.object({
    sku: z.string().max(100).optional().nullable(),
    title: z.string().min(1).max(200).trim(),
    price: MoneySchema.optional().nullable(),
    price_override: MoneySchema.optional().nullable(),
    compare_price: MoneySchema.optional().nullable(),
    stock: z.number().int().min(0).default(0),
    options: z.record(z.string(), z.string().max(100)).default({}),
});

export const ProductOptionSchema = z.object({
    name: z.string().min(1).max(100).trim(),
    position: z.number().int().min(0).default(0),
    values: z.array(z.string().min(1).max(100)).max(100).default([]),
});

export const CreateProductSchema = z
    .object({
        store_id: UuidSchema,
        name: z.string().min(1).max(256).trim(),
        description: z.string().max(10000).optional(),
        price: MoneySchema,
        compare_price: MoneySchema.optional().nullable(),
        cost_price: MoneySchema.optional().nullable(),
        cost_per_item: MoneySchema.optional().nullable(),
        images: z.array(UrlSchema).max(20).default([]),
        category: z.string().max(100).optional(),
        product_type: z.string().max(100).optional().nullable(),
        vendor: z.string().max(100).optional().nullable(),
        tags: z.array(z.string().max(50)).max(30).default([]),
        variants: z.array(ProductVariantSchema).max(100).default([]),
        product_options: z.array(ProductOptionSchema).max(10).default([]),
        stock: z.number().int().min(0).default(10),
        track_inventory: z.boolean().default(true),
        sku: z.string().max(100).optional().nullable(),
        barcode: z.string().max(100).optional().nullable(),
        sell_when_oos: z.boolean().default(false),
        is_physical: z.boolean().default(true),
        weight: z.number().min(0).optional().nullable(),
        weight_unit: z.string().max(20).default('kg'),
        country_of_origin: z.string().max(100).optional().nullable(),
        hs_code: z.string().max(30).optional().nullable(),
        url_handle: z.string().max(200).optional().nullable(),
        seo_title: z.string().max(70).optional().nullable(),
        seo_description: z.string().max(160).optional().nullable(),
        charge_tax: z.boolean().default(true),
        is_active: z.boolean().default(true),
        is_featured: z.boolean().default(false),
        display_order: z.number().int().min(0).default(0),
    })
    .refine(
        (d) => !d.compare_price || d.compare_price > d.price,
        { message: 'Compare-at price must exceed selling price', path: ['compare_price'] }
    );

export const UpdateProductSchema = z.object({
    name: z.string().min(1).max(256).trim().optional(),
    description: z.string().max(10000).optional(),
    price: MoneySchema.optional(),
    compare_price: MoneySchema.optional().nullable(),
    cost_per_item: MoneySchema.optional().nullable(),
    images: z.array(UrlSchema).max(20).optional(),
    category: z.string().max(100).optional(),
    product_type: z.string().max(100).optional().nullable(),
    vendor: z.string().max(100).optional().nullable(),
    tags: z.array(z.string().max(50)).max(30).optional(),
    variants: z.array(ProductVariantSchema).max(100).optional(),
    product_options: z.array(ProductOptionSchema).max(10).optional(),
    stock: z.number().int().min(0).optional(),
    track_inventory: z.boolean().optional(),
    sku: z.string().max(100).optional().nullable(),
    barcode: z.string().max(100).optional().nullable(),
    sell_when_oos: z.boolean().optional(),
    is_physical: z.boolean().optional(),
    weight: z.number().min(0).optional().nullable(),
    weight_unit: z.string().max(20).optional(),
    country_of_origin: z.string().max(100).optional().nullable(),
    hs_code: z.string().max(30).optional().nullable(),
    url_handle: z.string().max(200).optional().nullable(),
    seo_title: z.string().max(70).optional().nullable(),
    seo_description: z.string().max(160).optional().nullable(),
    charge_tax: z.boolean().optional(),
    is_active: z.boolean().optional(),
    is_featured: z.boolean().optional(),
    display_order: z.number().int().min(0).optional(),
    version: z.number().int().positive('Version is required').optional(),
});

export const ListProductsQuery = z.object({
    store_id: UuidSchema.optional(),
    status: z.enum(['active', 'inactive', 'all']).default('all'),
    category: z.string().max(100).optional(),
    search: z.string().max(200).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    sort: z.enum(['created_at', 'price', 'name', 'stock', 'display_order']).default('display_order'),
    order: z.enum(['asc', 'desc']).default('asc'),
});

export const BulkProductActionSchema = z.object({
    store_id: UuidSchema.optional(),
    product_ids: z.array(UuidSchema).min(1).max(100),
    action: z.enum(['activate', 'deactivate', 'delete']),
});
