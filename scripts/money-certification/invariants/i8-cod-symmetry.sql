-- I8 — COD symmetry invariant
-- COD remittance follows the same capture→ledger path with carrier-remittance as the provider leg.
-- Each cod_remittance transaction must post: cod_receivable (debit) → merchant_payable (credit).
-- Run: psql $SUPABASE_DB_URL -f i8-cod-symmetry.sql

-- 1. Verify COD remittance entry pattern matches the capture pattern
SELECT
  t.id AS transaction_id,
  t.site_id,
  t.source_id,
  t.idempotency_key,
  -- Account codes used in this transaction
  array_agg(a.account_code ORDER BY e.sequence) AS account_codes,
  array_agg(e.side ORDER BY e.sequence) AS sides,
  array_agg(e.amount_minor ORDER BY e.sequence) AS amounts_minor
FROM public.ledger_transactions t
JOIN public.ledger_entries e ON e.transaction_id = t.id AND e.deleted_at IS NULL
JOIN public.ledger_accounts a ON a.id = e.account_id AND a.deleted_at IS NULL
WHERE t.deleted_at IS NULL
  AND t.source_type = 'cod_remittance'
ORDER BY t.created_at;

-- 2. Check any COD transactions that DON'T follow the expected pattern
-- (cod_receivable debit + merchant_payable credit)
SELECT
  t.id AS transaction_id,
  t.source_id,
  'unexpected pattern' AS issue,
  array_agg(a.account_code || ':' || e.side ORDER BY e.sequence) AS actual_pattern
FROM public.ledger_transactions t
JOIN public.ledger_entries e ON e.transaction_id = t.id AND e.deleted_at IS NULL
JOIN public.ledger_accounts a ON a.id = e.account_id AND a.deleted_at IS NULL
WHERE t.deleted_at IS NULL
  AND t.source_type = 'cod_remittance'
GROUP BY t.id, t.source_id
HAVING NOT (
  -- Expected: exactly [cod_receivable:debit, merchant_payable:credit] (or cod variant with 2 entries)
  array_agg(a.account_code ORDER BY e.sequence) @> ARRAY['merchant_payable']
  AND array_agg(a.account_code ORDER BY e.sequence) @> ARRAY['cod_receivable', 'pa_clearing']::text[]
  OR
  array_agg(a.account_code || ':' || e.side ORDER BY e.sequence) = ARRAY['cod_receivable:debit','merchant_payable:credit']
)
ORDER BY t.created_at;
-- Expected: 0 rows

-- 3. COD reconciliation summary — verify cod_reconciliation_entries are linked to ledger transactions
SELECT
  cre.id AS cod_entry_id,
  cre.site_id,
  cre.order_id,
  cre.status,
  cre.amount,
  cre.metadata -> 'canonical_ledger_transaction_id' AS ledger_txn_id
FROM public.cod_reconciliation_entries cre
WHERE cre.deleted_at IS NULL
  AND cre.status = 'remitted'
  AND cre.metadata -> 'canonical_ledger_transaction_id' IS NULL
ORDER BY cre.created_at DESC
LIMIT 20;
-- Expected: 0 rows (all remitted COD entries must link to a ledger transaction)
