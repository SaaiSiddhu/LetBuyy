-- I5 — Zero-rake invariant
-- Platform commission = 0 bps everywhere.
-- AI-credit purchases are distinctly accounted product revenue, not commission.
-- capture and refund source_types must never post to platform_revenue.
-- Run: psql $SUPABASE_DB_URL -f i5-zero-rake.sql

-- 1. Core check: no capture/refund events touch platform_revenue
SELECT
  t.id AS transaction_id,
  t.site_id,
  t.source_type,
  t.source_id,
  e.amount_minor,
  e.memo
FROM public.ledger_transactions t
JOIN public.ledger_entries e ON e.transaction_id = t.id AND e.deleted_at IS NULL
JOIN public.ledger_accounts a ON a.id = e.account_id AND a.deleted_at IS NULL
WHERE t.deleted_at IS NULL
  AND a.account_code = 'platform_revenue'
  AND t.source_type IN ('payment_capture', 'refund', 'cod_remittance')
ORDER BY t.created_at;
-- Expected: 0 rows

-- 2. AI-credit revenue entries are expected and should be settlement source_type
SELECT
  t.id AS transaction_id,
  t.source_type,
  t.source_id,
  t.metadata ->> 'context' AS context,
  e.amount_minor
FROM public.ledger_transactions t
JOIN public.ledger_entries e ON e.transaction_id = t.id AND e.deleted_at IS NULL
JOIN public.ledger_accounts a ON a.id = e.account_id AND a.deleted_at IS NULL
WHERE t.deleted_at IS NULL
  AND a.account_code = 'platform_revenue'
  AND t.source_type = 'settlement'
ORDER BY t.created_at DESC
LIMIT 20;
-- These are legitimate AI-credit revenue entries; review context field

-- 3. commission_bps column check (belt-and-suspenders)
SELECT
  COUNT(*) AS non_zero_commission_count
FROM public.payment_credentials
WHERE commission_bps IS NOT NULL
  AND commission_bps <> 0
  AND deleted_at IS NULL;
-- Expected: 0
