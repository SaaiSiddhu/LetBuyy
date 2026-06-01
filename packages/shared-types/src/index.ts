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

export const GstinSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(
    /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/,
    'GSTIN must be a valid 15 character Indian GSTIN',
  );

export const IndianStateCodeSchema = z
  .string()
  .trim()
  .regex(/^(0[1-9]|[12][0-9]|3[0-8]|97)$/, 'GST state code must be 01-38 or 97');

export const HsnCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{4,8}$/, 'HSN code must be 4 to 8 digits');

export const AddressSchema = z.object({
  name: z.string().max(200).optional(),
  line1: z.string().min(1).max(500),
  line2: z.string().max(500).optional(),
  city: z.string().min(1).max(100),
  state: z.string().min(1).max(100),
  state_code: IndianStateCodeSchema.optional(),
  zip: z.string().min(3).max(20),
  country: z.string().length(2).toUpperCase().default('IN'),
  phone: z.string().max(30).optional(),
  gstin: GstinSchema.optional(),
});

export const SeoSchema = z.object({
  seo_title: z.string().max(70).optional(),
  seo_description: z.string().max(160).optional(),
  og_image_url: UrlSchema.optional(),
});

export type PaginationQueryInput = z.infer<typeof PaginationQuery>;
export type AddressInput = z.infer<typeof AddressSchema>;
export type CurrencyCode = z.infer<typeof CurrencySchema>;
export type Gstin = z.infer<typeof GstinSchema>;
export type IndianStateCode = z.infer<typeof IndianStateCodeSchema>;
export type HsnCode = z.infer<typeof HsnCodeSchema>;

