-- ================================================================
-- Fix Product-Related RLS Policies
-- Migration: 019_fix_product_rls.sql
-- Created: 2026-02-16
-- Description: Replaces overly permissive "FOR ALL TO authenticated
--   USING (true)" policies on product_options, product_variants,
--   collections, collection_products, gift_cards with proper
--   store-owner-scoped policies.
-- ================================================================

-- ——— 1. Drop overly permissive policies ———
DROP POLICY IF EXISTS "Allow authenticated access to product_options" ON product_options;
DROP POLICY IF EXISTS "Allow authenticated access to product_variants" ON product_variants;
DROP POLICY IF EXISTS "Allow authenticated access to collections" ON collections;
DROP POLICY IF EXISTS "Allow authenticated access to collection_products" ON collection_products;
DROP POLICY IF EXISTS "Allow authenticated access to gift_cards" ON gift_cards;

-- ——— 2. product_options: owner via product → site ———
CREATE POLICY "Store owners manage product options"
  ON product_options FOR ALL
  USING (
    product_id IN (
      SELECT p.id FROM products p
      JOIN sites s ON p.site_id = s.id
      WHERE s.user_id = (SELECT id FROM users_custom WHERE auth_id = auth.uid())
    )
  )
  WITH CHECK (
    product_id IN (
      SELECT p.id FROM products p
      JOIN sites s ON p.site_id = s.id
      WHERE s.user_id = (SELECT id FROM users_custom WHERE auth_id = auth.uid())
    )
  );

CREATE POLICY "Public can view product options"
  ON product_options FOR SELECT
  USING (
    product_id IN (
      SELECT p.id FROM products p
      JOIN sites s ON p.site_id = s.id
      WHERE p.is_active = true AND s.status = 'published'
    )
  );

-- ——— 3. product_variants: owner via product → site ———
CREATE POLICY "Store owners manage product variants"
  ON product_variants FOR ALL
  USING (
    product_id IN (
      SELECT p.id FROM products p
      JOIN sites s ON p.site_id = s.id
      WHERE s.user_id = (SELECT id FROM users_custom WHERE auth_id = auth.uid())
    )
  )
  WITH CHECK (
    product_id IN (
      SELECT p.id FROM products p
      JOIN sites s ON p.site_id = s.id
      WHERE s.user_id = (SELECT id FROM users_custom WHERE auth_id = auth.uid())
    )
  );

CREATE POLICY "Public can view product variants"
  ON product_variants FOR SELECT
  USING (
    product_id IN (
      SELECT p.id FROM products p
      JOIN sites s ON p.site_id = s.id
      WHERE p.is_active = true AND s.status = 'published'
    )
  );

-- ——— 4. collections: owner via store_id ———
CREATE POLICY "Store owners manage collections"
  ON collections FOR ALL
  USING (
    store_id IN (
      SELECT id FROM sites
      WHERE user_id = (SELECT id FROM users_custom WHERE auth_id = auth.uid())
    )
  )
  WITH CHECK (
    store_id IN (
      SELECT id FROM sites
      WHERE user_id = (SELECT id FROM users_custom WHERE auth_id = auth.uid())
    )
  );

CREATE POLICY "Public can view active collections"
  ON collections FOR SELECT
  USING (
    is_active = true AND
    store_id IN (SELECT id FROM sites WHERE status = 'published')
  );

-- ——— 5. collection_products: owner via collection → store ———
CREATE POLICY "Store owners manage collection products"
  ON collection_products FOR ALL
  USING (
    collection_id IN (
      SELECT c.id FROM collections c
      JOIN sites s ON c.store_id = s.id
      WHERE s.user_id = (SELECT id FROM users_custom WHERE auth_id = auth.uid())
    )
  )
  WITH CHECK (
    collection_id IN (
      SELECT c.id FROM collections c
      JOIN sites s ON c.store_id = s.id
      WHERE s.user_id = (SELECT id FROM users_custom WHERE auth_id = auth.uid())
    )
  );

CREATE POLICY "Public can view collection products"
  ON collection_products FOR SELECT
  USING (
    collection_id IN (
      SELECT c.id FROM collections c
      JOIN sites s ON c.store_id = s.id
      WHERE c.is_active = true AND s.status = 'published'
    )
  );

-- ——— 6. gift_cards: owner via store_id ———
CREATE POLICY "Store owners manage gift cards"
  ON gift_cards FOR ALL
  USING (
    store_id IN (
      SELECT id FROM sites
      WHERE user_id = (SELECT id FROM users_custom WHERE auth_id = auth.uid())
    )
  )
  WITH CHECK (
    store_id IN (
      SELECT id FROM sites
      WHERE user_id = (SELECT id FROM users_custom WHERE auth_id = auth.uid())
    )
  );
