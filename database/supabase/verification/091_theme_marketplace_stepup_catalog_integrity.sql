-- Verification harness for 091_theme_marketplace_stepup.sql.

DO $$
DECLARE
    missing_table_count integer;
    invalid_theme_count integer;
    invalid_receipt_count integer;
BEGIN
    SELECT COUNT(*)
      INTO missing_table_count
      FROM (
          VALUES
              ('developer_profiles'),
              ('theme_collections'),
              ('theme_collection_items'),
              ('theme_saved_searches'),
              ('theme_download_artifacts'),
              ('theme_purchase_receipts'),
              ('theme_refund_requests'),
              ('theme_reports'),
              ('theme_marketplace_settings'),
              ('theme_developer_listings'),
              ('theme_developer_payout_accounts')
      ) AS required(table_name)
     WHERE NOT EXISTS (
         SELECT 1
           FROM information_schema.tables t
          WHERE t.table_schema = 'public'
            AND t.table_name = required.table_name
     );

    IF missing_table_count <> 0 THEN
        RAISE EXCEPTION 'Theme marketplace step-up tables missing: %', missing_table_count;
    END IF;

    SELECT COUNT(*)
      INTO invalid_theme_count
      FROM public.themes
     WHERE is_active = true
       AND (
           layout IS NULL
        OR download_count IS NULL
        OR purchase_count IS NULL
        OR compatibility IS NULL
        OR performance_report IS NULL
        OR accessibility_report IS NULL
        OR changelog IS NULL
       );

    IF invalid_theme_count <> 0 THEN
        RAISE EXCEPTION 'Active themes missing step-up metadata columns: %', invalid_theme_count;
    END IF;

    SELECT COUNT(*)
      INTO invalid_receipt_count
      FROM public.theme_purchase_receipts r
      JOIN public.theme_purchases p ON p.id = r.purchase_id
     WHERE p.status = 'completed'
       AND (
           COALESCE(r.receipt_number, '') = ''
        OR COALESCE(r.currency, '') <> COALESCE(p.currency, 'INR')
        OR r.amount_inr < 0
       );

    IF invalid_receipt_count <> 0 THEN
        RAISE EXCEPTION 'Invalid completed theme purchase receipt rows: %', invalid_receipt_count;
    END IF;

    PERFORM 1
      FROM pg_trigger
     WHERE tgname = 'update_theme_purchase_receipts_updated_at';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Missing theme_purchase_receipts updated_at trigger';
    END IF;
END $$;
