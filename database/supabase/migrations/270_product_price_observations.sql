-- 270 — retain canonical product/variant price observations for truthful prior-price claims.
-- The migration seeds only the current price at migration time. It does not invent older
-- history from products.updated_at, which is not price-specific evidence.

CREATE TABLE public.product_price_observations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id uuid NOT NULL,
    product_id uuid NOT NULL,
    variant_id uuid,
    price numeric(10,2) NOT NULL CHECK (price >= 0),
    compare_price numeric(10,2),
    prior_lowest_price_30d numeric(10,2) CHECK (prior_lowest_price_30d IS NULL OR prior_lowest_price_30d >= 0),
    prior_coverage_complete boolean NOT NULL DEFAULT false,
    observed_at timestamptz NOT NULL,
    observation_source text NOT NULL CHECK (observation_source IN ('migration_baseline', 'product_write', 'variant_write', 'store_reassignment_baseline'))
);

COMMENT ON TABLE public.product_price_observations IS
    'Append-only evidence of the canonical product and variant prices; migration_baseline observations do not prove prior price history before their observed_at timestamp.';

CREATE INDEX product_price_observations_window_idx
    ON public.product_price_observations (store_id, product_id, variant_id, observed_at DESC, id DESC);

-- The Supabase-faithful bootstrap grants new tables to service_role by default. Revoke those
-- inherited/default table writes before granting the narrowly required read capability.
REVOKE ALL ON TABLE public.product_price_observations FROM PUBLIC, anon, authenticated, app_tenant, service_role;
GRANT SELECT ON TABLE public.product_price_observations TO service_role;

CREATE OR REPLACE FUNCTION public.capture_product_price_observation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_store_id uuid;
    v_product_id uuid;
    v_variant_id uuid;
    v_observed_at timestamptz := clock_timestamp();
    v_cutoff timestamptz;
    v_prior_lowest numeric(10,2);
    v_prior_coverage_complete boolean := false;
BEGIN
    IF TG_TABLE_NAME = 'products' THEN
        IF NEW.store_id IS NULL THEN
            RETURN NEW;
        END IF;

        IF TG_OP = 'UPDATE'
           AND NEW.store_id IS NOT DISTINCT FROM OLD.store_id
           AND NEW.price IS NOT DISTINCT FROM OLD.price
           AND NEW.compare_price IS NOT DISTINCT FROM OLD.compare_price THEN
            RETURN NEW;
        END IF;

        v_store_id := NEW.store_id;
        v_product_id := NEW.id;
        v_variant_id := NULL;
    ELSE
        SELECT p.store_id
          INTO v_store_id
          FROM public.products AS p
         WHERE p.id = NEW.product_id;

        IF v_store_id IS NULL THEN
            RETURN NEW;
        END IF;

        IF TG_OP = 'UPDATE'
           AND NEW.product_id IS NOT DISTINCT FROM OLD.product_id
           AND NEW.price IS NOT DISTINCT FROM OLD.price
           AND NEW.compare_price IS NOT DISTINCT FROM OLD.compare_price THEN
            RETURN NEW;
        END IF;

        v_product_id := NEW.product_id;
        v_variant_id := NEW.id;
    END IF;

    -- Compute the reference period before recording this new price. The latest
    -- observation on/before the cutoff is the honest boundary point; later
    -- observations through the current instant complete the intervening window.
    v_cutoff := v_observed_at - interval '30 days';
    WITH boundary AS (
        SELECT h.price
          FROM public.product_price_observations AS h
         WHERE h.store_id = v_store_id
           AND h.product_id = v_product_id
           AND h.variant_id IS NOT DISTINCT FROM v_variant_id
           AND h.observed_at <= v_cutoff
         ORDER BY h.observed_at DESC, h.id DESC
         LIMIT 1
    ),
    intervening AS (
        SELECT h.price
          FROM public.product_price_observations AS h
         WHERE h.store_id = v_store_id
           AND h.product_id = v_product_id
           AND h.variant_id IS NOT DISTINCT FROM v_variant_id
           AND h.observed_at > v_cutoff
           AND h.observed_at < v_observed_at
    )
    SELECT min(points.price), EXISTS (SELECT 1 FROM boundary)
      INTO v_prior_lowest, v_prior_coverage_complete
      FROM (
          SELECT price FROM boundary
          UNION ALL
          SELECT price FROM intervening
      ) AS points;

    INSERT INTO public.product_price_observations (
        store_id, product_id, variant_id, price, compare_price,
        prior_lowest_price_30d, prior_coverage_complete, observed_at, observation_source
    ) VALUES (
        v_store_id,
        v_product_id,
        v_variant_id,
        NEW.price,
        NEW.compare_price,
        v_prior_lowest,
        v_prior_coverage_complete,
        v_observed_at,
        CASE WHEN v_variant_id IS NULL THEN 'product_write' ELSE 'variant_write' END
    );

    IF TG_TABLE_NAME = 'products'
       AND TG_OP = 'UPDATE'
       AND NEW.store_id IS DISTINCT FROM OLD.store_id THEN
        INSERT INTO public.product_price_observations (
            store_id, product_id, variant_id, price, compare_price,
            prior_lowest_price_30d, prior_coverage_complete, observed_at, observation_source
        )
        SELECT NEW.store_id, v.product_id, v.id, v.price, v.compare_price,
               NULL, false, v_observed_at, 'store_reassignment_baseline'
          FROM public.product_variants AS v
         WHERE v.product_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.capture_product_price_observation() FROM PUBLIC, anon, authenticated, app_tenant, service_role;

