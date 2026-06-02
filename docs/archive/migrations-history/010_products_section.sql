-- ================================================================
-- Products Section Database Migration
-- Run in Supabase SQL Editor (Dashboard > SQL Editor > New query)
-- ================================================================

-- ——— 1. Extend the products table with new columns ———
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS product_type     text,
  ADD COLUMN IF NOT EXISTS vendor           text,
  ADD COLUMN IF NOT EXISTS url_handle       text,
  ADD COLUMN IF NOT EXISTS seo_title        text,
  ADD COLUMN IF NOT EXISTS seo_description  text,
  ADD COLUMN IF NOT EXISTS cost_per_item    numeric(10,2),
  ADD COLUMN IF NOT EXISTS charge_tax       boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS track_inventory  boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS sku              text,
  ADD COLUMN IF NOT EXISTS barcode          text,
  ADD COLUMN IF NOT EXISTS sell_when_oos    boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_physical      boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS weight           numeric(10,3),
  ADD COLUMN IF NOT EXISTS weight_unit      text DEFAULT 'kg',
  ADD COLUMN IF NOT EXISTS country_of_origin text,
  ADD COLUMN IF NOT EXISTS hs_code          text;

-- ——— 2. Product options (Size, Color, etc.) ———
CREATE TABLE IF NOT EXISTS product_options (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name        text NOT NULL,
  position    integer DEFAULT 0,
  values      jsonb NOT NULL DEFAULT '[]',
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_options_product_id
  ON product_options(product_id);

-- ——— 3. Product variants ———
CREATE TABLE IF NOT EXISTS product_variants (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  title           text NOT NULL,
  price           numeric(10,2) NOT NULL DEFAULT 0,
  compare_price   numeric(10,2),
  sku             text,
  barcode         text,
  inventory_qty   integer DEFAULT 0,
  weight          numeric(10,3),
  weight_unit     text DEFAULT 'kg',
  option1         text,
  option2         text,
  option3         text,
  image_url       text,
  position        integer DEFAULT 0,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_variants_product_id
  ON product_variants(product_id);

-- ——— 4. Collections ———
CREATE TABLE IF NOT EXISTS collections (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id    uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  title       text NOT NULL,
  description text,
  image_url   text,
  is_active   boolean DEFAULT true,
  sort_order  text DEFAULT 'manual',
  conditions  jsonb DEFAULT '[]',
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_collections_store_id
  ON collections(store_id);

-- ——— 5. Collection ↔ Products junction table ———
CREATE TABLE IF NOT EXISTS collection_products (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id   uuid NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  product_id      uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  position        integer DEFAULT 0,
  UNIQUE(collection_id, product_id)
);

-- ——— 6. Gift Cards ———
CREATE TABLE IF NOT EXISTS gift_cards (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id        uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  code            text NOT NULL UNIQUE,
  initial_value   numeric(10,2) NOT NULL,
  balance         numeric(10,2) NOT NULL,
  status          text DEFAULT 'active',
  customer_id     uuid,
  expires_at      timestamptz,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gift_cards_store_id
  ON gift_cards(store_id);

CREATE INDEX IF NOT EXISTS idx_gift_cards_code
  ON gift_cards(code);

-- ——— 7. Enable RLS on new tables ———
ALTER TABLE product_options    ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants   ENABLE ROW LEVEL SECURITY;
ALTER TABLE collections        ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE gift_cards         ENABLE ROW LEVEL SECURITY;

-- ——— 8. RLS policies: authenticated users can do everything (admin context) ———
-- product_options
CREATE POLICY "Allow authenticated access to product_options"
  ON product_options FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- product_variants
CREATE POLICY "Allow authenticated access to product_variants"
  ON product_variants FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- collections
CREATE POLICY "Allow authenticated access to collections"
  ON collections FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- collection_products
CREATE POLICY "Allow authenticated access to collection_products"
  ON collection_products FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- gift_cards
CREATE POLICY "Allow authenticated access to gift_cards"
  ON gift_cards FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
