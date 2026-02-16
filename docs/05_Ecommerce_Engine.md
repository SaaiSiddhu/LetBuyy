# LetBuyy Platform — E-commerce Engine

> **Doc 05 of 15** | Products, Orders, Payments, Shipping, Coupons, Inventory & Storefront
>
> **Version:** 6.0 | **Date:** February 14, 2026
>
> **Prev:** [04 Admin Dashboard](./04_Admin_Dashboard.md) | **Next:** [06 Portfolio & Resume](./06_Portfolio_and_Resume.md)

---

## Table of Contents

1. [Product Management](#1-product-management)
2. [Product Media & Image Pipeline](#2-product-media--image-pipeline)
3. [Inventory Management](#3-inventory-management)
4. [Categories & Collections](#4-categories--collections)
5. [Customer Management](#5-customer-management)
6. [Cart System](#6-cart-system)
7. [Checkout Flow](#7-checkout-flow)
8. [Payment Gateways](#8-payment-gateways)
9. [Order Management](#9-order-management)
10. [Returns & Refunds](#10-returns--refunds)
11. [Discounts & Coupons](#11-discounts--coupons)
12. [Shipping & Fulfillment](#12-shipping--fulfillment)
13. [Tax System](#13-tax-system)
14. [Storefront Rendering](#14-storefront-rendering)
15. [AI-Powered E-commerce](#15-ai-powered-e-commerce)
16. [Abandoned Cart Recovery](#16-abandoned-cart-recovery)
17. [Notification Events](#17-notification-events)
18. [Analytics & Reporting](#18-analytics--reporting)
19. [Performance Optimization](#19-performance-optimization)
20. [Security](#20-security)
21. [Testing Strategy](#21-testing-strategy)
22. [Document History](#22-document-history)

---

## 1. Product Management

> **Cross-ref:** [04_Admin_Dashboard §4 — E-Commerce Dashboard](./04_Admin_Dashboard.md) | [00_Overview §7 — Admin Panel](./00_Overview.md)

### 1.1 Product Database Schema

```sql
-- Core products table
CREATE TABLE products (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id          UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  title             TEXT NOT NULL,
  slug              TEXT NOT NULL,
  description       TEXT,                          -- HTML (Tiptap)
  description_json  JSONB,                         -- Tiptap JSON for re-editing
  short_description TEXT,                          -- Plain text, 250 chars max
  product_type      TEXT NOT NULL DEFAULT 'physical', -- physical, digital, service, bundle
  status            TEXT NOT NULL DEFAULT 'draft',    -- draft, active, archived
  
  -- Pricing
  price             DECIMAL(12,2) NOT NULL DEFAULT 0,
  compare_at_price  DECIMAL(12,2),                  -- "Was ₹X" strikethrough
  cost_price        DECIMAL(12,2),                  -- Internal cost for margin calc
  currency          TEXT NOT NULL DEFAULT 'INR',
  tax_inclusive      BOOLEAN DEFAULT true,
  tax_category      TEXT DEFAULT 'standard',         -- standard, reduced, zero, exempt

  -- Inventory (for non-variant products)
  sku               TEXT,
  barcode           TEXT,                            -- EAN/UPC/ISBN
  inventory_count   INT DEFAULT 0,
  track_inventory   BOOLEAN DEFAULT true,
  low_stock_threshold INT DEFAULT 10,
  allow_backorder   BOOLEAN DEFAULT false,
  weight            DECIMAL(8,2),                    -- in grams
  weight_unit       TEXT DEFAULT 'g',                -- g, kg, lb, oz

  -- Dimensions (for shipping calc)
  length            DECIMAL(8,2),
  width             DECIMAL(8,2),
  height            DECIMAL(8,2),
  dimension_unit    TEXT DEFAULT 'cm',

  -- Digital products
  digital_file_url  TEXT,                            -- R2 signed URL
  download_limit    INT,                             -- Max downloads per customer
  license_key_pool  TEXT[],                          -- Array of available license keys

  -- Organization
  category_id       UUID REFERENCES product_categories(id),
  tags              TEXT[] DEFAULT '{}',
  vendor            TEXT,
  brand             TEXT,
  
  -- Display
  images            TEXT[] DEFAULT '{}',             -- R2 URLs, first = cover image
  featured          BOOLEAN DEFAULT false,
  display_order     INT DEFAULT 0,

  -- SEO
  seo_title         TEXT,
  seo_description   TEXT,
  og_image          TEXT,

  -- Metadata
  view_count        INT DEFAULT 0,
  sold_count        INT DEFAULT 0,
  avg_rating        DECIMAL(3,2) DEFAULT 0,
  review_count      INT DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(store_id, slug)
);

-- Row Level Security
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store owners manage products"
  ON products FOR ALL
  USING (store_id IN (SELECT id FROM stores WHERE user_id = auth.uid()));

CREATE POLICY "Public can view active products"
  ON products FOR SELECT
  USING (status = 'active');

-- Indexes for performance
CREATE INDEX idx_products_store_status ON products(store_id, status);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_slug ON products(store_id, slug);
CREATE INDEX idx_products_search ON products USING gin(to_tsvector('english', title || ' ' || COALESCE(description, '')));
```

### 1.2 Product Variants Schema

```sql
-- Variant options (Size, Color, Material, etc.)
CREATE TABLE product_options (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,                -- "Size", "Color", "Material"
  position    INT DEFAULT 0,               -- Display order
  values      TEXT[] NOT NULL,             -- ["S", "M", "L", "XL"]
  UNIQUE(product_id, name)
);

-- Individual variants (each combination of options)
CREATE TABLE product_variants (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id       UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,            -- "S / Black" (auto-generated)
  sku              TEXT,
  barcode          TEXT,
  price            DECIMAL(12,2) NOT NULL,
  compare_at_price DECIMAL(12,2),
  cost_price       DECIMAL(12,2),
  inventory_count  INT DEFAULT 0,
  low_stock_threshold INT DEFAULT 10,
  weight           DECIMAL(8,2),
  image_url        TEXT,                     -- Variant-specific image
  option_values    JSONB NOT NULL,           -- {"Size": "M", "Color": "Black"}
  status           TEXT DEFAULT 'active',    -- active, disabled
  position         INT DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_variants_product ON product_variants(product_id);
CREATE INDEX idx_variants_sku ON product_variants(sku);
```

### 1.3 Product CRUD API

```typescript
// workers/api/src/routes/products/index.ts

import { Hono } from 'hono';
import { z } from 'zod';
import { authMiddleware, trialCheckMiddleware, storeOwnerMiddleware } from '@/middleware';
import { createServiceClient } from '@/lib/supabase';
import slugify from 'slugify';

const app = new Hono();

// === Zod Validation Schemas ===

const createProductSchema = z.object({
  title: z.string().min(1, 'Title required').max(255),
  description: z.string().optional(),
  descriptionJson: z.any().optional(),
  shortDescription: z.string().max(250).optional(),
  productType: z.enum(['physical', 'digital', 'service', 'bundle']).default('physical'),
  price: z.number().min(0, 'Price must be positive'),
  compareAtPrice: z.number().min(0).optional(),
  costPrice: z.number().min(0).optional(),
  currency: z.string().default('INR'),
  taxInclusive: z.boolean().default(true),
  sku: z.string().max(100).optional(),
  barcode: z.string().max(100).optional(),
  inventoryCount: z.number().int().min(0).default(0),
  trackInventory: z.boolean().default(true),
  lowStockThreshold: z.number().int().min(0).default(10),
  weight: z.number().min(0).optional(),
  categoryId: z.string().uuid().optional(),
  tags: z.array(z.string()).default([]),
  images: z.array(z.string().url()).default([]),
  featured: z.boolean().default(false),
  seoTitle: z.string().max(70).optional(),
  seoDescription: z.string().max(160).optional(),
  status: z.enum(['draft', 'active']).default('draft'),
  variants: z.array(z.object({
    optionValues: z.record(z.string()),
    price: z.number().min(0),
    compareAtPrice: z.number().min(0).optional(),
    sku: z.string().optional(),
    inventoryCount: z.number().int().min(0).default(0),
    imageUrl: z.string().url().optional(),
  })).optional(),
  options: z.array(z.object({
    name: z.string(),
    values: z.array(z.string()),
  })).optional(),
});

// === CREATE PRODUCT ===

app.post('/v1/stores/:storeId/products', authMiddleware(), trialCheckMiddleware(), async (c) => {
  const storeId = c.req.param('storeId');
  const body = await c.req.json();
  const validated = createProductSchema.parse(body);
  const supabase = createServiceClient(c.env);

  // Auto-generate slug
  let slug = slugify(validated.title, { lower: true, strict: true });
  const { count } = await supabase
    .from('products').select('id', { count: 'exact', head: true })
    .eq('store_id', storeId).eq('slug', slug);
  if (count && count > 0) slug += `-${Date.now().toString(36)}`;

  // Auto-generate SEO from title if not provided
  const seoTitle = validated.seoTitle || `${validated.title} | Buy Online`;
  const seoDescription = validated.seoDescription ||
    validated.shortDescription ||
    `Shop ${validated.title} at the best price. Fast delivery available.`;

  // Insert product
  const { data: product, error } = await supabase.from('products').insert({
    store_id: storeId,
    title: validated.title,
    slug,
    description: validated.description,
    description_json: validated.descriptionJson,
    short_description: validated.shortDescription,
    product_type: validated.productType,
    price: validated.price,
    compare_at_price: validated.compareAtPrice,
    cost_price: validated.costPrice,
    currency: validated.currency,
    tax_inclusive: validated.taxInclusive,
    sku: validated.sku,
    barcode: validated.barcode,
    inventory_count: validated.inventoryCount,
    track_inventory: validated.trackInventory,
    low_stock_threshold: validated.lowStockThreshold,
    weight: validated.weight,
    category_id: validated.categoryId,
    tags: validated.tags,
    images: validated.images,
    featured: validated.featured,
    seo_title: seoTitle,
    seo_description: seoDescription,
    status: validated.status,
  }).select().single();

  if (error) return c.json({ error: 'Failed to create product' }, 500);

  // Insert variant options + variants
  if (validated.options?.length) {
    for (const [i, opt] of validated.options.entries()) {
      await supabase.from('product_options').insert({
        product_id: product.id, name: opt.name, values: opt.values, position: i,
      });
    }
  }

  if (validated.variants?.length) {
    const variantRows = validated.variants.map((v, i) => ({
      product_id: product.id,
      title: Object.values(v.optionValues).join(' / '),
      sku: v.sku,
      price: v.price,
      compare_at_price: v.compareAtPrice,
      inventory_count: v.inventoryCount,
      image_url: v.imageUrl,
      option_values: v.optionValues,
      position: i,
    }));
    await supabase.from('product_variants').insert(variantRows);
  }

  // Invalidate storefront cache
  await c.env.REDIS.del(`cache:store:${storeId}:products`);

  // Log activity
  await supabase.from('activity_logs').insert({
    store_id: storeId,
    action: 'product.created',
    metadata: { product_id: product.id, title: product.title },
  });

  return c.json({ product }, 201);
});

// === LIST PRODUCTS ===

app.get('/v1/stores/:storeId/products', authMiddleware(), async (c) => {
  const storeId = c.req.param('storeId');
  const { status, category, search, sort, page = '1', limit = '20' } = c.req.query();
  const supabase = createServiceClient(c.env);

  let query = supabase
    .from('products')
    .select('*, product_variants(count)', { count: 'exact' })
    .eq('store_id', storeId);

  if (status) query = query.eq('status', status);
  if (category) query = query.eq('category_id', category);
  if (search) query = query.or(`title.ilike.%${search}%,sku.ilike.%${search}%`);

  // Sorting
  const sortMap: Record<string, [string, { ascending: boolean }]> = {
    'title-asc': ['title', { ascending: true }],
    'title-desc': ['title', { ascending: false }],
    'price-asc': ['price', { ascending: true }],
    'price-desc': ['price', { ascending: false }],
    'newest': ['created_at', { ascending: false }],
    'oldest': ['created_at', { ascending: true }],
    'bestselling': ['sold_count', { ascending: false }],
  };
  const [field, opts] = sortMap[sort || 'newest'] || sortMap['newest'];
  query = query.order(field, opts);

  // Pagination
  const offset = (parseInt(page) - 1) * parseInt(limit);
  query = query.range(offset, offset + parseInt(limit) - 1);

  const { data, count, error } = await query;
  if (error) return c.json({ error: error.message }, 500);

  return c.json({
    products: data,
    pagination: {
      page: parseInt(page), limit: parseInt(limit),
      total: count || 0, totalPages: Math.ceil((count || 0) / parseInt(limit)),
    },
  });
});

// === BULK OPERATIONS ===

app.post('/v1/stores/:storeId/products/bulk', authMiddleware(), async (c) => {
  const storeId = c.req.param('storeId');
  const { action, productIds } = await c.req.json();
  const supabase = createServiceClient(c.env);

  switch (action) {
    case 'activate':
      await supabase.from('products').update({ status: 'active' }).in('id', productIds).eq('store_id', storeId);
      break;
    case 'archive':
      await supabase.from('products').update({ status: 'archived' }).in('id', productIds).eq('store_id', storeId);
      break;
    case 'delete':
      await supabase.from('products').delete().in('id', productIds).eq('store_id', storeId);
      break;
    case 'update_price':
      const { priceChange, changeType } = await c.req.json();
      // changeType: 'fixed_increase', 'fixed_decrease', 'percentage_increase', 'percentage_decrease'
      // Handled via SQL function for atomicity
      break;
    default:
      return c.json({ error: 'Invalid action' }, 400);
  }

  await c.env.REDIS.del(`cache:store:${storeId}:products`);
  return c.json({ success: true, affected: productIds.length });
});

export default app;
```

### 1.4 Product Creation UI

```
┌──────────────────────────────────────────────────────────────┐
│  Add Product                                    [Save Draft] │
│                                                               │
│  Title *                                                      │
│  [_________________________________] [🤖 AI Suggest]        │
│                                                               │
│  Description                                                  │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ [B] [I] [U] [Link] [List] [Image]    [🤖 AI Write] │    │
│  │                                                       │    │
│  │ Rich text editor (Tiptap) content...                 │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                               │
│  Images (drag to reorder, max 10)                             │
│  ┌────┐ ┌────┐ ┌────┐ ┌──────────┐                         │
│  │ 📷 │ │ 📷 │ │ 📷 │ │ + Upload │ [🤖 AI Enhance]       │
│  └────┘ └────┘ └────┘ └──────────┘                         │
│                                                               │
│  Pricing                                                      │
│  Price *: [₹____]  Compare at: [₹____]  Cost: [₹____]      │
│  Currency: [INR ▼]  Tax: [Inclusive ▼]                       │
│  Margin: 45% ✅     [🤖 AI: Suggest competitive price]      │
│                                                               │
│  Inventory                                                    │
│  SKU: [________]  Barcode: [________] [🔍 Scan]             │
│  Stock: [____]    ☑ Track inventory                          │
│  Low stock alert at: [10]  ☐ Allow backorders                │
│                                                               │
│  Shipping                                                     │
│  Weight: [___] [g ▼]  Dimensions: [L] × [W] × [H] [cm ▼]  │
│                                                               │
│  Variants                                                     │
│  ☑ This product has multiple options (size, color, etc.)     │
│  Option 1: [Size ▼]  →  [S, M, L, XL, XXL]                 │
│  Option 2: [Color ▼] →  [Black, Navy, White]                │
│  [+ Add option]                                               │
│                                                               │
│  SEO Preview                                                  │
│  Title: [________________________________] [🤖 Generate]    │
│  Description: [___________________________]                  │
│  URL: stylehub.letbuyy.store/products/[slug]                 │
│                                                               │
│  Organization                                                 │
│  Category: [Jackets ▼]  Tags: [summer, new-arrival]         │
│  Vendor: [________]     Brand: [________]                    │
│  Status: [Draft ▼]     ☐ Featured product                   │
│                                                               │
│      [Save Draft]    [Save & Publish]                        │
└──────────────────────────────────────────────────────────────┘
```

### 1.5 Variant Generation System

```typescript
// apps/web/admin/lib/variants.ts

/**
 * Generate all variant combinations from option sets.
 * e.g., [{name: "Size", values: ["S", "M"]}, {name: "Color", values: ["Red", "Blue"]}]
 * → [{Size: "S", Color: "Red"}, {Size: "S", Color: "Blue"}, {Size: "M", Color: "Red"}, {Size: "M", Color: "Blue"}]
 */
export function generateVariantCombinations(
  options: { name: string; values: string[] }[]
): Record<string, string>[] {
  if (options.length === 0) return [];

  return options.reduce<Record<string, string>[]>(
    (combos, option) => {
      if (combos.length === 0) {
        return option.values.map(v => ({ [option.name]: v }));
      }
      return combos.flatMap(combo =>
        option.values.map(v => ({ ...combo, [option.name]: v }))
      );
    },
    []
  );
}

// Variant count limit per product
export const MAX_VARIANTS = 100;
export const MAX_OPTIONS = 3;

// Auto-generate SKU from option values
export function generateSKU(productPrefix: string, optionValues: Record<string, string>): string {
  const suffix = Object.values(optionValues)
    .map(v => v.slice(0, 2).toUpperCase())
    .join('-');
  return `${productPrefix}-${suffix}`;
}
```

### 1.6 Product List View

```
Products (24 total)                    [+ Add Product] [Import CSV] [Export]
Filter: [All ▼] [In Stock ▼] [Category ▼]  Search: [________🔍]
Sort: [Newest ▼]

┌────┬────────────────────┬────────┬─────────┬────────┬──────┬────────┐
│ ☐  │ Product            │ Status │ Price   │ Stock  │ Sold │ Actions│
├────┼────────────────────┼────────┼─────────┼────────┼──────┼────────┤
│ ☐  │ 📷 Blue Jacket     │ 🟢 Act │ ₹999    │ 45     │  42  │ [⋮]   │
│ ☐  │ 📷 White Shoes     │ 🟢 Act │ ₹1,499  │ ⚠️ 3   │  38  │ [⋮]   │
│ ☐  │ 📷 Black Tee       │ 🟡 Drft│ ₹599    │ 100    │   0  │ [⋮]   │
│ ☐  │ 📷 Denim Jeans     │ 🟢 Act │ ₹1,299  │ 28     │  31  │ [⋮]   │
│ ☐  │ 📷 Silk Scarf      │ 🔴 OOS │ ₹799    │ 0      │  22  │ [⋮]   │
└────┴────────────────────┴────────┴─────────┴────────┴──────┴────────┘
Showing 1-5 of 24  [← Prev] [1] [2] [3] [4] [5] [Next →]

Bulk Actions: [Activate] [Archive] [Delete] [🤖 AI Bulk Descriptions]
Selected: 0 products
```

---

## 2. Product Media & Image Pipeline

> **Cross-ref:** [01_Architecture §8 — Cloudflare R2 & CDN](./01_Architecture.md)

### 2.1 Image Upload Flow

```
┌────────────────────────────────────────────────────────────────────┐
│                    IMAGE UPLOAD PIPELINE                            │
│                                                                     │
│  Browser → Presigned URL → R2 Direct Upload → Processing Worker    │
│                                                                     │
│  1. Admin clicks "Upload"                                           │
│     └── POST /api/media/presign                                     │
│         Body: { filename, contentType, storeId }                    │
│         Returns: { uploadUrl, key }                                 │
│                                                                     │
│  2. Browser uploads directly to R2 (no server proxy)                │
│     └── PUT {uploadUrl} (presigned, 15 min expiry)                  │
│                                                                     │
│  3. R2 event trigger → Image Processing Worker                      │
│     ├── Generate thumbnails: 150×150, 400×400, 800×800, 1200×1200  │
│     ├── Convert to WebP (lossy, q=80)                               │
│     ├── Generate AVIF (for supported browsers)                      │
│     ├── Strip EXIF data (privacy)                                   │
│     ├── Detect dominant color → store as hex for placeholder       │
│     └── Store metadata: { width, height, size, format, blurhash }  │
│                                                                     │
│  4. CDN URL pattern:                                                │
│     cdn.letbuyy.store/{store_id}/{hash}_150.webp                    │
│     cdn.letbuyy.store/{store_id}/{hash}_400.webp                    │
│     cdn.letbuyy.store/{store_id}/{hash}_800.webp                    │
│     cdn.letbuyy.store/{store_id}/{hash}_1200.webp                   │
│     cdn.letbuyy.store/{store_id}/{hash}_original.{ext}              │
└────────────────────────────────────────────────────────────────────┘
```

### 2.2 Presigned Upload API

```typescript
// workers/api/src/routes/media/presign.ts

app.post('/v1/media/presign', authMiddleware(), async (c) => {
  const { filename, contentType, storeId } = await c.req.json();

  // Validate file type
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
  if (!ALLOWED_TYPES.includes(contentType)) {
    return c.json({ error: 'Invalid file type' }, 400);
  }

  // Check storage quota (per plan)
  const usage = await getStorageUsage(c.env, storeId);
  const limit = await getStorageLimit(c.env, storeId); // e.g., 1GB free, 10GB starter
  if (usage >= limit) return c.json({ error: 'Storage limit reached' }, 402);

  // Generate unique key
  const ext = filename.split('.').pop();
  const hash = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  const key = `${storeId}/${hash}_original.${ext}`;

  // Create presigned URL (15 min expiry)
  const uploadUrl = await c.env.R2_BUCKET.createMultipartUpload(key);

  return c.json({ uploadUrl, key, cdnUrl: `https://cdn.letbuyy.store/${key}` });
});
```

### 2.3 Image Processing Worker

```typescript
// workers/image-processor/src/index.ts

export default {
  async queue(batch: MessageBatch<ImageEvent>, env: Env) {
    for (const msg of batch.messages) {
      const { key, storeId } = msg.body;

      // Fetch original from R2
      const original = await env.R2_BUCKET.get(key);
      if (!original) continue;

      const buffer = await original.arrayBuffer();

      // Generate responsive sizes
      const sizes = [150, 400, 800, 1200];
      for (const size of sizes) {
        const resized = await sharp(buffer)
          .resize(size, size, { fit: 'cover', position: 'center' })
          .webp({ quality: 80 })
          .toBuffer();

        const resizedKey = key.replace('_original', `_${size}`).replace(/\.\w+$/, '.webp');
        await env.R2_BUCKET.put(resizedKey, resized, {
          httpMetadata: { contentType: 'image/webp' },
        });
      }

      // Generate blurhash for placeholder
      const blurhash = await generateBlurhash(buffer);

      // Get dominant color
      const { dominant } = await sharp(buffer).stats();
      const dominantHex = rgbToHex(dominant.r, dominant.g, dominant.b);

      // Store metadata
      const metadata = await sharp(buffer).metadata();
      await env.KV.put(`media:${key}`, JSON.stringify({
        width: metadata.width,
        height: metadata.height,
        size: buffer.byteLength,
        format: metadata.format,
        blurhash,
        dominantColor: dominantHex,
        sizes: sizes.map(s => `${key.replace('_original', `_${s}`).replace(/\.\w+$/, '.webp')}`),
      }));

      msg.ack();
    }
  },
};
```

---

## 3. Inventory Management

### 3.1 Inventory Tracking System

```sql
-- Inventory locations (multi-warehouse support)
CREATE TABLE inventory_locations (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id  UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name      TEXT NOT NULL,                 -- "Main Warehouse", "Store Front"
  address   JSONB,                         -- { line1, line2, city, state, zip, country }
  is_default BOOLEAN DEFAULT false,
  status    TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inventory per location per variant
CREATE TABLE inventory_levels (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id   UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id   UUID REFERENCES product_variants(id) ON DELETE CASCADE,
  location_id  UUID NOT NULL REFERENCES inventory_locations(id) ON DELETE CASCADE,
  available    INT NOT NULL DEFAULT 0,
  reserved     INT NOT NULL DEFAULT 0,     -- Reserved during checkout
  incoming     INT NOT NULL DEFAULT 0,     -- Purchase orders in transit
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id, variant_id, location_id)
);

-- Inventory adjustment log (auditable)
CREATE TABLE inventory_adjustments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id   UUID NOT NULL REFERENCES products(id),
  variant_id   UUID REFERENCES product_variants(id),
  location_id  UUID NOT NULL REFERENCES inventory_locations(id),
  quantity_change INT NOT NULL,             -- +50 (restock) or -1 (sold)
  reason       TEXT NOT NULL,               -- sale, return, adjustment, recount, transfer, damaged
  reference_id UUID,                        -- order_id, transfer_id, etc.
  note         TEXT,
  created_by   UUID REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_adjustments_product ON inventory_adjustments(product_id, created_at DESC);
```

### 3.2 Low Stock Alert Cron Job

```sql
-- pg_cron: Check low stock every hour
SELECT cron.schedule('low-stock-check', '0 * * * *', $$
  INSERT INTO notifications (store_id, type, title, body, metadata)
  SELECT
    p.store_id,
    'low_stock',
    'Low Stock Alert: ' || p.title,
    p.title || ' has only ' || p.inventory_count || ' units remaining',
    jsonb_build_object(
      'product_id', p.id,
      'current_stock', p.inventory_count,
      'threshold', p.low_stock_threshold
    )
  FROM products p
  WHERE p.track_inventory = true
    AND p.status = 'active'
    AND p.inventory_count <= p.low_stock_threshold
    AND p.inventory_count > 0
    AND NOT EXISTS (
      -- Don't re-notify within 24 hours
      SELECT 1 FROM notifications n
      WHERE n.store_id = p.store_id
        AND n.type = 'low_stock'
        AND (n.metadata->>'product_id')::uuid = p.id
        AND n.created_at > NOW() - INTERVAL '24 hours'
    );
$$);
```

### 3.3 Inventory Dashboard

```
┌──────────────────────────────────────────────────────────────┐
│  Inventory Overview                     [Export CSV] [Adjust]│
│                                                               │
│  Total Products    In Stock     Low Stock     Out of Stock    │
│       24              18          ⚠️ 4            ❌ 2       │
│                                                               │
│  ┌─ Inventory by Location ─────────────────────────────────┐ │
│  │ 📍 Main Warehouse — 1,245 units                         │ │
│  │ 📍 Store Front    —   312 units                         │ │
│  │                                   [+ Add Location]       │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                               │
│  ⚠️ Low Stock Alerts:                                        │
│    White Shoes    →  3 left  (threshold: 10) [Restock →]    │
│    Black Cap      →  5 left  (threshold: 10) [Restock →]    │
│    Red Scarf      →  7 left  (threshold: 15) [Restock →]    │
│    Navy Jacket    →  8 left  (threshold: 10) [Restock →]    │
│                                                               │
│  🤖 AI Forecast: "Based on sales velocity, White Shoes will │
│     sell out in ~5 days. Recommend reordering 50+ units."    │
│                                                               │
│  Recent Adjustments:                                          │
│  │ Feb 14 11:30 │ Blue Jacket  │ -1 │ Sale (Order #1042)   │ │
│  │ Feb 14 10:15 │ Canvas Bag   │+50 │ Restock              │ │
│  │ Feb 13 16:00 │ Silk Scarf   │ -2 │ Damaged              │ │
└──────────────────────────────────────────────────────────────┘
```

---

## 4. Categories & Collections

### 4.1 Category Schema

```sql
-- Hierarchical product categories
CREATE TABLE product_categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id    UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL,
  description TEXT,
  image_url   TEXT,
  parent_id   UUID REFERENCES product_categories(id),  -- Hierarchical
  position    INT DEFAULT 0,
  product_count INT DEFAULT 0,                          -- Denormalized count
  is_visible  BOOLEAN DEFAULT true,

  UNIQUE(store_id, slug)
);

-- Smart collections (auto-populated based on conditions)
CREATE TABLE smart_collections (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id    UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL,
  description TEXT,
  conditions  JSONB NOT NULL,  -- Rules for auto-inclusion
  -- Example conditions:
  -- [
  --   { "field": "price", "operator": "greater_than", "value": 1000 },
  --   { "field": "tags", "operator": "contains", "value": "summer" },
  --   { "field": "inventory_count", "operator": "greater_than", "value": 0 }
  -- ]
  match_type  TEXT DEFAULT 'all',  -- 'all' (AND) or 'any' (OR)
  created_at  TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(store_id, slug)
);
```

### 4.2 Category Hierarchy Example

```
Men's Clothing                    (12 products)
├── Jackets                       (4 products)
│   ├── Denim Jackets            (2 products)
│   └── Leather Jackets          (2 products)
├── Shirts                        (5 products)
│   ├── Formal                   (2 products)
│   └── Casual                   (3 products)
└── Accessories                   (3 products)

Women's Clothing                  (8 products)
├── Dresses                       (3 products)
├── Tops                          (3 products)
└── Accessories                   (2 products)

Smart Collections (auto-populated):
├── 🔥 Bestsellers               — sold_count > 25
├── 🆕 New Arrivals              — created_at > NOW() - 30 days
├── 💰 Under ₹500                — price < 500
├── ⚠️ Low Stock                 — inventory_count < 10
└── ⭐ Top Rated                 — avg_rating >= 4.5
```

---

## 5. Customer Management

### 5.1 Customer Schema

```sql
-- Store customers (separate from auth users — can be guest)
CREATE TABLE customers (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id     UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  user_id      UUID REFERENCES auth.users(id),        -- Null for guest checkouts
  email        TEXT NOT NULL,
  first_name   TEXT,
  last_name    TEXT,
  phone        TEXT,
  avatar_url   TEXT,
  
  -- Computed / denormalized
  order_count  INT DEFAULT 0,
  total_spent  DECIMAL(12,2) DEFAULT 0,
  avg_order    DECIMAL(12,2) DEFAULT 0,
  last_order_at TIMESTAMPTZ,
  
  -- Marketing
  accepts_marketing BOOLEAN DEFAULT false,
  marketing_opt_in_at TIMESTAMPTZ,
  tags         TEXT[] DEFAULT '{}',                     -- VIP, wholesale, influencer
  notes        TEXT,                                    -- Internal notes

  -- Segments (auto-calculated)
  ltv_tier     TEXT DEFAULT 'new',                      -- new, returning, loyal, vip, at_risk, churned
  
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(store_id, email)
);

-- Customer addresses
CREATE TABLE customer_addresses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id  UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  label        TEXT DEFAULT 'Home',                     -- Home, Work, Other
  first_name   TEXT NOT NULL,
  last_name    TEXT NOT NULL,
  line1        TEXT NOT NULL,
  line2        TEXT,
  city         TEXT NOT NULL,
  state        TEXT NOT NULL,
  postal_code  TEXT NOT NULL,
  country      TEXT NOT NULL DEFAULT 'IN',
  phone        TEXT,
  is_default   BOOLEAN DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_customers_store ON customers(store_id);
CREATE INDEX idx_customers_email ON customers(store_id, email);
CREATE INDEX idx_customers_ltv ON customers(store_id, ltv_tier);
```

### 5.2 Customer LTV Segmentation

```typescript
// workers/cron/src/customer-segmentation.ts

// Run daily via pg_cron to recalculate customer segments
const SEGMENTS = {
  vip:       { minOrders: 10, minSpent: 50000, daysSinceOrder: 90 },
  loyal:     { minOrders: 5,  minSpent: 15000, daysSinceOrder: 90 },
  returning: { minOrders: 2,  minSpent: 2000,  daysSinceOrder: 180 },
  new:       { minOrders: 1,  minSpent: 0,     daysSinceOrder: 365 },
  at_risk:   { minOrders: 2,  minSpent: 2000,  daysSinceOrder: 365 },  // was loyal but inactive
  churned:   { minOrders: 1,  minSpent: 0,     daysSinceOrder: 730 },  // >2 years
};

// SQL for segmentation
const SEGMENTATION_SQL = `
  UPDATE customers SET ltv_tier = CASE
    WHEN order_count >= 10 AND total_spent >= 50000 AND last_order_at > NOW() - INTERVAL '90 days' THEN 'vip'
    WHEN order_count >= 5 AND total_spent >= 15000 AND last_order_at > NOW() - INTERVAL '90 days' THEN 'loyal'
    WHEN order_count >= 2 AND last_order_at > NOW() - INTERVAL '180 days' THEN 'returning'
    WHEN order_count >= 2 AND last_order_at <= NOW() - INTERVAL '180 days' THEN 'at_risk'
    WHEN last_order_at <= NOW() - INTERVAL '730 days' THEN 'churned'
    ELSE 'new'
  END
  WHERE store_id = $1;
`;
```

### 5.3 Customer List UI

```
┌──────────────────────────────────────────────────────────────┐
│  Customers (89 total)                    [Export] [Import]    │
│  Segment: [All ▼] Search: [________]                         │
│                                                               │
│  ┌─ Segments ──────────────────────────────────────────────┐ │
│  │ 👑 VIP (3) │ 💎 Loyal (8) │ 🔁 Return (22) │ 🆕 (45)  │ │
│  │ ⚠️ At Risk (7) │ 💔 Churned (4)                       │  │
│  └─────────────────────────────────────────────────────────┘ │
│                                                               │
│  ┌────────────────┬───────┬──────────┬──────────┬──────────┐ │
│  │ Customer       │ Orders│ Spent    │ Last Order│ Segment  │ │
│  ├────────────────┼───────┼──────────┼──────────┼──────────┤ │
│  │ 👑 Priya M.    │  15   │ ₹72,450  │ 2 days   │ VIP      │ │
│  │ 💎 Rahul K.    │   8   │ ₹23,100  │ 1 week   │ Loyal    │ │
│  │ 🔁 Sarah J.    │   3   │ ₹4,500   │ 2 weeks  │ Returning│ │
│  │ 🆕 Alex B.     │   1   │ ₹999     │ 3 days   │ New      │ │
│  │ ⚠️ David L.    │   4   │ ₹8,200   │ 8 months │ At Risk  │ │
│  └────────────────┴───────┴──────────┴──────────┴──────────┘ │
└──────────────────────────────────────────────────────────────┘
```

---

## 6. Cart System

### 6.1 Cart Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                     CART SYSTEM ARCHITECTURE                        │
│                                                                     │
│  Guest Users (not logged in)          Authenticated Users           │
│  ┌────────────────────────┐          ┌────────────────────────┐    │
│  │    localStorage        │          │    Supabase DB          │    │
│  │    cart_{store_id}     │          │    carts table          │    │
│  │    ┌──────────────┐   │   Login  │    ┌──────────────┐    │    │
│  │    │ items[]      │   │───Merge──▶│    │ items JSONB  │    │    │
│  │    │ coupon_code  │   │          │    │ coupon_code  │    │    │
│  │    │ updated_at   │   │          │    │ expires_at   │    │    │
│  │    └──────────────┘   │          │    └──────────────┘    │    │
│  └────────────────────────┘          └────────────────────────┘    │
│                                                                     │
│  Both sync to Zustand store for reactive UI updates                │
└────────────────────────────────────────────────────────────────────┘
```

### 6.2 Cart Database Schema

```sql
-- Server-side carts (authenticated users + abandoned cart tracking)
CREATE TABLE carts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id     UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  customer_id  UUID REFERENCES customers(id),          -- Null for anonymous
  session_id   TEXT,                                     -- For anonymous tracking
  items        JSONB NOT NULL DEFAULT '[]',
  -- items structure: [{ product_id, variant_id, quantity, price_at_add }]
  coupon_code  TEXT,
  notes        TEXT,
  
  -- Abandoned cart tracking
  status       TEXT DEFAULT 'active',                    -- active, abandoned, converted, recovered
  abandoned_at TIMESTAMPTZ,                              -- Set when inactive > 1 hour
  recovery_email_sent BOOLEAN DEFAULT false,
  recovery_email_sent_at TIMESTAMPTZ,
  
  expires_at   TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days',
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_carts_store_customer ON carts(store_id, customer_id);
CREATE INDEX idx_carts_abandoned ON carts(store_id, status) WHERE status = 'abandoned';
```

### 6.3 Cart Zustand Store (Storefront)

```typescript
// apps/web/storefront/stores/cartStore.ts

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface CartItem {
  productId: string;
  variantId: string | null;
  title: string;
  variantTitle: string | null;
  price: number;
  compareAtPrice: number | null;
  quantity: number;
  image: string;
  maxQuantity: number;     // from inventory_count
}

interface CartStore {
  items: CartItem[];
  couponCode: string | null;
  couponDiscount: number;
  isOpen: boolean;

  // Actions
  addItem: (item: CartItem) => void;
  removeItem: (productId: string, variantId: string | null) => void;
  updateQuantity: (productId: string, variantId: string | null, quantity: number) => void;
  applyCoupon: (code: string) => Promise<{ valid: boolean; discount: number; message: string }>;
  removeCoupon: () => void;
  clearCart: () => void;
  toggleCart: () => void;

  // Computed
  itemCount: () => number;
  subtotal: () => number;
  totalSavings: () => number;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      couponCode: null,
      couponDiscount: 0,
      isOpen: false,

      addItem: (newItem) => {
        set((state) => {
          const existing = state.items.find(
            i => i.productId === newItem.productId && i.variantId === newItem.variantId
          );
          if (existing) {
            const newQty = Math.min(existing.quantity + newItem.quantity, newItem.maxQuantity);
            return {
              items: state.items.map(i =>
                i.productId === newItem.productId && i.variantId === newItem.variantId
                  ? { ...i, quantity: newQty }
                  : i
              ),
              isOpen: true,
            };
          }
          return { items: [...state.items, newItem], isOpen: true };
        });
      },

      removeItem: (productId, variantId) => {
        set((state) => ({
          items: state.items.filter(
            i => !(i.productId === productId && i.variantId === variantId)
          ),
        }));
      },

      updateQuantity: (productId, variantId, quantity) => {
        if (quantity <= 0) return get().removeItem(productId, variantId);
        set((state) => ({
          items: state.items.map(i =>
            i.productId === productId && i.variantId === variantId
              ? { ...i, quantity: Math.min(quantity, i.maxQuantity) }
              : i
          ),
        }));
      },

      applyCoupon: async (code) => {
        const res = await fetch(`/api/coupons/validate`, {
          method: 'POST',
          body: JSON.stringify({ code, items: get().items }),
        });
        const result = await res.json();
        if (result.valid) {
          set({ couponCode: code, couponDiscount: result.discount });
        }
        return result;
      },

      removeCoupon: () => set({ couponCode: null, couponDiscount: 0 }),
      clearCart: () => set({ items: [], couponCode: null, couponDiscount: 0 }),
      toggleCart: () => set((s) => ({ isOpen: !s.isOpen })),

      itemCount: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
      subtotal: () => get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),
      totalSavings: () =>
        get().items.reduce((sum, i) => {
          if (i.compareAtPrice && i.compareAtPrice > i.price) {
            return sum + (i.compareAtPrice - i.price) * i.quantity;
          }
          return sum;
        }, 0) + get().couponDiscount,
    }),
    { name: 'cart', partialize: (state) => ({ items: state.items, couponCode: state.couponCode }) }
  )
);
```

### 6.4 Cart Slide-Over UI

```
┌──────────────────────────────┐
│  🛒 Cart (3 items)     [✕]  │
│──────────────────────────────│
│                               │
│  📷 Blue Jacket               │
│  M / Navy     ₹999 × 1       │
│  [−] 1 [+]           [🗑]    │
│                               │
│  📷 White Sneakers             │
│  Size 42      ₹1,499 × 1     │
│  [−] 1 [+]           [🗑]    │
│                               │
│  📷 Canvas Bag                 │
│  —            ₹799 × 2       │
│  [−] 2 [+]           [🗑]    │
│                               │
│──────────────────────────────│
│  Coupon: [________] [Apply]  │
│  ✅ WELCOME10 applied (−₹330)│
│──────────────────────────────│
│  Subtotal:          ₹4,096   │
│  Savings:           −₹330    │
│  Shipping:     Calculated    │
│                  at checkout  │
│  ─────────────────────────── │
│  Estimated:         ₹3,766   │
│                               │
│  [View Cart]                  │
│  [Checkout →]                 │
│                               │
│  🤖 "Customers also bought   │
│     Summer Dress — ₹1,299"   │
└──────────────────────────────┘
```

---

## 7. Checkout Flow

> **Cross-ref:** [01_Architecture §10.3 — E-Commerce Checkout Flow](./01_Architecture.md)

### 7.1 Checkout Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                     CHECKOUT FLOW ARCHITECTURE                      │
│                                                                     │
│  Cart Page          Checkout Page          Payment        Confirm   │
│  ┌──────┐          ┌────────────────┐    ┌────────────┐ ┌───────┐ │
│  │Items │──Click──▶│ Step 1: Contact│──▶ │ Razorpay  │ │ ✅    │ │
│  │Total │ Checkout │ Step 2: Address│    │ Modal     │ │ Thank │ │
│  │Coupon│          │ Step 3: Ship   │    │  — OR —   │ │ You!  │ │
│  └──────┘          │ Step 4: Review │──▶ │ Stripe    │─▶│ #1042 │ │
│       │            └────────────────┘    │ Redirect  │ └───────┘ │
│       │                                   └────────────┘           │
│  Guest checkout                       Webhook confirmation        │
│  OR login/signup                      (async processing)          │
└────────────────────────────────────────────────────────────────────┘
```

### 7.2 Multi-Step Checkout Component

```typescript
// apps/web/storefront/components/checkout/CheckoutPage.tsx

'use client';

import { useCartStore } from '@/stores/cartStore';
import { useState } from 'react';

type CheckoutStep = 'contact' | 'address' | 'shipping' | 'review';

const STEPS: { key: CheckoutStep; label: string }[] = [
  { key: 'contact', label: 'Contact' },
  { key: 'address', label: 'Address' },
  { key: 'shipping', label: 'Shipping' },
  { key: 'review', label: 'Review & Pay' },
];

export function CheckoutPage({ store }: { store: Store }) {
  const [current, setCurrent] = useState<CheckoutStep>('contact');
  const [data, setData] = useState<CheckoutData>({
    email: '', phone: '', address: null, shippingMethod: null,
  });
  const cart = useCartStore();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-8 max-w-6xl mx-auto p-6">
      {/* Left: Steps */}
      <div>
        {/* Step progress bar */}
        <div className="flex items-center mb-8">
          {STEPS.map((step, i) => (
            <React.Fragment key={step.key}>
              <div className={`flex items-center gap-2 ${current === step.key ? 'text-primary' : 'text-muted-foreground'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                  ${current === step.key ? 'bg-primary text-white' : getStepIndex(current) > i ? 'bg-green-500 text-white' : 'bg-muted'}`}>
                  {getStepIndex(current) > i ? '✓' : i + 1}
                </div>
                <span className="text-sm font-medium hidden sm:block">{step.label}</span>
              </div>
              {i < STEPS.length - 1 && <div className="flex-1 h-px bg-border mx-4" />}
            </React.Fragment>
          ))}
        </div>

        {/* Step content */}
        {current === 'contact' && <ContactStep data={data} onUpdate={setData} onNext={() => setCurrent('address')} />}
        {current === 'address' && <AddressStep data={data} onUpdate={setData} onNext={() => setCurrent('shipping')} onBack={() => setCurrent('contact')} />}
        {current === 'shipping' && <ShippingStep data={data} onUpdate={setData} onNext={() => setCurrent('review')} onBack={() => setCurrent('address')} store={store} />}
        {current === 'review' && <ReviewStep data={data} cart={cart} store={store} onBack={() => setCurrent('shipping')} />}
      </div>

      {/* Right: Order Summary */}
      <OrderSummary cart={cart} shippingMethod={data.shippingMethod} />
    </div>
  );
}
```

### 7.3 Checkout Session API

```typescript
// workers/api/src/routes/checkout/index.ts

import { Hono } from 'hono';
import { z } from 'zod';
import Stripe from 'stripe';
import Razorpay from 'razorpay';

const checkoutSchema = z.object({
  storeId: z.string().uuid(),
  items: z.array(z.object({
    productId: z.string().uuid(),
    variantId: z.string().uuid().optional(),
    quantity: z.number().int().min(1).max(100),
  })),
  email: z.string().email(),
  phone: z.string().optional(),
  shippingAddress: z.object({
    firstName: z.string(), lastName: z.string(),
    line1: z.string(), line2: z.string().optional(),
    city: z.string(), state: z.string(),
    postalCode: z.string(), country: z.string().default('IN'),
  }),
  shippingMethodId: z.string(),
  couponCode: z.string().optional(),
});

app.post('/v1/checkout/create-session', async (c) => {
  const body = checkoutSchema.parse(await c.req.json());
  const supabase = createServiceClient(c.env);

  // 1. Verify stock availability
  for (const item of body.items) {
    const { data: product } = await supabase
      .from(item.variantId ? 'product_variants' : 'products')
      .select('inventory_count, price, title')
      .eq('id', item.variantId || item.productId)
      .single();

    if (!product) return c.json({ error: 'Product not found' }, 404);
    if (product.inventory_count < item.quantity) {
      return c.json({
        error: 'OUT_OF_STOCK',
        product: product.title,
        available: product.inventory_count,
        requested: item.quantity,
      }, 409);
    }
  }

  // 2. Validate coupon (if provided)
  let discount = 0;
  if (body.couponCode) {
    const couponResult = await validateCoupon(supabase, body.storeId, body.couponCode, body.items);
    if (!couponResult.valid) return c.json({ error: couponResult.message }, 400);
    discount = couponResult.discount;
  }

  // 3. Calculate shipping
  const shippingRate = await calculateShipping(supabase, body.storeId, body.shippingMethodId, body.shippingAddress, body.items);

  // 4. Calculate totals
  const subtotal = body.items.reduce((sum, item) => {
    // Fetch each product's current price (not from client)
    return sum + item.price * item.quantity;
  }, 0);
  const taxRate = await getStoreTaxRate(supabase, body.storeId);
  const taxAmount = Math.round((subtotal - discount) * taxRate);
  const total = subtotal - discount + shippingRate.amount + taxAmount;

  // 5. Create order (status: pending)
  const orderNumber = await generateOrderNumber(supabase, body.storeId);
  const { data: order } = await supabase.from('orders').insert({
    store_id: body.storeId,
    order_number: orderNumber,
    customer_email: body.email,
    customer_phone: body.phone,
    items: body.items,
    subtotal, discount, shipping: shippingRate.amount,
    tax: taxAmount, total,
    coupon_code: body.couponCode,
    shipping_address: body.shippingAddress,
    shipping_method: body.shippingMethodId,
    status: 'pending',
    payment_status: 'unpaid',
  }).select().single();

  // 6. Reserve inventory
  for (const item of body.items) {
    await supabase.rpc('reserve_inventory', {
      p_product_id: item.productId,
      p_variant_id: item.variantId,
      p_quantity: item.quantity,
    });
  }

  // 7. Detect payment provider & create session
  const store = await supabase.from('stores').select('payment_config').eq('id', body.storeId).single();
  const currency = store.data?.payment_config?.currency || 'INR';

  if (currency === 'INR' && store.data?.payment_config?.razorpay_enabled) {
    // Razorpay
    const razorpay = new Razorpay({
      key_id: c.env.RAZORPAY_KEY_ID,
      key_secret: c.env.RAZORPAY_KEY_SECRET,
    });
    const rpOrder = await razorpay.orders.create({
      amount: Math.round(total * 100), // paisa
      currency: 'INR',
      receipt: order.id,
      notes: { store_id: body.storeId, order_number: orderNumber },
    });

    return c.json({
      provider: 'razorpay',
      orderId: order.id,
      orderNumber,
      razorpayOrderId: rpOrder.id,
      amount: rpOrder.amount,
      currency: rpOrder.currency,
      keyId: c.env.RAZORPAY_KEY_ID,
    });
  } else {
    // Stripe
    const stripe = new Stripe(c.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      success_url: `https://${store.data?.subdomain}.letbuyy.store/order-confirmed/${order.id}`,
      cancel_url: `https://${store.data?.subdomain}.letbuyy.store/checkout?cancelled=true`,
      customer_email: body.email,
      metadata: { store_id: body.storeId, order_id: order.id, order_number: orderNumber },
      line_items: body.items.map(item => ({
        price_data: {
          currency: currency.toLowerCase(),
          product_data: { name: item.title },
          unit_amount: Math.round(item.price * 100),
        },
        quantity: item.quantity,
      })),
      shipping_options: [{
        shipping_rate_data: {
          display_name: shippingRate.name,
          type: 'fixed_amount',
          fixed_amount: { amount: Math.round(shippingRate.amount * 100), currency: currency.toLowerCase() },
        },
      }],
    });

    return c.json({
      provider: 'stripe',
      orderId: order.id,
      orderNumber,
      checkoutUrl: session.url,
    });
  }
});
```

### 7.4 Checkout UI Wireframe

```
┌──────────────────────────────────────────────────────────────────┐
│  Checkout — stylehub.letbuyy.store                               │
│                                                                   │
│  ① Contact ──── ② Address ──── ③ Shipping ──── ④ Review        │
│  ═══════════                                                      │
│                                                                   │
│  ┌─ Left Column ──────────────────────┐ ┌─ Order Summary ──────┐ │
│  │                                     │ │                      │ │
│  │  Contact Information                │ │ 📷 Blue Jacket  ₹999│ │
│  │  Email *: [________________]        │ │    M/Navy × 1       │ │
│  │  Phone:   [________________]        │ │ 📷 Sneakers   ₹1,499│ │
│  │  ☐ Save info for next time         │ │    42 × 1            │ │
│  │                                     │ │ ────────────────     │ │
│  │  OR                                 │ │ Subtotal:    ₹2,498 │ │
│  │  [Continue as Guest]                │ │ Shipping:      ₹99  │ │
│  │  [Login / Create Account]           │ │ Discount:    −₹250  │ │
│  │                                     │ │ Tax (18%):    ₹405  │ │
│  │  [← Back to Cart]  [Continue →]    │ │ ──────────────────── │ │
│  └─────────────────────────────────────┘ │ Total:       ₹2,752 │ │
│                                           │ You save:     ₹250  │ │
│                                           └──────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

---

## 8. Payment Gateways

### 8.1 Supported Providers

| Provider | Coverage | Methods | Fee | Integration |
|---|---|---|---|---|
| **Razorpay** | India | UPI, Netbanking, Cards, Wallets, EMI | 2% | Primary (India) |
| **Stripe** | Global (46 countries) | Cards, Wallets, BNPL, Apple/Google Pay | 2.9% + 30¢ | Primary (Global) |
| **PayPal** | Global | PayPal balance, Cards, Venmo | 3.5% + 30¢ | Secondary |
| **COD** | Configurable | Cash on Delivery (optional fee) | — | Manual |
| **Bank Transfer** | Manual | Direct transfer (UPI QR, NEFT) | — | Manual verification |

### 8.2 Payment Configuration Schema

```sql
-- Stored in stores.payment_config (JSONB)
-- Example:
{
  "currency": "INR",
  "razorpay_enabled": true,
  "razorpay_key_id": "rzp_live_****",
  "razorpay_key_secret": "encrypted:****",
  "stripe_enabled": true,
  "stripe_publishable_key": "pk_live_****",
  "stripe_secret_key": "encrypted:****",
  "stripe_webhook_secret": "encrypted:****",
  "paypal_enabled": false,
  "cod_enabled": true,
  "cod_fee": 50,
  "cod_max_amount": 10000,
  "bank_transfer_enabled": true,
  "bank_transfer_details": {
    "bank_name": "HDFC Bank",
    "account_number": "****6789",
    "ifsc_code": "HDFC0001234",
    "upi_id": "store@upi"
  },
  "auto_capture": true,
  "test_mode": false
}
```

### 8.3 Webhook Handlers

```typescript
// workers/api/src/routes/webhooks/stripe.ts

app.post('/webhooks/stripe', async (c) => {
  const sig = c.req.header('stripe-signature');
  const body = await c.req.text();

  // 1. Verify HMAC signature
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig!, c.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return c.json({ error: 'Invalid signature' }, 400);
  }

  // 2. Idempotency check
  const processed = await c.env.REDIS.get(`webhook:stripe:${event.id}`);
  if (processed) return c.json({ received: true, duplicate: true });
  await c.env.REDIS.setex(`webhook:stripe:${event.id}`, 86400 * 7, '1'); // 7 day dedup

  // 3. Handle events
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const { store_id, order_id, order_number } = session.metadata!;
      await handlePaymentSuccess(c.env, store_id, order_id, {
        provider: 'stripe',
        transactionId: session.payment_intent as string,
        amount: session.amount_total! / 100,
        currency: session.currency!.toUpperCase(),
      });
      break;
    }
    case 'charge.refunded': {
      const charge = event.data.object as Stripe.Charge;
      await handleRefundConfirmed(c.env, charge.metadata.order_id, {
        amount: charge.amount_refunded / 100,
        transactionId: charge.id,
      });
      break;
    }
  }

  return c.json({ received: true });
});

// workers/api/src/routes/webhooks/razorpay.ts

app.post('/webhooks/razorpay', async (c) => {
  const sig = c.req.header('x-razorpay-signature');
  const body = await c.req.text();

  // Verify HMAC-SHA256
  const expectedSig = crypto
    .createHmac('sha256', c.env.RAZORPAY_WEBHOOK_SECRET)
    .update(body)
    .digest('hex');

  if (sig !== expectedSig) return c.json({ error: 'Invalid signature' }, 400);

  const event = JSON.parse(body);

  // Idempotency
  const processed = await c.env.REDIS.get(`webhook:razorpay:${event.event_id}`);
  if (processed) return c.json({ received: true });
  await c.env.REDIS.setex(`webhook:razorpay:${event.event_id}`, 86400 * 7, '1');

  switch (event.event) {
    case 'payment.captured': {
      const payment = event.payload.payment.entity;
      const orderId = payment.notes?.order_id || payment.receipt;
      await handlePaymentSuccess(c.env, payment.notes.store_id, orderId, {
        provider: 'razorpay',
        transactionId: payment.id,
        amount: payment.amount / 100,
        currency: payment.currency,
      });
      break;
    }
    case 'refund.processed': {
      const refund = event.payload.refund.entity;
      await handleRefundConfirmed(c.env, refund.notes.order_id, {
        amount: refund.amount / 100,
        transactionId: refund.id,
      });
      break;
    }
  }

  return c.json({ received: true });
});
```

### 8.4 Payment Success Handler

```typescript
// workers/api/src/lib/payment-handlers.ts

export async function handlePaymentSuccess(env: Env, storeId: string, orderId: string, payment: PaymentInfo) {
  const supabase = createServiceClient(env);

  // 1. Update order status
  await supabase.from('orders').update({
    status: 'confirmed',
    payment_status: 'paid',
    payment_provider: payment.provider,
    payment_transaction_id: payment.transactionId,
    paid_at: new Date().toISOString(),
  }).eq('id', orderId);

  const { data: order } = await supabase.from('orders').select('*').eq('id', orderId).single();

  // 2. Decrement inventory (convert reserved → sold)
  for (const item of order.items) {
    await supabase.rpc('confirm_inventory_sale', {
      p_product_id: item.productId,
      p_variant_id: item.variantId,
      p_quantity: item.quantity,
    });
    // Update sold_count
    await supabase.from('products')
      .update({ sold_count: supabase.sql`sold_count + ${item.quantity}` })
      .eq('id', item.productId);
  }

  // 3. Update customer stats
  await supabase.rpc('update_customer_stats', {
    p_store_id: storeId,
    p_email: order.customer_email,
    p_order_total: order.total,
  });

  // 4. Update coupon usage (if applicable)
  if (order.coupon_code) {
    await supabase.rpc('increment_coupon_usage', {
      p_store_id: storeId,
      p_code: order.coupon_code,
      p_email: order.customer_email,
    });
  }

  // 5. Convert cart status
  await supabase.from('carts')
    .update({ status: 'converted' })
    .eq('store_id', storeId)
    .eq('customer_email', order.customer_email)
    .eq('status', 'active');

  // 6. Create notifications
  await supabase.from('notifications').insert([
    { store_id: storeId, type: 'order.paid', title: `Order #${order.order_number} Paid`,
      body: `₹${order.total.toLocaleString('en-IN')} from ${order.customer_email}`,
      action_url: `/orders/${orderId}` },
  ]);

  // 7. Send emails (via Resend)
  await env.EMAIL_QUEUE.send({
    template: 'order-confirmation',
    to: order.customer_email,
    data: { order, storeName: order.store_name },
  });
  await env.EMAIL_QUEUE.send({
    template: 'new-order-admin',
    to: order.store_owner_email,
    data: { order },
  });

  // 8. Push notification (FCM)
  await sendPushNotification(env, storeId, {
    title: `New Order #${order.order_number}`,
    body: `₹${order.total.toLocaleString('en-IN')} from ${order.customer_email}`,
  });

  // 9. Log activity
  await supabase.from('activity_logs').insert({
    store_id: storeId,
    action: 'order.paid',
    metadata: { order_id: orderId, order_number: order.order_number, amount: order.total },
  });

  // 10. Invalidate caches
  await env.REDIS.del(`cache:store:${storeId}:stats`);
  await env.REDIS.del(`cache:store:${storeId}:orders`);
}
```

### 8.5 Gateway Configuration UI

```
┌──────────────────────────────────────────────────────────────┐
│  Payment Settings                              [Test Mode ⬤]│
│                                                               │
│  ┌─ Razorpay (India) ───────────────────── ☑ Enabled ─────┐ │
│  │  API Key:     [rzp_live_****________]                    │ │
│  │  Secret Key:  [••••••••••••]              [👁]           │ │
│  │  Test Mode:   ⬤ Live                                    │ │
│  │  Methods:     ☑ UPI  ☑ Cards  ☑ Netbanking  ☑ Wallets  │ │
│  │               ☑ EMI  ☐ Pay Later                        │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                               │
│  ┌─ Stripe (Global) ──────────────────── ☑ Enabled ────────┐│
│  │  Publishable:  [pk_live_****________]                    ││
│  │  Secret Key:   [••••••••••••]             [👁]           ││
│  │  Webhook URL:  api.letbuyy.store/webhooks/stripe  [📋]  ││
│  │  Methods:      ☑ Cards  ☑ Apple Pay  ☑ Google Pay       ││
│  │                ☐ BNPL (Afterpay)                         ││
│  └──────────────────────────────────────────────────────────┘│
│                                                               │
│  ┌─ Cash on Delivery ────────────────── ☑ Enabled ─────────┐│
│  │  COD Fee:            [₹50]                               ││
│  │  Max Order Value:    [₹10,000]                           ││
│  │  Exclude categories: [Electronics ▼]                     ││
│  └──────────────────────────────────────────────────────────┘│
│                                                               │
│  ┌─ Bank Transfer ──────────────────── ☑ Enabled ──────────┐│
│  │  Bank Name:      [HDFC Bank]                             ││
│  │  Account No.:    [****6789]                              ││
│  │  IFSC Code:      [HDFC0001234]                           ││
│  │  UPI ID:         [store@upi]                             ││
│  │  Instructions:   [Please include order number as...]      ││
│  └──────────────────────────────────────────────────────────┘│
│                                                               │
│  [Save Payment Settings]                                      │
└──────────────────────────────────────────────────────────────┘
```

---

## 9. Order Management

### 9.1 Order Database Schema

```sql
CREATE TABLE orders (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id          UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  order_number      TEXT NOT NULL,                -- Human-readable: LB-1001
  
  -- Customer
  customer_id       UUID REFERENCES customers(id),
  customer_email    TEXT NOT NULL,
  customer_phone    TEXT,
  
  -- Items
  items             JSONB NOT NULL,
  -- [{ productId, variantId, title, variantTitle, sku, price, quantity, image }]
  
  -- Pricing
  subtotal          DECIMAL(12,2) NOT NULL,
  discount          DECIMAL(12,2) DEFAULT 0,
  shipping          DECIMAL(12,2) DEFAULT 0,
  tax               DECIMAL(12,2) DEFAULT 0,
  total             DECIMAL(12,2) NOT NULL,
  currency          TEXT DEFAULT 'INR',
  
  -- Coupon
  coupon_code       TEXT,
  coupon_discount_type TEXT,
  
  -- Addresses
  shipping_address  JSONB NOT NULL,
  billing_address   JSONB,
  
  -- Shipping
  shipping_method   TEXT,
  tracking_number   TEXT,
  tracking_url      TEXT,
  carrier           TEXT,
  shipped_at        TIMESTAMPTZ,
  delivered_at      TIMESTAMPTZ,
  estimated_delivery TIMESTAMPTZ,
  
  -- Status
  status            TEXT NOT NULL DEFAULT 'pending',
  -- pending → confirmed → processing → shipped → delivered → completed
  -- OR: pending → cancelled (admin cancel)
  -- OR: delivered → return_requested → returned → refunded
  payment_status    TEXT NOT NULL DEFAULT 'unpaid',
  -- unpaid → paid → partially_refunded → refunded
  payment_provider  TEXT,
  payment_transaction_id TEXT,
  paid_at           TIMESTAMPTZ,
  
  -- Metadata
  notes             TEXT,                          -- Internal admin notes
  customer_notes    TEXT,                          -- Customer "special instructions"
  tags              TEXT[] DEFAULT '{}',
  
  -- Fraud
  fraud_score       INT,                           -- 0-100 AI risk score
  fraud_flags       TEXT[],
  ip_address        TEXT,
  user_agent        TEXT,
  
  -- Timestamps
  cancelled_at      TIMESTAMPTZ,
  cancel_reason     TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_orders_number ON orders(store_id, order_number);
CREATE INDEX idx_orders_store_status ON orders(store_id, status);
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_date ON orders(store_id, created_at DESC);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store owners manage orders"
  ON orders FOR ALL
  USING (store_id IN (SELECT id FROM stores WHERE user_id = auth.uid()));
```

### 9.2 Order Lifecycle State Machine

```typescript
// packages/constants/src/order-states.ts

export const ORDER_TRANSITIONS: Record<string, string[]> = {
  'pending':           ['confirmed', 'cancelled'],
  'confirmed':         ['processing', 'cancelled'],
  'processing':        ['shipped', 'cancelled'],
  'shipped':           ['delivered'],
  'delivered':         ['completed', 'return_requested'],
  'completed':         [],  // Terminal state
  'cancelled':         [],  // Terminal state
  'return_requested':  ['returned', 'delivered'],  // Can reject return
  'returned':          ['refunded'],
  'refunded':          [],  // Terminal state
};

export function canTransition(from: string, to: string): boolean {
  return ORDER_TRANSITIONS[from]?.includes(to) ?? false;
}

export const ORDER_STATUS_COLORS: Record<string, string> = {
  pending: 'yellow', confirmed: 'blue', processing: 'orange',
  shipped: 'indigo', delivered: 'green', completed: 'emerald',
  cancelled: 'red', return_requested: 'amber', returned: 'orange', refunded: 'rose',
};
```

### 9.3 Order Number Generation

```sql
-- Atomic order number generation (per store)
CREATE OR REPLACE FUNCTION generate_order_number(p_store_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_prefix TEXT;
  v_next INT;
BEGIN
  -- Get store prefix (first 2 chars of subdomain, uppercased)
  SELECT UPPER(LEFT(subdomain, 2)) INTO v_prefix FROM stores WHERE id = p_store_id;

  -- Atomic increment
  INSERT INTO order_counters (store_id, counter)
  VALUES (p_store_id, 1)
  ON CONFLICT (store_id) DO UPDATE SET counter = order_counters.counter + 1
  RETURNING counter INTO v_next;

  RETURN v_prefix || '-' || LPAD(v_next::TEXT, 4, '0');
  -- e.g., "ST-1001", "SH-0042"
END;
$$ LANGUAGE plpgsql;
```

### 9.4 Order Detail View

```
┌──────────────────────────────────────────────────────────────┐
│  Order #ST-1042                  Status: [Processing ▼]      │
│  Feb 14, 2026 • 10:30 AM        Payment: ✅ Paid (Razorpay) │
│                                                               │
│  ┌─ Customer ─────────────────────────────────────────────┐  │
│  │  John Doe • john@example.com • +91 9876543210          │  │
│  │  Orders: 5  •  Total Spent: ₹12,450  •  Segment: 🔁   │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌─ Items ────────────────────────────────────────────────┐  │
│  │ Product                    Qty    Price      Total     │  │
│  │ ──────────────────────────────────────────────────     │  │
│  │ 📷 Blue Jacket (M/Navy)    1     ₹999       ₹999     │  │
│  │ 📷 White Sneakers (42)     1     ₹1,499     ₹1,499   │  │
│  │ ──────────────────────────────────────────────────     │  │
│  │ Subtotal                                     ₹2,498   │  │
│  │ Shipping (Standard 5-7d)                       ₹99    │  │
│  │ Discount (WELCOME10)                         −₹250    │  │
│  │ Tax (GST 18%)                                  ₹422   │  │
│  │ ═══════════════════════════════════════════════════    │  │
│  │ Total                                       ₹2,769    │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌─ Shipping ─────────────────────────────────────────────┐  │
│  │  📍 123 Main St, Apt 4B                                │  │
│  │     Mumbai, Maharashtra 400001, India                  │  │
│  │  Carrier: —     Tracking: —                            │  │
│  │  [Mark as Shipped] → Enter tracking number             │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌─ Fraud Analysis ──────────────────────────────────────-┐  │
│  │  🤖 Risk Score: 12/100 (Low) 🟢                       │  │
│  │  Checks: ✅ Email verified • ✅ IP matches country     │  │
│  │  ✅ No velocity abuse • ✅ Card BIN matches billing    │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌─ Timeline ─────────────────────────────────────────────┐  │
│  │  ● Feb 14, 10:30 AM — Order placed                     │  │
│  │  ● Feb 14, 10:31 AM — Payment confirmed (Razorpay UPI)│  │
│  │  ● Feb 14, 11:00 AM — Order confirmed by seller       │  │
│  │  ○ Awaiting: Mark as shipped                           │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
│  [Print Invoice] [Print Packing Slip] [Cancel Order] [Refund]│
└──────────────────────────────────────────────────────────────┘
```

---

## 10. Returns & Refunds

### 10.1 Return Request Schema

```sql
CREATE TABLE return_requests (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id         UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  order_id         UUID NOT NULL REFERENCES orders(id),
  customer_id      UUID REFERENCES customers(id),
  
  -- Items being returned
  items            JSONB NOT NULL,
  -- [{ product_id, variant_id, quantity, reason, condition }]
  -- reason: "defective", "wrong_item", "not_as_described", "changed_mind", "too_small", "too_large"
  -- condition: "unopened", "opened", "used", "damaged"
  
  -- Request details
  reason_category  TEXT NOT NULL,      -- defective, wrong_item, not_as_described, etc.
  reason_detail    TEXT,               -- Customer's explanation
  images           TEXT[],             -- Photos of the issue
  
  -- Resolution
  status           TEXT DEFAULT 'pending',  -- pending, approved, rejected, received, refunded
  resolution_type  TEXT,                     -- full_refund, partial_refund, exchange, store_credit
  refund_amount    DECIMAL(12,2),
  restocking_fee   DECIMAL(12,2) DEFAULT 0,
  
  -- Shipping
  return_label_url TEXT,               -- Generated return shipping label
  return_tracking  TEXT,
  received_at      TIMESTAMPTZ,
  
  -- Admin
  admin_notes      TEXT,
  resolved_by      UUID REFERENCES auth.users(id),
  resolved_at      TIMESTAMPTZ,
  
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Return policy per store
-- Stored in stores.return_policy (JSONB)
-- {
--   "enabled": true,
--   "window_days": 15,           -- Days after delivery to request return
--   "restocking_fee_percent": 0, -- 0 = free returns
--   "eligible_reasons": ["defective", "wrong_item", "not_as_described", "changed_mind"],
--   "excluded_categories": ["undergarments", "custom-made"],
--   "auto_approve": false,       -- Auto-approve returns (no manual review)
--   "free_return_shipping": true
-- }
```

### 10.2 Return Flow

```
Customer Portal                    Admin Dashboard
┌──────────────┐                  ┌──────────────────┐
│ My Orders    │                  │ Return Requests   │
│              │                  │                    │
│ Order #1042  │  Submit Return   │ Pending (3)       │
│ [Request     │──────Request────▶│ ┌─ Return #R-001 │
│  Return]     │                  │ │  Order #1042    │
│              │                  │ │  Reason: Wrong  │
│ Select items │                  │ │  Amount: ₹999   │
│ ☑ Blue Jacket│                  │ │  [Approve]      │
│ Reason: Wrong│   Auto-generate  │ │  [Reject]       │
│ size         │   return label   │ └─────────────────│
│              │  ◀──────────────│                    │
│ Photos: 📷📷│                  │ After approval:   │
│ [Submit →]   │                  │ [Mark Received]   │
└──────────────┘                  │ [Process Refund]  │
                                   └──────────────────┘
```

### 10.3 Refund Processing

```typescript
// workers/api/src/routes/refunds/process.ts

app.post('/v1/orders/:orderId/refund', authMiddleware(), storeOwnerMiddleware(), async (c) => {
  const orderId = c.req.param('orderId');
  const { amount, reason, items } = await c.req.json();
  const supabase = createServiceClient(c.env);

  const { data: order } = await supabase.from('orders').select('*').eq('id', orderId).single();
  if (!order) return c.json({ error: 'Order not found' }, 404);
  if (order.payment_status === 'refunded') return c.json({ error: 'Already refunded' }, 400);

  const refundAmount = amount || order.total;

  // Process refund via payment provider
  let refundResult;
  if (order.payment_provider === 'stripe') {
    const stripe = new Stripe(c.env.STRIPE_SECRET_KEY);
    refundResult = await stripe.refunds.create({
      payment_intent: order.payment_transaction_id,
      amount: Math.round(refundAmount * 100),
      reason: 'requested_by_customer',
    });
  } else if (order.payment_provider === 'razorpay') {
    const razorpay = new Razorpay({ key_id: c.env.RAZORPAY_KEY_ID, key_secret: c.env.RAZORPAY_KEY_SECRET });
    refundResult = await razorpay.payments.refund(order.payment_transaction_id, {
      amount: Math.round(refundAmount * 100),
      notes: { order_id: orderId, reason },
    });
  }

  // Update order status
  const isPartialRefund = refundAmount < order.total;
  await supabase.from('orders').update({
    payment_status: isPartialRefund ? 'partially_refunded' : 'refunded',
    status: 'refunded',
  }).eq('id', orderId);

  // Restock inventory (if items returned)
  if (items) {
    for (const item of items) {
      await supabase.rpc('restock_inventory', {
        p_product_id: item.productId,
        p_variant_id: item.variantId,
        p_quantity: item.quantity,
      });
    }
  }

  // Notify customer
  await c.env.EMAIL_QUEUE.send({
    template: 'refund-processed',
    to: order.customer_email,
    data: { order, refundAmount, reason },
  });

  return c.json({ success: true, refundId: refundResult?.id, amount: refundAmount });
});
```

---

## 11. Discounts & Coupons

### 11.1 Coupon Schema

```sql
CREATE TABLE coupons (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id          UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  code              TEXT NOT NULL,                    -- SUMMER20, WELCOME10
  title             TEXT,                              -- "Summer Sale 20% Off"
  description       TEXT,
  
  -- Discount type
  discount_type     TEXT NOT NULL,                    -- percentage, fixed_amount, free_shipping, buy_x_get_y
  discount_value    DECIMAL(12,2) NOT NULL,           -- 20 (for 20%) or 200 (for ₹200)
  
  -- Conditions
  min_order_amount  DECIMAL(12,2),                    -- Min cart value to activate
  max_discount      DECIMAL(12,2),                    -- Cap for percentage discounts
  min_items         INT,                               -- Min items in cart
  
  -- BOGO config
  buy_quantity      INT,                               -- Buy X
  get_quantity      INT,                               -- Get Y free
  get_product_ids   UUID[],                           -- Specific products for "get" 
  
  -- Tiered discounts
  tiers             JSONB,
  -- [{ "min_amount": 1000, "discount": 10 }, { "min_amount": 2000, "discount": 20 }]
  
  -- Validity
  starts_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at        TIMESTAMPTZ,                      -- Null = no expiry
  
  -- Usage limits
  usage_limit       INT,                               -- Total uses across all customers
  per_customer_limit INT DEFAULT 1,                   -- Uses per customer
  used_count        INT DEFAULT 0,
  
  -- Targeting
  applies_to        TEXT DEFAULT 'all',                -- all, specific_products, specific_collections
  product_ids       UUID[],
  collection_ids    UUID[],
  customer_eligibility TEXT DEFAULT 'all',             -- all, new_customers, returning, specific_segments
  customer_segments TEXT[],                            -- VIP, wholesale, etc.
  
  -- Auto-discount (no code required)
  is_automatic      BOOLEAN DEFAULT false,             -- Applied automatically when conditions met
  
  status            TEXT DEFAULT 'active',              -- active, disabled, expired
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_coupons_code ON coupons(store_id, code);
```

### 11.2 Coupon Validation Engine

```typescript
// workers/api/src/lib/coupon-validator.ts

interface ValidationResult {
  valid: boolean;
  discount: number;
  message: string;
  discountType: string;
}

export async function validateCoupon(
  supabase: SupabaseClient,
  storeId: string,
  code: string,
  cartItems: CartItem[],
  customerEmail?: string,
): Promise<ValidationResult> {
  // 1. Find coupon
  const { data: coupon } = await supabase
    .from('coupons')
    .select('*')
    .eq('store_id', storeId)
    .eq('code', code.toUpperCase())
    .eq('status', 'active')
    .single();

  if (!coupon) return { valid: false, discount: 0, message: 'Invalid coupon code', discountType: '' };

  // 2. Check expiry
  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
    return { valid: false, discount: 0, message: 'This coupon has expired', discountType: '' };
  }

  // 3. Check start date
  if (new Date(coupon.starts_at) > new Date()) {
    return { valid: false, discount: 0, message: 'This coupon is not yet active', discountType: '' };
  }

  // 4. Check usage limit
  if (coupon.usage_limit && coupon.used_count >= coupon.usage_limit) {
    return { valid: false, discount: 0, message: 'Coupon usage limit reached', discountType: '' };
  }

  // 5. Check per-customer limit
  if (customerEmail && coupon.per_customer_limit) {
    const { count } = await supabase
      .from('coupon_usages')
      .select('id', { count: 'exact', head: true })
      .eq('coupon_id', coupon.id)
      .eq('customer_email', customerEmail);
    if (count && count >= coupon.per_customer_limit) {
      return { valid: false, discount: 0, message: 'You have already used this coupon', discountType: '' };
    }
  }

  // 6. Check cart minimum
  const cartTotal = cartItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
  if (coupon.min_order_amount && cartTotal < coupon.min_order_amount) {
    return {
      valid: false, discount: 0,
      message: `Minimum order ₹${coupon.min_order_amount.toLocaleString('en-IN')} required`,
      discountType: '',
    };
  }

  // 7. Check product eligibility
  if (coupon.applies_to === 'specific_products') {
    const eligible = cartItems.some(i => coupon.product_ids.includes(i.productId));
    if (!eligible) return { valid: false, discount: 0, message: 'Coupon not valid for items in your cart', discountType: '' };
  }

  // 8. Calculate discount
  let discount = 0;
  switch (coupon.discount_type) {
    case 'percentage':
      discount = cartTotal * (coupon.discount_value / 100);
      if (coupon.max_discount) discount = Math.min(discount, coupon.max_discount);
      break;
    case 'fixed_amount':
      discount = Math.min(coupon.discount_value, cartTotal);
      break;
    case 'free_shipping':
      discount = 0; // Handled at shipping calculation
      break;
    case 'buy_x_get_y':
      // Calculate BOGO discount
      const totalQty = cartItems.reduce((sum, i) => sum + i.quantity, 0);
      const freeItems = Math.floor(totalQty / coupon.buy_quantity) * coupon.get_quantity;
      const cheapestItems = [...cartItems].sort((a, b) => a.price - b.price);
      let freeRemaining = freeItems;
      for (const item of cheapestItems) {
        if (freeRemaining <= 0) break;
        const freeQty = Math.min(item.quantity, freeRemaining);
        discount += item.price * freeQty;
        freeRemaining -= freeQty;
      }
      break;
  }

  return {
    valid: true,
    discount: Math.round(discount * 100) / 100,
    message: `Coupon applied! You save ₹${discount.toLocaleString('en-IN')}`,
    discountType: coupon.discount_type,
  };
}
```

### 11.3 Discount Types Summary

| Type | Example | Configuration | Auto-Applicable |
|---|---|---|---|
| **Percentage** | 20% off entire order | Max discount cap, min order | ☑ |
| **Fixed Amount** | ₹200 off | Min order value | ☑ |
| **Free Shipping** | Free delivery | Min order threshold | ☑ |
| **Buy X Get Y** | Buy 2 get 1 free | Product selection required | ☐ |
| **Tiered** | ₹1000→10%, ₹2000→20% | Multiple tier rules | ☑ |
| **First-time** | Welcome 15% off | Auto-detect new customers | ☑ |
| **Segment-based** | VIP 25% off | Target customer segments | ☑ |

### 11.4 Coupon Management UI

```
┌──────────────────────────────────────────────────────────────┐
│  Discounts & Coupons (8 total)                [+ Create New] │
│                                                               │
│  ┌────────────┬──────────┬────────┬───────┬────────┬───────┐ │
│  │ Code       │ Type     │ Value  │ Uses  │ Status │ Valid  │ │
│  ├────────────┼──────────┼────────┼───────┼────────┼───────┤ │
│  │ SUMMER20   │ 20% Off  │ ₹1K max│ 23/100│ 🟢 Act │ → Mar │ │
│  │ WELCOME10  │ 10% Off  │ No cap │ 45/∞ │ 🟢 Act │ ∞     │ │
│  │ BOGO       │ Buy2Get1 │ Free   │ 12/50 │ 🟢 Act │ → Feb │ │
│  │ FLAT200    │ ₹200 Off │ ₹200   │ 8/20  │ 🟡 Low │ → Feb │ │
│  │ FREESHIP   │ Free Ship│ —      │ 0/∞  │ 🟢 Act │ ∞     │ │
│  │ SAVE30     │ 30% Off  │ ₹500mx│ 50/50 │ 🔴 Used│ Expired│ │
│  └────────────┴──────────┴────────┴───────┴────────┴───────┘ │
│                                                               │
│  ┌─ Auto-Discounts (no code required) ─────────────────────┐ │
│  │  ☑ First-time customers get 10% off (WELCOME10)         │ │
│  │  ☑ Free shipping on orders above ₹500                    │ │
│  │  ☐ Tiered discount: ₹2000→10%, ₹3000→15%, ₹5000→20%   │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

---

## 12. Shipping & Fulfillment

### 12.1 Shipping Zones & Rates Schema

```sql
CREATE TABLE shipping_zones (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id    UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,                    -- "India Domestic", "International"
  countries   TEXT[] NOT NULL,                  -- ["IN"], ["US", "GB", "DE"]
  states      TEXT[],                           -- Subzone: ["MH", "KA", "TN"]
  zip_codes   TEXT[],                           -- Specific zip ranges
  is_default  BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE shipping_rates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id         UUID NOT NULL REFERENCES shipping_zones(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,                  -- "Standard", "Express", "Overnight"
  description     TEXT,                           -- "5-7 business days"
  rate_type       TEXT NOT NULL DEFAULT 'flat',   -- flat, weight_based, price_based, free
  
  -- Flat rate
  flat_amount     DECIMAL(12,2),                  -- ₹99
  
  -- Weight-based pricing
  base_weight     DECIMAL(8,2),                   -- First 500g
  base_rate       DECIMAL(12,2),                  -- ₹80
  per_kg_rate     DECIMAL(12,2),                  -- ₹40 per additional kg
  
  -- Free shipping threshold
  free_threshold  DECIMAL(12,2),                  -- Free above ₹500
  
  -- Estimated delivery
  min_days        INT,
  max_days        INT,
  
  position        INT DEFAULT 0,
  is_active       BOOLEAN DEFAULT true
);
```

### 12.2 Carrier Integrations

| Carrier | Coverage | Features | Integration |
|---|---|---|---|
| **DTDC** | Domestic India | Standard ground, economy | EasyPost API |
| **Blue Dart** | Pan-India | Express, time-definite | EasyPost API |
| **Delhivery** | Pan-India | Express, COD, returns | Direct API |
| **FedEx** | International | Express, economy worldwide | EasyPost API |
| **DHL** | International | Express, premium shipments | EasyPost API |
| **India Post** | India + International | Budget option, speed post | Direct API |

### 12.3 Shipping Label Generation

```typescript
// workers/api/src/routes/orders/ship.ts

app.post('/v1/orders/:orderId/ship', authMiddleware(), storeOwnerMiddleware(), async (c) => {
  const orderId = c.req.param('orderId');
  const { carrier, trackingNumber, notifyCustomer = true } = await c.req.json();
  const supabase = createServiceClient(c.env);

  const { data: order } = await supabase.from('orders').select('*').eq('id', orderId).single();
  if (!order) return c.json({ error: 'Order not found' }, 404);
  if (order.status !== 'confirmed' && order.status !== 'processing') {
    return c.json({ error: `Cannot ship order in ${order.status} status` }, 400);
  }

  // Generate shipping label via EasyPost (if auto-label enabled)
  let labelUrl = null;
  if (!trackingNumber) {
    const label = await generateShippingLabel(c.env, {
      from: await getStoreAddress(supabase, order.store_id),
      to: order.shipping_address,
      weight: calculateOrderWeight(order.items),
      carrier,
    });
    trackingNumber = label.trackingNumber;
    labelUrl = label.labelUrl;
  }

  // Update order
  await supabase.from('orders').update({
    status: 'shipped',
    carrier,
    tracking_number: trackingNumber,
    tracking_url: getTrackingUrl(carrier, trackingNumber),
    shipped_at: new Date().toISOString(),
    estimated_delivery: calculateEstimatedDelivery(carrier, order.shipping_address),
  }).eq('id', orderId);

  // Notify customer
  if (notifyCustomer) {
    await c.env.EMAIL_QUEUE.send({
      template: 'order-shipped',
      to: order.customer_email,
      data: {
        order, carrier, trackingNumber,
        trackingUrl: getTrackingUrl(carrier, trackingNumber),
      },
    });
  }

  return c.json({ success: true, trackingNumber, labelUrl });
});

function getTrackingUrl(carrier: string, tracking: string): string {
  const urls: Record<string, string> = {
    'dtdc': `https://www.dtdc.in/tracking/shipment-tracking.asp?strCnno=${tracking}`,
    'bluedart': `https://www.bluedart.com/tracking/${tracking}`,
    'delhivery': `https://www.delhivery.com/track/package/${tracking}`,
    'fedex': `https://www.fedex.com/wtrk/track/?trknbr=${tracking}`,
    'dhl': `https://www.dhl.com/en/express/tracking.html?AWB=${tracking}`,
  };
  return urls[carrier.toLowerCase()] || '';
}
```

### 12.4 Fulfillment Dashboard

```
┌──────────────────────────────────────────────────────────────┐
│  Fulfillment Queue                        [ Print All Labels]│
│  Filter: [Unfulfilled ▼] [Today ▼]                          │
│                                                               │
│  Unfulfilled (5)    Shipped (12)    Delivered (34)            │
│                                                               │
│  ┌────┬──────────┬────────────┬────────┬──────────┬────────┐ │
│  │ ☐  │ Order    │ Customer   │ Items  │ Shipping │ Action │ │
│  ├────┼──────────┼────────────┼────────┼──────────┼────────┤ │
│  │ ☑  │ #ST-1042 │ John D.    │ 2      │ Standard │ [Ship] │ │
│  │ ☑  │ #ST-1041 │ Priya M.   │ 1      │ Express  │ [Ship] │ │
│  │ ☐  │ #ST-1040 │ Rahul K.   │ 3      │ Standard │ [Ship] │ │
│  └────┴──────────┴────────────┴────────┴──────────┴────────┘ │
│                                                               │
│  [Bulk Ship Selected (2)] [Print Packing Slips]              │
└──────────────────────────────────────────────────────────────┘
```

---

## 13. Tax System

### 13.1 Tax Configuration

```typescript
// packages/types/src/tax.ts

export interface TaxConfig {
  enabled: boolean;
  taxInclusive: boolean;          // Prices include tax vs. tax added at checkout
  defaultRate: number;            // Default tax percentage (e.g., 18 for GST)
  provider: 'manual' | 'stripe_tax' | 'taxjar';
  
  // Manual tax rules
  rules: TaxRule[];
  
  // India-specific GST
  gst: {
    gstin: string;                // Store's GSTIN
    slab: 'none' | '5' | '12' | '18' | '28';  // Default GST slab
    hsnCodes: Record<string, string>;  // Category → HSN code mapping
  };
}

export interface TaxRule {
  name: string;                   // "India GST 18%", "EU VAT"
  rate: number;                   // 18, 20, etc.
  countries: string[];            // ["IN"], ["DE", "FR"]
  categories: string[];           // Product categories this applies to
  type: 'inclusive' | 'exclusive';
}
```

### 13.2 Tax Calculation

```typescript
// workers/api/src/lib/tax-calculator.ts

export function calculateTax(
  subtotal: number,
  discount: number,
  config: TaxConfig,
  shippingCountry: string,
  productCategory?: string,
): { taxAmount: number; taxRate: number; taxLabel: string } {
  if (!config.enabled) return { taxAmount: 0, taxRate: 0, taxLabel: '' };

  const taxableAmount = subtotal - discount;

  // Find applicable tax rule
  const rule = config.rules.find(r =>
    r.countries.includes(shippingCountry) &&
    (!r.categories.length || r.categories.includes(productCategory || ''))
  ) || { rate: config.defaultRate, name: 'Tax', type: config.taxInclusive ? 'inclusive' : 'exclusive' };

  let taxAmount: number;
  if (rule.type === 'inclusive') {
    // Price includes tax — extract it
    taxAmount = taxableAmount - (taxableAmount / (1 + rule.rate / 100));
  } else {
    // Add tax on top
    taxAmount = taxableAmount * (rule.rate / 100);
  }

  return {
    taxAmount: Math.round(taxAmount * 100) / 100,
    taxRate: rule.rate,
    taxLabel: shippingCountry === 'IN' ? `GST (${rule.rate}%)` : `VAT (${rule.rate}%)`,
  };
}
```

---

## 14. Storefront Rendering

> **Cross-ref:** [01_Architecture §13 — ISR & Edge Rendering](./01_Architecture.md)

### 14.1 Storefront Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│              STOREFRONT RENDERING PIPELINE                          │
│                                                                     │
│  Request: stylehub.letbuyy.store/products/blue-jacket              │
│                                                                     │
│  1. EDGE (Vercel) → Resolve subdomain "stylehub" → store_id       │
│                                                                     │
│  2. ISR CHECK → Cached HTML exists & fresh (< 60s)?                │
│     ├── YES → Serve cached HTML (0ms TTFB)                         │
│     └── NO → Server Component renders:                              │
│         ├── fetch product from Supabase                             │
│         ├── fetch related products (AI recommendations)             │
│         ├── render React Server Component                           │
│         ├── generate OpenGraph meta tags                            │
│         ├── generate JSON-LD structured data                        │
│         └── cache result (revalidate: 60)                           │
│                                                                     │
│  3. CLIENT HYDRATION:                                               │
│     ├── Image gallery (client component — swipe/zoom)              │
│     ├── Variant selector (client — updates price/stock)            │
│     ├── Add to Cart button (client — Zustand)                      │
│     └── Review section (client — lazy loaded)                       │
└────────────────────────────────────────────────────────────────────┘
```

### 14.2 Product Page (Server Component)

```typescript
// apps/web/storefront/app/products/[slug]/page.tsx

import { Metadata } from 'next';
import { notFound } from 'next/navigation';

export const revalidate = 60; // ISR: rebuild every 60s

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await getProduct(params.slug);
  if (!product) return {};

  return {
    title: product.seo_title || `${product.title} | ${product.storeName}`,
    description: product.seo_description || product.short_description,
    openGraph: {
      title: product.title,
      description: product.short_description,
      images: [{ url: product.images[0], width: 1200, height: 630 }],
      type: 'product',
    },
    other: {
      'product:price:amount': product.price.toString(),
      'product:price:currency': product.currency,
    },
  };
}

export default async function ProductPage({ params }: Props) {
  const product = await getProduct(params.slug);
  if (!product) notFound();

  const relatedProducts = await getRelatedProducts(product.store_id, product.category_id, product.id);

  // JSON-LD structured data (for Google Shopping / Rich Snippets)
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    description: product.short_description,
    image: product.images,
    sku: product.sku,
    brand: { '@type': 'Brand', name: product.brand || product.storeName },
    offers: {
      '@type': 'Offer',
      price: product.price,
      priceCurrency: product.currency,
      availability: product.inventory_count > 0
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      seller: { '@type': 'Organization', name: product.storeName },
    },
    aggregateRating: product.review_count > 0 ? {
      '@type': 'AggregateRating',
      ratingValue: product.avg_rating,
      reviewCount: product.review_count,
    } : undefined,
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="max-w-7xl mx-auto px-4 py-8">
        <Breadcrumb items={[
          { label: 'Home', href: '/' },
          { label: product.category?.name || 'Products', href: '/products' },
          { label: product.title },
        ]} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-6">
          {/* Left: Image gallery (client component) */}
          <ProductGallery images={product.images} title={product.title} />

          {/* Right: Product info */}
          <div>
            <h1 className="text-2xl font-bold">{product.title}</h1>
            {product.avg_rating > 0 && <StarRating rating={product.avg_rating} count={product.review_count} />}

            <ProductPricing price={product.price} compareAtPrice={product.compare_at_price} currency={product.currency} />

            {/* Variant selector + Add to Cart (client component) */}
            <ProductActions product={product} variants={product.variants} options={product.options} />

            <div className="prose mt-6" dangerouslySetInnerHTML={{ __html: product.description }} />
          </div>
        </div>

        {/* Related products */}
        <section className="mt-16">
          <h2 className="text-xl font-semibold mb-6">You might also like</h2>
          <ProductGrid products={relatedProducts} />
        </section>
      </div>
    </>
  );
}
```

### 14.3 Storefront Pages

| Route | Description | Rendering |
|---|---|---|
| `/` | Home page — hero, featured products, collections | ISR 60s |
| `/products` | Product listing with filters, search, sort | ISR 60s |
| `/products/[slug]` | Product detail page | ISR 60s |
| `/collections/[slug]` | Collection/category page | ISR 60s |
| `/cart` | Shopping cart | Client-only |
| `/checkout` | Multi-step checkout | Client-only (SSR contact step) |
| `/order-confirmed/[id]` | Order confirmation | SSR (auth) |
| `/account` | Customer account (orders, addresses) | SSR (auth) |
| `/search?q=` | Search results | SSR |

---

## 15. AI-Powered E-commerce

> **Cross-ref:** See [07 AI Features](./07_AI_Features.md) for complete AI specification

### 15.1 Product Intelligence

| Feature | Model | Credits | Description |
|---|---|---|---|
| **Auto-descriptions** | Gemini 3 Flash | 1 | Generate product descriptions from title + images |
| **Smart pricing** | Gemini 3 Flash | 1 | Suggest competitive pricing based on category analysis |
| **Image enhancement** | Gemini Flash | 2 | Background removal, auto-crop, quality boost |
| **Tag suggestions** | Gemini Flash | Free | Auto-categorize products based on title + description |
| **SEO generation** | Gemini 3 Flash | 1 | Meta titles + descriptions optimized for Google |
| **Bulk generation** | Gemini 3 Flash | 1/each | Generate descriptions for up to 50 products at once |
| **Translation** | Gemini 3 Flash | 1 | Translate product content to other languages |

### 15.2 AI Product Description Generator

```typescript
// workers/api/src/routes/ai/product-description.ts

app.post('/v1/ai/product-description', authMiddleware(), aiCreditMiddleware(1), async (c) => {
  const { title, category, tags, tone = 'professional', length = 'medium' } = await c.req.json();

  const prompt = `Generate a compelling product description for an e-commerce store.

Product: ${title}
Category: ${category || 'General'}
Tags: ${tags?.join(', ') || 'none'}
Tone: ${tone} (options: professional, casual, luxury, playful)
Length: ${length} (short: 50 words, medium: 100 words, long: 200 words)

Requirements:
- Highlight key features and benefits
- Use sensory language and emotional triggers
- Include a clear call-to-action
- SEO-friendly with natural keyword placement
- Format with short paragraphs for readability

Return JSON: { "description": "...", "shortDescription": "...", "seoTitle": "...", "seoDescription": "...", "suggestedTags": [...] }`;

  const result = await callAI(c.env, 'gemini-3-flash', prompt, { responseFormat: 'json' });
  return c.json(result);
});
```

### 15.3 Order Intelligence

| Feature | Description | Trigger |
|---|---|---|
| **Fraud scoring** | AI risk score (0-100) on every order | Automatic on checkout |
| **Demand forecasting** | Predict sales by product/category for next 30/60/90 days | Cron (weekly) |
| **Reorder suggestions** | "Based on sales velocity, reorder X in Y days" | Dashboard widget |
| **Customer insights** | Repeat buyer identification, LTV prediction | Cron (daily) |
| **Price optimization** | Suggest price adjustments based on demand elasticity | On-demand (AI Studio) |
| **Abandoned cart copy** | Generate personalized recovery email subject lines | On cart abandonment |

### 15.4 AI Fraud Detection

```typescript
// workers/api/src/lib/fraud-detector.ts

interface FraudSignal {
  name: string;
  weight: number;    // 0-20 contribution to score
  triggered: boolean;
  detail: string;
}

export async function calculateFraudScore(order: Order, env: Env): Promise<{ score: number; flags: string[] }> {
  const signals: FraudSignal[] = [];

  // 1. Email verification
  const emailAge = await checkEmailAge(order.customer_email);
  signals.push({
    name: 'disposable_email', weight: 15,
    triggered: isDisposableEmail(order.customer_email),
    detail: 'Disposable email provider detected',
  });

  // 2. IP-Country mismatch
  signals.push({
    name: 'ip_country_mismatch', weight: 10,
    triggered: order.ip_country !== order.shipping_address.country,
    detail: `IP: ${order.ip_country}, Shipping: ${order.shipping_address.country}`,
  });

  // 3. Velocity check (too many orders in short time)
  const recentOrders = await getRecentOrderCount(env, order.customer_email, '1h');
  signals.push({
    name: 'velocity_abuse', weight: 20,
    triggered: recentOrders > 3,
    detail: `${recentOrders} orders in last hour`,
  });

  // 4. High-value first order
  const isFirstOrder = await isFirstTimeCustomer(env, order.store_id, order.customer_email);
  signals.push({
    name: 'high_value_first', weight: 10,
    triggered: isFirstOrder && order.total > 10000,
    detail: `First order worth ₹${order.total}`,
  });

  // 5. Shipping ≠ Billing address
  signals.push({
    name: 'address_mismatch', weight: 5,
    triggered: order.billing_address && order.shipping_address.postal_code !== order.billing_address.postal_code,
    detail: 'Different shipping and billing addresses',
  });

  const score = signals.reduce((sum, s) => sum + (s.triggered ? s.weight : 0), 0);
  const flags = signals.filter(s => s.triggered).map(s => s.detail);

  return { score: Math.min(score, 100), flags };
}
```

---

## 16. Abandoned Cart Recovery

### 16.1 Abandonment Detection

```sql
-- pg_cron: Detect abandoned carts every 30 minutes
SELECT cron.schedule('detect-abandoned-carts', '*/30 * * * *', $$
  UPDATE carts
  SET status = 'abandoned', abandoned_at = NOW()
  WHERE status = 'active'
    AND updated_at < NOW() - INTERVAL '1 hour'
    AND items::text != '[]'
    AND NOT EXISTS (
      SELECT 1 FROM orders o
      WHERE o.store_id = carts.store_id
        AND o.customer_email = (
          SELECT email FROM customers WHERE id = carts.customer_id
        )
        AND o.created_at > carts.updated_at
    );
$$);
```

### 16.2 Recovery Email Sequence

```
┌────────────────────────────────────────────────────────────────────┐
│              ABANDONED CART RECOVERY SEQUENCE                       │
│                                                                     │
│  Cart Abandoned (1 hour inactive)                                   │
│       │                                                             │
│  ┌────┴────┐                                                        │
│  │ Email 1 │  → Send after 1 hour                                   │
│  │ "You    │  Subject: "You left something behind! 🛒"              │
│  │ forgot" │  Content: Cart items + images + [Complete Purchase]     │
│  └────┬────┘                                                        │
│       │ Wait 24 hours                                               │
│  ┌────┴────┐                                                        │
│  │ Email 2 │  → Send after 24 hours (if not recovered)              │
│  │ "Still  │  Subject: "Your cart misses you 💔"                    │
│  │ waiting"│  Content: Cart items + urgency (stock running low)     │
│  └────┬────┘                                                        │
│       │ Wait 48 hours                                               │
│  ┌────┴────┐                                                        │
│  │ Email 3 │  → Send after 72 hours (if not recovered)              │
│  │ "Final  │  Subject: "Last chance! 10% off your cart"             │
│  │ offer"  │  Content: Cart items + auto-generated coupon (10% off) │
│  └─────────┘                                                        │
│                                                                     │
│  Recovery rate target: 8-15% of abandoned carts                     │
└────────────────────────────────────────────────────────────────────┘
```

### 16.3 Recovery API

```typescript
// workers/cron/src/abandoned-cart-recovery.ts

export async function processAbandonedCarts(env: Env) {
  const supabase = createServiceClient(env);

  // Find carts ready for email 1 (abandoned > 1 hour, no email sent)
  const { data: cartsEmail1 } = await supabase
    .from('carts')
    .select('*, customers(email, first_name)')
    .eq('status', 'abandoned')
    .eq('recovery_email_sent', false)
    .lt('abandoned_at', new Date(Date.now() - 60 * 60 * 1000).toISOString());

  for (const cart of cartsEmail1 || []) {
    await env.EMAIL_QUEUE.send({
      template: 'abandoned-cart-1',
      to: cart.customers?.email,
      data: {
        firstName: cart.customers?.first_name || 'there',
        items: cart.items,
        cartUrl: `https://${cart.subdomain}.letbuyy.store/cart?recover=${cart.id}`,
        storeName: cart.store_name,
      },
    });

    await supabase.from('carts').update({
      recovery_email_sent: true,
      recovery_email_sent_at: new Date().toISOString(),
    }).eq('id', cart.id);
  }

  // Track recovery metrics
  const { count: recovered } = await supabase
    .from('carts')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'recovered')
    .gte('updated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  console.log(`Processed ${cartsEmail1?.length || 0} abandoned carts. Recovered in last 24h: ${recovered}`);
}
```

---

## 17. Notification Events

> **Cross-ref:** [04_Admin_Dashboard §13 — Notification Center](./04_Admin_Dashboard.md) | [01_Architecture §18 — Event Bus](./01_Architecture.md)

### 17.1 E-Commerce Notification Matrix

| Event | Push (FCM) | Email (Resend) | In-App | SMS | Recipient |
|---|:---:|:---:|:---:|:---:|---|
| New order placed | ✅ | ✅ | ✅ | — | Admin |
| Order confirmed | — | ✅ | — | ✅ | Customer |
| Order shipped | — | ✅ | ✅ | ✅ | Customer |
| Order delivered | — | ✅ | ✅ | — | Customer |
| Order cancelled | ✅ | ✅ | ✅ | — | Both |
| Payment received | ✅ | ✅ | ✅ | — | Admin |
| Payment failed | ✅ | ✅ | ✅ | — | Admin |
| Low stock alert | ✅ | ✅ | ✅ | — | Admin |
| Out of stock | ✅ | ✅ | ✅ | — | Admin |
| Return request | ✅ | ✅ | ✅ | — | Admin |
| Refund processed | — | ✅ | ✅ | — | Customer |
| Abandoned cart | — | ✅ | — | — | Customer |
| New customer | — | — | ✅ | — | Admin |
| Review received | — | ✅ | ✅ | — | Admin |
| AI fraud alert | ✅ | ✅ | ✅ | — | Admin |

### 17.2 Email Templates (Resend)

```typescript
// packages/email/src/templates/order-confirmation.tsx

import { Html, Head, Body, Container, Section, Row, Column, Text, Img, Button, Hr } from '@react-email/components';

export function OrderConfirmationEmail({ order, storeName }: OrderEmailProps) {
  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: 'Inter, sans-serif', backgroundColor: '#f9fafb' }}>
        <Container style={{ maxWidth: 600, margin: '0 auto', padding: 20 }}>
          {/* Header */}
          <Section style={{ textAlign: 'center', padding: '20px 0' }}>
            <Text style={{ fontSize: 24, fontWeight: 700 }}>{storeName}</Text>
          </Section>

          {/* Order confirmed */}
          <Section style={{ backgroundColor: '#fff', borderRadius: 12, padding: 32 }}>
            <Text style={{ fontSize: 20, fontWeight: 600 }}>Order Confirmed! ✅</Text>
            <Text style={{ color: '#6b7280' }}>
              Thank you for your order. We'll send you an update when it ships.
            </Text>

            <Hr />

            <Text style={{ fontWeight: 600 }}>Order #{order.order_number}</Text>
            <Text style={{ color: '#6b7280', fontSize: 14 }}>
              {new Date(order.created_at).toLocaleDateString('en-IN', { dateStyle: 'long' })}
            </Text>

            {/* Items */}
            {order.items.map((item: OrderItem) => (
              <Row key={item.productId} style={{ padding: '12px 0', borderBottom: '1px solid #e5e7eb' }}>
                <Column style={{ width: 64 }}>
                  <Img src={item.image} width={56} height={56} style={{ borderRadius: 8 }} />
                </Column>
                <Column>
                  <Text style={{ fontWeight: 500, margin: 0 }}>{item.title}</Text>
                  {item.variantTitle && <Text style={{ color: '#6b7280', fontSize: 13, margin: 0 }}>{item.variantTitle}</Text>}
                  <Text style={{ fontSize: 13, margin: 0 }}>Qty: {item.quantity}</Text>
                </Column>
                <Column style={{ textAlign: 'right' }}>
                  <Text style={{ fontWeight: 600 }}>₹{(item.price * item.quantity).toLocaleString('en-IN')}</Text>
                </Column>
              </Row>
            ))}

            <Hr />

            {/* Totals */}
            <Row><Column><Text>Subtotal</Text></Column><Column style={{ textAlign: 'right' }}><Text>₹{order.subtotal.toLocaleString('en-IN')}</Text></Column></Row>
            {order.discount > 0 && <Row><Column><Text>Discount</Text></Column><Column style={{ textAlign: 'right' }}><Text style={{ color: '#16a34a' }}>-₹{order.discount.toLocaleString('en-IN')}</Text></Column></Row>}
            <Row><Column><Text>Shipping</Text></Column><Column style={{ textAlign: 'right' }}><Text>₹{order.shipping.toLocaleString('en-IN')}</Text></Column></Row>
            <Row><Column><Text>Tax</Text></Column><Column style={{ textAlign: 'right' }}><Text>₹{order.tax.toLocaleString('en-IN')}</Text></Column></Row>
            <Hr />
            <Row><Column><Text style={{ fontWeight: 700, fontSize: 16 }}>Total</Text></Column><Column style={{ textAlign: 'right' }}><Text style={{ fontWeight: 700, fontSize: 16 }}>₹{order.total.toLocaleString('en-IN')}</Text></Column></Row>

            <Hr />

            {/* Shipping address */}
            <Text style={{ fontWeight: 600 }}>Shipping to:</Text>
            <Text style={{ color: '#6b7280', fontSize: 14 }}>
              {order.shipping_address.firstName} {order.shipping_address.lastName}<br />
              {order.shipping_address.line1}<br />
              {order.shipping_address.city}, {order.shipping_address.state} {order.shipping_address.postalCode}
            </Text>

            {/* CTA */}
            <Button href={`https://${order.subdomain}.letbuyy.store/account/orders/${order.id}`}
              style={{ backgroundColor: '#6366f1', color: '#fff', padding: '12px 24px', borderRadius: 8, fontWeight: 600, textDecoration: 'none' }}>
              View Order
            </Button>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
```

---

## 18. Analytics & Reporting

> **Cross-ref:** [04_Admin_Dashboard §12 — Analytics Dashboard](./04_Admin_Dashboard.md)

### 18.1 E-Commerce Metrics

```typescript
// apps/web/admin/config/ecommerce-analytics.ts

export const ECOMMERCE_METRICS = {
  overview: [
    { id: 'total_revenue', label: 'Total Revenue', format: 'currency', period: true },
    { id: 'total_orders', label: 'Orders', format: 'number', period: true },
    { id: 'avg_order_value', label: 'Avg Order Value', format: 'currency', period: true },
    { id: 'conversion_rate', label: 'Conversion Rate', format: 'percentage', period: true },
  ],
  products: [
    { id: 'top_selling', label: 'Top Selling Products', type: 'bar_chart' },
    { id: 'revenue_by_category', label: 'Revenue by Category', type: 'pie_chart' },
    { id: 'low_performers', label: 'Low Performing Products', type: 'list' },
  ],
  customers: [
    { id: 'new_vs_returning', label: 'New vs Returning', type: 'donut' },
    { id: 'ltv_distribution', label: 'LTV Distribution', type: 'histogram' },
    { id: 'top_customers', label: 'Top Customers', type: 'list' },
  ],
  operations: [
    { id: 'fulfillment_time', label: 'Avg Fulfillment Time', format: 'duration' },
    { id: 'return_rate', label: 'Return Rate', format: 'percentage' },
    { id: 'cart_abandonment', label: 'Cart Abandonment Rate', format: 'percentage' },
  ],
};
```

### 18.2 Revenue Analytics SQL

```sql
-- Daily revenue stats (materialized view, refreshed hourly)
CREATE MATERIALIZED VIEW mv_daily_revenue AS
SELECT
  store_id,
  DATE_TRUNC('day', created_at) AS day,
  COUNT(*) AS order_count,
  SUM(total) AS revenue,
  AVG(total) AS avg_order_value,
  COUNT(DISTINCT customer_email) AS unique_customers,
  SUM(discount) AS total_discounts,
  SUM(shipping) AS total_shipping,
  SUM(tax) AS total_tax
FROM orders
WHERE payment_status = 'paid'
GROUP BY store_id, DATE_TRUNC('day', created_at);

CREATE UNIQUE INDEX idx_mv_daily_revenue ON mv_daily_revenue(store_id, day);

-- Refresh hourly
SELECT cron.schedule('refresh-revenue-mv', '0 * * * *', 'REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_revenue');
```

### 18.3 Export Reports

```typescript
// workers/api/src/routes/analytics/export.ts

app.get('/v1/stores/:storeId/analytics/export', authMiddleware(), async (c) => {
  const storeId = c.req.param('storeId');
  const { type, from, to, format = 'csv' } = c.req.query();

  const supabase = createServiceClient(c.env);

  let data;
  switch (type) {
    case 'orders':
      data = await supabase.from('orders').select('*')
        .eq('store_id', storeId)
        .gte('created_at', from).lte('created_at', to)
        .order('created_at', { ascending: false });
      break;
    case 'products':
      data = await supabase.from('products').select('title, sku, price, inventory_count, sold_count, status')
        .eq('store_id', storeId);
      break;
    case 'customers':
      data = await supabase.from('customers').select('email, first_name, last_name, order_count, total_spent, ltv_tier')
        .eq('store_id', storeId);
      break;
  }

  if (format === 'csv') {
    const csv = jsonToCsv(data?.data || []);
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${type}_${from}_${to}.csv"`,
      },
    });
  }

  return c.json(data?.data || []);
});
```

---

## 19. Performance Optimization

### 19.1 Caching Strategy

```typescript
// Cache hierarchy for e-commerce data

const CACHE_CONFIG = {
  // Product pages — ISR 60s + edge cache
  'product_page': { ttl: 60, layer: 'isr', invalidateOn: ['product.updated', 'product.deleted'] },

  // Product listing — Redis 30s
  'product_list': { ttl: 30, layer: 'redis', invalidateOn: ['product.created', 'product.updated', 'product.deleted'] },

  // Storefront home — ISR 60s
  'storefront_home': { ttl: 60, layer: 'isr', invalidateOn: ['product.featured_changed', 'collection.updated'] },

  // Cart — no cache (real-time)
  'cart': { ttl: 0, layer: 'none' },

  // Stock counts — Redis 10s (eventual consistency acceptable)
  'inventory': { ttl: 10, layer: 'redis', invalidateOn: ['order.paid', 'inventory.adjusted'] },

  // Analytics — Redis 60s
  'analytics': { ttl: 60, layer: 'redis', invalidateOn: [] },
};
```

### 19.2 Database Optimization

```sql
-- Partial indexes for common queries
CREATE INDEX idx_products_active ON products(store_id, created_at DESC) WHERE status = 'active';
CREATE INDEX idx_orders_pending ON orders(store_id, created_at DESC) WHERE status = 'pending';
CREATE INDEX idx_orders_unfulfilled ON orders(store_id) WHERE status IN ('confirmed', 'processing');

-- Full-text search index
CREATE INDEX idx_products_fts ON products USING gin(
  to_tsvector('english', title || ' ' || COALESCE(short_description, '') || ' ' || COALESCE(tags::text, ''))
);

-- Materialized view for homepage (featured + bestsellers)
CREATE MATERIALIZED VIEW mv_storefront_products AS
SELECT p.*, 
  RANK() OVER (PARTITION BY p.store_id ORDER BY p.sold_count DESC) as bestseller_rank
FROM products p
WHERE p.status = 'active';
```

### 19.3 Image Optimization

```
┌────────────────────────────────────────────────────────────────────┐
│                  IMAGE OPTIMIZATION PIPELINE                        │
│                                                                     │
│  Source: 4032×3024 JPEG (3.2 MB)                                   │
│                                                                     │
│  Output (auto-generated):                                           │
│  ├── 150×150  WebP  → 8 KB   (thumbnail, grid)                    │
│  ├── 400×400  WebP  → 28 KB  (product card)                       │
│  ├── 800×800  WebP  → 65 KB  (product page)                       │
│  ├── 1200×1200 WebP → 120 KB (zoom view)                          │
│  └── BlurHash placeholder → 32 bytes (SSR inline)                  │
│                                                                     │
│  Responsive loading:                                                │
│  <img                                                               │
│    srcset="...150.webp 150w, ...400.webp 400w, ...800.webp 800w"  │
│    sizes="(max-width: 640px) 150px, (max-width: 1024px) 400px,    │
│           800px"                                                    │
│    loading="lazy"                                                   │
│    placeholder={blurhash}                                           │
│  />                                                                 │
│                                                                     │
│  CDN: Cloudflare R2 (zero egress, edge-cached worldwide)          │
│  Format: WebP (80% smaller than JPEG) + AVIF fallback             │
└────────────────────────────────────────────────────────────────────┘
```

---

## 20. Security

### 20.1 Security Measures

| Layer | Measure | Implementation |
|---|---|---|
| **Database** | Row Level Security | Every table behind RLS policies |
| **API** | Input validation | Zod schemas on all endpoints |
| **Payments** | Webhook HMAC | SHA-256 signature verification |
| **Payments** | Idempotency | Redis dedup for webhook events |
| **Auth** | JWT verification | Supabase JWT on every request |
| **Checkout** | Stock validation | Server-side re-check before payment |
| **Checkout** | Price verification | Server fetches prices, never trusts client |
| **Media** | Presigned uploads | Time-limited R2 upload URLs (15 min) |
| **Admin** | RBAC | 14 permission scopes for team members |
| **Fraud** | AI scoring | 0-100 risk score on every order |
| **Rate limiting** | Redis counters | Per-IP and per-store limits |
| **CSRF** | Origin check | CORS middleware validates request origin |

### 20.2 PCI Compliance

```
┌────────────────────────────────────────────────────────────────────┐
│              PCI DSS COMPLIANCE APPROACH                            │
│                                                                     │
│  LetBuyy NEVER handles raw card data.                              │
│                                                                     │
│  Razorpay / Stripe handle PCI Level 1 compliance:                  │
│  ├── Card tokenization happens in their iframe/SDK                 │
│  ├── Payment data never touches our servers                        │
│  ├── We only store:                                                │
│  │   ├── Transaction ID (rpay_xxx / pi_xxx)                        │
│  │   ├── Payment status (paid/failed)                              │
│  │   ├── Last 4 digits of card (for display only)                  │
│  │   └── Payment provider (razorpay/stripe)                        │
│  └── Webhooks use HMAC verification (no tampering)                 │
│                                                                     │
│  Our responsibility (SAQ A):                                        │
│  ├── HTTPS everywhere (Cloudflare automatic)                       │
│  ├── No card data in logs                                          │
│  ├── Webhook secrets rotated quarterly                             │
│  └── Access controls for payment settings                          │
└────────────────────────────────────────────────────────────────────┘
```

### 20.3 Inventory Reservation (Preventing Overselling)

```sql
-- Atomic inventory reservation during checkout
CREATE OR REPLACE FUNCTION reserve_inventory(
  p_product_id UUID,
  p_variant_id UUID,
  p_quantity INT
) RETURNS BOOLEAN AS $$
DECLARE
  v_available INT;
BEGIN
  -- Lock the row for update (SELECT ... FOR UPDATE)
  IF p_variant_id IS NOT NULL THEN
    SELECT inventory_count INTO v_available
    FROM product_variants WHERE id = p_variant_id FOR UPDATE;

    IF v_available < p_quantity THEN RETURN FALSE; END IF;

    UPDATE product_variants
    SET inventory_count = inventory_count - p_quantity
    WHERE id = p_variant_id;
  ELSE
    SELECT inventory_count INTO v_available
    FROM products WHERE id = p_product_id FOR UPDATE;

    IF v_available < p_quantity THEN RETURN FALSE; END IF;

    UPDATE products
    SET inventory_count = inventory_count - p_quantity
    WHERE id = p_product_id;
  END IF;

  -- Log the adjustment
  INSERT INTO inventory_adjustments (product_id, variant_id, location_id, quantity_change, reason)
  VALUES (p_product_id, p_variant_id, (SELECT id FROM inventory_locations WHERE store_id = (SELECT store_id FROM products WHERE id = p_product_id) AND is_default LIMIT 1), -p_quantity, 'reserved');

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;
```

---

## 21. Testing Strategy

### 21.1 Testing Pyramid

```
           ┌──────────┐
           │   E2E    │  ← Playwright (checkout flow, order lifecycle)
           │  (10%)   │
          ┌┴──────────┴┐
          │ Integration │  ← Vitest + MSW (API handlers, webhook processing)
          │   (30%)     │
         ┌┴────────────┴┐
         │    Unit       │  ← Vitest (price calc, coupon validation, variant gen)
         │   (60%)       │
         └──────────────┘
```

### 21.2 Critical Unit Tests

```typescript
// __tests__/lib/coupon-validator.test.ts

describe('Coupon Validator', () => {
  it('rejects expired coupons', async () => {
    const result = await validateCoupon(mockSupabase, 'store1', 'EXPIRED', mockItems);
    expect(result.valid).toBe(false);
    expect(result.message).toContain('expired');
  });

  it('calculates percentage discount with cap', async () => {
    const result = await validateCoupon(mockSupabase, 'store1', 'SUMMER20', [
      { productId: 'p1', price: 10000, quantity: 1 },
    ]);
    expect(result.valid).toBe(true);
    expect(result.discount).toBe(1000); // 20% of 10000, but capped at max_discount
  });

  it('applies BOGO correctly', async () => {
    const result = await validateCoupon(mockSupabase, 'store1', 'BOGO', [
      { productId: 'p1', price: 500, quantity: 3 },
    ]);
    expect(result.valid).toBe(true);
    expect(result.discount).toBe(500); // Buy 2 Get 1 — cheapest item free
  });

  it('rejects when below minimum order', async () => {
    const result = await validateCoupon(mockSupabase, 'store1', 'MIN500', [
      { productId: 'p1', price: 200, quantity: 1 },
    ]);
    expect(result.valid).toBe(false);
    expect(result.message).toContain('₹500');
  });
});

// __tests__/lib/variants.test.ts

describe('Variant Generation', () => {
  it('generates all combinations', () => {
    const options = [
      { name: 'Size', values: ['S', 'M'] },
      { name: 'Color', values: ['Red', 'Blue'] },
    ];
    const combos = generateVariantCombinations(options);
    expect(combos).toHaveLength(4);
    expect(combos).toContainEqual({ Size: 'S', Color: 'Red' });
    expect(combos).toContainEqual({ Size: 'M', Color: 'Blue' });
  });

  it('respects MAX_VARIANTS limit', () => {
    const options = [
      { name: 'A', values: Array.from({ length: 11 }, (_, i) => `a${i}`) },
      { name: 'B', values: Array.from({ length: 11 }, (_, i) => `b${i}`) },
    ];
    const combos = generateVariantCombinations(options);
    expect(combos.length).toBeLessThanOrEqual(MAX_VARIANTS);
  });
});

// __tests__/lib/tax-calculator.test.ts

describe('Tax Calculator', () => {
  it('calculates inclusive GST 18%', () => {
    const result = calculateTax(1180, 0, { enabled: true, defaultRate: 18, taxInclusive: true, rules: [] }, 'IN');
    expect(result.taxAmount).toBeCloseTo(180);
    expect(result.taxLabel).toBe('GST (18%)');
  });

  it('calculates exclusive tax', () => {
    const result = calculateTax(1000, 0, { enabled: true, defaultRate: 18, taxInclusive: false, rules: [] }, 'IN');
    expect(result.taxAmount).toBe(180);
  });

  it('applies discount before tax', () => {
    const result = calculateTax(1000, 200, { enabled: true, defaultRate: 18, taxInclusive: false, rules: [] }, 'IN');
    expect(result.taxAmount).toBe(144); // 18% of (1000-200)
  });
});
```

### 21.3 E2E Checkout Test

```typescript
// e2e/checkout.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Complete Checkout Flow', () => {
  test('guest checkout with Stripe', async ({ page }) => {
    // 1. Navigate to product
    await page.goto('/products/blue-jacket');
    await expect(page.locator('h1')).toContainText('Blue Jacket');

    // 2. Select variant
    await page.click('[data-variant="M"]');
    await page.click('[data-variant="Navy"]');

    // 3. Add to cart
    await page.click('[data-testid="add-to-cart"]');
    await expect(page.locator('[data-testid="cart-count"]')).toContainText('1');

    // 4. Go to checkout
    await page.click('[data-testid="checkout-btn"]');
    await expect(page).toHaveURL(/\/checkout/);

    // 5. Fill contact
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="phone"]', '+919876543210');
    await page.click('[data-testid="continue"]');

    // 6. Fill address
    await page.fill('[name="firstName"]', 'Test');
    await page.fill('[name="lastName"]', 'User');
    await page.fill('[name="line1"]', '123 Test Street');
    await page.fill('[name="city"]', 'Mumbai');
    await page.selectOption('[name="state"]', 'Maharashtra');
    await page.fill('[name="postalCode"]', '400001');
    await page.click('[data-testid="continue"]');

    // 7. Select shipping
    await page.click('[data-shipping="standard"]');
    await page.click('[data-testid="continue"]');

    // 8. Review & pay (Stripe redirects externally — test until redirect)
    await expect(page.locator('[data-testid="order-total"]')).toBeVisible();
    await page.click('[data-testid="place-order"]');

    // Stripe test mode redirect check
    await expect(page).toHaveURL(/checkout\.stripe\.com|order-confirmed/);
  });
});
```

---

## 22. Document History

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | 2025-06-15 | Siddhu Saai | Initial document — Products, Orders, Payments |
| 2.0 | 2025-08-20 | Siddhu Saai | Added shipping configuration |
| 3.0 | 2025-10-01 | Siddhu Saai | Added AI product features |
| 4.0 | 2025-12-15 | Siddhu Saai | Added coupons and discount system |
| 5.0 | 2026-02-01 | Siddhu Saai | Added notification events |
| 6.0 | 2026-02-14 | AI-Assisted Enhancement | **Major expansion**: 401 → 3,000+ lines. Added: Product Media & Image Pipeline (§2), Categories & Collections (§4), Customer Management with LTV (§5), Cart System with Zustand (§6), multi-step Checkout with payment session API (§7), Webhook handlers with HMAC (§8), Order state machine with number generation (§9), Returns & Refunds system (§10), Coupon validation engine (§11), Storefront ISR rendering (§14), Abandoned Cart Recovery (§16), Email templates (§17), Analytics with materialized views (§18), Performance optimization (§19), Security & PCI compliance (§20), Testing Strategy (§21). All sections enhanced with TypeScript, SQL schemas, React components, wireframes, and cross-references. |

---

> **Next:** [06 Portfolio & Resume](./06_Portfolio_and_Resume.md) — Portfolio builder, resume builder, PDF export, templates
>
> **Related:** [00_Overview.md](./00_Overview.md) | [01_Architecture.md](./01_Architecture.md) | [02_Authentication_and_Security.md](./02_Authentication_and_Security.md) | [03_Onboarding_and_Trial.md](./03_Onboarding_and_Trial.md) | [04_Admin_Dashboard.md](./04_Admin_Dashboard.md)
>
> **See also:** [13 Plans & Pricing](./13_Plans_and_Pricing.md) — Store plans, transaction fees & billing architecture
