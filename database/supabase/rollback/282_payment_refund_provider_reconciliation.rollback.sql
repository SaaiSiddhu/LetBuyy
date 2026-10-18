-- Paired rollback for 282_payment_refund_provider_reconciliation.sql.
-- This removes only the function and indexes introduced by that migration.

REVOKE ALL ON FUNCTION public.reconcile_payment_refund_attempt(uuid, uuid, text, text, text, text, bigint, text, text) FROM PUBLIC, anon, authenticated, service_role;
DROP FUNCTION IF EXISTS public.reconcile_payment_refund_attempt(uuid, uuid, text, text, text, text, bigint, text, text);
REVOKE ALL ON FUNCTION public.finalize_manual_payment_refund_attempt(uuid, uuid, text, bigint, text, text, uuid) FROM PUBLIC, anon, authenticated, service_role;
DROP FUNCTION IF EXISTS public.finalize_manual_payment_refund_attempt(uuid, uuid, text, bigint, text, text, uuid);
REVOKE ALL ON FUNCTION public.resolve_payment_for_refund_provider_event(text, text) FROM PUBLIC, anon, authenticated, service_role;
DROP FUNCTION IF EXISTS public.resolve_payment_for_refund_provider_event(text, text);
REVOKE ALL ON FUNCTION public.load_owned_payment_session(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
DROP FUNCTION IF EXISTS public.load_owned_payment_session(uuid, uuid, uuid);
REVOKE ALL ON FUNCTION public.reserve_payment_refund_attempt(uuid, bigint, text, text, uuid, jsonb) FROM PUBLIC, anon, authenticated, service_role;
DROP FUNCTION IF EXISTS public.reserve_payment_refund_attempt(uuid, bigint, text, text, uuid, jsonb);
DROP INDEX IF EXISTS public.payment_attempts_provider_refund_id_idx;
DROP INDEX IF EXISTS public.payment_attempts_refund_idempotency_idx;
