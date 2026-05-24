-- Verification for 038_form_submissions_runtime_alignment.sql

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'form_submissions'
  AND column_name IN ('full_name', 'email', 'phone', 'subject', 'message', 'source')
ORDER BY column_name;

SELECT conname
FROM pg_constraint
WHERE conrelid = 'public.form_submissions'::regclass
  AND conname = 'form_submissions_status_check';

SELECT indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'form_submissions'
  AND indexname = 'idx_form_submissions_store_type_status_active';
