-- Verification for 037_product_reviews_moderation_status.sql

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'product_reviews'
  AND column_name IN ('status', 'updated_at')
ORDER BY column_name;

SELECT indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'product_reviews'
  AND indexname = 'idx_product_reviews_store_status_created';

SELECT tgname
FROM pg_trigger
WHERE tgrelid = 'public.product_reviews'::regclass
  AND tgname = 'trg_product_reviews_moderation_status'
  AND NOT tgisinternal;
