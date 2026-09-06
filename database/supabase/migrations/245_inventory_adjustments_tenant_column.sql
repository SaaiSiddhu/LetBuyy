-- Migration 245: give inventory_adjustments a real tenant column and a database backstop.
--
-- WHAT IS WRONG (measured, not inferred)
-- `inventory_adjustments` has no `site_id`/`store_id` column. Consequences, all verified against a
-- database with 000..244 applied:
--   * RLS is ENABLED but NOT FORCED, so the table owner bypasses it entirely;
--   * the only policy reaching the production path is `service_all_inventory_adjustments`,
--     `USING (true) WITH CHECK (true)` for `service_role` — the client the gateway actually uses;
--   * there is NO `app.site_id` GUC policy, unlike every sibling inventory table, because
--     migration 164's sweep only covers tables that HAVE a `site_id`/`store_id` column and this one
--     had neither;
--   * the table is absent from `tenant-tables.registry.ts`, so no guard can register it.
-- The entire isolation boundary is one `.in('products.store_id', ownedStoreIds)` predicate in
-- `services/api-gateway/src/routes/inventory.ts`'s `/history` handler. The Constitution names that
-- shape explicitly: an application guard is an additional layer, never the sole boundary.
--
-- WHY A TRIGGER AND NOT FOUR EDITED WRITERS
-- Four SQL functions INSERT into this table — `adjust_inventory_level`, `set_inventory_level_available`,
-- `create_order_with_inventory_reservations` and `release_order_inventory`. The sibling table
-- `inventory_levels` solves exactly this with a BEFORE INSERT trigger
-- (`inventory_levels_store_id_fill` → `set_inventory_level_store_id`), which is why none of its
-- writers name `store_id` either. Copying that pattern leaves all four writers untouched, so this
-- migration cannot change what any of them records.
--
-- WHY THE POLICY SHAPE IS COPIED, NOT COMPOSED
-- The `app_tenant` policy below reuses migration 164's own naming rule and predicate
-- (`'app_tenant_guc_' || substr(md5(table_name), 1, 16)`, `store_id = public.current_site_id()`), so
-- re-running 164's sweep after this migration is a no-op for this table rather than a second,
-- differently-named policy. The `service_role` blanket policy is deliberately left alone: every
-- sibling carries one, and diverging here would make the tenant validators harder to satisfy without
-- making the table safer — `service_role` is BYPASSRLS regardless, which is why the GUC policies and
-- FORCE are what actually matter.

BEGIN;

ALTER TABLE public.inventory_adjustments
  ADD COLUMN IF NOT EXISTS store_id uuid;

-- Backfill from the product. `product_id` is NOT NULL with an FK to `products`, so every row has a
-- product; `products.store_id` is nullable, so a product with no store leaves its adjustments
-- unattributable.
UPDATE public.inventory_adjustments AS adjustment
   SET store_id = product.store_id
  FROM public.products AS product
 WHERE product.id = adjustment.product_id
   AND adjustment.store_id IS NULL;

-- Refuse rather than leave an unattributable tenant row behind a NOT NULL that then cannot be added.
-- A row whose tenant cannot be determined is precisely what must not be silently kept: under the new
-- policies it would be invisible to every tenant and deletable by none.
DO $backfill$
DECLARE
    v_orphans bigint;
BEGIN
    SELECT count(*) INTO v_orphans
    FROM public.inventory_adjustments
    WHERE store_id IS NULL;

    IF v_orphans > 0 THEN
        RAISE EXCEPTION
            'migration 245: % inventory_adjustments rows cannot be attributed to a store (their product has a NULL products.store_id). Resolve those products before applying this migration.',
            v_orphans;
    END IF;
END
$backfill$;

ALTER TABLE public.inventory_adjustments
  ALTER COLUMN store_id SET NOT NULL;

ALTER TABLE public.inventory_adjustments
  DROP CONSTRAINT IF EXISTS inventory_adjustments_store_id_fkey;
ALTER TABLE public.inventory_adjustments
  ADD CONSTRAINT inventory_adjustments_store_id_fkey
  FOREIGN KEY (store_id) REFERENCES public.sites(id);

CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_store_id
  ON public.inventory_adjustments (store_id, created_at DESC);

