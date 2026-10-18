-- 280 — anchor public prior-price evidence before the latest offer observation.
-- The previous implementation calculated its 30-day range through p_as_of, which
-- included the newly announced price and made a valid reduced-price reference
-- impossible whenever that new price became the period low.

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
    observed AS (
        SELECT h.product_id, h.variant_id, h.price, h.compare_price, h.observed_at, h.id, h.is_available,
               row_number() OVER (PARTITION BY h.product_id, h.variant_id ORDER BY h.observed_at DESC, h.id DESC) AS rn,
               lag(h.price) OVER (PARTITION BY h.product_id, h.variant_id ORDER BY h.observed_at, h.id) AS previous_price,
               lag(h.is_available) OVER (PARTITION BY h.product_id, h.variant_id ORDER BY h.observed_at, h.id) AS previous_available
          FROM public.product_price_observations h JOIN keys k
            ON k.product_id = h.product_id AND k.store_id = h.store_id
           AND k.variant_id IS NOT DISTINCT FROM h.variant_id
         WHERE p_channel IN ('storefront', 'marketplace')
           AND h.offer_channel = p_channel AND h.observed_at <= COALESCE(p_as_of, now())
    ),
    latest AS (
        SELECT h.product_id, h.variant_id, h.price, h.compare_price, h.observed_at
          FROM observed h
         WHERE h.rn = 1
    ),
    anchors AS (
        SELECT DISTINCT ON (h.product_id, h.variant_id)
               h.product_id, h.variant_id, h.observed_at AS reference_at
          FROM observed h
         WHERE (h.previous_price IS NOT NULL AND h.price IS DISTINCT FROM h.previous_price)
            OR (h.previous_available IS NOT NULL AND h.is_available IS DISTINCT FROM h.previous_available)
         ORDER BY h.product_id, h.variant_id, h.observed_at DESC, h.id DESC
    ),
    reference_points AS (
        SELECT l.product_id, l.variant_id, COALESCE(a.reference_at, l.observed_at) AS reference_at
          FROM latest l
          LEFT JOIN anchors a ON a.product_id = l.product_id AND a.variant_id IS NOT DISTINCT FROM l.variant_id
    ),
    boundary_ranked AS (
        SELECT h.product_id, h.variant_id, h.price, h.is_available,
               row_number() OVER (
                   PARTITION BY h.product_id, h.variant_id
                   ORDER BY h.observed_at DESC, h.id DESC
               ) AS rn
          FROM public.product_price_observations h
          JOIN keys k ON k.product_id = h.product_id AND k.store_id = h.store_id
                     AND k.variant_id IS NOT DISTINCT FROM h.variant_id
          JOIN reference_points r ON r.product_id = h.product_id AND r.variant_id IS NOT DISTINCT FROM h.variant_id
         WHERE p_channel IN ('storefront', 'marketplace')
           AND h.offer_channel = p_channel
           AND h.observed_at <= r.reference_at - interval '30 days'
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
                  FROM public.product_price_observations h
                  JOIN keys k ON k.product_id = h.product_id AND k.store_id = h.store_id
                             AND k.variant_id IS NOT DISTINCT FROM h.variant_id
                  JOIN reference_points r ON r.product_id = h.product_id AND r.variant_id IS NOT DISTINCT FROM h.variant_id
                 WHERE p_channel IN ('storefront', 'marketplace')
                   AND h.offer_channel = p_channel AND h.is_available
                   AND h.observed_at > r.reference_at - interval '30 days'
                   AND h.observed_at < r.reference_at
          ) points GROUP BY points.product_id, points.variant_id
    ),
    coverage AS (
        SELECT h.product_id, h.variant_id, min(h.observed_at) AS coverage_start_at,
               bool_or(h.observed_at <= r.reference_at - interval '30 days') AS coverage_complete
          FROM public.product_price_observations h
          JOIN keys k ON k.product_id = h.product_id AND k.store_id = h.store_id
                     AND k.variant_id IS NOT DISTINCT FROM h.variant_id
          JOIN reference_points r ON r.product_id = h.product_id AND r.variant_id IS NOT DISTINCT FROM h.variant_id
         WHERE p_channel IN ('storefront', 'marketplace')
           AND h.offer_channel = p_channel AND h.observed_at <= r.reference_at
         GROUP BY h.product_id, h.variant_id
    )
    SELECT k.product_id, k.variant_id, l.price, l.compare_price, low.prior_lowest_price_30d,
           COALESCE(c.coverage_complete, false), l.observed_at, c.coverage_start_at, l.observed_at
      FROM keys k
      LEFT JOIN latest l ON l.product_id = k.product_id AND l.variant_id IS NOT DISTINCT FROM k.variant_id
      LEFT JOIN lowest low ON low.product_id = k.product_id AND low.variant_id IS NOT DISTINCT FROM k.variant_id
      LEFT JOIN coverage c ON c.product_id = k.product_id AND c.variant_id IS NOT DISTINCT FROM k.variant_id;
$$;

COMMENT ON FUNCTION public.product_price_reference_window(uuid[], timestamptz, text) IS
    'Returns each current public offer price and the lowest available observed price during the 30 days before its latest price or availability transition; subsequent unchanged snapshots do not move the reference period.';
