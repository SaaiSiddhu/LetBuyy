-- Verification for 042_collections_gift_cards_runtime_alignment.sql

SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('collections', 'gift_cards')
  AND column_name IN ('deleted_at', 'created_by', 'updated_by')
ORDER BY table_name, column_name;

SELECT indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN ('idx_collections_store_active', 'idx_gift_cards_store_active')
ORDER BY indexname;
