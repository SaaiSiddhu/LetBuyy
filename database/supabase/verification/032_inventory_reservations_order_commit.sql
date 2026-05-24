-- Verification harness for migration 032_inventory_reservations_order_commit.sql.
-- Run after applying migration 032. It raises exceptions on missing inventory
-- reservation infrastructure or unsafe direct execution grants.

DO $$
DECLARE
    required_table TEXT;
    required_tables TEXT[] := ARRAY[
        'inventory_reservations',
        'inventory_level_duplicate_snapshots'
    ];
    required_index TEXT;
    required_indexes TEXT[] := ARRAY[
        'idx_inventory_levels_default_variant_unique',
        'idx_inventory_levels_variant_unique'
    ];
    duplicate_level_count INTEGER;
    orphan_reservation_count INTEGER;
BEGIN
    FOREACH required_table IN ARRAY required_tables
    LOOP
        IF NOT EXISTS (
            SELECT 1
              FROM information_schema.tables
             WHERE table_schema = 'public'
               AND table_name = required_table
        ) THEN
            RAISE EXCEPTION 'Required migration 032 table missing: %', required_table;
        END IF;
    END LOOP;

    IF NOT EXISTS (
        SELECT 1
          FROM information_schema.routines
         WHERE routine_schema = 'public'
           AND routine_name = 'create_order_with_inventory_reservations'
    ) THEN
        RAISE EXCEPTION 'create_order_with_inventory_reservations function is missing';
    END IF;

    IF NOT EXISTS (
        SELECT 1
          FROM information_schema.routines
         WHERE routine_schema = 'public'
           AND routine_name = 'release_order_inventory'
    ) THEN
        RAISE EXCEPTION 'release_order_inventory function is missing';
    END IF;

    IF has_function_privilege(
        'authenticated',
        'create_order_with_inventory_reservations(uuid,text,text,text,jsonb,jsonb,text,text,text,uuid,text)',
        'EXECUTE'
    ) THEN
        RAISE EXCEPTION 'authenticated role must not execute create_order_with_inventory_reservations directly';
    END IF;

    IF has_function_privilege(
        'authenticated',
        'release_order_inventory(uuid,uuid,text,text)',
        'EXECUTE'
    ) THEN
        RAISE EXCEPTION 'authenticated role must not execute release_order_inventory directly';
    END IF;

    FOREACH required_index IN ARRAY required_indexes
    LOOP
        IF NOT EXISTS (
            SELECT 1
              FROM pg_indexes
             WHERE schemaname = 'public'
               AND indexname = required_index
        ) THEN
            RAISE EXCEPTION 'Required migration 032 inventory uniqueness index missing: %', required_index;
        END IF;
    END LOOP;

    IF NOT EXISTS (
        SELECT 1
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public'
           AND c.relname = 'inventory_reservations'
           AND c.relrowsecurity = TRUE
    ) THEN
        RAISE EXCEPTION 'inventory_reservations must have RLS enabled';
    END IF;

    SELECT COUNT(*)
      INTO duplicate_level_count
      FROM (
          SELECT product_id, variant_id, location_id
            FROM inventory_levels
           GROUP BY product_id, variant_id, location_id
          HAVING COUNT(*) > 1
      ) duplicates;

    IF duplicate_level_count > 0 THEN
        RAISE EXCEPTION 'Duplicate inventory level rows remain for % product/variant/location groups', duplicate_level_count;
    END IF;

    SELECT COUNT(*)
      INTO orphan_reservation_count
      FROM inventory_reservations ir
      LEFT JOIN inventory_locations il ON il.id = ir.location_id
      LEFT JOIN products p ON p.id = ir.product_id
     WHERE ir.deleted_at IS NULL
       AND (
           il.id IS NULL
           OR p.id IS NULL
           OR il.store_id <> ir.store_id
           OR p.store_id <> ir.store_id
       );

    IF orphan_reservation_count > 0 THEN
        RAISE EXCEPTION 'Inventory reservations with invalid store/product/location ownership detected: %', orphan_reservation_count;
    END IF;
END $$;
