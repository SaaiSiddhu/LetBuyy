import { z } from 'zod';
import { EmailSchema, HsnCodeSchema, MoneySchema, PaginationQuery, QueryBooleanSchema, SlugSchema, UrlSchema, UuidSchema } from '@letbuyy/shared-types';

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
    hsn_code: HsnCodeSchema.optional().nullable(),
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
  hsn_code: HsnCodeSchema.optional().nullable(),
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
  cursor: z.string().max(512).optional(),
  withCount: QueryBooleanSchema,
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
  turnstile_token: z.string().trim().min(1).max(4096).optional().nullable(),
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
  location_id: string | null;
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
  'hsn_code',
  'url_handle',
  'seo_title',
  'seo_description',
  'charge_tax',
  'is_active',
  'is_featured',
  'tags',
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

export interface PublicProductReviewRecord {
  rating?: number | string | null;
}

export interface ProductRatingDistributionBucket {
  star: number;
  count: number;
}

export interface PublicProductReviewsSummary {
  totalReviews: number;
  averageRating: number;
  distribution: ProductRatingDistributionBucket[];
}

export interface PublicProductReviewsPayload<TReview extends PublicProductReviewRecord = PublicProductReviewRecord> {
  reviews: TReview[];
  summary: PublicProductReviewsSummary;
}

export interface CommerceCustomerSummary {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  total_orders: number;
  total_spent: number;
  status: string;
  created_at: string | null;
  first_order_at: string | null;
  last_order_at: string | null;
  last_order_id: string | null;
}

export interface StoreCustomerRecord {
  id: string;
  email: string;
  full_name?: string | null;
  phone?: string | null;
  status?: string | null;
  total_orders?: number | string | null;
  total_spent?: number | string | null;
  created_at?: string | null;
  last_order_at?: string | null;
}

export interface CustomerOrderRecord {
  id: string;
  customer_email?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  total?: number | string | null;
  created_at?: string | null;
}

export interface CustomerSummaryFilters {
  search?: string;
  has_orders?: boolean;
}

export interface InventoryLevelSourceRow {
  id: string;
  product_id: string;
  variant_id: string | null;
  location_id: string;
  available: number | string | null;
  reserved: number | string | null;
  incoming: number | string | null;
  updated_at: string | null;
  products?: {
    id: string;
    name: string;
    sku?: string | null;
    images?: string[] | null;
    store_id: string;
    track_inventory?: boolean | null;
  } | null;
  product_variants?: {
    id: string;
    title: string;
    sku?: string | null;
  } | null;
  inventory_locations?: {
    id: string;
    name: string;
    is_default?: boolean | null;
    status?: string | null;
  } | null;
}

export interface ProductInventoryFallbackRecord {
  id: string;
  name: string;
  sku?: string | null;
  images?: string[] | null;
  stock?: number | string | null;
  track_inventory?: boolean | null;
  updated_at?: string | null;
}

export function generateProductSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 100);
}

export function generateGiftCardCodeFromBytes(bytes: Uint8Array): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let raw = '';
  for (const byte of bytes) raw += alphabet[byte % alphabet.length];
  return raw.replace(/(.{4})(?=.)/g, '$1-');
}

export function planGiftCardInsert(
  input: CreateGiftCardInput,
  code: string,
  userId: string,
  includeAuditFields: boolean,
): Record<string, unknown> {
  const insert: Record<string, unknown> = {
    store_id: input.store_id,
    code,
    initial_value: input.initial_value,
    balance: input.initial_value,
    status: 'active',
    expires_at: input.expires_at || null,
  };

  if (includeAuditFields) {
    insert.created_by = userId;
    insert.updated_by = userId;
  }

  return insert;
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

  if (input.parent_id && parent && parent.store_id === input.store_id) {
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

export function emptyPublicReviewsPayload(): PublicProductReviewsPayload<PublicProductReviewRecord> {
  return {
    reviews: [],
    summary: {
      totalReviews: 0,
      averageRating: 0,
      distribution: [5, 4, 3, 2, 1].map((star) => ({ star, count: 0 })),
    },
  };
}

export function summarizePublicProductReviews<TReview extends PublicProductReviewRecord>(
  reviews: TReview[],
): PublicProductReviewsPayload<TReview> {
  const totalReviews = reviews.length;
  const averageRating = totalReviews > 0
    ? Math.round((reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / totalReviews) * 10) / 10
    : 0;
  const distribution = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((review) => Number(review.rating) === star).length,
  }));

  return {
    reviews,
    summary: {
      totalReviews,
      averageRating,
      distribution,
    },
  };
}