CREATE TRIGGER products_capture_price_observation
AFTER INSERT OR UPDATE OF store_id, price, compare_price ON public.products
FOR EACH ROW EXECUTE FUNCTION public.capture_product_price_observation();

CREATE TRIGGER product_variants_capture_price_observation
AFTER INSERT OR UPDATE OF product_id, price, compare_price ON public.product_variants
FOR EACH ROW EXECUTE FUNCTION public.capture_product_price_observation();

-- Existing rows begin an honest observation window now. `updated_at` is not price-specific,
-- so it cannot be used to backdate a price snapshot or claim 30 days of historical coverage.
INSERT INTO public.product_price_observations (
    store_id, product_id, variant_id, price, compare_price,
    prior_lowest_price_30d, prior_coverage_complete, observed_at, observation_source
)
SELECT p.store_id, p.id, NULL, p.price, p.compare_price, NULL, false, transaction_timestamp(), 'migration_baseline'
  FROM public.products AS p
 WHERE p.store_id IS NOT NULL;

INSERT INTO public.product_price_observations (
    store_id, product_id, variant_id, price, compare_price,
    prior_lowest_price_30d, prior_coverage_complete, observed_at, observation_source
)
SELECT p.store_id, p.id, v.id, v.price, v.compare_price, NULL, false, transaction_timestamp(), 'migration_baseline'
  FROM public.product_variants AS v
  JOIN public.products AS p ON p.id = v.product_id
 WHERE p.store_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.product_price_reference_window(
    p_product_ids uuid[],
    p_as_of timestamptz DEFAULT now()
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
        SELECT p.id AS product_id, NULL::uuid AS variant_id
          FROM public.products AS p
          JOIN requested AS r ON r.product_id = p.id
        UNION ALL
        SELECT v.product_id, v.id AS variant_id
          FROM public.product_variants AS v
          JOIN requested AS r ON r.product_id = v.product_id
    ),
    ranked AS (
        SELECT h.product_id, h.variant_id, h.price, h.compare_price,
               h.prior_lowest_price_30d, h.prior_coverage_complete,
               h.observed_at, h.id,
               row_number() OVER (
                   PARTITION BY h.product_id, h.variant_id
                   ORDER BY h.observed_at DESC, h.id DESC
               ) AS rn
          FROM public.product_price_observations AS h
          JOIN keys AS k
            ON k.product_id = h.product_id
           AND k.variant_id IS NOT DISTINCT FROM h.variant_id
         WHERE h.observed_at <= COALESCE(p_as_of, now())
    ),
    boundary_ranked AS (
        SELECT h.product_id, h.variant_id, h.price, h.observed_at, h.id,
               row_number() OVER (
                   PARTITION BY h.product_id, h.variant_id
                   ORDER BY h.observed_at DESC, h.id DESC
               ) AS rn
          FROM public.product_price_observations AS h
          JOIN keys AS k
            ON k.product_id = h.product_id
           AND k.variant_id IS NOT DISTINCT FROM h.variant_id
         WHERE h.observed_at <= COALESCE(p_as_of, now()) - interval '30 days'
    ),
    reference_points AS (
        SELECT b.product_id, b.variant_id, b.price
          FROM boundary_ranked AS b
         WHERE b.rn = 1
        UNION ALL
        SELECT h.product_id, h.variant_id, h.price
          FROM public.product_price_observations AS h
          JOIN keys AS k
            ON k.product_id = h.product_id
           AND k.variant_id IS NOT DISTINCT FROM h.variant_id
         WHERE h.observed_at > COALESCE(p_as_of, now()) - interval '30 days'
           AND h.observed_at < COALESCE(p_as_of, now())
    ),
    lowest AS (
        SELECT p.product_id, p.variant_id, min(p.price) AS prior_lowest_price_30d
          FROM reference_points AS p
         GROUP BY p.product_id, p.variant_id
    ),
    coverage AS (
        SELECT h.product_id,
               h.variant_id,
               min(h.observed_at) AS coverage_start_at,
               bool_or(h.observed_at <= COALESCE(p_as_of, now()) - interval '30 days') AS coverage_complete
          FROM public.product_price_observations AS h
          JOIN keys AS k
            ON k.product_id = h.product_id
           AND k.variant_id IS NOT DISTINCT FROM h.variant_id
         WHERE h.observed_at <= COALESCE(p_as_of, now())
         GROUP BY h.product_id, h.variant_id
    )
    SELECT k.product_id,
           k.variant_id,
           r.price,
           r.compare_price,
           l.prior_lowest_price_30d,
           COALESCE(c.coverage_complete, false),
           r.observed_at,
           c.coverage_start_at,
           r.observed_at
      FROM keys AS k
      LEFT JOIN ranked AS r
        ON r.product_id = k.product_id
       AND r.variant_id IS NOT DISTINCT FROM k.variant_id
       AND r.rn = 1
      LEFT JOIN coverage AS c
        ON c.product_id = k.product_id
       AND c.variant_id IS NOT DISTINCT FROM k.variant_id
      LEFT JOIN lowest AS l
        ON l.product_id = k.product_id
       AND l.variant_id IS NOT DISTINCT FROM k.variant_id
$$;

REVOKE ALL ON FUNCTION public.product_price_reference_window(uuid[], timestamptz) FROM PUBLIC, anon, authenticated, app_tenant;
GRANT EXECUTE ON FUNCTION public.product_price_reference_window(uuid[], timestamptz) TO service_role;
