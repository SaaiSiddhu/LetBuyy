-- Retain private recovery/audit history; never reopen a consumed capability.
BEGIN;
DROP FUNCTION public.complete_merchant_password_reset(text,text);
UPDATE public.sessions SET revoked_at=coalesce(revoked_at,clock_timestamp()),revoked_reason=coalesce(revoked_reason,'buyer_connection_rollback')
 WHERE id IN(SELECT merchant_session_id FROM public.merchant_buyer_connection_intents WHERE consumed_at IS NULL);
UPDATE public.merchant_buyer_connection_intents SET consumed_at=clock_timestamp(),outcome='cancelled' WHERE consumed_at IS NULL;
DROP FUNCTION public.start_merchant_buyer_connection(uuid,text,text);
DROP FUNCTION public.consume_merchant_buyer_connection(uuid,text,text,text,boolean,boolean);
ALTER INDEX public.merchant_buyer_connection_recent_idx RENAME TO merchant_buyer_connection_recent_399_archive_idx;
ALTER INDEX public.merchant_buyer_connection_expiry_idx RENAME TO merchant_buyer_connection_expiry_399_archive_idx;
ALTER TABLE public.merchant_buyer_connection_intents RENAME CONSTRAINT merchant_buyer_connection_intents_pkey TO merchant_buyer_connection_399_archive_pkey;
ALTER TABLE public.merchant_buyer_connection_intents RENAME TO merchant_buyer_connection_intents_399_archive;
REVOKE ALL ON public.merchant_buyer_connection_intents_399_archive FROM PUBLIC,anon,authenticated,app_tenant,service_role;
COMMIT;
