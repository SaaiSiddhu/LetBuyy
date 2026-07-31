-- Rollback for 177_v1_founding_program_rpcs.sql
-- Drops the founding-program functions added in 177. The founding tables (176) and
-- seed (178) are untouched. Non-destructive to any persisted allocation data.

DROP FUNCTION IF EXISTS public.admin_repair_price_lock(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.reconcile_founding_program(boolean);
DROP FUNCTION IF EXISTS public.resolve_merchant_locked_price(uuid, text);
DROP FUNCTION IF EXISTS public.set_founding_program_state(boolean, boolean, text, uuid);
DROP FUNCTION IF EXISTS public.get_founding_program_public();
DROP FUNCTION IF EXISTS public.reclaim_founding_merchant(uuid, text, uuid, text, boolean);
DROP FUNCTION IF EXISTS public.allocate_founding_merchant(uuid, uuid, text, uuid, text, boolean, text);
DROP FUNCTION IF EXISTS public.emit_founding_event(uuid, text, text, jsonb, uuid);