export interface Address {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  state_code?: string;
  postal_code: string;
  country: string;
  phone?: string;
  gstin?: string;
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

export type EntityId = string;
export type IsoDateTime = string;
export type JsonRecord = Record<string, unknown>;
export type MoneyMinorUnit = number;

export interface TimestampedEntity {
  id: EntityId;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
  deleted_at?: IsoDateTime | null;
}

export interface AuditedEntity extends TimestampedEntity {
  created_by?: EntityId | null;
  updated_by?: EntityId | null;
  deleted_by?: EntityId | null;
}

export const MetadataSchema = z.record(z.string(), z.unknown());

export const TimestampedEntitySchema = z.object({
  id: UuidSchema,
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  deleted_at: z.string().datetime().optional().nullable(),
});

export const AuditedEntitySchema = TimestampedEntitySchema.extend({
  created_by: UuidSchema.optional().nullable(),
  updated_by: UuidSchema.optional().nullable(),
  deleted_by: UuidSchema.optional().nullable(),
});

export const SiteTypeSchema = z.enum(['store', 'portfolio', 'resume', 'blog', 'landing']);
export const StoreStatusSchema = z.enum(['draft', 'published', 'frozen', 'suspended']);
export const ProductStatusSchema = z.enum(['draft', 'active', 'archived']);
export const InventoryPolicySchema = z.enum(['deny', 'continue']);
export const InventoryAdjustmentReasonSchema = z.enum([
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
]);
export const CollectionStatusSchema = z.enum(['draft', 'active', 'archived']);
export const GiftCardStatusSchema = z.enum(['active', 'redeemed', 'expired', 'disabled']);
export const ReviewModerationStatusSchema = z.enum(['pending', 'approved', 'rejected']);
export const CustomerStatusSchema = z.enum(['active', 'disabled', 'invited']);
export const CartStatusSchema = z.enum(['active', 'converted', 'abandoned', 'expired']);
export const OrderStatusSchema = z.enum([
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
]);
export const PaymentStatusSchema = z.enum([
  'pending',
  'requires_action',
  'authorized',
  'paid',
  'failed',
  'refunded',
  'partially_refunded',
  'voided',
]);
export const FulfillmentStatusSchema = z.enum([
  'unfulfilled',
  'partial',
  'fulfilled',
  'returned',
  'cancelled',
]);
export const PaymentProviderSchema = z.enum([
  'razorpay',
  'cashfree',
  'phonepe',
  'upi',
  'cod',
  'stripe',
  'paypal',
  'manual',
]);
export const PaymentMethodSchema = z.enum([
  'upi',
  'card',
  'netbanking',
  'wallet',
  'cod',
  'paypal',
  'manual',
]);
export const SubscriptionBillingPeriodSchema = z.enum(['monthly', 'yearly']);
export const SubscriptionStatusSchema = z.enum(['trialing', 'active', 'past_due', 'cancelled', 'expired']);
export const DiscountTypeSchema = z.enum(['percentage', 'fixed', 'free_shipping']);
export const PageStatusSchema = z.enum(['draft', 'published', 'archived']);
export const PolicyTypeSchema = z.enum(['privacy', 'refund', 'shipping', 'terms', 'contact', 'custom']);
export const BlogPostStatusSchema = z.enum(['draft', 'published', 'scheduled', 'archived']);
export const BlogCommentStatusSchema = z.enum(['pending', 'approved', 'spam', 'rejected']);
export const FormSubmissionStatusSchema = z.enum([
  'new',
  'read',
  'replied',
  'contacted',
  'converted',
  'archived',
  'spam',
]);
export const MediaTypeSchema = z.enum(['image', 'video', 'audio', 'document', 'other']);
export const AnalyticsPeriodSchema = z.enum(['7d', '30d', '90d', '12m']);
export const AIGenerationStatusSchema = z.enum(['pending', 'completed', 'failed']);
export const ResumeContentSectionSchema = z.enum([
  'skills',
  'education',
  'work_experience',
  'certifications',
  'testimonials',
  'projects',
]);
export const ThemeCategorySchema = z.enum(['store', 'portfolio', 'resume', 'blog', 'landing', 'saas']);
export const ThemePricingTypeSchema = z.enum(['free', 'one_time', 'subscription']);
export const ShippingRateTypeSchema = z.enum(['flat', 'weight_based', 'price_based', 'free']);
export const TaxAppliesToSchema = z.enum(['all', 'shipping', 'products']);

export const MoneyAmountSchema = z.object({
  amount: MoneySchema,
  amount_minor: z.number().int().min(0).optional(),
  currency: CurrencySchema,
});

export const AuthSessionUserSchema = z.object({
  id: UuidSchema,
  email: EmailSchema,
  fullName: z.string().max(200).optional().nullable(),
  avatarUrl: UrlSchema.optional().nullable(),
}).passthrough();

export const AuthSessionResponseSchema = z.object({
  authenticated: z.boolean(),
  user: AuthSessionUserSchema.optional().nullable(),
}).passthrough();

export const StoreSchema = AuditedEntitySchema.extend({
  user_id: UuidSchema,
  name: z.string().min(1).max(100),
  subdomain: z.string().min(3).max(63),
  custom_domain: z.string().max(255).optional().nullable(),
  site_type: SiteTypeSchema,
  status: StoreStatusSchema,
  theme_id: z.string().max(120).optional().nullable(),
  current_theme_release_id: UuidSchema.optional().nullable(),
  storefront_release_version: z.number().int().min(0).optional().nullable(),
  tagline: z.string().max(200).optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
  currency: CurrencySchema,
  locale: z.string().min(2).max(16).default('en-IN'),
  timezone: z.string().min(1).max(80).default('Asia/Kolkata'),
  logo_url: UrlSchema.optional().nullable(),
  favicon_url: UrlSchema.optional().nullable(),
  legal_name: z.string().max(200).optional().nullable(),
  gstin: GstinSchema.optional().nullable(),
  gst_state_code: IndianStateCodeSchema.optional().nullable(),
  invoice_prefix: z.string().min(1).max(20).optional().nullable(),
  theme_config: MetadataSchema.default({}),
  settings: MetadataSchema.default({}),
  navigation: MetadataSchema.default({}),
  tax_inclusive: z.boolean().default(false),
  seo_title: z.string().max(70).optional().nullable(),
  seo_description: z.string().max(160).optional().nullable(),
  published_at: z.string().datetime().optional().nullable(),
});

export const StoreSummarySchema = StoreSchema.pick({
  id: true,
  name: true,
  subdomain: true,
  site_type: true,
  status: true,
  theme_id: true,
  custom_domain: true,
}).extend({
  store_name: z.string().max(100).optional().nullable(),
  trial_ends_at: z.string().datetime().optional().nullable(),
  trial_status: z.string().max(80).optional().nullable(),
  theme_settings: MetadataSchema.optional().nullable(),
}).passthrough();

export const ProductOptionSchema = z.object({
  id: UuidSchema.optional(),
  product_id: UuidSchema.optional(),
  name: z.string().min(1).max(100),
  position: z.number().int().min(0).default(0),
  values: z.array(z.string().min(1).max(100)).max(100).default([]),
});

export const VariantSchema = AuditedEntitySchema.extend({
  product_id: UuidSchema,
  title: z.string().min(1).max(200),
  sku: z.string().max(100).optional().nullable(),
  barcode: z.string().max(100).optional().nullable(),
  price: MoneySchema.optional().nullable(),
  compare_price: MoneySchema.optional().nullable(),
  cost_price: MoneySchema.optional().nullable(),
  stock: z.number().int().min(0).default(0),
  inventory_quantity: z.number().int().min(0).default(0),
  options: z.record(z.string(), z.string()).default({}),
  image_url: UrlSchema.optional().nullable(),
  weight: z.number().min(0).optional().nullable(),
  weight_unit: z.string().max(20).default('kg'),
});

export const ProductSchema = AuditedEntitySchema.extend({
  store_id: UuidSchema,
  name: z.string().min(1).max(256),
  slug: SlugSchema,
  description: z.string().max(10000).optional().nullable(),
  status: ProductStatusSchema.default('draft'),
  price: MoneySchema,
  compare_price: MoneySchema.optional().nullable(),
  cost_price: MoneySchema.optional().nullable(),
  currency: CurrencySchema,
  sku: z.string().max(100).optional().nullable(),
  barcode: z.string().max(100).optional().nullable(),
  stock: z.number().int().min(0).default(0),
  track_inventory: z.boolean().default(true),
  inventory_policy: InventoryPolicySchema.default('deny'),
  images: z.array(UrlSchema).max(50).default([]),
  category: z.string().max(100).optional().nullable(),
  product_type: z.string().max(100).optional().nullable(),
  vendor: z.string().max(100).optional().nullable(),
  tags: z.array(z.string().max(50)).max(50).default([]),
  options: z.array(ProductOptionSchema).max(10).default([]),
  variants: z.array(VariantSchema).max(250).default([]),
  is_active: z.boolean().default(false),
  is_featured: z.boolean().default(false),
  is_physical: z.boolean().default(true),
  charge_tax: z.boolean().default(true),
  hs_code: z.string().max(30).optional().nullable(),
  hsn_code: HsnCodeSchema.optional().nullable(),
  country_of_origin: z.string().max(100).optional().nullable(),
  seo_title: z.string().max(70).optional().nullable(),
  seo_description: z.string().max(160).optional().nullable(),
  metadata: MetadataSchema.default({}),
});

export const ProductCategorySchema = AuditedEntitySchema.extend({
  store_id: UuidSchema,
  name: z.string().min(1).max(100),
  slug: SlugSchema,
  description: z.string().max(500).optional().nullable(),
  image_url: UrlSchema.optional().nullable(),
  parent_id: UuidSchema.optional().nullable(),
  display_order: z.number().int().min(0).default(0),
  is_visible: z.boolean().default(true),
  level: z.number().int().min(0).default(0),
  path: z.string().max(500).optional().nullable(),
  products_count: z.number().int().min(0).optional(),
  children: z.array(z.unknown()).optional(),
});

export const CollectionRuleSchema = z.object({
  field: z.string().min(1).max(80),
  relation: z.enum(['equals', 'not_equals', 'contains', 'greater_than', 'less_than']),
  value: z.union([z.string(), z.number(), z.boolean()]),
});

export const CollectionSchema = AuditedEntitySchema.extend({
  store_id: UuidSchema,
  title: z.string().min(1).max(160),
  slug: SlugSchema,
  description: z.string().max(1000).optional().nullable(),
  image_url: UrlSchema.optional().nullable(),
  status: CollectionStatusSchema.default('draft'),
  is_manual: z.boolean().default(true),
  sort_order: z.enum(['manual', 'best_selling', 'title_asc', 'title_desc', 'price_asc', 'price_desc', 'created_desc']).default('manual'),
  product_ids: z.array(UuidSchema).max(1000).default([]),
  rules: z.array(CollectionRuleSchema).max(50).default([]),
  seo_title: z.string().max(70).optional().nullable(),
  seo_description: z.string().max(160).optional().nullable(),
});

export const GiftCardSchema = AuditedEntitySchema.extend({
  store_id: UuidSchema,
  code: z.string().min(4).max(80),
  initial_value: MoneySchema,
  balance: MoneySchema,
  currency: CurrencySchema,
  status: GiftCardStatusSchema.default('active'),
  expires_at: z.string().datetime().optional().nullable(),
  redeemed_at: z.string().datetime().optional().nullable(),
  metadata: MetadataSchema.default({}),
});

export const ProductReviewSchema = AuditedEntitySchema.extend({
  store_id: UuidSchema,
  product_id: UuidSchema.optional().nullable(),
  product_name: z.string().max(256).optional().nullable(),
  customer_id: UuidSchema.optional().nullable(),
  customer_name: z.string().max(200).optional().nullable(),
  customer_email: z.string().max(320).optional().nullable(),
  rating: z.number().int().min(1).max(5).default(5),
  title: z.string().max(200).optional().nullable(),
  body: z.string().max(10000).optional().nullable(),
  images: z.array(UrlSchema).max(20).default([]),
  is_verified: z.boolean().default(false),
  is_approved: z.boolean().default(false),
  helpful_count: z.number().int().min(0).default(0),
  status: ReviewModerationStatusSchema.default('pending'),
}).passthrough();

export const InventoryLevelSchema = z.object({
  id: z.string().min(1),
  product_id: UuidSchema,
  variant_id: UuidSchema.optional().nullable(),
  location_id: UuidSchema.optional().nullable(),
  product_name: z.string().min(1).max(256),
  variant_title: z.string().max(200).optional().nullable(),
  sku: z.string().max(100).optional().nullable(),
  images: z.array(UrlSchema).default([]),
  location_name: z.string().max(200),
  available: z.number().int(),
  reserved: z.number().int(),
  incoming: z.number().int(),
  on_hand: z.number().int(),
  sellable: z.number().int(),
  track_inventory: z.boolean(),
  updated_at: z.string().datetime().optional().nullable(),
});

export const CustomerAddressSchema = AuditedEntitySchema.extend({
  store_id: UuidSchema,
  customer_id: UuidSchema.optional().nullable(),
  full_name: z.string().min(1).max(200),
  phone: z.string().max(30).optional().nullable(),
  address_line1: z.string().min(1).max(500),
  address_line2: z.string().max(500).optional().nullable(),
  city: z.string().min(1).max(100),
  state: z.string().min(1).max(100),
  state_code: IndianStateCodeSchema.optional().nullable(),
  postal_code: z.string().min(3).max(20),
  country: z.string().length(2).toUpperCase().default('IN'),
  gstin: GstinSchema.optional().nullable(),
  landmark: z.string().max(255).optional().nullable(),
  label: z.string().max(50).optional().nullable(),
  is_default: z.boolean().default(false),
});

export const CustomerSchema = AuditedEntitySchema.extend({
  store_id: UuidSchema,
  email: EmailSchema.optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
  gstin: GstinSchema.optional().nullable(),
  first_name: z.string().max(100).optional().nullable(),
  last_name: z.string().max(100).optional().nullable(),
  display_name: z.string().max(200).optional().nullable(),
  status: CustomerStatusSchema.default('active'),
  accepts_marketing: z.boolean().default(false),
  tags: z.array(z.string().max(50)).max(50).default([]),
  notes: z.string().max(2000).optional().nullable(),
  default_address_id: UuidSchema.optional().nullable(),
  addresses: z.array(CustomerAddressSchema).default([]),
  order_count: z.number().int().min(0).default(0),
  total_spent: MoneySchema.default(0),
  last_order_at: z.string().datetime().optional().nullable(),
  metadata: MetadataSchema.default({}),
});

export const CartLineSchema = z.object({
  id: z.string().min(1).max(120),
  product_id: UuidSchema,
  variant_id: UuidSchema.optional().nullable(),
  title: z.string().min(1).max(256),
  sku: z.string().max(100).optional().nullable(),
  image_url: UrlSchema.optional().nullable(),
  quantity: z.number().int().min(1).max(999),
  unit_price: MoneySchema,
  compare_price: MoneySchema.optional().nullable(),
  currency: CurrencySchema,
  properties: MetadataSchema.default({}),
  line_total: MoneySchema,
});

export const CartSchema = AuditedEntitySchema.extend({
  store_id: UuidSchema,
  customer_id: UuidSchema.optional().nullable(),
  session_id: z.string().min(1).max(200).optional().nullable(),
  status: CartStatusSchema.default('active'),
  currency: CurrencySchema,
  lines: z.array(CartLineSchema).max(250).default([]),
  subtotal: MoneySchema.default(0),
  discount_total: MoneySchema.default(0),
  shipping_total: MoneySchema.default(0),
  tax_total: MoneySchema.default(0),
  total: MoneySchema.default(0),
  coupon_codes: z.array(z.string().max(50)).max(20).default([]),
  expires_at: z.string().datetime().optional().nullable(),
  metadata: MetadataSchema.default({}),
});

export const LineItemSchema = z.object({
  id: UuidSchema.optional(),
  order_id: UuidSchema.optional(),
  product_id: UuidSchema.optional().nullable(),
  variant_id: UuidSchema.optional().nullable(),
  name: z.string().min(1).max(256),
  sku: z.string().max(100).optional().nullable(),
  quantity: z.number().int().min(1).max(999),
  unit_price: MoneySchema,
  total: MoneySchema,
  currency: CurrencySchema,
  hsn_code: HsnCodeSchema.optional().nullable(),
  gst_rate: z.number().min(0).max(40).optional().nullable(),
  taxable_amount: MoneySchema.optional().nullable(),
  cgst_amount: MoneySchema.default(0).optional(),
  sgst_amount: MoneySchema.default(0).optional(),
  igst_amount: MoneySchema.default(0).optional(),
  image_url: UrlSchema.optional().nullable(),
  variant_title: z.string().max(200).optional().nullable(),
  properties: MetadataSchema.default({}),
});

export const GstInvoicePartySchema = z.object({
  name: z.string().min(1).max(200),
  gstin: GstinSchema.optional().nullable(),
  state: z.string().min(1).max(100).optional().nullable(),
  state_code: IndianStateCodeSchema,
  address: AddressSchema.partial().optional().nullable(),
}).passthrough();

export const GstInvoiceLineSchema = z.object({
  id: z.string().min(1).max(120).optional(),
  product_id: UuidSchema.optional().nullable(),
  variant_id: UuidSchema.optional().nullable(),
  description: z.string().min(1).max(256),
  sku: z.string().max(100).optional().nullable(),
  hsn_code: HsnCodeSchema.optional().nullable(),
  quantity: z.number().int().min(1).max(999),
  unit_amount_minor: z.number().int().min(0),
  discount_amount_minor: z.number().int().min(0).default(0),
  taxable_amount_minor: z.number().int().min(0),
  gst_rate_bps: z.number().int().min(0).max(4000),
  cgst_amount_minor: z.number().int().min(0).default(0),
  sgst_amount_minor: z.number().int().min(0).default(0),
  igst_amount_minor: z.number().int().min(0).default(0),
  tax_amount_minor: z.number().int().min(0),
  total_amount_minor: z.number().int().min(0),
}).strict();

export const GstInvoiceSchema = z.object({
  invoice_number: z.string().min(1).max(80),
  order_id: z.string().min(1).max(120),
  order_number: z.string().min(1).max(80),
  invoice_date: z.string().datetime(),
  currency: CurrencySchema,
  supplier: GstInvoicePartySchema,
  recipient: GstInvoicePartySchema,
  place_of_supply_state_code: IndianStateCodeSchema,
  supply_type: z.enum(['intra_state', 'inter_state']),
  lines: z.array(GstInvoiceLineSchema).min(1).max(250),
  taxable_amount_minor: z.number().int().min(0),
  cgst_amount_minor: z.number().int().min(0),
  sgst_amount_minor: z.number().int().min(0),
  igst_amount_minor: z.number().int().min(0),
  tax_amount_minor: z.number().int().min(0),
  total_amount_minor: z.number().int().min(0),
}).strict();

export const OrderSchema = AuditedEntitySchema.extend({
  store_id: UuidSchema,
  order_number: z.string().min(1).max(80),
  customer_id: UuidSchema.optional().nullable(),
  customer_email: EmailSchema.optional().nullable(),
  customer_phone: z.string().max(30).optional().nullable(),
  customer_name: z.string().max(200).optional().nullable(),
  customer_gstin: GstinSchema.optional().nullable(),
  status: OrderStatusSchema,
  payment_status: PaymentStatusSchema,
  fulfillment_status: FulfillmentStatusSchema,
  currency: CurrencySchema,
  subtotal: MoneySchema,
  discount_amount: MoneySchema.default(0),
  shipping_amount: MoneySchema.default(0),
  tax_amount: MoneySchema.default(0),
  total: MoneySchema,
  payment_method: PaymentMethodSchema.optional().nullable(),
  payment_provider: PaymentProviderSchema.optional().nullable(),
  payment_id: z.string().max(200).optional().nullable(),
  shipping_address: CustomerAddressSchema.partial().optional().nullable(),
  billing_address: CustomerAddressSchema.partial().optional().nullable(),
  place_of_supply_state: IndianStateCodeSchema.optional().nullable(),
  gst_invoice_number: z.string().max(80).optional().nullable(),
  gst_invoice: GstInvoiceSchema.optional().nullable(),
  shipping_method: z.string().max(100).optional().nullable(),
  tracking_number: z.string().max(100).optional().nullable(),
  tracking_url: UrlSchema.optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  coupon_code: z.string().max(50).optional().nullable(),
  idempotency_key: z.string().min(8).max(200).optional().nullable(),
  line_items: z.array(LineItemSchema).max(250).default([]),
  metadata: MetadataSchema.default({}),
});

export const PaymentSchema = AuditedEntitySchema.extend({
  store_id: UuidSchema,
  order_id: UuidSchema.optional().nullable(),
  customer_id: UuidSchema.optional().nullable(),
  provider: PaymentProviderSchema,
  method: PaymentMethodSchema,
  status: PaymentStatusSchema,
  currency: CurrencySchema,
  amount: MoneySchema,
  amount_minor: z.number().int().min(0),
  authorized_amount_minor: z.number().int().min(0).default(0),
  captured_amount_minor: z.number().int().min(0).default(0),
  refunded_amount_minor: z.number().int().min(0).default(0),
  provider_payment_id: z.string().max(200).optional().nullable(),
  provider_order_id: z.string().max(200).optional().nullable(),
  provider_signature: z.string().max(500).optional().nullable(),
  idempotency_key: z.string().min(8).max(200),
  failure_code: z.string().max(120).optional().nullable(),
  failure_message: z.string().max(500).optional().nullable(),
  metadata: MetadataSchema.default({}),
});

export const SubscriptionPlanSchema = z.object({
  id: UuidSchema.optional(),
  site_type: SiteTypeSchema.or(z.string().min(1)).default('store'),
  slug: z.string().min(1).max(120),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional().nullable(),
  price_monthly_inr: z.number().min(0).default(0),
  price_yearly_inr: z.number().min(0).default(0),
  promo_price_inr: z.number().min(0).optional().nullable(),
  promo_months: z.number().int().min(0).optional().nullable(),
  promo_label: z.string().max(200).optional().nullable(),
  gmv_percentage: z.number().min(0).optional().nullable(),
  products_limit: z.number().int().min(0).optional().nullable(),
  orders_limit: z.number().int().min(0).optional().nullable(),
  storage_mb: z.number().int().min(0).optional().nullable(),
  staff_limit: z.number().int().min(0).optional().nullable(),
  ai_credits_monthly: z.number().int().min(0).optional().nullable(),
  requires_contact: z.boolean().default(false),
  trial_days: z.number().int().min(0).optional().nullable(),
  features: z.array(MetadataSchema).default([]),
  compare_features: z.array(MetadataSchema).default([]),
  limits: MetadataSchema.optional().nullable(),
  entitlements: MetadataSchema.optional().nullable(),
  razorpay_plan_id_monthly: z.string().max(200).optional().nullable(),
  razorpay_plan_id_yearly: z.string().max(200).optional().nullable(),
  is_active: z.boolean().default(true),
  display_order: z.number().int().default(0),
  created_at: z.string().datetime().optional().nullable(),
  updated_at: z.string().datetime().optional().nullable(),
}).passthrough();

export const StoreSubscriptionSchema = z.object({
  id: UuidSchema.optional(),
  plan: z.string().min(1).max(120),
  status: SubscriptionStatusSchema.or(z.string().min(1).max(80)),
  billing_period: SubscriptionBillingPeriodSchema.or(z.string().min(1).max(80)).optional().nullable(),
  current_period_start: z.string().datetime().optional().nullable(),
  current_period_end: z.string().datetime().optional().nullable(),
  promo_ends_at: z.string().datetime().optional().nullable(),
  amount_paid: z.number().min(0).optional().nullable(),
  cancelled_at: z.string().datetime().optional().nullable(),
}).passthrough();

export const StoreSubscriptionStateSchema = z.object({
  store: z.object({
    id: UuidSchema,
    trial_status: z.string().max(80).optional().nullable(),
    trial_ends_at: z.string().datetime().optional().nullable(),
    site_type: SiteTypeSchema.or(z.string().min(1)).default('store'),
  }).passthrough(),
  subscription: StoreSubscriptionSchema.nullable(),
}).passthrough();

export const BillingHistoryItemSchema = z.object({
  id: UuidSchema,
  amount_paid: z.number().min(0).optional().nullable(),
  status: z.string().max(80).optional().nullable(),
  billing_period: SubscriptionBillingPeriodSchema.or(z.string().min(1).max(80)).optional().nullable(),
  created_at: z.string().datetime().optional().nullable(),
}).passthrough();

export const SubscriptionCancelResultSchema = z.object({
  cancelled: z.boolean(),
  subscriptions: z.array(StoreSubscriptionSchema).default([]),
}).passthrough();

export const SubscriptionOrderResultSchema = z.object({
  razorpay_order_id: z.string().min(1).optional().nullable(),
  razorpay_subscription_id: z.string().min(1).optional().nullable(),
  checkout_mode: z.enum(['free_activation', 'razorpay_order', 'razorpay_subscription']).default('razorpay_order'),
  amount: z.number().min(0),
  currency: CurrencySchema,
  key_id: z.string().min(1).optional().nullable(),
  plan: SubscriptionPlanSchema.partial().passthrough(),
  billing_period: SubscriptionBillingPeriodSchema,
  is_promo: z.boolean().default(false),
  recurring: z.boolean().default(false),
  activated: z.boolean().default(false),
  subscription: StoreSubscriptionSchema.extend({
    plan_name: z.string().max(200).optional().nullable(),
  }).optional().nullable(),
  short_url: UrlSchema.optional().nullable(),
}).passthrough();

export const SubscriptionVerificationResultSchema = z.object({
  subscription: StoreSubscriptionSchema.extend({
    plan_name: z.string().max(200).optional().nullable(),
  }).passthrough(),
  message: z.string().max(500).optional(),
}).passthrough();

export const StorePaymentSettingsSchema = z.object({
  mode: z.enum(['shared', 'ownAccount']).default('shared'),
  gateways: z.array(z.string().min(1).max(80)).default(['razorpay']),
  razorpay: z.object({
    key_id: z.string().max(120).optional().nullable(),
    test_mode: z.boolean().default(true),
    verified: z.boolean().default(false),
    connected_at: z.string().datetime().optional().nullable(),
    updated_at: z.string().datetime().optional().nullable(),
    secret_configured: z.boolean().default(false),
  }).nullable().default(null),
}).passthrough();

export const StorePaymentConfigSchema = z.object({
  store_id: UuidSchema,
  online_payment_enabled: z.boolean().default(true),
  cod_enabled: z.boolean().default(true),
  payment_settings: StorePaymentSettingsSchema,
  schema_ready: z.boolean().optional(),
}).passthrough();

export const EmployeeStatusSchema = z.enum(['invited', 'active', 'inactive', 'removed', 'suspended']);

export const EmployeeSchema = z.object({
  id: UuidSchema,
  store_id: UuidSchema,
  user_id: UuidSchema.optional().nullable(),
  email: EmailSchema,
  full_name: z.string().max(200).optional().nullable(),
  role: z.string().min(1).max(80).default('staff'),
  status: EmployeeStatusSchema.default('invited'),
  is_active: z.boolean().default(true),
  permissions: MetadataSchema.default({}),
  invited_by: UuidSchema.optional().nullable(),
  accepted_at: z.string().datetime().optional().nullable(),
  created_at: z.string().datetime().optional().nullable(),
  updated_at: z.string().datetime().optional().nullable(),
  deleted_at: z.string().datetime().optional().nullable(),
}).passthrough();

export const MediaAssetSchema = z.object({
  id: UuidSchema,
  store_id: UuidSchema,
  uploaded_by: UuidSchema.optional().nullable(),
  filename: z.string().min(1).max(500),
  original_name: z.string().max(500).optional().nullable(),
  url: z.string().min(1).max(200000),
  thumbnail_url: z.string().max(200000).optional().nullable(),
  mime_type: z.string().min(1).max(255),
  size_bytes: z.number().int().min(0).default(0),
  width: z.number().int().min(0).optional().nullable(),
  height: z.number().int().min(0).optional().nullable(),
  alt_text: z.string().max(500).optional().nullable(),
  caption: z.string().max(1000).optional().nullable(),
  folder: z.string().max(200).default('/'),
  media_type: MediaTypeSchema.default('other'),
  tags: z.array(z.string().max(50)).default([]),
  created_at: z.string().datetime().optional().nullable(),
  updated_at: z.string().datetime().optional().nullable(),
  deleted_at: z.string().datetime().optional().nullable(),
}).passthrough();

export const FileUploadResultSchema = z.object({
  url: z.string().min(1).max(200000),
  key: z.string().min(1).max(1000),
  size: z.number().int().min(0),
  content_type: z.string().max(255).optional().nullable(),
  storage: z.string().max(120).optional().nullable(),
}).passthrough();

export const AnalyticsMetricSchema = z.object({
  value: z.number().default(0),
  change_pct: z.number().default(0),
  prev: z.number().default(0),
}).passthrough();

export const AnalyticsDashboardSchema = z.object({
  period: z.string().default('30d'),
  summary: z.object({
    revenue: AnalyticsMetricSchema,
    orders: AnalyticsMetricSchema,
    products: z.number().int().min(0).default(0),
    customers: z.number().int().min(0).default(0),
    avg_order_value: z.number().min(0).default(0),
  }).passthrough(),
}).passthrough();

export const AnalyticsOrdersBreakdownSchema = z.object({
  breakdown: z.record(z.string(), z.number().int().min(0)).default({}),
  total: z.number().int().min(0).default(0),
}).passthrough();

export const AICreditBalanceSchema = z.object({
  store_id: UuidSchema,
  balance: z.number().int().min(0).default(0),
  plan_credits: z.number().int().min(0).default(0),
  bonus_credits: z.number().int().min(0).default(0),
  total_used: z.number().int().min(0).default(0),
  total_purchased: z.number().int().min(0).default(0),
  created_at: z.string().datetime().optional().nullable(),
  updated_at: z.string().datetime().optional().nullable(),
}).passthrough();

export const AIUsageRecordSchema = z.object({
  id: UuidSchema,
  store_id: UuidSchema,
  user_id: UuidSchema.optional().nullable(),
  feature: z.string().min(1).max(120),
  prompt: z.string().max(20000).optional().nullable(),
  output: z.string().max(200000).optional().nullable(),
  tokens_input: z.number().int().min(0).default(0),
  tokens_output: z.number().int().min(0).default(0),
  credits_used: z.number().int().min(0).default(0),
  model: z.string().max(120).optional().nullable(),
  provider: z.string().max(120).optional().nullable(),
  latency_ms: z.number().int().min(0).optional().nullable(),
  status: AIGenerationStatusSchema.or(z.string().min(1).max(80)).default('completed'),
  error_message: z.string().max(1000).optional().nullable(),
  user_rating: z.number().int().min(1).max(5).optional().nullable(),
  user_feedback: z.string().max(2000).optional().nullable(),
  created_at: z.string().datetime().optional().nullable(),
  updated_at: z.string().datetime().optional().nullable(),
}).passthrough();

export const CouponSchema = AuditedEntitySchema.extend({
  store_id: UuidSchema,
  code: z.string().min(3).max(50),
  description: z.string().max(500).optional().nullable(),
  type: DiscountTypeSchema,
  value: z.number().min(0),
  currency: CurrencySchema.optional(),
  minimum_order_amount: MoneySchema.optional().nullable(),
  maximum_discount: MoneySchema.optional().nullable(),
  usage_limit: z.number().int().min(1).optional().nullable(),
  used_count: z.number().int().min(0).default(0),
  per_customer_limit: z.number().int().min(1).default(1),
  applicable_product_ids: z.array(UuidSchema).max(1000).default([]),
  applicable_collection_ids: z.array(UuidSchema).max(1000).default([]),
  starts_at: z.string().datetime().optional().nullable(),
  expires_at: z.string().datetime().optional().nullable(),
  is_active: z.boolean().default(true),
});

export const ShippingZoneSchema = z.object({
  id: UuidSchema,
  store_id: UuidSchema,
  name: z.string().min(1).max(100),
  countries: z.array(z.string().min(2).max(100)).default([]),
  states: z.array(z.string().max(100)).default([]),
  zip_codes: z.array(z.string().max(20)).default([]),
  created_at: z.string().datetime().optional().nullable(),
  updated_at: z.string().datetime().optional().nullable(),
  deleted_at: z.string().datetime().optional().nullable(),
}).passthrough();

export const ShippingRateSchema = z.object({
  id: UuidSchema,
  zone_id: UuidSchema,
  name: z.string().min(1).max(100),
  type: ShippingRateTypeSchema.default('flat'),
  price: MoneySchema.default(0),
  min_weight_grams: z.number().int().min(0).optional().nullable(),
  max_weight_grams: z.number().int().min(0).optional().nullable(),
  min_order_amount: MoneySchema.optional().nullable(),
  max_order_amount: MoneySchema.optional().nullable(),
  estimated_days_min: z.number().int().min(0).optional().nullable(),
  estimated_days_max: z.number().int().min(0).optional().nullable(),
  is_active: z.boolean().default(true),
  created_at: z.string().datetime().optional().nullable(),
  updated_at: z.string().datetime().optional().nullable(),
  deleted_at: z.string().datetime().optional().nullable(),
}).passthrough();

export const TaxRateSchema = z.object({
  id: UuidSchema,
  store_id: UuidSchema,
  name: z.string().min(1).max(100),
  rate: z.number().min(0).max(100),
  country: z.string().length(2).default('IN'),
  state: z.string().max(100).optional().nullable(),
  hsn_code: z.string().max(20).optional().nullable(),
  applies_to: TaxAppliesToSchema.default('all'),
  is_compound: z.boolean().default(false),
  is_shipping: z.boolean().default(false),
  priority: z.number().int().min(0).default(0),
  is_active: z.boolean().default(true),
  created_at: z.string().datetime().optional().nullable(),
  updated_at: z.string().datetime().optional().nullable(),
  deleted_at: z.string().datetime().optional().nullable(),
}).passthrough();

export const PageSchema = AuditedEntitySchema.extend({
  store_id: UuidSchema,
  title: z.string().min(1).max(300),
  slug: SlugSchema,
  body: z.string().max(200000).default(''),
  body_html: z.string().max(250000).optional().nullable(),
  page_type: z.string().min(1).max(50).default('custom'),
  status: PageStatusSchema.default('draft'),
  show_in_nav: z.boolean().default(false),
  display_order: z.number().int().min(0).default(0),
  seo_title: z.string().max(70).optional().nullable(),
  seo_description: z.string().max(160).optional().nullable(),
  published_at: z.string().datetime().optional().nullable(),
  metadata: MetadataSchema.default({}),
});

export const PolicySchema = z.object({
  id: UuidSchema,
  store_id: UuidSchema,
  policy_type: PolicyTypeSchema,
  slug: SlugSchema,
  title: z.string().min(1).max(300),
  body: z.string().max(200000).default(''),
  content: MetadataSchema.default({}),
  status: PageStatusSchema.default('draft'),
  seo_title: z.string().max(70).optional().nullable(),
  seo_description: z.string().max(160).optional().nullable(),
  published_at: z.string().datetime().optional().nullable(),
  updated_at: z.string().datetime().optional().nullable(),
}).passthrough();

export const NavigationMenuSchema = z.object({
  id: UuidSchema,
  store_id: UuidSchema,
  handle: z.string().min(1).max(120),
  name: z.string().min(1).max(160),
  location: z.string().min(1).max(40),
}).passthrough();

export const NavigationItemSchema = z.object({
  id: UuidSchema,
  menu_id: UuidSchema,
  store_id: UuidSchema,
  parent_item_id: UuidSchema.optional().nullable(),
  label: z.string().min(1).max(160),
  url: z.string().min(1).max(500).default('#'),
  target_type: z.string().min(1).max(40).default('url'),
  target_resource_id: z.string().max(120).optional().nullable(),
  sort_order: z.number().int().min(0).default(0),
  is_visible: z.boolean().default(true),
  open_in_new_tab: z.boolean().default(false),
  metadata: MetadataSchema.default({}),
  updated_at: z.string().datetime().optional().nullable(),
}).passthrough();

export const NavigationResponseSchema = z.object({
  menu: NavigationMenuSchema.nullable(),
  items: z.array(NavigationItemSchema).default([]),
});

export const ReplaceNavigationResultSchema = z.object({
  replaced: z.boolean(),
  menu_id: UuidSchema,
  count: z.number().int().min(0),
});

export const BlogPostSchema = AuditedEntitySchema.extend({
  store_id: UuidSchema,
  author_id: UuidSchema.optional().nullable(),
  title: z.string().min(1).max(300),
  slug: SlugSchema,
  excerpt: z.string().max(500).optional().nullable(),
  content: z.string().max(100000).default(''),
  content_html: z.string().max(150000).optional().nullable(),
  featured_image: UrlSchema.optional().nullable(),
  category_id: UuidSchema.optional().nullable(),
  status: BlogPostStatusSchema.default('draft'),
  scheduled_at: z.string().datetime().optional().nullable(),
  published_at: z.string().datetime().optional().nullable(),
  seo_title: z.string().max(70).optional().nullable(),
  seo_description: z.string().max(160).optional().nullable(),
  og_image_url: UrlSchema.optional().nullable(),
  allow_comments: z.boolean().default(true),
  is_featured: z.boolean().default(false),
  is_pinned: z.boolean().default(false),
  reading_time_min: z.number().int().min(0).max(1000).optional().nullable(),
  metadata: MetadataSchema.default({}),
}).passthrough();

export const BlogCommentSchema = AuditedEntitySchema.extend({
  store_id: UuidSchema,
  post_id: UuidSchema.optional().nullable(),
  post_title: z.string().max(300).optional().nullable(),
  author_name: z.string().max(200).optional().nullable(),
  author_email: z.string().email().max(320).optional().nullable(),
  author_avatar: UrlSchema.optional().nullable(),
  content: z.string().max(10000).default(''),
  body: z.string().max(10000).optional().nullable(),
  status: BlogCommentStatusSchema.default('pending'),
  moderated_at: z.string().datetime().optional().nullable(),
  metadata: MetadataSchema.default({}),
}).passthrough();

export const FormSubmissionSchema = AuditedEntitySchema.extend({
  store_id: UuidSchema,
  form_type: z.string().max(80).optional().nullable(),
  form_name: z.string().max(160).optional().nullable(),
  data: MetadataSchema.default({}),
  source_url: z.string().max(2000).optional().nullable(),
  status: FormSubmissionStatusSchema.default('new'),
  read_at: z.string().datetime().optional().nullable(),
  replied_at: z.string().datetime().optional().nullable(),
  internal_notes: z.string().max(5000).optional().nullable(),
  full_name: z.string().max(200).optional().nullable(),
  email: z.string().max(320).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  subject: z.string().max(300).optional().nullable(),
  message: z.string().max(10000).optional().nullable(),
  source: z.string().max(2000).optional().nullable(),
}).passthrough();

export const ResumeContentItemSchema = z.object({
  id: UuidSchema,
  store_id: UuidSchema,
  display_order: z.number().int().min(0).optional().nullable(),
  created_at: z.string().datetime().optional().nullable(),
  updated_at: z.string().datetime().optional().nullable(),
  deleted_at: z.string().datetime().optional().nullable(),
}).passthrough();

export const ThemeSettingFieldSchema = z.object({
  id: z.string().min(1).max(120),
  type: z.enum(['text', 'textarea', 'number', 'range', 'checkbox', 'select', 'color', 'image', 'url', 'font']),
  label: z.string().min(1).max(160),
  default: z.unknown().optional(),
  options: z.array(z.object({
    label: z.string().min(1).max(160),
    value: z.union([z.string(), z.number(), z.boolean()]),
  })).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().optional(),
  help_text: z.string().max(300).optional(),
});

export const ThemeSettingsSchema = z.object({
  primaryColor: z.string().default('#00B3B3'),
  secondaryColor: z.string().default('#008080'),
  accentColor: z.string().default('#A4E500'),
  backgroundColor: z.string().default('#FFFFFF'),
  textColor: z.string().default('#1A1A2E'),
  fontFamily: z.string().default('Inter'),
  headingFontFamily: z.string().default('Inter'),
  borderRadius: z.number().min(0).max(64).default(12),
  enableAnimations: z.boolean().default(true),
  enableShadows: z.boolean().default(true),
  isDark: z.boolean().default(false),
  surfaceColor: z.string().optional(),
});

export const ThemeBlockSchema = z.object({
  id: z.string().min(1).max(120),
  type: z.string().min(1).max(120),
  order: z.number().int().min(0).default(0),
  renderer_key: z.string().max(120).optional(),
  settings: MetadataSchema.default({}),
  is_visible: z.boolean().default(true),
});

export const ThemeSectionSchema = z.object({
  id: z.string().min(1).max(120),
  type: z.string().min(1).max(120),
  order: z.number().int().min(0).default(0),
  renderer_key: z.string().max(120).optional(),
  settings: MetadataSchema.default({}),
  blocks: z.array(ThemeBlockSchema).default([]),
  is_visible: z.boolean().default(true),
});

export const ThemeTemplateSchema = z.object({
  key: z.string().min(1).max(120),
  layout_key: z.string().max(120).optional(),
  sections: z.array(ThemeSectionSchema).default([]),
});

export const ThemeBundleSchema = z.object({
  schema_version: z.string().min(1).max(40).default('2026-05'),
  theme_id: z.string().min(1).max(120),
  version: z.string().min(1).max(40),
  settings_schema: z.array(ThemeSettingFieldSchema).default([]),
  settings_data: ThemeSettingsSchema.partial().and(MetadataSchema).default({}),
  templates: z.record(z.string(), ThemeTemplateSchema).default({}),
  section_definitions: z.record(z.string(), MetadataSchema).default({}),
  block_definitions: z.record(z.string(), MetadataSchema).default({}),
  locales: z.record(z.string(), MetadataSchema).default({}),
  assets: z.record(z.string(), z.string()).default({}),
});

export const ThemeSchema = AuditedEntitySchema.extend({
  slug: SlugSchema,
  name: z.string().min(1).max(160),
  description: z.string().max(1000).default(''),
  category: ThemeCategorySchema,
  pricing_type: ThemePricingTypeSchema.default('free'),
  price_inr: MoneySchema.default(0),
  version: z.string().min(1).max(40),
  is_active: z.boolean().default(true),
  thumbnail_url: UrlSchema.optional().nullable(),
  preview_url: UrlSchema.optional().nullable(),
  screenshots: z.array(UrlSchema).max(20).default([]),
  tags: z.array(z.string().max(50)).max(50).default([]),
  features: z.array(z.string().max(100)).max(100).default([]),
  rating: z.number().min(0).max(5).default(0),
  review_count: z.number().int().min(0).default(0),
  install_count: z.number().int().min(0).default(0),
  bundle: ThemeBundleSchema.optional(),
  published_at: z.string().datetime().optional().nullable(),
});

export const ThemeEditableSchemaResponseSchema = z.object({
  theme: z.object({
    id: UuidSchema,
    slug: SlugSchema,
    name: z.string().min(1).max(160),
    renderer_key: z.string().min(1).max(120),
    theme_package_id: UuidSchema.optional().nullable(),
    theme_package_version_id: UuidSchema.optional().nullable(),
    schema_manifest_version: z.string().optional().nullable(),
    schema_source: z.string().optional().nullable(),
  }).passthrough(),
  schemas: z.object({
    sections: z.record(z.string(), MetadataSchema).default({}),
    blocks: z.record(z.string(), MetadataSchema).default({}),
    settings: MetadataSchema.default({}),
    templates: MetadataSchema.default({}),
    layouts: MetadataSchema.default({}),
  }).passthrough(),
  renderer_manifest: MetadataSchema.optional().nullable(),
  approved_renderer_keys: z.array(z.string()).default([]),
});

export const ThemeEditorPayloadSchema = z.object({
  store: z.object({
    id: UuidSchema,
    name: z.string().optional(),
    subdomain: z.string().optional(),
    status: z.string().optional(),
  }).passthrough(),
  theme: ThemeEditableSchemaResponseSchema.shape.theme.extend({
    theme_instance_id: UuidSchema.optional().nullable(),
  }).passthrough(),
  template_config: MetadataSchema,
  draft: z.object({
    exists: z.boolean(),
    updated_at: z.string().datetime().optional().nullable(),
    version: z.number().int().positive(),
  }).passthrough(),
  release: z.object({
    id: UuidSchema,
    version: z.number().int().positive(),
    published_at: z.string().datetime(),
  }).passthrough().nullable(),
  schemas: ThemeEditableSchemaResponseSchema.shape.schemas,
  renderer_manifest: MetadataSchema.optional().nullable(),
  approved_renderer_keys: z.array(z.string()).default([]),
  version: z.number().int().positive(),
});

export const ThemeDraftSaveResultSchema = z.object({
  saved_at: z.string().datetime(),
  version: z.number().int().positive(),
  draft: z.object({
    id: UuidSchema,
    version: z.number().int().positive(),
    auto_saved_at: z.string().datetime(),
  }).passthrough(),
});

export const ThemePublishedReleaseSchema = z.object({
  release_id: UuidSchema,
  release_version: z.number().int().positive(),
  published_at: z.string().datetime(),
}).passthrough();

export const ThemePublishResultSchema = z.object({
  store: z.object({
    id: UuidSchema,
    status: z.string(),
    theme_id: z.string(),
    current_theme_release_id: UuidSchema.optional().nullable(),
    storefront_release_version: z.number().int().positive().optional().nullable(),
    updated_at: z.string().datetime().optional().nullable(),
  }).passthrough().nullable(),
  theme: z.object({
    id: UuidSchema,
    slug: SlugSchema,
    name: z.string().min(1).max(160),
  }).passthrough(),
  release: ThemePublishedReleaseSchema,
  published_at: z.string().datetime(),
});

export const ThemePreviewSessionResultSchema = z.object({
  preview_session_id: UuidSchema,
  preview_token: z.string().min(1),
  expires_at: z.string().datetime(),
  draft_version: z.number().int().positive(),
});

export const ThemeReleaseSchema = z.object({
  id: UuidSchema,
  theme_id: z.string(),
  theme_instance_id: UuidSchema.optional().nullable(),
  theme_package_version_id: UuidSchema.optional().nullable(),
  release_version: z.number().int().positive(),
  release_status: z.string(),
  is_current: z.boolean(),
  publish_message: z.string().optional().nullable(),
  published_by: UuidSchema.optional().nullable(),
  published_at: z.string().datetime().optional().nullable(),
  rollback_of_release_id: UuidSchema.optional().nullable(),
  schema_manifest_version: z.string().optional().nullable(),
  engine_version: z.string().optional().nullable(),
  created_at: z.string().datetime().optional().nullable(),
}).passthrough();

export const ThemeRollbackResultSchema = z.object({
  rollback: ThemePublishedReleaseSchema,
  restored_release: z.object({
    id: UuidSchema,
    version: z.number().int().positive(),
    published_at: z.string().datetime().optional().nullable(),
  }).passthrough(),
  theme: z.object({
    id: UuidSchema,
    slug: SlugSchema,
    name: z.string().min(1).max(160),
  }).passthrough(),
});

export const AppInstallationStatusSchema = z.enum(['active', 'paused', 'uninstalled']);
export const MarketplaceAppTypeSchema = z.enum(['public', 'unlisted', 'custom', 'draft']);
export const MarketplaceAppStatusSchema = z.enum([
  'draft',
  'submitted',
  'in_review',
  'changes_needed',
  'approved',
  'published',
  'suspended',
  'removed',
  'rejected',
]);
export const MarketplaceAppPricingModelSchema = z.enum([
  'free',
  'freemium',
  'recurring',
  'one_time',
  'usage_based',
]);
export const MarketplaceAppExtensionTypeSchema = z.enum([
  'storefront_block',
  'storefront_embed',
  'checkout_ui',
  'post_purchase',
  'admin_link',
  'admin_block',
]);
export const MarketplaceSubmissionTypeSchema = z.enum(['app', 'theme']);
export const MarketplaceReviewStatusSchema = z.enum([
  'pending',
  'in_review',
  'approved',
  'rejected',
  'changes_requested',
]);

export const AppBridgeCapabilitySchema = z.enum([
  'api.fetch',
  'toast',
  'resize',
  'navigation.redirect',
]);

export const MarketplaceAppCategorySchema = z.object({
  slug: z.string().min(1).max(120),
  name: z.string().min(1).max(160),
  icon: z.string().min(1).max(80).optional().nullable(),
  group: z.string().min(1).max(120).optional().nullable(),
  count: z.number().int().nonnegative().optional().nullable(),
}).passthrough();

export const MarketplaceAppDeveloperSchema = z.object({
  id: z.string().min(1).optional().nullable(),
  company_name: z.string().min(1).max(200).optional().nullable(),
  slug: z.string().min(1).max(160).optional().nullable(),
  logo_url: UrlSchema.optional().nullable(),
  website_url: UrlSchema.optional().nullable(),
  support_email: EmailSchema.optional().nullable(),
  verified: z.boolean().optional().nullable(),
  status: z.string().min(1).max(80).optional().nullable(),
}).passthrough();

export const MarketplaceAppExtensionSchema = z.object({
  id: z.string().min(1),
  app_id: z.string().min(1).optional().nullable(),
  type: MarketplaceAppExtensionTypeSchema.or(z.string().min(1)),
  name: z.string().min(1).max(160).optional().nullable(),
  entry_point: z.string().max(2000).optional().nullable(),
  target: z.string().max(200).optional().nullable(),
  label: z.string().max(120).optional().nullable(),
  config: MetadataSchema.default({}),
  status: z.string().min(1).max(80).optional().nullable(),
  sort_order: z.number().int().optional().nullable(),
}).passthrough();

export const MarketplaceAppSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1).max(160),
  name: z.string().min(1).max(200),
  tagline: z.string().max(300).optional().nullable(),
  description: z.string().optional().nullable(),
  type: MarketplaceAppTypeSchema.or(z.string().min(1)).optional().nullable(),
  status: MarketplaceAppStatusSchema.or(z.string().min(1)).optional().nullable(),
  developer_id: z.string().min(1).optional().nullable(),
  developer_name: z.string().max(200).optional().nullable(),
  developer_email: EmailSchema.optional().nullable(),
  client_id: z.string().max(200).optional().nullable(),
  redirect_uris: z.array(z.string().min(1)).optional().nullable(),
  scopes: z.array(z.string().min(1)).optional().nullable(),
  api_scopes: z.array(z.string().min(1)).optional().nullable(),
  app_url: UrlSchema.optional().nullable(),
  proxy_url: UrlSchema.optional().nullable(),
  proxy_path: z.string().max(500).optional().nullable(),
  privacy_url: UrlSchema.optional().nullable(),
  privacy_policy_url: UrlSchema.optional().nullable(),
  terms_url: UrlSchema.optional().nullable(),
  icon_url: UrlSchema.optional().nullable(),
  screenshots: z.array(UrlSchema).optional().nullable(),
  video_url: UrlSchema.optional().nullable(),
  pricing_model: MarketplaceAppPricingModelSchema.or(z.string().min(1)).optional().nullable(),
  price_monthly: z.number().nonnegative().optional().nullable(),
  price_yearly: z.number().nonnegative().optional().nullable(),
  price_inr: z.number().nonnegative().optional().nullable(),
  trial_days: z.number().int().nonnegative().optional().nullable(),
  category_id: z.string().min(1).optional().nullable(),
  tags: z.array(z.string().min(1)).optional().nullable(),
  collection_ids: z.array(z.string().min(1)).optional().nullable(),
  install_count: z.number().int().nonnegative().optional().nullable(),
  review_count: z.number().int().nonnegative().optional().nullable(),
  avg_rating: z.number().nonnegative().optional().nullable(),
  rating_avg: z.number().or(z.string()).optional().nullable(),
  extensions: z.array(MarketplaceAppExtensionSchema).optional().nullable(),
  app_extensions: z.array(MarketplaceAppExtensionSchema).optional().nullable(),
  app_developers: MarketplaceAppDeveloperSchema.optional().nullable(),
  app_categories: MarketplaceAppCategorySchema.optional().nullable(),
  current_version: z.string().max(80).optional().nullable(),
  min_plan: z.string().max(80).optional().nullable(),
  supported_locales: z.array(z.string().min(2)).optional().nullable(),
  is_featured: z.boolean().optional().nullable(),
  created_at: z.string().datetime().optional().nullable(),
  updated_at: z.string().datetime().optional().nullable(),
  published_at: z.string().datetime().optional().nullable(),
}).passthrough();

