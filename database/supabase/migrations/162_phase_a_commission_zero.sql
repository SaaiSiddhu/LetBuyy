-- Phase A governance enforcement: LetBuyy transaction/GMV fee is permanently 0%.

ALTER TABLE public.commission_schedules
  ALTER COLUMN commission_bps SET DEFAULT 0;

ALTER TABLE public.commission_reconciliation_entries
  ALTER COLUMN commission_bps SET DEFAULT 0;

UPDATE public.commission_schedules
SET commission_bps = 0,
    updated_at = now()
WHERE COALESCE(commission_bps, 0) <> 0;

UPDATE public.commission_reconciliation_entries
SET commission_bps = 0,
    commission_amount_minor = 0,
    gst_amount_minor = 0,
    net_payable_minor = gross_amount_minor,
    updated_at = now()
WHERE COALESCE(commission_bps, 0) <> 0
   OR COALESCE(commission_amount_minor, 0) <> 0
   OR COALESCE(gst_amount_minor, 0) <> 0;
