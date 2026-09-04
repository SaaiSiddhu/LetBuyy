-- MKT-0: marketplace channel foundation under D-0 = A (decisions.md §2, owner-approved 2026-09-04).
-- Design: docs/architecture/MARKETPLACE_CHANNEL_MODEL.md. This migration creates the model only;
-- no route, app screen, moderation queue or checkout path uses it yet (see that document's §9).
--
-- What it adds:
--   marketplace_categories              platform-owned discovery taxonomy (no site_id; read where is_active)
--   channel_listings                    one row per (product, channel); site-scoped; RLS ENABLE + FORCE
--   channel_listing_moderation_events   append-only audit of every status change; RLS ENABLE + FORCE;
--                                       UPDATE/DELETE revoked from every role (165_d5:463 pattern)
--   transition_channel_listing()        the only way a listing's status changes: idempotency key +
--                                       pg_advisory_xact_lock BEFORE the existence check (206:114 pattern),
--                                       realm-fenced (merchant edges need the tenant GUC = p_site_id;
--                                       operator edges are refused when the effective role is app_tenant),
--                                       row update + event insert in one transaction
--   marketplace_feed()                  THE one designed cross-tenant read: approved marketplace listings on
--                                       published sites, explicit column allowlist whose product columns are a
--                                       subset of PRODUCT_SELECT_FULL (services/api-gateway/src/routes/storefront.ts:353),
--                                       filters mirroring the storefront (is_active, deleted_at IS NULL,
--                                       sites.status = 'published'), keyset pagination, Postgres-only search
--
-- Tenancy: products' policies (163_d2) are untouched. Both new tenant tables enter
-- services/api-gateway/src/tenant/tenant-tables.registry.ts via the generator (site_id column).
-- Money: nothing here touches the ledger; commission stays 0 bps (D-1).
-- Roles: anon / authenticated / service_role / app_tenant are Supabase-provided (app_tenant by 164_d4);
--        grants are guarded on pg_roles so the migration also applies to a bare test container.
-- Rollback: database/supabase/rollback/217_marketplace_channel_listings.rollback.sql (no data precondition).

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. marketplace_categories — platform taxonomy (NOT a tenant table)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketplace_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  name text NOT NULL,
  parent_id uuid NULL REFERENCES public.marketplace_categories(id) ON DELETE RESTRICT,
  position integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT marketplace_categories_slug_key UNIQUE (slug),
  CONSTRAINT marketplace_categories_slug_format_check CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  CONSTRAINT marketplace_categories_not_own_parent_check CHECK (parent_id IS NULL OR parent_id <> id)
);

CREATE INDEX IF NOT EXISTS marketplace_categories_parent_position_idx
  ON public.marketplace_categories (parent_id, position);

ALTER TABLE public.marketplace_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_categories FORCE ROW LEVEL SECURITY;

-- Public read of live taxonomy only. Never USING (true) (Constitution ART-09 / R-3; 196:56 shape).
DROP POLICY IF EXISTS marketplace_categories_public_read ON public.marketplace_categories;
CREATE POLICY marketplace_categories_public_read ON public.marketplace_categories
  FOR SELECT TO anon, authenticated, app_tenant
  USING (is_active = true);