export const MarketplaceAppReviewSchema = z.object({
  id: z.string().min(1),
  app_id: z.string().min(1),
  user_id: z.string().min(1).optional().nullable(),
  user_name: z.string().max(200).optional().nullable(),
  store_name: z.string().max(200).optional().nullable(),
  rating: z.number().int().min(1).max(5),
  title: z.string().max(200).optional().nullable(),
  body: z.string().optional().nullable(),
  helpful_count: z.number().int().nonnegative().optional().nullable(),
  is_verified: z.boolean().optional().nullable(),
  status: z.string().max(80).optional().nullable(),
  created_at: z.string().datetime().optional().nullable(),
}).passthrough();

export const MarketplaceReviewRecordSchema = AuditedEntitySchema.extend({
  submission_type: MarketplaceSubmissionTypeSchema,
  resource_id: UuidSchema,
  resource_slug: z.string().min(1).max(200).optional().nullable(),
  resource_name: z.string().min(1).max(240),
  partner_user_id: UuidSchema,
  app_developer_id: UuidSchema.optional().nullable(),
  status: MarketplaceReviewStatusSchema,
  automated_checks: MetadataSchema.default({}),
  submitted_at: z.string().datetime(),
  reviewed_by: UuidSchema.optional().nullable(),
  reviewed_at: z.string().datetime().optional().nullable(),
  review_notes: z.string().optional().nullable(),
  metadata: MetadataSchema.default({}),
}).passthrough();

export const InstalledMarketplaceAppSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(160),
  slug: z.string().min(1).max(160).optional().nullable(),
  icon_url: UrlSchema.optional().nullable(),
  tagline: z.string().max(240).optional().nullable(),
  pricing_model: z.string().max(80).optional().nullable(),
  app_url: UrlSchema.optional().nullable(),
}).passthrough();

export const InstalledAppSchema = z.object({
  id: z.string().min(1),
  app_id: z.string().min(1),
  store_id: z.string().min(1),
  status: AppInstallationStatusSchema.or(z.string().min(1)),
  scopes_granted: z.array(z.string().min(1)).default([]),
  config: MetadataSchema.default({}),
  installed_at: z.string().datetime().optional().nullable(),
  uninstalled_at: z.string().datetime().optional().nullable(),
  marketplace_apps: InstalledMarketplaceAppSchema.optional().nullable(),
}).passthrough();

export const AdminAppEmbedSurfaceSchema = z.object({
  title: z.string().min(1).max(160),
  label: z.string().min(1).max(80),
  url: UrlSchema,
  origin: z.string().min(1).max(300),
  target: z.string().min(1).max(160).optional().nullable(),
  icon_url: UrlSchema.optional().nullable(),
  capabilities: z.array(AppBridgeCapabilitySchema).default(['api.fetch', 'toast', 'resize']),
}).strict();

