-- I4 — Merchant conservation invariant
-- merchant_payable balance = Σ(captures) − Σ(refunds) − Σ(payout releases) per merchant,
-- derivable from ledger alone. Must match reconciliation record.
-- Run: psql $SUPABASE_DB_URL -f i4-merchant-conservation.sql

SELECT
  s.id AS site_id,
  s.name AS site_name,

  -- Ledger-derived balance via canonical balance function
  public.ledger_account_balance_minor(s.id, 'merchant_payable') AS ledger_balance_minor,

  -- Reconciliation record for comparison
  r.wallet_available_minor AS reconciliation_wallet_balance_minor,
  r.ledger_merchant_payable_minor AS reconciliation_ledger_balance_minor,
  r.variance_minor,
  r.status AS reconciliation_status,
  r.verified_at,

  -- Breakdown from ledger entries (self-contained proof)
  SUM(CASE WHEN lt.source_type = 'payment_capture'
           AND la.account_code = 'merchant_payable'
           AND le.side = 'credit'
       THEN le.amount_minor ELSE 0 END) AS total_captures_minor,
  SUM(CASE WHEN lt.source_type = 'refund'
           AND la.account_code = 'merchant_payable'
           AND le.side = 'debit'
       THEN le.amount_minor ELSE 0 END) AS total_refunds_minor,
  SUM(CASE WHEN lt.source_type = 'payout'
           AND la.account_code = 'merchant_payable'
           AND le.side = 'debit'
       THEN le.amount_minor ELSE 0 END) AS total_payout_releases_minor

FROM public.sites s
LEFT JOIN public.money_ledger_site_reconciliations r
  ON r.site_id = s.id AND r.deleted_at IS NULL
LEFT JOIN public.ledger_transactions lt
  ON lt.site_id = s.id AND lt.deleted_at IS NULL
LEFT JOIN public.ledger_entries le
  ON le.transaction_id = lt.id AND le.deleted_at IS NULL
LEFT JOIN public.ledger_accounts la
  ON la.id = le.account_id AND la.deleted_at IS NULL
WHERE s.deleted_at IS NULL
  AND EXISTS (
    SELECT 1 FROM public.ledger_transactions x
    WHERE x.site_id = s.id AND x.deleted_at IS NULL
  )
GROUP BY s.id, s.name, r.wallet_available_minor, r.ledger_merchant_payable_minor,
         r.variance_minor, r.status, r.verified_at
HAVING
  -- Flag any site where ledger balance ≠ (captures − refunds − payouts)
  public.ledger_account_balance_minor(s.id, 'merchant_payable') IS DISTINCT FROM (
    SUM(CASE WHEN lt.source_type = 'payment_capture' AND la.account_code = 'merchant_payable' AND le.side = 'credit' THEN le.amount_minor ELSE 0 END)
    - SUM(CASE WHEN lt.source_type = 'refund' AND la.account_code = 'merchant_payable' AND le.side = 'debit' THEN le.amount_minor ELSE 0 END)
    - SUM(CASE WHEN lt.source_type = 'payout' AND la.account_code = 'merchant_payable' AND le.side = 'debit' THEN le.amount_minor ELSE 0 END)
  )
ORDER BY s.id;
-- Expected: 0 rows

-- Summary view: all active merchants with balances
SELECT
  s.id AS site_id,
  s.name,
  public.ledger_account_balance_minor(s.id, 'merchant_payable') AS payable_minor,
  r.status,
  r.variance_minor,
  r.verified_at
FROM public.sites s
LEFT JOIN public.money_ledger_site_reconciliations r ON r.site_id = s.id AND r.deleted_at IS NULL
WHERE s.deleted_at IS NULL
  AND EXISTS (SELECT 1 FROM public.ledger_transactions lt WHERE lt.site_id = s.id AND lt.deleted_at IS NULL)
ORDER BY s.name;
