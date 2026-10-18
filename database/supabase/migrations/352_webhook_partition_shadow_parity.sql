-- 352: restore the existing positional webhook mirror after148 added two
-- source tail columns. No backfill, cutover, mirror/trigger/role change or data
-- rewrite. Exact known shapes only; compatible28/29/30-column prefixes permit
-- first application, partial compatible application and safe reapplication.
BEGIN;
SET LOCAL lock_timeout='10s';
LOCK TABLE public.webhook_deliveries,public.webhook_deliveries_partitioned IN ACCESS EXCLUSIVE MODE;
DO $parity$
DECLARE
  expected jsonb := '[[1,"id","uuid"],[2,"site_id","uuid"],[3,"subscription_id","uuid"],[4,"outbox_event_id","uuid"],[5,"event_id","uuid"],[6,"event_type","text"],[7,"target_url","text"],[8,"payload","jsonb"],[9,"status","text"],[10,"attempts","integer"],[11,"max_attempts","integer"],[12,"next_attempt_at","timestamp with time zone"],[13,"locked_at","timestamp with time zone"],[14,"locked_by","text"],[15,"delivered_at","timestamp with time zone"],[16,"failed_at","timestamp with time zone"],[17,"response_status","integer"],[18,"response_body_preview","text"],[19,"error_message","text"],[20,"request_id","text"],[21,"trace_id","text"],[22,"idempotency_key","text"],[23,"schema_version","integer"],[24,"created_by","uuid"],[25,"updated_by","uuid"],[26,"created_at","timestamp with time zone"],[27,"updated_at","timestamp with time zone"],[28,"deleted_at","timestamp with time zone"],[29,"nonce","text"],[30,"dlq_reason","text"]]'::jsonb;
  source_shape jsonb;
  shadow_shape jsonb;
  shadow_count integer;
BEGIN
  IF (SELECT relkind FROM pg_class WHERE oid='public.webhook_deliveries'::regclass) <> 'r'
     OR (SELECT relkind FROM pg_class WHERE oid='public.webhook_deliveries_partitioned'::regclass) <> 'p' THEN
    RAISE EXCEPTION 'WEBHOOK_SHADOW_UNEXPECTED_RELATION_KIND';
  END IF;
  SELECT jsonb_agg(jsonb_build_array(attnum,attname,format_type(atttypid,atttypmod)) ORDER BY attnum)
    INTO source_shape FROM pg_attribute
    WHERE attrelid='public.webhook_deliveries'::regclass AND attnum>0;
  SELECT jsonb_agg(jsonb_build_array(attnum,attname,format_type(atttypid,atttypmod)) ORDER BY attnum),count(*)
    INTO shadow_shape,shadow_count FROM pg_attribute
    WHERE attrelid='public.webhook_deliveries_partitioned'::regclass AND attnum>0;
  IF source_shape IS DISTINCT FROM expected THEN
    RAISE EXCEPTION 'WEBHOOK_SHADOW_UNEXPECTED_SOURCE_SHAPE';
  END IF;
  IF shadow_count NOT BETWEEN 28 AND 30 OR shadow_shape IS DISTINCT FROM
      (SELECT jsonb_agg(value ORDER BY ordinal) FROM jsonb_array_elements(expected) WITH ORDINALITY x(value,ordinal) WHERE ordinal<=shadow_count) THEN
    RAISE EXCEPTION 'WEBHOOK_SHADOW_UNEXPECTED_TARGET_SHAPE';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_attribute s JOIN pg_attribute d ON d.attnum=s.attnum
    WHERE s.attrelid='public.webhook_deliveries'::regclass
      AND d.attrelid='public.webhook_deliveries_partitioned'::regclass AND s.attnum>0
      AND (s.attisdropped OR d.attisdropped OR s.attcollation<>d.attcollation
        OR s.attgenerated<>d.attgenerated OR s.attidentity<>d.attidentity)
  ) THEN
    RAISE EXCEPTION 'WEBHOOK_SHADOW_INCOMPATIBLE_COLUMN_ATTRIBUTES';
  END IF;
  -- Locks and exact prefix validation make IF NOT EXISTS unnecessary: it
  -- must never turn an incompatible preexisting column into apparent success.
  IF shadow_count=28 THEN
    ALTER TABLE public.webhook_deliveries_partitioned ADD COLUMN nonce text;
  END IF;
  IF shadow_count<30 THEN
    ALTER TABLE public.webhook_deliveries_partitioned ADD COLUMN dlq_reason text;
  END IF;
  IF EXISTS (
    SELECT 1 FROM (SELECT * FROM pg_attribute WHERE attrelid='public.webhook_deliveries'::regclass AND attnum>0) s FULL JOIN
      (SELECT * FROM pg_attribute WHERE attrelid='public.webhook_deliveries_partitioned'::regclass AND attnum>0) d
      ON d.attnum=s.attnum
    WHERE (s.attname IS DISTINCT FROM d.attname OR s.atttypid IS DISTINCT FROM d.atttypid
        OR s.atttypmod IS DISTINCT FROM d.atttypmod OR s.attcollation IS DISTINCT FROM d.attcollation)
  ) THEN
    RAISE EXCEPTION 'WEBHOOK_SHADOW_REPAIR_POSTCONDITION_FAILED';
  END IF;
END;
$parity$;
COMMIT;
