-- Rollback 280: restore the rolling-now window from migration 271.
BEGIN;

-- Refuse ABI drift before restoring historical bodies or changing schema objects.
DO $rollback_precondition$
DECLARE
  v_expected record;
  v_live pg_catalog.pg_proc%ROWTYPE;
  v_count integer;
BEGIN
  FOR v_expected IN SELECT * FROM (VALUES
    ('product_price_reference_window', 'public.product_price_reference_window(uuid[],timestamptz,text)', ARRAY['p_product_ids','p_as_of','p_channel']::text[], 'record', true)
  ) AS expected(name, signature, input_names, result_type, returns_set)
  LOOP
    SELECT count(*) INTO v_count FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public' AND p.proname=v_expected.name;
    IF v_count <> 1 OR pg_catalog.to_regprocedure(v_expected.signature) IS NULL THEN
      RAISE EXCEPTION 'rollback 280 refuses to run: % signature or overload set changed; use a reviewed forward repair', v_expected.name;
    END IF;
    SELECT * INTO v_live FROM pg_catalog.pg_proc p
     WHERE p.oid=pg_catalog.to_regprocedure(v_expected.signature);
    IF COALESCE(v_live.proargnames[1:v_live.pronargs], ARRAY[]::text[]) IS DISTINCT FROM v_expected.input_names
       OR v_live.prorettype IS DISTINCT FROM v_expected.result_type::regtype
       OR v_live.proretset IS DISTINCT FROM v_expected.returns_set
       OR v_live.prokind <> 'f' THEN
      RAISE EXCEPTION 'rollback 280 refuses to run: % input names or result ABI changed; use a reviewed forward repair', v_expected.name;
    END IF;
  END LOOP;
  SELECT * INTO v_live FROM pg_catalog.pg_proc p
   WHERE p.oid='public.product_price_reference_window(uuid[],timestamptz,text)'::regprocedure;
  IF v_live.proargnames IS DISTINCT FROM ARRAY[
       'p_product_ids','p_as_of','p_channel','product_id','variant_id','current_price','compare_price',
       'prior_lowest_price_30d','prior_coverage_complete','price_observed_at','coverage_start_at','last_observed_at']::text[]
     OR v_live.proallargtypes IS DISTINCT FROM ARRAY[
       'uuid[]'::regtype::oid,'timestamptz'::regtype::oid,'text'::regtype::oid,
       'uuid'::regtype::oid,'uuid'::regtype::oid,'numeric'::regtype::oid,'numeric'::regtype::oid,
       'numeric'::regtype::oid,'boolean'::regtype::oid,'timestamptz'::regtype::oid,
       'timestamptz'::regtype::oid,'timestamptz'::regtype::oid]::oid[]
     OR v_live.proargmodes IS DISTINCT FROM ARRAY['i','i','i','t','t','t','t','t','t','t','t','t']::"char"[] THEN
    RAISE EXCEPTION 'rollback 280 refuses to run: product price table result ABI changed; use a reviewed forward repair';
  END IF;
END;
$rollback_precondition$;

CREATE OR REPLACE FUNCTION public.product_price_reference_window(
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
    SELECT k.product_id, k.variant_id, r.price, r.compare_price, low.prior_lowest_price_30d,
           COALESCE(c.coverage_complete, false), r.observed_at, c.coverage_start_at, r.observed_at
      FROM keys k
      LEFT JOIN ranked r ON r.product_id = k.product_id AND r.variant_id IS NOT DISTINCT FROM k.variant_id AND r.rn = 1
      LEFT JOIN lowest low ON low.product_id = k.product_id AND low.variant_id IS NOT DISTINCT FROM k.variant_id
      LEFT JOIN coverage c ON c.product_id = k.product_id AND c.variant_id IS NOT DISTINCT FROM k.variant_id;
$$;

COMMIT;