-- The fill trigger. Deliberately stricter than the sibling it copies: `set_inventory_level_store_id`
-- carries no `SET search_path`, which is a latent version of the defect migration 244 just closed.
CREATE OR REPLACE FUNCTION public.set_inventory_adjustment_store_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.store_id IS NULL THEN
    SELECT store_id INTO NEW.store_id
      FROM public.products
     WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS inventory_adjustments_store_id_fill ON public.inventory_adjustments;
CREATE TRIGGER inventory_adjustments_store_id_fill
  BEFORE INSERT OR UPDATE OF product_id, store_id
  ON public.inventory_adjustments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_inventory_adjustment_store_id();

ALTER TABLE public.inventory_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_adjustments FORCE ROW LEVEL SECURITY;

-- Migration 141's shape, for the sibling inventory tables.
DROP POLICY IF EXISTS inventory_adjustments_tenant_site_guc ON public.inventory_adjustments;
CREATE POLICY inventory_adjustments_tenant_site_guc
  ON public.inventory_adjustments
  FOR ALL
  USING (store_id = public.current_site_id())
  WITH CHECK (store_id = public.current_site_id());

-- Migration 164's shape, including its naming rule, so re-running 164's sweep is a no-op here.
DO $app_tenant$
DECLARE
    v_policy_name text := 'app_tenant_guc_' || substr(md5('inventory_adjustments'), 1, 16);
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_tenant') THEN
        EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.inventory_adjustments TO app_tenant';
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.inventory_adjustments', v_policy_name);
        EXECUTE format(
            'CREATE POLICY %I ON public.inventory_adjustments FOR ALL TO app_tenant USING (%s) WITH CHECK (%s)',
            v_policy_name,
            'store_id = public.current_site_id()',
            'store_id = public.current_site_id()'
        );
    END IF;
END
$app_tenant$;

-- The Supabase-auth policy now reads the column directly instead of joining through `products`.
-- Same set of rows, one fewer place for the boundary to be edited away.
DROP POLICY IF EXISTS store_owners_view_adjustments ON public.inventory_adjustments;
CREATE POLICY store_owners_view_adjustments
  ON public.inventory_adjustments
  FOR SELECT
  TO authenticated
  USING (store_id IN (SELECT sites.id FROM public.sites WHERE sites.user_id = auth.uid()));

-- Self-verification. A migration that reports success while leaving RLS unforced or a policy
-- missing is how this table reached 245 unprotected in the first place.
DO $verify$
DECLARE
    v_policy_name text := 'app_tenant_guc_' || substr(md5('inventory_adjustments'), 1, 16);
    v_missing text;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_class
        WHERE oid = 'public.inventory_adjustments'::regclass
          AND relrowsecurity AND relforcerowsecurity
    ) THEN
        RAISE EXCEPTION 'migration 245: inventory_adjustments must have RLS enabled AND forced';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_attribute
        WHERE attrelid = 'public.inventory_adjustments'::regclass
          AND attname = 'store_id' AND attnotnull AND NOT attisdropped
    ) THEN
        RAISE EXCEPTION 'migration 245: inventory_adjustments.store_id must exist and be NOT NULL';
    END IF;

    SELECT string_agg(expected, ', ') INTO v_missing
    FROM (VALUES ('inventory_adjustments_tenant_site_guc'), ('store_owners_view_adjustments')) AS t(expected)
    WHERE NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'inventory_adjustments' AND policyname = t.expected
    );

    IF v_missing IS NOT NULL THEN
        RAISE EXCEPTION 'migration 245: missing policies: %', v_missing;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_tenant')
       AND NOT EXISTS (
           SELECT 1 FROM pg_policies
           WHERE schemaname = 'public' AND tablename = 'inventory_adjustments' AND policyname = v_policy_name
       ) THEN
        RAISE EXCEPTION 'migration 245: the app_tenant GUC policy % was not created', v_policy_name;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgrelid = 'public.inventory_adjustments'::regclass
          AND tgname = 'inventory_adjustments_store_id_fill' AND NOT tgisinternal
    ) THEN
        RAISE EXCEPTION 'migration 245: the store_id fill trigger was not created';
    END IF;
END
$verify$;

COMMIT;
