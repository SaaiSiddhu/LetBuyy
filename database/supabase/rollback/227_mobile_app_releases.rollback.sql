-- Rollback of 227: drop mobile release gating.
--
-- Destructive: every release row and force-update threshold is lost, and the platform loses its
-- only way to stop a broken shipped build without publishing a new one. Nothing else references
-- this table.

BEGIN;

DROP TABLE IF EXISTS public.mobile_app_releases;

COMMIT;
