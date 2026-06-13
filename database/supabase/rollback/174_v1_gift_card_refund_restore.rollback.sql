-- Rollback for 174_v1_gift_card_refund_restore.sql
-- Drops the gift-card refund-restore function. Any refund_credit ledger entries already
-- written remain (they are valid balance restorations); rolling back only removes the
-- helper, reverting to the prior behavior where refunds do not restore gift-card balance.

DROP FUNCTION IF EXISTS public.restore_gift_card_on_refund(uuid, uuid, uuid, text);