-- Taxonomy writes are an operator concern (ADM-1); parity with the codebase's service_role policies.
DROP POLICY IF EXISTS service_role_marketplace_categories ON public.marketplace_categories;
CREATE POLICY service_role_marketplace_categories ON public.marketplace_categories
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- app_tenant received SELECT/INSERT/UPDATE/DELETE via 164's ALTER DEFAULT PRIVILEGES; the policy
-- above only permits SELECT, but the table-level grant is narrowed too so the intent is explicit.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_tenant') THEN
    REVOKE INSERT, UPDATE, DELETE ON public.marketplace_categories FROM app_tenant;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    GRANT SELECT ON public.marketplace_categories TO anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT SELECT ON public.marketplace_categories TO authenticated;
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regprocedure('public.update_updated_at()') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_marketplace_categories_updated_at ON public.marketplace_categories;
    CREATE TRIGGER trg_marketplace_categories_updated_at
      BEFORE UPDATE ON public.marketplace_categories
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- 2. channel_listings — tenant table, one row per (product, channel)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.channel_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  channel text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  visibility text NOT NULL DEFAULT 'public',
  marketplace_category_id uuid NULL REFERENCES public.marketplace_categories(id) ON DELETE RESTRICT,
  pricing_policy jsonb NOT NULL DEFAULT '{}'::jsonb,
  compliance_flags jsonb NOT NULL DEFAULT '{}'::jsonb,
  submitted_at timestamp with time zone NULL,
  approved_at timestamp with time zone NULL,
  reviewed_at timestamp with time zone NULL,
  reviewed_by uuid NULL,
  rejection_reason text NULL,
  version integer NOT NULL DEFAULT 1,
  created_by uuid NULL,
  updated_by uuid NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT channel_listings_product_channel_key UNIQUE (product_id, channel),
  CONSTRAINT channel_listings_channel_check CHECK (channel IN ('storefront', 'marketplace', 'instant')),
  CONSTRAINT channel_listings_status_check CHECK (status IN ('draft', 'pending_review', 'approved', 'rejected', 'paused', 'delisted')),
  CONSTRAINT channel_listings_visibility_check CHECK (visibility IN ('public', 'hidden'))
);

CREATE INDEX IF NOT EXISTS channel_listings_site_channel_status_idx
  ON public.channel_listings (site_id, channel, status);
CREATE INDEX IF NOT EXISTS channel_listings_feed_keyset_idx
  ON public.channel_listings (channel, status, approved_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS channel_listings_marketplace_category_idx
  ON public.channel_listings (marketplace_category_id);

-- A listing can never point at another tenant's product, even through a forged id. Runs with the
-- invoker's privileges on purpose: under RLS as app_tenant a foreign product simply is not visible,
-- which also raises. products carries both site_id and store_id (163:35 COALESCE), mirrored here.
CREATE OR REPLACE FUNCTION public.channel_listings_site_matches_product()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_product_site uuid;
BEGIN
  SELECT COALESCE(p.site_id, p.store_id)
    INTO v_product_site
    FROM public.products p
   WHERE p.id = NEW.product_id;

  IF v_product_site IS NULL OR v_product_site <> NEW.site_id THEN
    RAISE EXCEPTION 'channel_listings.site_id must match the product''s site';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_channel_listings_site_matches_product ON public.channel_listings;
CREATE TRIGGER trg_channel_listings_site_matches_product
  BEFORE INSERT OR UPDATE OF product_id, site_id ON public.channel_listings
  FOR EACH ROW EXECUTE FUNCTION public.channel_listings_site_matches_product();

-- Status moves only through transition_channel_listing(), which sets the transaction-local marker.
-- A direct UPDATE … SET status therefore fails, so no change can skip the moderation event log.
CREATE OR REPLACE FUNCTION public.channel_listings_status_via_rpc()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND COALESCE(current_setting('app.channel_listing_transition', true), '') <> 'rpc' THEN
    RAISE EXCEPTION 'channel_listings.status changes only through transition_channel_listing()';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_channel_listings_status_via_rpc ON public.channel_listings;
CREATE TRIGGER trg_channel_listings_status_via_rpc
  BEFORE UPDATE OF status ON public.channel_listings
  FOR EACH ROW EXECUTE FUNCTION public.channel_listings_status_via_rpc();

DO $$
BEGIN
  IF to_regprocedure('public.update_updated_at()') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_channel_listings_updated_at ON public.channel_listings;
    CREATE TRIGGER trg_channel_listings_updated_at
      BEFORE UPDATE ON public.channel_listings
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
  END IF;
END
$$;

ALTER TABLE public.channel_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_listings FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS channel_listings_tenant_guc ON public.channel_listings;
CREATE POLICY channel_listings_tenant_guc ON public.channel_listings
  FOR ALL TO app_tenant, authenticated
  USING (site_id = public.current_site_id())
  WITH CHECK (site_id = public.current_site_id());

DROP POLICY IF EXISTS service_role_channel_listings ON public.channel_listings;
CREATE POLICY service_role_channel_listings ON public.channel_listings
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 3. channel_listing_moderation_events — append-only, tenant table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.channel_listing_moderation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES public.channel_listings(id) ON DELETE CASCADE,
  from_status text NOT NULL,
  to_status text NOT NULL,
  actor_realm text NOT NULL,
  actor_id uuid NULL,
  reason text NULL,
  idempotency_key text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT channel_listing_moderation_events_site_key_key UNIQUE (site_id, idempotency_key),
  CONSTRAINT channel_listing_moderation_events_actor_realm_check CHECK (actor_realm IN ('merchant', 'operator')),
  CONSTRAINT channel_listing_moderation_events_key_check CHECK (length(idempotency_key) BETWEEN 1 AND 200)
);

