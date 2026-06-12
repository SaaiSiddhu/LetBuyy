-- I6 — Idempotency invariant
-- Replaying any webhook/job produces zero duplicate entries (provider-reference dedupe).
-- The UNIQUE constraint (site_id, source_type, source_id, idempotency_key) enforces this structurally;
-- this query cross-checks that no duplicates slipped through (e.g. via NULL-bypass patterns).
-- Run: psql $SUPABASE_DB_URL -f i6-idempotency.sql

-- 1. Duplicate (site_id, source_type, source_id, idempotency_key) tuples — should be 0
SELECT
  site_id,
  source_type,
  source_id,
  idempotency_key,
  COUNT(*) AS duplicate_count,
  array_agg(id ORDER BY created_at) AS transaction_ids
FROM public.ledger_transactions
WHERE deleted_at IS NULL
  AND idempotency_key IS NOT NULL
GROUP BY site_id, source_type, source_id, idempotency_key
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC, source_type;
-- Expected: 0 rows

-- 2. Duplicate provider references in payment_capture events
-- (Same provider:payment_id → should resolve to exactly one ledger transaction)
SELECT
  t.source_id AS provider_reference,
  COUNT(DISTINCT t.id) AS ledger_transaction_count,
  COUNT(DISTINCT t.site_id) AS sites_affected,
  array_agg(DISTINCT t.site_id) AS site_ids
FROM public.ledger_transactions t
WHERE t.deleted_at IS NULL
  AND t.source_type = 'payment_capture'
GROUP BY t.source_id
HAVING COUNT(DISTINCT t.site_id || ':' || t.id::text) > 1
ORDER BY ledger_transaction_count DESC;
-- Expected: 0 rows; cross-site captures on the same provider ref are OK only if intentional

-- 3. Reversal integrity: every reversal_of must point to an existing transaction
SELECT
  r.id AS reversal_id,
  r.reversal_of AS original_id,
  orig.id IS NULL AS original_missing
FROM public.ledger_transactions r
LEFT JOIN public.ledger_transactions orig ON orig.id = r.reversal_of AND orig.deleted_at IS NULL
WHERE r.deleted_at IS NULL
  AND r.reversal_of IS NOT NULL
  AND orig.id IS NULL
ORDER BY r.created_at;
-- Expected: 0 rows
