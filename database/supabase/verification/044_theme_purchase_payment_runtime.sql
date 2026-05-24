-- Verification harness for migration 044_theme_purchase_payment_runtime.sql.

DO $$
DECLARE
    required_columns TEXT[] := ARRAY[
        'payment_provider',
        'provider_order_id',
        'provider_payment_id',
        'payment_signature',
        'payment_idempotency_key',
        'payment_processed_at',
        'created_at',
        'updated_at',
        'deleted_at'
    ];
    v_column_name TEXT;
BEGIN
    FOREACH v_column_name IN ARRAY required_columns LOOP
        IF NOT EXISTS (
            SELECT 1
              FROM information_schema.columns
             WHERE table_schema = 'public'
               AND table_name = 'theme_purchases'
               AND column_name = v_column_name
        ) THEN
            RAISE EXCEPTION 'theme_purchases.% column is missing', v_column_name;
        END IF;
    END LOOP;

    IF NOT EXISTS (
        SELECT 1
          FROM pg_indexes
         WHERE schemaname = 'public'
           AND tablename = 'theme_purchases'
           AND indexname = 'idx_theme_purchases_provider_order'
    ) THEN
        RAISE EXCEPTION 'idx_theme_purchases_provider_order index is missing';
    END IF;

    IF NOT EXISTS (
        SELECT 1
          FROM pg_indexes
         WHERE schemaname = 'public'
           AND tablename = 'theme_purchases'
           AND indexname = 'idx_theme_purchases_provider_payment'
    ) THEN
        RAISE EXCEPTION 'idx_theme_purchases_provider_payment index is missing';
    END IF;

    IF NOT EXISTS (
        SELECT 1
          FROM pg_indexes
         WHERE schemaname = 'public'
           AND tablename = 'theme_purchases'
           AND indexname = 'idx_theme_purchases_payment_idempotency'
    ) THEN
        RAISE EXCEPTION 'idx_theme_purchases_payment_idempotency index is missing';
    END IF;
END $$;
