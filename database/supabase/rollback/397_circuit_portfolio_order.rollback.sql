-- Restore only the captured rank, preserving any later unrelated metadata edits.
DO $catalog_order_rollback$
DECLARE theme_row record; previous jsonb; remaining_config jsonb;
BEGIN
    FOR theme_row IN SELECT id,config FROM public.themes
        WHERE slug IN ('letbuyy-forge','letbuyy-sense') AND owned_by_site_id IS NULL
            AND config ? 'circuitPortfolioOrder397' ORDER BY id FOR UPDATE
    LOOP
        previous := theme_row.config->'circuitPortfolioOrder397';
        IF jsonb_typeof(previous) <> 'object' OR NOT (previous ? 'sort_order') THEN
            RAISE EXCEPTION 'Portfolio ordering rollback capture is invalid';
        END IF;
        remaining_config := theme_row.config-'circuitPortfolioOrder397';
        UPDATE public.themes SET sort_order=(previous->>'sort_order')::integer,
            config=CASE WHEN previous->>'config_was_null'='true' AND remaining_config='{}'::jsonb
                THEN NULL ELSE remaining_config END
        WHERE id=theme_row.id;
    END LOOP;
END
$catalog_order_rollback$;
