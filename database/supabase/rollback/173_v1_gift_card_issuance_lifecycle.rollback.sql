-- Rollback for 173_v1_gift_card_issuance_lifecycle.sql
-- Drops the gift-card issuance + lifecycle functions added in 173. The canonical
-- tables (gift_card_accounts, gift_card_ledger_entries, gift_card_redemptions) and
-- the create_checkout_order redemption path are untouched; rolling back only removes
-- the new issuance/listing/validation/fraud/audit helpers (issuance reverts to the
-- legacy public.gift_cards path). Non-destructive to any persisted gift-card data.

DROP FUNCTION IF EXISTS public.gift_card_transactions(uuid, uuid);
DROP FUNCTION IF EXISTS public.set_gift_card_status(uuid, uuid, text, text, uuid, text);
DROP FUNCTION IF EXISTS public.check_gift_card_balance(uuid, text);
DROP FUNCTION IF EXISTS public.list_gift_cards(uuid);
DROP FUNCTION IF EXISTS public.issue_gift_card(uuid, text, numeric, text, timestamp with time zone, jsonb, uuid, text, text);
DROP FUNCTION IF EXISTS public.gift_card_available_balance(uuid, uuid);
