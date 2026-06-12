-- I1 — Double-entry balance invariant
-- Every ledger transaction must have sum(debit entries) = sum(credit entries).
-- Expected result: 0 rows. Any row indicates a broken transaction.
-- Run: psql $SUPABASE_DB_URL -f i1-double-entry.sql

SELECT
  t.id AS transaction_id,
  t.site_id,
  t.source_type,
  t.source_id,
  t.idempotency_key,
  SUM(CASE e.side WHEN 'debit'  THEN e.amount_minor ELSE 0 END) AS total_debits_minor,
  SUM(CASE e.side WHEN 'credit' THEN e.amount_minor ELSE 0 END) AS total_credits_minor,
  SUM(CASE e.side WHEN 'debit'  THEN e.amount_minor ELSE 0 END)
    - SUM(CASE e.side WHEN 'credit' THEN e.amount_minor ELSE 0 END) AS imbalance_minor
FROM public.ledger_transactions t
JOIN public.ledger_entries e ON e.transaction_id = t.id
  AND e.deleted_at IS NULL
WHERE t.deleted_at IS NULL
GROUP BY t.id, t.site_id, t.source_type, t.source_id, t.idempotency_key
HAVING SUM(CASE e.side WHEN 'debit'  THEN e.amount_minor ELSE 0 END)
    <> SUM(CASE e.side WHEN 'credit' THEN e.amount_minor ELSE 0 END)
ORDER BY t.created_at;

-- Supplementary: verify DB-level balance function returns no breaks
SELECT * FROM public.check_ledger_balance_integrity() LIMIT 20;
