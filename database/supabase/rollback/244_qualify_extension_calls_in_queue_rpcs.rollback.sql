-- Rollback of 244: restore the unqualified pgcrypto calls in the two runtime-queue RPCs.
--
-- This deliberately restores BROKEN functions. Under a Supabase-shaped database (pgcrypto in the
-- `extensions` schema) both definitions below raise
--     ERROR:  function gen_random_bytes(integer) does not exist
-- on every call, which is the state migration 244 exists to end. The executable suite applies this
-- rollback on purpose, watches both calls fail, then re-applies 244 and watches them succeed —
-- a fence you have never seen absent is not a fence you have tested.
--
-- No data is touched: these are function definitions only.

BEGIN;

CREATE OR REPLACE FUNCTION public.claim_runtime_lease(p_resource_type text, p_resource_id text, p_owner_id text, p_ttl_seconds integer, p_request_id text, p_correlation_id text, p_trace_id text DEFAULT NULL::text)
 RETURNS runtime_leases
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    claimed runtime_leases%ROWTYPE;
    token TEXT := encode(gen_random_bytes(16), 'hex');
BEGIN
    INSERT INTO runtime_leases (
        lease_id,
        resource_type,
        resource_id,
        owner_id,
        fencing_token,
        expires_at,
        request_id,
        correlation_id,
        trace_id
    )
    VALUES (
        p_resource_type || ':' || p_resource_id,
        p_resource_type,
        p_resource_id,
        p_owner_id,
        token,
        NOW() + make_interval(secs => GREATEST(COALESCE(p_ttl_seconds, 60), 1)),
        p_request_id,
        p_correlation_id,
        p_trace_id
    )
    ON CONFLICT (resource_type, resource_id) DO UPDATE
       SET owner_id = EXCLUDED.owner_id,
           fencing_token = EXCLUDED.fencing_token,
           expires_at = EXCLUDED.expires_at,
           request_id = EXCLUDED.request_id,
           correlation_id = EXCLUDED.correlation_id,
           trace_id = EXCLUDED.trace_id,
           updated_at = NOW()
     WHERE runtime_leases.expires_at <= NOW()
        OR runtime_leases.owner_id = p_owner_id
    RETURNING * INTO claimed;

    IF claimed.id IS NULL THEN
        RAISE EXCEPTION 'runtime lease unavailable for %.%', p_resource_type, p_resource_id;
    END IF;

    RETURN claimed;
END;
$function$;

CREATE OR REPLACE FUNCTION public.claim_distributed_queue_messages(p_queue_name text, p_worker_id text, p_limit integer DEFAULT 25, p_visibility_seconds integer DEFAULT 120)
 RETURNS SETOF distributed_queue_messages
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    RETURN QUERY
    WITH candidates AS (
        SELECT id
          FROM distributed_queue_messages
         WHERE queue_name = p_queue_name
           AND status IN ('scheduled', 'available', 'retrying')
           AND available_at <= NOW()
           AND deleted_at IS NULL
         ORDER BY partition_index ASC, available_at ASC, created_at ASC
         LIMIT LEAST(GREATEST(COALESCE(p_limit, 25), 1), 250)
         FOR UPDATE SKIP LOCKED
    )
    UPDATE distributed_queue_messages AS message
       SET status = 'leased',
           attempts = attempts + 1,
           leased_by = p_worker_id,
           leased_until = NOW() + make_interval(secs => GREATEST(COALESCE(p_visibility_seconds, 120), 1)),
           fencing_token = encode(gen_random_bytes(16), 'hex'),
           updated_at = NOW()
      FROM candidates
     WHERE message.id = candidates.id
    RETURNING message.*;
END;
$function$;

COMMIT;
