-- Local rollback proof for 141_executable_inventory_reservations.sql.

DROP POLICY IF EXISTS inventory_reservations_tenant_site_guc ON public.inventory_reservations;
DROP POLICY IF EXISTS inventory_locations_tenant_site_guc ON public.inventory_locations;
DROP POLICY IF EXISTS inventory_levels_tenant_site_guc ON public.inventory_levels;

ALTER TABLE IF EXISTS public.inventory_reservations NO FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.inventory_locations NO FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.inventory_levels NO FORCE ROW LEVEL SECURITY;

DROP FUNCTION IF EXISTS public.expire_inventory_reservations(integer, text);
DROP FUNCTION IF EXISTS public.release_inventory_reservation(uuid, uuid, text, text, uuid, text);
DROP FUNCTION IF EXISTS public.commit_inventory_reservation(uuid, uuid, text, uuid, text);
DROP FUNCTION IF EXISTS public.reserve_inventory(uuid, uuid, uuid, uuid, integer, integer, text, uuid, text);
DROP FUNCTION IF EXISTS public.require_inventory_site_guc(uuid);

DROP TRIGGER IF EXISTS inventory_levels_increment_version ON public.inventory_levels;
DROP TRIGGER IF EXISTS inventory_levels_store_id_fill ON public.inventory_levels;
DROP FUNCTION IF EXISTS public.set_inventory_level_store_id();

DROP INDEX IF EXISTS public.idx_inventory_reservations_expiry_sweeper;
DROP INDEX IF EXISTS public.idx_inventory_levels_store_product_location;

ALTER TABLE IF EXISTS public.inventory_reservations
  DROP COLUMN IF EXISTS release_idempotency_key,
  DROP COLUMN IF EXISTS commit_idempotency_key;

ALTER TABLE IF EXISTS public.inventory_levels
  DROP COLUMN IF EXISTS version,
  DROP COLUMN IF EXISTS deleted_at,
  DROP COLUMN IF EXISTS created_at,
  DROP COLUMN IF EXISTS store_id;
