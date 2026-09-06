-- Migration 244: qualify pgcrypto calls in the two runtime-queue RPCs
--
-- WHAT IS WRONG
-- `claim_runtime_lease` and `claim_distributed_queue_messages` are both SECURITY DEFINER and both
-- carry `SET search_path TO 'public'`. Each calls `gen_random_bytes(...)` with no schema qualifier.
-- On Supabase, pgcrypto is installed into the `extensions` schema, so under that search_path the
-- call does not resolve and the function raises
--     ERROR:  function gen_random_bytes(integer) does not exist
-- on EVERY invocation. Not a rare path, not a race: `claim_runtime_lease` fails while initialising
-- its DECLARE block, before its first statement; `claim_distributed_queue_messages` fails on its
-- only statement.
--
-- This is the same defect class as migrations 214/215 (`issue_gst_invoice`, `issue_gift_card`),
-- registered but not fixed as CAP-C52 and CAP-C53.
--
-- WHY QUALIFYING, NOT WIDENING
-- Adding `extensions` to the function's search_path would also work, and is the wrong fix: a
-- SECURITY DEFINER function's search_path is a security control, and every schema on it is a place
-- an attacker who can create objects could shadow a call. Qualifying the one call site names
-- exactly what is wanted and leaves the search_path as narrow as it was.
--
-- WHAT THIS MIGRATION IS
-- The two definitions below are the CURRENT LIVE definitions, read back with pg_get_functiondef
-- from a database with migrations 000..243 applied, with exactly one substitution each:
--     gen_random_bytes(  ->  extensions.gen_random_bytes(
-- Nothing else is retyped, reordered or removed. Every other byte is the text that is running today.
--
-- SCOPE, MEASURED NOT ASSUMED
-- A sweep of all 160 `public` functions carrying an explicit search_path, over their final live
-- definitions against a Supabase-faithful database (pgcrypto in `extensions`), finds exactly these
-- two. `gen_random_uuid` is not an offender: it also exists in `pg_catalog`, which is always on the
-- search path. tests/executable/extension-schema-qualification-postgres.test.mjs re-runs that sweep
-- as a standing assertion.

CREATE OR REPLACE FUNCTION public.claim_runtime_lease(p_resource_type text, p_resource_id text, p_owner_id text, p_ttl_seconds integer, p_request_id text, p_correlation_id text, p_trace_id text DEFAULT NULL::text)
 RETURNS runtime_leases
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    claimed runtime_leases%ROWTYPE;
    token TEXT := encode(extensions.gen_random_bytes(16), 'hex');
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
           fencing_token = encode(extensions.gen_random_bytes(16), 'hex'),
           updated_at = NOW()
      FROM candidates
     WHERE message.id = candidates.id
    RETURNING message.*;
END;
$function$;

-- Self-verification: the migration proves its own effect by reading the catalog back, rather than
-- trusting that a CREATE OR REPLACE landed. A definition that still carries an unqualified call
-- would leave this migration green and the functions broken, which is exactly how this survived.
DO $verify$
DECLARE
    v_bad text;
BEGIN
    SELECT string_agg(p.proname, ', ' ORDER BY p.proname) INTO v_bad
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('claim_runtime_lease', 'claim_distributed_queue_messages')
      AND pg_get_functiondef(p.oid) ~ '(^|[^.[:alnum:]_])gen_random_bytes[[:space:]]*\(';

    IF v_bad IS NOT NULL THEN
        RAISE EXCEPTION 'migration 244 did not qualify every gen_random_bytes call: %', v_bad;
    END IF;

    -- And the search_path must still be narrow. Qualifying the call is the fix; widening the
    -- search_path is the fix this migration deliberately did not make, so assert it did not happen.
    SELECT string_agg(p.proname, ', ' ORDER BY p.proname) INTO v_bad
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('claim_runtime_lease', 'claim_distributed_queue_messages')
      AND NOT (p.proconfig @> ARRAY['search_path=public']);

    IF v_bad IS NOT NULL THEN
        RAISE EXCEPTION 'migration 244 changed a search_path it should not have: %', v_bad;
    END IF;
END
$verify$;