export function normalizeCustomerEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function commerceNumber(value: unknown, fallback = 0): number {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function matchesCustomerSearch(customer: CommerceCustomerSummary, search: string | undefined): boolean {
  if (!search) return true;
  const needle = search.trim().toLowerCase();
  if (!needle) return true;

  return (
    customer.customer_email.toLowerCase().includes(needle) ||
    customer.customer_name.toLowerCase().includes(needle) ||
    (customer.customer_phone || '').toLowerCase().includes(needle)
  );
}

export function upsertCustomerSummary(
  customers: Map<string, CommerceCustomerSummary>,
  email: string,
  seed: Partial<CommerceCustomerSummary>,
): CommerceCustomerSummary {
  const existing = customers.get(email);
  const summary: CommerceCustomerSummary = existing || {
    id: email,
    customer_name: '',
    customer_email: email,
    customer_phone: null,
    full_name: '',
    email,
    phone: null,
    total_orders: 0,
    total_spent: 0,
    status: 'active',
    created_at: null,
    first_order_at: null,
    last_order_at: null,
    last_order_id: null,
  };

  customers.set(email, {
    ...summary,
    ...seed,
    customer_email: email,
    email,
    full_name: seed.customer_name ?? seed.full_name ?? summary.customer_name,
    phone: seed.customer_phone ?? seed.phone ?? summary.customer_phone,
  });

  return customers.get(email)!;
}

export function buildCustomerSummaries(
  storeCustomers: StoreCustomerRecord[],
  orders: CustomerOrderRecord[],
  filters: CustomerSummaryFilters = {},
): CommerceCustomerSummary[] {
  const customers = new Map<string, CommerceCustomerSummary>();

  for (const row of storeCustomers) {
    const email = normalizeCustomerEmail(row.email);
    if (!email) continue;

    upsertCustomerSummary(customers, email, {
      id: row.id || email,
      customer_name: row.full_name || '',
      customer_phone: row.phone || null,
      total_orders: commerceNumber(row.total_orders),
      total_spent: commerceNumber(row.total_spent),
      status: row.status || 'active',
      created_at: row.created_at || null,
      last_order_at: row.last_order_at || null,
    });
  }

  const orderStats = new Map<string, { totalOrders: number; totalSpent: number; firstOrderAt: string | null; lastOrderAt: string | null; lastOrderId: string | null }>();

  for (const order of orders) {
    const email = normalizeCustomerEmail(order.customer_email);
    if (!email) continue;

    const stats = orderStats.get(email) || {
      totalOrders: 0,
      totalSpent: 0,
      firstOrderAt: null,
      lastOrderAt: null,
      lastOrderId: null,
    };
    const createdAt = order.created_at || null;
    stats.totalOrders += 1;
    stats.totalSpent += commerceNumber(order.total);
    if (createdAt && (!stats.lastOrderAt || createdAt > stats.lastOrderAt)) {
      stats.lastOrderAt = createdAt;
      stats.lastOrderId = order.id;
    }
    if (createdAt && (!stats.firstOrderAt || createdAt < stats.firstOrderAt)) {
      stats.firstOrderAt = createdAt;
    }
    orderStats.set(email, stats);

    const existing = customers.get(email);
    upsertCustomerSummary(customers, email, {
      id: existing?.id || email,
      customer_name: existing?.customer_name || order.customer_name || '',
      customer_phone: existing?.customer_phone || order.customer_phone || null,
      created_at: existing?.created_at || createdAt,
      status: existing?.status || 'active',
    });
  }

  for (const [email, stats] of orderStats) {
    const customer = customers.get(email);
    if (!customer) continue;
    customers.set(email, {
      ...customer,
      total_orders: stats.totalOrders,
      total_spent: stats.totalSpent,
      first_order_at: stats.firstOrderAt,
      last_order_at: stats.lastOrderAt,
      last_order_id: stats.lastOrderId,
    });
  }

  return [...customers.values()]
    .filter((customer) => matchesCustomerSearch(customer, filters.search))
    .filter((customer) => filters.has_orders === undefined || (filters.has_orders ? customer.total_orders > 0 : customer.total_orders === 0))
    .sort((a, b) => {
      const aDate = a.last_order_at || a.created_at || '';
      const bDate = b.last_order_at || b.created_at || '';
      return bDate.localeCompare(aDate);
    });
}

export function mapInventoryAdjustmentReason(reason: InventoryAdjustmentInput['reason']): InventoryAdjustmentInput['reason'] {
  switch (reason) {
    case 'sold':
      return 'sale';
    case 'returned':
      return 'return';
    case 'received':
    case 'correction':
      return 'adjustment';
    default:
      return reason;
  }
}

export function mapProductStockInventoryRecord(product: ProductInventoryFallbackRecord): InventoryLevel {
  const stock = commerceNumber(product.stock);

  return {
    id: `product:${product.id}`,
    product_id: product.id,
    variant_id: null,
    location_id: null,
    product_name: product.name,
    variant_title: null,
    sku: product.sku || null,
    images: product.images || [],
    location_name: 'Default Location',
    available: stock,
    reserved: 0,
    incoming: 0,
    on_hand: stock,
    sellable: stock,
    track_inventory: product.track_inventory !== false,
    updated_at: product.updated_at || null,
  };
}

export function mapInventoryLevelRecord(level: InventoryLevelSourceRow): InventoryLevel {
  const available = commerceNumber(level.available);
  const reserved = commerceNumber(level.reserved);
  const incoming = commerceNumber(level.incoming);

  return {
    id: level.id,
    product_id: level.product_id,
    variant_id: level.variant_id,
    location_id: level.location_id,
    product_name: level.products?.name || '',
    variant_title: level.product_variants?.title || null,
    sku: level.product_variants?.sku || level.products?.sku || null,
    images: level.products?.images || [],
    location_name: level.inventory_locations?.name || 'Default Location',
    available,
    reserved,
    incoming,
    on_hand: available + reserved,
    sellable: Math.max(0, available - reserved),
    track_inventory: level.products?.track_inventory !== false,
    updated_at: level.updated_at,
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
      hsn_code: input.hsn_code || input.hs_code || null,
      url_handle: input.url_handle || slug,
      seo_title: input.seo_title || null,
      seo_description: input.seo_description || null,
      charge_tax: input.charge_tax ?? true,
      is_active: input.is_active ?? true,
      is_featured: input.is_featured ?? false,
      tags: input.tags || [],
      variants: [],
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

  if (safeUpdates.hsn_code !== undefined && safeUpdates.hs_code === undefined) {
    safeUpdates.hs_code = safeUpdates.hsn_code;
  }

  if (safeUpdates.hs_code !== undefined && safeUpdates.hsn_code === undefined) {
    safeUpdates.hsn_code = safeUpdates.hs_code;
  }

  return {
    safeUpdates,
    hasOptionUpdates: updates.product_options !== undefined,
    hasVariantUpdates: Array.isArray(updates.variants),
    hasInventoryUpdate: typeof updates.stock === 'number',
  };
}