CREATE INDEX IF NOT EXISTS channel_listing_moderation_events_listing_idx
  ON public.channel_listing_moderation_events (listing_id, created_at DESC);

ALTER TABLE public.channel_listing_moderation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_listing_moderation_events FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS channel_listing_moderation_events_tenant_read ON public.channel_listing_moderation_events;
CREATE POLICY channel_listing_moderation_events_tenant_read ON public.channel_listing_moderation_events
  FOR SELECT TO app_tenant, authenticated
  USING (site_id = public.current_site_id());

DROP POLICY IF EXISTS channel_listing_moderation_events_tenant_insert ON public.channel_listing_moderation_events;
CREATE POLICY channel_listing_moderation_events_tenant_insert ON public.channel_listing_moderation_events
  FOR INSERT TO app_tenant, authenticated
  WITH CHECK (site_id = public.current_site_id());

DROP POLICY IF EXISTS service_role_channel_listing_moderation_events ON public.channel_listing_moderation_events;
CREATE POLICY service_role_channel_listing_moderation_events ON public.channel_listing_moderation_events
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Append-only: no policy grants UPDATE/DELETE, and the table-level privilege is revoked from every
-- role too, because 164's ALTER DEFAULT PRIVILEGES would otherwise hand app_tenant full DML.
DO $$
DECLARE
  v_role text;
BEGIN
  REVOKE UPDATE, DELETE ON public.channel_listing_moderation_events FROM PUBLIC;
  FOREACH v_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role', 'app_tenant'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = v_role) THEN
      EXECUTE format('REVOKE UPDATE, DELETE ON public.channel_listing_moderation_events FROM %I', v_role);
    END IF;
  END LOOP;
END
$$;

