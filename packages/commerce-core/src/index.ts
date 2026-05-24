import { z } from 'zod';
import { EmailSchema, MoneySchema, PaginationQuery, UrlSchema, UuidSchema } from '@letbuyy/shared-types';

export type ProductStatus = 'draft' | 'active' | 'archived';

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
    (data) => !data.compare_price || data.compare_price > data.price,
    { message: 'Compare-at price must exceed selling price', path: ['compare_price'] },
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
  label: z.string().max(50).optional(),
});

export const ListCustomersQuery = PaginationQuery.extend({
  store_id: UuidSchema.optional(),
  search: z.string().max(200).optional(),
  tag: z.string().max(50).optional(),
  has_orders: z.coerce.boolean().optional(),
});

export interface Product {
  id: string;
  store_id: string;
  name: string;
  slug: string;
  description?: string;
  price: number;
  compare_price?: number | null;
  compare_at_price?: number | null;
  cost_price?: number;
  cost_per_item?: number | null;
  sku?: string;
  barcode?: string;
  stock?: number;
  stock_quantity?: number;
  track_inventory: boolean;
  is_active?: boolean;
  is_featured?: boolean;
  status?: ProductStatus;
  images: string[];
  variants: ProductVariant[];
  product_options?: ProductOption[];
  tags: string[];
  category?: string | null;
  categories?: string[];
  product_type?: string | null;
  vendor?: string | null;
  url_handle?: string | null;
  seo_title?: string;
  seo_description?: string;
  created_at: string;
  updated_at: string;
}

export interface ProductVariant {
  id: string;
  product_id?: string;
  name?: string;
  title?: string;
  price?: number;
  compare_price?: number | null;
  sku?: string | null;
  stock?: number;
  stock_quantity?: number;
  inventory_qty?: number;
  options: Record<string, string>;
  image?: string;
}

export interface ProductOption {
  id?: string;
  product_id?: string;
  name: string;
  position: number;
  values: string[];
}

export interface CreateProductRequest {
  store_id?: string;
  name: string;
  price: number;
  description?: string;
  compare_price?: number | null;
  cost_per_item?: number | null;
  images?: string[];
  stock?: number;
  track_inventory?: boolean;
  sku?: string | null;
  barcode?: string | null;
  category?: string | null;
  product_type?: string | null;
  vendor?: string | null;
  product_options?: ProductOption[];
  variants?: Omit<ProductVariant, 'id' | 'product_id'>[];
  tags?: string[];
  is_active?: boolean;
  seo_title?: string | null;
  seo_description?: string | null;
}

export interface InventoryLevel {
  id: string;
  product_id: string;
  variant_id?: string | null;
  location_id: string;
  product_name: string;
  variant_title?: string | null;
  sku?: string | null;
  images: string[];
  location_name: string;
  available: number;
  reserved: number;
  incoming: number;
  on_hand: number;
  sellable: number;
  track_inventory: boolean;
  updated_at?: string | null;
}

export interface VariantOption {
  name: string;
  values: string[];
}

export interface ProductModel {
  id: string;
  sellerId?: string;
  storeId?: string;
  name: string;
  description: string;
  price: number;
  compareAtPrice?: number;
  currency: string;
  images: string[];
  category?: string;
  stock: number;
  isActive?: boolean;
  rating?: number;
  reviewCount?: number;
  variants?: ProductVariant[];
  variantOptions?: VariantOption[];
  tags?: string[];
  specifications?: Record<string, string>;
  isFeatured?: boolean;
  isTrending?: boolean;
  isNew?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type CreateProductInput = z.infer<typeof CreateProductSchema>;
export type UpdateProductInput = z.infer<typeof UpdateProductSchema>;
export type ListProductsInput = z.infer<typeof ListProductsQuery>;
export type BulkProductActionInput = z.infer<typeof BulkProductActionSchema>;
export type CreateCustomerInput = z.infer<typeof CreateCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof UpdateCustomerSchema>;
export type CreateCustomerAddressInput = z.infer<typeof CreateCustomerAddressSchema>;
export type ListCustomersInput = z.infer<typeof ListCustomersQuery>;
