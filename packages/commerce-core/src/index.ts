import { z } from 'zod';
import { EmailSchema, MoneySchema, PaginationQuery, SlugSchema, UrlSchema, UuidSchema } from '@letbuyy/shared-types';

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

export const StoreScopedQuerySchema = z.object({
  store_id: UuidSchema,
});

export const CreateCategorySchema = z.object({
  store_id: UuidSchema,
  name: z.string().min(1).max(100).trim(),
  slug: SlugSchema.optional(),
  description: z.string().max(500).optional(),
  image_url: z.string().url().optional(),
  parent_id: UuidSchema.optional().nullable(),
  display_order: z.number().int().min(0).default(0),
  is_visible: z.boolean().default(true),
});

export const UpdateCategorySchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  slug: SlugSchema.optional(),
  description: z.string().max(500).optional(),
  image_url: z.string().url().optional().nullable(),
  parent_id: UuidSchema.optional().nullable(),
  display_order: z.number().int().min(0).optional(),
  is_visible: z.boolean().optional(),
});

export const CreateCollectionSchema = z.object({
  store_id: UuidSchema,
  title: z.string().min(1).max(160).trim(),
  description: z.string().max(1000).optional().nullable(),
  image_url: z.string().url().optional().nullable(),
});

export const CreateGiftCardSchema = z.object({
  store_id: UuidSchema,
  initial_value: z.coerce.number().positive().max(999999),
  expires_at: z.string().datetime().optional().nullable(),
});

export const CreateLocationSchema = z.object({
  store_id: UuidSchema,
  name: z.string().min(1).max(200).trim(),
  address: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  country: z.string().length(2).toUpperCase().default('IN'),
  is_default: z.boolean().default(false),
});

export const AdjustInventorySchema = z.object({
  product_id: UuidSchema,
  variant_id: UuidSchema.optional().nullable(),
  location_id: UuidSchema.optional(),
  adjustment: z.number().int().min(-99999).max(99999),
  reason: z.enum([
    'received',
    'sold',
    'returned',
    'damaged',
    'correction',
    'transfer',
    'sale',
    'return',
    'adjustment',
    'recount',
  ]),
  notes: z.string().max(500).optional(),
});

export const BulkAdjustSchema = z.object({
  store_id: UuidSchema,
  adjustments: z.array(AdjustInventorySchema).min(1).max(100),
});

export const CreateSupplierSchema = z.object({
  store_id: UuidSchema,
  name: z.string().min(1).max(200).trim(),
  contact_name: z.string().max(200).optional(),
  email: EmailSchema.optional(),
  phone: z.string().max(30).optional(),
  address: z.record(z.string(), z.unknown()).optional(),
});

export const PurchaseOrderLineSchema = z.object({
  product_id: UuidSchema,
  variant_id: UuidSchema.optional().nullable(),
  quantity: z.number().int().min(1).max(999999),
  unit_cost: z.number().min(0).max(999999).default(0),
});

export const CreatePurchaseOrderSchema = z.object({
  store_id: UuidSchema,
  supplier_id: UuidSchema.optional().nullable(),
  location_id: UuidSchema,
  expected_at: z.coerce.date().optional(),
  notes: z.string().max(1000).optional(),
  lines: z.array(PurchaseOrderLineSchema).min(1).max(200),
  idempotency_key: z.string().min(8).max(200),
});

export const ReceivePurchaseOrderLineSchema = z.object({
  purchase_order_line_id: UuidSchema,
  quantity: z.number().int().min(1).max(999999),
});

export const ReceivePurchaseOrderSchema = z.object({
  lines: z.array(ReceivePurchaseOrderLineSchema).min(1).max(200).optional(),
  idempotency_key: z.string().min(8).max(200),
});

export const TransferLineSchema = z.object({
  product_id: UuidSchema,
  variant_id: UuidSchema.optional().nullable(),
  quantity: z.number().int().min(1).max(999999),
});

export const CreateTransferSchema = z.object({
  store_id: UuidSchema,
  source_location_id: UuidSchema,
  destination_location_id: UuidSchema,
  notes: z.string().max(1000).optional(),
  lines: z.array(TransferLineSchema).min(1).max(200),
  idempotency_key: z.string().min(8).max(200),
});

export const ReceiveTransferLineSchema = z.object({
  transfer_line_id: UuidSchema,
  quantity: z.number().int().min(1).max(999999),
});

export const ReceiveTransferSchema = z.object({
  lines: z.array(ReceiveTransferLineSchema).min(1).max(200).optional(),
  idempotency_key: z.string().min(8).max(200),
});

