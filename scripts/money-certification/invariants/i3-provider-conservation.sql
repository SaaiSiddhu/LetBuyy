-- I3 — Provider conservation invariant
-- For any time window: provider-captured − provider-refunded − provider-fees
-- = Σ canonical entries for that window ± explained suspense.
-- This query produces the per-site balance for comparison with provider statements.
-- Run: psql $SUPABASE_DB_URL -f i3-provider-conservation.sql
-- Pass a date range via psql variables:
--   psql ... -v window_start="'2026-06-01'" -v window_end="'2026-06-12'"
-- Or omit variables to check all-time.

-- Set defaults if variables are not supplied
\set window_start '\'1900-01-01\''
\set window_end '\'2100-01-01\''

SELECT
  t.site_id,
  SUM(CASE WHEN t.source_type = 'payment_capture'
           AND a.account_code = 'pa_clearing'
           AND e.side = 'debit'
       THEN e.amount_minor ELSE 0 END) AS provider_captured_minor,
  SUM(CASE WHEN t.source_type = 'refund'
           AND a.account_code = 'refund_clearing'
           AND e.side = 'credit'
       THEN e.amount_minor ELSE 0 END) AS provider_refunded_minor,
  SUM(CASE WHEN t.source_type = 'settlement'
           AND a.account_code = 'platform_revenue'
           AND e.side = 'credit'
       THEN e.amount_minor ELSE 0 END) AS provider_fees_minor,
  SUM(CASE WHEN t.source_type = 'payment_capture'
           AND a.account_code = 'merchant_payable'
           AND e.side = 'credit'
       THEN e.amount_minor ELSE 0 END)
  - SUM(CASE WHEN t.source_type = 'refund'
             AND a.account_code = 'merchant_payable'
             AND e.side = 'debit'
         THEN e.amount_minor ELSE 0 END)
  - SUM(CASE WHEN t.source_type = 'payout'
             AND a.account_code = 'merchant_payable'
             AND e.side = 'debit'
         THEN e.amount_minor ELSE 0 END) AS net_merchant_payable_minor
FROM public.ledger_transactions t
JOIN public.ledger_entries e ON e.transaction_id = t.id AND e.deleted_at IS NULL
JOIN public.ledger_accounts a ON a.id = e.account_id AND a.deleted_at IS NULL
WHERE t.deleted_at IS NULL
  AND t.created_at >= :window_start::timestamptz
  AND t.created_at <  :window_end::timestamptz
GROUP BY t.site_id
ORDER BY t.site_id;

-- Suspense check: any unexplained open items in reconciliation queue
SELECT
  site_id,
  status,
  variance_minor,
  verified_at,
  updated_at
FROM public.money_ledger_site_reconciliations
WHERE deleted_at IS NULL
  AND (status = 'mismatch' OR variance_minor <> 0)
ORDER BY updated_at DESC;
-- Expected: 0 rows with unexplained variance
