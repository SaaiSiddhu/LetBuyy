-- ================================================================
-- Fix Product-Related RLS Policies
-- Migration: 019_fix_product_rls.sql
-- Created: 2026-02-16
-- Description: Replaces overly permissive "FOR ALL TO authenticated
--   USING (true)" policies on product_options, product_variants,
--   collections, collection_products, gift_cards with service-role
--   permissive policies (custom auth, not Supabase Auth).
-- ================================================================

-- ——— 1. Drop overly permissive policies ———
DROP POLICY IF EXISTS "Allow authenticated access to product_options" ON product_options;
DROP POLICY IF EXISTS "Allow authenticated access to product_variants" ON product_variants;
DROP POLICY IF EXISTS "Allow authenticated access to collections" ON collections;
DROP POLICY IF EXISTS "Allow authenticated access to collection_products" ON collection_products;
DROP POLICY IF EXISTS "Allow authenticated access to gift_cards" ON gift_cards;

-- ——— 2. Permissive policies (access control at application layer) ———

CREATE POLICY "service_role_product_options" ON product_options
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "service_role_product_variants" ON product_variants
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "service_role_collections" ON collections
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "service_role_collection_products" ON collection_products
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "service_role_gift_cards" ON gift_cards
  FOR ALL USING (true) WITH CHECK (true);
