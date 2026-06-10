-- Rollback restores the historical default only; rows already zeroed by the
-- forward migration remain explicit business data and must be changed by an
-- operator-approved corrective migration if the Constitution is amended.

ALTER TABLE public.commission_schedules
  ALTER COLUMN commission_bps SET DEFAULT 300;

ALTER TABLE public.commission_reconciliation_entries
  ALTER COLUMN commission_bps SET DEFAULT 300;
