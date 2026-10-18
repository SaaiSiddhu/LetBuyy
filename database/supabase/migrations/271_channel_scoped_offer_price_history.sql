-- 271 — make public reference-price evidence follow the existing channel visibility rules.
-- Rows from 270 are deliberately unscoped: they captured price writes, not public offers.

ALTER TABLE public.product_price_observations
    ADD COLUMN offer_channel text NOT NULL DEFAULT 'unscoped',
    ADD COLUMN is_available boolean NOT NULL DEFAULT false;

ALTER TABLE public.product_price_observations
    ADD CONSTRAINT product_price_observations_channel_check
        CHECK (offer_channel IN ('unscoped', 'storefront', 'marketplace'));

CREATE INDEX product_price_observations_offer_window_idx
    ON public.product_price_observations (offer_channel, product_id, variant_id, observed_at DESC, id DESC)
    WHERE offer_channel <> 'unscoped';

COMMENT ON COLUMN public.product_price_observations.offer_channel IS
    'Public offer scope. Historical 270 rows remain unscoped and cannot prove a public offer price.';
COMMENT ON COLUMN public.product_price_observations.is_available IS
    'Whether the product/variant met the existing channel public-visibility predicates at observed_at.';

-- Append one product and all relational variant states for each applicable public channel.
CREATE OR REPLACE FUNCTION public.capture_channel_offer_price_observations(
    p_product_id uuid,
    p_source text DEFAULT 'product_write'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_product public.products%ROWTYPE;
    v_at timestamptz := clock_timestamp();
    v_storefront_available boolean;
    v_marketplace_available boolean;
BEGIN
    SELECT * INTO v_product FROM public.products WHERE id = p_product_id;
    IF NOT FOUND OR COALESCE(v_product.site_id, v_product.store_id) IS NULL THEN
        RETURN;
    END IF;

    SELECT (v_product.is_active IS TRUE AND v_product.deleted_at IS NULL
            AND s.status = 'published' AND s.deleted_at IS NULL)
      INTO v_storefront_available
      FROM public.sites s
     WHERE s.id = COALESCE(v_product.site_id, v_product.store_id);
    v_storefront_available := COALESCE(v_storefront_available, false);

    INSERT INTO public.product_price_observations (
        store_id, product_id, variant_id, price, compare_price,
        prior_lowest_price_30d, prior_coverage_complete, observed_at,
        observation_source, offer_channel, is_available
    ) VALUES (
        COALESCE(v_product.site_id, v_product.store_id), v_product.id, NULL,
        v_product.price, v_product.compare_price, NULL, false, v_at,
        p_source, 'storefront', v_storefront_available
    );

    INSERT INTO public.product_price_observations (
        store_id, product_id, variant_id, price, compare_price,
        prior_lowest_price_30d, prior_coverage_complete, observed_at,
        observation_source, offer_channel, is_available
    )
    SELECT COALESCE(v_product.site_id, v_product.store_id), v_product.id, v.id,
           v.price, v.compare_price, NULL, false, v_at, p_source,
           'storefront', v_storefront_available
      FROM public.product_variants v WHERE v.product_id = v_product.id;

    IF EXISTS (SELECT 1 FROM public.channel_listings cl
                WHERE cl.product_id = v_product.id AND cl.channel = 'marketplace') THEN
        SELECT (v_product.is_active IS TRUE AND v_product.deleted_at IS NULL
                AND s.status = 'published' AND s.deleted_at IS NULL
                AND cl.status = 'approved' AND cl.visibility = 'public')
          INTO v_marketplace_available
          FROM public.channel_listings cl
          JOIN public.sites s ON s.id = cl.site_id
         WHERE cl.product_id = v_product.id AND cl.channel = 'marketplace';
        v_marketplace_available := COALESCE(v_marketplace_available, false);

        INSERT INTO public.product_price_observations (
            store_id, product_id, variant_id, price, compare_price,
            prior_lowest_price_30d, prior_coverage_complete, observed_at,
            observation_source, offer_channel, is_available
        ) VALUES (
            COALESCE(v_product.site_id, v_product.store_id), v_product.id, NULL,
            v_product.price, v_product.compare_price, NULL, false, v_at,
            p_source, 'marketplace', v_marketplace_available
        );

        INSERT INTO public.product_price_observations (
            store_id, product_id, variant_id, price, compare_price,
            prior_lowest_price_30d, prior_coverage_complete, observed_at,
            observation_source, offer_channel, is_available
        )
        SELECT COALESCE(v_product.site_id, v_product.store_id), v_product.id, v.id,
               v.price, v.compare_price, NULL, false, v_at, p_source,
               'marketplace', v_marketplace_available
          FROM public.product_variants v WHERE v.product_id = v_product.id;
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.capture_channel_offer_price_observations(uuid, text)
    FROM PUBLIC, anon, authenticated, app_tenant, service_role;

CREATE OR REPLACE FUNCTION public.capture_product_price_observation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
    IF TG_TABLE_NAME = 'products' THEN
        IF TG_OP = 'INSERT'
           OR NEW.store_id IS DISTINCT FROM OLD.store_id
           OR NEW.site_id IS DISTINCT FROM OLD.site_id
           OR NEW.price IS DISTINCT FROM OLD.price
           OR NEW.compare_price IS DISTINCT FROM OLD.compare_price
           OR NEW.is_active IS DISTINCT FROM OLD.is_active
           OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
            IF TG_OP = 'UPDATE'
               AND (NEW.store_id IS DISTINCT FROM OLD.store_id OR NEW.site_id IS DISTINCT FROM OLD.site_id) THEN
                PERFORM public.capture_channel_offer_price_observations(NEW.id, 'store_reassignment_baseline');
            ELSE
                PERFORM public.capture_channel_offer_price_observations(NEW.id, 'product_write');
            END IF;
        END IF;
        RETURN NEW;
    END IF;

    IF TG_OP = 'INSERT'
       OR NEW.product_id IS DISTINCT FROM OLD.product_id
       OR NEW.price IS DISTINCT FROM OLD.price
       OR NEW.compare_price IS DISTINCT FROM OLD.compare_price THEN
        IF TG_OP = 'UPDATE' AND NEW.product_id IS DISTINCT FROM OLD.product_id THEN
            PERFORM public.capture_channel_offer_price_observations(OLD.product_id, 'product_write');
        END IF;
        PERFORM public.capture_channel_offer_price_observations(NEW.product_id, 'variant_write');
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS products_capture_price_observation ON public.products;
DROP TRIGGER IF EXISTS product_variants_capture_price_observation ON public.product_variants;
CREATE TRIGGER products_capture_price_observation
AFTER INSERT OR UPDATE OF store_id, site_id, price, compare_price, is_active, deleted_at ON public.products
FOR EACH ROW EXECUTE FUNCTION public.capture_product_price_observation();
CREATE TRIGGER product_variants_capture_price_observation
AFTER INSERT OR UPDATE OF product_id, price, compare_price ON public.product_variants
FOR EACH ROW EXECUTE FUNCTION public.capture_product_price_observation();

CREATE OR REPLACE FUNCTION public.capture_listing_offer_price_observation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.channel = 'marketplace' THEN
            PERFORM public.capture_removed_marketplace_offer_price_observation(OLD.product_id, OLD.site_id);
        END IF;
        RETURN OLD;
    END IF;

    IF TG_OP = 'UPDATE' AND OLD.channel = 'marketplace'
       AND (NEW.channel <> 'marketplace' OR NEW.product_id IS DISTINCT FROM OLD.product_id) THEN
        PERFORM public.capture_removed_marketplace_offer_price_observation(OLD.product_id, OLD.site_id);
    END IF;

    IF NEW.channel = 'marketplace'
       AND (TG_OP = 'INSERT'
            OR OLD.channel IS DISTINCT FROM NEW.channel
            OR NEW.status IS DISTINCT FROM OLD.status
            OR NEW.visibility IS DISTINCT FROM OLD.visibility
            OR NEW.product_id IS DISTINCT FROM OLD.product_id) THEN
        PERFORM public.capture_channel_offer_price_observations(NEW.product_id, 'product_write');
    END IF;
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.capture_listing_offer_price_observation()
    FROM PUBLIC, anon, authenticated, app_tenant, service_role;
CREATE OR REPLACE FUNCTION public.capture_removed_marketplace_offer_price_observation(
    p_product_id uuid,
    p_site_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_product public.products%ROWTYPE;
    v_at timestamptz := clock_timestamp();
    v_store_id uuid;
BEGIN
    SELECT * INTO v_product FROM public.products WHERE id = p_product_id;
    IF NOT FOUND THEN RETURN; END IF;
    v_store_id := COALESCE(p_site_id, v_product.site_id, v_product.store_id);
    IF v_store_id IS NULL THEN RETURN; END IF;

    INSERT INTO public.product_price_observations (
        store_id, product_id, variant_id, price, compare_price,
        prior_lowest_price_30d, prior_coverage_complete, observed_at,
        observation_source, offer_channel, is_available
    ) VALUES (
        v_store_id, v_product.id, NULL, v_product.price, v_product.compare_price,
        NULL, false, v_at, 'product_write', 'marketplace', false
    );
    INSERT INTO public.product_price_observations (
        store_id, product_id, variant_id, price, compare_price,
        prior_lowest_price_30d, prior_coverage_complete, observed_at,
        observation_source, offer_channel, is_available
    )
    SELECT v_store_id, v_product.id, v.id, v.price, v.compare_price,
           NULL, false, v_at, 'product_write', 'marketplace', false
      FROM public.product_variants v WHERE v.product_id = v_product.id;
END;
$$;

REVOKE ALL ON FUNCTION public.capture_removed_marketplace_offer_price_observation(uuid, uuid)
    FROM PUBLIC, anon, authenticated, app_tenant, service_role;

CREATE TRIGGER channel_listings_capture_offer_price_observation
AFTER INSERT OR UPDATE OF channel, status, visibility, product_id ON public.channel_listings
FOR EACH ROW EXECUTE FUNCTION public.capture_listing_offer_price_observation();
CREATE TRIGGER channel_listings_capture_offer_price_deletion
AFTER DELETE ON public.channel_listings
FOR EACH ROW EXECUTE FUNCTION public.capture_listing_offer_price_observation();

CREATE OR REPLACE FUNCTION public.capture_site_offer_price_observations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_product_id uuid;
BEGIN
    IF NEW.status IS DISTINCT FROM OLD.status OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
        FOR v_product_id IN
            SELECT p.id FROM public.products p
             WHERE COALESCE(p.site_id, p.store_id) = NEW.id
        LOOP
            PERFORM public.capture_channel_offer_price_observations(v_product_id, 'product_write');
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.capture_site_offer_price_observations()
    FROM PUBLIC, anon, authenticated, app_tenant, service_role;
CREATE TRIGGER sites_capture_offer_price_observations
AFTER UPDATE OF status, deleted_at ON public.sites
FOR EACH ROW EXECUTE FUNCTION public.capture_site_offer_price_observations();

-- Establish honest start points for both public scopes at migration time. No pre-migration
-- product-write records from 270 are upgraded into public-offer evidence.
DO $$
DECLARE v_product_id uuid;
BEGIN
    FOR v_product_id IN SELECT id FROM public.products
        WHERE COALESCE(site_id, store_id) IS NOT NULL
    LOOP
        PERFORM public.capture_channel_offer_price_observations(v_product_id, 'migration_baseline');
    END LOOP;
END;
$$;

DROP FUNCTION public.product_price_reference_window(uuid[], timestamptz);
CREATE FUNCTION public.product_price_reference_window(
    p_product_ids uuid[],
    p_as_of timestamptz DEFAULT now(),
    p_channel text DEFAULT 'storefront'
)
RETURNS TABLE (
    product_id uuid,
    variant_id uuid,
    current_price numeric,
    compare_price numeric,
    prior_lowest_price_30d numeric,
    prior_coverage_complete boolean,
    price_observed_at timestamptz,
    coverage_start_at timestamptz,
    last_observed_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
    WITH requested AS (
        SELECT DISTINCT unnest(COALESCE(p_product_ids, ARRAY[]::uuid[])) AS product_id
    ),
    keys AS (
        SELECT p.id AS product_id, COALESCE(p.site_id, p.store_id) AS store_id, NULL::uuid AS variant_id
          FROM public.products p JOIN requested r ON r.product_id = p.id
        UNION ALL
        SELECT v.product_id, COALESCE(p.site_id, p.store_id), v.id
          FROM public.product_variants v JOIN requested r ON r.product_id = v.product_id
          JOIN public.products p ON p.id = v.product_id
    ),
    ranked AS (
        SELECT h.product_id, h.variant_id, h.price, h.compare_price, h.observed_at, h.id,
               row_number() OVER (PARTITION BY h.product_id, h.variant_id ORDER BY h.observed_at DESC, h.id DESC) AS rn
          FROM public.product_price_observations h JOIN keys k
            ON k.product_id = h.product_id AND k.store_id = h.store_id
           AND k.variant_id IS NOT DISTINCT FROM h.variant_id
         WHERE p_channel IN ('storefront', 'marketplace')
           AND h.offer_channel = p_channel AND h.observed_at <= COALESCE(p_as_of, now())
    ),
    boundary_ranked AS (
        SELECT h.product_id, h.variant_id, h.price, h.is_available,
               row_number() OVER (
                   PARTITION BY h.product_id, h.variant_id
                   ORDER BY h.observed_at DESC, h.id DESC
               ) AS rn
          FROM public.product_price_observations h JOIN keys k
            ON k.product_id = h.product_id AND k.store_id = h.store_id
           AND k.variant_id IS NOT DISTINCT FROM h.variant_id
         WHERE p_channel IN ('storefront', 'marketplace')
           AND h.offer_channel = p_channel
           AND h.observed_at <= COALESCE(p_as_of, now()) - interval '30 days'
    ),
    boundary AS (
        SELECT b.product_id, b.variant_id, b.price
          FROM boundary_ranked b
         WHERE b.rn = 1 AND b.is_available
    ),
    lowest AS (
        SELECT points.product_id, points.variant_id, min(points.price) AS prior_lowest_price_30d
          FROM (
                SELECT * FROM boundary
                UNION ALL
                SELECT h.product_id, h.variant_id, h.price
                  FROM public.product_price_observations h JOIN keys k
                    ON k.product_id = h.product_id AND k.store_id = h.store_id
                   AND k.variant_id IS NOT DISTINCT FROM h.variant_id
                 WHERE p_channel IN ('storefront', 'marketplace')
                   AND h.offer_channel = p_channel AND h.is_available
                   AND h.observed_at > COALESCE(p_as_of, now()) - interval '30 days'
                   AND h.observed_at < COALESCE(p_as_of, now())
          ) points GROUP BY points.product_id, points.variant_id
    ),
    coverage AS (
        SELECT h.product_id, h.variant_id, min(h.observed_at) AS coverage_start_at,
               bool_or(h.observed_at <= COALESCE(p_as_of, now()) - interval '30 days') AS coverage_complete
          FROM public.product_price_observations h JOIN keys k
            ON k.product_id = h.product_id AND k.store_id = h.store_id
           AND k.variant_id IS NOT DISTINCT FROM h.variant_id
         WHERE p_channel IN ('storefront', 'marketplace')
           AND h.offer_channel = p_channel AND h.observed_at <= COALESCE(p_as_of, now())
         GROUP BY h.product_id, h.variant_id
    )
    SELECT k.product_id, k.variant_id, r.price, r.compare_price, l.prior_lowest_price_30d,
           COALESCE(c.coverage_complete, false), r.observed_at, c.coverage_start_at, r.observed_at
      FROM keys k
      LEFT JOIN ranked r ON r.product_id = k.product_id AND r.variant_id IS NOT DISTINCT FROM k.variant_id AND r.rn = 1
      LEFT JOIN lowest l ON l.product_id = k.product_id AND l.variant_id IS NOT DISTINCT FROM k.variant_id
      LEFT JOIN coverage c ON c.product_id = k.product_id AND c.variant_id IS NOT DISTINCT FROM k.variant_id;
$$;

REVOKE ALL ON FUNCTION public.product_price_reference_window(uuid[], timestamptz, text)
    FROM PUBLIC, anon, authenticated, app_tenant;
GRANT EXECUTE ON FUNCTION public.product_price_reference_window(uuid[], timestamptz, text) TO service_role;
