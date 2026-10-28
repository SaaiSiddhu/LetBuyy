-- Retain schema after use; reverting application code cannot erase the binding
-- needed by in-flight refunds. Empty-history DOWN/up is reversible.
DO $guard$ BEGIN
 IF EXISTS(SELECT 1 FROM public.payment_attempts WHERE attempt_type='refund' AND credential_id IS NOT NULL) THEN
  RAISE EXCEPTION '409 rollback requires retaining refund credential binding history'; END IF;
END $guard$;
DROP TRIGGER refund_attempt_credential_v1 ON public.payment_attempts;
DROP FUNCTION public.bind_refund_attempt_credential_v1();
NOTIFY pgrst,'reload schema';
