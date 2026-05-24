-- Verification for 036_shipping_tax_runtime_alignment.sql

SELECT
    'shipping_zones runtime columns' AS check_name,
    COUNT(*) AS present_columns
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'shipping_zones'
  AND column_name IN ('updated_at', 'deleted_at', 'created_by', 'updated_by', 'zip_codes');

SELECT
    'shipping_rates runtime columns' AS check_name,
    COUNT(*) AS present_columns
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'shipping_rates'
  AND column_name IN (
      'description',
      'max_order_amount',
      'min_weight_grams',
      'max_weight_grams',
      'is_active',
      'updated_at',
      'deleted_at',
      'created_by',
      'updated_by'
  );

SELECT
    'shipping runtime indexes' AS check_name,
    COUNT(*) AS present_indexes
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN ('idx_shipping_zones_store_active', 'idx_shipping_rates_zone_active');