export const AdminAppBridgeSessionSchema = z.object({
  installation: InstalledAppSchema,
  embed: AdminAppEmbedSurfaceSchema,
  bridge: z.object({
    version: z.string().min(1).max(40),
    token_type: z.literal('Bearer'),
    access_token: z.string().min(1),
    expires_at: z.string().datetime(),
    api_base_url: UrlSchema,
    store_id: z.string().min(1),
    installation_id: z.string().min(1),
    app_id: z.string().min(1),
    scopes: z.array(z.string().min(1)).default([]),
    capabilities: z.array(AppBridgeCapabilitySchema).default(['api.fetch', 'toast', 'resize']),
  }).strict(),
}).strict();

export const AppBridgeApiFetchResultSchema = z.object({
  ok: z.boolean(),
  status: z.number().int().min(100).max(599),
  data: z.unknown().optional().nullable(),
  error: z.string().optional().nullable(),
}).strict();

export const AppBillingChargeModeSchema = z.enum(['recurring', 'usage']);
export const AppBillingChargeStatusSchema = z.enum([
  'pending_merchant_approval',
  'approved',
  'active',
  'cancelled',
  'failed',
]);
export const AppBillingIndiaPayoutRailSchema = z.enum(['razorpay_route', 'razorpayx', 'upi', 'manual']);
export const AppBillingChargeProviderModeSchema = z.enum(['test', 'live']);

