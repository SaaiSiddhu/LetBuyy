-- I7 — Single-writer invariant
-- Only the canonical ledger module writes money truth; projections are never written by hand.
-- writer_module must be exactly 'settlement' (enforced by CHECK constraint).
-- Run: psql $SUPABASE_DB_URL -f i7-single-writer.sql

-- 1. All distinct writer_module values — must be exactly {'settlement'}
SELECT DISTINCT writer_module, COUNT(*) AS transaction_count
FROM public.ledger_transactions
WHERE deleted_at IS NULL
GROUP BY writer_module
ORDER BY writer_module;
-- Expected: exactly one row: writer_module='settlement'

-- 2. Verify CHECK constraint is still in place
SELECT
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.ledger_transactions'::regclass
  AND conname LIKE '%writer_module%';
-- Expected: constraint enforcing writer_module = 'settlement'

-- 3. Projection tables (wallet_ledger_entries) must NOT have hand-written canonical entries
-- They should only have entries backfilled via the canonical backfill function
SELECT
  COUNT(*) AS wallet_entries_without_canonical_id
FROM public.wallet_ledger_entries
WHERE deleted_at IS NULL
  AND canonical_ledger_transaction_id IS NULL
  AND created_at > '2026-01-01';
-- Expected: 0 for any entries after the canonical ledger authority migration (migration 160)
