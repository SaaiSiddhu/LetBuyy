-- Rollback for 211_expire_unpaid_committed_reservations.sql
DROP FUNCTION IF EXISTS public.expire_unpaid_committed_reservations(integer, integer, text);
