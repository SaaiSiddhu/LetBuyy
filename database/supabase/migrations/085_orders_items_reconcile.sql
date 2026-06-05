-- Phase 5.5 P3-4: report and converge orders.items JSONB with order_items.
-- The JSONB column stays for rollback/compatibility; order_items is the authoritative model.

CREATE TABLE IF NOT EXISTS public.dual_model_reconciliation_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    model_name text NOT NULL,
    source_table text NOT NULL,
    relational_table text NOT NULL,
    report_kind text NOT NULL,
    status text NOT NULL,
    divergent_count integer DEFAULT 0 NOT NULL,
    missing_relational_count integer DEFAULT 0 NOT NULL,
    stale_jsonb_count integer DEFAULT 0 NOT NULL,
    dry_run boolean DEFAULT true NOT NULL,
    applied boolean DEFAULT false NOT NULL,
    sample jsonb DEFAULT '[]'::jsonb NOT NULL,
    notes text,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT dual_model_reconciliation_reports_model_check CHECK ((model_name = ANY (ARRAY['orders_items'::text, 'products_variants'::text]))),
    CONSTRAINT dual_model_reconciliation_reports_status_check CHECK ((status = ANY (ARRAY['clean'::text, 'divergent'::text, 'applied'::text, 'blocked'::text]))),
    CONSTRAINT dual_model_reconciliation_reports_kind_check CHECK ((report_kind = ANY (ARRAY['report'::text, 'backfill'::text, 'sync-cache'::text, 'reconcile'::text])))
);

ALTER TABLE ONLY public.dual_model_reconciliation_reports
    ADD CONSTRAINT dual_model_reconciliation_reports_pkey PRIMARY KEY (id);