-- ---------------------------------------------------------------------------
-- 4. transition_channel_listing — the only status writer
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.transition_channel_listing(
  p_site_id uuid,
  p_listing_id uuid,
  p_to_status text,
  p_actor_realm text,
  p_actor_id uuid,
  p_reason text,
  p_idempotency_key text
)
RETURNS TABLE (
  listing_id uuid,
  from_status text,
  to_status text,
  event_id uuid,
  replayed boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_existing public.channel_listing_moderation_events%ROWTYPE;
  v_listing public.channel_listings%ROWTYPE;
  v_product_ok boolean;
  v_now timestamp with time zone := now();
  v_event_id uuid;
  v_allowed boolean := false;
BEGIN
  IF p_site_id IS NULL THEN
    RAISE EXCEPTION 'site_id is required';
  END IF;
  IF p_listing_id IS NULL THEN
    RAISE EXCEPTION 'listing_id is required';
  END IF;
  IF p_idempotency_key IS NULL OR length(p_idempotency_key) = 0 OR length(p_idempotency_key) > 200 THEN
    RAISE EXCEPTION 'idempotency_key is required';
  END IF;
  IF p_actor_realm IS NULL OR p_actor_realm NOT IN ('merchant', 'operator') THEN
    RAISE EXCEPTION 'unsupported actor_realm: %', p_actor_realm;
  END IF;
  IF p_to_status IS NULL OR p_to_status NOT IN ('draft', 'pending_review', 'approved', 'rejected', 'paused', 'delisted') THEN
    RAISE EXCEPTION 'unsupported status: %', p_to_status;
  END IF;

  -- Lock BEFORE the existence check (206:114): two concurrent replays of one key serialize here.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_site_id::text || ':' || p_idempotency_key, 0));

  SELECT * INTO v_existing
    FROM public.channel_listing_moderation_events e
   WHERE e.site_id = p_site_id AND e.idempotency_key = p_idempotency_key;
  IF FOUND THEN
    RETURN QUERY SELECT v_existing.listing_id, v_existing.from_status, v_existing.to_status, v_existing.id, true;
    RETURN;
  END IF;

  -- Realm fence. Merchant edges must run inside the tenant transaction for this very site (GUC set by
  -- withTenantTx from a validated claim; an unset GUC fails closed). Operator edges are refused when the
  -- caller's role is app_tenant — the only role a merchant request can run as — and when a tenant GUC
  -- is set, because an operator never acts inside a tenant transaction. service_role is a member of
  -- app_tenant (164:21), so membership is NOT the test. Inside a SECURITY DEFINER function current_user
  -- is the DEFINER, not the caller (measured on postgres:16: current_user=postgres, role=app_tenant after
  -- SET LOCAL ROLE app_tenant), so the caller's SET ROLE is read through the `role` setting.
  IF p_actor_realm = 'merchant' THEN
    IF public.current_site_id() IS NULL OR public.current_site_id() <> p_site_id THEN
      RAISE EXCEPTION 'tenant context required for merchant transitions';
    END IF;
  ELSE
    IF current_setting('role', true) = 'app_tenant' OR public.current_site_id() IS NOT NULL THEN
      RAISE EXCEPTION 'operator transitions are not permitted from a tenant context';
    END IF;
  END IF;

  SELECT * INTO v_listing
    FROM public.channel_listings l
   WHERE l.id = p_listing_id AND l.site_id = p_site_id
   FOR UPDATE;
  IF NOT FOUND THEN
    -- Same message for "wrong site": no cross-tenant existence oracle.
    RAISE EXCEPTION 'listing not found';
  END IF;

  -- The edge matrix (MARKETPLACE_CHANNEL_MODEL.md §4).
  IF p_actor_realm = 'merchant' THEN
    v_allowed :=
         (v_listing.status = 'draft' AND p_to_status = 'pending_review')
      OR (v_listing.status = 'rejected' AND p_to_status = 'draft')
      OR (v_listing.status = 'approved' AND p_to_status = 'paused')
      OR (v_listing.status = 'paused' AND p_to_status = 'approved' AND v_listing.approved_at IS NOT NULL)
      OR (v_listing.status IN ('draft', 'pending_review', 'approved', 'paused', 'rejected') AND p_to_status = 'delisted');
  ELSE
    v_allowed :=
         (v_listing.status = 'pending_review' AND p_to_status IN ('approved', 'rejected'))
      OR (v_listing.status = 'approved' AND p_to_status = 'delisted');
  END IF;
  IF NOT v_allowed THEN
    RAISE EXCEPTION 'invalid_transition: % -> % by %', v_listing.status, p_to_status, p_actor_realm;
  END IF;

  IF p_to_status = 'pending_review' THEN
    IF v_listing.channel = 'marketplace' AND v_listing.marketplace_category_id IS NULL THEN
      RAISE EXCEPTION 'marketplace listings require a marketplace_category_id before review';
    END IF;
    SELECT (p.is_active = true AND p.deleted_at IS NULL AND COALESCE(p.site_id, p.store_id) = v_listing.site_id)
      INTO v_product_ok
      FROM public.products p
     WHERE p.id = v_listing.product_id;
    IF NOT COALESCE(v_product_ok, false) THEN
      RAISE EXCEPTION 'product is not sellable';
    END IF;
  END IF;

  IF p_actor_realm = 'operator' AND p_to_status IN ('rejected', 'delisted') AND (p_reason IS NULL OR length(btrim(p_reason)) = 0) THEN
    RAISE EXCEPTION 'a reason is required for operator % decisions', p_to_status;
  END IF;

  -- Mark the transaction so the status guard trigger lets exactly this write through.
  PERFORM set_config('app.channel_listing_transition', 'rpc', true);

  UPDATE public.channel_listings l
     SET status = p_to_status,
         version = l.version + 1,
         updated_at = v_now,
         updated_by = COALESCE(p_actor_id, l.updated_by),
         submitted_at = CASE WHEN p_to_status = 'pending_review' THEN v_now ELSE l.submitted_at END,
         approved_at = CASE WHEN p_to_status = 'approved' AND p_actor_realm = 'operator' THEN v_now ELSE l.approved_at END,
         reviewed_at = CASE WHEN p_actor_realm = 'operator' THEN v_now ELSE l.reviewed_at END,
         reviewed_by = CASE WHEN p_actor_realm = 'operator' THEN p_actor_id ELSE l.reviewed_by END,
         rejection_reason = CASE WHEN p_to_status = 'rejected' THEN p_reason
                                 WHEN p_to_status = 'draft' THEN NULL
                                 ELSE l.rejection_reason END
   WHERE l.id = v_listing.id;

  INSERT INTO public.channel_listing_moderation_events (site_id, listing_id, from_status, to_status, actor_realm, actor_id, reason, idempotency_key)
  VALUES (p_site_id, v_listing.id, v_listing.status, p_to_status, p_actor_realm, p_actor_id, p_reason, p_idempotency_key)
  RETURNING id INTO v_event_id;

  PERFORM set_config('app.channel_listing_transition', '', true);

  RETURN QUERY SELECT v_listing.id, v_listing.status, p_to_status, v_event_id, false;
