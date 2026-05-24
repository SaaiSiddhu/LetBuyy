-- Verification for 039_pages_runtime_alignment.sql

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'pages'
  AND column_name IN ('store_id', 'body', 'page_type', 'show_in_nav', 'deleted_at', 'published_at')
ORDER BY column_name;

SELECT indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'pages'
  AND indexname IN ('idx_pages_store_status_active', 'idx_pages_store_slug_active')
ORDER BY indexname;
