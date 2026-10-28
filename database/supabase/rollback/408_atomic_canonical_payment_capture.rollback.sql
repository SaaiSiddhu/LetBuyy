-- Code rollback must refuse new canonical captures when this RPC is absent.
-- Captured payment/attempt/outbox/receipt and append-only ledger history survive.
DROP FUNCTION public.commit_canonical_payment_capture_v1(uuid,uuid,uuid,text,uuid,uuid,text,text,bigint,text,text,jsonb);
NOTIFY pgrst,'reload schema';
