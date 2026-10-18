-- Drops only the atomic buyer support intake function introduced by migration 287.
DROP FUNCTION IF EXISTS public.open_buyer_support_ticket_with_complaint(text, timestamptz, timestamptz, uuid, uuid, text, text);
