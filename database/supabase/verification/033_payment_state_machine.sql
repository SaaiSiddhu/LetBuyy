-- Verification harness for migration 033_payment_state_machine.sql.
-- Run after applying migration 033. It raises exceptions on unsafe payment RPC grants.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM information_schema.routines
         WHERE routine_schema = 'public'
           AND routine_name = 'attach_order_payment_reference'
    ) THEN
        RAISE EXCEPTION 'attach_order_payment_reference function is missing';
    END IF;

    IF NOT EXISTS (
        SELECT 1
          FROM information_schema.routines
         WHERE routine_schema = 'public'
           AND routine_name = 'confirm_order_payment'
    ) THEN
        RAISE EXCEPTION 'confirm_order_payment function is missing';
    END IF;

    IF has_function_privilege(
        'authenticated',
        'attach_order_payment_reference(uuid,text,text,text)',
        'EXECUTE'
    ) THEN
        RAISE EXCEPTION 'authenticated role must not execute attach_order_payment_reference directly';
    END IF;

    IF has_function_privilege(
        'authenticated',
        'confirm_order_payment(uuid,text,text,text,text,text)',
        'EXECUTE'
    ) THEN
        RAISE EXCEPTION 'authenticated role must not execute confirm_order_payment directly';
    END IF;

    IF NOT EXISTS (
        SELECT 1
          FROM information_schema.tables
         WHERE table_schema = 'public'
           AND table_name = 'payment_webhook_events'
    ) THEN
        RAISE EXCEPTION 'payment_webhook_events table is missing';
    END IF;

    IF NOT EXISTS (
        SELECT 1
          FROM information_schema.tables
         WHERE table_schema = 'public'
           AND table_name = 'outbox_events'
    ) THEN
        RAISE EXCEPTION 'outbox_events table is missing';
    END IF;

    IF NOT EXISTS (
        SELECT 1
          FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'orders'
           AND column_name = 'currency'
    ) THEN
        RAISE EXCEPTION 'orders.currency is missing';
    END IF;
END $$;
