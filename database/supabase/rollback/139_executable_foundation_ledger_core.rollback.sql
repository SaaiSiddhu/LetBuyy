-- Local rollback proof for 139_executable_foundation_ledger_core.sql.
-- This file is intentionally outside replayable migrations because rollback
-- scripts may drop objects during isolated local verification.

DROP TRIGGER IF EXISTS update_outbox_consumptions_updated_at ON public.outbox_consumptions;
DROP TRIGGER IF EXISTS update_compensation_actions_updated_at ON public.compensation_actions;
DROP TRIGGER IF EXISTS ledger_entries_balance_enforced ON public.ledger_entries;
DROP TRIGGER IF EXISTS ledger_transactions_reject_delete ON public.ledger_transactions;
DROP TRIGGER IF EXISTS ledger_transactions_reject_update ON public.ledger_transactions;
DROP TRIGGER IF EXISTS ledger_entries_reject_delete ON public.ledger_entries;
DROP TRIGGER IF EXISTS ledger_entries_reject_update ON public.ledger_entries;

DROP FUNCTION IF EXISTS public.ledger_balance_breaks();
DROP FUNCTION IF EXISTS public.post_ledger_transaction(uuid, text, text, text, text, jsonb, jsonb, text);
DROP FUNCTION IF EXISTS public.ensure_ledger_account(uuid, text, text);
DROP FUNCTION IF EXISTS public.enforce_ledger_transaction_balance();
DROP FUNCTION IF EXISTS public.reject_ledger_mutation();

DROP TABLE IF EXISTS public.ledger_entries;
DROP TABLE IF EXISTS public.ledger_transactions;
DROP TABLE IF EXISTS public.ledger_accounts;
DROP TABLE IF EXISTS public.outbox_consumptions;
DROP TABLE IF EXISTS public.compensation_actions;

DROP INDEX IF EXISTS public.outbox_events_published_at_idx;
ALTER TABLE IF EXISTS public.outbox_events
  DROP COLUMN IF EXISTS published_at;

DROP FUNCTION IF EXISTS public.set_current_site_id(uuid);
DROP FUNCTION IF EXISTS public.current_site_id();
