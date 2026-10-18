-- Forward recovery is preferred. A reserved reference is never rewound, even
-- when its enclosing order transaction rolled back and left an intentional gap.
BEGIN;
LOCK TABLE public.orders IN SHARE ROW EXCLUSIVE MODE;
DO $guard$ DECLARE p pg_catalog.pg_proc;BEGIN
 IF EXISTS(SELECT 1 FROM public.order_reference_number_v1 WHERE is_called) THEN
  RAISE EXCEPTION 'rollback337 refuses allocated order references; use a reviewed forward repair'; END IF;
 SELECT * INTO p FROM pg_catalog.pg_proc WHERE oid=pg_catalog.to_regprocedure('public.generate_order_number()');
 IF p.oid IS NULL OR p.prokind<>'f' OR p.prorettype<>'trigger'::regtype OR p.proretset OR p.pronargs<>0
  OR(SELECT count(*)FROM pg_catalog.pg_proc q WHERE q.pronamespace=p.pronamespace AND q.proname=p.proname)<>1
  OR(SELECT count(*)FROM pg_catalog.pg_trigger WHERE tgrelid='public.orders'::regclass AND tgname='set_order_number'AND tgfoid=p.oid AND tgtype=7 AND tgenabled='O' AND NOT tgisinternal)<>1 THEN
  RAISE EXCEPTION 'rollback337 refuses changed reference trigger ABI'; END IF;
END $guard$;
CREATE OR REPLACE FUNCTION public.generate_order_number() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER RESET ALL AS $$
BEGIN
    NEW.order_number = 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' ||
                       LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
    RETURN NEW;
END;
$$;
DROP SEQUENCE public.order_reference_number_v1;
COMMIT;
