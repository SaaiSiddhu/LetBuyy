-- Verification harness for migration 034_inventory_level_runtime.sql.
-- Run after applying migration 034. It raises exceptions on missing or unsafe
-- inventory runtime RPCs.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM information_schema.routines
         WHERE routine_schema = 'public'
           AND routine_name = 'ensure_default_inventory_location'
    ) THEN
        RAISE EXCEPTION 'ensure_default_inventory_location function is missing';
    END IF;

    IF NOT EXISTS (
        SELECT 1
          FROM information_schema.routines
         WHERE routine_schema = 'public'
           AND routine_name = 'set_inventory_level_available'
    ) THEN
        RAISE EXCEPTION 'set_inventory_level_available function is missing';
    END IF;

    IF NOT EXISTS (
        SELECT 1
          FROM information_schema.routines
         WHERE routine_schema = 'public'
           AND routine_name = 'adjust_inventory_level'
    ) THEN
        RAISE EXCEPTION 'adjust_inventory_level function is missing';
    END IF;

    IF has_function_privilege(
        'authenticated',
        'set_inventory_level_available(uuid,uuid,uuid,integer,uuid,text,text,text)',
        'EXECUTE'
    ) THEN
        RAISE EXCEPTION 'authenticated role must not execute set_inventory_level_available directly';
    END IF;

    IF has_function_privilege(
        'authenticated',
        'adjust_inventory_level(uuid,uuid,uuid,integer,uuid,text,text,text)',
        'EXECUTE'
    ) THEN
        RAISE EXCEPTION 'authenticated role must not execute adjust_inventory_level directly';
    END IF;
END $$;