export const ShipTransferSchema = z.object({
  idempotency_key: z.string().min(8).max(200),
});

export const ReviewModerationStatusSchema = z.enum(['pending', 'approved', 'rejected']);

export const ListProductReviewsQuery = PaginationQuery.extend({
  store_id: UuidSchema,
  status: z.enum(['all', 'pending', 'approved', 'rejected']).default('all'),
});

export const UpdateProductReviewSchema = z.object({
  status: ReviewModerationStatusSchema,
});

export const StorefrontProductReviewsQuery = z.object({
  product_id: UuidSchema,
  store_id: UuidSchema,
});

export const CreateStorefrontProductReviewSchema = z.object({
  product_id: UuidSchema,
  store_id: UuidSchema,
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().trim().max(120).optional().nullable(),
  body: z.string().trim().max(2000).optional().nullable(),
  customer_name: z.string().trim().max(120).optional().nullable(),
  customer_email: EmailSchema.optional().nullable(),
  is_verified: z.boolean().default(false),
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
  seoTitle?: string;
  seoDescription?: string;
  isFeatured?: boolean;
  isTrending?: boolean;
  isNew?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type CreateProductInput = z.infer<typeof CreateProductSchema>;
export type CreateProductCommand = z.input<typeof CreateProductSchema>;
export type ProductOptionInput = z.input<typeof ProductOptionSchema>;
export type ProductVariantInput = z.input<typeof ProductVariantSchema>;
export type UpdateProductInput = z.infer<typeof UpdateProductSchema>;
export type ListProductsInput = z.infer<typeof ListProductsQuery>;
export type BulkProductActionInput = z.infer<typeof BulkProductActionSchema>;
export type CreateCustomerInput = z.infer<typeof CreateCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof UpdateCustomerSchema>;
export type CreateCustomerAddressInput = z.infer<typeof CreateCustomerAddressSchema>;
export type ListCustomersInput = z.infer<typeof ListCustomersQuery>;
export type StoreScopedQueryInput = z.infer<typeof StoreScopedQuerySchema>;
export type CreateCategoryInput = z.infer<typeof CreateCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof UpdateCategorySchema>;
export type CreateCollectionInput = z.infer<typeof CreateCollectionSchema>;
export type CreateGiftCardInput = z.infer<typeof CreateGiftCardSchema>;
export type InventoryAdjustmentInput = z.infer<typeof AdjustInventorySchema>;
export type BulkAdjustInput = z.infer<typeof BulkAdjustSchema>;
export type CreateLocationInput = z.infer<typeof CreateLocationSchema>;
export type CreateSupplierInput = z.infer<typeof CreateSupplierSchema>;
export type CreatePurchaseOrderInput = z.infer<typeof CreatePurchaseOrderSchema>;
export type ReceivePurchaseOrderInput = z.infer<typeof ReceivePurchaseOrderSchema>;
export type CreateTransferInput = z.infer<typeof CreateTransferSchema>;
export type ReceiveTransferInput = z.infer<typeof ReceiveTransferSchema>;
export type ShipTransferInput = z.infer<typeof ShipTransferSchema>;
export type ReviewModerationStatus = z.infer<typeof ReviewModerationStatusSchema>;
export type StorefrontProductReviewsQueryInput = z.infer<typeof StorefrontProductReviewsQuery>;
export type CreateStorefrontProductReviewInput = z.infer<typeof CreateStorefrontProductReviewSchema>;

export const PRODUCT_UPDATE_FIELDS = [
  'name',
  'description',
  'price',
  'compare_price',
  'cost_per_item',
  'images',
  'category',
  'product_type',
  'vendor',
  'stock',
  'track_inventory',
  'sku',
  'barcode',
  'sell_when_oos',
  'is_physical',
  'weight',
  'weight_unit',
  'country_of_origin',
  'hs_code',
  'url_handle',
  'seo_title',
  'seo_description',
  'charge_tax',
  'is_active',
  'is_featured',
  'tags',
  'variants',
  'display_order',
] as const;

export type ProductUpdateField = (typeof PRODUCT_UPDATE_FIELDS)[number];

export interface ProductUpdatePlan {
  safeUpdates: Record<string, unknown>;
  hasOptionUpdates: boolean;
  hasVariantUpdates: boolean;
  hasInventoryUpdate: boolean;
}

export interface ProductCreatePlan {
  slug: string;
  productInsert: Record<string, unknown>;
  productOptions: ProductOptionInput[];
  productVariants: ProductVariantInput[];
  initialStock: number;
}

export interface CategoryTreeRecord {
  id: string;
  parent_id?: string | null;
  children?: CategoryTreeRecord[];
  [key: string]: unknown;
}

export interface CategoryParentRecord {
  store_id?: string | null;
  level?: number | null;
  path?: string | null;
}

export interface CategoryCreatePlan {
  slug: string;
  level: number;
  path: string;
  categoryInsert: Record<string, unknown>;
}

export interface ProductReviewRecord {
  products?: { name?: string | null } | null;
  stores?: unknown;
  status?: ReviewModerationStatus | null;
  is_approved?: boolean | null;
}

export function generateProductSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 100);
}