CREATE INDEX IF NOT EXISTS idx_dual_model_reconciliation_reports_model_created
    ON public.dual_model_reconciliation_reports USING btree (model_name, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE TRIGGER update_dual_model_reconciliation_reports_updated_at
    BEFORE UPDATE ON public.dual_model_reconciliation_reports
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.dual_model_reconciliation_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY dual_model_reconciliation_reports_service_all ON public.dual_model_reconciliation_reports
    USING ((auth.role() = 'service_role'::text))
    WITH CHECK ((auth.role() = 'service_role'::text));

CREATE OR REPLACE FUNCTION public.record_dual_model_reconciliation_report(
    p_model_name text,
    p_source_table text,
    p_relational_table text,
    p_report_kind text,
    p_status text,
    p_divergent_count integer DEFAULT 0,
    p_missing_relational_count integer DEFAULT 0,
    p_stale_jsonb_count integer DEFAULT 0,
    p_dry_run boolean DEFAULT true,
    p_applied boolean DEFAULT false,
    p_sample jsonb DEFAULT '[]'::jsonb,
    p_notes text DEFAULT NULL::text
) RETURNS public.dual_model_reconciliation_reports
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_report public.dual_model_reconciliation_reports;
BEGIN
    INSERT INTO public.dual_model_reconciliation_reports (
        model_name,
        source_table,
        relational_table,
        report_kind,
        status,
        divergent_count,
        missing_relational_count,
        stale_jsonb_count,
        dry_run,
        applied,
        sample,
        notes
    ) VALUES (
        p_model_name,
        p_source_table,
        p_relational_table,
        p_report_kind,
        p_status,
        GREATEST(COALESCE(p_divergent_count, 0), 0),
        GREATEST(COALESCE(p_missing_relational_count, 0), 0),
        GREATEST(COALESCE(p_stale_jsonb_count, 0), 0),
        COALESCE(p_dry_run, true),
        COALESCE(p_applied, false),
        COALESCE(p_sample, '[]'::jsonb),
        p_notes
    )
    RETURNING * INTO v_report;

    RETURN v_report;
END;
$$;

CREATE OR REPLACE FUNCTION public.report_orders_items_reconciliation(
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
    WITH order_counts AS (
        SELECT
            orders.id,
            orders.order_number,
            CASE
                WHEN jsonb_typeof(orders.items) = 'array' THEN jsonb_array_length(orders.items)
                ELSE 0
            END AS jsonb_count,
            count(order_items.id)::integer AS relational_count
        FROM public.orders
        LEFT JOIN public.order_items
          ON order_items.order_id = orders.id
         AND order_items.deleted_at IS NULL
        WHERE orders.deleted_at IS NULL
        GROUP BY orders.id, orders.order_number, orders.items
    ),
    divergent AS (
        SELECT *
          FROM order_counts
         WHERE jsonb_count <> relational_count
    )
    SELECT
        count(*)::integer,
        count(*) FILTER (WHERE jsonb_count > 0 AND relational_count = 0)::integer,
        count(*) FILTER (WHERE relational_count > 0 AND jsonb_count <> relational_count)::integer
      INTO v_divergent_count, v_missing_relational_count, v_stale_jsonb_count
      FROM divergent;

    WITH order_counts AS (
        SELECT
            orders.id,
            orders.order_number,
            CASE
                WHEN jsonb_typeof(orders.items) = 'array' THEN jsonb_array_length(orders.items)
                ELSE 0
            END AS jsonb_count,
            count(order_items.id)::integer AS relational_count
        FROM public.orders
        LEFT JOIN public.order_items
          ON order_items.order_id = orders.id
         AND order_items.deleted_at IS NULL
        WHERE orders.deleted_at IS NULL
        GROUP BY orders.id, orders.order_number, orders.items
    ),
    divergent AS (
        SELECT *
          FROM order_counts
         WHERE jsonb_count <> relational_count
    )
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'order_id', id,
        'order_number', order_number,
        'jsonb_count', jsonb_count,
        'relational_count', relational_count
    ) ORDER BY order_number) FILTER (WHERE id IS NOT NULL), '[]'::jsonb)
      INTO v_sample
      FROM (
        SELECT *
          FROM divergent
         ORDER BY order_number
         LIMIT LEAST(GREATEST(COALESCE(p_sample_limit, 25), 1), 100)
      ) sample_rows;

    v_status := CASE WHEN v_divergent_count = 0 THEN 'clean' ELSE 'divergent' END;

    v_report := public.record_dual_model_reconciliation_report(
        'orders_items',
        'orders.items',
        'order_items',
        'report',
        v_status,
        v_divergent_count,
        v_missing_relational_count,
        v_stale_jsonb_count,
        true,
        false,
        v_sample,
        'Dry-run report. order_items is authoritative after reader cutover; use reconcile_orders_items_dual_model(false) only in an approved staging/prod data window.'
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

CREATE OR REPLACE FUNCTION public.backfill_order_items_from_jsonb(
    p_limit integer DEFAULT 500
) RETURNS integer
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_rows integer := 0;
BEGIN
    WITH target_orders AS (
        SELECT orders.id, orders.items
          FROM public.orders
         WHERE orders.deleted_at IS NULL
           AND jsonb_typeof(orders.items) = 'array'
           AND jsonb_array_length(orders.items) > 0
           AND NOT EXISTS (
                SELECT 1
                  FROM public.order_items
                 WHERE order_items.order_id = orders.id
                   AND order_items.deleted_at IS NULL
           )
         ORDER BY orders.created_at ASC
         LIMIT LEAST(GREATEST(COALESCE(p_limit, 500), 1), 5000)
    ),
    inserted AS (
        INSERT INTO public.order_items (
            order_id,
            product_id,
            variant_id,
            name,
            title,
            sku,
            quantity,
            price,
            unit_price,
            total,
            product_snapshot,
            created_at,
            updated_at
        )
        SELECT
            target_orders.id,
            CASE
                WHEN legacy_item.value->>'product_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                    THEN (legacy_item.value->>'product_id')::uuid
                ELSE NULL
            END,
            NULLIF(legacy_item.value->>'variant_id', ''),
            COALESCE(NULLIF(legacy_item.value->>'name', ''), NULLIF(legacy_item.value->>'title', ''), 'Item'),
            COALESCE(NULLIF(legacy_item.value->>'title', ''), NULLIF(legacy_item.value->>'name', ''), 'Item'),
            NULLIF(legacy_item.value->>'sku', ''),
            GREATEST(COALESCE(NULLIF(legacy_item.value->>'quantity', '')::integer, 1), 1),
            COALESCE(NULLIF(legacy_item.value->>'price', '')::numeric, NULLIF(legacy_item.value->>'unit_price', '')::numeric, 0),
            COALESCE(NULLIF(legacy_item.value->>'unit_price', '')::numeric, NULLIF(legacy_item.value->>'price', '')::numeric, 0),
            COALESCE(NULLIF(legacy_item.value->>'total', '')::numeric, COALESCE(NULLIF(legacy_item.value->>'price', '')::numeric, NULLIF(legacy_item.value->>'unit_price', '')::numeric, 0) * GREATEST(COALESCE(NULLIF(legacy_item.value->>'quantity', '')::integer, 1), 1)),
            CASE
                WHEN jsonb_typeof(legacy_item.value->'product_snapshot') = 'object' THEN legacy_item.value->'product_snapshot'
                ELSE '{}'::jsonb
            END,
            now(),
            now()
          FROM target_orders
          CROSS JOIN LATERAL jsonb_array_elements(target_orders.items) WITH ORDINALITY AS legacy_item(value, ordinal)
        RETURNING 1
    )
    SELECT count(*)::integer INTO v_rows FROM inserted;

    RETURN COALESCE(v_rows, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_orders_items_jsonb_cache(
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
            order_items.order_id,
            jsonb_agg(jsonb_build_object(
                'id', order_items.id,
                'product_id', order_items.product_id,
                'variant_id', order_items.variant_id,
                'name', order_items.name,
                'title', COALESCE(order_items.title, order_items.name),
                'sku', order_items.sku,
                'quantity', order_items.quantity,
                'price', order_items.price,
                'unit_price', COALESCE(order_items.unit_price, order_items.price),
                'total', order_items.total,
                'variant_title', order_items.variant_title,
                'product_snapshot', order_items.product_snapshot
            ) ORDER BY order_items.created_at ASC) AS items_jsonb
          FROM public.order_items
         WHERE order_items.deleted_at IS NULL
         GROUP BY order_items.order_id
         ORDER BY min(order_items.created_at) ASC
         LIMIT LEAST(GREATEST(COALESCE(p_limit, 500), 1), 5000)
    ),
    updated AS (
        UPDATE public.orders
           SET items = relational_payloads.items_jsonb,
               updated_at = now()
          FROM relational_payloads
         WHERE orders.id = relational_payloads.order_id
           AND orders.items IS DISTINCT FROM relational_payloads.items_jsonb
         RETURNING orders.id
    )
    SELECT count(*)::integer INTO v_rows FROM updated;

    RETURN COALESCE(v_rows, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.reconcile_orders_items_dual_model(
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
    v_before := public.report_orders_items_reconciliation(25);

    IF NOT COALESCE(p_dry_run, true) THEN
        v_inserted := public.backfill_order_items_from_jsonb(p_limit);
        v_cache_updates := public.refresh_orders_items_jsonb_cache(p_limit);
    END IF;

    v_after := public.report_orders_items_reconciliation(25);

    v_report := public.record_dual_model_reconciliation_report(
        'orders_items',
        'orders.items',
        'order_items',
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
            'inserted_order_items', v_inserted,
            'refreshed_order_jsonb_rows', v_cache_updates
        )::text
    );

    RETURN jsonb_build_object(
        'report_id', v_report.id,
        'dry_run', COALESCE(p_dry_run, true),
        'inserted_order_items', v_inserted,
        'refreshed_order_jsonb_rows', v_cache_updates,
        'before', v_before,
        'after', v_after
    );
END;
$$;

SELECT public.report_orders_items_reconciliation(25);