export const AppBillingChargeSchema = z.object({
  id: UuidSchema,
  site_id: UuidSchema,
  app_id: UuidSchema,
  partner_id: UuidSchema,
  installation_id: UuidSchema,
  billing_mode: AppBillingChargeModeSchema,
  status: AppBillingChargeStatusSchema.or(z.string().min(1)),
  name: z.string().min(1).max(160),
  amount_minor: z.number().int().positive(),
  currency: z.literal('INR').default('INR'),
  revenue_share_bps: z.number().int().min(0).max(10000).default(8000),
  partner_amount_minor: z.number().int().nonnegative(),
  platform_fee_minor: z.number().int().nonnegative(),
  partner_gst_bps: z.number().int().min(0).max(10000).default(1800),
  partner_gst_minor: z.number().int().nonnegative().default(0),
  payout_rail: AppBillingIndiaPayoutRailSchema.default('razorpay_route'),
  provider: AppBillingIndiaPayoutRailSchema.default('razorpay_route'),
  provider_mode: AppBillingChargeProviderModeSchema.default('test'),
  provider_reference: z.string().max(200).optional().nullable(),
  approval_url: z.string().min(1).max(500).optional().nullable(),
  approved_by: z.string().min(1).optional().nullable(),
  approved_at: z.string().datetime().optional().nullable(),
  activated_at: z.string().datetime().optional().nullable(),
  idempotency_key: z.string().min(8).max(200),
  metadata: MetadataSchema.default({}),
  created_at: z.string().datetime().optional().nullable(),
  updated_at: z.string().datetime().optional().nullable(),
}).passthrough();

export const AppBillingChargeCreateSchema = z.object({
  store_id: UuidSchema,
  installation_id: UuidSchema,
  billing_mode: AppBillingChargeModeSchema.default('recurring'),
  name: z.string().trim().min(1).max(160),
  amount_minor: z.number().int().positive(),
  idempotency_key: z.string().trim().min(8).max(200),
  return_url: UrlSchema.optional(),
  metadata: MetadataSchema.default({}),
}).strict();

export const AppBillingChargeApproveSchema = z.object({
  store_id: UuidSchema,
  charge_id: UuidSchema,
  idempotency_key: z.string().trim().min(8).max(200),
  provider_reference: z.string().trim().min(1).max(200).optional(),
  provider_mode: AppBillingChargeProviderModeSchema.default('test'),
}).strict();

export const AppBillingChargeResultSchema = z.object({
  charge: AppBillingChargeSchema,
  approval: z.object({
    required: z.boolean(),
    url: z.string().min(1).max(500).optional().nullable(),
  }).optional(),
  billing: z.record(z.string(), z.unknown()).optional(),
  payout: z.record(z.string(), z.unknown()).optional(),
  payout_plan: z.record(z.string(), z.unknown()).optional(),
}).passthrough();

