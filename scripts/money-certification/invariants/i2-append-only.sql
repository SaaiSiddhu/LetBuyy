-- I2 — Append-only invariant
-- The ledger_entries table must reject UPDATE and DELETE via DB triggers.
-- Expected: 2 trigger rows (both enabled), 0 deleted/updated ledger entries.
-- Run: psql $SUPABASE_DB_URL -f i2-append-only.sql

-- 1. Confirm the reject triggers exist and are enabled
SELECT
  tgname AS trigger_name,
  CASE tgenabled
    WHEN 'O' THEN 'enabled (origin)'
    WHEN 'D' THEN 'DISABLED — VIOLATION'
    WHEN 'R' THEN 'replica'
    WHEN 'A' THEN 'always'
    ELSE tgenabled::text
  END AS status,
  pg_get_triggerdef(t.oid, true) AS definition
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
WHERE c.relname = 'ledger_entries'
  AND tgname IN ('ledger_entries_reject_update', 'ledger_entries_reject_delete')
ORDER BY tgname;

-- 2. Verify no entries have been soft-deleted (deleted_at set)
-- Soft-delete on ledger_entries is not the same as a hard DELETE, but we verify:
SELECT COUNT(*) AS soft_deleted_count
FROM public.ledger_entries
WHERE deleted_at IS NOT NULL;

-- 3. Cross-check entry count against transaction-line expectation:
-- Every transaction must have at least 2 entries (one debit + one credit).
SELECT
  t.id AS transaction_id,
  t.source_type,
  COUNT(e.id) AS entry_count
FROM public.ledger_transactions t
LEFT JOIN public.ledger_entries e ON e.transaction_id = t.id AND e.deleted_at IS NULL
WHERE t.deleted_at IS NULL
GROUP BY t.id, t.source_type
HAVING COUNT(e.id) < 2
ORDER BY t.created_at;
-- Expected: 0 rows