export function generateCategorySlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 100);
}

export function buildCategoryTree<TCategory extends CategoryTreeRecord>(categories: TCategory[]): TCategory[] {
  const map = new Map<string, TCategory>();
  const roots: TCategory[] = [];

  for (const category of categories) {
    map.set(category.id, { ...category, children: [] });
  }

  for (const category of categories) {
    const node = map.get(category.id)!;
    if (category.parent_id && map.has(category.parent_id)) {
      const parent = map.get(category.parent_id)!;
      parent.children = parent.children || [];
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

export function planCategoryCreate(input: CreateCategoryInput, parent?: CategoryParentRecord | null): CategoryCreatePlan {
  const slug = input.slug || generateCategorySlug(input.name);
  let level = 0;
  let path = slug;

  if (input.parent_id && parent?.store_id === input.store_id) {
    level = Number(parent.level || 0) + 1;
    path = `${parent.path || slug}/${slug}`;
  }

  return {
    slug,
    level,
    path,
    categoryInsert: {
      ...input,
      slug,
      level,
      path,
    },
  };
}

export function normalizeProductReviewRecord<TReview extends ProductReviewRecord>(row: TReview) {
  const { products, stores: _stores, ...review } = row;
  const status = review.status || (review.is_approved ? 'approved' : 'pending');

  return {
    ...review,
    status,
    is_approved: status === 'approved',
    product_name: products?.name || 'Unknown product',
  };
}

export function planProductCreate(input: CreateProductCommand): ProductCreatePlan {
  const slug = generateProductSlug(input.url_handle || input.name);
  const initialStock = input.stock ?? 10;

  return {
    slug,
    initialStock,
    productOptions: input.product_options || [],
    productVariants: input.variants || [],
    productInsert: {
      store_id: input.store_id,
      name: input.name,
      slug,
      description: input.description || '',
      price: input.price,
      compare_price: input.compare_price ?? null,
      cost_per_item: input.cost_per_item ?? input.cost_price ?? null,
      images: input.images || [],
      category: input.category || null,
      product_type: input.product_type || null,
      vendor: input.vendor || null,
      stock: initialStock,
      track_inventory: input.track_inventory ?? true,
      status: input.is_active === false ? 'draft' : 'active',
      sku: input.sku || null,
      barcode: input.barcode || null,
      sell_when_oos: input.sell_when_oos ?? false,
      is_physical: input.is_physical ?? true,
      weight: input.weight ?? null,
      weight_unit: input.weight_unit || 'kg',
      country_of_origin: input.country_of_origin || null,
      hs_code: input.hs_code || null,
      url_handle: input.url_handle || slug,
      seo_title: input.seo_title || null,
      seo_description: input.seo_description || null,
      charge_tax: input.charge_tax ?? true,
      is_active: input.is_active ?? true,
      is_featured: input.is_featured ?? false,
      tags: input.tags || [],
      variants: input.variants || [],
      display_order: input.display_order ?? 0,
    },
  };
}

export function planProductUpdate(updates: Record<string, unknown>): ProductUpdatePlan {
  const safeUpdates: Record<string, unknown> = {};

  for (const key of PRODUCT_UPDATE_FIELDS) {
    if (updates[key] !== undefined) safeUpdates[key] = updates[key];
  }

  if (typeof safeUpdates.name === 'string' && updates.url_handle === undefined) {
    safeUpdates.url_handle = generateProductSlug(safeUpdates.name);
  }

  if (typeof safeUpdates.is_active === 'boolean' && updates.status === undefined) {
    safeUpdates.status = safeUpdates.is_active ? 'active' : 'draft';
  }

  return {
    safeUpdates,
    hasOptionUpdates: updates.product_options !== undefined,
    hasVariantUpdates: Array.isArray(updates.variants),
    hasInventoryUpdate: typeof updates.stock === 'number',
  };
}
