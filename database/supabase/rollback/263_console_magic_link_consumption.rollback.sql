-- Rollback for 263_console_magic_link_consumption.sql
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.console_magic_link_consumptions FROM service_role;
DROP INDEX IF EXISTS public.console_magic_link_consumptions_expires_at_idx;
DROP TABLE IF EXISTS public.console_magic_link_consumptions;