export const PartnerPayoutLedgerEntrySchema = z.object({
  id: UuidSchema,
  partner_id: UuidSchema,
  site_id: UuidSchema.optional().nullable(),
  app_id: UuidSchema.optional().nullable(),
  installation_id: UuidSchema.optional().nullable(),
  charge_id: UuidSchema,
  billing_mode: AppBillingChargeModeSchema,
  amount_minor: z.number().int().nonnegative(),
  currency: z.literal('INR').default('INR'),
  revenue_share_bps: z.number().int().min(0).max(10000).default(8000),
  partner_amount_minor: z.number().int().nonnegative(),
  platform_fee_minor: z.number().int().nonnegative(),
  status: z.string().min(1).max(80),
  rail: AppBillingIndiaPayoutRailSchema,
  metadata: MetadataSchema.default({}),
  created_at: z.string().datetime().optional().nullable(),
  updated_at: z.string().datetime().optional().nullable(),
}).passthrough();

export const PartnerDevelopmentStoreSchema = z.object({
  id: UuidSchema,
  name: z.string().min(1).max(200),
  subdomain: z.string().min(1).max(120).optional().nullable(),
  site_type: SiteTypeSchema.or(z.string().min(1)).optional().nullable(),
  status: z.string().min(1).max(80).optional().nullable(),
  role_slugs: z.array(z.string().min(1)).default([]),
  managed: z.boolean().default(false),
  created_at: z.string().datetime().optional().nullable(),
}).passthrough();

export const PartnerCollaboratorAccessSchema = z.object({
  request_code: z.string().min(8).max(80),
  expires_at: z.string().datetime(),
  scopes: z.array(z.string().min(1)).default([]),
  managed_stores: z.array(PartnerDevelopmentStoreSchema).default([]),
}).passthrough();

export const PartnerAnalyticsSchema = z.object({
  total_apps: z.number().int().nonnegative(),
  published_apps: z.number().int().nonnegative(),
  active_installations: z.number().int().nonnegative(),
  uninstalls: z.number().int().nonnegative(),
  charges: z.number().int().nonnegative(),
  gross_amount_minor: z.number().int().nonnegative(),
  partner_earnings_minor: z.number().int().nonnegative(),
  partner_gst_minor: z.number().int().nonnegative(),
  payout_pending_minor: z.number().int().nonnegative(),
  payout_released_minor: z.number().int().nonnegative(),
  currency: z.literal('INR').default('INR'),
}).passthrough();

export const PartnerDashboardSchema = z.object({
  developer: MarketplaceAppDeveloperSchema,
  apps: z.array(MarketplaceAppSchema).default([]),
  review_records: z.array(MarketplaceReviewRecordSchema).default([]),
  charges: z.array(AppBillingChargeSchema).default([]),
  payouts: z.array(PartnerPayoutLedgerEntrySchema).default([]),
  development_stores: z.array(PartnerDevelopmentStoreSchema).default([]),
  collaborator_access: PartnerCollaboratorAccessSchema,
  analytics: PartnerAnalyticsSchema,
}).passthrough();

export const AppOAuthAuthorizationSchema = z.object({
  code: z.string().min(1),
  redirect_uri: UrlSchema,
  redirect_to: UrlSchema,
  state: z.string().max(500).optional().nullable(),
  scopes: z.array(z.string().min(1)).default([]),
  expires_at: z.string().datetime(),
  installation_id: z.string().min(1),
  app_id: z.string().min(1),
  store_id: z.string().min(1),
}).strict();

export const AppOAuthAuthorizationResultSchema = z.object({
  installation: InstalledAppSchema,
  authorization: AppOAuthAuthorizationSchema,
}).strict();

export const AppOAuthTokenResultSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.literal('Bearer'),
  expires_at: z.string().datetime(),
  scope: z.string().default(''),
  scopes: z.array(z.string().min(1)).default([]),
  installation_id: z.string().min(1),
  app_id: z.string().min(1),
  store_id: z.string().min(1),
}).strict();

export type SiteType = z.infer<typeof SiteTypeSchema>;
export type StoreStatus = z.infer<typeof StoreStatusSchema>;
export type ProductStatus = z.infer<typeof ProductStatusSchema>;
export type InventoryPolicy = z.infer<typeof InventoryPolicySchema>;
export type InventoryAdjustmentReason = z.infer<typeof InventoryAdjustmentReasonSchema>;
export type CollectionStatus = z.infer<typeof CollectionStatusSchema>;
export type GiftCardStatus = z.infer<typeof GiftCardStatusSchema>;
export type ReviewModerationStatus = z.infer<typeof ReviewModerationStatusSchema>;
export type CustomerStatus = z.infer<typeof CustomerStatusSchema>;
export type CartStatus = z.infer<typeof CartStatusSchema>;
export type OrderStatus = z.infer<typeof OrderStatusSchema>;
export type PaymentStatus = z.infer<typeof PaymentStatusSchema>;
export type FulfillmentStatus = z.infer<typeof FulfillmentStatusSchema>;
export type PaymentProvider = z.infer<typeof PaymentProviderSchema>;
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;
export type SubscriptionBillingPeriod = z.infer<typeof SubscriptionBillingPeriodSchema>;
export type SubscriptionStatus = z.infer<typeof SubscriptionStatusSchema>;
export type DiscountType = z.infer<typeof DiscountTypeSchema>;
export type PageStatus = z.infer<typeof PageStatusSchema>;
export type PolicyType = z.infer<typeof PolicyTypeSchema>;
export type BlogPostStatus = z.infer<typeof BlogPostStatusSchema>;
export type BlogCommentStatus = z.infer<typeof BlogCommentStatusSchema>;
export type FormSubmissionStatus = z.infer<typeof FormSubmissionStatusSchema>;
export type MediaType = z.infer<typeof MediaTypeSchema>;
export type AnalyticsPeriod = z.infer<typeof AnalyticsPeriodSchema>;
export type AIGenerationStatus = z.infer<typeof AIGenerationStatusSchema>;
export type ResumeContentSection = z.infer<typeof ResumeContentSectionSchema>;
export type ThemeCategory = z.infer<typeof ThemeCategorySchema>;
export type ThemePricingType = z.infer<typeof ThemePricingTypeSchema>;
export type ShippingRateType = z.infer<typeof ShippingRateTypeSchema>;
export type TaxAppliesTo = z.infer<typeof TaxAppliesToSchema>;
export type MoneyAmount = z.infer<typeof MoneyAmountSchema>;
export type AuthSessionUser = z.infer<typeof AuthSessionUserSchema>;
export type AuthSessionResponse = z.infer<typeof AuthSessionResponseSchema>;
export type Store = z.infer<typeof StoreSchema>;
export type StoreSummary = z.infer<typeof StoreSummarySchema>;
export type ProductOption = z.infer<typeof ProductOptionSchema>;
export type Variant = z.infer<typeof VariantSchema>;
export type ProductVariant = Variant;
export type Product = z.infer<typeof ProductSchema>;
export type ProductCategory = z.infer<typeof ProductCategorySchema>;
export type CollectionRule = z.infer<typeof CollectionRuleSchema>;
export type Collection = z.infer<typeof CollectionSchema>;
export type GiftCard = z.infer<typeof GiftCardSchema>;
export type ProductReview = z.infer<typeof ProductReviewSchema>;
export type InventoryLevel = z.infer<typeof InventoryLevelSchema>;
export type CustomerAddress = z.infer<typeof CustomerAddressSchema>;
export type Customer = z.infer<typeof CustomerSchema>;
export type CartLine = z.infer<typeof CartLineSchema>;
export type Cart = z.infer<typeof CartSchema>;
export type LineItem = z.infer<typeof LineItemSchema>;
export type OrderItem = LineItem;
export type GstInvoiceParty = z.infer<typeof GstInvoicePartySchema>;
export type GstInvoiceLine = z.infer<typeof GstInvoiceLineSchema>;
export type GstInvoice = z.infer<typeof GstInvoiceSchema>;
export type Order = z.infer<typeof OrderSchema>;
export type Payment = z.infer<typeof PaymentSchema>;
export type SubscriptionPlan = z.infer<typeof SubscriptionPlanSchema>;
export type StoreSubscription = z.infer<typeof StoreSubscriptionSchema>;
export type StoreSubscriptionState = z.infer<typeof StoreSubscriptionStateSchema>;
export type BillingHistoryItem = z.infer<typeof BillingHistoryItemSchema>;
export type SubscriptionCancelResult = z.infer<typeof SubscriptionCancelResultSchema>;
export type SubscriptionOrderResult = z.infer<typeof SubscriptionOrderResultSchema>;
export type SubscriptionVerificationResult = z.infer<typeof SubscriptionVerificationResultSchema>;
export type StorePaymentSettings = z.infer<typeof StorePaymentSettingsSchema>;
export type StorePaymentConfig = z.infer<typeof StorePaymentConfigSchema>;
export type EmployeeStatus = z.infer<typeof EmployeeStatusSchema>;
export type Employee = z.infer<typeof EmployeeSchema>;
export type MediaAsset = z.infer<typeof MediaAssetSchema>;
export type FileUploadResult = z.infer<typeof FileUploadResultSchema>;
export type AnalyticsMetric = z.infer<typeof AnalyticsMetricSchema>;
export type AnalyticsDashboard = z.infer<typeof AnalyticsDashboardSchema>;
export type AnalyticsOrdersBreakdown = z.infer<typeof AnalyticsOrdersBreakdownSchema>;
export type AICreditBalance = z.infer<typeof AICreditBalanceSchema>;
export type AIUsageRecord = z.infer<typeof AIUsageRecordSchema>;
export type Coupon = z.infer<typeof CouponSchema>;
export type ShippingZone = z.infer<typeof ShippingZoneSchema>;
export type ShippingRate = z.infer<typeof ShippingRateSchema>;
export type TaxRate = z.infer<typeof TaxRateSchema>;
export type Page = z.infer<typeof PageSchema>;
export type Policy = z.infer<typeof PolicySchema>;
export type NavigationMenu = z.infer<typeof NavigationMenuSchema>;
export type NavigationItem = z.infer<typeof NavigationItemSchema>;
export type NavigationResponse = z.infer<typeof NavigationResponseSchema>;
export type ReplaceNavigationResult = z.infer<typeof ReplaceNavigationResultSchema>;
export type BlogPost = z.infer<typeof BlogPostSchema>;
export type BlogComment = z.infer<typeof BlogCommentSchema>;
export type FormSubmission = z.infer<typeof FormSubmissionSchema>;
export type ResumeContentItem = z.infer<typeof ResumeContentItemSchema>;
export type ThemeSettingField = z.infer<typeof ThemeSettingFieldSchema>;
export type ThemeSettings = z.infer<typeof ThemeSettingsSchema>;
export type ThemeBlock = z.infer<typeof ThemeBlockSchema>;
export type ThemeSection = z.infer<typeof ThemeSectionSchema>;
export type ThemeTemplate = z.infer<typeof ThemeTemplateSchema>;
export type ThemeBundle = z.infer<typeof ThemeBundleSchema>;
export type Theme = z.infer<typeof ThemeSchema>;
export type ThemeEditableSchemaResponse = z.infer<typeof ThemeEditableSchemaResponseSchema>;
export type ThemeEditorPayload = z.infer<typeof ThemeEditorPayloadSchema>;
export type ThemeDraftSaveResult = z.infer<typeof ThemeDraftSaveResultSchema>;
export type ThemePublishedRelease = z.infer<typeof ThemePublishedReleaseSchema>;
export type ThemePublishResult = z.infer<typeof ThemePublishResultSchema>;
export type ThemePreviewSessionResult = z.infer<typeof ThemePreviewSessionResultSchema>;
export type ThemeRelease = z.infer<typeof ThemeReleaseSchema>;
export type ThemeRollbackResult = z.infer<typeof ThemeRollbackResultSchema>;
export type AppInstallationStatus = z.infer<typeof AppInstallationStatusSchema>;
export type MarketplaceAppType = z.infer<typeof MarketplaceAppTypeSchema>;
export type MarketplaceAppStatus = z.infer<typeof MarketplaceAppStatusSchema>;
export type MarketplaceAppPricingModel = z.infer<typeof MarketplaceAppPricingModelSchema>;
export type MarketplaceAppExtensionType = z.infer<typeof MarketplaceAppExtensionTypeSchema>;
export type MarketplaceAppCategory = z.infer<typeof MarketplaceAppCategorySchema>;
export type MarketplaceAppDeveloper = z.infer<typeof MarketplaceAppDeveloperSchema>;
export type MarketplaceAppExtension = z.infer<typeof MarketplaceAppExtensionSchema>;
export type MarketplaceApp = z.infer<typeof MarketplaceAppSchema>;
export type MarketplaceAppReview = z.infer<typeof MarketplaceAppReviewSchema>;
export type MarketplaceSubmissionType = z.infer<typeof MarketplaceSubmissionTypeSchema>;
export type MarketplaceReviewStatus = z.infer<typeof MarketplaceReviewStatusSchema>;
export type MarketplaceReviewRecord = z.infer<typeof MarketplaceReviewRecordSchema>;
export type AppBridgeCapability = z.infer<typeof AppBridgeCapabilitySchema>;
export type InstalledMarketplaceApp = z.infer<typeof InstalledMarketplaceAppSchema>;
export type InstalledApp = z.infer<typeof InstalledAppSchema>;
export type AdminAppEmbedSurface = z.infer<typeof AdminAppEmbedSurfaceSchema>;
export type AdminAppBridgeSession = z.infer<typeof AdminAppBridgeSessionSchema>;
export type AppBridgeApiFetchResult = z.infer<typeof AppBridgeApiFetchResultSchema>;
export type AppBillingChargeMode = z.infer<typeof AppBillingChargeModeSchema>;
export type AppBillingChargeStatus = z.infer<typeof AppBillingChargeStatusSchema>;
export type AppBillingIndiaPayoutRail = z.infer<typeof AppBillingIndiaPayoutRailSchema>;
export type AppBillingChargeProviderMode = z.infer<typeof AppBillingChargeProviderModeSchema>;
export type AppBillingCharge = z.infer<typeof AppBillingChargeSchema>;
export type AppBillingChargeCreate = z.infer<typeof AppBillingChargeCreateSchema>;
export type AppBillingChargeApprove = z.infer<typeof AppBillingChargeApproveSchema>;
export type AppBillingChargeResult = z.infer<typeof AppBillingChargeResultSchema>;
export type PartnerPayoutLedgerEntry = z.infer<typeof PartnerPayoutLedgerEntrySchema>;
export type PartnerDevelopmentStore = z.infer<typeof PartnerDevelopmentStoreSchema>;
export type PartnerCollaboratorAccess = z.infer<typeof PartnerCollaboratorAccessSchema>;
export type PartnerAnalytics = z.infer<typeof PartnerAnalyticsSchema>;
export type PartnerDashboard = z.infer<typeof PartnerDashboardSchema>;
export type AppOAuthAuthorization = z.infer<typeof AppOAuthAuthorizationSchema>;
export type AppOAuthAuthorizationResult = z.infer<typeof AppOAuthAuthorizationResultSchema>;
export type AppOAuthTokenResult = z.infer<typeof AppOAuthTokenResultSchema>;

