-- Phase 5.5 P3-4: report and converge products.variants JSONB with product_variants.
-- The JSONB column stays as a derived cache; product_variants is the authoritative model.

CREATE OR REPLACE FUNCTION public.report_products_variants_reconciliation(
    p_sample_limit integer DEFAULT 25
) RETURNS jsonb
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_divergent_count integer := 0;
    v_missing_relational_count integer := 0;
    v_stale_jsonb_count integer := 0;
    v_sample jsonb := '[]'::jsonb;
    v_status text;
    v_report public.dual_model_reconciliation_reports;
BEGIN
    WITH product_counts AS (
        SELECT
            products.id,
            products.name,
            CASE
                WHEN jsonb_typeof(products.variants) = 'array' THEN jsonb_array_length(products.variants)
                ELSE 0
            END AS jsonb_count,
            count(product_variants.id)::integer AS relational_count
        FROM public.products
        LEFT JOIN public.product_variants
          ON product_variants.product_id = products.id
        WHERE products.deleted_at IS NULL
        GROUP BY products.id, products.name, products.variants
    ),
    divergent AS (
        SELECT *
          FROM product_counts
         WHERE jsonb_count <> relational_count
    )
    SELECT
        count(*)::integer,
        count(*) FILTER (WHERE jsonb_count > 0 AND relational_count = 0)::integer,
        count(*) FILTER (WHERE relational_count > 0 AND jsonb_count <> relational_count)::integer
      INTO v_divergent_count, v_missing_relational_count, v_stale_jsonb_count
      FROM divergent;

    WITH product_counts AS (
        SELECT
            products.id,
            products.name,
            CASE
                WHEN jsonb_typeof(products.variants) = 'array' THEN jsonb_array_length(products.variants)
                ELSE 0
            END AS jsonb_count,
            count(product_variants.id)::integer AS relational_count
        FROM public.products
        LEFT JOIN public.product_variants
          ON product_variants.product_id = products.id
        WHERE products.deleted_at IS NULL
        GROUP BY products.id, products.name, products.variants
    ),
    divergent AS (
        SELECT *
          FROM product_counts
         WHERE jsonb_count <> relational_count
    )
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'product_id', id,
        'name', name,
        'jsonb_count', jsonb_count,
        'relational_count', relational_count
    ) ORDER BY name) FILTER (WHERE id IS NOT NULL), '[]'::jsonb)
      INTO v_sample
      FROM (
        SELECT *
          FROM divergent
         ORDER BY name
         LIMIT LEAST(GREATEST(COALESCE(p_sample_limit, 25), 1), 100)
      ) sample_rows;

    v_status := CASE WHEN v_divergent_count = 0 THEN 'clean' ELSE 'divergent' END;

    v_report := public.record_dual_model_reconciliation_report(
        'products_variants',
        'products.variants',
        'product_variants',
        'report',
        v_status,
        v_divergent_count,
        v_missing_relational_count,
        v_stale_jsonb_count,
        true,
        false,
        v_sample,
        'Dry-run report. product_variants is authoritative after reader cutover; use reconcile_products_variants_dual_model(false) only in an approved staging/prod data window.'
    );

    RETURN jsonb_build_object(
        'report_id', v_report.id,
        'status', v_status,
        'divergent_count', v_divergent_count,
        'missing_relational_count', v_missing_relational_count,
        'stale_jsonb_count', v_stale_jsonb_count,
        'sample', v_sample
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.backfill_product_variants_from_jsonb(
    p_limit integer DEFAULT 500
) RETURNS integer
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_rows integer := 0;
BEGIN
    WITH target_products AS (
        SELECT products.id, products.price AS base_price, products.variants
          FROM public.products
         WHERE products.deleted_at IS NULL
           AND jsonb_typeof(products.variants) = 'array'
           AND jsonb_array_length(products.variants) > 0
           AND NOT EXISTS (
                SELECT 1
                  FROM public.product_variants
                 WHERE product_variants.product_id = products.id
           )
         ORDER BY products.created_at ASC
         LIMIT LEAST(GREATEST(COALESCE(p_limit, 500), 1), 5000)
    ),
    inserted AS (
        INSERT INTO public.product_variants (
            product_id,
            title,
            price,
            compare_price,
            sku,
            barcode,
            inventory_qty,
            weight,
            weight_unit,
            option1,
            option2,
            option3,
            image_url,
            "position",
            created_at,
            updated_at
        )
        SELECT
            target_products.id,
            COALESCE(NULLIF(legacy_variant.value->>'title', ''), NULLIF(legacy_variant.value->>'name', ''), 'Default'),
            COALESCE(NULLIF(legacy_variant.value->>'price', '')::numeric, NULLIF(legacy_variant.value->>'price_override', '')::numeric, target_products.base_price, 0),
            NULLIF(legacy_variant.value->>'compare_price', '')::numeric,
            NULLIF(legacy_variant.value->>'sku', ''),
            NULLIF(legacy_variant.value->>'barcode', ''),
            COALESCE(NULLIF(legacy_variant.value->>'inventory_qty', '')::integer, NULLIF(legacy_variant.value->>'stock', '')::integer, 0),
            NULLIF(legacy_variant.value->>'weight', '')::numeric,
            COALESCE(NULLIF(legacy_variant.value->>'weight_unit', ''), 'kg'),
            COALESCE(NULLIF(legacy_variant.value->>'option1', ''), legacy_variant.value#>>'{options,0}'),
            COALESCE(NULLIF(legacy_variant.value->>'option2', ''), legacy_variant.value#>>'{options,1}'),
            COALESCE(NULLIF(legacy_variant.value->>'option3', ''), legacy_variant.value#>>'{options,2}'),
            NULLIF(legacy_variant.value->>'image_url', ''),
            (legacy_variant.ordinal - 1)::integer,
            now(),
            now()
          FROM target_products
          CROSS JOIN LATERAL jsonb_array_elements(target_products.variants) WITH ORDINALITY AS legacy_variant(value, ordinal)
        RETURNING 1
    )
    SELECT count(*)::integer INTO v_rows FROM inserted;

    RETURN COALESCE(v_rows, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_products_variants_jsonb_cache(
    p_limit integer DEFAULT 500
) RETURNS integer
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_rows integer := 0;
BEGIN
    WITH relational_payloads AS (
        SELECT
            product_variants.product_id,
            jsonb_agg(jsonb_build_object(
                'id', product_variants.id,
                'product_id', product_variants.product_id,
                'title', product_variants.title,
                'price', product_variants.price,
                'compare_price', product_variants.compare_price,
                'sku', product_variants.sku,
                'barcode', product_variants.barcode,
                'stock', product_variants.inventory_qty,
                'inventory_qty', product_variants.inventory_qty,
                'weight', product_variants.weight,
                'weight_unit', product_variants.weight_unit,
                'option1', product_variants.option1,
                'option2', product_variants.option2,
                'option3', product_variants.option3,
                'image_url', product_variants.image_url,
                'position', product_variants."position"
            ) ORDER BY product_variants."position" ASC, product_variants.created_at ASC) AS variants_jsonb
          FROM public.product_variants
         GROUP BY product_variants.product_id
         ORDER BY min(product_variants.created_at) ASC
         LIMIT LEAST(GREATEST(COALESCE(p_limit, 500), 1), 5000)
    ),
    updated AS (
        UPDATE public.products
           SET variants = relational_payloads.variants_jsonb,
               updated_at = now()
          FROM relational_payloads
         WHERE products.id = relational_payloads.product_id
           AND products.variants IS DISTINCT FROM relational_payloads.variants_jsonb
         RETURNING products.id
    )
    SELECT count(*)::integer INTO v_rows FROM updated;

    RETURN COALESCE(v_rows, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.reconcile_products_variants_dual_model(
    p_limit integer DEFAULT 500,
    p_dry_run boolean DEFAULT true
) RETURNS jsonb
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_before jsonb;
    v_after jsonb;
    v_inserted integer := 0;
    v_cache_updates integer := 0;
    v_report public.dual_model_reconciliation_reports;
BEGIN
    v_before := public.report_products_variants_reconciliation(25);

    IF NOT COALESCE(p_dry_run, true) THEN
        v_inserted := public.backfill_product_variants_from_jsonb(p_limit);
        v_cache_updates := public.refresh_products_variants_jsonb_cache(p_limit);
    END IF;

    v_after := public.report_products_variants_reconciliation(25);

    v_report := public.record_dual_model_reconciliation_report(
        'products_variants',
        'products.variants',
        'product_variants',
        'reconcile',
        CASE WHEN COALESCE(p_dry_run, true) THEN 'divergent' ELSE 'applied' END,
        COALESCE((v_after->>'divergent_count')::integer, 0),
        COALESCE((v_after->>'missing_relational_count')::integer, 0),
        COALESCE((v_after->>'stale_jsonb_count')::integer, 0),
        COALESCE(p_dry_run, true),
        NOT COALESCE(p_dry_run, true),
        COALESCE(v_after->'sample', '[]'::jsonb),
        jsonb_build_object(
            'before', v_before,
            'after', v_after,
            'inserted_product_variants', v_inserted,
            'refreshed_product_jsonb_rows', v_cache_updates
        )::text
    );

    RETURN jsonb_build_object(
        'report_id', v_report.id,
        'dry_run', COALESCE(p_dry_run, true),
        'inserted_product_variants', v_inserted,
        'refreshed_product_jsonb_rows', v_cache_updates,
        'before', v_before,
        'after', v_after
    );
END;
$$;

SELECT public.report_products_variants_reconciliation(25);