END;
$$;

REVOKE ALL ON FUNCTION public.transition_channel_listing(uuid, uuid, text, text, uuid, text, text) FROM PUBLIC;
DO $$
DECLARE
  v_role text;
BEGIN
  FOREACH v_role IN ARRAY ARRAY['app_tenant', 'authenticated', 'service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = v_role) THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.transition_channel_listing(uuid, uuid, text, text, uuid, text, text) TO %I', v_role);
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE EXECUTE ON FUNCTION public.transition_channel_listing(uuid, uuid, text, text, uuid, text, text) FROM anon;
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- 5. marketplace_feed — the one designed cross-tenant read
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.marketplace_feed(
  p_category_slug text DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_limit integer DEFAULT 20,
  p_after_approved_at timestamp with time zone DEFAULT NULL,
  p_after_id uuid DEFAULT NULL
)
RETURNS TABLE (
  listing_id uuid,
  product_id uuid,
  site_id uuid,
  store_name text,
  subdomain text,
  name text,
  slug text,
  images text[],
  price numeric,
  compare_price numeric,
  category_slug text,
  approved_at timestamp with time zone
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    cl.id            AS listing_id,
    p.id             AS product_id,
    s.id             AS site_id,
    s.store_name     AS store_name,
    s.subdomain      AS subdomain,
    p.name           AS name,
    p.slug           AS slug,
    p.images         AS images,
    p.price          AS price,
    p.compare_price  AS compare_price,
    mc.slug          AS category_slug,
    cl.approved_at   AS approved_at
  FROM public.channel_listings cl
  JOIN public.products p ON p.id = cl.product_id
  JOIN public.sites s ON s.id = cl.site_id
  LEFT JOIN public.marketplace_categories mc ON mc.id = cl.marketplace_category_id
  WHERE cl.channel = 'marketplace'
    AND cl.status = 'approved'
    AND cl.visibility = 'public'
    AND p.is_active = true
    AND p.deleted_at IS NULL
    AND s.status = 'published'
    AND s.deleted_at IS NULL
    AND (p_category_slug IS NULL OR mc.slug = p_category_slug)
    AND (
      p_search IS NULL OR length(btrim(p_search)) = 0
      OR p.name ILIKE '%' || replace(replace(replace(btrim(p_search), '\', '\\'), '%', '\%'), '_', '\_') || '%' ESCAPE '\'
    )
    AND (
      p_after_approved_at IS NULL OR p_after_id IS NULL
      OR (cl.approved_at, cl.id) < (p_after_approved_at, p_after_id)
    )
  ORDER BY cl.approved_at DESC, cl.id DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 20), 100));
$$;

REVOKE ALL ON FUNCTION public.marketplace_feed(text, text, integer, timestamp with time zone, uuid) FROM PUBLIC;
DO $$
DECLARE
  v_role text;
BEGIN
  FOREACH v_role IN ARRAY ARRAY['anon', 'authenticated', 'app_tenant', 'service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = v_role) THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.marketplace_feed(text, text, integer, timestamp with time zone, uuid) TO %I', v_role);
    END IF;
  END LOOP;
END
$$;

COMMIT;
