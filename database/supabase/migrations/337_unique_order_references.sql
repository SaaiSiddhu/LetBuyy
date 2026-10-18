-- Repeated canonical checkout failures: the existing orders BEFORE INSERT
-- trigger drew only10000 daily random values under a global UNIQUE constraint.
-- Keep that one trigger and prefix. Reserve monotonically unique suffixes in
-- this PostgreSQL database; no historical reference or GST invoice is rewritten.
BEGIN;
LOCK TABLE public.orders IN SHARE ROW EXCLUSIVE MODE;
CREATE SEQUENCE public.order_reference_number_v1 AS bigint INCREMENT BY 1 MINVALUE 10000 START WITH 10000 NO CYCLE CACHE 1;
DO $seed$ DECLARE v_start numeric;BEGIN
 SELECT greatest(10000,coalesce(max(substring(order_number FROM '^ORD-[0-9]{8}-([0-9]+)$')::numeric)+1,10000)) INTO v_start FROM public.orders;
 IF v_start>9223372036854775807 THEN RAISE EXCEPTION 'order reference history exceeds bigint capacity; review before applying337'; END IF;
 PERFORM pg_catalog.setval('public.order_reference_number_v1'::regclass,v_start::bigint,false);
END $seed$;
REVOKE ALL ON SEQUENCE public.order_reference_number_v1 FROM PUBLIC,anon,authenticated,app_tenant,service_role;
GRANT USAGE ON SEQUENCE public.order_reference_number_v1 TO app_tenant,service_role;
CREATE OR REPLACE FUNCTION public.generate_order_number() RETURNS trigger
 LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public,pg_temp AS $fn$
BEGIN
 NEW.order_number:='ORD-'||to_char(now(),'YYYYMMDD')||'-'||nextval('public.order_reference_number_v1'::regclass)::text;
 RETURN NEW;
END $fn$;
COMMIT;