export const RuntimeEnvironmentSchema = z.enum(['local', 'development', 'staging', 'production']);

export const FeatureFlagScopeSchema = z.enum([
  'tenant',
  'percentage',
  'internal',
  'region',
  'environment',
]);

export const FeatureFlagRuleSchema = z.object({
  id: z.string().min(1).max(120),
  scope: FeatureFlagScopeSchema,
  enabled: z.boolean().default(true),
  tenantSiteIds: z.array(UuidSchema).optional(),
  regions: z.array(z.string().min(1).max(64)).optional(),
  environments: z.array(RuntimeEnvironmentSchema).optional(),
  percentage: z.number().min(0).max(100).optional(),
  variant: z.string().min(1).max(120).optional(),
});

export const FeatureFlagDefinitionSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(160)
    .regex(/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/, 'Feature flag keys must be stable lowercase identifiers'),
  enabled: z.boolean().default(false),
  killSwitch: z.boolean().default(false),
  ownerRuntime: z.string().min(1).max(160),
  defaultVariant: z.string().min(1).max(120).optional(),
  rules: z.array(FeatureFlagRuleSchema).default([]),
  expiresAt: z.string().datetime().optional(),
});

export const FeatureFlagContextSchema = z.object({
  environment: RuntimeEnvironmentSchema,
  tenantSiteId: UuidSchema.optional(),
  actorId: UuidSchema.optional(),
  anonymousKey: z.string().min(1).max(240).optional(),
  region: z.string().min(1).max(64).optional(),
  internal: z.boolean().default(false),
});

export type RuntimeEnvironment = z.infer<typeof RuntimeEnvironmentSchema>;
export type FeatureFlagScope = z.infer<typeof FeatureFlagScopeSchema>;
export type FeatureFlagRule = z.infer<typeof FeatureFlagRuleSchema>;
export type FeatureFlagDefinition = z.infer<typeof FeatureFlagDefinitionSchema>;
export type FeatureFlagContext = z.infer<typeof FeatureFlagContextSchema>;

export interface FeatureFlagEvaluation {
  flagKey: string;
  enabled: boolean;
  variant?: string;
  reason:
    | 'kill_switch'
    | 'flag_disabled'
    | 'expired'
    | 'rule_match'
    | 'no_matching_rule'
    | 'percentage_miss';
  ruleId?: string;
  bucket?: number;
}

function stableBucket(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 100;
}

function rolloutIdentity(context: FeatureFlagContext): string {
  return context.tenantSiteId ?? context.actorId ?? context.anonymousKey ?? 'anonymous';
}

function ruleMatches(rule: FeatureFlagRule, context: FeatureFlagContext, flagKey: string): { matched: boolean; bucket?: number } {
  if (rule.scope === 'tenant') {
    return { matched: Boolean(context.tenantSiteId && rule.tenantSiteIds?.includes(context.tenantSiteId)) };
  }

  if (rule.scope === 'internal') {
    return { matched: context.internal === true };
  }

  if (rule.scope === 'region') {
    return { matched: Boolean(context.region && rule.regions?.includes(context.region)) };
  }

  if (rule.scope === 'environment') {
    return { matched: Boolean(rule.environments?.includes(context.environment)) };
  }

  const bucket = stableBucket(`${flagKey}:${rolloutIdentity(context)}`);
  return { matched: bucket < (rule.percentage ?? 0), bucket };
}

export function evaluateFeatureFlag(
  definition: FeatureFlagDefinition,
  context: FeatureFlagContext,
  evaluatedAt: Date = new Date(),
): FeatureFlagEvaluation {
  if (definition.killSwitch) {
    return { flagKey: definition.key, enabled: false, reason: 'kill_switch' };
  }

  if (!definition.enabled) {
    return { flagKey: definition.key, enabled: false, reason: 'flag_disabled' };
  }

  if (definition.expiresAt && Date.parse(definition.expiresAt) <= evaluatedAt.getTime()) {
    return { flagKey: definition.key, enabled: false, reason: 'expired' };
  }

  for (const rule of definition.rules) {
    const result = ruleMatches(rule, context, definition.key);
    if (!result.matched) continue;

    return {
      flagKey: definition.key,
      enabled: rule.enabled,
      variant: rule.variant ?? definition.defaultVariant,
      reason: 'rule_match',
      ruleId: rule.id,
      bucket: result.bucket,
    };
  }

  return {
    flagKey: definition.key,
    enabled: false,
    variant: definition.defaultVariant,
    reason: definition.rules.some((rule) => rule.scope === 'percentage') ? 'percentage_miss' : 'no_matching_rule',
  };
}

export function featureFlagExposureTelemetry(
  evaluation: FeatureFlagEvaluation,
  context: FeatureFlagContext,
  evaluatedAt: Date = new Date(),
): JsonRecord {
  return {
    flag_key: evaluation.flagKey,
    enabled: evaluation.enabled,
    variant: evaluation.variant ?? null,
    reason: evaluation.reason,
    rule_id: evaluation.ruleId ?? null,
    bucket: evaluation.bucket ?? null,
    environment: context.environment,
    tenant_site_id: context.tenantSiteId ?? null,
    actor_id: context.actorId ?? null,
    region: context.region ?? null,
    internal: context.internal === true,
    evaluated_at: evaluatedAt.toISOString(),
  };
}
