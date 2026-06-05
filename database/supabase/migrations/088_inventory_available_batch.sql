-- P2-7 variant update performance.
-- 079-083 remain reserved for Phase 5 partition migrations; 085-086 remain reserved for reconciliation migrations; 087 remains reserved for Phase 6 theme template drafts.

CREATE OR REPLACE FUNCTION public.set_inventory_levels_available_batch(
    p_levels jsonb,
    p_actor_id uuid DEFAULT NULL::uuid,
    p_reason text DEFAULT 'adjustment'::text,
    p_notes text DEFAULT NULL::text,
    p_request_id text DEFAULT NULL::text
) RETURNS jsonb
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_level jsonb;
    v_result jsonb;
    v_results jsonb := '[]'::jsonb;
BEGIN
    IF p_levels IS NULL OR jsonb_typeof(p_levels) <> 'array' THEN
        RAISE EXCEPTION 'p_levels must be a jsonb array';
    END IF;

    IF jsonb_array_length(p_levels) > 1000 THEN
        RAISE EXCEPTION 'inventory batch cannot exceed 1000 levels';
    END IF;

    FOR v_level IN SELECT value FROM jsonb_array_elements(p_levels)
    LOOP
        IF v_level->>'product_id' IS NULL THEN
            RAISE EXCEPTION 'inventory batch level missing product_id';
        END IF;

        IF v_level->>'available' IS NULL THEN
            RAISE EXCEPTION 'inventory batch level missing available';
        END IF;

        v_result := public.set_inventory_level_available(
            (v_level->>'product_id')::uuid,
            NULLIF(v_level->>'variant_id', '')::uuid,
            NULLIF(v_level->>'location_id', '')::uuid,
            (v_level->>'available')::integer,
            p_actor_id,
            p_reason,
            COALESCE(NULLIF(v_level->>'notes', ''), p_notes),
            COALESCE(NULLIF(v_level->>'request_id', ''), p_request_id)
        );

        v_results := v_results || jsonb_build_array(v_result);
    END LOOP;

    RETURN v_results;
END;
$$;
