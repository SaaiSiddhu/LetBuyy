-- Verification for 041_store_employee_runtime_alignment.sql

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'employees'
  AND column_name IN ('store_id', 'status', 'deleted_at')
ORDER BY column_name;

SELECT conname
FROM pg_constraint
WHERE conrelid = 'public.employees'::regclass
  AND conname = 'employees_role_check';

SELECT indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'employees'
  AND indexname = 'idx_employees_store_status_active';
