-- Verification harness for migration 035_payment_failure_state.sql.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM information_schema.routines
         WHERE routine_schema = 'public'
           AND routine_name = 'record_order_payment_failure'
    ) THEN
        RAISE EXCEPTION 'record_order_payment_failure function is missing';
    END IF;

    IF has_function_privilege(
        'authenticated',
        'record_order_payment_failure(uuid,text,text,text,text,text,boolean,text)',
        'EXECUTE'
    ) THEN
        RAISE EXCEPTION 'authenticated role must not execute record_order_payment_failure directly';
    END IF;
END $$;
