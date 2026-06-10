--
-- PostgreSQL database dump
--

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: adjust_inventory_level(uuid, uuid, uuid, integer, uuid, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.adjust_inventory_level(p_product_id uuid, p_variant_id uuid DEFAULT NULL::uuid, p_location_id uuid DEFAULT NULL::uuid, p_adjustment integer DEFAULT 0, p_actor_id uuid DEFAULT NULL::uuid, p_reason text DEFAULT 'adjustment'::text, p_notes text DEFAULT NULL::text, p_request_id text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_product RECORD;
    v_location_id UUID;
    v_level RECORD;
    v_next_available INTEGER;
    v_level_json JSONB;
BEGIN
    SELECT id, store_id
      INTO v_product
      FROM products
     WHERE id = p_product_id
       AND deleted_at IS NULL;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'product not found';
    END IF;

    IF p_location_id IS NULL THEN
        v_location_id := ensure_default_inventory_location(v_product.store_id);
    ELSE
        SELECT id
          INTO v_location_id
          FROM inventory_locations
         WHERE id = p_location_id
           AND store_id = v_product.store_id
           AND deleted_at IS NULL;

        IF v_location_id IS NULL THEN
            RAISE EXCEPTION 'inventory location not found for product store';
        END IF;
    END IF;

    SELECT *
      INTO v_level
      FROM inventory_levels
     WHERE product_id = p_product_id
       AND location_id = v_location_id
       AND (
            (p_variant_id IS NULL AND variant_id IS NULL)
            OR variant_id = p_variant_id
       )
     LIMIT 1
     FOR UPDATE;

    IF NOT FOUND THEN
        v_next_available := p_adjustment;
        IF v_next_available < 0 THEN
            RAISE EXCEPTION 'cannot reduce inventory below zero';
        END IF;

        INSERT INTO inventory_levels (
            product_id,
            variant_id,
            location_id,
            available,
            reserved,
            incoming,
            updated_at
        )
        VALUES (
            p_product_id,
            p_variant_id,
            v_location_id,
            v_next_available,
            0,
            0,
            NOW()
        )
        RETURNING * INTO v_level;
    ELSE
        v_next_available := COALESCE(v_level.available, 0) + p_adjustment;

        IF v_next_available < 0 THEN
            RAISE EXCEPTION 'cannot reduce inventory below zero';
        END IF;

        IF v_next_available < COALESCE(v_level.reserved, 0) THEN
            RAISE EXCEPTION 'available inventory cannot be below reserved quantity';
        END IF;

        UPDATE inventory_levels
           SET available = v_next_available,
               updated_at = NOW()
         WHERE id = v_level.id
         RETURNING * INTO v_level;
    END IF;

    INSERT INTO inventory_adjustments (
        product_id,
        variant_id,
        location_id,
        quantity_change,
        reason,
        note,
        created_by
    )
    VALUES (
        p_product_id,
        p_variant_id,
        v_location_id,
        p_adjustment,
        CASE
            WHEN p_reason IN ('sale', 'return', 'adjustment', 'recount', 'transfer', 'damaged', 'reserved', 'unreserved')
            THEN p_reason
            ELSE 'adjustment'
        END,
        p_notes,
        p_actor_id
    );

    IF p_variant_id IS NULL THEN
        UPDATE products
           SET stock = v_next_available,
               updated_at = NOW()
         WHERE id = p_product_id;
    ELSE
        UPDATE product_variants
           SET inventory_qty = v_next_available,
               updated_at = NOW()
         WHERE id = p_variant_id;
    END IF;

    INSERT INTO outbox_events (
        store_id,
        aggregate_type,
        aggregate_id,
        event_type,
        payload,
        idempotency_key,
        request_id,
        actor_id
    )
    VALUES (
        v_product.store_id,
        'inventory',
        p_product_id::TEXT,
        'inventory.level.adjusted',
        jsonb_build_object(
            'store_id', v_product.store_id,
            'product_id', p_product_id,
            'variant_id', p_variant_id,
            'location_id', v_location_id,
            'adjustment', p_adjustment,
            'available', v_next_available
        ),
        'inventory.level.adjusted:' || p_product_id::TEXT || ':' || COALESCE(p_variant_id::TEXT, 'default') || ':' || v_location_id::TEXT || ':' || COALESCE(p_request_id, gen_random_uuid()::TEXT),
        p_request_id,
        p_actor_id
    )
    ON CONFLICT (idempotency_key) DO NOTHING;

    SELECT to_jsonb(v_level) INTO v_level_json;
    RETURN v_level_json;
END;
$$;


--
-- Name: append_distributed_event(uuid, text, text, uuid, text, text, text, integer, jsonb, jsonb, text, text, text, text, text, text, text, boolean, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.append_distributed_event(p_event_id uuid, p_stream_name text, p_partition_key text, p_site_id uuid, p_aggregate_type text, p_aggregate_id text, p_event_type text, p_schema_version integer, p_payload jsonb, p_metadata jsonb, p_source_runtime text, p_producer text, p_correlation_id text, p_causation_id text, p_request_id text, p_trace_id text, p_idempotency_key text, p_replayable boolean, p_retention_class text) RETURNS TABLE(event_id uuid, stream_name text, stream_position bigint, global_position bigint, persisted_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    next_stream_position BIGINT;
    inserted distributed_event_store%ROWTYPE;
BEGIN
    IF p_stream_name IS NULL OR length(trim(p_stream_name)) = 0 THEN
        RAISE EXCEPTION 'stream name is required';
    END IF;

    INSERT INTO distributed_event_streams (
        stream_name,
        site_id,
        partition_key,
        metadata
    )
    VALUES (
        p_stream_name,
        p_site_id,
        p_partition_key,
        jsonb_build_object('created_by_append', TRUE)
    )
    ON CONFLICT (stream_name) DO NOTHING;

    SELECT distributed_event_streams.last_stream_position + 1
      INTO next_stream_position
      FROM distributed_event_streams
     WHERE distributed_event_streams.stream_name = p_stream_name
     FOR UPDATE;

    INSERT INTO distributed_event_store (
        event_id,
        stream_name,
        stream_position,
        partition_key,
        site_id,
        aggregate_type,
        aggregate_id,
        event_type,
        schema_version,
        payload,
        metadata,
        source_runtime,
        producer,
        correlation_id,
        causation_id,
        request_id,
        trace_id,
        idempotency_key,
        replayable,
        retention_class
    )
    VALUES (
        p_event_id,
        p_stream_name,
        next_stream_position,
        p_partition_key,
        p_site_id,
        p_aggregate_type,
        p_aggregate_id,
        p_event_type,
        COALESCE(p_schema_version, 1),
        COALESCE(p_payload, '{}'),
        COALESCE(p_metadata, '{}'),
        p_source_runtime,
        p_producer,
        p_correlation_id,
        p_causation_id,
        p_request_id,
        p_trace_id,
        p_idempotency_key,
        COALESCE(p_replayable, TRUE),
        COALESCE(p_retention_class, 'hot')
    )
    ON CONFLICT (stream_name, idempotency_key) DO NOTHING
    RETURNING * INTO inserted;

    IF inserted.id IS NULL THEN
        SELECT *
          INTO inserted
          FROM distributed_event_store
         WHERE distributed_event_store.stream_name = p_stream_name
           AND distributed_event_store.idempotency_key = p_idempotency_key
         LIMIT 1;
    END IF;

    UPDATE distributed_event_streams
       SET last_stream_position = GREATEST(last_stream_position, inserted.stream_position),
           last_global_position = GREATEST(last_global_position, inserted.global_position),
           updated_at = NOW()
     WHERE distributed_event_streams.stream_name = p_stream_name;

    RETURN QUERY
    SELECT
        inserted.event_id,
        inserted.stream_name,
        inserted.stream_position,
        inserted.global_position,
        inserted.persisted_at;
END;
$$;


--
-- Name: archive_distributed_events(timestamp with time zone, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.archive_distributed_events(p_before timestamp with time zone, p_limit integer DEFAULT 10000) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    affected_count INTEGER;
BEGIN
    WITH candidates AS (
        SELECT id
          FROM distributed_event_store
         WHERE retention_class IN ('hot', 'warm')
           AND replayable = TRUE
           AND occurred_at < p_before
           AND deleted_at IS NULL
         ORDER BY occurred_at ASC
         LIMIT p_limit
    )
    UPDATE distributed_event_store AS event
       SET retention_class = 'archive',
           updated_at = NOW()
      FROM candidates
     WHERE event.id = candidates.id;

    GET DIAGNOSTICS affected_count = ROW_COUNT;
    RETURN affected_count;
END;
$$;


--
-- Name: attach_order_payment_reference(uuid, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.attach_order_payment_reference(p_order_id uuid, p_provider text, p_provider_order_id text, p_request_id text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_order RECORD;
    v_order_json JSONB;
BEGIN
    IF p_order_id IS NULL OR p_provider IS NULL OR p_provider_order_id IS NULL THEN
        RAISE EXCEPTION 'order_id, provider, and provider_order_id are required';
    END IF;

    SELECT id, store_id, payment_id, payment_status, status, inventory_reserved_at
      INTO v_order
      FROM orders
     WHERE id = p_order_id
       AND deleted_at IS NULL
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'order not found';
    END IF;

    IF v_order.payment_status = 'paid' THEN
        RAISE EXCEPTION 'order is already paid';
    END IF;

    IF v_order.status IN ('cancelled', 'refunded') THEN
        RAISE EXCEPTION 'order is not payable';
    END IF;

    IF v_order.inventory_reserved_at IS NULL THEN
        RAISE EXCEPTION 'order inventory is not reserved';
    END IF;

    IF v_order.payment_id IS NOT NULL AND v_order.payment_id <> p_provider_order_id THEN
        RAISE EXCEPTION 'order already has a different payment reference';
    END IF;

    UPDATE orders
       SET payment_id = p_provider_order_id,
           payment_method = p_provider,
           payment_gateway = p_provider,
           updated_at = NOW()
     WHERE id = p_order_id
     RETURNING to_jsonb(orders.*) INTO v_order_json;

    INSERT INTO outbox_events (
        store_id,
        aggregate_type,
        aggregate_id,
        event_type,
        payload,
        idempotency_key,
        request_id
    )
    VALUES (
        v_order.store_id,
        'order',
        p_order_id::TEXT,
        'payment.reference.attached',
        jsonb_build_object(
            'store_id', v_order.store_id,
            'order_id', p_order_id,
            'provider', p_provider,
            'provider_order_id', p_provider_order_id
        ),
        'payment.reference.attached:' || p_provider || ':' || p_provider_order_id,
        p_request_id
    )
    ON CONFLICT (idempotency_key) DO NOTHING;

    RETURN v_order_json;
END;
$$;


--
-- Name: attach_order_payment_reference_with_ledger(uuid, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.attach_order_payment_reference_with_ledger(p_order_id uuid, p_provider text, p_provider_order_id text, p_request_id text DEFAULT NULL::text, p_idempotency_key text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_order_json JSONB;
    v_order RECORD;
    v_payment_transaction_id UUID;
BEGIN
    v_order_json := attach_order_payment_reference(
        p_order_id,
        p_provider,
        p_provider_order_id,
        p_request_id
    );

    SELECT *
      INTO v_order
      FROM orders
     WHERE id = p_order_id
       AND deleted_at IS NULL;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'order not found';
    END IF;

    UPDATE payment_transactions
       SET gateway_txn_id = p_provider_order_id,
           provider_order_id = p_provider_order_id,
           request_id = COALESCE(p_request_id, request_id),
           idempotency_key = COALESCE(p_idempotency_key, idempotency_key),
           updated_at = NOW()
     WHERE order_id = p_order_id
       AND gateway = p_provider
       AND deleted_at IS NULL
     RETURNING id INTO v_payment_transaction_id;

    IF v_payment_transaction_id IS NULL THEN
        INSERT INTO payment_transactions (
            order_id,
            store_id,
            site_id,
            gateway,
            gateway_txn_id,
            provider_order_id,
            amount,
            currency,
            status,
            payment_method,
            metadata,
            request_id,
            idempotency_key
        )
        VALUES (
            p_order_id,
            v_order.store_id,
            v_order.store_id,
            p_provider,
            p_provider_order_id,
            p_provider_order_id,
            COALESCE(v_order.total, 0),
            COALESCE(v_order.currency, 'INR'),
            'pending',
            p_provider,
            jsonb_build_object('source', 'payment_reference_attach'),
            p_request_id,
            p_idempotency_key
        )
        RETURNING id INTO v_payment_transaction_id;
    END IF;

    INSERT INTO payment_attempts (
        site_id,
        order_id,
        payment_transaction_id,
        provider,
        attempt_type,
        status,
        amount,
        currency,
        provider_order_id,
        provider_event_id,
        idempotency_key,
        request_id,
        metadata
    )
    VALUES (
        v_order.store_id,
        p_order_id,
        v_payment_transaction_id,
        p_provider,
        'reference',
        'succeeded',
        COALESCE(v_order.total, 0),
        COALESCE(v_order.currency, 'INR'),
        p_provider_order_id,
        'reference:' || p_provider || ':' || p_provider_order_id,
        p_idempotency_key,
        p_request_id,
        jsonb_build_object('provider_order_id', p_provider_order_id)
    )
    ON CONFLICT DO NOTHING;

    RETURN v_order_json;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: runtime_replay_executions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.runtime_replay_executions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    replay_id text NOT NULL,
    owner_runtime text NOT NULL,
    site_id uuid,
    event_types text[] DEFAULT ARRAY[]::text[] NOT NULL,
    cursor jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'planned'::text NOT NULL,
    dry_run boolean DEFAULT false NOT NULL,
    requested_by uuid,
    approved_by uuid,
    authorization_expires_at timestamp with time zone,
    reason text NOT NULL,
    result jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT runtime_replay_executions_status_check CHECK ((status = ANY (ARRAY['planned'::text, 'authorized'::text, 'running'::text, 'paused'::text, 'completed'::text, 'failed'::text, 'cancelled'::text])))
);


--
-- Name: authorize_runtime_replay_operation(text, uuid, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.authorize_runtime_replay_operation(p_replay_id text, p_approved_by uuid, p_expires_at timestamp with time zone) RETURNS public.runtime_replay_executions
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    replay runtime_replay_executions%ROWTYPE;
BEGIN
    UPDATE runtime_replay_executions
       SET status = 'authorized',
           approved_by = p_approved_by,
           authorization_expires_at = p_expires_at,
           updated_at = NOW()
     WHERE replay_id = p_replay_id
       AND deleted_at IS NULL
    RETURNING * INTO replay;

    IF replay.id IS NULL THEN
        RAISE EXCEPTION 'runtime replay operation not found: %', p_replay_id;
    END IF;

    UPDATE replay_operation_schedules
       SET status = 'authorized',
           approved_by = p_approved_by,
           authorization_expires_at = p_expires_at,
           updated_at = NOW()
     WHERE replay_id = p_replay_id
       AND deleted_at IS NULL;

    RETURN replay;
END;
$$;


--
-- Name: distributed_queue_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.distributed_queue_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    message_id text NOT NULL,
    queue_name text NOT NULL,
    partition_key text NOT NULL,
    partition_index integer DEFAULT 0 NOT NULL,
    site_id uuid,
    job_type text NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'available'::text NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    max_attempts integer DEFAULT 10 NOT NULL,
    available_at timestamp with time zone DEFAULT now() NOT NULL,
    leased_until timestamp with time zone,
    leased_by text,
    fencing_token text,
    idempotency_key text NOT NULL,
    request_id text,
    correlation_id text NOT NULL,
    trace_id text,
    traceparent text,
    result jsonb DEFAULT '{}'::jsonb NOT NULL,
    error_message text,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT distributed_queue_messages_status_check CHECK ((status = ANY (ARRAY['scheduled'::text, 'available'::text, 'leased'::text, 'completed'::text, 'retrying'::text, 'dead-lettered'::text, 'cancelled'::text])))
);


--
-- Name: claim_distributed_queue_messages(text, text, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.claim_distributed_queue_messages(p_queue_name text, p_worker_id text, p_limit integer DEFAULT 25, p_visibility_seconds integer DEFAULT 120) RETURNS SETOF public.distributed_queue_messages
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: runtime_control_commands; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.runtime_control_commands (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    command_id text NOT NULL,
    operation text NOT NULL,
    target_type text NOT NULL,
    target_id text NOT NULL,
    requested_by uuid,
    reason text NOT NULL,
    status text DEFAULT 'accepted'::text NOT NULL,
    result jsonb DEFAULT '{}'::jsonb NOT NULL,
    request_id text,
    correlation_id text NOT NULL,
    trace_id text,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT runtime_control_commands_status_check CHECK ((status = ANY (ARRAY['accepted'::text, 'running'::text, 'completed'::text, 'failed'::text, 'cancelled'::text])))
);


--
-- Name: claim_operational_control_command(text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.claim_operational_control_command(p_owner_id text, p_limit integer DEFAULT 25) RETURNS SETOF public.runtime_control_commands
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
    RETURN QUERY
    WITH candidates AS (
        SELECT id
          FROM runtime_control_commands
         WHERE status = 'accepted'
           AND deleted_at IS NULL
         ORDER BY created_at ASC
         LIMIT LEAST(GREATEST(COALESCE(p_limit, 25), 1), 100)
         FOR UPDATE SKIP LOCKED
    )
    UPDATE runtime_control_commands AS command
       SET status = 'running',
           result = jsonb_build_object('owner_id', p_owner_id, 'claimed_at', NOW()),
           updated_at = NOW()
      FROM candidates
     WHERE command.id = candidates.id
    RETURNING command.*;
END;
$$;


--
-- Name: claim_outbox_events(text, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.claim_outbox_events(p_dispatcher_id text, p_limit integer DEFAULT 25, p_lock_seconds integer DEFAULT 120) RETURNS TABLE(id uuid, store_id uuid, site_id uuid, event_id uuid, aggregate_type text, aggregate_id text, event_type text, payload jsonb, idempotency_key text, request_id text, trace_id text, schema_version integer, actor_id uuid, attempts integer, max_attempts integer, created_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
    IF p_dispatcher_id IS NULL OR length(trim(p_dispatcher_id)) = 0 THEN
        RAISE EXCEPTION 'dispatcher id is required';
    END IF;

    RETURN QUERY
    WITH candidates AS (
        SELECT outbox_events.id
        FROM outbox_events
        WHERE outbox_events.status IN ('queued', 'failed')
          AND outbox_events.available_at <= NOW()
          AND outbox_events.next_attempt_at <= NOW()
          AND outbox_events.attempts < outbox_events.max_attempts
          AND (
              outbox_events.locked_at IS NULL
              OR outbox_events.locked_at < NOW() - make_interval(secs => p_lock_seconds)
          )
        ORDER BY outbox_events.created_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT LEAST(GREATEST(p_limit, 1), 100)
    ),
    claimed AS (
        UPDATE outbox_events
           SET status = 'processing',
               attempts = outbox_events.attempts + 1,
               locked_at = NOW(),
               locked_by = p_dispatcher_id,
               error_message = NULL,
               updated_at = NOW()
          FROM candidates
         WHERE outbox_events.id = candidates.id
         RETURNING outbox_events.*
    )
    SELECT
        claimed.id,
        claimed.store_id,
        COALESCE(claimed.site_id, claimed.store_id) AS site_id,
        claimed.event_id,
        claimed.aggregate_type,
        claimed.aggregate_id,
        claimed.event_type,
        claimed.payload,
        claimed.idempotency_key,
        claimed.request_id,
        claimed.trace_id,
        claimed.schema_version,
        claimed.actor_id,
        claimed.attempts,
        claimed.max_attempts,
        claimed.created_at
    FROM claimed;
END;
$$;


--
-- Name: claim_platform_queue_jobs(text, text, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.claim_platform_queue_jobs(p_queue_name text, p_worker_id text, p_limit integer DEFAULT 25, p_lock_seconds integer DEFAULT 120) RETURNS TABLE(id uuid, site_id uuid, outbox_event_id uuid, event_id uuid, queue_name text, job_type text, payload jsonb, attempts integer, max_attempts integer, request_id text, trace_id text, idempotency_key text, schema_version integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
    IF p_queue_name IS NULL OR length(trim(p_queue_name)) = 0 THEN
        RAISE EXCEPTION 'queue name is required';
    END IF;

    IF p_worker_id IS NULL OR length(trim(p_worker_id)) = 0 THEN
        RAISE EXCEPTION 'worker id is required';
    END IF;

    RETURN QUERY
    WITH candidates AS (
        SELECT platform_queue_jobs.id
        FROM platform_queue_jobs
        WHERE platform_queue_jobs.queue_name = p_queue_name
          AND platform_queue_jobs.status IN ('queued', 'failed')
          AND platform_queue_jobs.available_at <= NOW()
          AND platform_queue_jobs.attempts < platform_queue_jobs.max_attempts
          AND platform_queue_jobs.deleted_at IS NULL
          AND (
              platform_queue_jobs.locked_at IS NULL
              OR platform_queue_jobs.locked_at < NOW() - make_interval(secs => p_lock_seconds)
          )
        ORDER BY platform_queue_jobs.created_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT LEAST(GREATEST(p_limit, 1), 100)
    ),
    claimed AS (
        UPDATE platform_queue_jobs
           SET status = 'running',
               attempts = platform_queue_jobs.attempts + 1,
               locked_at = NOW(),
               locked_by = p_worker_id,
               error_message = NULL,
               updated_at = NOW()
          FROM candidates
         WHERE platform_queue_jobs.id = candidates.id
         RETURNING platform_queue_jobs.*
    )
    SELECT
        claimed.id,
        claimed.site_id,
        claimed.outbox_event_id,
        claimed.event_id,
        claimed.queue_name,
        claimed.job_type,
        claimed.payload,
        claimed.attempts,
        claimed.max_attempts,
        claimed.request_id,
        claimed.trace_id,
        claimed.idempotency_key,
        claimed.schema_version
    FROM claimed;
END;
$$;


--
-- Name: runtime_leases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.runtime_leases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lease_id text NOT NULL,
    resource_type text NOT NULL,
    resource_id text NOT NULL,
    owner_id text NOT NULL,
    fencing_token text NOT NULL,
    acquired_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    request_id text,
    correlation_id text NOT NULL,
    trace_id text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: claim_runtime_lease(text, text, text, integer, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.claim_runtime_lease(p_resource_type text, p_resource_id text, p_owner_id text, p_ttl_seconds integer, p_request_id text, p_correlation_id text, p_trace_id text DEFAULT NULL::text) RETURNS public.runtime_leases
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: claim_webhook_deliveries(text, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.claim_webhook_deliveries(p_dispatcher_id text, p_limit integer DEFAULT 25, p_lock_seconds integer DEFAULT 120) RETURNS TABLE(id uuid, site_id uuid, subscription_id uuid, event_id uuid, event_type text, target_url text, payload jsonb, signing_secret text, request_id text, trace_id text, idempotency_key text, schema_version integer, attempts integer, max_attempts integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
    IF p_dispatcher_id IS NULL OR length(trim(p_dispatcher_id)) = 0 THEN
        RAISE EXCEPTION 'dispatcher id is required';
    END IF;

    RETURN QUERY
    WITH candidates AS (
        SELECT webhook_deliveries.id
        FROM webhook_deliveries
        JOIN webhook_subscriptions
          ON webhook_subscriptions.id = webhook_deliveries.subscription_id
         AND webhook_subscriptions.status = 'active'
         AND webhook_subscriptions.deleted_at IS NULL
        WHERE webhook_deliveries.status IN ('pending', 'failed')
          AND webhook_deliveries.deleted_at IS NULL
          AND webhook_deliveries.next_attempt_at <= NOW()
          AND webhook_deliveries.attempts < webhook_deliveries.max_attempts
          AND (
              webhook_deliveries.locked_at IS NULL
              OR webhook_deliveries.locked_at < NOW() - make_interval(secs => p_lock_seconds)
          )
        ORDER BY webhook_deliveries.created_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT LEAST(GREATEST(p_limit, 1), 100)
    ),
    claimed AS (
        UPDATE webhook_deliveries
           SET status = 'processing',
               attempts = webhook_deliveries.attempts + 1,
               locked_at = NOW(),
               locked_by = p_dispatcher_id,
               error_message = NULL,
               updated_at = NOW()
          FROM candidates
         WHERE webhook_deliveries.id = candidates.id
         RETURNING webhook_deliveries.*
    )
    SELECT
        claimed.id,
        claimed.site_id,
        claimed.subscription_id,
        claimed.event_id,
        claimed.event_type,
        claimed.target_url,
        claimed.payload,
        webhook_subscriptions.signing_secret,
        claimed.request_id,
        claimed.trace_id,
        claimed.idempotency_key,
        claimed.schema_version,
        claimed.attempts,
        claimed.max_attempts
    FROM claimed
    JOIN webhook_subscriptions ON webhook_subscriptions.id = claimed.subscription_id;
END;
$$;


--
-- Name: complete_distributed_queue_message(text, text, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.complete_distributed_queue_message(p_message_id text, p_worker_id text, p_fencing_token text, p_result jsonb DEFAULT '{}'::jsonb) RETURNS public.distributed_queue_messages
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    updated_message distributed_queue_messages%ROWTYPE;
BEGIN
    UPDATE distributed_queue_messages
       SET status = 'completed',
           result = COALESCE(p_result, '{}'),
           leased_until = NULL,
           updated_at = NOW()
     WHERE message_id = p_message_id
       AND leased_by = p_worker_id
       AND fencing_token = p_fencing_token
       AND status = 'leased'
       AND deleted_at IS NULL
    RETURNING * INTO updated_message;

    IF updated_message.id IS NULL THEN
        RAISE EXCEPTION 'queue completion rejected for message %', p_message_id;
    END IF;

    RETURN updated_message;
END;
$$;


--
-- Name: complete_order_refund(uuid, text, text, uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.complete_order_refund(p_refund_id uuid, p_provider_refund_id text DEFAULT NULL::text, p_provider_event_id text DEFAULT NULL::text, p_actor_id uuid DEFAULT NULL::uuid, p_request_id text DEFAULT NULL::text, p_idempotency_key text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_refund RECORD;
    v_order RECORD;
    v_total_succeeded NUMERIC(12,2);
    v_order_total NUMERIC(12,2);
    v_payment_status TEXT;
BEGIN
    IF p_idempotency_key IS NULL OR BTRIM(p_idempotency_key) = '' THEN
        RAISE EXCEPTION 'idempotency_key is required';
    END IF;

    SELECT *
      INTO v_refund
      FROM refunds
     WHERE id = p_refund_id
       AND deleted_at IS NULL
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'refund not found';
    END IF;

    IF v_refund.status = 'succeeded' THEN
        RETURN jsonb_build_object('refund', to_jsonb(v_refund), 'idempotent_replay', true);
    END IF;

    SELECT *
      INTO v_order
      FROM orders
     WHERE id = v_refund.order_id
       AND deleted_at IS NULL
     FOR UPDATE;

    UPDATE refunds
       SET status = 'succeeded',
           provider_refund_id = COALESCE(p_provider_refund_id, provider_refund_id),
           provider_event_id = COALESCE(p_provider_event_id, provider_event_id),
           updated_at = NOW(),
           updated_by = p_actor_id
     WHERE id = p_refund_id;

    UPDATE refund_transactions
       SET status = 'succeeded',
           provider_refund_id = COALESCE(p_provider_refund_id, provider_refund_id),
           provider_event_id = COALESCE(p_provider_event_id, provider_event_id),
           updated_at = NOW(),
           updated_by = p_actor_id
     WHERE order_id = v_refund.order_id
       AND site_id = v_refund.site_id
       AND metadata ->> 'refund_id' = p_refund_id::TEXT
       AND deleted_at IS NULL;

    INSERT INTO refund_attempts (
        site_id,
        refund_transaction_id,
        provider,
        status,
        provider_refund_id,
        provider_event_id,
        idempotency_key,
        request_id,
        metadata,
        created_by
    )
    SELECT
        rt.site_id,
        rt.id,
        CASE
            WHEN v_refund.provider IN ('stripe', 'razorpay', 'paypal', 'cod', 'bank_transfer', 'gift_card') THEN v_refund.provider
            WHEN v_refund.refund_method = 'gift_card' THEN 'gift_card'
            WHEN v_refund.refund_method = 'manual' THEN 'bank_transfer'
            WHEN v_order.payment_gateway IN ('stripe', 'razorpay', 'paypal', 'cod', 'bank_transfer') THEN v_order.payment_gateway
            WHEN v_order.payment_method IN ('stripe', 'razorpay', 'paypal', 'cod', 'bank_transfer') THEN v_order.payment_method
            ELSE 'bank_transfer'
        END,
        'succeeded',
        p_provider_refund_id,
        p_provider_event_id,
        p_idempotency_key,
        p_request_id,
        jsonb_build_object('refund_id', p_refund_id),
        p_actor_id
    FROM refund_transactions rt
    WHERE rt.order_id = v_refund.order_id
      AND rt.site_id = v_refund.site_id
      AND rt.metadata ->> 'refund_id' = p_refund_id::TEXT
      AND rt.deleted_at IS NULL
    ON CONFLICT DO NOTHING;

    SELECT COALESCE(SUM(amount), 0)
      INTO v_total_succeeded
      FROM refunds
     WHERE order_id = v_refund.order_id
       AND site_id = v_refund.site_id
       AND status = 'succeeded'
       AND deleted_at IS NULL;

    v_order_total := COALESCE(v_order.total, 0);
    v_payment_status := CASE WHEN v_total_succeeded >= v_order_total THEN 'refunded' ELSE 'partially_refunded' END;

    UPDATE payment_transactions
       SET status = v_payment_status,
           refunded_at = CASE WHEN v_payment_status = 'refunded' THEN COALESCE(refunded_at, NOW()) ELSE refunded_at END,
           updated_at = NOW(),
           updated_by = p_actor_id
     WHERE id = v_refund.payment_transaction_id
       AND deleted_at IS NULL;

    UPDATE returns
       SET status = 'refunded',
           refunded_at = NOW(),
           updated_at = NOW(),
           updated_by = p_actor_id
     WHERE id = v_refund.return_id
       AND deleted_at IS NULL;

    UPDATE orders
       SET refund_status = CASE WHEN v_payment_status = 'refunded' THEN 'refunded' ELSE 'partially_refunded' END,
           payment_status = CASE WHEN v_payment_status = 'refunded' THEN 'refunded' ELSE payment_status END,
           status = CASE WHEN v_payment_status = 'refunded' THEN 'refunded' ELSE status END,
           return_status = 'refunded',
           updated_at = NOW(),
           updated_by = p_actor_id
     WHERE id = v_refund.order_id;

    INSERT INTO outbox_events (
        site_id,
        store_id,
        aggregate_type,
        aggregate_id,
        event_type,
        payload,
        idempotency_key,
        request_id,
        trace_id,
        schema_version,
        actor_id
    )
    VALUES (
        v_refund.site_id,
        v_refund.site_id,
        'refund',
        p_refund_id::TEXT,
        'refund.succeeded',
        jsonb_build_object(
            'site_id', v_refund.site_id,
            'order_id', v_refund.order_id,
            'refund_id', p_refund_id,
            'amount', v_refund.amount,
            'provider_refund_id', p_provider_refund_id
        ),
        'refund.succeeded:' || p_refund_id::TEXT,
        p_request_id,
        p_request_id,
        1,
        p_actor_id
    )
    ON CONFLICT (idempotency_key) DO NOTHING;

    RETURN jsonb_build_object(
        'order', (SELECT to_jsonb(o) FROM orders o WHERE o.id = v_refund.order_id),
        'refund', (SELECT to_jsonb(r) FROM refunds r WHERE r.id = p_refund_id),
        'total_refunded', v_total_succeeded
    );
END;
$$;


--
-- Name: outbox_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.outbox_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid,
    aggregate_type text NOT NULL,
    aggregate_id text NOT NULL,
    event_type text NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    idempotency_key text NOT NULL,
    status text DEFAULT 'queued'::text NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    available_at timestamp with time zone DEFAULT now() NOT NULL,
    locked_at timestamp with time zone,
    processed_at timestamp with time zone,
    error_message text,
    request_id text,
    actor_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    site_id uuid,
    event_id uuid DEFAULT gen_random_uuid(),
    trace_id text,
    schema_version integer DEFAULT 1 NOT NULL,
    max_attempts integer DEFAULT 10 NOT NULL,
    next_attempt_at timestamp with time zone DEFAULT now() NOT NULL,
    locked_by text,
    dispatched_at timestamp with time zone,
    dead_lettered_at timestamp with time zone,
    dead_letter_reason text,
    dispatch_metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT outbox_events_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'processing'::text, 'processed'::text, 'failed'::text, 'dead'::text])))
);


--
-- Name: complete_outbox_event(uuid, text, integer, integer, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.complete_outbox_event(p_event_id uuid, p_dispatcher_id text, p_delivery_count integer DEFAULT 0, p_job_count integer DEFAULT 0, p_metadata jsonb DEFAULT '{}'::jsonb) RETURNS public.outbox_events
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_event outbox_events;
BEGIN
    UPDATE outbox_events
       SET status = 'processed',
           locked_at = NULL,
           locked_by = NULL,
           processed_at = NOW(),
           dispatched_at = NOW(),
           error_message = NULL,
           dispatch_metadata = COALESCE(p_metadata, '{}'::JSONB)
               || jsonb_build_object(
                   'delivery_count', COALESCE(p_delivery_count, 0),
                   'job_count', COALESCE(p_job_count, 0),
                   'completed_at', NOW()
               ),
           updated_at = NOW()
     WHERE outbox_events.id = p_event_id
       AND outbox_events.status = 'processing'
       AND outbox_events.locked_by = p_dispatcher_id
     RETURNING * INTO v_event;

    IF v_event.id IS NULL THEN
        RAISE EXCEPTION 'outbox event % is not claimable by dispatcher %', p_event_id, p_dispatcher_id;
    END IF;

    RETURN v_event;
END;
$$;


--
-- Name: platform_queue_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_queue_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_id uuid,
    outbox_event_id uuid,
    event_id uuid NOT NULL,
    queue_name text NOT NULL,
    job_type text NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'queued'::text NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    max_attempts integer DEFAULT 10 NOT NULL,
    available_at timestamp with time zone DEFAULT now() NOT NULL,
    locked_at timestamp with time zone,
    locked_by text,
    completed_at timestamp with time zone,
    failed_at timestamp with time zone,
    error_message text,
    result jsonb DEFAULT '{}'::jsonb NOT NULL,
    request_id text,
    trace_id text,
    idempotency_key text NOT NULL,
    schema_version integer DEFAULT 1 NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT platform_queue_jobs_queue_name_check CHECK ((queue_name = ANY (ARRAY['payment-events'::text, 'inventory-jobs'::text, 'webhook-deliveries'::text, 'analytics-events'::text, 'search-indexing'::text, 'fulfillment-jobs'::text, 'bulk-admin-jobs'::text]))),
    CONSTRAINT platform_queue_jobs_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'running'::text, 'succeeded'::text, 'failed'::text, 'dead'::text, 'cancelled'::text])))
);


--
-- Name: complete_platform_queue_job(uuid, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.complete_platform_queue_job(p_job_id uuid, p_worker_id text, p_result jsonb DEFAULT '{}'::jsonb) RETURNS public.platform_queue_jobs
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_job platform_queue_jobs;
BEGIN
    UPDATE platform_queue_jobs
       SET status = 'succeeded',
           locked_at = NULL,
           locked_by = NULL,
           completed_at = NOW(),
           failed_at = NULL,
           error_message = NULL,
           result = COALESCE(p_result, '{}'::JSONB),
           updated_at = NOW()
     WHERE id = p_job_id
       AND status = 'running'
       AND locked_by = p_worker_id
     RETURNING * INTO v_job;

    IF v_job.id IS NULL THEN
        RAISE EXCEPTION 'queue job % is not claimable by worker %', p_job_id, p_worker_id;
    END IF;

    RETURN v_job;
END;
$$;


--
-- Name: webhook_deliveries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.webhook_deliveries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_id uuid NOT NULL,
    subscription_id uuid NOT NULL,
    outbox_event_id uuid,
    event_id uuid NOT NULL,
    event_type text NOT NULL,
    target_url text NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    max_attempts integer DEFAULT 10 NOT NULL,
    next_attempt_at timestamp with time zone DEFAULT now() NOT NULL,
    locked_at timestamp with time zone,
    locked_by text,
    delivered_at timestamp with time zone,
    failed_at timestamp with time zone,
    response_status integer,
    response_body_preview text,
    error_message text,
    request_id text,
    trace_id text,
    idempotency_key text NOT NULL,
    schema_version integer DEFAULT 1 NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT webhook_deliveries_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'succeeded'::text, 'failed'::text, 'dead'::text, 'cancelled'::text])))
);


--
-- Name: complete_webhook_delivery(uuid, text, integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.complete_webhook_delivery(p_delivery_id uuid, p_dispatcher_id text, p_response_status integer, p_response_body_preview text DEFAULT NULL::text) RETURNS public.webhook_deliveries
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_delivery webhook_deliveries;
BEGIN
    UPDATE webhook_deliveries
       SET status = 'succeeded',
           locked_at = NULL,
           locked_by = NULL,
           delivered_at = NOW(),
           failed_at = NULL,
           response_status = p_response_status,
           response_body_preview = LEFT(COALESCE(p_response_body_preview, ''), 2000),
           error_message = NULL,
           updated_at = NOW()
     WHERE id = p_delivery_id
       AND status = 'processing'
       AND locked_by = p_dispatcher_id
     RETURNING * INTO v_delivery;

    IF v_delivery.id IS NULL THEN
        RAISE EXCEPTION 'webhook delivery % is not claimable by dispatcher %', p_delivery_id, p_dispatcher_id;
    END IF;

    UPDATE webhook_subscriptions
       SET failure_count = 0,
           last_success_at = NOW(),
           updated_at = NOW()
     WHERE id = v_delivery.subscription_id;

    RETURN v_delivery;
END;
$$;


--
-- Name: confirm_order_payment(uuid, text, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.confirm_order_payment(p_order_id uuid, p_provider text, p_provider_payment_id text, p_provider_order_id text DEFAULT NULL::text, p_provider_event_id text DEFAULT NULL::text, p_request_id text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_order RECORD;
    v_event_id TEXT;
    v_order_json JSONB;
BEGIN
    IF p_order_id IS NULL OR p_provider IS NULL OR p_provider_payment_id IS NULL THEN
        RAISE EXCEPTION 'order_id, provider, and provider_payment_id are required';
    END IF;

    v_event_id := COALESCE(
        NULLIF(p_provider_event_id, ''),
        p_provider || ':payment:' || p_provider_payment_id
    );

    SELECT id, store_id, payment_id, payment_status, status
      INTO v_order
      FROM orders
     WHERE id = p_order_id
       AND deleted_at IS NULL
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'order not found';
    END IF;

    IF v_order.status IN ('cancelled', 'refunded') THEN
        RAISE EXCEPTION 'order is not payable';
    END IF;

    IF p_provider_order_id IS NOT NULL
       AND v_order.payment_id IS NOT NULL
       AND v_order.payment_id <> p_provider_order_id
       AND v_order.payment_id <> p_provider_payment_id THEN
        RAISE EXCEPTION 'payment reference mismatch';
    END IF;

    INSERT INTO payment_webhook_events (
        provider,
        provider_event_id,
        event_type,
        signature_valid,
        processing_status,
        raw_payload,
        processed_at
    )
    VALUES (
        p_provider,
        v_event_id,
        'checkout.payment.confirmed',
        TRUE,
        'processed',
        jsonb_build_object(
            'order_id', p_order_id,
            'provider', p_provider,
            'provider_order_id', p_provider_order_id,
            'provider_payment_id', p_provider_payment_id,
            'request_id', p_request_id
        ),
        NOW()
    )
    ON CONFLICT (provider, provider_event_id)
    DO UPDATE SET
        signature_valid = TRUE,
        processing_status = 'processed',
        processed_at = COALESCE(payment_webhook_events.processed_at, NOW()),
        updated_at = NOW();

    IF v_order.payment_status = 'paid' THEN
        SELECT to_jsonb(o)
          INTO v_order_json
          FROM orders o
         WHERE o.id = p_order_id;
        RETURN v_order_json;
    END IF;

    UPDATE orders
       SET payment_status = 'paid',
           payment_id = p_provider_payment_id,
           payment_method = p_provider,
           payment_gateway = p_provider,
           status = 'confirmed',
           payment_processed_at = NOW(),
           last_payment_event_id = v_event_id,
           payment_failure_reason = NULL,
           updated_at = NOW()
     WHERE id = p_order_id
     RETURNING to_jsonb(orders.*) INTO v_order_json;

    INSERT INTO outbox_events (
        store_id,
        aggregate_type,
        aggregate_id,
        event_type,
        payload,
        idempotency_key,
        request_id
    )
    VALUES (
        v_order.store_id,
        'order',
        p_order_id::TEXT,
        'payment.confirmed',
        jsonb_build_object(
            'store_id', v_order.store_id,
            'order_id', p_order_id,
            'provider', p_provider,
            'provider_payment_id', p_provider_payment_id,
            'provider_event_id', v_event_id
        ),
        'payment.confirmed:' || p_provider || ':' || p_provider_payment_id,
        p_request_id
    )
    ON CONFLICT (idempotency_key) DO NOTHING;

    INSERT INTO audit_activity_events (
        store_id,
        actor_type,
        action,
        resource_type,
        resource_id,
        request_id,
        after_state
    )
    VALUES (
        v_order.store_id,
        'webhook',
        'payment.confirm',
        'order',
        p_order_id::TEXT,
        p_request_id,
        jsonb_build_object(
            'order_id', p_order_id,
            'provider', p_provider,
            'provider_payment_id', p_provider_payment_id,
            'provider_event_id', v_event_id
        )
    );

    RETURN v_order_json;
END;
$$;


--
-- Name: confirm_order_payment_with_ledger(uuid, text, text, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.confirm_order_payment_with_ledger(p_order_id uuid, p_provider text, p_provider_payment_id text, p_provider_order_id text DEFAULT NULL::text, p_provider_event_id text DEFAULT NULL::text, p_request_id text DEFAULT NULL::text, p_idempotency_key text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_order_json JSONB;
    v_order RECORD;
    v_payment_transaction_id UUID;
BEGIN
    v_order_json := confirm_order_payment(
        p_order_id,
        p_provider,
        p_provider_payment_id,
        p_provider_order_id,
        p_provider_event_id,
        p_request_id
    );

    SELECT *
      INTO v_order
      FROM orders
     WHERE id = p_order_id
       AND deleted_at IS NULL;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'order not found';
    END IF;

    UPDATE payment_transactions
       SET gateway_txn_id = COALESCE(p_provider_payment_id, gateway_txn_id),
           provider_order_id = COALESCE(p_provider_order_id, provider_order_id),
           provider_payment_id = p_provider_payment_id,
           provider_event_id = COALESCE(p_provider_event_id, provider_event_id),
           status = 'captured',
           captured_at = COALESCE(captured_at, NOW()),
           request_id = COALESCE(p_request_id, request_id),
           idempotency_key = COALESCE(p_idempotency_key, idempotency_key),
           updated_at = NOW()
     WHERE order_id = p_order_id
       AND gateway = p_provider
       AND deleted_at IS NULL
     RETURNING id INTO v_payment_transaction_id;

    IF v_payment_transaction_id IS NULL THEN
        INSERT INTO payment_transactions (
            order_id,
            store_id,
            site_id,
            gateway,
            gateway_txn_id,
            provider_order_id,
            provider_payment_id,
            provider_event_id,
            amount,
            currency,
            status,
            payment_method,
            metadata,
            request_id,
            idempotency_key,
            captured_at
        )
        VALUES (
            p_order_id,
            v_order.store_id,
            v_order.store_id,
            p_provider,
            p_provider_payment_id,
            p_provider_order_id,
            p_provider_payment_id,
            p_provider_event_id,
            COALESCE(v_order.total, 0),
            COALESCE(v_order.currency, 'INR'),
            'captured',
            p_provider,
            jsonb_build_object('source', 'payment_confirmation'),
            p_request_id,
            p_idempotency_key,
            NOW()
        )
        RETURNING id INTO v_payment_transaction_id;
    END IF;

    INSERT INTO payment_attempts (
        site_id,
        order_id,
        payment_transaction_id,
        provider,
        attempt_type,
        status,
        amount,
        currency,
        provider_order_id,
        provider_payment_id,
        provider_event_id,
        idempotency_key,
        request_id,
        metadata
    )
    VALUES (
        v_order.store_id,
        p_order_id,
        v_payment_transaction_id,
        p_provider,
        'capture',
        'succeeded',
        COALESCE(v_order.total, 0),
        COALESCE(v_order.currency, 'INR'),
        p_provider_order_id,
        p_provider_payment_id,
        COALESCE(p_provider_event_id, 'capture:' || p_provider || ':' || p_provider_payment_id),
        p_idempotency_key,
        p_request_id,
        jsonb_build_object('provider_payment_id', p_provider_payment_id)
    )
    ON CONFLICT DO NOTHING;

    RETURN v_order_json;
END;
$$;


--
-- Name: create_checkout_order(uuid, text, text, text, jsonb, jsonb, text, text, text, text, text, text, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_checkout_order(p_store_id uuid, p_customer_name text, p_customer_email text, p_customer_phone text, p_shipping_address jsonb, p_items jsonb, p_payment_method text, p_notes text DEFAULT NULL::text, p_coupon_code text DEFAULT NULL::text, p_gift_card_code text DEFAULT NULL::text, p_shipping_method text DEFAULT 'standard'::text, p_idempotency_key text DEFAULT NULL::text, p_actor_id uuid DEFAULT NULL::uuid, p_request_id text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_existing_order_id UUID;
    v_order_json JSONB;
    v_order_id UUID;
    v_order RECORD;
    v_shipping_method TEXT := COALESCE(NULLIF(BTRIM(p_shipping_method), ''), 'standard');
    v_shipping_amount NUMERIC(12,2) := 0;
    v_tax_amount NUMERIC(12,2) := 0;
    v_discount_amount NUMERIC(12,2) := 0;
    v_gift_card_amount NUMERIC(12,2) := 0;
    v_grand_total NUMERIC(12,2) := 0;
    v_payment_due NUMERIC(12,2) := 0;
    v_promotion JSONB := jsonb_build_object('valid', false, 'discount', 0);
    v_gift_card RECORD;
    v_payment_transaction_id UUID;
BEGIN
    IF p_store_id IS NULL THEN
        RAISE EXCEPTION 'store_id is required';
    END IF;

    IF p_idempotency_key IS NULL OR BTRIM(p_idempotency_key) = '' THEN
        RAISE EXCEPTION 'idempotency_key is required';
    END IF;

    IF p_payment_method NOT IN ('razorpay', 'stripe', 'paypal', 'cod') THEN
        RAISE EXCEPTION 'unsupported payment method: %', p_payment_method;
    END IF;

    SELECT order_id
      INTO v_existing_order_id
      FROM checkout_sessions
     WHERE site_id = p_store_id
       AND idempotency_key = p_idempotency_key
       AND deleted_at IS NULL
     LIMIT 1;

    IF v_existing_order_id IS NOT NULL THEN
        SELECT to_jsonb(o)
          INTO v_order_json
          FROM orders o
         WHERE o.id = v_existing_order_id
           AND o.deleted_at IS NULL;

        IF v_order_json IS NOT NULL THEN
            RETURN v_order_json;
        END IF;
    END IF;

    IF v_shipping_method = 'express' THEN
        v_shipping_amount := 99;
    ELSIF v_shipping_method = 'standard' THEN
        v_shipping_amount := 0;
    ELSE
        RAISE EXCEPTION 'unsupported shipping method: %', v_shipping_method;
    END IF;

    v_order_json := create_order_with_inventory_reservations(
        p_store_id,
        p_customer_name,
        p_customer_email,
        p_customer_phone,
        COALESCE(p_shipping_address, '{}'::JSONB),
        p_items,
        p_payment_method,
        p_notes,
        NULL,
        p_actor_id,
        p_request_id
    );

    v_order_id := (v_order_json ->> 'id')::UUID;

    SELECT *
      INTO v_order
      FROM orders
     WHERE id = v_order_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'created order not found';
    END IF;

    IF NULLIF(BTRIM(COALESCE(p_coupon_code, '')), '') IS NOT NULL THEN
        v_promotion := evaluate_checkout_promotion(
            p_store_id,
            p_coupon_code,
            COALESCE(v_order.subtotal, 0),
            v_shipping_amount,
            p_customer_email
        );
        v_discount_amount := COALESCE((v_promotion ->> 'discount')::NUMERIC, 0);
    END IF;

    v_grand_total := GREATEST(COALESCE(v_order.subtotal, 0) + v_shipping_amount + v_tax_amount - v_discount_amount, 0);

    IF NULLIF(BTRIM(COALESCE(p_gift_card_code, '')), '') IS NOT NULL THEN
        SELECT *
          INTO v_gift_card
          FROM gift_card_accounts gca
         WHERE gca.site_id = p_store_id
           AND gca.code_hash = encode(digest(p_gift_card_code, 'sha256'), 'hex')
           AND gca.status = 'active'
           AND gca.deleted_at IS NULL
           AND (gca.expires_at IS NULL OR gca.expires_at >= NOW())
         FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'gift card is invalid or unavailable';
        END IF;

        v_gift_card_amount := LEAST(COALESCE(v_gift_card.balance, 0), v_grand_total);

        IF v_gift_card_amount <= 0 THEN
            RAISE EXCEPTION 'gift card has no redeemable balance';
        END IF;

        UPDATE gift_card_accounts
           SET balance = balance - v_gift_card_amount,
               updated_at = NOW(),
               updated_by = p_actor_id
         WHERE id = v_gift_card.id;

        INSERT INTO gift_card_redemptions (
            site_id,
            gift_card_account_id,
            order_id,
            amount,
            status,
            idempotency_key,
            request_id,
            metadata,
            created_by
        )
        VALUES (
            p_store_id,
            v_gift_card.id,
            v_order_id,
            v_gift_card_amount,
            'committed',
            'gift_card.redemption:' || v_order_id::TEXT || ':' || v_gift_card.id::TEXT,
            p_request_id,
            jsonb_build_object('code_last4', v_gift_card.code_last4),
            p_actor_id
        )
        ON CONFLICT (site_id, idempotency_key) DO NOTHING;

        INSERT INTO gift_card_ledger_entries (
            site_id,
            gift_card_account_id,
            order_id,
            entry_type,
            amount,
            balance_after,
            idempotency_key,
            request_id,
            metadata,
            created_by
        )
        VALUES (
            p_store_id,
            v_gift_card.id,
            v_order_id,
            'debit',
            v_gift_card_amount,
            COALESCE(v_gift_card.balance, 0) - v_gift_card_amount,
            'gift_card.debit:' || v_order_id::TEXT || ':' || v_gift_card.id::TEXT,
            p_request_id,
            jsonb_build_object('code_last4', v_gift_card.code_last4),
            p_actor_id
        )
        ON CONFLICT (site_id, idempotency_key) DO NOTHING;
    END IF;

    v_payment_due := GREATEST(v_grand_total - v_gift_card_amount, 0);

    UPDATE orders
       SET shipping_cost = v_shipping_amount,
           shipping_method = v_shipping_method,
           tax = v_tax_amount,
           discount = v_discount_amount,
           total = v_payment_due,
           coupon_code = NULLIF(UPPER(BTRIM(COALESCE(p_coupon_code, ''))), ''),
           coupon_discount = v_discount_amount,
           currency = COALESCE(currency, 'INR'),
           payment_status = CASE WHEN v_payment_due = 0 THEN 'paid' ELSE payment_status END,
           status = CASE WHEN v_payment_due = 0 THEN 'confirmed' ELSE status END,
           updated_at = NOW()
     WHERE id = v_order_id;

    INSERT INTO checkout_sessions (
        site_id,
        order_id,
        customer_email,
        status,
        idempotency_key,
        subtotal,
        shipping_total,
        tax_total,
        discount_total,
        gift_card_total,
        grand_total,
        currency,
        shipping_method,
        payment_method,
        request_id,
        metadata,
        created_by
    )
    VALUES (
        p_store_id,
        v_order_id,
        p_customer_email,
        'completed',
        p_idempotency_key,
        COALESCE(v_order.subtotal, 0),
        v_shipping_amount,
        v_tax_amount,
        v_discount_amount,
        v_gift_card_amount,
        v_grand_total,
        COALESCE(v_order.currency, 'INR'),
        v_shipping_method,
        p_payment_method,
        p_request_id,
        jsonb_build_object('source', 'create_checkout_order', 'payment_due', v_payment_due, 'promotion', v_promotion),
        p_actor_id
    )
    ON CONFLICT (site_id, idempotency_key) DO NOTHING;

    INSERT INTO order_shipping_lines (
        site_id,
        order_id,
        title,
        method,
        amount,
        metadata,
        created_by
    )
    VALUES (
        p_store_id,
        v_order_id,
        CASE WHEN v_shipping_method = 'express' THEN 'Express Shipping' ELSE 'Standard Shipping' END,
        v_shipping_method,
        v_shipping_amount,
        jsonb_build_object('computed_by', 'create_checkout_order'),
        p_actor_id
    );

    IF v_discount_amount > 0 THEN
        INSERT INTO order_line_adjustments (
            site_id,
            order_id,
            adjustment_type,
            source_type,
            source_id,
            title,
            amount,
            metadata,
            created_by
        )
        VALUES (
            p_store_id,
            v_order_id,
            'promotion',
            CASE WHEN (v_promotion ->> 'promotion_id') IS NOT NULL THEN 'promotion' ELSE 'coupon' END,
            COALESCE(NULLIF(v_promotion ->> 'promotion_id', '')::UUID, NULLIF(v_promotion ->> 'coupon_id', '')::UUID),
            COALESCE(v_promotion ->> 'title', 'Promotion'),
            v_discount_amount,
            v_promotion,
            p_actor_id
        );

        INSERT INTO promotion_redemptions (
            site_id,
            promotion_id,
            promotion_code_id,
            coupon_id,
            order_id,
            customer_email,
            code,
            amount,
            status,
            idempotency_key,
            request_id,
            metadata,
            created_by
        )
        VALUES (
            p_store_id,
            NULLIF(v_promotion ->> 'promotion_id', '')::UUID,
            NULLIF(v_promotion ->> 'promotion_code_id', '')::UUID,
            NULLIF(v_promotion ->> 'coupon_id', '')::UUID,
            v_order_id,
            p_customer_email,
            v_promotion ->> 'code',
            v_discount_amount,
            'committed',
            'promotion.redemption:' || v_order_id::TEXT || ':' || COALESCE(v_promotion ->> 'code', 'unknown'),
            p_request_id,
            v_promotion,
            p_actor_id
        )
        ON CONFLICT (site_id, idempotency_key) DO NOTHING;

        UPDATE promotion_codes
           SET usage_count = usage_count + 1,
               updated_at = NOW()
         WHERE id = NULLIF(v_promotion ->> 'promotion_code_id', '')::UUID;

        UPDATE coupons
           SET usage_count = COALESCE(usage_count, 0) + 1,
               updated_at = NOW()
         WHERE id = NULLIF(v_promotion ->> 'coupon_id', '')::UUID;

        INSERT INTO promotion_usage_counters (
            site_id,
            promotion_id,
            promotion_code_id,
            coupon_id,
            customer_email,
            usage_count
        )
        VALUES (
            p_store_id,
            NULLIF(v_promotion ->> 'promotion_id', '')::UUID,
            NULLIF(v_promotion ->> 'promotion_code_id', '')::UUID,
            NULLIF(v_promotion ->> 'coupon_id', '')::UUID,
            LOWER(p_customer_email),
            1
        )
        ON CONFLICT (site_id, promotion_id, promotion_code_id, coupon_id, customer_email)
        DO UPDATE SET usage_count = promotion_usage_counters.usage_count + 1,
                      updated_at = NOW();
    END IF;

    INSERT INTO payment_transactions (
        order_id,
        store_id,
        site_id,
        gateway,
        amount,
        currency,
        status,
        payment_method,
        metadata,
        request_id,
        idempotency_key,
        created_by,
        captured_at
    )
    VALUES (
        v_order_id,
        p_store_id,
        p_store_id,
        p_payment_method,
        v_payment_due,
        COALESCE(v_order.currency, 'INR'),
        CASE WHEN v_payment_due = 0 THEN 'captured' ELSE 'pending' END,
        p_payment_method,
        jsonb_build_object('source', 'checkout', 'gift_card_total', v_gift_card_amount),
        p_request_id,
        p_idempotency_key || ':payment',
        p_actor_id,
        CASE WHEN v_payment_due = 0 THEN NOW() ELSE NULL END
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_payment_transaction_id;

    INSERT INTO inventory_events (
        site_id,
        inventory_level_id,
        location_id,
        product_id,
        variant_id,
        order_id,
        reservation_id,
        event_type,
        quantity_delta,
        on_hand_quantity,
        available_quantity,
        committed_quantity,
        unavailable_quantity,
        incoming_quantity,
        reserved_quantity,
        safety_stock_quantity,
        source_type,
        source_id,
        idempotency_key,
        request_id,
        metadata,
        created_by
    )
    SELECT
        p_store_id,
        il.id,
        r.location_id,
        oi.product_id,
        oi.variant_id,
        v_order_id,
        r.id,
        'sale_committed',
        -oi.quantity,
        COALESCE(il.on_hand_quantity, il.available + il.reserved),
        COALESCE(il.available_quantity, il.available),
        oi.quantity,
        COALESCE(il.unavailable_quantity, 0),
        COALESCE(il.incoming_quantity, il.incoming),
        COALESCE(il.reserved_quantity, il.reserved),
        COALESCE(il.safety_stock_quantity, 0),
        'order',
        v_order_id,
        'checkout.sale_committed:' || v_order_id::TEXT || ':' || oi.id::TEXT,
        p_request_id,
        jsonb_build_object('checkout_session_idempotency_key', p_idempotency_key),
        p_actor_id
      FROM order_items oi
      LEFT JOIN inventory_reservations r
        ON r.order_id = oi.order_id
       AND r.product_id = oi.product_id
       AND ((r.variant_id IS NULL AND oi.variant_id IS NULL) OR r.variant_id = oi.variant_id)
       AND r.deleted_at IS NULL
      LEFT JOIN inventory_levels il
        ON il.location_id = r.location_id
       AND il.product_id = oi.product_id
       AND ((il.variant_id IS NULL AND oi.variant_id IS NULL) OR il.variant_id = oi.variant_id)
     WHERE oi.order_id = v_order_id
       AND oi.deleted_at IS NULL
    ON CONFLICT (site_id, idempotency_key) DO NOTHING;

    INSERT INTO outbox_events (
        site_id,
        store_id,
        aggregate_type,
        aggregate_id,
        event_type,
        payload,
        idempotency_key,
        request_id,
        trace_id,
        schema_version,
        actor_id
    )
    VALUES (
        p_store_id,
        p_store_id,
        'checkout',
        v_order_id::TEXT,
        'checkout.completed',
        jsonb_build_object(
            'site_id', p_store_id,
            'order_id', v_order_id,
            'payment_transaction_id', v_payment_transaction_id,
            'subtotal', COALESCE(v_order.subtotal, 0),
            'shipping_total', v_shipping_amount,
            'tax_total', v_tax_amount,
            'discount_total', v_discount_amount,
            'gift_card_total', v_gift_card_amount,
            'grand_total', v_grand_total,
            'payment_due', v_payment_due,
            'schema_version', 1
        ),
        'checkout.completed:' || v_order_id::TEXT,
        p_request_id,
        p_request_id,
        1,
        p_actor_id
    )
    ON CONFLICT (idempotency_key) DO NOTHING;

    SELECT to_jsonb(o)
      INTO v_order_json
      FROM orders o
     WHERE o.id = v_order_id;

    RETURN v_order_json;
END;
$$;


--
-- Name: create_inventory_transfer_with_lines(uuid, uuid, uuid, jsonb, text, uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_inventory_transfer_with_lines(p_site_id uuid, p_source_location_id uuid, p_destination_location_id uuid, p_lines jsonb, p_notes text DEFAULT NULL::text, p_actor_id uuid DEFAULT NULL::uuid, p_request_id text DEFAULT NULL::text, p_idempotency_key text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_transfer_id UUID;
    v_existing_id UUID;
    v_line RECORD;
    v_product RECORD;
    v_source_level_id UUID;
    v_transfer_number TEXT;
BEGIN
    IF p_idempotency_key IS NULL OR BTRIM(p_idempotency_key) = '' THEN
        RAISE EXCEPTION 'idempotency_key is required';
    END IF;

    IF p_source_location_id = p_destination_location_id THEN
        RAISE EXCEPTION 'source and destination locations must be different';
    END IF;

    IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
        RAISE EXCEPTION 'transfer lines are required';
    END IF;

    SELECT id INTO v_existing_id
    FROM inventory_transfers
    WHERE site_id = p_site_id AND idempotency_key = p_idempotency_key AND deleted_at IS NULL
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
        RETURN jsonb_build_object('transfer_id', v_existing_id, 'idempotent_replay', true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM inventory_locations WHERE id = p_source_location_id AND store_id = p_site_id AND deleted_at IS NULL)
       OR NOT EXISTS (SELECT 1 FROM inventory_locations WHERE id = p_destination_location_id AND store_id = p_site_id AND deleted_at IS NULL) THEN
        RAISE EXCEPTION 'transfer locations must belong to site';
    END IF;

    v_transfer_number := 'TR-' || to_char(NOW(), 'YYYYMMDD') || '-' || upper(substr(gen_random_uuid()::TEXT, 1, 8));

    INSERT INTO inventory_transfers (
        site_id, transfer_number, source_location_id, destination_location_id, status,
        notes, idempotency_key, request_id, created_by
    )
    VALUES (
        p_site_id, v_transfer_number, p_source_location_id, p_destination_location_id, 'reserved',
        p_notes, p_idempotency_key, p_request_id, p_actor_id
    )
    RETURNING id INTO v_transfer_id;

    FOR v_line IN
        SELECT * FROM jsonb_to_recordset(p_lines) AS x(product_id UUID, variant_id UUID, quantity INTEGER)
    LOOP
        IF COALESCE(v_line.quantity, 0) <= 0 THEN
            RAISE EXCEPTION 'transfer quantity must be positive';
        END IF;

        SELECT id INTO v_product
        FROM products
        WHERE id = v_line.product_id AND store_id = p_site_id AND deleted_at IS NULL;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'product % not found for site', v_line.product_id;
        END IF;

        v_source_level_id := ensure_inventory_level_for_location(v_line.product_id, v_line.variant_id, p_source_location_id);

        IF NOT EXISTS (
            SELECT 1 FROM inventory_levels
            WHERE id = v_source_level_id AND available >= v_line.quantity
            FOR UPDATE
        ) THEN
            RAISE EXCEPTION 'insufficient source inventory for product %', v_line.product_id;
        END IF;

        UPDATE inventory_levels
           SET available = available - v_line.quantity,
               reserved = reserved + v_line.quantity,
               available_quantity = GREATEST(COALESCE(available_quantity, available) - v_line.quantity, 0),
               reserved_quantity = COALESCE(reserved_quantity, reserved) + v_line.quantity,
               updated_at = NOW()
         WHERE id = v_source_level_id;

        INSERT INTO inventory_transfer_lines (
            site_id, transfer_id, product_id, variant_id, quantity_requested, quantity_shipped, status, created_by
        )
        VALUES (
            p_site_id, v_transfer_id, v_line.product_id, v_line.variant_id, v_line.quantity, 0, 'reserved', p_actor_id
        );

        INSERT INTO inventory_events (
            site_id, inventory_level_id, location_id, product_id, variant_id,
            event_type, quantity_delta, on_hand_quantity, available_quantity,
            committed_quantity, unavailable_quantity, incoming_quantity, reserved_quantity,
            safety_stock_quantity, source_type, source_id, idempotency_key, request_id, metadata, created_by
        )
        SELECT
            p_site_id, il.id, p_source_location_id, v_line.product_id, v_line.variant_id,
            'transfer_reserved', -v_line.quantity, COALESCE(il.on_hand_quantity, il.available + il.reserved),
            COALESCE(il.available_quantity, il.available), COALESCE(il.committed_quantity, 0),
            COALESCE(il.unavailable_quantity, 0), COALESCE(il.incoming_quantity, il.incoming),
            COALESCE(il.reserved_quantity, il.reserved), COALESCE(il.safety_stock_quantity, 0),
            'inventory_transfer', v_transfer_id, 'inventory.transfer_reserved:' || v_transfer_id::TEXT || ':' || v_line.product_id::TEXT || ':' || COALESCE(v_line.variant_id::TEXT, 'default'),
            p_request_id, jsonb_build_object('source_location_id', p_source_location_id, 'destination_location_id', p_destination_location_id),
            p_actor_id
        FROM inventory_levels il WHERE il.id = v_source_level_id
        ON CONFLICT (site_id, idempotency_key) DO NOTHING;
    END LOOP;

    RETURN jsonb_build_object(
        'transfer', (SELECT to_jsonb(t) FROM inventory_transfers t WHERE t.id = v_transfer_id),
        'lines', (SELECT COALESCE(jsonb_agg(to_jsonb(tl)), '[]'::JSONB) FROM inventory_transfer_lines tl WHERE tl.transfer_id = v_transfer_id)
    );
END;
$$;


--
-- Name: create_notification(uuid, text, text, text, jsonb, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_notification(p_user_id uuid, p_type text, p_title text, p_message text DEFAULT NULL::text, p_data jsonb DEFAULT '{}'::jsonb, p_action_url text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO notifications (user_id, type, title, message, data, action_url)
  VALUES (p_user_id, p_type, p_title, p_message, p_data, p_action_url)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;


--
-- Name: create_order_fulfillment(uuid, jsonb, uuid, text, text, text, uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_order_fulfillment(p_order_id uuid, p_lines jsonb DEFAULT NULL::jsonb, p_location_id uuid DEFAULT NULL::uuid, p_carrier text DEFAULT NULL::text, p_tracking_number text DEFAULT NULL::text, p_tracking_url text DEFAULT NULL::text, p_actor_id uuid DEFAULT NULL::uuid, p_request_id text DEFAULT NULL::text, p_idempotency_key text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_order RECORD;
    v_existing_id UUID;
    v_fulfillment_id UUID;
    v_shipment_id UUID;
    v_line RECORD;
    v_item RECORD;
    v_quantity INTEGER;
    v_remaining INTEGER;
    v_line_count INTEGER := 0;
    v_all_fulfilled BOOLEAN := FALSE;
BEGIN
    IF p_idempotency_key IS NULL OR BTRIM(p_idempotency_key) = '' THEN
        RAISE EXCEPTION 'idempotency_key is required';
    END IF;

    SELECT *
      INTO v_order
      FROM orders
     WHERE id = p_order_id
       AND deleted_at IS NULL
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'order not found';
    END IF;

    IF v_order.status IN ('cancelled', 'refunded') THEN
        RAISE EXCEPTION 'order cannot be fulfilled from status %', v_order.status;
    END IF;

    SELECT id
      INTO v_existing_id
      FROM fulfillment_orders
     WHERE site_id = v_order.store_id
       AND idempotency_key = p_idempotency_key
       AND deleted_at IS NULL
     LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'order', (SELECT to_jsonb(o) FROM orders o WHERE o.id = p_order_id),
            'fulfillment_order_id', v_existing_id,
            'idempotent_replay', true
        );
    END IF;

    INSERT INTO fulfillment_orders (
        site_id,
        order_id,
        location_id,
        status,
        idempotency_key,
        request_id,
        assigned_at,
        picked_at,
        packed_at,
        shipped_at,
        metadata,
        created_by
    )
    VALUES (
        v_order.store_id,
        p_order_id,
        p_location_id,
        'in_progress',
        p_idempotency_key,
        p_request_id,
        NOW(),
        NOW(),
        NOW(),
        CASE WHEN p_tracking_number IS NOT NULL THEN NOW() ELSE NULL END,
        jsonb_build_object('source', 'create_order_fulfillment'),
        p_actor_id
    )
    RETURNING id INTO v_fulfillment_id;

    IF p_lines IS NOT NULL AND jsonb_typeof(p_lines) = 'array' AND jsonb_array_length(p_lines) > 0 THEN
        FOR v_line IN
            SELECT *
            FROM jsonb_to_recordset(p_lines) AS x(order_item_id UUID, quantity INTEGER)
        LOOP
            SELECT *
              INTO v_item
              FROM order_items
             WHERE id = v_line.order_item_id
               AND order_id = p_order_id
               AND deleted_at IS NULL
             FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'order item % not found', v_line.order_item_id;
            END IF;

            v_quantity := COALESCE(v_line.quantity, 0);
            v_remaining := v_item.quantity - COALESCE(v_item.fulfilled_quantity, 0);

            IF v_quantity <= 0 OR v_quantity > v_remaining THEN
                RAISE EXCEPTION 'invalid fulfillment quantity for order item %', v_item.id;
            END IF;

            INSERT INTO fulfillment_order_lines (
                site_id,
                fulfillment_order_id,
                order_id,
                order_item_id,
                product_id,
                variant_id,
                quantity,
                fulfilled_quantity,
                status,
                created_by
            )
            VALUES (
                v_order.store_id,
                v_fulfillment_id,
                p_order_id,
                v_item.id,
                v_item.product_id,
                v_item.variant_id,
                v_quantity,
                v_quantity,
                CASE WHEN p_tracking_number IS NOT NULL THEN 'shipped' ELSE 'packed' END,
                p_actor_id
            );

            UPDATE order_items
               SET fulfilled_quantity = COALESCE(fulfilled_quantity, 0) + v_quantity,
                   fulfillment_status = CASE
                       WHEN COALESCE(fulfilled_quantity, 0) + v_quantity >= quantity THEN 'fulfilled'
                       ELSE 'partial'
                   END,
                   updated_at = NOW()
             WHERE id = v_item.id;

            v_line_count := v_line_count + 1;
        END LOOP;
    ELSE
        FOR v_item IN
            SELECT *
              FROM order_items
             WHERE order_id = p_order_id
               AND deleted_at IS NULL
             FOR UPDATE
        LOOP
            v_quantity := v_item.quantity - COALESCE(v_item.fulfilled_quantity, 0);
            IF v_quantity <= 0 THEN
                CONTINUE;
            END IF;

            INSERT INTO fulfillment_order_lines (
                site_id,
                fulfillment_order_id,
                order_id,
                order_item_id,
                product_id,
                variant_id,
                quantity,
                fulfilled_quantity,
                status,
                created_by
            )
            VALUES (
                v_order.store_id,
                v_fulfillment_id,
                p_order_id,
                v_item.id,
                v_item.product_id,
                v_item.variant_id,
                v_quantity,
                v_quantity,
                CASE WHEN p_tracking_number IS NOT NULL THEN 'shipped' ELSE 'packed' END,
                p_actor_id
            );

            UPDATE order_items
               SET fulfilled_quantity = COALESCE(fulfilled_quantity, 0) + v_quantity,
                   fulfillment_status = 'fulfilled',
                   updated_at = NOW()
             WHERE id = v_item.id;

            v_line_count := v_line_count + 1;
        END LOOP;
    END IF;

    IF v_line_count = 0 THEN
        RAISE EXCEPTION 'no fulfillable order lines remain';
    END IF;

    SELECT COALESCE(bool_and(COALESCE(fulfilled_quantity, 0) >= quantity), FALSE)
      INTO v_all_fulfilled
      FROM order_items
     WHERE order_id = p_order_id
       AND deleted_at IS NULL;

    UPDATE fulfillment_orders
       SET status = CASE WHEN v_all_fulfilled THEN 'fulfilled' ELSE 'partially_fulfilled' END,
           shipped_at = CASE WHEN p_tracking_number IS NOT NULL THEN COALESCE(shipped_at, NOW()) ELSE shipped_at END,
           updated_by = p_actor_id,
           updated_at = NOW()
     WHERE id = v_fulfillment_id;

    IF p_tracking_number IS NOT NULL OR p_carrier IS NOT NULL THEN
        INSERT INTO shipments (
            site_id,
            order_id,
            fulfillment_order_id,
            status,
            carrier,
            tracking_number,
            tracking_url,
            shipped_at,
            idempotency_key,
            request_id,
            created_by
        )
        VALUES (
            v_order.store_id,
            p_order_id,
            v_fulfillment_id,
            'shipped',
            p_carrier,
            p_tracking_number,
            p_tracking_url,
            NOW(),
            p_idempotency_key || ':shipment',
            p_request_id,
            p_actor_id
        )
        RETURNING id INTO v_shipment_id;

        INSERT INTO shipment_events (
            site_id,
            shipment_id,
            order_id,
            event_type,
            status,
            description,
            request_id,
            metadata,
            created_by
        )
        VALUES (
            v_order.store_id,
            v_shipment_id,
            p_order_id,
            'shipped',
            'shipped',
            'Shipment marked as shipped',
            p_request_id,
            jsonb_build_object('carrier', p_carrier, 'tracking_number', p_tracking_number),
            p_actor_id
        );
    END IF;

    UPDATE orders
       SET status = CASE WHEN p_tracking_number IS NOT NULL OR p_carrier IS NOT NULL THEN 'shipped' ELSE 'processing' END,
           fulfillment_status = CASE WHEN v_all_fulfilled THEN 'fulfilled' ELSE 'partial' END,
           tracking_number = COALESCE(p_tracking_number, tracking_number),
           carrier = COALESCE(p_carrier, carrier),
           updated_at = NOW(),
           updated_by = p_actor_id
     WHERE id = p_order_id;

    IF v_all_fulfilled THEN
        UPDATE inventory_reservations
           SET status = 'fulfilled',
               updated_at = NOW()
         WHERE order_id = p_order_id
           AND status = 'committed'
           AND deleted_at IS NULL;
    END IF;

    INSERT INTO outbox_events (
        site_id,
        store_id,
        aggregate_type,
        aggregate_id,
        event_type,
        payload,
        idempotency_key,
        request_id,
        trace_id,
        schema_version,
        actor_id
    )
    VALUES (
        v_order.store_id,
        v_order.store_id,
        'fulfillment_order',
        v_fulfillment_id::TEXT,
        'fulfillment.shipped',
        jsonb_build_object(
            'site_id', v_order.store_id,
            'order_id', p_order_id,
            'fulfillment_order_id', v_fulfillment_id,
            'shipment_id', v_shipment_id,
            'all_fulfilled', v_all_fulfilled
        ),
        'fulfillment.shipped:' || v_fulfillment_id::TEXT,
        p_request_id,
        p_request_id,
        1,
        p_actor_id
    )
    ON CONFLICT (idempotency_key) DO NOTHING;

    RETURN jsonb_build_object(
        'order', (SELECT to_jsonb(o) FROM orders o WHERE o.id = p_order_id),
        'fulfillment_order_id', v_fulfillment_id,
        'shipment_id', v_shipment_id,
        'all_fulfilled', v_all_fulfilled
    );
END;
$$;


--
-- Name: create_order_return_and_refund(uuid, jsonb, text, text, boolean, uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_order_return_and_refund(p_order_id uuid, p_lines jsonb DEFAULT NULL::jsonb, p_reason text DEFAULT NULL::text, p_refund_method text DEFAULT 'original_payment'::text, p_restock boolean DEFAULT false, p_actor_id uuid DEFAULT NULL::uuid, p_request_id text DEFAULT NULL::text, p_idempotency_key text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_order RECORD;
    v_existing_return_id UUID;
    v_return_id UUID;
    v_refund_id UUID;
    v_refund_transaction_id UUID;
    v_payment_transaction_id UUID;
    v_line RECORD;
    v_item RECORD;
    v_quantity INTEGER;
    v_restock_quantity INTEGER;
    v_returnable INTEGER;
    v_refund_amount NUMERIC(12,2);
    v_total_refund NUMERIC(12,2) := 0;
    v_return_line_id UUID;
    v_level_id UUID;
    v_location_id UUID;
BEGIN
    IF p_idempotency_key IS NULL OR BTRIM(p_idempotency_key) = '' THEN
        RAISE EXCEPTION 'idempotency_key is required';
    END IF;

    IF p_refund_method NOT IN ('original_payment', 'gift_card', 'manual') THEN
        RAISE EXCEPTION 'unsupported refund method: %', p_refund_method;
    END IF;

    SELECT *
      INTO v_order
      FROM orders
     WHERE id = p_order_id
       AND deleted_at IS NULL
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'order not found';
    END IF;

    IF v_order.status IN ('cancelled', 'refunded') THEN
        RAISE EXCEPTION 'order cannot be returned from status %', v_order.status;
    END IF;

    SELECT id
      INTO v_existing_return_id
      FROM returns
     WHERE site_id = v_order.store_id
       AND idempotency_key = p_idempotency_key
       AND deleted_at IS NULL
     LIMIT 1;

    IF v_existing_return_id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'order', (SELECT to_jsonb(o) FROM orders o WHERE o.id = p_order_id),
            'return_id', v_existing_return_id,
            'idempotent_replay', true
        );
    END IF;

    SELECT id
      INTO v_payment_transaction_id
      FROM payment_transactions
     WHERE order_id = p_order_id
       AND site_id = v_order.store_id
       AND status IN ('captured', 'completed', 'partially_refunded')
       AND deleted_at IS NULL
     ORDER BY captured_at DESC NULLS LAST, created_at DESC
     LIMIT 1;

    INSERT INTO returns (
        site_id,
        order_id,
        status,
        customer_email,
        reason,
        refund_method,
        idempotency_key,
        request_id,
        authorized_at,
        metadata,
        created_by
    )
    VALUES (
        v_order.store_id,
        p_order_id,
        'approved',
        v_order.customer_email,
        p_reason,
        p_refund_method,
        p_idempotency_key,
        p_request_id,
        NOW(),
        jsonb_build_object('restock_requested', p_restock),
        p_actor_id
    )
    RETURNING id INTO v_return_id;

    IF p_lines IS NOT NULL AND jsonb_typeof(p_lines) = 'array' AND jsonb_array_length(p_lines) > 0 THEN
        FOR v_line IN
            SELECT *
            FROM jsonb_to_recordset(p_lines) AS x(order_item_id UUID, quantity INTEGER, restock_quantity INTEGER)
        LOOP
            SELECT *
              INTO v_item
              FROM order_items
             WHERE id = v_line.order_item_id
               AND order_id = p_order_id
               AND deleted_at IS NULL
             FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'order item % not found', v_line.order_item_id;
            END IF;

            v_quantity := COALESCE(v_line.quantity, 0);
            v_returnable := GREATEST(COALESCE(v_item.fulfilled_quantity, 0), v_item.quantity) - COALESCE(v_item.returned_quantity, 0);

            IF v_quantity <= 0 OR v_quantity > v_returnable THEN
                RAISE EXCEPTION 'invalid return quantity for order item %', v_item.id;
            END IF;

            v_refund_amount := ROUND(COALESCE(v_item.unit_price, 0) * v_quantity, 2);
            v_total_refund := v_total_refund + v_refund_amount;
            v_restock_quantity := CASE
                WHEN p_restock THEN LEAST(COALESCE(v_line.restock_quantity, v_quantity), v_quantity)
                ELSE 0
            END;

            INSERT INTO return_lines (
                site_id,
                return_id,
                order_id,
                order_item_id,
                product_id,
                variant_id,
                quantity,
                received_quantity,
                restock_quantity,
                refund_amount,
                reason,
                status,
                created_by
            )
            VALUES (
                v_order.store_id,
                v_return_id,
                p_order_id,
                v_item.id,
                v_item.product_id,
                v_item.variant_id,
                v_quantity,
                v_restock_quantity,
                v_restock_quantity,
                v_refund_amount,
                p_reason,
                CASE WHEN p_restock THEN 'restocked' ELSE 'authorized' END,
                p_actor_id
            )
            RETURNING id INTO v_return_line_id;

            UPDATE order_items
               SET returned_quantity = COALESCE(returned_quantity, 0) + v_quantity,
                   refunded_quantity = COALESCE(refunded_quantity, 0) + v_quantity,
                   fulfillment_status = CASE
                       WHEN COALESCE(returned_quantity, 0) + v_quantity >= quantity THEN 'returned'
                       ELSE fulfillment_status
                   END,
                   updated_at = NOW()
             WHERE id = v_item.id;

            IF v_restock_quantity > 0 THEN
                SELECT il.id, il.location_id
                  INTO v_level_id, v_location_id
                  FROM inventory_levels il
                  JOIN inventory_locations loc ON loc.id = il.location_id
                 WHERE il.product_id = v_item.product_id
                   AND ((v_item.variant_id IS NULL AND il.variant_id IS NULL) OR il.variant_id = v_item.variant_id)
                   AND loc.store_id = v_order.store_id
                   AND loc.status = 'active'
                   AND loc.deleted_at IS NULL
                 ORDER BY loc.is_default DESC, il.updated_at ASC
                 LIMIT 1
                 FOR UPDATE OF il;

                IF v_level_id IS NOT NULL THEN
                    UPDATE inventory_levels
                       SET available = available + v_restock_quantity,
                           available_quantity = COALESCE(available_quantity, available) + v_restock_quantity,
                           on_hand_quantity = COALESCE(on_hand_quantity, available + reserved) + v_restock_quantity,
                           updated_at = NOW()
                     WHERE id = v_level_id;

                    INSERT INTO restock_events (
                        site_id,
                        return_id,
                        return_line_id,
                        inventory_level_id,
                        location_id,
                        product_id,
                        variant_id,
                        order_id,
                        quantity,
                        status,
                        idempotency_key,
                        request_id,
                        metadata,
                        created_by
                    )
                    VALUES (
                        v_order.store_id,
                        v_return_id,
                        v_return_line_id,
                        v_level_id,
                        v_location_id,
                        v_item.product_id,
                        v_item.variant_id,
                        p_order_id,
                        v_restock_quantity,
                        'committed',
                        'restock.return:' || v_return_line_id::TEXT,
                        p_request_id,
                        jsonb_build_object('reason', p_reason),
                        p_actor_id
                    )
                    ON CONFLICT (site_id, idempotency_key) DO NOTHING;

                    INSERT INTO inventory_events (
                        site_id,
                        inventory_level_id,
                        location_id,
                        product_id,
                        variant_id,
                        order_id,
                        event_type,
                        quantity_delta,
                        on_hand_quantity,
                        available_quantity,
                        committed_quantity,
                        unavailable_quantity,
                        incoming_quantity,
                        reserved_quantity,
                        safety_stock_quantity,
                        source_type,
                        source_id,
                        idempotency_key,
                        request_id,
                        metadata,
                        created_by
                    )
                    SELECT
                        v_order.store_id,
                        il.id,
                        il.location_id,
                        v_item.product_id,
                        v_item.variant_id,
                        p_order_id,
                        'return_restocked',
                        v_restock_quantity,
                        COALESCE(il.on_hand_quantity, il.available + il.reserved),
                        COALESCE(il.available_quantity, il.available),
                        COALESCE(il.committed_quantity, 0),
                        COALESCE(il.unavailable_quantity, 0),
                        COALESCE(il.incoming_quantity, il.incoming),
                        COALESCE(il.reserved_quantity, il.reserved),
                        COALESCE(il.safety_stock_quantity, 0),
                        'return',
                        v_return_id,
                        'inventory.return_restocked:' || v_return_line_id::TEXT,
                        p_request_id,
                        jsonb_build_object('return_id', v_return_id, 'return_line_id', v_return_line_id),
                        p_actor_id
                    FROM inventory_levels il
                    WHERE il.id = v_level_id
                    ON CONFLICT (site_id, idempotency_key) DO NOTHING;
                END IF;
            END IF;
        END LOOP;
    ELSE
        FOR v_item IN
            SELECT *
              FROM order_items
             WHERE order_id = p_order_id
               AND deleted_at IS NULL
             FOR UPDATE
        LOOP
            v_quantity := GREATEST(COALESCE(v_item.fulfilled_quantity, 0), v_item.quantity) - COALESCE(v_item.returned_quantity, 0);
            IF v_quantity <= 0 THEN
                CONTINUE;
            END IF;

            v_refund_amount := ROUND(COALESCE(v_item.unit_price, 0) * v_quantity, 2);
            v_total_refund := v_total_refund + v_refund_amount;
            v_restock_quantity := CASE WHEN p_restock THEN v_quantity ELSE 0 END;

            INSERT INTO return_lines (
                site_id,
                return_id,
                order_id,
                order_item_id,
                product_id,
                variant_id,
                quantity,
                received_quantity,
                restock_quantity,
                refund_amount,
                reason,
                status,
                created_by
            )
            VALUES (
                v_order.store_id,
                v_return_id,
                p_order_id,
                v_item.id,
                v_item.product_id,
                v_item.variant_id,
                v_quantity,
                v_restock_quantity,
                v_restock_quantity,
                v_refund_amount,
                p_reason,
                CASE WHEN p_restock THEN 'restocked' ELSE 'authorized' END,
                p_actor_id
            )
            RETURNING id INTO v_return_line_id;

            UPDATE order_items
               SET returned_quantity = COALESCE(returned_quantity, 0) + v_quantity,
                   refunded_quantity = COALESCE(refunded_quantity, 0) + v_quantity,
                   fulfillment_status = 'returned',
                   updated_at = NOW()
             WHERE id = v_item.id;

            IF v_restock_quantity > 0 THEN
                SELECT il.id, il.location_id
                  INTO v_level_id, v_location_id
                  FROM inventory_levels il
                  JOIN inventory_locations loc ON loc.id = il.location_id
                 WHERE il.product_id = v_item.product_id
                   AND ((v_item.variant_id IS NULL AND il.variant_id IS NULL) OR il.variant_id = v_item.variant_id)
                   AND loc.store_id = v_order.store_id
                   AND loc.status = 'active'
                   AND loc.deleted_at IS NULL
                 ORDER BY loc.is_default DESC, il.updated_at ASC
                 LIMIT 1
                 FOR UPDATE OF il;

                IF v_level_id IS NOT NULL THEN
                    UPDATE inventory_levels
                       SET available = available + v_restock_quantity,
                           available_quantity = COALESCE(available_quantity, available) + v_restock_quantity,
                           on_hand_quantity = COALESCE(on_hand_quantity, available + reserved) + v_restock_quantity,
                           updated_at = NOW()
                     WHERE id = v_level_id;

                    INSERT INTO restock_events (
                        site_id,
                        return_id,
                        return_line_id,
                        inventory_level_id,
                        location_id,
                        product_id,
                        variant_id,
                        order_id,
                        quantity,
                        status,
                        idempotency_key,
                        request_id,
                        metadata,
                        created_by
                    )
                    VALUES (
                        v_order.store_id,
                        v_return_id,
                        v_return_line_id,
                        v_level_id,
                        v_location_id,
                        v_item.product_id,
                        v_item.variant_id,
                        p_order_id,
                        v_restock_quantity,
                        'committed',
                        'restock.return:' || v_return_line_id::TEXT,
                        p_request_id,
                        jsonb_build_object('reason', p_reason),
                        p_actor_id
                    )
                    ON CONFLICT (site_id, idempotency_key) DO NOTHING;

                    INSERT INTO inventory_events (
                        site_id,
                        inventory_level_id,
                        location_id,
                        product_id,
                        variant_id,
                        order_id,
                        event_type,
                        quantity_delta,
                        on_hand_quantity,
                        available_quantity,
                        committed_quantity,
                        unavailable_quantity,
                        incoming_quantity,
                        reserved_quantity,
                        safety_stock_quantity,
                        source_type,
                        source_id,
                        idempotency_key,
                        request_id,
                        metadata,
                        created_by
                    )
                    SELECT
                        v_order.store_id,
                        il.id,
                        il.location_id,
                        v_item.product_id,
                        v_item.variant_id,
                        p_order_id,
                        'return_restocked',
                        v_restock_quantity,
                        COALESCE(il.on_hand_quantity, il.available + il.reserved),
                        COALESCE(il.available_quantity, il.available),
                        COALESCE(il.committed_quantity, 0),
                        COALESCE(il.unavailable_quantity, 0),
                        COALESCE(il.incoming_quantity, il.incoming),
                        COALESCE(il.reserved_quantity, il.reserved),
                        COALESCE(il.safety_stock_quantity, 0),
                        'return',
                        v_return_id,
                        'inventory.return_restocked:' || v_return_line_id::TEXT,
                        p_request_id,
                        jsonb_build_object('return_id', v_return_id, 'return_line_id', v_return_line_id),
                        p_actor_id
                    FROM inventory_levels il
                    WHERE il.id = v_level_id
                    ON CONFLICT (site_id, idempotency_key) DO NOTHING;
                END IF;
            END IF;
        END LOOP;
    END IF;

    IF v_total_refund <= 0 THEN
        RAISE EXCEPTION 'no refundable amount remains';
    END IF;

    INSERT INTO refunds (
        site_id,
        order_id,
        return_id,
        payment_transaction_id,
        amount,
        currency,
        status,
        refund_method,
        provider,
        idempotency_key,
        request_id,
        reason,
        metadata,
        created_by
    )
    VALUES (
        v_order.store_id,
        p_order_id,
        v_return_id,
        v_payment_transaction_id,
        v_total_refund,
        COALESCE(v_order.currency, 'INR'),
        'pending',
        p_refund_method,
        COALESCE(v_order.payment_gateway, v_order.payment_method),
        p_idempotency_key || ':refund',
        p_request_id,
        p_reason,
        jsonb_build_object('restock_requested', p_restock),
        p_actor_id
    )
    RETURNING id INTO v_refund_id;

    INSERT INTO refund_lines (
        site_id,
        refund_id,
        return_line_id,
        order_item_id,
        amount,
        quantity,
        created_by
    )
    SELECT
        v_order.store_id,
        v_refund_id,
        rl.id,
        rl.order_item_id,
        rl.refund_amount,
        rl.quantity,
        p_actor_id
    FROM return_lines rl
    WHERE rl.return_id = v_return_id
      AND rl.deleted_at IS NULL;

    INSERT INTO refund_transactions (
        site_id,
        order_id,
        payment_transaction_id,
        amount,
        currency,
        status,
        refund_method,
        reason,
        idempotency_key,
        request_id,
        metadata,
        created_by
    )
    VALUES (
        v_order.store_id,
        p_order_id,
        v_payment_transaction_id,
        v_total_refund,
        COALESCE(v_order.currency, 'INR'),
        'pending',
        p_refund_method,
        p_reason,
        p_idempotency_key || ':refund_transaction',
        p_request_id,
        jsonb_build_object('return_id', v_return_id, 'refund_id', v_refund_id),
        p_actor_id
    )
    ON CONFLICT (site_id, idempotency_key) DO NOTHING
    RETURNING id INTO v_refund_transaction_id;

    UPDATE returns
       SET metadata = metadata || jsonb_build_object('refund_id', v_refund_id, 'refund_transaction_id', v_refund_transaction_id),
           updated_at = NOW(),
           updated_by = p_actor_id
     WHERE id = v_return_id;

    UPDATE orders
       SET return_status = 'authorized',
           refund_status = 'pending',
           updated_at = NOW(),
           updated_by = p_actor_id
     WHERE id = p_order_id;

    INSERT INTO outbox_events (
        site_id,
        store_id,
        aggregate_type,
        aggregate_id,
        event_type,
        payload,
        idempotency_key,
        request_id,
        trace_id,
        schema_version,
        actor_id
    )
    VALUES (
        v_order.store_id,
        v_order.store_id,
        'refund',
        v_refund_id::TEXT,
        'refund.requested',
        jsonb_build_object(
            'site_id', v_order.store_id,
            'order_id', p_order_id,
            'return_id', v_return_id,
            'refund_id', v_refund_id,
            'amount', v_total_refund,
            'refund_method', p_refund_method
        ),
        'refund.requested:' || v_refund_id::TEXT,
        p_request_id,
        p_request_id,
        1,
        p_actor_id
    )
    ON CONFLICT (idempotency_key) DO NOTHING;

    RETURN jsonb_build_object(
        'order', (SELECT to_jsonb(o) FROM orders o WHERE o.id = p_order_id),
        'return_id', v_return_id,
        'refund_id', v_refund_id,
        'refund_transaction_id', v_refund_transaction_id,
        'amount', v_total_refund,
        'status', 'pending'
    );
END;
$$;


--
-- Name: create_order_with_inventory_reservations(uuid, text, text, text, jsonb, jsonb, text, text, text, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_order_with_inventory_reservations(p_store_id uuid, p_customer_name text, p_customer_email text, p_customer_phone text DEFAULT NULL::text, p_shipping_address jsonb DEFAULT '{}'::jsonb, p_items jsonb DEFAULT '[]'::jsonb, p_payment_method text DEFAULT 'cod'::text, p_notes text DEFAULT NULL::text, p_coupon_code text DEFAULT NULL::text, p_actor_id uuid DEFAULT NULL::uuid, p_request_id text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_item JSONB;
    v_product_id UUID;
    v_variant_id UUID;
    v_quantity INTEGER;
    v_product RECORD;
    v_variant RECORD;
    v_level_id UUID;
    v_location_id UUID;
    v_available INTEGER;
    v_reserved INTEGER;
    v_order_id UUID;
    v_order_number TEXT;
    v_subtotal NUMERIC(10,2) := 0;
    v_line_total NUMERIC(10,2);
    v_unit_price NUMERIC(10,2);
    v_variant_title TEXT;
    v_sku TEXT;
    v_order_items JSONB := '[]'::JSONB;
    v_order_json JSONB;
BEGIN
    IF p_store_id IS NULL THEN
        RAISE EXCEPTION 'store_id is required';
    END IF;

    IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'items must be a non-empty array';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM sites
        WHERE id = p_store_id
          AND deleted_at IS NULL
    ) THEN
        RAISE EXCEPTION 'store not found';
    END IF;

    v_order_number := 'LB-' || to_char(NOW(), 'YYYYMMDD') || '-' ||
        upper(substr(replace(gen_random_uuid()::TEXT, '-', ''), 1, 8));

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_product_id := (v_item ->> 'product_id')::UUID;
        v_variant_id := NULLIF(v_item ->> 'variant_id', '')::UUID;
        v_quantity := COALESCE((v_item ->> 'quantity')::INTEGER, 0);

        IF v_quantity <= 0 THEN
            RAISE EXCEPTION 'invalid quantity for product %', v_product_id;
        END IF;

        SELECT id, name, price, sku, is_active, store_id
          INTO v_product
          FROM products
         WHERE id = v_product_id
           AND store_id = p_store_id
           AND deleted_at IS NULL
         FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'product not found: %', v_product_id;
        END IF;

        IF COALESCE(v_product.is_active, FALSE) = FALSE THEN
            RAISE EXCEPTION 'product is not active: %', v_product.name;
        END IF;

        v_unit_price := v_product.price;
        v_variant_title := NULL;
        v_sku := v_product.sku;

        IF v_variant_id IS NOT NULL THEN
            SELECT id, title, price, sku
              INTO v_variant
              FROM product_variants
             WHERE id = v_variant_id
               AND product_id = v_product_id;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'variant not found for product %', v_product_id;
            END IF;

            v_unit_price := COALESCE(NULLIF(v_variant.price, 0), v_product.price);
            v_variant_title := v_variant.title;
            v_sku := COALESCE(v_variant.sku, v_product.sku);
        END IF;

        SELECT il.id, il.location_id, il.available, il.reserved
          INTO v_level_id, v_location_id, v_available, v_reserved
          FROM inventory_levels il
          JOIN inventory_locations loc ON loc.id = il.location_id
         WHERE il.product_id = v_product_id
           AND (
                (v_variant_id IS NULL AND il.variant_id IS NULL)
                OR il.variant_id = v_variant_id
           )
           AND loc.store_id = p_store_id
           AND loc.status = 'active'
           AND loc.deleted_at IS NULL
         ORDER BY loc.is_default DESC, il.updated_at ASC
         LIMIT 1
         FOR UPDATE OF il;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'inventory level not found for product %', v_product_id;
        END IF;

        IF (v_available - v_reserved) < v_quantity THEN
            RAISE EXCEPTION 'insufficient stock for product %, available %, requested %',
                v_product.name,
                (v_available - v_reserved),
                v_quantity;
        END IF;

        UPDATE inventory_levels
           SET available = available - v_quantity,
               updated_at = NOW()
         WHERE id = v_level_id;

        v_line_total := v_unit_price * v_quantity;
        v_subtotal := v_subtotal + v_line_total;

        v_order_items := v_order_items || jsonb_build_array(jsonb_build_object(
            'product_id', v_product_id,
            'variant_id', v_variant_id,
            'name', v_product.name,
            'variant_title', v_variant_title,
            'sku', v_sku,
            'quantity', v_quantity,
            'price', v_unit_price,
            'total', v_line_total
        ));
    END LOOP;

    INSERT INTO orders (
        store_id,
        order_number,
        customer_name,
        customer_email,
        customer_phone,
        shipping_address,
        items,
        subtotal,
        shipping_cost,
        discount,
        total,
        coupon_code,
        payment_method,
        status,
        payment_status,
        notes,
        inventory_reserved_at,
        created_by
    )
    VALUES (
        p_store_id,
        v_order_number,
        p_customer_name,
        p_customer_email,
        COALESCE(p_customer_phone, ''),
        COALESCE(p_shipping_address, '{}'::JSONB),
        v_order_items,
        v_subtotal,
        0,
        0,
        v_subtotal,
        p_coupon_code,
        p_payment_method,
        CASE WHEN p_payment_method = 'cod' THEN 'confirmed' ELSE 'pending' END,
        'pending',
        COALESCE(p_notes, ''),
        NOW(),
        p_actor_id
    )
    RETURNING id INTO v_order_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(v_order_items)
    LOOP
        v_product_id := (v_item ->> 'product_id')::UUID;
        v_variant_id := NULLIF(v_item ->> 'variant_id', '')::UUID;
        v_quantity := (v_item ->> 'quantity')::INTEGER;

        SELECT il.id, il.location_id
          INTO v_level_id, v_location_id
          FROM inventory_levels il
          JOIN inventory_locations loc ON loc.id = il.location_id
         WHERE il.product_id = v_product_id
           AND (
                (v_variant_id IS NULL AND il.variant_id IS NULL)
                OR il.variant_id = v_variant_id
           )
           AND loc.store_id = p_store_id
           AND loc.status = 'active'
           AND loc.deleted_at IS NULL
         ORDER BY loc.is_default DESC, il.updated_at ASC
         LIMIT 1;

        INSERT INTO inventory_reservations (
            store_id,
            product_id,
            variant_id,
            location_id,
            order_id,
            quantity,
            status,
            idempotency_key,
            committed_at,
            created_by
        )
        VALUES (
            p_store_id,
            v_product_id,
            v_variant_id,
            v_location_id,
            v_order_id,
            v_quantity,
            'committed',
            'order:' || v_order_id::TEXT || ':' || v_product_id::TEXT || ':' || COALESCE(v_variant_id::TEXT, 'default'),
            NOW(),
            p_actor_id
        )
        ON CONFLICT (idempotency_key) DO NOTHING;

        INSERT INTO inventory_adjustments (
            product_id,
            variant_id,
            location_id,
            quantity_change,
            reason,
            reference_id,
            note,
            created_by
        )
        VALUES (
            v_product_id,
            v_variant_id,
            v_location_id,
            -v_quantity,
            'sale',
            v_order_id,
            'Committed by create_order_with_inventory_reservations',
            p_actor_id
        );

        INSERT INTO order_items (
            order_id,
            product_id,
            variant_id,
            sku,
            title,
            variant_title,
            quantity,
            unit_price,
            total,
            product_snapshot
        )
        VALUES (
            v_order_id,
            v_product_id,
            v_variant_id,
            v_item ->> 'sku',
            v_item ->> 'name',
            v_item ->> 'variant_title',
            v_quantity,
            (v_item ->> 'price')::NUMERIC,
            (v_item ->> 'total')::NUMERIC,
            v_item
        );
    END LOOP;

    INSERT INTO outbox_events (
        store_id,
        aggregate_type,
        aggregate_id,
        event_type,
        payload,
        idempotency_key,
        request_id,
        actor_id
    )
    VALUES (
        p_store_id,
        'order',
        v_order_id::TEXT,
        'order.created',
        jsonb_build_object(
            'store_id', p_store_id,
            'order_id', v_order_id,
            'order_number', v_order_number,
            'total', v_subtotal,
            'payment_method', p_payment_method
        ),
        'order.created:' || v_order_id::TEXT,
        p_request_id,
        p_actor_id
    )
    ON CONFLICT (idempotency_key) DO NOTHING;

    INSERT INTO audit_activity_events (
        store_id,
        actor_id,
        actor_type,
        action,
        resource_type,
        resource_id,
        request_id,
        after_state
    )
    VALUES (
        p_store_id,
        p_actor_id,
        'user',
        'order.create',
        'order',
        v_order_id::TEXT,
        p_request_id,
        jsonb_build_object(
            'order_id', v_order_id,
            'order_number', v_order_number,
            'total', v_subtotal
        )
    );

    SELECT to_jsonb(o)
      INTO v_order_json
      FROM orders o
     WHERE o.id = v_order_id;

    RETURN v_order_json;
END;
$$;


--
-- Name: create_purchase_order_with_lines(uuid, uuid, uuid, jsonb, timestamp with time zone, text, uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_purchase_order_with_lines(p_site_id uuid, p_supplier_id uuid, p_location_id uuid, p_lines jsonb, p_expected_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_notes text DEFAULT NULL::text, p_actor_id uuid DEFAULT NULL::uuid, p_request_id text DEFAULT NULL::text, p_idempotency_key text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_po_id UUID;
    v_existing_id UUID;
    v_line RECORD;
    v_product RECORD;
    v_level_id UUID;
    v_po_number TEXT;
    v_subtotal NUMERIC(12,2) := 0;
BEGIN
    IF p_idempotency_key IS NULL OR BTRIM(p_idempotency_key) = '' THEN
        RAISE EXCEPTION 'idempotency_key is required';
    END IF;

    IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
        RAISE EXCEPTION 'purchase order lines are required';
    END IF;

    SELECT id INTO v_existing_id
    FROM purchase_orders
    WHERE site_id = p_site_id AND idempotency_key = p_idempotency_key AND deleted_at IS NULL
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
        RETURN jsonb_build_object('purchase_order_id', v_existing_id, 'idempotent_replay', true);
    END IF;

    IF p_supplier_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM suppliers WHERE id = p_supplier_id AND site_id = p_site_id AND deleted_at IS NULL
    ) THEN
        RAISE EXCEPTION 'supplier not found';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM inventory_locations WHERE id = p_location_id AND store_id = p_site_id AND deleted_at IS NULL
    ) THEN
        RAISE EXCEPTION 'inventory location not found';
    END IF;

    v_po_number := 'PO-' || to_char(NOW(), 'YYYYMMDD') || '-' || upper(substr(gen_random_uuid()::TEXT, 1, 8));

    INSERT INTO purchase_orders (
        site_id, supplier_id, location_id, po_number, status, ordered_at, expected_at,
        notes, idempotency_key, request_id, created_by
    )
    VALUES (
        p_site_id, p_supplier_id, p_location_id, v_po_number, 'ordered', NOW(), p_expected_at,
        p_notes, p_idempotency_key, p_request_id, p_actor_id
    )
    RETURNING id INTO v_po_id;

    FOR v_line IN
        SELECT * FROM jsonb_to_recordset(p_lines) AS x(product_id UUID, variant_id UUID, quantity INTEGER, unit_cost NUMERIC)
    LOOP
        IF COALESCE(v_line.quantity, 0) <= 0 THEN
            RAISE EXCEPTION 'purchase order quantity must be positive';
        END IF;

        SELECT id, store_id INTO v_product
        FROM products
        WHERE id = v_line.product_id AND store_id = p_site_id AND deleted_at IS NULL;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'product % not found for site', v_line.product_id;
        END IF;

        v_level_id := ensure_inventory_level_for_location(v_line.product_id, v_line.variant_id, p_location_id);

        INSERT INTO purchase_order_lines (
            site_id, purchase_order_id, product_id, variant_id, location_id,
            quantity_ordered, unit_cost, total_cost, status, created_by
        )
        VALUES (
            p_site_id, v_po_id, v_line.product_id, v_line.variant_id, p_location_id,
            v_line.quantity, COALESCE(v_line.unit_cost, 0), COALESCE(v_line.unit_cost, 0) * v_line.quantity,
            'ordered', p_actor_id
        );

        UPDATE inventory_levels
           SET incoming = incoming + v_line.quantity,
               incoming_quantity = COALESCE(incoming_quantity, incoming) + v_line.quantity,
               updated_at = NOW()
         WHERE id = v_level_id;

        INSERT INTO inventory_events (
            site_id, inventory_level_id, location_id, product_id, variant_id,
            event_type, quantity_delta, on_hand_quantity, available_quantity,
            committed_quantity, unavailable_quantity, incoming_quantity, reserved_quantity,
            safety_stock_quantity, source_type, source_id, idempotency_key, request_id, metadata, created_by
        )
        SELECT
            p_site_id, il.id, p_location_id, v_line.product_id, v_line.variant_id,
            'po_ordered', v_line.quantity, COALESCE(il.on_hand_quantity, il.available + il.reserved),
            COALESCE(il.available_quantity, il.available), COALESCE(il.committed_quantity, 0),
            COALESCE(il.unavailable_quantity, 0), COALESCE(il.incoming_quantity, il.incoming),
            COALESCE(il.reserved_quantity, il.reserved), COALESCE(il.safety_stock_quantity, 0),
            'purchase_order', v_po_id, 'inventory.po_ordered:' || v_po_id::TEXT || ':' || v_line.product_id::TEXT || ':' || COALESCE(v_line.variant_id::TEXT, 'default'),
            p_request_id, jsonb_build_object('quantity_ordered', v_line.quantity), p_actor_id
        FROM inventory_levels il WHERE il.id = v_level_id
        ON CONFLICT (site_id, idempotency_key) DO NOTHING;

        v_subtotal := v_subtotal + (COALESCE(v_line.unit_cost, 0) * v_line.quantity);
    END LOOP;

    UPDATE purchase_orders
       SET subtotal = v_subtotal, total = v_subtotal, updated_at = NOW()
     WHERE id = v_po_id;

    INSERT INTO outbox_events (
        site_id, store_id, aggregate_type, aggregate_id, event_type, payload,
        idempotency_key, request_id, trace_id, schema_version, actor_id
    )
    VALUES (
        p_site_id, p_site_id, 'purchase_order', v_po_id::TEXT, 'purchase_order.ordered',
        jsonb_build_object('site_id', p_site_id, 'purchase_order_id', v_po_id, 'total', v_subtotal),
        'purchase_order.ordered:' || v_po_id::TEXT, p_request_id, p_request_id, 1, p_actor_id
    )
    ON CONFLICT (idempotency_key) DO NOTHING;

    RETURN jsonb_build_object(
        'purchase_order', (SELECT to_jsonb(po) FROM purchase_orders po WHERE po.id = v_po_id),
        'lines', (SELECT COALESCE(jsonb_agg(to_jsonb(pol)), '[]'::JSONB) FROM purchase_order_lines pol WHERE pol.purchase_order_id = v_po_id)
    );
END;
$$;


--
-- Name: dead_letter_distributed_queue_message(text, text, text, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.dead_letter_distributed_queue_message(p_message_id text, p_worker_id text, p_fencing_token text, p_error_message text, p_result jsonb DEFAULT '{}'::jsonb) RETURNS public.distributed_queue_messages
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    updated_message distributed_queue_messages%ROWTYPE;
BEGIN
    UPDATE distributed_queue_messages
       SET status = 'dead-lettered',
           leased_until = NULL,
           error_message = p_error_message,
           result = COALESCE(p_result, '{}'),
           updated_at = NOW()
     WHERE message_id = p_message_id
       AND leased_by = p_worker_id
       AND fencing_token = p_fencing_token
       AND status = 'leased'
       AND deleted_at IS NULL
    RETURNING * INTO updated_message;

    IF updated_message.id IS NULL THEN
        RAISE EXCEPTION 'queue dead-letter rejected for message %', p_message_id;
    END IF;

    RETURN updated_message;
END;
$$;


--
-- Name: ensure_default_inventory_location(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ensure_default_inventory_location(p_store_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_location_id UUID;
BEGIN
    IF p_store_id IS NULL THEN
        RAISE EXCEPTION 'store_id is required';
    END IF;

    SELECT id
      INTO v_location_id
      FROM inventory_locations
     WHERE store_id = p_store_id
       AND is_default = TRUE
       AND status = 'active'
       AND deleted_at IS NULL
     ORDER BY created_at ASC
     LIMIT 1;

    IF v_location_id IS NULL THEN
        INSERT INTO inventory_locations (store_id, name, is_default, status)
        VALUES (p_store_id, 'Default Location', TRUE, 'active')
        RETURNING id INTO v_location_id;
    END IF;

    RETURN v_location_id;
END;
$$;


--
-- Name: ensure_inventory_level_for_location(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ensure_inventory_level_for_location(p_product_id uuid, p_variant_id uuid, p_location_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_level_id UUID;
BEGIN
    SELECT id
      INTO v_level_id
      FROM inventory_levels
     WHERE product_id = p_product_id
       AND ((p_variant_id IS NULL AND variant_id IS NULL) OR variant_id = p_variant_id)
       AND location_id = p_location_id
     ORDER BY updated_at DESC NULLS LAST
     LIMIT 1
     FOR UPDATE;

    IF v_level_id IS NULL THEN
        INSERT INTO inventory_levels (
            product_id,
            variant_id,
            location_id,
            available,
            reserved,
            incoming,
            on_hand_quantity,
            available_quantity,
            incoming_quantity,
            reserved_quantity
        )
        VALUES (
            p_product_id,
            p_variant_id,
            p_location_id,
            0,
            0,
            0,
            0,
            0,
            0,
            0
        )
        RETURNING id INTO v_level_id;
    END IF;

    RETURN v_level_id;
END;
$$;


--
-- Name: evaluate_checkout_promotion(uuid, text, numeric, numeric, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.evaluate_checkout_promotion(p_store_id uuid, p_code text, p_subtotal numeric, p_shipping_amount numeric, p_customer_email text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_code TEXT := UPPER(BTRIM(COALESCE(p_code, '')));
    v_promo RECORD;
    v_min_order NUMERIC(12,2);
    v_customer_count INTEGER;
    v_global_count INTEGER;
    v_discount NUMERIC(12,2) := 0;
BEGIN
    IF v_code = '' THEN
        RETURN jsonb_build_object('valid', false, 'discount', 0);
    END IF;

    SELECT
        p.id AS promotion_id,
        pc.id AS promotion_code_id,
        NULL::UUID AS coupon_id,
        pc.code_normalized AS code,
        p.usage_limit AS promotion_usage_limit,
        p.per_customer_limit,
        pc.usage_limit AS code_usage_limit,
        pc.usage_count AS code_usage_count,
        pe.effect_type,
        pe.value,
        pe.max_discount,
        p.title
      INTO v_promo
      FROM promotion_codes pc
      JOIN promotions p ON p.id = pc.promotion_id
      JOIN promotion_effects pe ON pe.promotion_id = p.id AND pe.deleted_at IS NULL
     WHERE pc.site_id = p_store_id
       AND pc.code_normalized = v_code
       AND pc.status = 'active'
       AND p.status = 'active'
       AND pc.deleted_at IS NULL
       AND p.deleted_at IS NULL
       AND (pc.starts_at IS NULL OR pc.starts_at <= NOW())
       AND (pc.ends_at IS NULL OR pc.ends_at >= NOW())
       AND (p.starts_at IS NULL OR p.starts_at <= NOW())
       AND (p.ends_at IS NULL OR p.ends_at >= NOW())
     ORDER BY p.priority ASC, pe.created_at ASC
     LIMIT 1
     FOR UPDATE OF pc;

    IF NOT FOUND THEN
        SELECT
            NULL::UUID AS promotion_id,
            NULL::UUID AS promotion_code_id,
            c.id AS coupon_id,
            UPPER(c.code) AS code,
            c.usage_limit AS promotion_usage_limit,
            COALESCE(c.per_customer_limit, c.per_user_limit, 1) AS per_customer_limit,
            c.usage_limit AS code_usage_limit,
            COALESCE(c.usage_count, 0) AS code_usage_count,
            COALESCE(c.type, c.discount_type) AS effect_type,
            COALESCE(c.value, c.discount_value, 0) AS value,
            COALESCE(c.maximum_discount, c.max_discount) AS max_discount,
            COALESCE(c.description, c.code) AS title
          INTO v_promo
          FROM coupons c
         WHERE c.store_id = p_store_id
           AND UPPER(c.code) = v_code
           AND COALESCE(c.is_active, true) = true
           AND c.deleted_at IS NULL
           AND (c.starts_at IS NULL OR c.starts_at <= NOW())
           AND (c.expires_at IS NULL OR c.expires_at >= NOW())
         LIMIT 1
         FOR UPDATE;
    END IF;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'promotion code is invalid or inactive';
    END IF;

    SELECT COALESCE((pr.value ->> 'amount')::NUMERIC, 0)
      INTO v_min_order
      FROM promotion_rules pr
     WHERE pr.promotion_id = v_promo.promotion_id
       AND pr.rule_type = 'min_order_amount'
       AND pr.deleted_at IS NULL
     ORDER BY pr.created_at ASC
     LIMIT 1;

    IF v_min_order IS NULL AND v_promo.coupon_id IS NOT NULL THEN
        SELECT COALESCE(c.minimum_order_amount, c.min_order_amount)
          INTO v_min_order
          FROM coupons c
         WHERE c.id = v_promo.coupon_id;
    END IF;

    IF v_min_order IS NOT NULL AND p_subtotal < v_min_order THEN
        RAISE EXCEPTION 'minimum order amount % required for promotion', v_min_order;
    END IF;

    SELECT COUNT(*)
      INTO v_global_count
      FROM promotion_redemptions pr
     WHERE pr.site_id = p_store_id
       AND pr.status IN ('reserved', 'committed')
       AND pr.deleted_at IS NULL
       AND (
           (v_promo.promotion_id IS NOT NULL AND pr.promotion_id = v_promo.promotion_id)
           OR (v_promo.coupon_id IS NOT NULL AND pr.coupon_id = v_promo.coupon_id)
       );

    IF v_promo.promotion_usage_limit IS NOT NULL AND v_global_count >= v_promo.promotion_usage_limit THEN
        RAISE EXCEPTION 'promotion usage limit reached';
    END IF;

    IF v_promo.code_usage_limit IS NOT NULL AND v_promo.code_usage_count >= v_promo.code_usage_limit THEN
        RAISE EXCEPTION 'promotion code usage limit reached';
    END IF;

    IF p_customer_email IS NOT NULL AND v_promo.per_customer_limit IS NOT NULL THEN
        SELECT COUNT(*)
          INTO v_customer_count
          FROM promotion_redemptions pr
         WHERE pr.site_id = p_store_id
           AND LOWER(pr.customer_email) = LOWER(p_customer_email)
           AND pr.status IN ('reserved', 'committed')
           AND pr.deleted_at IS NULL
           AND (
               (v_promo.promotion_id IS NOT NULL AND pr.promotion_id = v_promo.promotion_id)
               OR (v_promo.coupon_id IS NOT NULL AND pr.coupon_id = v_promo.coupon_id)
           );

        IF v_customer_count >= v_promo.per_customer_limit THEN
            RAISE EXCEPTION 'promotion customer usage limit reached';
        END IF;
    END IF;

    IF v_promo.effect_type = 'percentage' THEN
        v_discount := ROUND((p_subtotal * v_promo.value / 100.0), 2);
        IF v_promo.max_discount IS NOT NULL THEN
            v_discount := LEAST(v_discount, v_promo.max_discount);
        END IF;
    ELSIF v_promo.effect_type = 'fixed' THEN
        v_discount := v_promo.value;
    ELSIF v_promo.effect_type = 'free_shipping' THEN
        v_discount := p_shipping_amount;
    ELSE
        RAISE EXCEPTION 'unsupported promotion effect: %', v_promo.effect_type;
    END IF;

    v_discount := LEAST(GREATEST(v_discount, 0), p_subtotal + p_shipping_amount);

    RETURN jsonb_build_object(
        'valid', true,
        'discount', v_discount,
        'code', v_promo.code,
        'promotion_id', v_promo.promotion_id,
        'promotion_code_id', v_promo.promotion_code_id,
        'coupon_id', v_promo.coupon_id,
        'effect_type', v_promo.effect_type,
        'title', v_promo.title
    );
END;
$$;


--
-- Name: fail_outbox_event(uuid, text, text, integer, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fail_outbox_event(p_event_id uuid, p_dispatcher_id text, p_error_message text, p_retry_seconds integer DEFAULT 60, p_metadata jsonb DEFAULT '{}'::jsonb) RETURNS public.outbox_events
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_event outbox_events;
    v_next_status TEXT;
    v_retry_seconds INTEGER;
BEGIN
    SELECT *
      INTO v_event
      FROM outbox_events
     WHERE id = p_event_id
       AND status = 'processing'
       AND locked_by = p_dispatcher_id
     FOR UPDATE;

    IF v_event.id IS NULL THEN
        RAISE EXCEPTION 'outbox event % is not claimable by dispatcher %', p_event_id, p_dispatcher_id;
    END IF;

    v_next_status := CASE WHEN v_event.attempts >= v_event.max_attempts THEN 'dead' ELSE 'failed' END;
    v_retry_seconds := LEAST(GREATEST(COALESCE(p_retry_seconds, 60), 10), 3600);

    IF v_next_status = 'dead' THEN
        INSERT INTO outbox_dead_letters (
            site_id, outbox_event_id, event_id, event_type, aggregate_type, aggregate_id,
            payload, failure_reason, attempts, request_id, trace_id, idempotency_key,
            schema_version, metadata
        )
        VALUES (
            COALESCE(v_event.site_id, v_event.store_id),
            v_event.id,
            v_event.event_id,
            v_event.event_type,
            v_event.aggregate_type,
            v_event.aggregate_id,
            v_event.payload,
            COALESCE(NULLIF(p_error_message, ''), 'Unknown dispatcher failure'),
            v_event.attempts,
            v_event.request_id,
            v_event.trace_id,
            v_event.idempotency_key,
            v_event.schema_version,
            COALESCE(p_metadata, '{}'::JSONB)
        )
        ON CONFLICT (outbox_event_id)
        DO UPDATE SET
            failure_reason = EXCLUDED.failure_reason,
            attempts = EXCLUDED.attempts,
            metadata = EXCLUDED.metadata,
            updated_at = NOW(),
            deleted_at = NULL;
    END IF;

    UPDATE outbox_events
       SET status = v_next_status,
           locked_at = NULL,
           locked_by = NULL,
           available_at = CASE
               WHEN v_next_status = 'dead' THEN available_at
               ELSE NOW() + make_interval(secs => v_retry_seconds)
           END,
           next_attempt_at = CASE
               WHEN v_next_status = 'dead' THEN next_attempt_at
               ELSE NOW() + make_interval(secs => v_retry_seconds)
           END,
           error_message = LEFT(COALESCE(p_error_message, 'Dispatcher failure'), 2000),
           dead_lettered_at = CASE WHEN v_next_status = 'dead' THEN NOW() ELSE dead_lettered_at END,
           dead_letter_reason = CASE WHEN v_next_status = 'dead' THEN LEFT(COALESCE(p_error_message, 'Dispatcher failure'), 2000) ELSE dead_letter_reason END,
           dispatch_metadata = dispatch_metadata || COALESCE(p_metadata, '{}'::JSONB),
           updated_at = NOW()
     WHERE id = v_event.id
     RETURNING * INTO v_event;

    RETURN v_event;
END;
$$;


--
-- Name: fail_platform_queue_job(uuid, text, text, integer, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fail_platform_queue_job(p_job_id uuid, p_worker_id text, p_error_message text, p_retry_seconds integer DEFAULT 120, p_result jsonb DEFAULT '{}'::jsonb) RETURNS public.platform_queue_jobs
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_job platform_queue_jobs;
    v_next_status TEXT;
    v_retry_seconds INTEGER;
BEGIN
    SELECT *
      INTO v_job
      FROM platform_queue_jobs
     WHERE id = p_job_id
       AND status = 'running'
       AND locked_by = p_worker_id
     FOR UPDATE;

    IF v_job.id IS NULL THEN
        RAISE EXCEPTION 'queue job % is not claimable by worker %', p_job_id, p_worker_id;
    END IF;

    v_next_status := CASE WHEN v_job.attempts >= v_job.max_attempts THEN 'dead' ELSE 'failed' END;
    v_retry_seconds := LEAST(GREATEST(COALESCE(p_retry_seconds, 120), 30), 7200);

    UPDATE platform_queue_jobs
       SET status = v_next_status,
           locked_at = NULL,
           locked_by = NULL,
           failed_at = NOW(),
           available_at = CASE
               WHEN v_next_status = 'dead' THEN available_at
               ELSE NOW() + make_interval(secs => v_retry_seconds)
           END,
           error_message = LEFT(COALESCE(p_error_message, 'Queue job failed'), 2000),
           result = COALESCE(p_result, '{}'::JSONB),
           updated_at = NOW()
     WHERE id = v_job.id
     RETURNING * INTO v_job;

    RETURN v_job;
END;
$$;


--
-- Name: fail_webhook_delivery(uuid, text, text, integer, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fail_webhook_delivery(p_delivery_id uuid, p_dispatcher_id text, p_error_message text, p_response_status integer DEFAULT NULL::integer, p_response_body_preview text DEFAULT NULL::text, p_retry_seconds integer DEFAULT 120) RETURNS public.webhook_deliveries
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_delivery webhook_deliveries;
    v_next_status TEXT;
    v_retry_seconds INTEGER;
BEGIN
    SELECT *
      INTO v_delivery
      FROM webhook_deliveries
     WHERE id = p_delivery_id
       AND status = 'processing'
       AND locked_by = p_dispatcher_id
     FOR UPDATE;

    IF v_delivery.id IS NULL THEN
        RAISE EXCEPTION 'webhook delivery % is not claimable by dispatcher %', p_delivery_id, p_dispatcher_id;
    END IF;

    v_next_status := CASE WHEN v_delivery.attempts >= v_delivery.max_attempts THEN 'dead' ELSE 'failed' END;
    v_retry_seconds := LEAST(GREATEST(COALESCE(p_retry_seconds, 120), 30), 7200);

    UPDATE webhook_deliveries
       SET status = v_next_status,
           locked_at = NULL,
           locked_by = NULL,
           failed_at = NOW(),
           response_status = p_response_status,
           response_body_preview = LEFT(COALESCE(p_response_body_preview, ''), 2000),
           error_message = LEFT(COALESCE(p_error_message, 'Webhook delivery failed'), 2000),
           next_attempt_at = CASE
               WHEN v_next_status = 'dead' THEN next_attempt_at
               ELSE NOW() + make_interval(secs => v_retry_seconds)
           END,
           updated_at = NOW()
     WHERE id = v_delivery.id
     RETURNING * INTO v_delivery;

    UPDATE webhook_subscriptions
       SET failure_count = failure_count + 1,
           last_failure_at = NOW(),
           status = CASE WHEN failure_count + 1 >= 25 THEN 'paused' ELSE status END,
           updated_at = NOW()
     WHERE id = v_delivery.subscription_id;

    RETURN v_delivery;
END;
$$;


--
-- Name: generate_order_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_order_number() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.order_number = 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || 
                       LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
    RETURN NEW;
END;
$$;


--
-- Name: get_usage_limit_from_entitlements(jsonb, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_usage_limit_from_entitlements(p_entitlements jsonb, p_meter_name text) RETURNS numeric
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
    v_limits JSONB;
    v_key TEXT;
    v_raw TEXT;
BEGIN
    v_limits := COALESCE(p_entitlements->'limits', '{}'::JSONB);
    v_key := CASE p_meter_name
        WHEN 'products' THEN 'products'
        WHEN 'orders' THEN 'orders_monthly'
        WHEN 'storage_mb' THEN 'storage_mb'
        WHEN 'staff' THEN 'staff'
        WHEN 'ai_credits' THEN 'ai_credits_monthly'
        WHEN 'api_requests' THEN 'api_requests_monthly'
        WHEN 'webhook_subscriptions' THEN 'webhook_subscriptions'
        ELSE p_meter_name
    END;

    v_raw := v_limits->>v_key;
    IF v_raw IS NULL OR v_raw = '' OR lower(v_raw) = 'null' THEN
        RETURN NULL;
    END IF;

    RETURN v_raw::NUMERIC;
END;
$$;


--
-- Name: heartbeat_distributed_queue_message(text, text, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.heartbeat_distributed_queue_message(p_message_id text, p_worker_id text, p_fencing_token text, p_visibility_seconds integer DEFAULT 120) RETURNS public.distributed_queue_messages
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    updated_message distributed_queue_messages%ROWTYPE;
BEGIN
    UPDATE distributed_queue_messages
       SET leased_until = NOW() + make_interval(secs => GREATEST(COALESCE(p_visibility_seconds, 120), 1)),
           updated_at = NOW()
     WHERE message_id = p_message_id
       AND leased_by = p_worker_id
       AND fencing_token = p_fencing_token
       AND status = 'leased'
       AND deleted_at IS NULL
    RETURNING * INTO updated_message;

    IF updated_message.id IS NULL THEN
        RAISE EXCEPTION 'queue lease heartbeat rejected for message %', p_message_id;
    END IF;

    INSERT INTO distributed_queue_heartbeats (
        message_id,
        queue_name,
        worker_id,
        fencing_token,
        leased_until,
        metadata
    )
    VALUES (
        updated_message.message_id,
        updated_message.queue_name,
        p_worker_id,
        p_fencing_token,
        updated_message.leased_until,
        jsonb_build_object('heartbeat_source', 'queue-runtime')
    );

    RETURN updated_message;
END;
$$;


--
-- Name: analytics_rollups_daily; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.analytics_rollups_daily (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_id uuid,
    metric_name text NOT NULL,
    rollup_date date NOT NULL,
    dimensions jsonb DEFAULT '{}'::jsonb NOT NULL,
    metric_value numeric(16,4) DEFAULT 0 NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: increment_analytics_rollup(uuid, text, date, jsonb, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_analytics_rollup(p_site_id uuid, p_metric_name text, p_rollup_date date, p_dimensions jsonb DEFAULT '{}'::jsonb, p_increment numeric DEFAULT 1) RETURNS public.analytics_rollups_daily
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_rollup analytics_rollups_daily;
BEGIN
    INSERT INTO analytics_rollups_daily (
        site_id, metric_name, rollup_date, dimensions, metric_value
    )
    VALUES (
        p_site_id,
        p_metric_name,
        p_rollup_date,
        COALESCE(p_dimensions, '{}'::JSONB),
        COALESCE(p_increment, 1)
    )
    ON CONFLICT (site_id, metric_name, rollup_date, dimensions)
    DO UPDATE SET
        metric_value = analytics_rollups_daily.metric_value + EXCLUDED.metric_value,
        updated_at = NOW(),
        deleted_at = NULL
    RETURNING * INTO v_rollup;

    RETURN v_rollup;
END;
$$;


--
-- Name: increment_version(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_version() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Only auto-increment if the application didn't already do it
    IF NEW.version = OLD.version THEN
        NEW.version = OLD.version + 1;
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: inspect_distributed_queue(text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.inspect_distributed_queue(p_queue_name text, p_limit integer DEFAULT 100) RETURNS TABLE(message_id text, queue_name text, job_type text, status text, attempts integer, available_at timestamp with time zone, leased_by text, leased_until timestamp with time zone, site_id uuid, created_at timestamp with time zone)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
    SELECT
        message_id,
        queue_name,
        job_type,
        status,
        attempts,
        available_at,
        leased_by,
        leased_until,
        site_id,
        created_at
      FROM distributed_queue_messages
     WHERE queue_name = p_queue_name
       AND deleted_at IS NULL
     ORDER BY created_at DESC
     LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 1), 500);
$$;


--
-- Name: is_super_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_super_admin() RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.super_admin_allowlist
        WHERE user_id = auth.uid() AND is_active = TRUE
    );
END;
$$;


--
-- Name: log_audit_event(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_audit_event() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    INSERT INTO audit_logs (
        actor_id,
        actor_type,
        action,
        resource_type,
        resource_id,
        old_values,
        new_values
    ) VALUES (
        auth.uid(),  -- may be null for custom auth operations
        CASE 
            WHEN auth.uid() IS NULL THEN 'system'
            WHEN public.is_super_admin() THEN 'super_admin'
            WHEN EXISTS (SELECT 1 FROM employees WHERE user_id = auth.uid()) THEN 'employee'
            ELSE 'user'
        END,
        TG_OP,
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
    );
    RETURN COALESCE(NEW, OLD);
END;
$$;


--
-- Name: notify_on_app_install(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_on_app_install() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_app_name TEXT;
  v_store_name TEXT;
  v_dev_user_id UUID;
BEGIN
  SELECT ma.name, ad.user_id INTO v_app_name, v_dev_user_id
  FROM marketplace_apps ma
  JOIN app_developers ad ON ma.developer_id = ad.id
  WHERE ma.id = NEW.app_id;

  SELECT name INTO v_store_name FROM sites WHERE id = NEW.store_id;

  -- Notify store owner
  PERFORM create_notification(
    NEW.installed_by,
    'app_installed',
    v_app_name || ' installed',
    v_app_name || ' has been installed on ' || COALESCE(v_store_name, 'your store'),
    jsonb_build_object('app_id', NEW.app_id, 'store_id', NEW.store_id),
    '/apps/' || NEW.app_id
  );

  -- Notify developer
  IF v_dev_user_id IS NOT NULL THEN
    PERFORM create_notification(
      v_dev_user_id,
      'app_installed',
      'New installation: ' || COALESCE(v_store_name, 'a store'),
      COALESCE(v_store_name, 'A store') || ' installed ' || v_app_name,
      jsonb_build_object('app_id', NEW.app_id, 'store_id', NEW.store_id)
    );
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: notify_on_theme_purchase(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_on_theme_purchase() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_theme_name TEXT;
BEGIN
  SELECT name INTO v_theme_name FROM themes WHERE id = NEW.theme_id;

  PERFORM create_notification(
    NEW.user_id,
    'theme_purchased',
    'Theme purchased: ' || COALESCE(v_theme_name, 'Unknown'),
    'You can now install ' || COALESCE(v_theme_name, 'the theme') || ' on any of your stores.',
    jsonb_build_object('theme_id', NEW.theme_id, 'purchase_id', NEW.id),
    '/themes/' || NEW.theme_id
  );

  RETURN NEW;
END;
$$;


--
-- Name: publish_theme_release(uuid, text, jsonb, uuid, integer, uuid, text, boolean, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.publish_theme_release(p_store_id uuid, p_theme_id text, p_release_config jsonb, p_source_draft_id uuid DEFAULT NULL::uuid, p_source_draft_version integer DEFAULT NULL::integer, p_published_by uuid DEFAULT NULL::uuid, p_publish_message text DEFAULT NULL::text, p_make_store_live boolean DEFAULT true, p_request_id text DEFAULT NULL::text, p_rollback_of_release_id uuid DEFAULT NULL::uuid) RETURNS TABLE(release_id uuid, release_version integer, published_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_next_version INTEGER;
    v_release_id UUID := gen_random_uuid();
    v_published_at TIMESTAMPTZ := NOW();
    v_theme_instance_id UUID;
    v_theme_package_version_id UUID;
    v_schema_manifest_version TEXT := '1.0.0';
    v_cache_manifest JSONB;
    v_release_manifest JSONB;
BEGIN
    IF p_store_id IS NULL THEN
        RAISE EXCEPTION 'store_id is required';
    END IF;

    IF p_theme_id IS NULL OR LENGTH(TRIM(p_theme_id)) = 0 THEN
        RAISE EXCEPTION 'theme_id is required';
    END IF;

    SELECT
        ti.id,
        ti.theme_package_version_id,
        COALESCE(tpv.schema_version, '1.0.0')
      INTO v_theme_instance_id, v_theme_package_version_id, v_schema_manifest_version
      FROM theme_instances ti
      LEFT JOIN theme_package_versions tpv ON tpv.id = ti.theme_package_version_id
     WHERE ti.store_id = p_store_id
       AND ti.theme_slug = p_theme_id
       AND ti.deleted_at IS NULL
     ORDER BY
       CASE WHEN ti.instance_status = 'active' THEN 0 ELSE 1 END,
       ti.updated_at DESC
     LIMIT 1;

    SELECT COALESCE(MAX(tr.release_version), 0) + 1
      INTO v_next_version
      FROM theme_releases tr
     WHERE tr.store_id = p_store_id
       AND tr.deleted_at IS NULL;

    v_cache_manifest := jsonb_build_object(
        'tags',
        jsonb_build_array(
            'store:' || p_store_id::TEXT,
            'theme:' || p_theme_id,
            'theme_release:' || v_release_id::TEXT
        )
    );

    v_release_manifest := jsonb_build_object(
        'engine',
        'theme-engine-v1',
        'store_id',
        p_store_id,
        'theme_id',
        p_theme_id,
        'release_id',
        v_release_id,
        'release_version',
        v_next_version,
        'theme_instance_id',
        v_theme_instance_id,
        'theme_package_version_id',
        v_theme_package_version_id,
        'schema_manifest_version',
        v_schema_manifest_version
    );

    UPDATE theme_releases
       SET is_current = FALSE,
           release_status = 'superseded',
           updated_at = NOW()
     WHERE store_id = p_store_id
       AND is_current = TRUE
       AND deleted_at IS NULL;

    INSERT INTO theme_releases (
        id,
        store_id,
        theme_id,
        theme_instance_id,
        theme_package_version_id,
        release_version,
        release_status,
        is_current,
        release_config,
        release_manifest,
        template_snapshot,
        settings_snapshot,
        asset_manifest,
        cache_manifest,
        data_binding_manifest,
        schema_manifest_version,
        engine_version,
        source_draft_id,
        source_draft_version,
        publish_message,
        published_by,
        rollback_of_release_id,
        metadata,
        published_at
    )
    VALUES (
        v_release_id,
        p_store_id,
        p_theme_id,
        v_theme_instance_id,
        v_theme_package_version_id,
        v_next_version,
        'published',
        TRUE,
        COALESCE(p_release_config, '{}'::JSONB),
        v_release_manifest,
        COALESCE(p_release_config, '{}'::JSONB),
        COALESCE(p_release_config->'themeSettings', '{}'::JSONB),
        '{}'::JSONB,
        v_cache_manifest,
        '{}'::JSONB,
        v_schema_manifest_version,
        'theme-engine-v1',
        p_source_draft_id,
        p_source_draft_version,
        p_publish_message,
        p_published_by,
        p_rollback_of_release_id,
        jsonb_build_object(
            'request_id', p_request_id,
            'source', CASE WHEN p_rollback_of_release_id IS NULL THEN 'publish' ELSE 'rollback' END
        ),
        v_published_at
    );

    UPDATE sites
       SET theme_id = p_theme_id,
           template_config = COALESCE(p_release_config, '{}'::JSONB),
           current_theme_release_id = v_release_id,
           storefront_release_version = v_next_version,
           status = CASE WHEN p_make_store_live THEN 'published' ELSE status END,
           published_at = CASE WHEN p_make_store_live THEN v_published_at ELSE published_at END,
           updated_at = NOW()
     WHERE id = p_store_id;

    IF v_theme_instance_id IS NOT NULL THEN
        UPDATE theme_instances
           SET active_release_id = v_release_id,
               current_draft_id = NULL,
               instance_status = CASE WHEN p_make_store_live THEN 'active' ELSE instance_status END,
               activated_at = CASE WHEN p_make_store_live THEN v_published_at ELSE activated_at END,
               updated_at = NOW(),
               updated_by = p_published_by
         WHERE id = v_theme_instance_id;

        UPDATE theme_instance_drafts
           SET draft_status = 'published',
               updated_at = NOW(),
               updated_by = p_published_by
         WHERE theme_instance_id = v_theme_instance_id
           AND draft_status = 'active'
           AND deleted_at IS NULL;
    END IF;

    INSERT INTO storefront_cache_tags (
        store_id,
        tag,
        resource_type,
        resource_id,
        release_id,
        invalidated_at
    )
    VALUES
        (p_store_id, 'store:' || p_store_id::TEXT, 'store', p_store_id::TEXT, v_release_id, NOW()),
        (p_store_id, 'theme:' || p_theme_id, 'theme', p_theme_id, v_release_id, NOW()),
        (p_store_id, 'theme_release:' || v_release_id::TEXT, 'theme_release', v_release_id::TEXT, v_release_id, NOW())
    ON CONFLICT (store_id, tag)
    DO UPDATE SET
        resource_type = EXCLUDED.resource_type,
        resource_id = EXCLUDED.resource_id,
        release_id = EXCLUDED.release_id,
        invalidated_at = NOW(),
        updated_at = NOW();

    INSERT INTO outbox_events (
        store_id,
        aggregate_type,
        aggregate_id,
        event_type,
        payload,
        idempotency_key,
        request_id,
        actor_id
    )
    VALUES (
        p_store_id,
        'theme_release',
        v_release_id::TEXT,
        CASE WHEN p_rollback_of_release_id IS NULL THEN 'theme.release.published' ELSE 'theme.release.rollback_published' END,
        jsonb_build_object(
            'store_id', p_store_id,
            'theme_id', p_theme_id,
            'theme_instance_id', v_theme_instance_id,
            'theme_package_version_id', v_theme_package_version_id,
            'release_id', v_release_id,
            'release_version', v_next_version,
            'cache_tags', v_cache_manifest->'tags'
        ),
        'theme.release:' || p_store_id::TEXT || ':' || v_next_version::TEXT,
        p_request_id,
        p_published_by
    )
    ON CONFLICT (idempotency_key) DO NOTHING;

    INSERT INTO audit_activity_events (
        store_id,
        actor_id,
        actor_type,
        action,
        resource_type,
        resource_id,
        request_id,
        after_state,
        metadata
    )
    VALUES (
        p_store_id,
        p_published_by,
        'user',
        CASE WHEN p_rollback_of_release_id IS NULL THEN 'theme.publish' ELSE 'theme.rollback' END,
        'theme_release',
        v_release_id::TEXT,
        p_request_id,
        jsonb_build_object(
            'theme_id', p_theme_id,
            'theme_instance_id', v_theme_instance_id,
            'theme_package_version_id', v_theme_package_version_id,
            'release_id', v_release_id,
            'release_version', v_next_version
        ),
        jsonb_build_object(
            'publish_message', p_publish_message,
            'rollback_of_release_id', p_rollback_of_release_id
        )
    );

    release_id := v_release_id;
    release_version := v_next_version;
    published_at := v_published_at;
    RETURN NEXT;
END;
$$;


--
-- Name: receive_inventory_transfer(uuid, jsonb, uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.receive_inventory_transfer(p_transfer_id uuid, p_lines jsonb DEFAULT NULL::jsonb, p_actor_id uuid DEFAULT NULL::uuid, p_request_id text DEFAULT NULL::text, p_idempotency_key text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_transfer inventory_transfers%ROWTYPE;
    v_line inventory_transfer_lines%ROWTYPE;
    v_input RECORD;
    v_receive_qty INTEGER;
    v_source_level_id UUID;
    v_dest_level_id UUID;
    v_all_received BOOLEAN;
BEGIN
    IF p_idempotency_key IS NULL OR BTRIM(p_idempotency_key) = '' THEN
        RAISE EXCEPTION 'idempotency_key is required';
    END IF;

    SELECT * INTO v_transfer
    FROM inventory_transfers
    WHERE id = p_transfer_id AND deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'transfer not found';
    END IF;

    IF v_transfer.status NOT IN ('reserved', 'shipped', 'partially_received') THEN
        RAISE EXCEPTION 'transfer cannot be received from status %', v_transfer.status;
    END IF;

    IF v_transfer.status = 'reserved' THEN
        PERFORM ship_inventory_transfer(p_transfer_id, p_actor_id, p_request_id, p_idempotency_key || ':auto_ship');
    END IF;

    IF p_lines IS NOT NULL AND jsonb_typeof(p_lines) = 'array' AND jsonb_array_length(p_lines) > 0 THEN
        FOR v_input IN
            SELECT * FROM jsonb_to_recordset(p_lines) AS x(transfer_line_id UUID, quantity INTEGER)
        LOOP
            SELECT * INTO v_line
            FROM inventory_transfer_lines
            WHERE id = v_input.transfer_line_id AND transfer_id = p_transfer_id AND deleted_at IS NULL
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'transfer line not found';
            END IF;

            v_receive_qty := COALESCE(v_input.quantity, 0);
            IF v_receive_qty <= 0 OR v_receive_qty > (v_line.quantity_shipped - v_line.quantity_received) THEN
                RAISE EXCEPTION 'invalid receive quantity for transfer line %', v_line.id;
            END IF;

            PERFORM receive_inventory_transfer_line(v_transfer, v_line, v_receive_qty, p_actor_id, p_request_id, p_idempotency_key);
        END LOOP;
    ELSE
        FOR v_line IN
            SELECT * FROM inventory_transfer_lines
            WHERE transfer_id = p_transfer_id AND deleted_at IS NULL
            FOR UPDATE
        LOOP
            v_receive_qty := v_line.quantity_shipped - v_line.quantity_received;
            IF v_receive_qty > 0 THEN
                PERFORM receive_inventory_transfer_line(v_transfer, v_line, v_receive_qty, p_actor_id, p_request_id, p_idempotency_key);
            END IF;
        END LOOP;
    END IF;

    SELECT COALESCE(bool_and(quantity_received >= quantity_requested), FALSE)
      INTO v_all_received
      FROM inventory_transfer_lines
     WHERE transfer_id = p_transfer_id AND deleted_at IS NULL;

    UPDATE inventory_transfers
       SET status = CASE WHEN v_all_received THEN 'received' ELSE 'partially_received' END,
           received_at = CASE WHEN v_all_received THEN COALESCE(received_at, NOW()) ELSE received_at END,
           updated_at = NOW(),
           updated_by = p_actor_id
     WHERE id = p_transfer_id;

    RETURN jsonb_build_object(
        'transfer', (SELECT to_jsonb(t) FROM inventory_transfers t WHERE t.id = p_transfer_id),
        'lines', (SELECT COALESCE(jsonb_agg(to_jsonb(tl)), '[]'::JSONB) FROM inventory_transfer_lines tl WHERE tl.transfer_id = p_transfer_id)
    );
END;
$$;


--
-- Name: inventory_transfer_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_transfer_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_id uuid NOT NULL,
    transfer_id uuid NOT NULL,
    product_id uuid NOT NULL,
    variant_id uuid,
    quantity_requested integer NOT NULL,
    quantity_shipped integer DEFAULT 0 NOT NULL,
    quantity_received integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'reserved'::text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT inventory_transfer_lines_quantity_received_check CHECK ((quantity_received >= 0)),
    CONSTRAINT inventory_transfer_lines_quantity_requested_check CHECK ((quantity_requested > 0)),
    CONSTRAINT inventory_transfer_lines_quantity_shipped_check CHECK ((quantity_shipped >= 0)),
    CONSTRAINT inventory_transfer_lines_status_check CHECK ((status = ANY (ARRAY['reserved'::text, 'shipped'::text, 'partially_received'::text, 'received'::text, 'cancelled'::text])))
);


--
-- Name: inventory_transfers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_transfers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_id uuid NOT NULL,
    transfer_number text NOT NULL,
    source_location_id uuid NOT NULL,
    destination_location_id uuid NOT NULL,
    status text DEFAULT 'reserved'::text NOT NULL,
    shipped_at timestamp with time zone,
    received_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    notes text,
    idempotency_key text NOT NULL,
    request_id text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT inventory_transfers_status_check CHECK ((status = ANY (ARRAY['reserved'::text, 'shipped'::text, 'partially_received'::text, 'received'::text, 'cancelled'::text])))
);


--
-- Name: receive_inventory_transfer_line(public.inventory_transfers, public.inventory_transfer_lines, integer, uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.receive_inventory_transfer_line(p_transfer public.inventory_transfers, p_line public.inventory_transfer_lines, p_quantity integer, p_actor_id uuid DEFAULT NULL::uuid, p_request_id text DEFAULT NULL::text, p_idempotency_key text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_source_level_id UUID;
    v_dest_level_id UUID;
BEGIN
    v_source_level_id := ensure_inventory_level_for_location(p_line.product_id, p_line.variant_id, p_transfer.source_location_id);
    v_dest_level_id := ensure_inventory_level_for_location(p_line.product_id, p_line.variant_id, p_transfer.destination_location_id);

    UPDATE inventory_transfer_lines
       SET quantity_received = quantity_received + p_quantity,
           status = CASE WHEN quantity_received + p_quantity >= quantity_requested THEN 'received' ELSE 'partially_received' END,
           updated_at = NOW(),
           updated_by = p_actor_id
     WHERE id = p_line.id;

    UPDATE inventory_levels
       SET reserved = GREATEST(reserved - p_quantity, 0),
           reserved_quantity = GREATEST(COALESCE(reserved_quantity, reserved) - p_quantity, 0),
           updated_at = NOW()
     WHERE id = v_source_level_id;

    UPDATE inventory_levels
       SET available = available + p_quantity,
           available_quantity = COALESCE(available_quantity, available) + p_quantity,
           on_hand_quantity = COALESCE(on_hand_quantity, available + reserved) + p_quantity,
           updated_at = NOW()
     WHERE id = v_dest_level_id;

    INSERT INTO inventory_transfer_receipts (
        site_id, transfer_id, transfer_line_id, product_id, variant_id,
        source_location_id, destination_location_id, quantity_received,
        idempotency_key, request_id, created_by
    )
    VALUES (
        p_transfer.site_id, p_transfer.id, p_line.id, p_line.product_id, p_line.variant_id,
        p_transfer.source_location_id, p_transfer.destination_location_id, p_quantity,
        p_idempotency_key || ':line:' || p_line.id::TEXT, p_request_id, p_actor_id
    )
    ON CONFLICT (site_id, idempotency_key) DO NOTHING;

    INSERT INTO inventory_events (
        site_id, inventory_level_id, location_id, product_id, variant_id,
        event_type, quantity_delta, on_hand_quantity, available_quantity,
        committed_quantity, unavailable_quantity, incoming_quantity, reserved_quantity,
        safety_stock_quantity, source_type, source_id, idempotency_key, request_id, metadata, created_by
    )
    SELECT
        p_transfer.site_id, il.id, p_transfer.destination_location_id, p_line.product_id, p_line.variant_id,
        'transfer_received', p_quantity, COALESCE(il.on_hand_quantity, il.available + il.reserved),
        COALESCE(il.available_quantity, il.available), COALESCE(il.committed_quantity, 0),
        COALESCE(il.unavailable_quantity, 0), COALESCE(il.incoming_quantity, il.incoming),
        COALESCE(il.reserved_quantity, il.reserved), COALESCE(il.safety_stock_quantity, 0),
        'inventory_transfer', p_transfer.id, 'inventory.transfer_received:' || p_line.id::TEXT || ':' || p_idempotency_key,
        p_request_id, jsonb_build_object('quantity_received', p_quantity), p_actor_id
    FROM inventory_levels il WHERE il.id = v_dest_level_id
    ON CONFLICT (site_id, idempotency_key) DO NOTHING;
END;
$$;


--
-- Name: receive_purchase_order(uuid, jsonb, uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.receive_purchase_order(p_purchase_order_id uuid, p_lines jsonb DEFAULT NULL::jsonb, p_actor_id uuid DEFAULT NULL::uuid, p_request_id text DEFAULT NULL::text, p_idempotency_key text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_po purchase_orders%ROWTYPE;
    v_line_input RECORD;
    v_line purchase_order_lines%ROWTYPE;
    v_receive_qty INTEGER;
    v_level_id UUID;
    v_all_received BOOLEAN;
BEGIN
    IF p_idempotency_key IS NULL OR BTRIM(p_idempotency_key) = '' THEN
        RAISE EXCEPTION 'idempotency_key is required';
    END IF;

    SELECT * INTO v_po
    FROM purchase_orders
    WHERE id = p_purchase_order_id AND deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'purchase order not found';
    END IF;

    IF v_po.status IN ('received', 'cancelled', 'closed') THEN
        RAISE EXCEPTION 'purchase order cannot be received from status %', v_po.status;
    END IF;

    IF p_lines IS NOT NULL AND jsonb_typeof(p_lines) = 'array' AND jsonb_array_length(p_lines) > 0 THEN
        FOR v_line_input IN
            SELECT * FROM jsonb_to_recordset(p_lines) AS x(purchase_order_line_id UUID, quantity INTEGER)
        LOOP
            SELECT * INTO v_line
            FROM purchase_order_lines
            WHERE id = v_line_input.purchase_order_line_id
              AND purchase_order_id = p_purchase_order_id
              AND deleted_at IS NULL
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'purchase order line not found';
            END IF;

            v_receive_qty := COALESCE(v_line_input.quantity, 0);
            IF v_receive_qty <= 0 OR v_receive_qty > (v_line.quantity_ordered - v_line.quantity_received) THEN
                RAISE EXCEPTION 'invalid receive quantity for purchase order line %', v_line.id;
            END IF;

            PERFORM receive_purchase_order_line(v_po, v_line, v_receive_qty, p_actor_id, p_request_id, p_idempotency_key);
        END LOOP;
    ELSE
        FOR v_line IN
            SELECT * FROM purchase_order_lines
            WHERE purchase_order_id = p_purchase_order_id AND deleted_at IS NULL
            FOR UPDATE
        LOOP
            v_receive_qty := v_line.quantity_ordered - v_line.quantity_received;
            IF v_receive_qty > 0 THEN
                PERFORM receive_purchase_order_line(v_po, v_line, v_receive_qty, p_actor_id, p_request_id, p_idempotency_key);
            END IF;
        END LOOP;
    END IF;

    SELECT COALESCE(bool_and(quantity_received >= quantity_ordered), FALSE)
      INTO v_all_received
      FROM purchase_order_lines
     WHERE purchase_order_id = p_purchase_order_id AND deleted_at IS NULL;

    UPDATE purchase_orders
       SET status = CASE WHEN v_all_received THEN 'received' ELSE 'partially_received' END,
           received_at = CASE WHEN v_all_received THEN COALESCE(received_at, NOW()) ELSE received_at END,
           updated_at = NOW(),
           updated_by = p_actor_id
     WHERE id = p_purchase_order_id;

    RETURN jsonb_build_object(
        'purchase_order', (SELECT to_jsonb(po) FROM purchase_orders po WHERE po.id = p_purchase_order_id),
        'lines', (SELECT COALESCE(jsonb_agg(to_jsonb(pol)), '[]'::JSONB) FROM purchase_order_lines pol WHERE pol.purchase_order_id = p_purchase_order_id)
    );
END;
$$;


--
-- Name: purchase_order_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_order_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_id uuid NOT NULL,
    purchase_order_id uuid NOT NULL,
    product_id uuid NOT NULL,
    variant_id uuid,
    location_id uuid,
    quantity_ordered integer NOT NULL,
    quantity_received integer DEFAULT 0 NOT NULL,
    unit_cost numeric(12,2) DEFAULT 0 NOT NULL,
    total_cost numeric(12,2) DEFAULT 0 NOT NULL,
    status text DEFAULT 'ordered'::text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT purchase_order_lines_quantity_ordered_check CHECK ((quantity_ordered > 0)),
    CONSTRAINT purchase_order_lines_quantity_received_check CHECK ((quantity_received >= 0)),
    CONSTRAINT purchase_order_lines_status_check CHECK ((status = ANY (ARRAY['ordered'::text, 'partially_received'::text, 'received'::text, 'cancelled'::text])))
);


--
-- Name: purchase_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_id uuid NOT NULL,
    supplier_id uuid,
    location_id uuid,
    po_number text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    ordered_at timestamp with time zone,
    expected_at timestamp with time zone,
    received_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    currency text DEFAULT 'INR'::text NOT NULL,
    subtotal numeric(12,2) DEFAULT 0 NOT NULL,
    total numeric(12,2) DEFAULT 0 NOT NULL,
    notes text,
    idempotency_key text NOT NULL,
    request_id text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT purchase_orders_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'ordered'::text, 'partially_received'::text, 'received'::text, 'cancelled'::text, 'closed'::text])))
);


--
-- Name: receive_purchase_order_line(public.purchase_orders, public.purchase_order_lines, integer, uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.receive_purchase_order_line(p_po public.purchase_orders, p_line public.purchase_order_lines, p_quantity integer, p_actor_id uuid DEFAULT NULL::uuid, p_request_id text DEFAULT NULL::text, p_idempotency_key text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_level_id UUID;
BEGIN
    v_level_id := ensure_inventory_level_for_location(p_line.product_id, p_line.variant_id, p_line.location_id);

    UPDATE purchase_order_lines
       SET quantity_received = quantity_received + p_quantity,
           status = CASE WHEN quantity_received + p_quantity >= quantity_ordered THEN 'received' ELSE 'partially_received' END,
           updated_at = NOW(),
           updated_by = p_actor_id
     WHERE id = p_line.id;

    UPDATE inventory_levels
       SET available = available + p_quantity,
           incoming = GREATEST(incoming - p_quantity, 0),
           available_quantity = COALESCE(available_quantity, available) + p_quantity,
           incoming_quantity = GREATEST(COALESCE(incoming_quantity, incoming) - p_quantity, 0),
           on_hand_quantity = COALESCE(on_hand_quantity, available + reserved) + p_quantity,
           updated_at = NOW()
     WHERE id = v_level_id;

    INSERT INTO purchase_order_receipts (
        site_id, purchase_order_id, purchase_order_line_id, product_id, variant_id, location_id,
        quantity_received, idempotency_key, request_id, created_by
    )
    VALUES (
        p_po.site_id, p_po.id, p_line.id, p_line.product_id, p_line.variant_id, p_line.location_id,
        p_quantity, p_idempotency_key || ':line:' || p_line.id::TEXT, p_request_id, p_actor_id
    )
    ON CONFLICT (site_id, idempotency_key) DO NOTHING;

    INSERT INTO inventory_events (
        site_id, inventory_level_id, location_id, product_id, variant_id,
        event_type, quantity_delta, on_hand_quantity, available_quantity,
        committed_quantity, unavailable_quantity, incoming_quantity, reserved_quantity,
        safety_stock_quantity, source_type, source_id, idempotency_key, request_id, metadata, created_by
    )
    SELECT
        p_po.site_id, il.id, p_line.location_id, p_line.product_id, p_line.variant_id,
        'po_received', p_quantity, COALESCE(il.on_hand_quantity, il.available + il.reserved),
        COALESCE(il.available_quantity, il.available), COALESCE(il.committed_quantity, 0),
        COALESCE(il.unavailable_quantity, 0), COALESCE(il.incoming_quantity, il.incoming),
        COALESCE(il.reserved_quantity, il.reserved), COALESCE(il.safety_stock_quantity, 0),
        'purchase_order', p_po.id, 'inventory.po_received:' || p_line.id::TEXT || ':' || p_idempotency_key,
        p_request_id, jsonb_build_object('quantity_received', p_quantity), p_actor_id
    FROM inventory_levels il WHERE il.id = v_level_id
    ON CONFLICT (site_id, idempotency_key) DO NOTHING;
END;
$$;


--
-- Name: chaos_experiment_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chaos_experiment_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    experiment_id text NOT NULL,
    experiment_type text NOT NULL,
    environment text NOT NULL,
    blast_radius text NOT NULL,
    status text DEFAULT 'planned'::text NOT NULL,
    guardrails jsonb DEFAULT '{}'::jsonb NOT NULL,
    started_at timestamp with time zone,
    finished_at timestamp with time zone,
    result jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT chaos_experiment_runs_blast_radius_check CHECK ((blast_radius = ANY (ARRAY['single-tenant'::text, 'single-runtime'::text, 'single-region'::text, 'global-readonly'::text]))),
    CONSTRAINT chaos_experiment_runs_environment_check CHECK ((environment = ANY (ARRAY['staging'::text, 'production'::text]))),
    CONSTRAINT chaos_experiment_runs_experiment_type_check CHECK ((experiment_type = ANY (ARRAY['queue-outage'::text, 'provider-outage'::text, 'replay-corruption'::text, 'cache-failure'::text, 'regional-outage'::text, 'workflow-recovery'::text, 'dlq-flood'::text, 'telemetry-outage'::text]))),
    CONSTRAINT chaos_experiment_runs_status_check CHECK ((status = ANY (ARRAY['planned'::text, 'approved'::text, 'running'::text, 'passed'::text, 'failed'::text, 'aborted'::text])))
);


--
-- Name: record_chaos_experiment_run(text, text, text, text, text, jsonb, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_chaos_experiment_run(p_experiment_id text, p_experiment_type text, p_environment text, p_blast_radius text, p_status text, p_guardrails jsonb DEFAULT '{}'::jsonb, p_result jsonb DEFAULT '{}'::jsonb) RETURNS public.chaos_experiment_runs
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    run chaos_experiment_runs%ROWTYPE;
BEGIN
    INSERT INTO chaos_experiment_runs (
        experiment_id,
        experiment_type,
        environment,
        blast_radius,
        status,
        guardrails,
        started_at,
        finished_at,
        result
    )
    VALUES (
        p_experiment_id,
        p_experiment_type,
        p_environment,
        p_blast_radius,
        p_status,
        COALESCE(p_guardrails, '{}'),
        CASE WHEN p_status = 'running' THEN NOW() ELSE NULL END,
        CASE WHEN p_status IN ('passed', 'failed', 'aborted') THEN NOW() ELSE NULL END,
        COALESCE(p_result, '{}')
    )
    ON CONFLICT (experiment_id) DO UPDATE
       SET status = EXCLUDED.status,
           guardrails = EXCLUDED.guardrails,
           finished_at = EXCLUDED.finished_at,
           result = EXCLUDED.result,
           updated_at = NOW()
    RETURNING * INTO run;

    RETURN run;
END;
$$;


--
-- Name: deployment_health_gate_results; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.deployment_health_gate_results (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    gate_id text NOT NULL,
    promotion_id text,
    runtime_root text NOT NULL,
    environment text NOT NULL,
    gate_name text NOT NULL,
    status text NOT NULL,
    observed_value jsonb DEFAULT '{}'::jsonb NOT NULL,
    threshold jsonb DEFAULT '{}'::jsonb NOT NULL,
    evidence_url text,
    evaluated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT deployment_health_gate_results_environment_check CHECK ((environment = ANY (ARRAY['staging'::text, 'production'::text]))),
    CONSTRAINT deployment_health_gate_results_status_check CHECK ((status = ANY (ARRAY['passed'::text, 'failed'::text, 'skipped'::text, 'blocked'::text])))
);


--
-- Name: record_deployment_health_gate_result(text, text, text, text, text, text, jsonb, jsonb, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_deployment_health_gate_result(p_gate_id text, p_promotion_id text, p_runtime_root text, p_environment text, p_gate_name text, p_status text, p_observed_value jsonb DEFAULT '{}'::jsonb, p_threshold jsonb DEFAULT '{}'::jsonb, p_evidence_url text DEFAULT NULL::text) RETURNS public.deployment_health_gate_results
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    gate deployment_health_gate_results%ROWTYPE;
BEGIN
    INSERT INTO deployment_health_gate_results (
        gate_id, promotion_id, runtime_root, environment, gate_name, status,
        observed_value, threshold, evidence_url
    )
    VALUES (
        p_gate_id, p_promotion_id, p_runtime_root, p_environment, p_gate_name, p_status,
        COALESCE(p_observed_value, '{}'), COALESCE(p_threshold, '{}'), p_evidence_url
    )
    ON CONFLICT (gate_id) DO UPDATE
       SET status = EXCLUDED.status,
           observed_value = EXCLUDED.observed_value,
           threshold = EXCLUDED.threshold,
           evidence_url = EXCLUDED.evidence_url,
           updated_at = NOW()
    RETURNING * INTO gate;

    RETURN gate;
END;
$$;


--
-- Name: deployment_promotion_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.deployment_promotion_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    promotion_id text NOT NULL,
    runtime_name text NOT NULL,
    runtime_root text NOT NULL,
    environment text NOT NULL,
    strategy text NOT NULL,
    version text NOT NULL,
    status text DEFAULT 'planned'::text NOT NULL,
    health_gates jsonb DEFAULT '[]'::jsonb NOT NULL,
    started_at timestamp with time zone,
    finished_at timestamp with time zone,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT deployment_promotion_runs_environment_check CHECK ((environment = ANY (ARRAY['dev'::text, 'staging'::text, 'production'::text]))),
    CONSTRAINT deployment_promotion_runs_status_check CHECK ((status = ANY (ARRAY['planned'::text, 'running'::text, 'blocked'::text, 'promoted'::text, 'rolled-back'::text, 'failed'::text]))),
    CONSTRAINT deployment_promotion_runs_strategy_check CHECK ((strategy = ANY (ARRAY['preview'::text, 'canary'::text, 'blue-green'::text, 'rollback'::text])))
);


--
-- Name: record_deployment_promotion_run(text, text, text, text, text, text, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_deployment_promotion_run(p_promotion_id text, p_runtime_name text, p_runtime_root text, p_environment text, p_strategy text, p_version text, p_status text, p_health_gates jsonb DEFAULT '[]'::jsonb) RETURNS public.deployment_promotion_runs
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    run deployment_promotion_runs%ROWTYPE;
BEGIN
    INSERT INTO deployment_promotion_runs (
        promotion_id,
        runtime_name,
        runtime_root,
        environment,
        strategy,
        version,
        status,
        health_gates,
        started_at,
        finished_at
    )
    VALUES (
        p_promotion_id,
        p_runtime_name,
        p_runtime_root,
        p_environment,
        p_strategy,
        p_version,
        p_status,
        COALESCE(p_health_gates, '[]'),
        CASE WHEN p_status = 'running' THEN NOW() ELSE NULL END,
        CASE WHEN p_status IN ('promoted', 'rolled-back', 'failed', 'blocked') THEN NOW() ELSE NULL END
    )
    ON CONFLICT (promotion_id) DO UPDATE
       SET status = EXCLUDED.status,
           health_gates = EXCLUDED.health_gates,
           finished_at = EXCLUDED.finished_at,
           updated_at = NOW()
    RETURNING * INTO run;

    RETURN run;
END;
$$;


--
-- Name: failover_drill_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.failover_drill_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    drill_id text NOT NULL,
    drill_type text NOT NULL,
    source_region text,
    target_region text,
    affected_runtimes text[] DEFAULT ARRAY[]::text[] NOT NULL,
    status text DEFAULT 'planned'::text NOT NULL,
    started_at timestamp with time zone,
    finished_at timestamp with time zone,
    rto_seconds integer,
    rpo_seconds integer,
    result jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT failover_drill_runs_drill_type_check CHECK ((drill_type = ANY (ARRAY['regional'::text, 'provider'::text, 'queue'::text, 'cache'::text, 'telemetry'::text, 'database'::text]))),
    CONSTRAINT failover_drill_runs_status_check CHECK ((status = ANY (ARRAY['planned'::text, 'running'::text, 'passed'::text, 'failed'::text, 'cancelled'::text])))
);


--
-- Name: record_failover_drill_run(text, text, text, text, text[], text, integer, integer, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_failover_drill_run(p_drill_id text, p_drill_type text, p_source_region text, p_target_region text, p_affected_runtimes text[], p_status text, p_rto_seconds integer, p_rpo_seconds integer, p_result jsonb DEFAULT '{}'::jsonb) RETURNS public.failover_drill_runs
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    run failover_drill_runs%ROWTYPE;
BEGIN
    INSERT INTO failover_drill_runs (
        drill_id,
        drill_type,
        source_region,
        target_region,
        affected_runtimes,
        status,
        started_at,
        finished_at,
        rto_seconds,
        rpo_seconds,
        result
    )
    VALUES (
        p_drill_id,
        p_drill_type,
        p_source_region,
        p_target_region,
        COALESCE(p_affected_runtimes, ARRAY[]::TEXT[]),
        p_status,
        NOW(),
        CASE WHEN p_status IN ('passed', 'failed', 'cancelled') THEN NOW() ELSE NULL END,
        p_rto_seconds,
        p_rpo_seconds,
        COALESCE(p_result, '{}')
    )
    ON CONFLICT (drill_id) DO UPDATE
       SET status = EXCLUDED.status,
           finished_at = EXCLUDED.finished_at,
           rto_seconds = EXCLUDED.rto_seconds,
           rpo_seconds = EXCLUDED.rpo_seconds,
           result = EXCLUDED.result,
           updated_at = NOW()
    RETURNING * INTO run;

    RETURN run;
END;
$$;


--
-- Name: load_test_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.load_test_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    run_id text NOT NULL,
    test_type text NOT NULL,
    environment text NOT NULL,
    status text DEFAULT 'planned'::text NOT NULL,
    tool text NOT NULL,
    target_rps integer,
    p95_latency_ms integer,
    error_rate numeric(8,6),
    report_url text,
    result jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT load_test_runs_environment_check CHECK ((environment = ANY (ARRAY['staging'::text, 'production'::text]))),
    CONSTRAINT load_test_runs_status_check CHECK ((status = ANY (ARRAY['planned'::text, 'running'::text, 'passed'::text, 'failed'::text, 'cancelled'::text]))),
    CONSTRAINT load_test_runs_test_type_check CHECK ((test_type = ANY (ARRAY['queue'::text, 'replay'::text, 'projection-rebuild'::text, 'tenant-isolation'::text, 'cache-throughput'::text, 'checkout-concurrency'::text, 'workflow-concurrency'::text, 'multi-region-latency'::text]))),
    CONSTRAINT load_test_runs_tool_check CHECK ((tool = ANY (ARRAY['k6'::text, 'gatling'::text, 'locust'::text])))
);


--
-- Name: record_load_test_run(text, text, text, text, text, integer, integer, numeric, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_load_test_run(p_run_id text, p_test_type text, p_environment text, p_status text, p_tool text, p_target_rps integer, p_p95_latency_ms integer, p_error_rate numeric, p_report_url text, p_result jsonb DEFAULT '{}'::jsonb) RETURNS public.load_test_runs
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    run load_test_runs%ROWTYPE;
BEGIN
    INSERT INTO load_test_runs (
        run_id,
        test_type,
        environment,
        status,
        tool,
        target_rps,
        p95_latency_ms,
        error_rate,
        report_url,
        result
    )
    VALUES (
        p_run_id,
        p_test_type,
        p_environment,
        p_status,
        p_tool,
        p_target_rps,
        p_p95_latency_ms,
        p_error_rate,
        p_report_url,
        COALESCE(p_result, '{}')
    )
    ON CONFLICT (run_id) DO UPDATE
       SET status = EXCLUDED.status,
           p95_latency_ms = EXCLUDED.p95_latency_ms,
           error_rate = EXCLUDED.error_rate,
           report_url = EXCLUDED.report_url,
           result = EXCLUDED.result,
           updated_at = NOW()
    RETURNING * INTO run;

    RETURN run;
END;
$$;


--
-- Name: operational_certification_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.operational_certification_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    certification_id text NOT NULL,
    environment text NOT NULL,
    certification_mode text NOT NULL,
    status text NOT NULL,
    repository_maturity_score numeric NOT NULL,
    live_maturity_score numeric NOT NULL,
    evidence_summary jsonb DEFAULT '{}'::jsonb NOT NULL,
    missing_capabilities text[] DEFAULT '{}'::text[] NOT NULL,
    report jsonb DEFAULT '{}'::jsonb NOT NULL,
    generated_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT operational_certification_repor_repository_maturity_score_check CHECK (((repository_maturity_score >= (0)::numeric) AND (repository_maturity_score <= (10)::numeric))),
    CONSTRAINT operational_certification_reports_certification_mode_check CHECK ((certification_mode = ANY (ARRAY['plan'::text, 'execute'::text]))),
    CONSTRAINT operational_certification_reports_environment_check CHECK ((environment = ANY (ARRAY['staging'::text, 'production'::text]))),
    CONSTRAINT operational_certification_reports_live_maturity_score_check CHECK (((live_maturity_score >= (0)::numeric) AND (live_maturity_score <= (10)::numeric))),
    CONSTRAINT operational_certification_reports_status_check CHECK ((status = ANY (ARRAY['credential-gated'::text, 'certified'::text, 'failed'::text, 'expired'::text])))
);


--
-- Name: record_operational_certification_report(text, text, text, text, numeric, numeric, jsonb, text[], timestamp with time zone, jsonb, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_operational_certification_report(p_certification_id text, p_environment text, p_certification_mode text, p_status text, p_repository_maturity_score numeric, p_live_maturity_score numeric, p_evidence_summary jsonb DEFAULT '{}'::jsonb, p_missing_capabilities text[] DEFAULT '{}'::text[], p_expires_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_report jsonb DEFAULT '{}'::jsonb, p_actor_id uuid DEFAULT NULL::uuid) RETURNS public.operational_certification_reports
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    certification operational_certification_reports%ROWTYPE;
BEGIN
    INSERT INTO operational_certification_reports (
        certification_id,
        environment,
        certification_mode,
        status,
        repository_maturity_score,
        live_maturity_score,
        evidence_summary,
        missing_capabilities,
        expires_at,
        report,
        created_by,
        updated_by
    )
    VALUES (
        p_certification_id,
        p_environment,
        p_certification_mode,
        p_status,
        p_repository_maturity_score,
        p_live_maturity_score,
        COALESCE(p_evidence_summary, '{}'),
        COALESCE(p_missing_capabilities, '{}'),
        p_expires_at,
        COALESCE(p_report, '{}'),
        p_actor_id,
        p_actor_id
    )
    ON CONFLICT (certification_id) DO UPDATE
       SET status = EXCLUDED.status,
           repository_maturity_score = EXCLUDED.repository_maturity_score,
           live_maturity_score = EXCLUDED.live_maturity_score,
           evidence_summary = EXCLUDED.evidence_summary,
           missing_capabilities = EXCLUDED.missing_capabilities,
           expires_at = EXCLUDED.expires_at,
           report = EXCLUDED.report,
           generated_at = NOW(),
           updated_by = EXCLUDED.updated_by,
           updated_at = NOW()
    RETURNING * INTO certification;

    RETURN certification;
END;
$$;


--
-- Name: operational_dashboard_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.operational_dashboard_snapshots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    snapshot_id text NOT NULL,
    dashboard_name text NOT NULL,
    environment text NOT NULL,
    status text NOT NULL,
    source_api text NOT NULL,
    source_projection text NOT NULL,
    panels jsonb DEFAULT '[]'::jsonb NOT NULL,
    sampled_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT operational_dashboard_snapshots_environment_check CHECK ((environment = ANY (ARRAY['staging'::text, 'production'::text]))),
    CONSTRAINT operational_dashboard_snapshots_status_check CHECK ((status = ANY (ARRAY['healthy'::text, 'degraded'::text, 'unavailable'::text])))
);


--
-- Name: record_operational_dashboard_snapshot(text, text, text, text, text, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_operational_dashboard_snapshot(p_snapshot_id text, p_dashboard_name text, p_environment text, p_status text, p_source_api text, p_source_projection text, p_panels jsonb DEFAULT '[]'::jsonb) RETURNS public.operational_dashboard_snapshots
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    snapshot operational_dashboard_snapshots%ROWTYPE;
BEGIN
    INSERT INTO operational_dashboard_snapshots (
        snapshot_id, dashboard_name, environment, status, source_api, source_projection, panels
    )
    VALUES (
        p_snapshot_id, p_dashboard_name, p_environment, p_status, p_source_api, p_source_projection, COALESCE(p_panels, '[]')
    )
    ON CONFLICT (snapshot_id) DO UPDATE
       SET status = EXCLUDED.status,
           panels = EXCLUDED.panels,
           sampled_at = NOW(),
           updated_at = NOW()
    RETURNING * INTO snapshot;

    RETURN snapshot;
END;
$$;


--
-- Name: operational_feature_flag_exposures; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.operational_feature_flag_exposures (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    exposure_id text NOT NULL,
    flag_key text NOT NULL,
    environment text NOT NULL,
    site_id uuid,
    actor_id uuid,
    region text,
    enabled boolean NOT NULL,
    variant text,
    reason text NOT NULL,
    rule_id text,
    bucket integer,
    evaluated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT operational_feature_flag_exposures_bucket_check CHECK (((bucket IS NULL) OR ((bucket >= 0) AND (bucket < 100)))),
    CONSTRAINT operational_feature_flag_exposures_environment_check CHECK ((environment = ANY (ARRAY['local'::text, 'development'::text, 'staging'::text, 'production'::text])))
);


--
-- Name: record_operational_feature_flag_exposure(text, text, text, boolean, text, uuid, uuid, text, text, text, integer, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_operational_feature_flag_exposure(p_exposure_id text, p_flag_key text, p_environment text, p_enabled boolean, p_reason text, p_site_id uuid DEFAULT NULL::uuid, p_actor_id uuid DEFAULT NULL::uuid, p_region text DEFAULT NULL::text, p_variant text DEFAULT NULL::text, p_rule_id text DEFAULT NULL::text, p_bucket integer DEFAULT NULL::integer, p_actor_recorded_by uuid DEFAULT NULL::uuid) RETURNS public.operational_feature_flag_exposures
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    exposure operational_feature_flag_exposures%ROWTYPE;
BEGIN
    INSERT INTO operational_feature_flag_exposures (
        exposure_id,
        flag_key,
        environment,
        site_id,
        actor_id,
        region,
        enabled,
        variant,
        reason,
        rule_id,
        bucket,
        created_by,
        updated_by
    )
    VALUES (
        p_exposure_id,
        p_flag_key,
        p_environment,
        p_site_id,
        p_actor_id,
        p_region,
        p_enabled,
        p_variant,
        p_reason,
        p_rule_id,
        p_bucket,
        p_actor_recorded_by,
        p_actor_recorded_by
    )
    ON CONFLICT (exposure_id) DO UPDATE
       SET enabled = EXCLUDED.enabled,
           variant = EXCLUDED.variant,
           reason = EXCLUDED.reason,
           rule_id = EXCLUDED.rule_id,
           bucket = EXCLUDED.bucket,
           evaluated_at = NOW(),
           updated_by = EXCLUDED.updated_by,
           updated_at = NOW()
    RETURNING * INTO exposure;

    RETURN exposure;
END;
$$;


--
-- Name: record_order_payment_failure(uuid, text, text, text, text, text, boolean, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_order_payment_failure(p_order_id uuid, p_provider text, p_provider_event_id text, p_payment_status text, p_order_status text, p_reason text DEFAULT NULL::text, p_release_inventory boolean DEFAULT false, p_request_id text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_order RECORD;
    v_event_id TEXT;
    v_order_json JSONB;
BEGIN
    IF p_order_id IS NULL OR p_provider IS NULL THEN
        RAISE EXCEPTION 'order_id and provider are required';
    END IF;

    IF p_payment_status NOT IN ('failed', 'refunded') THEN
        RAISE EXCEPTION 'unsupported payment status';
    END IF;

    IF p_order_status NOT IN ('cancelled', 'refunded') THEN
        RAISE EXCEPTION 'unsupported order status';
    END IF;

    v_event_id := COALESCE(
        NULLIF(p_provider_event_id, ''),
        p_provider || ':' || p_payment_status || ':' || p_order_id::TEXT
    );

    SELECT id, store_id, payment_status, status
      INTO v_order
      FROM orders
     WHERE id = p_order_id
       AND deleted_at IS NULL
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'order not found';
    END IF;

    INSERT INTO payment_webhook_events (
        provider,
        provider_event_id,
        event_type,
        signature_valid,
        processing_status,
        raw_payload,
        processed_at
    )
    VALUES (
        p_provider,
        v_event_id,
        'checkout.payment.' || p_payment_status,
        TRUE,
        'processed',
        jsonb_build_object(
            'order_id', p_order_id,
            'provider', p_provider,
            'payment_status', p_payment_status,
            'order_status', p_order_status,
            'reason', p_reason,
            'request_id', p_request_id
        ),
        NOW()
    )
    ON CONFLICT (provider, provider_event_id)
    DO UPDATE SET
        signature_valid = TRUE,
        processing_status = 'processed',
        processed_at = COALESCE(payment_webhook_events.processed_at, NOW()),
        updated_at = NOW();

    UPDATE orders
       SET payment_status = p_payment_status,
           status = p_order_status,
           payment_failure_reason = p_reason,
           last_payment_event_id = v_event_id,
           updated_at = NOW()
     WHERE id = p_order_id
     RETURNING to_jsonb(orders.*) INTO v_order_json;

    IF p_release_inventory THEN
        PERFORM release_order_inventory(p_order_id, NULL, p_request_id, COALESCE(p_reason, 'payment_failed'));
    END IF;

    INSERT INTO outbox_events (
        store_id,
        aggregate_type,
        aggregate_id,
        event_type,
        payload,
        idempotency_key,
        request_id
    )
    VALUES (
        v_order.store_id,
        'order',
        p_order_id::TEXT,
        'payment.' || p_payment_status,
        jsonb_build_object(
            'store_id', v_order.store_id,
            'order_id', p_order_id,
            'provider', p_provider,
            'provider_event_id', v_event_id,
            'payment_status', p_payment_status,
            'order_status', p_order_status,
            'reason', p_reason
        ),
        'payment.' || p_payment_status || ':' || p_provider || ':' || v_event_id,
        p_request_id
    )
    ON CONFLICT (idempotency_key) DO NOTHING;

    INSERT INTO audit_activity_events (
        store_id,
        actor_type,
        action,
        resource_type,
        resource_id,
        request_id,
        after_state
    )
    VALUES (
        v_order.store_id,
        'webhook',
        'payment.' || p_payment_status,
        'order',
        p_order_id::TEXT,
        p_request_id,
        jsonb_build_object(
            'order_id', p_order_id,
            'provider', p_provider,
            'provider_event_id', v_event_id,
            'payment_status', p_payment_status,
            'order_status', p_order_status,
            'reason', p_reason
        )
    );

    RETURN v_order_json;
END;
$$;


--
-- Name: record_order_payment_failure_with_ledger(uuid, text, text, text, text, text, boolean, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_order_payment_failure_with_ledger(p_order_id uuid, p_provider text, p_provider_event_id text, p_payment_status text, p_order_status text, p_reason text DEFAULT NULL::text, p_release_inventory boolean DEFAULT false, p_request_id text DEFAULT NULL::text, p_idempotency_key text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_order_json JSONB;
    v_order RECORD;
    v_payment_transaction_id UUID;
    v_attempt_status TEXT := CASE WHEN p_payment_status = 'refunded' THEN 'succeeded' ELSE 'failed' END;
BEGIN
    v_order_json := record_order_payment_failure(
        p_order_id,
        p_provider,
        p_provider_event_id,
        p_payment_status,
        p_order_status,
        p_reason,
        p_release_inventory,
        p_request_id
    );

    SELECT *
      INTO v_order
      FROM orders
     WHERE id = p_order_id
       AND deleted_at IS NULL;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'order not found';
    END IF;

    UPDATE payment_transactions
       SET status = CASE WHEN p_payment_status = 'refunded' THEN 'refunded' ELSE 'failed' END,
           provider_event_id = p_provider_event_id,
           failure_reason = p_reason,
           refunded_at = CASE WHEN p_payment_status = 'refunded' THEN COALESCE(refunded_at, NOW()) ELSE refunded_at END,
           request_id = COALESCE(p_request_id, request_id),
           idempotency_key = COALESCE(p_idempotency_key, idempotency_key),
           updated_at = NOW()
     WHERE order_id = p_order_id
       AND gateway = p_provider
       AND deleted_at IS NULL
     RETURNING id INTO v_payment_transaction_id;

    IF v_payment_transaction_id IS NULL THEN
        INSERT INTO payment_transactions (
            order_id,
            store_id,
            site_id,
            gateway,
            amount,
            currency,
            status,
            failure_reason,
            provider_event_id,
            payment_method,
            metadata,
            request_id,
            idempotency_key,
            refunded_at
        )
        VALUES (
            p_order_id,
            v_order.store_id,
            v_order.store_id,
            p_provider,
            COALESCE(v_order.total, 0),
            COALESCE(v_order.currency, 'INR'),
            CASE WHEN p_payment_status = 'refunded' THEN 'refunded' ELSE 'failed' END,
            p_reason,
            p_provider_event_id,
            p_provider,
            jsonb_build_object('source', 'payment_failure'),
            p_request_id,
            p_idempotency_key,
            CASE WHEN p_payment_status = 'refunded' THEN NOW() ELSE NULL END
        )
        RETURNING id INTO v_payment_transaction_id;
    END IF;

    INSERT INTO payment_attempts (
        site_id,
        order_id,
        payment_transaction_id,
        provider,
        attempt_type,
        status,
        amount,
        currency,
        provider_event_id,
        idempotency_key,
        request_id,
        failure_reason,
        metadata
    )
    VALUES (
        v_order.store_id,
        p_order_id,
        v_payment_transaction_id,
        p_provider,
        'failure',
        v_attempt_status,
        COALESCE(v_order.total, 0),
        COALESCE(v_order.currency, 'INR'),
        p_provider_event_id,
        p_idempotency_key,
        p_request_id,
        p_reason,
        jsonb_build_object('payment_status', p_payment_status, 'order_status', p_order_status)
    )
    ON CONFLICT DO NOTHING;

    RETURN v_order_json;
END;
$$;


--
-- Name: production_incidents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.production_incidents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    incident_id text NOT NULL,
    title text NOT NULL,
    severity text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    affected_runtimes text[] DEFAULT ARRAY[]::text[] NOT NULL,
    affected_regions text[] DEFAULT ARRAY[]::text[] NOT NULL,
    customer_impact text NOT NULL,
    commander_id uuid,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    mitigated_at timestamp with time zone,
    resolved_at timestamp with time zone,
    postmortem_url text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT production_incidents_severity_check CHECK ((severity = ANY (ARRAY['sev1'::text, 'sev2'::text, 'sev3'::text, 'sev4'::text]))),
    CONSTRAINT production_incidents_status_check CHECK ((status = ANY (ARRAY['open'::text, 'mitigating'::text, 'resolved'::text, 'closed'::text])))
);


--
-- Name: record_production_incident(text, text, text, text[], text[], text, uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_production_incident(p_incident_id text, p_title text, p_severity text, p_affected_runtimes text[], p_affected_regions text[], p_customer_impact text, p_commander_id uuid, p_metadata jsonb DEFAULT '{}'::jsonb) RETURNS public.production_incidents
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    incident production_incidents%ROWTYPE;
BEGIN
    INSERT INTO production_incidents (
        incident_id,
        title,
        severity,
        affected_runtimes,
        affected_regions,
        customer_impact,
        commander_id,
        metadata
    )
    VALUES (
        p_incident_id,
        p_title,
        p_severity,
        COALESCE(p_affected_runtimes, ARRAY[]::TEXT[]),
        COALESCE(p_affected_regions, ARRAY[]::TEXT[]),
        p_customer_impact,
        p_commander_id,
        COALESCE(p_metadata, '{}')
    )
    ON CONFLICT (incident_id) DO UPDATE
       SET title = EXCLUDED.title,
           severity = EXCLUDED.severity,
           affected_runtimes = EXCLUDED.affected_runtimes,
           affected_regions = EXCLUDED.affected_regions,
           customer_impact = EXCLUDED.customer_impact,
           commander_id = EXCLUDED.commander_id,
           metadata = EXCLUDED.metadata,
           updated_at = NOW()
    RETURNING * INTO incident;

    INSERT INTO production_incident_events (
        incident_id,
        event_type,
        actor_id,
        summary,
        details
    )
    VALUES (
        p_incident_id,
        'created',
        p_commander_id,
        p_title,
        COALESCE(p_metadata, '{}')
    );

    RETURN incident;
END;
$$;


--
-- Name: production_readiness_gate_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.production_readiness_gate_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    gate_run_id text NOT NULL,
    environment text NOT NULL,
    version text NOT NULL,
    status text NOT NULL,
    gates jsonb DEFAULT '[]'::jsonb NOT NULL,
    failure_summary text,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    finished_at timestamp with time zone,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT production_readiness_gate_runs_environment_check CHECK ((environment = ANY (ARRAY['staging'::text, 'production'::text]))),
    CONSTRAINT production_readiness_gate_runs_status_check CHECK ((status = ANY (ARRAY['planned'::text, 'running'::text, 'passed'::text, 'failed'::text, 'blocked'::text])))
);


--
-- Name: record_production_readiness_gate_run(text, text, text, text, jsonb, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_production_readiness_gate_run(p_gate_run_id text, p_environment text, p_version text, p_status text, p_gates jsonb DEFAULT '[]'::jsonb, p_failure_summary text DEFAULT NULL::text) RETURNS public.production_readiness_gate_runs
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    run production_readiness_gate_runs%ROWTYPE;
BEGIN
    INSERT INTO production_readiness_gate_runs (
        gate_run_id, environment, version, status, gates, failure_summary, finished_at
    )
    VALUES (
        p_gate_run_id, p_environment, p_version, p_status, COALESCE(p_gates, '[]'), p_failure_summary,
        CASE WHEN p_status IN ('passed', 'failed', 'blocked') THEN NOW() ELSE NULL END
    )
    ON CONFLICT (gate_run_id) DO UPDATE
       SET status = EXCLUDED.status,
           gates = EXCLUDED.gates,
           failure_summary = EXCLUDED.failure_summary,
           finished_at = EXCLUDED.finished_at,
           updated_at = NOW()
    RETURNING * INTO run;

    RETURN run;
END;
$$;


--
-- Name: projection_operation_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.projection_operation_snapshots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    projection_name text NOT NULL,
    projection_version integer DEFAULT 1 NOT NULL,
    site_id uuid,
    object_count integer DEFAULT 0 NOT NULL,
    stale_count integer DEFAULT 0 NOT NULL,
    rebuilding_count integer DEFAULT 0 NOT NULL,
    failed_count integer DEFAULT 0 NOT NULL,
    max_lag_ms integer DEFAULT 0 NOT NULL,
    sampled_at timestamp with time zone DEFAULT now() NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: record_projection_operation_snapshot(text, integer, uuid, integer, integer, integer, integer, integer, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_projection_operation_snapshot(p_projection_name text, p_projection_version integer, p_site_id uuid, p_object_count integer, p_stale_count integer, p_rebuilding_count integer, p_failed_count integer, p_max_lag_ms integer, p_metadata jsonb DEFAULT '{}'::jsonb) RETURNS public.projection_operation_snapshots
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    snapshot projection_operation_snapshots%ROWTYPE;
BEGIN
    INSERT INTO projection_operation_snapshots (
        projection_name,
        projection_version,
        site_id,
        object_count,
        stale_count,
        rebuilding_count,
        failed_count,
        max_lag_ms,
        metadata
    )
    VALUES (
        p_projection_name,
        COALESCE(p_projection_version, 1),
        p_site_id,
        COALESCE(p_object_count, 0),
        COALESCE(p_stale_count, 0),
        COALESCE(p_rebuilding_count, 0),
        COALESCE(p_failed_count, 0),
        COALESCE(p_max_lag_ms, 0),
        COALESCE(p_metadata, '{}')
    )
    RETURNING * INTO snapshot;

    RETURN snapshot;
END;
$$;


--
-- Name: provider_recovery_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.provider_recovery_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider text NOT NULL,
    operation text NOT NULL,
    action text NOT NULL,
    retry_after_seconds integer,
    alternate_provider text,
    reason text NOT NULL,
    status text DEFAULT 'planned'::text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT provider_recovery_plans_action_check CHECK ((action = ANY (ARRAY['hold'::text, 'retry'::text, 'failover'::text, 'degrade'::text, 'restore'::text]))),
    CONSTRAINT provider_recovery_plans_status_check CHECK ((status = ANY (ARRAY['planned'::text, 'running'::text, 'completed'::text, 'failed'::text, 'cancelled'::text])))
);


--
-- Name: record_provider_recovery_plan(text, text, text, integer, text, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_provider_recovery_plan(p_provider text, p_operation text, p_action text, p_retry_after_seconds integer, p_alternate_provider text, p_reason text, p_metadata jsonb DEFAULT '{}'::jsonb) RETURNS public.provider_recovery_plans
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    recovery_plan provider_recovery_plans%ROWTYPE;
BEGIN
    INSERT INTO provider_recovery_plans (
        provider,
        operation,
        action,
        retry_after_seconds,
        alternate_provider,
        reason,
        metadata
    )
    VALUES (
        p_provider,
        p_operation,
        p_action,
        p_retry_after_seconds,
        p_alternate_provider,
        p_reason,
        COALESCE(p_metadata, '{}')
    )
    RETURNING * INTO recovery_plan;

    RETURN recovery_plan;
END;
$$;


--
-- Name: regional_routing_overrides; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.regional_routing_overrides (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    override_id text NOT NULL,
    environment text NOT NULL,
    tenant_site_id uuid,
    runtime_root text NOT NULL,
    source_region text NOT NULL,
    target_region text NOT NULL,
    reason text NOT NULL,
    status text NOT NULL,
    expires_at timestamp with time zone,
    activated_at timestamp with time zone,
    restored_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT regional_routing_overrides_environment_check CHECK ((environment = ANY (ARRAY['staging'::text, 'production'::text]))),
    CONSTRAINT regional_routing_overrides_status_check CHECK ((status = ANY (ARRAY['planned'::text, 'active'::text, 'restored'::text, 'cancelled'::text])))
);


--
-- Name: record_regional_routing_override(text, text, uuid, text, text, text, text, text, timestamp with time zone, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_regional_routing_override(p_override_id text, p_environment text, p_tenant_site_id uuid, p_runtime_root text, p_source_region text, p_target_region text, p_reason text, p_status text, p_expires_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_metadata jsonb DEFAULT '{}'::jsonb) RETURNS public.regional_routing_overrides
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    override_row regional_routing_overrides%ROWTYPE;
BEGIN
    INSERT INTO regional_routing_overrides (
        override_id, environment, tenant_site_id, runtime_root, source_region, target_region,
        reason, status, expires_at, activated_at, restored_at, metadata
    )
    VALUES (
        p_override_id, p_environment, p_tenant_site_id, p_runtime_root, p_source_region, p_target_region,
        p_reason, p_status, p_expires_at,
        CASE WHEN p_status = 'active' THEN NOW() ELSE NULL END,
        CASE WHEN p_status = 'restored' THEN NOW() ELSE NULL END,
        COALESCE(p_metadata, '{}')
    )
    ON CONFLICT (override_id) DO UPDATE
       SET status = EXCLUDED.status,
           expires_at = EXCLUDED.expires_at,
           activated_at = COALESCE(regional_routing_overrides.activated_at, EXCLUDED.activated_at),
           restored_at = EXCLUDED.restored_at,
           metadata = EXCLUDED.metadata,
           updated_at = NOW()
    RETURNING * INTO override_row;

    RETURN override_row;
END;
$$;


--
-- Name: rollout_stage_evidence; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rollout_stage_evidence (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    stage_id text NOT NULL,
    promotion_id text,
    runtime_root text NOT NULL,
    environment text NOT NULL,
    strategy text NOT NULL,
    rollout_percent integer,
    source_color text,
    target_color text,
    status text NOT NULL,
    gates jsonb DEFAULT '[]'::jsonb NOT NULL,
    score numeric,
    evidence_url text,
    started_at timestamp with time zone,
    finished_at timestamp with time zone,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT rollout_stage_evidence_environment_check CHECK ((environment = ANY (ARRAY['development'::text, 'staging'::text, 'production'::text]))),
    CONSTRAINT rollout_stage_evidence_rollout_percent_check CHECK (((rollout_percent IS NULL) OR ((rollout_percent >= 0) AND (rollout_percent <= 100)))),
    CONSTRAINT rollout_stage_evidence_score_check CHECK (((score IS NULL) OR ((score >= (0)::numeric) AND (score <= (10)::numeric)))),
    CONSTRAINT rollout_stage_evidence_source_color_check CHECK (((source_color IS NULL) OR (source_color = ANY (ARRAY['blue'::text, 'green'::text])))),
    CONSTRAINT rollout_stage_evidence_status_check CHECK ((status = ANY (ARRAY['planned'::text, 'running'::text, 'passed'::text, 'failed'::text, 'rolled-back'::text, 'blocked'::text]))),
    CONSTRAINT rollout_stage_evidence_strategy_check CHECK ((strategy = ANY (ARRAY['canary'::text, 'blue-green'::text, 'shadow'::text, 'rollback'::text]))),
    CONSTRAINT rollout_stage_evidence_target_color_check CHECK (((target_color IS NULL) OR (target_color = ANY (ARRAY['blue'::text, 'green'::text]))))
);


--
-- Name: record_rollout_stage_evidence(text, text, text, text, text, jsonb, numeric, integer, text, text, text, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_rollout_stage_evidence(p_stage_id text, p_runtime_root text, p_environment text, p_strategy text, p_status text, p_gates jsonb DEFAULT '[]'::jsonb, p_score numeric DEFAULT NULL::numeric, p_rollout_percent integer DEFAULT NULL::integer, p_promotion_id text DEFAULT NULL::text, p_source_color text DEFAULT NULL::text, p_target_color text DEFAULT NULL::text, p_evidence_url text DEFAULT NULL::text, p_actor_id uuid DEFAULT NULL::uuid) RETURNS public.rollout_stage_evidence
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    stage rollout_stage_evidence%ROWTYPE;
BEGIN
    INSERT INTO rollout_stage_evidence (
        stage_id,
        promotion_id,
        runtime_root,
        environment,
        strategy,
        rollout_percent,
        source_color,
        target_color,
        status,
        gates,
        score,
        evidence_url,
        started_at,
        finished_at,
        created_by,
        updated_by
    )
    VALUES (
        p_stage_id,
        p_promotion_id,
        p_runtime_root,
        p_environment,
        p_strategy,
        p_rollout_percent,
        p_source_color,
        p_target_color,
        p_status,
        COALESCE(p_gates, '[]'),
        p_score,
        p_evidence_url,
        CASE WHEN p_status IN ('running', 'passed', 'failed', 'rolled-back', 'blocked') THEN NOW() ELSE NULL END,
        CASE WHEN p_status IN ('passed', 'failed', 'rolled-back', 'blocked') THEN NOW() ELSE NULL END,
        p_actor_id,
        p_actor_id
    )
    ON CONFLICT (stage_id) DO UPDATE
       SET status = EXCLUDED.status,
           gates = EXCLUDED.gates,
           score = EXCLUDED.score,
           evidence_url = EXCLUDED.evidence_url,
           finished_at = EXCLUDED.finished_at,
           updated_by = EXCLUDED.updated_by,
           updated_at = NOW()
    RETURNING * INTO stage;

    RETURN stage;
END;
$$;


--
-- Name: runtime_diagnostics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.runtime_diagnostics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    diagnostic_id text NOT NULL,
    runtime_name text NOT NULL,
    category text NOT NULL,
    severity text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    site_id uuid,
    summary text NOT NULL,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    request_id text,
    correlation_id text,
    trace_id text,
    resolved_at timestamp with time zone,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT runtime_diagnostics_category_check CHECK ((category = ANY (ARRAY['queue'::text, 'replay'::text, 'workflow'::text, 'projection'::text, 'telemetry'::text, 'resilience'::text, 'cache'::text, 'tenant'::text, 'regional'::text, 'coordination'::text, 'deployment'::text, 'provider'::text, 'audit'::text]))),
    CONSTRAINT runtime_diagnostics_severity_check CHECK ((severity = ANY (ARRAY['info'::text, 'warning'::text, 'critical'::text]))),
    CONSTRAINT runtime_diagnostics_status_check CHECK ((status = ANY (ARRAY['open'::text, 'acknowledged'::text, 'resolved'::text])))
);


--
-- Name: record_runtime_diagnostic(text, text, text, text, uuid, text, jsonb, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_runtime_diagnostic(p_diagnostic_id text, p_runtime_name text, p_category text, p_severity text, p_site_id uuid, p_summary text, p_details jsonb, p_request_id text, p_correlation_id text, p_trace_id text DEFAULT NULL::text) RETURNS public.runtime_diagnostics
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    diagnostic runtime_diagnostics%ROWTYPE;
BEGIN
    INSERT INTO runtime_diagnostics (
        diagnostic_id,
        runtime_name,
        category,
        severity,
        site_id,
        summary,
        details,
        request_id,
        correlation_id,
        trace_id
    )
    VALUES (
        p_diagnostic_id,
        p_runtime_name,
        p_category,
        p_severity,
        p_site_id,
        p_summary,
        COALESCE(p_details, '{}'),
        p_request_id,
        p_correlation_id,
        p_trace_id
    )
    ON CONFLICT (diagnostic_id) DO UPDATE
       SET status = 'open',
           summary = EXCLUDED.summary,
           details = EXCLUDED.details,
           updated_at = NOW()
    RETURNING * INTO diagnostic;

    RETURN diagnostic;
END;
$$;


--
-- Name: security_enforcement_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.security_enforcement_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    enforcement_id text NOT NULL,
    environment text NOT NULL,
    control_name text NOT NULL,
    runtime_root text NOT NULL,
    status text NOT NULL,
    severity text NOT NULL,
    evidence jsonb DEFAULT '{}'::jsonb NOT NULL,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT security_enforcement_events_environment_check CHECK ((environment = ANY (ARRAY['staging'::text, 'production'::text]))),
    CONSTRAINT security_enforcement_events_severity_check CHECK ((severity = ANY (ARRAY['critical'::text, 'high'::text, 'medium'::text, 'low'::text]))),
    CONSTRAINT security_enforcement_events_status_check CHECK ((status = ANY (ARRAY['passed'::text, 'failed'::text, 'waived'::text, 'remediated'::text])))
);


--
-- Name: record_security_enforcement_event(text, text, text, text, text, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_security_enforcement_event(p_enforcement_id text, p_environment text, p_control_name text, p_runtime_root text, p_status text, p_severity text, p_evidence jsonb DEFAULT '{}'::jsonb) RETURNS public.security_enforcement_events
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    event security_enforcement_events%ROWTYPE;
BEGIN
    INSERT INTO security_enforcement_events (
        enforcement_id, environment, control_name, runtime_root, status, severity, evidence
    )
    VALUES (
        p_enforcement_id, p_environment, p_control_name, p_runtime_root, p_status, p_severity, COALESCE(p_evidence, '{}')
    )
    ON CONFLICT (enforcement_id) DO UPDATE
       SET status = EXCLUDED.status,
           severity = EXCLUDED.severity,
           evidence = EXCLUDED.evidence,
           recorded_at = NOW(),
           updated_at = NOW()
    RETURNING * INTO event;

    RETURN event;
END;
$$;


--
-- Name: site_usage_meters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.site_usage_meters (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_id uuid NOT NULL,
    meter_name text NOT NULL,
    period_start timestamp with time zone NOT NULL,
    period_end timestamp with time zone NOT NULL,
    quantity numeric(16,4) DEFAULT 0 NOT NULL,
    limit_quantity numeric(16,4),
    status text DEFAULT 'within_limit'::text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT site_usage_meters_status_check CHECK ((status = ANY (ARRAY['within_limit'::text, 'over_limit'::text, 'blocked'::text])))
);


--
-- Name: record_site_usage(uuid, text, numeric, text, text, text, text, text, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_site_usage(p_site_id uuid, p_meter_name text, p_amount numeric, p_idempotency_key text, p_source text DEFAULT 'api'::text, p_resource_type text DEFAULT NULL::text, p_resource_id text DEFAULT NULL::text, p_request_id text DEFAULT NULL::text, p_trace_id text DEFAULT NULL::text, p_metadata jsonb DEFAULT '{}'::jsonb) RETURNS public.site_usage_meters
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_period_start TIMESTAMPTZ;
    v_period_end TIMESTAMPTZ;
    v_entitlements JSONB;
    v_limit NUMERIC;
    v_meter site_usage_meters;
BEGIN
    IF p_site_id IS NULL THEN
        RAISE EXCEPTION 'site id is required';
    END IF;

    IF p_meter_name IS NULL OR length(trim(p_meter_name)) = 0 THEN
        RAISE EXCEPTION 'meter name is required';
    END IF;

    IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) = 0 THEN
        RAISE EXCEPTION 'idempotency key is required';
    END IF;

    IF COALESCE(p_amount, 0) = 0 THEN
        RAISE EXCEPTION 'usage amount must be non-zero';
    END IF;

    v_period_start := date_trunc('month', NOW());
    v_period_end := v_period_start + INTERVAL '1 month';
    v_entitlements := resolve_site_entitlements(p_site_id);
    v_limit := get_usage_limit_from_entitlements(v_entitlements, p_meter_name);

    INSERT INTO site_usage_meters (
        site_id, meter_name, period_start, period_end, limit_quantity, metadata
    )
    VALUES (
        p_site_id, p_meter_name, v_period_start, v_period_end, v_limit,
        jsonb_build_object('entitlements_snapshot', v_entitlements)
    )
    ON CONFLICT (site_id, meter_name, period_start, period_end)
    DO UPDATE SET
        limit_quantity = EXCLUDED.limit_quantity,
        updated_at = NOW()
    RETURNING * INTO v_meter;

    INSERT INTO usage_meter_entries (
        site_id, meter_id, meter_name, idempotency_key, amount, source,
        resource_type, resource_id, request_id, trace_id, metadata
    )
    VALUES (
        p_site_id, v_meter.id, p_meter_name, p_idempotency_key, p_amount,
        COALESCE(p_source, 'api'), p_resource_type, p_resource_id,
        p_request_id, p_trace_id, COALESCE(p_metadata, '{}'::JSONB)
    )
    ON CONFLICT (meter_id, idempotency_key) DO NOTHING;

    UPDATE site_usage_meters
       SET quantity = COALESCE((
               SELECT SUM(amount)
               FROM usage_meter_entries
               WHERE meter_id = v_meter.id
                 AND deleted_at IS NULL
           ), 0),
           status = CASE
               WHEN v_limit IS NULL THEN 'within_limit'
               WHEN COALESCE((
                   SELECT SUM(amount)
                   FROM usage_meter_entries
                   WHERE meter_id = v_meter.id
                     AND deleted_at IS NULL
               ), 0) > v_limit THEN 'over_limit'
               ELSE 'within_limit'
           END,
           updated_at = NOW()
     WHERE id = v_meter.id
     RETURNING * INTO v_meter;

    RETURN v_meter;
END;
$$;


--
-- Name: sre_error_budget_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sre_error_budget_snapshots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    budget_id text NOT NULL,
    runtime_name text NOT NULL,
    slo_id text NOT NULL,
    environment text NOT NULL,
    "window" text NOT NULL,
    target_percent numeric(6,3) NOT NULL,
    observed_percent numeric(8,5) NOT NULL,
    remaining_budget_percent numeric(8,5) NOT NULL,
    burn_rate numeric(10,5) DEFAULT 0 NOT NULL,
    status text NOT NULL,
    sampled_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT sre_error_budget_snapshots_environment_check CHECK ((environment = ANY (ARRAY['staging'::text, 'production'::text]))),
    CONSTRAINT sre_error_budget_snapshots_status_check CHECK ((status = ANY (ARRAY['healthy'::text, 'watch'::text, 'freeze'::text, 'exhausted'::text])))
);


--
-- Name: record_sre_error_budget_snapshot(text, text, text, text, text, numeric, numeric, numeric, numeric, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_sre_error_budget_snapshot(p_budget_id text, p_runtime_name text, p_slo_id text, p_environment text, p_window text, p_target_percent numeric, p_observed_percent numeric, p_remaining_budget_percent numeric, p_burn_rate numeric, p_status text) RETURNS public.sre_error_budget_snapshots
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    snapshot sre_error_budget_snapshots%ROWTYPE;
BEGIN
    INSERT INTO sre_error_budget_snapshots (
        budget_id, runtime_name, slo_id, environment, "window", target_percent,
        observed_percent, remaining_budget_percent, burn_rate, status
    )
    VALUES (
        p_budget_id, p_runtime_name, p_slo_id, p_environment, p_window, p_target_percent,
        p_observed_percent, p_remaining_budget_percent, p_burn_rate, p_status
    )
    ON CONFLICT (budget_id) DO UPDATE
       SET observed_percent = EXCLUDED.observed_percent,
           remaining_budget_percent = EXCLUDED.remaining_budget_percent,
           burn_rate = EXCLUDED.burn_rate,
           status = EXCLUDED.status,
           sampled_at = NOW(),
           updated_at = NOW()
    RETURNING * INTO snapshot;

    RETURN snapshot;
END;
$$;


--
-- Name: tenant_operation_projections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_operation_projections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_id uuid NOT NULL,
    queue_depth integer DEFAULT 0 NOT NULL,
    running_executions integer DEFAULT 0 NOT NULL,
    throttled_executions integer DEFAULT 0 NOT NULL,
    dead_lettered_executions integer DEFAULT 0 NOT NULL,
    p95_latency_ms integer DEFAULT 0 NOT NULL,
    fairness_score numeric(8,4) DEFAULT 1 NOT NULL,
    projected_at timestamp with time zone DEFAULT now() NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: record_tenant_operation_projection(uuid, integer, integer, integer, integer, integer, numeric, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_tenant_operation_projection(p_site_id uuid, p_queue_depth integer, p_running_executions integer, p_throttled_executions integer, p_dead_lettered_executions integer, p_p95_latency_ms integer, p_fairness_score numeric, p_metadata jsonb DEFAULT '{}'::jsonb) RETURNS public.tenant_operation_projections
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    projection tenant_operation_projections%ROWTYPE;
BEGIN
    INSERT INTO tenant_operation_projections (
        site_id,
        queue_depth,
        running_executions,
        throttled_executions,
        dead_lettered_executions,
        p95_latency_ms,
        fairness_score,
        projected_at,
        metadata
    )
    VALUES (
        p_site_id,
        COALESCE(p_queue_depth, 0),
        COALESCE(p_running_executions, 0),
        COALESCE(p_throttled_executions, 0),
        COALESCE(p_dead_lettered_executions, 0),
        COALESCE(p_p95_latency_ms, 0),
        COALESCE(p_fairness_score, 1),
        NOW(),
        COALESCE(p_metadata, '{}')
    )
    ON CONFLICT (site_id) DO UPDATE
       SET queue_depth = EXCLUDED.queue_depth,
           running_executions = EXCLUDED.running_executions,
           throttled_executions = EXCLUDED.throttled_executions,
           dead_lettered_executions = EXCLUDED.dead_lettered_executions,
           p95_latency_ms = EXCLUDED.p95_latency_ms,
           fairness_score = EXCLUDED.fairness_score,
           projected_at = EXCLUDED.projected_at,
           metadata = EXCLUDED.metadata,
           updated_at = NOW()
    RETURNING * INTO projection;

    RETURN projection;
END;
$$;


--
-- Name: recover_stuck_distributed_queue_leases(text, text, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.recover_stuck_distributed_queue_leases(p_queue_name text, p_recovery_operation_id text, p_reason text, p_limit integer DEFAULT 100) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    recovered_count INTEGER := 0;
BEGIN
    WITH candidates AS (
        SELECT id
          FROM distributed_queue_messages
         WHERE queue_name = p_queue_name
           AND status = 'leased'
           AND leased_until <= NOW()
           AND deleted_at IS NULL
         ORDER BY leased_until ASC
         LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 1), 500)
         FOR UPDATE SKIP LOCKED
    ),
    recovered AS (
        UPDATE distributed_queue_messages AS message
           SET status = CASE WHEN attempts >= max_attempts THEN 'dead-lettered' ELSE 'retrying' END,
               available_at = NOW(),
               leased_until = NULL,
               leased_by = NULL,
               error_message = COALESCE(error_message, p_reason),
               updated_at = NOW()
          FROM candidates
         WHERE message.id = candidates.id
        RETURNING message.message_id
    )
    SELECT COUNT(*) INTO recovered_count FROM recovered;

    INSERT INTO queue_recovery_operations (
        operation_id,
        queue_name,
        operation,
        message_ids,
        reason,
        status,
        result
    )
    VALUES (
        p_recovery_operation_id,
        p_queue_name,
        'release-expired-lease',
        ARRAY[]::TEXT[],
        p_reason,
        'completed',
        jsonb_build_object('recovered_count', recovered_count)
    )
    ON CONFLICT (operation_id) DO UPDATE
       SET status = EXCLUDED.status,
           result = EXCLUDED.result,
           updated_at = NOW();

    RETURN recovered_count;
END;
$$;


--
-- Name: redrive_distributed_dead_letters(text, text[], text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.redrive_distributed_dead_letters(p_queue_name text, p_message_ids text[] DEFAULT ARRAY[]::text[], p_recovery_operation_id text DEFAULT encode(extensions.gen_random_bytes(16), 'hex'::text), p_reason text DEFAULT 'manual dead-letter redrive'::text) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    redriven_count INTEGER := 0;
BEGIN
    WITH redriven AS (
        UPDATE distributed_queue_messages
           SET status = 'retrying',
               available_at = NOW(),
               leased_until = NULL,
               leased_by = NULL,
               error_message = NULL,
               updated_at = NOW()
         WHERE queue_name = p_queue_name
           AND status = 'dead-lettered'
           AND deleted_at IS NULL
           AND (
                COALESCE(array_length(p_message_ids, 1), 0) = 0
                OR message_id = ANY(p_message_ids)
           )
        RETURNING message_id
    )
    SELECT COUNT(*) INTO redriven_count FROM redriven;

    INSERT INTO queue_recovery_operations (
        operation_id,
        queue_name,
        operation,
        message_ids,
        reason,
        status,
        result
    )
    VALUES (
        p_recovery_operation_id,
        p_queue_name,
        'redrive',
        COALESCE(p_message_ids, ARRAY[]::TEXT[]),
        p_reason,
        'completed',
        jsonb_build_object('redriven_count', redriven_count)
    )
    ON CONFLICT (operation_id) DO UPDATE
       SET status = EXCLUDED.status,
           result = EXCLUDED.result,
           updated_at = NOW();

    RETURN redriven_count;
END;
$$;


--
-- Name: release_order_inventory(uuid, uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.release_order_inventory(p_order_id uuid, p_actor_id uuid DEFAULT NULL::uuid, p_request_id text DEFAULT NULL::text, p_release_reason text DEFAULT 'order_cancelled'::text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_order RECORD;
    v_item RECORD;
    v_level_id UUID;
BEGIN
    SELECT id, store_id
      INTO v_order
      FROM orders
     WHERE id = p_order_id
       AND deleted_at IS NULL
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'order not found';
    END IF;

    IF EXISTS (
        SELECT 1 FROM inventory_reservations
        WHERE order_id = p_order_id
          AND status = 'released'
          AND deleted_at IS NULL
    ) THEN
        RETURN TRUE;
    END IF;

    FOR v_item IN
        SELECT product_id, variant_id, quantity
          FROM order_items
         WHERE order_id = p_order_id
           AND deleted_at IS NULL
    LOOP
        SELECT il.id
          INTO v_level_id
          FROM inventory_levels il
          JOIN inventory_locations loc ON loc.id = il.location_id
         WHERE il.product_id = v_item.product_id
           AND (
                (v_item.variant_id IS NULL AND il.variant_id IS NULL)
                OR il.variant_id = v_item.variant_id
           )
           AND loc.store_id = v_order.store_id
           AND loc.status = 'active'
           AND loc.deleted_at IS NULL
         ORDER BY loc.is_default DESC, il.updated_at ASC
         LIMIT 1
         FOR UPDATE OF il;

        IF FOUND THEN
            UPDATE inventory_levels
               SET available = available + v_item.quantity,
                   updated_at = NOW()
             WHERE id = v_level_id;

            INSERT INTO inventory_adjustments (
                product_id,
                variant_id,
                location_id,
                quantity_change,
                reason,
                reference_id,
                note,
                created_by
            )
            SELECT
                v_item.product_id,
                v_item.variant_id,
                location_id,
                v_item.quantity,
                'return',
                p_order_id,
                p_release_reason,
                p_actor_id
            FROM inventory_levels
            WHERE id = v_level_id;
        END IF;
    END LOOP;

    UPDATE inventory_reservations
       SET status = 'released',
           released_at = NOW(),
           release_reason = p_release_reason,
           updated_at = NOW()
     WHERE order_id = p_order_id
       AND deleted_at IS NULL;

    UPDATE orders
       SET inventory_released_at = NOW(),
           updated_at = NOW()
     WHERE id = p_order_id;

    INSERT INTO outbox_events (
        store_id,
        aggregate_type,
        aggregate_id,
        event_type,
        payload,
        idempotency_key,
        request_id,
        actor_id
    )
    VALUES (
        v_order.store_id,
        'order',
        p_order_id::TEXT,
        'inventory.released',
        jsonb_build_object('store_id', v_order.store_id, 'order_id', p_order_id),
        'inventory.released:' || p_order_id::TEXT,
        p_request_id,
        p_actor_id
    )
    ON CONFLICT (idempotency_key) DO NOTHING;

    RETURN TRUE;
END;
$$;


--
-- Name: release_order_inventory_with_ledger(uuid, uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.release_order_inventory_with_ledger(p_order_id uuid, p_actor_id uuid DEFAULT NULL::uuid, p_request_id text DEFAULT NULL::text, p_release_reason text DEFAULT 'order_cancelled'::text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_released BOOLEAN;
    v_site_id UUID;
BEGIN
    SELECT store_id
      INTO v_site_id
      FROM orders
     WHERE id = p_order_id
       AND deleted_at IS NULL;

    IF v_site_id IS NULL THEN
        RAISE EXCEPTION 'order not found';
    END IF;

    v_released := release_order_inventory(
        p_order_id,
        p_actor_id,
        p_request_id,
        p_release_reason
    );

    INSERT INTO inventory_events (
        site_id,
        inventory_level_id,
        location_id,
        product_id,
        variant_id,
        order_id,
        reservation_id,
        event_type,
        quantity_delta,
        on_hand_quantity,
        available_quantity,
        committed_quantity,
        unavailable_quantity,
        incoming_quantity,
        reserved_quantity,
        safety_stock_quantity,
        source_type,
        source_id,
        idempotency_key,
        request_id,
        metadata,
        created_by
    )
    SELECT
        v_site_id,
        il.id,
        r.location_id,
        oi.product_id,
        oi.variant_id,
        p_order_id,
        r.id,
        'sale_released',
        oi.quantity,
        COALESCE(il.on_hand_quantity, il.available + il.reserved),
        COALESCE(il.available_quantity, il.available),
        0,
        COALESCE(il.unavailable_quantity, 0),
        COALESCE(il.incoming_quantity, il.incoming),
        COALESCE(il.reserved_quantity, il.reserved),
        COALESCE(il.safety_stock_quantity, 0),
        'order',
        p_order_id,
        'inventory.sale_released:' || p_order_id::TEXT || ':' || oi.id::TEXT,
        p_request_id,
        jsonb_build_object('release_reason', p_release_reason),
        p_actor_id
      FROM order_items oi
      LEFT JOIN inventory_reservations r
        ON r.order_id = oi.order_id
       AND r.product_id = oi.product_id
       AND (
           (r.variant_id IS NULL AND oi.variant_id IS NULL)
           OR r.variant_id = oi.variant_id
       )
      LEFT JOIN inventory_levels il
        ON il.location_id = r.location_id
       AND il.product_id = oi.product_id
       AND (
           (il.variant_id IS NULL AND oi.variant_id IS NULL)
           OR il.variant_id = oi.variant_id
       )
     WHERE oi.order_id = p_order_id
       AND oi.deleted_at IS NULL
    ON CONFLICT (site_id, idempotency_key) DO NOTHING;

    RETURN v_released;
END;
$$;


--
-- Name: replay_outbox_dead_letter(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.replay_outbox_dead_letter(p_dead_letter_id uuid, p_request_id text DEFAULT NULL::text) RETURNS public.outbox_events
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_dead outbox_dead_letters;
    v_event outbox_events;
BEGIN
    SELECT *
      INTO v_dead
      FROM outbox_dead_letters
     WHERE id = p_dead_letter_id
       AND deleted_at IS NULL
     FOR UPDATE;

    IF v_dead.id IS NULL THEN
        RAISE EXCEPTION 'dead letter % not found', p_dead_letter_id;
    END IF;

    UPDATE outbox_events
       SET status = 'queued',
           attempts = 0,
           locked_at = NULL,
           locked_by = NULL,
           available_at = NOW(),
           next_attempt_at = NOW(),
           error_message = NULL,
           dead_lettered_at = NULL,
           dead_letter_reason = NULL,
           request_id = COALESCE(p_request_id, request_id),
           updated_at = NOW()
     WHERE id = v_dead.outbox_event_id
     RETURNING * INTO v_event;

    UPDATE outbox_dead_letters
       SET replayed_at = NOW(),
           updated_at = NOW()
     WHERE id = v_dead.id;

    RETURN v_event;
END;
$$;


--
-- Name: resolve_site_entitlements(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.resolve_site_entitlements(p_site_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_site sites;
    v_site_type TEXT;
    v_plan_slug TEXT;
    v_plan plan_entitlements;
    v_override RECORD;
    v_features TEXT[];
    v_limits JSONB;
    v_entitlements JSONB;
BEGIN
    SELECT *
      INTO v_site
      FROM sites
     WHERE id = p_site_id
       AND deleted_at IS NULL;

    IF v_site.id IS NULL THEN
        RAISE EXCEPTION 'site % not found', p_site_id;
    END IF;

    v_site_type := CASE
        WHEN v_site.site_type IN ('ecommerce', 'store') THEN 'store'
        WHEN v_site.site_type = 'landing_page' THEN 'landing'
        ELSE COALESCE(v_site.site_type, 'store')
    END;

    SELECT COALESCE(subscriptions.plan, plans.slug, 'free')
      INTO v_plan_slug
      FROM subscriptions
      LEFT JOIN plans ON plans.id = subscriptions.plan_id
     WHERE subscriptions.store_id = p_site_id
       AND subscriptions.status IN ('active', 'trialing')
     ORDER BY subscriptions.created_at DESC
     LIMIT 1;

    v_plan_slug := COALESCE(v_plan_slug, 'free');

    SELECT *
      INTO v_plan
      FROM plan_entitlements
     WHERE site_type = v_site_type
       AND plan_slug = v_plan_slug
       AND is_active = TRUE
       AND deleted_at IS NULL
     LIMIT 1;

    IF v_plan.id IS NULL AND v_site_type <> 'store' THEN
        SELECT *
          INTO v_plan
          FROM plan_entitlements
         WHERE site_type = 'store'
           AND plan_slug = v_plan_slug
           AND is_active = TRUE
           AND deleted_at IS NULL
         LIMIT 1;
    END IF;

    v_features := COALESCE(v_plan.features, ARRAY[]::TEXT[]);
    v_limits := COALESCE(v_plan.limits, '{}'::JSONB);
    v_entitlements := COALESCE(v_plan.entitlements, '{}'::JSONB);

    FOR v_override IN
        SELECT *
          FROM site_entitlement_overrides
         WHERE site_id = p_site_id
           AND deleted_at IS NULL
           AND starts_at <= NOW()
           AND (ends_at IS NULL OR ends_at > NOW())
         ORDER BY created_at ASC
    LOOP
        v_features := ARRAY(
            SELECT DISTINCT feature
            FROM unnest(v_features || COALESCE(v_override.features_add, ARRAY[]::TEXT[])) AS feature
            WHERE feature <> ALL(COALESCE(v_override.features_remove, ARRAY[]::TEXT[]))
        );
        v_limits := v_limits || COALESCE(v_override.limits, '{}'::JSONB);
        v_entitlements := v_entitlements || COALESCE(v_override.entitlements, '{}'::JSONB);
    END LOOP;

    RETURN jsonb_build_object(
        'site_id', p_site_id,
        'site_type', v_site_type,
        'plan', v_plan_slug,
        'features', COALESCE(to_jsonb(v_features), '[]'::JSONB),
        'limits', v_limits,
        'entitlements', v_entitlements
    );
END;
$$;


--
-- Name: retry_distributed_queue_message(text, text, text, timestamp with time zone, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.retry_distributed_queue_message(p_message_id text, p_worker_id text, p_fencing_token text, p_available_at timestamp with time zone, p_error_message text, p_result jsonb DEFAULT '{}'::jsonb) RETURNS public.distributed_queue_messages
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    updated_message distributed_queue_messages%ROWTYPE;
BEGIN
    UPDATE distributed_queue_messages
       SET status = 'retrying',
           available_at = COALESCE(p_available_at, NOW()),
           leased_until = NULL,
           error_message = p_error_message,
           result = COALESCE(p_result, '{}'),
           updated_at = NOW()
     WHERE message_id = p_message_id
       AND leased_by = p_worker_id
       AND fencing_token = p_fencing_token
       AND status = 'leased'
       AND deleted_at IS NULL
    RETURNING * INTO updated_message;

    IF updated_message.id IS NULL THEN
        RAISE EXCEPTION 'queue retry rejected for message %', p_message_id;
    END IF;

    RETURN updated_message;
END;
$$;


--
-- Name: schedule_runtime_replay_operation(text, text, uuid, text[], jsonb, integer, boolean, uuid, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.schedule_runtime_replay_operation(p_replay_id text, p_owner_runtime text, p_site_id uuid, p_event_types text[], p_cursor jsonb, p_batch_size integer, p_dry_run boolean, p_requested_by uuid, p_reason text, p_request_id text, p_correlation_id text, p_trace_id text DEFAULT NULL::text) RETURNS public.runtime_replay_executions
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    replay runtime_replay_executions%ROWTYPE;
BEGIN
    INSERT INTO runtime_replay_executions (
        replay_id,
        owner_runtime,
        site_id,
        event_types,
        cursor,
        status,
        dry_run,
        requested_by,
        reason
    )
    VALUES (
        p_replay_id,
        p_owner_runtime,
        p_site_id,
        COALESCE(p_event_types, ARRAY[]::TEXT[]),
        COALESCE(p_cursor, '{}'),
        'planned',
        COALESCE(p_dry_run, TRUE),
        p_requested_by,
        p_reason
    )
    ON CONFLICT (replay_id) DO UPDATE
       SET cursor = EXCLUDED.cursor,
           event_types = EXCLUDED.event_types,
           dry_run = EXCLUDED.dry_run,
           reason = EXCLUDED.reason,
           updated_at = NOW()
    RETURNING * INTO replay;

    INSERT INTO replay_operation_schedules (
        replay_id,
        owner_runtime,
        site_id,
        event_types,
        cursor,
        batch_size,
        dry_run,
        requested_by,
        status,
        request_id,
        correlation_id,
        trace_id
    )
    VALUES (
        p_replay_id,
        p_owner_runtime,
        p_site_id,
        COALESCE(p_event_types, ARRAY[]::TEXT[]),
        COALESCE(p_cursor, '{}'),
        LEAST(GREATEST(COALESCE(p_batch_size, 100), 1), 1000),
        COALESCE(p_dry_run, TRUE),
        p_requested_by,
        'planned',
        p_request_id,
        p_correlation_id,
        p_trace_id
    )
    ON CONFLICT (replay_id) DO UPDATE
       SET cursor = EXCLUDED.cursor,
           batch_size = EXCLUDED.batch_size,
           dry_run = EXCLUDED.dry_run,
           request_id = EXCLUDED.request_id,
           correlation_id = EXCLUDED.correlation_id,
           trace_id = EXCLUDED.trace_id,
           updated_at = NOW();

    RETURN replay;
END;
$$;


--
-- Name: set_inventory_level_available(uuid, uuid, uuid, integer, uuid, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_inventory_level_available(p_product_id uuid, p_variant_id uuid DEFAULT NULL::uuid, p_location_id uuid DEFAULT NULL::uuid, p_available integer DEFAULT 0, p_actor_id uuid DEFAULT NULL::uuid, p_reason text DEFAULT 'adjustment'::text, p_notes text DEFAULT NULL::text, p_request_id text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_product RECORD;
    v_location_id UUID;
    v_level RECORD;
    v_previous_available INTEGER := 0;
    v_delta INTEGER := 0;
    v_level_json JSONB;
BEGIN
    IF p_available < 0 THEN
        RAISE EXCEPTION 'available inventory cannot be negative';
    END IF;

    SELECT id, store_id
      INTO v_product
      FROM products
     WHERE id = p_product_id
       AND deleted_at IS NULL;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'product not found';
    END IF;

    IF p_variant_id IS NOT NULL
       AND NOT EXISTS (
           SELECT 1 FROM product_variants
            WHERE id = p_variant_id
              AND product_id = p_product_id
       ) THEN
        RAISE EXCEPTION 'variant not found for product';
    END IF;

    IF p_location_id IS NULL THEN
        v_location_id := ensure_default_inventory_location(v_product.store_id);
    ELSE
        SELECT id
          INTO v_location_id
          FROM inventory_locations
         WHERE id = p_location_id
           AND store_id = v_product.store_id
           AND deleted_at IS NULL;

        IF v_location_id IS NULL THEN
            RAISE EXCEPTION 'inventory location not found for product store';
        END IF;
    END IF;

    SELECT *
      INTO v_level
      FROM inventory_levels
     WHERE product_id = p_product_id
       AND location_id = v_location_id
       AND (
            (p_variant_id IS NULL AND variant_id IS NULL)
            OR variant_id = p_variant_id
       )
     LIMIT 1
     FOR UPDATE;

    IF NOT FOUND THEN
        INSERT INTO inventory_levels (
            product_id,
            variant_id,
            location_id,
            available,
            reserved,
            incoming,
            updated_at
        )
        VALUES (
            p_product_id,
            p_variant_id,
            v_location_id,
            p_available,
            0,
            0,
            NOW()
        )
        RETURNING * INTO v_level;
        v_delta := p_available;
    ELSE
        v_previous_available := COALESCE(v_level.available, 0);
        v_delta := p_available - v_previous_available;

        IF p_available < COALESCE(v_level.reserved, 0) THEN
            RAISE EXCEPTION 'available inventory cannot be below reserved quantity';
        END IF;

        UPDATE inventory_levels
           SET available = p_available,
               updated_at = NOW()
         WHERE id = v_level.id
         RETURNING * INTO v_level;
    END IF;

    IF v_delta <> 0 THEN
        INSERT INTO inventory_adjustments (
            product_id,
            variant_id,
            location_id,
            quantity_change,
            reason,
            note,
            created_by
        )
        VALUES (
            p_product_id,
            p_variant_id,
            v_location_id,
            v_delta,
            CASE
                WHEN p_reason IN ('sale', 'return', 'adjustment', 'recount', 'transfer', 'damaged', 'reserved', 'unreserved')
                THEN p_reason
                ELSE 'adjustment'
            END,
            p_notes,
            p_actor_id
        );
    END IF;

    IF p_variant_id IS NULL THEN
        UPDATE products
           SET stock = p_available,
               updated_at = NOW()
         WHERE id = p_product_id;
    ELSE
        UPDATE product_variants
           SET inventory_qty = p_available,
               updated_at = NOW()
         WHERE id = p_variant_id;
    END IF;

    INSERT INTO outbox_events (
        store_id,
        aggregate_type,
        aggregate_id,
        event_type,
        payload,
        idempotency_key,
        request_id,
        actor_id
    )
    VALUES (
        v_product.store_id,
        'inventory',
        p_product_id::TEXT,
        'inventory.level.set',
        jsonb_build_object(
            'store_id', v_product.store_id,
            'product_id', p_product_id,
            'variant_id', p_variant_id,
            'location_id', v_location_id,
            'available', p_available,
            'delta', v_delta
        ),
        'inventory.level.set:' || p_product_id::TEXT || ':' || COALESCE(p_variant_id::TEXT, 'default') || ':' || v_location_id::TEXT || ':' || COALESCE(p_request_id, gen_random_uuid()::TEXT),
        p_request_id,
        p_actor_id
    )
    ON CONFLICT (idempotency_key) DO NOTHING;

    SELECT to_jsonb(v_level) INTO v_level_json;
    RETURN v_level_json;
END;
$$;


--
-- Name: ship_inventory_transfer(uuid, uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ship_inventory_transfer(p_transfer_id uuid, p_actor_id uuid DEFAULT NULL::uuid, p_request_id text DEFAULT NULL::text, p_idempotency_key text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_transfer RECORD;
BEGIN
    SELECT * INTO v_transfer
    FROM inventory_transfers
    WHERE id = p_transfer_id AND deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'transfer not found';
    END IF;

    IF v_transfer.status NOT IN ('reserved', 'shipped') THEN
        RAISE EXCEPTION 'transfer cannot be shipped from status %', v_transfer.status;
    END IF;

    UPDATE inventory_transfer_lines
       SET quantity_shipped = quantity_requested,
           status = 'shipped',
           updated_at = NOW(),
           updated_by = p_actor_id
     WHERE transfer_id = p_transfer_id
       AND deleted_at IS NULL;

    UPDATE inventory_transfers
       SET status = 'shipped',
           shipped_at = COALESCE(shipped_at, NOW()),
           updated_at = NOW(),
           updated_by = p_actor_id
     WHERE id = p_transfer_id;

    RETURN jsonb_build_object('transfer', (SELECT to_jsonb(t) FROM inventory_transfers t WHERE t.id = p_transfer_id));
END;
$$;


--
-- Name: stores_delete_fn(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.stores_delete_fn() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    DELETE FROM sites WHERE id = OLD.id;
    RETURN OLD;
END;
$$;


--
-- Name: stores_insert_fn(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.stores_insert_fn() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    inserted_row sites%ROWTYPE;
BEGIN
    INSERT INTO sites (
        user_id, custom_user_id, name, store_name, tagline, logo_url, favicon_url,
        site_type, subdomain, custom_domain, theme_id, theme_settings,
        template_config, sections, status, description, brand_color,
        currency, locale, industry
    ) VALUES (
        NEW.user_id,
        NEW.custom_user_id,
        COALESCE(NEW.name, NEW.display_name, NEW.store_name),
        COALESCE(NEW.store_name, NEW.subdomain),
        NEW.tagline,
        NEW.logo_url,
        NEW.favicon_url,
        COALESCE(NEW.site_type, 'store'),
        COALESCE(NEW.subdomain, NEW.store_name),
        NEW.custom_domain,
        COALESCE(NEW.theme_id, 'modern'),
        COALESCE(NEW.theme_settings, '{}'),
        COALESCE(NEW.template_config, '{}'),
        COALESCE(NEW.sections, '[]'),
        COALESCE(NEW.status, 'draft'),
        NEW.description,
        COALESCE(NEW.brand_color, '#6366f1'),
        COALESCE(NEW.currency, 'INR'),
        COALESCE(NEW.locale, 'en-IN'),
        NEW.industry
    )
    RETURNING * INTO inserted_row;

    -- Map sites columns back to the view's NEW record
    NEW.id := inserted_row.id;
    NEW.subdomain := inserted_row.subdomain;
    NEW.status := inserted_row.status;
    NEW.trial_started_at := inserted_row.trial_started_at;
    NEW.trial_ends_at := inserted_row.trial_ends_at;
    NEW.trial_status := inserted_row.trial_status;
    NEW.created_at := inserted_row.created_at;
    NEW.updated_at := inserted_row.updated_at;

    RETURN NEW;
END;
$$;


--
-- Name: stores_update_fn(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.stores_update_fn() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    UPDATE sites SET
        name = COALESCE(NEW.name, NEW.display_name, OLD.name),
        store_name = COALESCE(NEW.store_name, OLD.store_name),
        tagline = COALESCE(NEW.tagline, OLD.tagline),
        logo_url = COALESCE(NEW.logo_url, OLD.logo_url),
        favicon_url = COALESCE(NEW.favicon_url, OLD.favicon_url),
        site_type = COALESCE(NEW.site_type, OLD.site_type),
        subdomain = COALESCE(NEW.subdomain, OLD.subdomain),
        custom_domain = NEW.custom_domain,
        theme_id = COALESCE(NEW.theme_id, OLD.theme_id),
        theme_settings = COALESCE(NEW.theme_settings, OLD.theme_settings),
        status = COALESCE(NEW.status, OLD.status),
        description = COALESCE(NEW.description, OLD.description),
        brand_color = COALESCE(NEW.brand_color, OLD.brand_color),
        industry = COALESCE(NEW.industry, OLD.industry),
        trial_status = COALESCE(NEW.trial_status, OLD.trial_status),
        frozen_at = NEW.frozen_at,
        updated_at = NOW()
    WHERE id = OLD.id;
    RETURN NEW;
END;
$$;


--
-- Name: sync_product_review_moderation_status(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_product_review_moderation_status() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.status IS NULL THEN
        NEW.status := CASE WHEN COALESCE(NEW.is_approved, FALSE) THEN 'approved' ELSE 'pending' END;
    ELSIF TG_OP = 'INSERT' AND COALESCE(NEW.is_approved, FALSE) AND NEW.status = 'pending' THEN
        NEW.status := 'approved';
    END IF;

    NEW.is_approved := NEW.status = 'approved';
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;


--
-- Name: update_app_install_count(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_app_install_count() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  UPDATE marketplace_apps SET
    install_count = (SELECT COUNT(*) FROM app_installations WHERE app_id = COALESCE(NEW.app_id, OLD.app_id) AND status = 'active')
  WHERE id = COALESCE(NEW.app_id, OLD.app_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;


--
-- Name: update_app_rating(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_app_rating() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  UPDATE marketplace_apps SET
    rating_avg = (SELECT COALESCE(AVG(rating), 0) FROM app_reviews WHERE app_id = COALESCE(NEW.app_id, OLD.app_id) AND status = 'published'),
    review_count = (SELECT COUNT(*) FROM app_reviews WHERE app_id = COALESCE(NEW.app_id, OLD.app_id) AND status = 'published')
  WHERE id = COALESCE(NEW.app_id, OLD.app_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;


--
-- Name: update_production_incident_status(text, text, uuid, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_production_incident_status(p_incident_id text, p_status text, p_actor_id uuid, p_summary text, p_details jsonb DEFAULT '{}'::jsonb) RETURNS public.production_incidents
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    incident production_incidents%ROWTYPE;
BEGIN
    UPDATE production_incidents
       SET status = p_status,
           mitigated_at = CASE WHEN p_status = 'mitigating' AND mitigated_at IS NULL THEN NOW() ELSE mitigated_at END,
           resolved_at = CASE WHEN p_status IN ('resolved', 'closed') AND resolved_at IS NULL THEN NOW() ELSE resolved_at END,
           updated_at = NOW()
     WHERE incident_id = p_incident_id
       AND deleted_at IS NULL
    RETURNING * INTO incident;

    IF incident.id IS NULL THEN
        RAISE EXCEPTION 'production incident not found: %', p_incident_id;
    END IF;

    INSERT INTO production_incident_events (
        incident_id,
        event_type,
        actor_id,
        summary,
        details
    )
    VALUES (
        p_incident_id,
        'status-change',
        p_actor_id,
        p_summary,
        COALESCE(p_details, '{}')
    );

    RETURN incident;
END;
$$;


--
-- Name: update_store_customers_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_store_customers_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


--
-- Name: update_theme_install_count(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_theme_install_count() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  UPDATE themes SET
    install_count = (
      SELECT COUNT(*) FROM store_themes WHERE theme_id = COALESCE(NEW.theme_id, OLD.theme_id) AND is_active = true
    ),
    updated_at = NOW()
  WHERE id = COALESCE(NEW.theme_id, OLD.theme_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;


--
-- Name: update_theme_rating(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_theme_rating() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  UPDATE themes SET
    rating_avg = (SELECT COALESCE(AVG(rating), 0) FROM theme_reviews WHERE theme_id = COALESCE(NEW.theme_id, OLD.theme_id) AND status = 'published'),
    review_count = (SELECT COUNT(*) FROM theme_reviews WHERE theme_id = COALESCE(NEW.theme_id, OLD.theme_id) AND status = 'published'),
    updated_at = NOW()
  WHERE id = COALESCE(NEW.theme_id, OLD.theme_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;


--
-- Name: update_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: event_store_integrity_checks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.event_store_integrity_checks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    check_id text NOT NULL,
    stream_name text,
    environment text NOT NULL,
    status text NOT NULL,
    checked_events integer DEFAULT 0 NOT NULL,
    min_stream_position bigint,
    max_stream_position bigint,
    gap_count integer DEFAULT 0 NOT NULL,
    duplicate_count integer DEFAULT 0 NOT NULL,
    retention_class text,
    result jsonb DEFAULT '{}'::jsonb NOT NULL,
    checked_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT event_store_integrity_checks_environment_check CHECK ((environment = ANY (ARRAY['staging'::text, 'production'::text]))),
    CONSTRAINT event_store_integrity_checks_status_check CHECK ((status = ANY (ARRAY['passed'::text, 'failed'::text, 'warning'::text])))
);


--
-- Name: validate_event_stream_consistency(text, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_event_stream_consistency(p_stream_name text, p_environment text DEFAULT 'production'::text, p_limit integer DEFAULT 10000) RETURNS public.event_store_integrity_checks
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    checked_count INTEGER;
    min_position BIGINT;
    max_position BIGINT;
    gap_count INTEGER;
    duplicate_count INTEGER;
    check_status TEXT;
    check_row event_store_integrity_checks%ROWTYPE;
BEGIN
    SELECT COUNT(*)::INTEGER, MIN(stream_position), MAX(stream_position)
      INTO checked_count, min_position, max_position
      FROM (
          SELECT stream_position
            FROM distributed_event_store
           WHERE stream_name = p_stream_name
             AND deleted_at IS NULL
           ORDER BY stream_position DESC
           LIMIT p_limit
      ) recent;

    SELECT COUNT(*)::INTEGER
      INTO duplicate_count
      FROM (
          SELECT stream_position
            FROM distributed_event_store
           WHERE stream_name = p_stream_name
             AND deleted_at IS NULL
           GROUP BY stream_position
          HAVING COUNT(*) > 1
      ) duplicates;

    gap_count := CASE
        WHEN checked_count = 0 OR min_position IS NULL OR max_position IS NULL THEN 0
        ELSE GREATEST((max_position - min_position + 1 - checked_count)::INTEGER, 0)
    END;

    check_status := CASE WHEN gap_count = 0 AND duplicate_count = 0 THEN 'passed' ELSE 'failed' END;

    INSERT INTO event_store_integrity_checks (
        check_id,
        stream_name,
        environment,
        status,
        checked_events,
        min_stream_position,
        max_stream_position,
        gap_count,
        duplicate_count,
        result
    )
    VALUES (
        'event-store-' || p_stream_name || '-' || extract(epoch from now())::BIGINT,
        p_stream_name,
        p_environment,
        check_status,
        checked_count,
        min_position,
        max_position,
        gap_count,
        duplicate_count,
        jsonb_build_object('limit', p_limit)
    )
    RETURNING * INTO check_row;

    RETURN check_row;
END;
$$;


--
-- Name: validate_subdomain(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_subdomain(subdomain_input text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
DECLARE
    reserved_words TEXT[] := ARRAY[
        'accounts', 'admin', 'console', 'team', 'api', 'webhooks',
        'www', 'mail', 'ftp', 'localhost', 'letbuyy',
        'seller', 'buyer', 'customer', 'support', 'help', 'contact',
        'about', 'terms', 'privacy', 'policy', 'faq', 'blog', 'press',
        'careers', 'investors', 'partners', 'affiliates', 'legal',
        'store', 'stores', 'shop', 'app', 'dashboard', 'billing',
        'auth', 'login', 'signup', 'register', 'onboarding',
        'static', 'assets', 'cdn', 'media', 'images', 'files',
        'null', 'undefined', 'test', 'demo', 'example', 'staging'
    ];
    existing_count INTEGER;
BEGIN
    -- Check minimum length
    IF LENGTH(subdomain_input) < 4 THEN
        RETURN jsonb_build_object(
            'valid', false,
            'reason', 'too_short',
            'message', 'Subdomain must be at least 4 characters'
        );
    END IF;

    -- Check maximum length
    IF LENGTH(subdomain_input) > 63 THEN
        RETURN jsonb_build_object(
            'valid', false,
            'reason', 'too_long',
            'message', 'Subdomain must be at most 63 characters'
        );
    END IF;

    -- Check format (a-z, 0-9, hyphen, must start/end with alphanumeric)
    IF subdomain_input !~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$'
       AND subdomain_input !~ '^[a-z0-9]{4,}$' THEN
        RETURN jsonb_build_object(
            'valid', false,
            'reason', 'invalid_format',
            'message', 'Only lowercase letters, numbers, and hyphens allowed. Must start and end with a letter or number.'
        );
    END IF;

    -- Check double hyphens
    IF subdomain_input LIKE '%--%' THEN
        RETURN jsonb_build_object(
            'valid', false,
            'reason', 'double_hyphen',
            'message', 'Subdomain cannot contain consecutive hyphens'
        );
    END IF;

    -- Check reserved words
    IF subdomain_input = ANY(reserved_words) THEN
        RETURN jsonb_build_object(
            'valid', false,
            'reason', 'reserved',
            'message', 'This subdomain is reserved and cannot be used'
        );
    END IF;

    -- Check uniqueness
    SELECT COUNT(*) INTO existing_count
    FROM sites
    WHERE subdomain = subdomain_input OR store_name = subdomain_input;

    IF existing_count > 0 THEN
        RETURN jsonb_build_object(
            'valid', false,
            'reason', 'taken',
            'message', 'This subdomain is already in use'
        );
    END IF;

    -- All checks passed
    RETURN jsonb_build_object(
        'valid', true,
        'reason', 'available',
        'message', 'Subdomain is available'
    );
END;
$_$;


--
-- Name: ai_credits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_credits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    balance integer DEFAULT 0,
    plan_credits integer DEFAULT 100,
    bonus_credits integer DEFAULT 0,
    total_used integer DEFAULT 0,
    total_purchased integer DEFAULT 0,
    last_reset_at timestamp with time zone DEFAULT now(),
    reset_period text DEFAULT 'monthly'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT ai_credits_reset_period_check CHECK ((reset_period = ANY (ARRAY['daily'::text, 'weekly'::text, 'monthly'::text])))
);


--
-- Name: ai_usage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_usage (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    user_id uuid,
    feature text NOT NULL,
    prompt text,
    output text,
    tokens_input integer DEFAULT 0,
    tokens_output integer DEFAULT 0,
    credits_used integer DEFAULT 1,
    model text DEFAULT 'gpt-4o-mini'::text,
    provider text DEFAULT 'openai'::text,
    latency_ms integer,
    status text DEFAULT 'completed'::text,
    error_message text,
    user_rating integer,
    user_feedback text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT ai_usage_feature_check CHECK ((feature = ANY (ARRAY['product_description'::text, 'seo_meta'::text, 'blog_post'::text, 'social_copy'::text, 'image_generation'::text, 'translation'::text, 'chat'::text, 'content_rewrite'::text, 'email_campaign'::text, 'ad_copy'::text, 'custom'::text]))),
    CONSTRAINT ai_usage_status_check CHECK ((status = ANY (ARRAY['completed'::text, 'failed'::text, 'cancelled'::text]))),
    CONSTRAINT ai_usage_user_rating_check CHECK (((user_rating IS NULL) OR ((user_rating >= 1) AND (user_rating <= 5))))
);


--
-- Name: analytics_event_stream; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.analytics_event_stream (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_id uuid,
    event_id uuid NOT NULL,
    event_type text NOT NULL,
    aggregate_type text,
    aggregate_id text,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    request_id text,
    trace_id text,
    idempotency_key text NOT NULL,
    schema_version integer DEFAULT 1 NOT NULL,
    properties jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: analytics_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.analytics_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    event_type text NOT NULL,
    visitor_id text,
    session_id text,
    page_path text,
    referrer text,
    utm_source text,
    utm_medium text,
    utm_campaign text,
    device_type text,
    country text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT analytics_events_event_type_check CHECK ((event_type = ANY (ARRAY['page_view'::text, 'product_view'::text, 'add_to_cart'::text, 'begin_checkout'::text, 'purchase'::text, 'contact_submit'::text, 'resume_download'::text, 'project_view'::text])))
);


--
-- Name: app_billing_charges; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_billing_charges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_id uuid NOT NULL,
    app_id uuid NOT NULL,
    partner_id uuid NOT NULL,
    installation_id uuid NOT NULL,
    billing_mode text NOT NULL,
    status text DEFAULT 'pending_merchant_approval'::text NOT NULL,
    name text NOT NULL,
    amount_minor integer NOT NULL,
    currency text DEFAULT 'INR'::text NOT NULL,
    revenue_share_bps integer DEFAULT 8000 NOT NULL,
    partner_amount_minor integer NOT NULL,
    platform_fee_minor integer NOT NULL,
    partner_gst_bps integer DEFAULT 1800 NOT NULL,
    partner_gst_minor integer DEFAULT 0 NOT NULL,
    payout_rail text DEFAULT 'razorpay_route'::text NOT NULL,
    provider text DEFAULT 'razorpay_route'::text NOT NULL,
    provider_mode text DEFAULT 'test'::text NOT NULL,
    provider_reference text,
    approval_url text,
    approved_by uuid,
    approved_at timestamp with time zone,
    activated_at timestamp with time zone,
    idempotency_key text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT app_billing_charges_amount_minor_check CHECK ((amount_minor > 0)),
    CONSTRAINT app_billing_charges_billing_mode_check CHECK ((billing_mode = ANY (ARRAY['recurring'::text, 'usage'::text]))),
    CONSTRAINT app_billing_charges_currency_check CHECK ((currency = 'INR'::text)),
    CONSTRAINT app_billing_charges_partner_amount_minor_check CHECK ((partner_amount_minor >= 0)),
    CONSTRAINT app_billing_charges_partner_gst_bps_check CHECK (((partner_gst_bps >= 0) AND (partner_gst_bps <= 10000))),
    CONSTRAINT app_billing_charges_partner_gst_minor_check CHECK ((partner_gst_minor >= 0)),
    CONSTRAINT app_billing_charges_payout_rail_check CHECK ((payout_rail = ANY (ARRAY['razorpay_route'::text, 'razorpayx'::text, 'upi'::text, 'manual'::text]))),
    CONSTRAINT app_billing_charges_platform_fee_minor_check CHECK ((platform_fee_minor >= 0)),
    CONSTRAINT app_billing_charges_provider_check CHECK ((provider = ANY (ARRAY['razorpay_route'::text, 'razorpayx'::text, 'upi'::text, 'manual'::text]))),
    CONSTRAINT app_billing_charges_provider_mode_check CHECK ((provider_mode = ANY (ARRAY['test'::text, 'live'::text]))),
    CONSTRAINT app_billing_charges_revenue_share_bps_check CHECK (((revenue_share_bps >= 0) AND (revenue_share_bps <= 10000))),
    CONSTRAINT app_billing_charges_status_check CHECK ((status = ANY (ARRAY['pending_merchant_approval'::text, 'approved'::text, 'active'::text, 'cancelled'::text, 'failed'::text])))
);


--
-- Name: app_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    description text,
    icon text,
    sort_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: app_developers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_developers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    company_name text NOT NULL,
    slug text NOT NULL,
    website_url text,
    support_email text,
    logo_url text,
    description text,
    verified boolean DEFAULT false,
    status text DEFAULT 'pending'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    country text DEFAULT 'IN'::text,
    CONSTRAINT app_developers_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'suspended'::text, 'rejected'::text])))
);


--
-- Name: app_extensions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_extensions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    app_id uuid NOT NULL,
    type text NOT NULL,
    target text NOT NULL,
    label text,
    config jsonb DEFAULT '{}'::jsonb,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT app_extensions_type_check CHECK ((type = ANY (ARRAY['storefront_block'::text, 'admin_link'::text, 'checkout_extension'::text, 'product_action'::text, 'order_action'::text, 'settings_page'::text, 'dashboard_widget'::text, 'api_endpoint'::text])))
);


--
-- Name: app_installations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_installations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    app_id uuid NOT NULL,
    store_id uuid NOT NULL,
    installed_by uuid NOT NULL,
    status text DEFAULT 'active'::text,
    scopes_granted text[] DEFAULT '{}'::text[],
    config jsonb DEFAULT '{}'::jsonb,
    installed_at timestamp with time zone DEFAULT now(),
    uninstalled_at timestamp with time zone,
    CONSTRAINT app_installations_status_check CHECK ((status = ANY (ARRAY['active'::text, 'paused'::text, 'uninstalled'::text])))
);


--
-- Name: app_reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    app_id uuid NOT NULL,
    user_id uuid NOT NULL,
    store_id uuid,
    rating integer NOT NULL,
    title text,
    body text,
    helpful_count integer DEFAULT 0,
    is_verified boolean DEFAULT false,
    status text DEFAULT 'published'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    user_name text,
    CONSTRAINT app_reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5))),
    CONSTRAINT app_reviews_status_check CHECK ((status = ANY (ARRAY['published'::text, 'pending'::text, 'rejected'::text, 'flagged'::text])))
);


--
-- Name: app_webhooks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_webhooks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    app_id uuid NOT NULL,
    event text NOT NULL,
    url text NOT NULL,
    secret text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: audit_activity_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_activity_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid,
    actor_id uuid,
    actor_type text DEFAULT 'user'::text NOT NULL,
    action text NOT NULL,
    resource_type text NOT NULL,
    resource_id text,
    request_id text,
    before_state jsonb,
    after_state jsonb,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    ip_address text,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT audit_activity_events_actor_type_check CHECK ((actor_type = ANY (ARRAY['user'::text, 'customer'::text, 'employee'::text, 'system'::text, 'webhook'::text])))
);


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    actor_id uuid,
    actor_type text NOT NULL,
    actor_email text,
    action text NOT NULL,
    resource_type text NOT NULL,
    resource_id uuid,
    old_values jsonb,
    new_values jsonb,
    metadata jsonb DEFAULT '{}'::jsonb,
    ip_address text,
    user_agent text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT audit_logs_actor_type_check CHECK ((actor_type = ANY (ARRAY['user'::text, 'employee'::text, 'super_admin'::text, 'system'::text])))
);


--
-- Name: billing_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.billing_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    store_id uuid,
    subscription_id uuid,
    invoice_number text NOT NULL,
    description text NOT NULL,
    amount integer NOT NULL,
    currency text DEFAULT 'INR'::text,
    tax_amount integer DEFAULT 0,
    total_amount integer NOT NULL,
    payment_gateway text,
    payment_id text,
    payment_status text DEFAULT 'pending'::text,
    period_start timestamp with time zone,
    period_end timestamp with time zone,
    invoice_url text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT billing_history_payment_status_check CHECK ((payment_status = ANY (ARRAY['pending'::text, 'paid'::text, 'failed'::text, 'refunded'::text])))
);


--
-- Name: blog_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.blog_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    description text,
    image_url text,
    parent_id uuid,
    display_order integer DEFAULT 0,
    is_visible boolean DEFAULT true,
    post_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone,
    created_by uuid
);


--
-- Name: blog_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.blog_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    post_id uuid NOT NULL,
    store_id uuid NOT NULL,
    parent_id uuid,
    author_name text NOT NULL,
    author_email text,
    author_url text,
    user_id uuid,
    body text NOT NULL,
    status text DEFAULT 'pending'::text,
    moderated_at timestamp with time zone,
    like_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone,
    CONSTRAINT blog_comments_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'spam'::text, 'rejected'::text])))
);


--
-- Name: blog_post_tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.blog_post_tags (
    post_id uuid NOT NULL,
    tag_id uuid NOT NULL
);


--
-- Name: blog_posts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.blog_posts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    author_id uuid,
    title text NOT NULL,
    slug text NOT NULL,
    excerpt text,
    content text,
    content_html text,
    featured_image text,
    category_id uuid,
    status text DEFAULT 'draft'::text,
    published_at timestamp with time zone,
    scheduled_at timestamp with time zone,
    seo_title text,
    seo_description text,
    og_image_url text,
    canonical_url text,
    no_index boolean DEFAULT false,
    view_count integer DEFAULT 0,
    comment_count integer DEFAULT 0,
    like_count integer DEFAULT 0,
    reading_time_min integer,
    allow_comments boolean DEFAULT true,
    is_featured boolean DEFAULT false,
    is_pinned boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone,
    created_by uuid,
    updated_by uuid,
    version integer DEFAULT 1 NOT NULL,
    CONSTRAINT blog_posts_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text, 'scheduled'::text])))
);


--
-- Name: blog_tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.blog_tags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    post_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: cache_invalidation_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cache_invalidation_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cache_name text NOT NULL,
    site_id uuid,
    source_event_id uuid,
    keys text[] DEFAULT ARRAY[]::text[] NOT NULL,
    tags text[] DEFAULT ARRAY[]::text[] NOT NULL,
    replay_aware boolean DEFAULT true NOT NULL,
    reason text NOT NULL,
    processed_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: cache_operation_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cache_operation_snapshots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cache_name text NOT NULL,
    cache_key text NOT NULL,
    tenant_key text NOT NULL,
    state text NOT NULL,
    tags text[] DEFAULT ARRAY[]::text[] NOT NULL,
    size_bytes bigint,
    sampled_at timestamp with time zone DEFAULT now() NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT cache_operation_snapshots_state_check CHECK ((state = ANY (ARRAY['fresh'::text, 'stale'::text, 'expired'::text])))
);


--
-- Name: carts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.carts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    customer_id uuid,
    session_id text,
    items jsonb DEFAULT '[]'::jsonb NOT NULL,
    coupon_code text,
    notes text,
    status text DEFAULT 'active'::text,
    abandoned_at timestamp with time zone,
    recovery_email_sent boolean DEFAULT false,
    recovery_email_sent_at timestamp with time zone,
    expires_at timestamp with time zone DEFAULT (now() + '30 days'::interval),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone,
    CONSTRAINT carts_status_check CHECK ((status = ANY (ARRAY['active'::text, 'abandoned'::text, 'converted'::text, 'recovered'::text])))
);


--
-- Name: certifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.certifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid,
    name text NOT NULL,
    issuer text NOT NULL,
    issue_date date,
    expiry_date date,
    no_expiry boolean DEFAULT false,
    credential_id text,
    credential_url text,
    badge_url text,
    display_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone,
    created_by uuid
);


--
-- Name: checkout_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.checkout_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_id uuid NOT NULL,
    order_id uuid,
    customer_email text,
    status text DEFAULT 'completed'::text NOT NULL,
    idempotency_key text NOT NULL,
    subtotal numeric(12,2) DEFAULT 0 NOT NULL,
    shipping_total numeric(12,2) DEFAULT 0 NOT NULL,
    tax_total numeric(12,2) DEFAULT 0 NOT NULL,
    discount_total numeric(12,2) DEFAULT 0 NOT NULL,
    gift_card_total numeric(12,2) DEFAULT 0 NOT NULL,
    grand_total numeric(12,2) DEFAULT 0 NOT NULL,
    currency text DEFAULT 'INR'::text NOT NULL,
    shipping_method text,
    payment_method text,
    request_id text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT checkout_sessions_status_check CHECK ((status = ANY (ARRAY['processing'::text, 'completed'::text, 'failed'::text, 'cancelled'::text, 'expired'::text])))
);


--
-- Name: collection_products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.collection_products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    collection_id uuid NOT NULL,
    product_id uuid NOT NULL,
    "position" integer DEFAULT 0
);


--
-- Name: collections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.collections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    image_url text,
    is_active boolean DEFAULT true,
    sort_order text DEFAULT 'manual'::text,
    conditions jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone,
    created_by uuid,
    updated_by uuid
);


--
-- Name: contact_submissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contact_submissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid,
    name text NOT NULL,
    email text NOT NULL,
    subject text,
    message text NOT NULL,
    is_read boolean DEFAULT false,
    replied_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    is_archived boolean DEFAULT false,
    site_id uuid,
    deleted_at timestamp with time zone
);


--
-- Name: contacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contacts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid,
    name text NOT NULL,
    email text NOT NULL,
    subject text,
    message text NOT NULL,
    is_read boolean DEFAULT false,
    replied_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    is_archived boolean DEFAULT false,
    site_id uuid,
    deleted_at timestamp with time zone
);


--
-- Name: coordination_operation_diagnostics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coordination_operation_diagnostics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    resource_type text NOT NULL,
    resource_id text NOT NULL,
    owner_id text,
    status text NOT NULL,
    fencing_token text,
    reason text NOT NULL,
    diagnosed_at timestamp with time zone DEFAULT now() NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT coordination_operation_diagnostics_status_check CHECK ((status = ANY (ARRAY['owned'::text, 'expired'::text, 'contended'::text, 'unowned'::text])))
);


--
-- Name: coupons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coupons (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid,
    code text NOT NULL,
    description text,
    discount_type text,
    discount_value numeric(10,2),
    min_order_amount numeric(10,2),
    max_discount numeric(10,2),
    usage_limit integer,
    usage_count integer DEFAULT 0,
    per_user_limit integer DEFAULT 1,
    starts_at timestamp with time zone,
    expires_at timestamp with time zone,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    site_id uuid,
    deleted_at timestamp with time zone,
    created_by uuid,
    updated_by uuid,
    version integer DEFAULT 1 NOT NULL,
    type text,
    value numeric(12,2),
    minimum_order_amount numeric(12,2),
    maximum_discount numeric(12,2),
    per_customer_limit integer DEFAULT 1,
    applicable_products uuid[] DEFAULT '{}'::uuid[],
    applicable_categories text[] DEFAULT '{}'::text[],
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT coupons_discount_type_check CHECK ((discount_type = ANY (ARRAY['percentage'::text, 'fixed'::text, 'free_shipping'::text, 'bogo'::text]))),
    CONSTRAINT coupons_type_check CHECK ((type = ANY (ARRAY['percentage'::text, 'fixed'::text, 'free_shipping'::text, 'bogo'::text])))
);


--
-- Name: customer_activity_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_activity_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid NOT NULL,
    store_id uuid NOT NULL,
    activity_type text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: customer_addresses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_addresses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    customer_email text NOT NULL,
    customer_phone text,
    label text DEFAULT 'home'::text,
    full_name text NOT NULL,
    address_line1 text NOT NULL,
    address_line2 text,
    city text NOT NULL,
    state text NOT NULL,
    postal_code text NOT NULL,
    country text DEFAULT 'IN'::text,
    landmark text,
    is_default boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    gstin text,
    state_code text,
    CONSTRAINT customer_addresses_gstin_format_check CHECK (((gstin IS NULL) OR (gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'::text))),
    CONSTRAINT customer_addresses_label_check CHECK ((label = ANY (ARRAY['home'::text, 'work'::text, 'other'::text]))),
    CONSTRAINT customer_addresses_state_code_check CHECK (((state_code IS NULL) OR (state_code ~ '^(0[1-9]|[12][0-9]|3[0-8]|97)$'::text)))
);


--
-- Name: customer_credentials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_credentials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    email_or_phone text NOT NULL,
    password_hash text NOT NULL,
    last_login_at timestamp with time zone,
    login_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: customer_wishlists; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_wishlists (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid NOT NULL,
    store_id uuid NOT NULL,
    product_id text NOT NULL,
    variant_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: database_operation_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.database_operation_snapshots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    snapshot_id text NOT NULL,
    environment text NOT NULL,
    primary_region text NOT NULL,
    replica_region text,
    connection_pool_state text NOT NULL,
    replication_lag_ms integer DEFAULT 0 NOT NULL,
    pitr_status text NOT NULL,
    slow_query_count integer DEFAULT 0 NOT NULL,
    migration_status text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    sampled_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT database_operation_snapshots_connection_pool_state_check CHECK ((connection_pool_state = ANY (ARRAY['healthy'::text, 'degraded'::text, 'unavailable'::text]))),
    CONSTRAINT database_operation_snapshots_environment_check CHECK ((environment = ANY (ARRAY['dev'::text, 'staging'::text, 'production'::text]))),
    CONSTRAINT database_operation_snapshots_migration_status_check CHECK ((migration_status = ANY (ARRAY['idle'::text, 'running'::text, 'blocked'::text, 'failed'::text]))),
    CONSTRAINT database_operation_snapshots_pitr_status_check CHECK ((pitr_status = ANY (ARRAY['enabled'::text, 'disabled'::text, 'unknown'::text])))
);


--
-- Name: device_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.device_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    token text NOT NULL,
    platform text,
    device_name text,
    last_used_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT device_tokens_platform_check CHECK ((platform = ANY (ARRAY['android'::text, 'ios'::text, 'web'::text, 'macos'::text, 'windows'::text])))
);


--
-- Name: devices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.devices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    fingerprint text NOT NULL,
    name text,
    trusted boolean DEFAULT false,
    last_used timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: distributed_event_store; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.distributed_event_store (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    stream_name text NOT NULL,
    stream_position bigint NOT NULL,
    global_position bigint NOT NULL,
    partition_key text NOT NULL,
    site_id uuid,
    aggregate_type text,
    aggregate_id text,
    event_type text NOT NULL,
    schema_version integer DEFAULT 1 NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    source_runtime text NOT NULL,
    producer text NOT NULL,
    correlation_id text NOT NULL,
    causation_id text,
    request_id text,
    trace_id text,
    idempotency_key text NOT NULL,
    replayable boolean DEFAULT true NOT NULL,
    retention_class text DEFAULT 'hot'::text NOT NULL,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    persisted_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT distributed_event_store_retention_class_check CHECK ((retention_class = ANY (ARRAY['hot'::text, 'warm'::text, 'archive'::text, 'legal-hold'::text])))
);


--
-- Name: distributed_event_store_global_position_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.distributed_event_store_global_position_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: distributed_event_store_global_position_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.distributed_event_store_global_position_seq OWNED BY public.distributed_event_store.global_position;


--
-- Name: distributed_event_streams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.distributed_event_streams (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    stream_name text NOT NULL,
    site_id uuid,
    partition_key text NOT NULL,
    last_stream_position bigint DEFAULT 0 NOT NULL,
    last_global_position bigint DEFAULT 0 NOT NULL,
    stream_version integer DEFAULT 1 NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: distributed_queue_heartbeats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.distributed_queue_heartbeats (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    message_id text NOT NULL,
    queue_name text NOT NULL,
    worker_id text NOT NULL,
    fencing_token text NOT NULL,
    heartbeat_at timestamp with time zone DEFAULT now() NOT NULL,
    leased_until timestamp with time zone NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: education; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.education (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid,
    institution text NOT NULL,
    degree text NOT NULL,
    field_of_study text,
    start_date date NOT NULL,
    end_date date,
    is_current boolean DEFAULT false,
    gpa numeric(3,2),
    honors text[] DEFAULT '{}'::text[],
    display_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone,
    created_by uuid,
    grade text,
    description text
);


--
-- Name: email_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    recipient_email text NOT NULL,
    email_type text NOT NULL,
    subject text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    provider_message_id text,
    error_message text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT email_logs_email_type_check CHECK ((email_type = ANY (ARRAY['verification'::text, 'magic_link'::text, 'password_reset'::text, 'store_created_success'::text, 'store_created_failure'::text, 'welcome'::text, 'order_confirmation'::text, 'order_shipped'::text, 'low_stock_alert'::text, 'subscription_renewal'::text]))),
    CONSTRAINT email_logs_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'sent'::text, 'failed'::text, 'bounced'::text])))
);


--
-- Name: employee_invites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_invites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    role text NOT NULL,
    token text NOT NULL,
    invited_by uuid,
    expires_at timestamp with time zone NOT NULL,
    accepted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT employee_invites_role_check CHECK ((role = ANY (ARRAY['support'::text, 'sales'::text, 'marketing'::text, 'operations'::text, 'manager'::text, 'admin'::text])))
);


--
-- Name: employee_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    role text NOT NULL,
    permission text NOT NULL,
    description text
);


--
-- Name: employee_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    display_name text NOT NULL,
    permissions jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: employees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employees (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    email text NOT NULL,
    full_name text,
    phone text,
    avatar_url text,
    role text NOT NULL,
    permissions jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT true,
    last_login_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    role_id uuid,
    department text,
    login_count integer DEFAULT 0,
    store_id uuid,
    status text DEFAULT 'invited'::text,
    deleted_at timestamp with time zone,
    CONSTRAINT employees_role_check CHECK ((role = ANY (ARRAY['support'::text, 'sales'::text, 'marketing'::text, 'operations'::text, 'manager'::text, 'admin'::text, 'editor'::text, 'viewer'::text, 'fulfillment'::text, 'staff'::text]))),
    CONSTRAINT employees_status_check CHECK ((status = ANY (ARRAY['invited'::text, 'active'::text, 'disabled'::text, 'removed'::text])))
);


--
-- Name: event_stream_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.event_stream_snapshots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    stream_name text NOT NULL,
    site_id uuid,
    snapshot_version integer DEFAULT 1 NOT NULL,
    stream_position bigint NOT NULL,
    global_position bigint,
    state jsonb DEFAULT '{}'::jsonb NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: execution_audit_trail; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.execution_audit_trail (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    audit_id text NOT NULL,
    site_id uuid,
    action text NOT NULL,
    resource_type text NOT NULL,
    resource_id text,
    actor_id uuid,
    request_id text NOT NULL,
    correlation_id text NOT NULL,
    trace_id text,
    before_state jsonb,
    after_state jsonb,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: form_submissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.form_submissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    form_type text DEFAULT 'contact'::text NOT NULL,
    form_name text,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    source_url text,
    ip_address text,
    user_agent text,
    status text DEFAULT 'new'::text,
    read_at timestamp with time zone,
    replied_at timestamp with time zone,
    internal_notes text,
    assigned_to uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone,
    full_name text,
    email text,
    phone text,
    subject text,
    message text,
    source text,
    CONSTRAINT form_submissions_form_type_check CHECK ((form_type = ANY (ARRAY['contact'::text, 'newsletter'::text, 'custom'::text, 'lead'::text, 'inquiry'::text]))),
    CONSTRAINT form_submissions_status_check CHECK ((status = ANY (ARRAY['new'::text, 'read'::text, 'replied'::text, 'contacted'::text, 'converted'::text, 'archived'::text, 'spam'::text])))
);


--
-- Name: fulfillment_order_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fulfillment_order_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_id uuid NOT NULL,
    fulfillment_order_id uuid NOT NULL,
    order_id uuid NOT NULL,
    order_item_id uuid NOT NULL,
    product_id uuid,
    variant_id uuid,
    quantity integer NOT NULL,
    fulfilled_quantity integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT fulfillment_order_lines_fulfilled_quantity_check CHECK ((fulfilled_quantity >= 0)),
    CONSTRAINT fulfillment_order_lines_quantity_check CHECK ((quantity > 0)),
    CONSTRAINT fulfillment_order_lines_status_check CHECK ((status = ANY (ARRAY['open'::text, 'picked'::text, 'packed'::text, 'shipped'::text, 'fulfilled'::text, 'cancelled'::text])))
);


--
-- Name: fulfillment_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fulfillment_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_id uuid NOT NULL,
    order_id uuid NOT NULL,
    location_id uuid,
    status text DEFAULT 'open'::text NOT NULL,
    idempotency_key text NOT NULL,
    request_id text,
    assigned_at timestamp with time zone,
    picked_at timestamp with time zone,
    packed_at timestamp with time zone,
    shipped_at timestamp with time zone,
    delivered_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT fulfillment_orders_status_check CHECK ((status = ANY (ARRAY['open'::text, 'in_progress'::text, 'partially_fulfilled'::text, 'fulfilled'::text, 'cancelled'::text])))
);


--
-- Name: gallery_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gallery_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    project_id uuid,
    title text,
    description text,
    type text DEFAULT 'image'::text NOT NULL,
    url text NOT NULL,
    thumbnail_url text,
    blurhash text,
    width integer,
    height integer,
    file_size integer,
    mime_type text,
    alt_text text,
    category text DEFAULT 'General'::text,
    tags text[] DEFAULT '{}'::text[],
    display_order integer DEFAULT 0,
    is_visible boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone,
    created_by uuid,
    CONSTRAINT gallery_items_type_check CHECK ((type = ANY (ARRAY['image'::text, 'video'::text, 'embed'::text])))
);


--
-- Name: gift_card_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gift_card_accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_id uuid NOT NULL,
    code_hash text NOT NULL,
    code_last4 text NOT NULL,
    initial_value numeric(12,2) NOT NULL,
    balance numeric(12,2) NOT NULL,
    currency text DEFAULT 'INR'::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    expires_at timestamp with time zone,
    customer_id uuid,
    fraud_hold_reason text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT gift_card_accounts_balance_check CHECK ((balance >= (0)::numeric)),
    CONSTRAINT gift_card_accounts_initial_value_check CHECK ((initial_value >= (0)::numeric)),
    CONSTRAINT gift_card_accounts_status_check CHECK ((status = ANY (ARRAY['active'::text, 'held'::text, 'disabled'::text, 'expired'::text])))
);


--
-- Name: gift_card_ledger_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gift_card_ledger_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_id uuid NOT NULL,
    gift_card_account_id uuid NOT NULL,
    order_id uuid,
    entry_type text NOT NULL,
    amount numeric(12,2) NOT NULL,
    balance_after numeric(12,2) NOT NULL,
    idempotency_key text NOT NULL,
    request_id text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT gift_card_ledger_entries_amount_check CHECK ((amount >= (0)::numeric)),
    CONSTRAINT gift_card_ledger_entries_balance_after_check CHECK ((balance_after >= (0)::numeric)),
    CONSTRAINT gift_card_ledger_entries_entry_type_check CHECK ((entry_type = ANY (ARRAY['issued'::text, 'debit'::text, 'credit'::text, 'refund_credit'::text, 'hold'::text, 'release'::text, 'expire'::text, 'fraud_hold'::text])))
);


--
-- Name: gift_card_redemptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gift_card_redemptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_id uuid NOT NULL,
    gift_card_account_id uuid NOT NULL,
    order_id uuid NOT NULL,
    amount numeric(12,2) NOT NULL,
    status text DEFAULT 'committed'::text NOT NULL,
    idempotency_key text NOT NULL,
    request_id text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT gift_card_redemptions_amount_check CHECK ((amount >= (0)::numeric)),
    CONSTRAINT gift_card_redemptions_status_check CHECK ((status = ANY (ARRAY['reserved'::text, 'committed'::text, 'released'::text, 'voided'::text])))
);


--
-- Name: gift_cards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gift_cards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    code text NOT NULL,
    initial_value numeric(10,2) NOT NULL,
    balance numeric(10,2) NOT NULL,
    status text DEFAULT 'active'::text,
    customer_id uuid,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone,
    created_by uuid,
    updated_by uuid
);


--
-- Name: idempotency_keys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.idempotency_keys (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_id uuid NOT NULL,
    key text NOT NULL,
    scope text NOT NULL,
    request_hash text NOT NULL,
    response_hash text,
    response_body jsonb,
    status text DEFAULT 'processing'::text NOT NULL,
    status_code integer,
    resource_type text,
    resource_id uuid,
    request_id text,
    locked_until timestamp with time zone,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT idempotency_keys_status_check CHECK ((status = ANY (ARRAY['processing'::text, 'completed'::text, 'failed'::text])))
);


--
-- Name: inventory_adjustments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_adjustments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    variant_id uuid,
    location_id uuid NOT NULL,
    quantity_change integer NOT NULL,
    reason text NOT NULL,
    reference_id uuid,
    note text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT inventory_adjustments_reason_check CHECK ((reason = ANY (ARRAY['sale'::text, 'return'::text, 'adjustment'::text, 'recount'::text, 'transfer'::text, 'damaged'::text, 'reserved'::text, 'unreserved'::text])))
);


--
-- Name: inventory_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_id uuid NOT NULL,
    inventory_level_id uuid,
    location_id uuid,
    product_id uuid NOT NULL,
    variant_id uuid,
    order_id uuid,
    reservation_id uuid,
    event_type text NOT NULL,
    quantity_delta integer NOT NULL,
    on_hand_quantity integer DEFAULT 0 NOT NULL,
    available_quantity integer DEFAULT 0 NOT NULL,
    committed_quantity integer DEFAULT 0 NOT NULL,
    unavailable_quantity integer DEFAULT 0 NOT NULL,
    incoming_quantity integer DEFAULT 0 NOT NULL,
    reserved_quantity integer DEFAULT 0 NOT NULL,
    safety_stock_quantity integer DEFAULT 0 NOT NULL,
    source_type text NOT NULL,
    source_id uuid,
    idempotency_key text NOT NULL,
    request_id text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT inventory_events_event_type_check CHECK ((event_type = ANY (ARRAY['sale_committed'::text, 'sale_released'::text, 'po_ordered'::text, 'po_received'::text, 'transfer_reserved'::text, 'transfer_shipped'::text, 'transfer_received'::text, 'return_restocked'::text, 'manual_adjusted'::text, 'damaged'::text, 'reconciliation_corrected'::text])))
);


--
-- Name: inventory_level_duplicate_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_level_duplicate_snapshots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    inventory_level_id uuid,
    product_id uuid NOT NULL,
    variant_id uuid,
    location_id uuid NOT NULL,
    snapshot jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: inventory_levels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_levels (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    variant_id uuid,
    location_id uuid NOT NULL,
    available integer DEFAULT 0 NOT NULL,
    reserved integer DEFAULT 0 NOT NULL,
    incoming integer DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now(),
    on_hand_quantity integer,
    available_quantity integer,
    committed_quantity integer DEFAULT 0 NOT NULL,
    unavailable_quantity integer DEFAULT 0 NOT NULL,
    incoming_quantity integer,
    reserved_quantity integer,
    safety_stock_quantity integer DEFAULT 0 NOT NULL
);


--
-- Name: inventory_locations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_locations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    name text NOT NULL,
    address jsonb,
    is_default boolean DEFAULT false,
    status text DEFAULT 'active'::text,
    created_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone,
    created_by uuid,
    updated_by uuid,
    CONSTRAINT inventory_locations_status_check CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text])))
);


--
-- Name: inventory_reservations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_reservations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    product_id uuid NOT NULL,
    variant_id uuid,
    location_id uuid NOT NULL,
    order_id uuid,
    quantity integer NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    idempotency_key text,
    expires_at timestamp with time zone DEFAULT (now() + '00:20:00'::interval) NOT NULL,
    committed_at timestamp with time zone,
    released_at timestamp with time zone,
    release_reason text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT inventory_reservations_quantity_check CHECK ((quantity > 0)),
    CONSTRAINT inventory_reservations_status_check CHECK ((status = ANY (ARRAY['active'::text, 'hold'::text, 'committed'::text, 'released'::text, 'expired'::text, 'fulfilled'::text, 'cancelled'::text])))
);


--
-- Name: inventory_transfer_receipts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_transfer_receipts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_id uuid NOT NULL,
    transfer_id uuid NOT NULL,
    transfer_line_id uuid,
    product_id uuid NOT NULL,
    variant_id uuid,
    source_location_id uuid,
    destination_location_id uuid,
    quantity_received integer NOT NULL,
    idempotency_key text NOT NULL,
    request_id text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT inventory_transfer_receipts_quantity_received_check CHECK ((quantity_received > 0))
);


--
-- Name: lead_forms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lead_forms (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid,
    name text NOT NULL,
    fields jsonb NOT NULL,
    success_message text DEFAULT 'Thank you for your submission!'::text,
    redirect_url text,
    is_active boolean DEFAULT true,
    submission_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    site_id uuid,
    deleted_at timestamp with time zone,
    created_by uuid,
    updated_by uuid,
    version integer DEFAULT 1 NOT NULL
);


--
-- Name: leads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid,
    form_id uuid,
    email text NOT NULL,
    name text,
    phone text,
    company text,
    custom_fields jsonb DEFAULT '{}'::jsonb,
    utm_params jsonb DEFAULT '{}'::jsonb,
    source_url text,
    ip_address text,
    user_agent text,
    status text DEFAULT 'new'::text,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    site_id uuid,
    deleted_at timestamp with time zone,
    CONSTRAINT leads_status_check CHECK ((status = ANY (ARRAY['new'::text, 'contacted'::text, 'qualified'::text, 'converted'::text, 'lost'::text])))
);


--
-- Name: marketplace_apps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.marketplace_apps (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    developer_id uuid NOT NULL,
    slug text NOT NULL,
    name text NOT NULL,
    tagline text,
    description text,
    type text DEFAULT 'public'::text,
    status text DEFAULT 'draft'::text,
    icon_url text,
    banner_url text,
    screenshots text[] DEFAULT '{}'::text[],
    pricing_model text DEFAULT 'free'::text,
    price_usd numeric(10,2) DEFAULT 0,
    price_inr numeric(10,2) DEFAULT 0,
    category_id uuid,
    tags text[] DEFAULT '{}'::text[],
    install_count integer DEFAULT 0,
    rating_avg numeric(3,2) DEFAULT 0,
    review_count integer DEFAULT 0,
    supported_site_types text[] DEFAULT '{store,portfolio,resume,landing_page,blog}'::text[],
    oauth_client_id text,
    oauth_redirect_uris text[] DEFAULT '{}'::text[],
    api_scopes text[] DEFAULT '{}'::text[],
    webhook_url text,
    version text DEFAULT '1.0.0'::text,
    min_platform_version text,
    documentation_url text,
    privacy_policy_url text,
    terms_url text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    app_url text,
    CONSTRAINT marketplace_apps_pricing_model_check CHECK ((pricing_model = ANY (ARRAY['free'::text, 'freemium'::text, 'one_time'::text, 'recurring'::text]))),
    CONSTRAINT marketplace_apps_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'in_review'::text, 'published'::text, 'suspended'::text, 'rejected'::text]))),
    CONSTRAINT marketplace_apps_type_check CHECK ((type = ANY (ARRAY['public'::text, 'private'::text, 'internal'::text])))
);


--
-- Name: marketplace_review_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.marketplace_review_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    submission_type text NOT NULL,
    resource_id uuid NOT NULL,
    resource_slug text,
    resource_name text NOT NULL,
    partner_user_id uuid NOT NULL,
    app_developer_id uuid,
    status text DEFAULT 'pending'::text NOT NULL,
    automated_checks jsonb DEFAULT '{}'::jsonb NOT NULL,
    submitted_at timestamp with time zone DEFAULT now() NOT NULL,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    review_notes text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT marketplace_review_records_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'in_review'::text, 'approved'::text, 'rejected'::text, 'changes_requested'::text]))),
    CONSTRAINT marketplace_review_records_submission_type_check CHECK ((submission_type = ANY (ARRAY['app'::text, 'theme'::text])))
);


--
-- Name: media; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.media (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    uploaded_by uuid,
    filename text NOT NULL,
    original_name text,
    url text NOT NULL,
    thumbnail_url text,
    mime_type text NOT NULL,
    size_bytes bigint DEFAULT 0,
    width integer,
    height integer,
    alt_text text,
    caption text,
    folder text DEFAULT '/'::text,
    media_type text DEFAULT 'image'::text,
    tags text[] DEFAULT '{}'::text[],
    usage_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone,
    created_by uuid,
    CONSTRAINT media_media_type_check CHECK ((media_type = ANY (ARRAY['image'::text, 'video'::text, 'document'::text, 'audio'::text, 'other'::text])))
);


--
-- Name: media_assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.media_assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    asset_type text NOT NULL,
    storage_provider text DEFAULT 'r2'::text NOT NULL,
    storage_path text NOT NULL,
    public_url text,
    filename text NOT NULL,
    content_type text,
    size_bytes bigint,
    width integer,
    height integer,
    alt_text text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT media_assets_asset_type_check CHECK ((asset_type = ANY (ARRAY['image'::text, 'video'::text, 'file'::text, 'font'::text, 'icon'::text])))
);


--
-- Name: navigation_menu_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.navigation_menu_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    menu_id uuid NOT NULL,
    store_id uuid NOT NULL,
    parent_item_id uuid,
    label text NOT NULL,
    url text,
    target_type text DEFAULT 'url'::text NOT NULL,
    target_resource_id text,
    sort_order integer DEFAULT 0 NOT NULL,
    is_visible boolean DEFAULT true NOT NULL,
    open_in_new_tab boolean DEFAULT false NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: navigation_menus; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.navigation_menus (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    handle text NOT NULL,
    name text NOT NULL,
    location text DEFAULT 'main'::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT navigation_menus_status_check CHECK ((status = ANY (ARRAY['active'::text, 'draft'::text, 'archived'::text])))
);


--
-- Name: notification_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_preferences (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    email_new_order boolean DEFAULT true,
    email_low_stock boolean DEFAULT true,
    email_new_contact boolean DEFAULT true,
    email_resume_download boolean DEFAULT true,
    push_new_order boolean DEFAULT true,
    push_low_stock boolean DEFAULT true,
    push_new_contact boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    store_id uuid,
    channel text DEFAULT 'email'::text,
    category text DEFAULT 'system'::text,
    enabled boolean DEFAULT true
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    type text NOT NULL,
    title text NOT NULL,
    message text,
    data jsonb DEFAULT '{}'::jsonb,
    is_read boolean DEFAULT false,
    action_url text,
    created_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone,
    CONSTRAINT notifications_type_check CHECK ((type = ANY (ARRAY['app_installed'::text, 'app_uninstalled'::text, 'app_review'::text, 'theme_purchased'::text, 'theme_review'::text, 'order_placed'::text, 'order_shipped'::text, 'order_delivered'::text, 'new_lead'::text, 'new_contact'::text, 'plan_upgraded'::text, 'store_published'::text, 'system'::text])))
);


--
-- Name: onboarding_attempts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.onboarding_attempts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    requested_name text NOT NULL,
    requested_subdomain text NOT NULL,
    site_type text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    failure_reason text,
    error_details text,
    ip_address text,
    user_agent text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT onboarding_attempts_site_type_check CHECK ((site_type = ANY (ARRAY['store'::text, 'portfolio'::text, 'resume'::text, 'landing'::text, 'blog'::text]))),
    CONSTRAINT onboarding_attempts_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'success'::text, 'failed'::text])))
);


--
-- Name: operation_metrics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.operation_metrics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    metric_name text NOT NULL,
    dimensions jsonb DEFAULT '{}'::jsonb NOT NULL,
    metric_value numeric(16,4) DEFAULT 0 NOT NULL,
    unit text DEFAULT 'count'::text NOT NULL,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    site_id uuid,
    request_id text,
    trace_id text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: operational_feature_flag_audit_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.operational_feature_flag_audit_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id text NOT NULL,
    flag_key text NOT NULL,
    environment text NOT NULL,
    actor_id uuid,
    action text NOT NULL,
    before_state jsonb DEFAULT '{}'::jsonb NOT NULL,
    after_state jsonb DEFAULT '{}'::jsonb NOT NULL,
    reason text NOT NULL,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT operational_feature_flag_audit_events_action_check CHECK ((action = ANY (ARRAY['created'::text, 'updated'::text, 'approved'::text, 'enabled'::text, 'disabled'::text, 'kill-switch'::text, 'rolled-back'::text, 'expired'::text]))),
    CONSTRAINT operational_feature_flag_audit_events_environment_check CHECK ((environment = ANY (ARRAY['local'::text, 'development'::text, 'staging'::text, 'production'::text])))
);


--
-- Name: operational_feature_flags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.operational_feature_flags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    flag_key text NOT NULL,
    environment text NOT NULL,
    owner_runtime text NOT NULL,
    site_id uuid,
    enabled boolean DEFAULT false NOT NULL,
    kill_switch boolean DEFAULT false NOT NULL,
    default_variant text,
    rules jsonb DEFAULT '[]'::jsonb NOT NULL,
    rollout_policy jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    expires_at timestamp with time zone,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT operational_feature_flags_environment_check CHECK ((environment = ANY (ARRAY['local'::text, 'development'::text, 'staging'::text, 'production'::text]))),
    CONSTRAINT operational_feature_flags_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'approved'::text, 'active'::text, 'disabled'::text, 'expired'::text])))
);


--
-- Name: order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    product_id uuid,
    variant_id text,
    name text NOT NULL,
    sku text,
    quantity integer NOT NULL,
    price numeric(10,2) NOT NULL,
    total numeric(10,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    title text,
    variant_title text,
    unit_price numeric(10,2),
    discount_amount numeric(10,2) DEFAULT 0,
    tax_amount numeric(10,2) DEFAULT 0,
    product_snapshot jsonb DEFAULT '{}'::jsonb NOT NULL,
    fulfillment_status text DEFAULT 'unfulfilled'::text,
    fulfilled_quantity integer DEFAULT 0,
    deleted_at timestamp with time zone,
    returned_quantity integer DEFAULT 0 NOT NULL,
    refunded_quantity integer DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    hsn_code text,
    gst_rate numeric(5,2) DEFAULT 0,
    taxable_amount numeric(10,2) DEFAULT 0,
    cgst_amount numeric(10,2) DEFAULT 0,
    sgst_amount numeric(10,2) DEFAULT 0,
    igst_amount numeric(10,2) DEFAULT 0,
    CONSTRAINT order_items_fulfillment_status_check CHECK ((fulfillment_status = ANY (ARRAY['unfulfilled'::text, 'partial'::text, 'fulfilled'::text, 'returned'::text]))),
    CONSTRAINT order_items_hsn_code_format_check CHECK (((hsn_code IS NULL) OR (hsn_code ~ '^\d{4,8}$'::text))),
    CONSTRAINT order_items_quantity_check CHECK ((quantity > 0))
);


--
-- Name: order_line_adjustments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_line_adjustments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_id uuid NOT NULL,
    order_id uuid NOT NULL,
    order_item_id uuid,
    adjustment_type text NOT NULL,
    source_type text,
    source_id uuid,
    title text NOT NULL,
    amount numeric(12,2) NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT order_line_adjustments_adjustment_type_check CHECK ((adjustment_type = ANY (ARRAY['promotion'::text, 'manual'::text, 'gift_card'::text, 'rounding'::text]))),
    CONSTRAINT order_line_adjustments_amount_check CHECK ((amount >= (0)::numeric))
);


--
-- Name: order_shipping_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_shipping_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_id uuid NOT NULL,
    order_id uuid NOT NULL,
    title text NOT NULL,
    method text NOT NULL,
    carrier text,
    amount numeric(12,2) DEFAULT 0 NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: order_tax_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_tax_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_id uuid NOT NULL,
    order_id uuid NOT NULL,
    order_item_id uuid,
    title text NOT NULL,
    rate numeric(8,6) DEFAULT 0 NOT NULL,
    amount numeric(12,2) DEFAULT 0 NOT NULL,
    jurisdiction jsonb DEFAULT '{}'::jsonb NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid,
    order_number text NOT NULL,
    customer_email text NOT NULL,
    customer_name text,
    customer_phone text,
    shipping_address jsonb NOT NULL,
    billing_address jsonb,
    items jsonb NOT NULL,
    subtotal numeric(10,2) NOT NULL,
    shipping_cost numeric(10,2) DEFAULT 0,
    tax numeric(10,2) DEFAULT 0,
    discount numeric(10,2) DEFAULT 0,
    total numeric(10,2) NOT NULL,
    coupon_code text,
    coupon_discount numeric(10,2),
    status text DEFAULT 'pending'::text,
    payment_status text DEFAULT 'pending'::text,
    payment_method text,
    payment_id text,
    tracking_number text,
    carrier text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    fulfillment_status text DEFAULT 'unfulfilled'::text,
    payment_gateway text,
    shipping_method text,
    notes text,
    site_id uuid,
    deleted_at timestamp with time zone,
    created_by uuid,
    updated_by uuid,
    version integer DEFAULT 1 NOT NULL,
    payment_processed_at timestamp with time zone,
    inventory_reserved_at timestamp with time zone,
    inventory_released_at timestamp with time zone,
    payment_failure_reason text,
    last_payment_event_id text,
    currency text DEFAULT 'INR'::text,
    return_status text DEFAULT 'none'::text,
    refund_status text DEFAULT 'none'::text,
    customer_gstin text,
    place_of_supply_state text,
    gst_invoice_number text,
    gst_invoice jsonb,
    CONSTRAINT orders_customer_gstin_format_check CHECK (((customer_gstin IS NULL) OR (customer_gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'::text))),
    CONSTRAINT orders_payment_status_check CHECK ((payment_status = ANY (ARRAY['pending'::text, 'paid'::text, 'failed'::text, 'refunded'::text]))),
    CONSTRAINT orders_place_of_supply_state_check CHECK (((place_of_supply_state IS NULL) OR (place_of_supply_state ~ '^(0[1-9]|[12][0-9]|3[0-8]|97)$'::text))),
    CONSTRAINT orders_refund_status_check CHECK ((refund_status = ANY (ARRAY['none'::text, 'pending'::text, 'processing'::text, 'partially_refunded'::text, 'refunded'::text, 'failed'::text]))),
    CONSTRAINT orders_return_status_check CHECK ((return_status = ANY (ARRAY['none'::text, 'requested'::text, 'authorized'::text, 'received'::text, 'refunded'::text, 'closed'::text, 'cancelled'::text]))),
    CONSTRAINT orders_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'processing'::text, 'shipped'::text, 'delivered'::text, 'cancelled'::text, 'refunded'::text])))
);


--
-- Name: outbox_dead_letters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.outbox_dead_letters (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_id uuid,
    outbox_event_id uuid NOT NULL,
    event_id uuid NOT NULL,
    event_type text NOT NULL,
    aggregate_type text NOT NULL,
    aggregate_id text NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    failure_reason text NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    request_id text,
    trace_id text,
    idempotency_key text NOT NULL,
    schema_version integer DEFAULT 1 NOT NULL,
    replayed_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: pages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    title text NOT NULL,
    slug text NOT NULL,
    content jsonb,
    html_content text,
    is_homepage boolean DEFAULT false,
    status text DEFAULT 'draft'::text,
    seo_title text,
    seo_description text,
    display_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    body text,
    page_type text DEFAULT 'custom'::text,
    show_in_nav boolean DEFAULT false,
    deleted_at timestamp with time zone,
    published_at timestamp with time zone,
    CONSTRAINT pages_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text])))
);


--
-- Name: partner_payout_ledger_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.partner_payout_ledger_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    partner_id uuid NOT NULL,
    site_id uuid,
    app_id uuid,
    installation_id uuid,
    charge_id uuid NOT NULL,
    source_event_id uuid NOT NULL,
    billing_mode text NOT NULL,
    amount_minor integer NOT NULL,
    currency text DEFAULT 'INR'::text NOT NULL,
    revenue_share_bps integer DEFAULT 8000 NOT NULL,
    partner_amount_minor integer NOT NULL,
    platform_fee_minor integer NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    rail text DEFAULT 'manual'::text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT partner_payout_ledger_entries_amount_minor_check CHECK ((amount_minor >= 0)),
    CONSTRAINT partner_payout_ledger_entries_billing_mode_check CHECK ((billing_mode = ANY (ARRAY['recurring'::text, 'usage'::text]))),
    CONSTRAINT partner_payout_ledger_entries_currency_check CHECK ((currency = 'INR'::text)),
    CONSTRAINT partner_payout_ledger_entries_partner_amount_minor_check CHECK ((partner_amount_minor >= 0)),
    CONSTRAINT partner_payout_ledger_entries_platform_fee_minor_check CHECK ((platform_fee_minor >= 0)),
    CONSTRAINT partner_payout_ledger_entries_rail_check CHECK ((rail = ANY (ARRAY['razorpay_route'::text, 'razorpayx'::text, 'upi'::text, 'manual'::text]))),
    CONSTRAINT partner_payout_ledger_entries_revenue_share_bps_check CHECK (((revenue_share_bps >= 0) AND (revenue_share_bps <= 10000))),
    CONSTRAINT partner_payout_ledger_entries_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'released'::text, 'failed'::text, 'cancelled'::text])))
);


--
-- Name: payment_attempts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_attempts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_id uuid NOT NULL,
    order_id uuid NOT NULL,
    payment_transaction_id uuid,
    provider text NOT NULL,
    attempt_type text NOT NULL,
    status text NOT NULL,
    amount numeric(12,2) DEFAULT 0 NOT NULL,
    currency text DEFAULT 'INR'::text NOT NULL,
    provider_order_id text,
    provider_payment_id text,
    provider_event_id text,
    idempotency_key text,
    request_id text,
    failure_reason text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT payment_attempts_attempt_type_check CHECK ((attempt_type = ANY (ARRAY['reference'::text, 'authorize'::text, 'capture'::text, 'failure'::text, 'void'::text]))),
    CONSTRAINT payment_attempts_provider_check CHECK ((provider = ANY (ARRAY['stripe'::text, 'razorpay'::text, 'paypal'::text, 'cod'::text, 'bank_transfer'::text]))),
    CONSTRAINT payment_attempts_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'succeeded'::text, 'failed'::text])))
);


--
-- Name: payment_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    store_id uuid NOT NULL,
    gateway text NOT NULL,
    gateway_txn_id text,
    amount numeric(10,2) NOT NULL,
    currency text DEFAULT 'INR'::text,
    status text DEFAULT 'pending'::text,
    failure_reason text,
    payment_method text,
    card_last4 text,
    card_brand text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    site_id uuid NOT NULL,
    provider_order_id text,
    provider_payment_id text,
    provider_event_id text,
    request_id text,
    idempotency_key text,
    authorized_at timestamp with time zone,
    captured_at timestamp with time zone,
    voided_at timestamp with time zone,
    refunded_at timestamp with time zone,
    created_by uuid,
    updated_by uuid,
    deleted_at timestamp with time zone,
    CONSTRAINT payment_transactions_gateway_check CHECK ((gateway = ANY (ARRAY['stripe'::text, 'razorpay'::text, 'paypal'::text, 'cod'::text, 'bank_transfer'::text]))),
    CONSTRAINT payment_transactions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'authorized'::text, 'captured'::text, 'completed'::text, 'failed'::text, 'partially_refunded'::text, 'refunded'::text, 'voided'::text])))
);


--
-- Name: payment_webhook_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_webhook_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider text NOT NULL,
    provider_event_id text NOT NULL,
    event_type text NOT NULL,
    signature_valid boolean DEFAULT false NOT NULL,
    processing_status text DEFAULT 'received'::text NOT NULL,
    raw_payload jsonb,
    error_message text,
    processed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT payment_webhook_events_processing_status_check CHECK ((processing_status = ANY (ARRAY['received'::text, 'processing'::text, 'processed'::text, 'failed'::text, 'ignored'::text])))
);


--
-- Name: plan_entitlements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plan_entitlements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_type text DEFAULT 'store'::text NOT NULL,
    plan_slug text NOT NULL,
    features text[] DEFAULT ARRAY[]::text[] NOT NULL,
    limits jsonb DEFAULT '{}'::jsonb NOT NULL,
    entitlements jsonb DEFAULT '{}'::jsonb NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_type text NOT NULL,
    slug text NOT NULL,
    name text NOT NULL,
    tagline text,
    is_popular boolean DEFAULT false,
    price_monthly_inr integer DEFAULT 0 NOT NULL,
    price_yearly_inr integer DEFAULT 0,
    price_monthly_usd integer DEFAULT 0,
    price_yearly_usd integer DEFAULT 0,
    gmv_percentage numeric(4,2) DEFAULT 0,
    setup_fee_inr integer DEFAULT 0,
    promo_price_inr integer DEFAULT 0,
    promo_months integer DEFAULT 0,
    promo_label text,
    products_limit integer,
    orders_limit integer,
    pages_limit integer,
    storage_mb integer DEFAULT 100,
    staff_limit integer DEFAULT 1,
    ai_credits_monthly integer DEFAULT 10,
    features jsonb DEFAULT '[]'::jsonb,
    compare_features jsonb DEFAULT '[]'::jsonb,
    is_active boolean DEFAULT true,
    display_order integer DEFAULT 0,
    requires_contact boolean DEFAULT false,
    trial_days integer DEFAULT 7,
    custom_domain boolean DEFAULT false,
    branding_removable boolean DEFAULT false,
    support_level text DEFAULT 'community'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    razorpay_plan_id_monthly text,
    razorpay_plan_id_yearly text,
    deleted_at timestamp with time zone,
    version integer DEFAULT 1 NOT NULL
);


--
-- Name: portfolio_projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.portfolio_projects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid,
    title text NOT NULL,
    description text,
    short_description text,
    images text[] DEFAULT '{}'::text[],
    thumbnail_url text,
    video_url text,
    client_name text,
    project_date date,
    technologies text[] DEFAULT '{}'::text[],
    live_url text,
    github_url text,
    behance_url text,
    dribbble_url text,
    is_featured boolean DEFAULT false,
    display_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    slug text,
    content text,
    cover_image text,
    project_url text,
    categories text[] DEFAULT '{}'::text[],
    status text DEFAULT 'draft'::text,
    site_id uuid,
    deleted_at timestamp with time zone,
    created_by uuid,
    updated_by uuid,
    version integer DEFAULT 1 NOT NULL,
    url text,
    image_url text,
    tags text[] DEFAULT '{}'::text[],
    is_visible boolean DEFAULT true,
    start_date date,
    end_date date
);


--
-- Name: product_options; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_options (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    name text NOT NULL,
    "position" integer DEFAULT 0,
    "values" jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: product_reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    product_id uuid NOT NULL,
    customer_name text NOT NULL,
    customer_email text,
    rating integer NOT NULL,
    title text,
    body text,
    images text[] DEFAULT '{}'::text[],
    is_verified boolean DEFAULT false,
    is_approved boolean DEFAULT false,
    helpful_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone,
    status text DEFAULT 'pending'::text,
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT product_reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5))),
    CONSTRAINT product_reviews_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);


--
-- Name: product_variants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_variants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    title text NOT NULL,
    price numeric(10,2) DEFAULT 0 NOT NULL,
    compare_price numeric(10,2),
    sku text,
    barcode text,
    inventory_qty integer DEFAULT 0,
    weight numeric(10,3),
    weight_unit text DEFAULT 'kg'::text,
    option1 text,
    option2 text,
    option3 text,
    image_url text,
    "position" integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: production_db_rollout_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.production_db_rollout_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    rollout_id text NOT NULL,
    environment text NOT NULL,
    primary_region text NOT NULL,
    replica_regions text[] DEFAULT ARRAY[]::text[] NOT NULL,
    pitr_enabled boolean DEFAULT true NOT NULL,
    backup_policy jsonb DEFAULT '{}'::jsonb NOT NULL,
    connection_pooling jsonb DEFAULT '{}'::jsonb NOT NULL,
    migration_policy jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'planned'::text NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT production_db_rollout_plans_environment_check CHECK ((environment = ANY (ARRAY['dev'::text, 'staging'::text, 'production'::text]))),
    CONSTRAINT production_db_rollout_plans_status_check CHECK ((status = ANY (ARRAY['planned'::text, 'ready'::text, 'blocked'::text, 'applied'::text, 'rolled-back'::text])))
);


--
-- Name: production_incident_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.production_incident_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    incident_id text NOT NULL,
    event_type text NOT NULL,
    actor_id uuid,
    summary text NOT NULL,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT production_incident_events_event_type_check CHECK ((event_type = ANY (ARRAY['created'::text, 'status-change'::text, 'escalation'::text, 'mitigation'::text, 'recovery'::text, 'note'::text])))
);


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid,
    name text NOT NULL,
    description text,
    price numeric(10,2) NOT NULL,
    compare_price numeric(10,2),
    images text[] DEFAULT '{}'::text[],
    thumbnail_url text,
    category text,
    tags text[] DEFAULT '{}'::text[],
    variants jsonb DEFAULT '[]'::jsonb,
    stock integer DEFAULT 0,
    track_inventory boolean DEFAULT true,
    allow_backorder boolean DEFAULT false,
    is_active boolean DEFAULT true,
    is_featured boolean DEFAULT false,
    display_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    slug text,
    cost_price numeric(10,2),
    sku text,
    barcode text,
    seo_title text,
    seo_description text,
    status text DEFAULT 'draft'::text,
    site_id uuid,
    product_type text,
    vendor text,
    url_handle text,
    cost_per_item numeric(10,2),
    charge_tax boolean DEFAULT true,
    sell_when_oos boolean DEFAULT false,
    is_physical boolean DEFAULT true,
    weight numeric(10,3),
    weight_unit text DEFAULT 'kg'::text,
    country_of_origin text,
    hs_code text,
    deleted_at timestamp with time zone,
    created_by uuid,
    updated_by uuid,
    version integer DEFAULT 1 NOT NULL,
    hsn_code text,
    CONSTRAINT products_hsn_code_format_check CHECK (((hsn_code IS NULL) OR (hsn_code ~ '^\d{4,8}$'::text)))
);


--
-- Name: projection_checkpoints; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.projection_checkpoints (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    checkpoint_id text NOT NULL,
    projection_name text NOT NULL,
    projection_version integer DEFAULT 1 NOT NULL,
    owner_runtime text NOT NULL,
    site_id uuid,
    object_type text NOT NULL,
    object_id text NOT NULL,
    cursor jsonb DEFAULT '{}'::jsonb NOT NULL,
    source_global_position bigint,
    source_stream_position bigint,
    projected_count integer DEFAULT 0 NOT NULL,
    failed_count integer DEFAULT 0 NOT NULL,
    request_id text,
    correlation_id text NOT NULL,
    trace_id text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: projection_rebuilds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.projection_rebuilds (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    rebuild_id text NOT NULL,
    projection_name text NOT NULL,
    projection_version integer DEFAULT 1 NOT NULL,
    owner_runtime text NOT NULL,
    site_id uuid,
    status text DEFAULT 'running'::text NOT NULL,
    cursor jsonb DEFAULT '{}'::jsonb NOT NULL,
    scanned integer DEFAULT 0 NOT NULL,
    updated integer DEFAULT 0 NOT NULL,
    skipped integer DEFAULT 0 NOT NULL,
    failed integer DEFAULT 0 NOT NULL,
    reason text NOT NULL,
    requested_by uuid,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT projection_rebuilds_status_check CHECK ((status = ANY (ARRAY['running'::text, 'completed'::text, 'failed'::text, 'cancelled'::text])))
);


--
-- Name: projection_store; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.projection_store (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    projection_name text NOT NULL,
    projection_version integer DEFAULT 1 NOT NULL,
    site_id uuid,
    object_type text NOT NULL,
    object_id text NOT NULL,
    read_model jsonb DEFAULT '{}'::jsonb NOT NULL,
    source_event_id uuid,
    source_global_position bigint,
    source_stream_position bigint,
    projected_at timestamp with time zone DEFAULT now() NOT NULL,
    stale_after timestamp with time zone,
    lifecycle_status text DEFAULT 'active'::text NOT NULL,
    cache_key text,
    cache_tags text[] DEFAULT ARRAY[]::text[] NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT projection_store_lifecycle_status_check CHECK ((lifecycle_status = ANY (ARRAY['active'::text, 'stale'::text, 'rebuilding'::text, 'invalidated'::text, 'deleted'::text])))
);


--
-- Name: projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.projects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid,
    title text NOT NULL,
    description text,
    short_description text,
    images text[] DEFAULT '{}'::text[],
    thumbnail_url text,
    video_url text,
    client_name text,
    project_date date,
    technologies text[] DEFAULT '{}'::text[],
    live_url text,
    github_url text,
    behance_url text,
    dribbble_url text,
    is_featured boolean DEFAULT false,
    display_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    slug text,
    content text,
    cover_image text,
    project_url text,
    categories text[] DEFAULT '{}'::text[],
    status text DEFAULT 'draft'::text,
    site_id uuid,
    deleted_at timestamp with time zone,
    created_by uuid,
    updated_by uuid,
    version integer DEFAULT 1 NOT NULL
);


--
-- Name: promotion_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.promotion_codes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_id uuid NOT NULL,
    promotion_id uuid NOT NULL,
    code text NOT NULL,
    code_normalized text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    usage_count integer DEFAULT 0 NOT NULL,
    usage_limit integer,
    starts_at timestamp with time zone,
    ends_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT promotion_codes_status_check CHECK ((status = ANY (ARRAY['active'::text, 'paused'::text, 'expired'::text, 'archived'::text])))
);


--
-- Name: promotion_effects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.promotion_effects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_id uuid NOT NULL,
    promotion_id uuid NOT NULL,
    effect_type text NOT NULL,
    value numeric(12,2) DEFAULT 0 NOT NULL,
    max_discount numeric(12,2),
    applies_to text DEFAULT 'order'::text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT promotion_effects_applies_to_check CHECK ((applies_to = ANY (ARRAY['order'::text, 'line'::text, 'shipping'::text]))),
    CONSTRAINT promotion_effects_effect_type_check CHECK ((effect_type = ANY (ARRAY['percentage'::text, 'fixed'::text, 'free_shipping'::text])))
);


--
-- Name: promotion_redemptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.promotion_redemptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_id uuid NOT NULL,
    promotion_id uuid,
    promotion_code_id uuid,
    coupon_id uuid,
    order_id uuid NOT NULL,
    customer_email text,
    code text,
    amount numeric(12,2) DEFAULT 0 NOT NULL,
    status text DEFAULT 'committed'::text NOT NULL,
    idempotency_key text NOT NULL,
    request_id text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT promotion_redemptions_status_check CHECK ((status = ANY (ARRAY['reserved'::text, 'committed'::text, 'released'::text, 'voided'::text])))
);


--
-- Name: promotion_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.promotion_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_id uuid NOT NULL,
    promotion_id uuid NOT NULL,
    rule_type text NOT NULL,
    operator text DEFAULT 'gte'::text NOT NULL,
    value jsonb NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT promotion_rules_operator_check CHECK ((operator = ANY (ARRAY['eq'::text, 'in'::text, 'gte'::text, 'lte'::text]))),
    CONSTRAINT promotion_rules_rule_type_check CHECK ((rule_type = ANY (ARRAY['min_order_amount'::text, 'customer_email'::text, 'product_ids'::text, 'collection_ids'::text])))
);


--
-- Name: promotion_usage_counters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.promotion_usage_counters (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_id uuid NOT NULL,
    promotion_id uuid,
    promotion_code_id uuid,
    coupon_id uuid,
    customer_email text,
    usage_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: promotions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.promotions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_id uuid NOT NULL,
    title text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    priority integer DEFAULT 100 NOT NULL,
    starts_at timestamp with time zone,
    ends_at timestamp with time zone,
    stack_group text DEFAULT 'default'::text NOT NULL,
    can_stack boolean DEFAULT false NOT NULL,
    usage_limit integer,
    per_customer_limit integer DEFAULT 1 NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT promotions_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'active'::text, 'paused'::text, 'expired'::text, 'archived'::text])))
);


--
-- Name: provider_health_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.provider_health_snapshots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider text NOT NULL,
    operation text NOT NULL,
    region text,
    status text NOT NULL,
    latency_ms integer,
    reason text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    checked_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT provider_health_snapshots_status_check CHECK ((status = ANY (ARRAY['healthy'::text, 'degraded'::text, 'unavailable'::text])))
);


--
-- Name: provider_outage_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.provider_outage_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    outage_id text NOT NULL,
    provider text NOT NULL,
    operation text NOT NULL,
    region text,
    status text NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    resolved_at timestamp with time zone,
    reason text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT provider_outage_events_status_check CHECK ((status = ANY (ARRAY['detected'::text, 'degraded'::text, 'failed-over'::text, 'resolved'::text])))
);


--
-- Name: purchase_order_receipts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_order_receipts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_id uuid NOT NULL,
    purchase_order_id uuid NOT NULL,
    purchase_order_line_id uuid,
    product_id uuid NOT NULL,
    variant_id uuid,
    location_id uuid,
    quantity_received integer NOT NULL,
    idempotency_key text NOT NULL,
    request_id text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT purchase_order_receipts_quantity_received_check CHECK ((quantity_received > 0))
);


--
-- Name: query_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.query_snapshots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    query_name text NOT NULL,
    query_version integer DEFAULT 1 NOT NULL,
    cache_key text NOT NULL,
    site_id uuid,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    source_projection_name text NOT NULL,
    source_projection_version integer DEFAULT 1 NOT NULL,
    consistency text NOT NULL,
    expires_at timestamp with time zone,
    request_id text,
    correlation_id text NOT NULL,
    trace_id text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT query_snapshots_consistency_check CHECK ((consistency = ANY (ARRAY['strong'::text, 'read-your-writes'::text, 'eventual'::text])))
);


--
-- Name: queue_operation_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.queue_operation_snapshots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    queue_name text NOT NULL,
    partition_key text,
    site_id uuid,
    depth integer DEFAULT 0 NOT NULL,
    leased integer DEFAULT 0 NOT NULL,
    retrying integer DEFAULT 0 NOT NULL,
    dead_lettered integer DEFAULT 0 NOT NULL,
    oldest_available_at timestamp with time zone,
    newest_completed_at timestamp with time zone,
    sampled_at timestamp with time zone DEFAULT now() NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: queue_recovery_operations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.queue_recovery_operations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    operation_id text NOT NULL,
    queue_name text NOT NULL,
    operation text NOT NULL,
    message_ids text[] DEFAULT ARRAY[]::text[] NOT NULL,
    dry_run boolean DEFAULT false NOT NULL,
    requested_by uuid,
    reason text NOT NULL,
    status text DEFAULT 'planned'::text NOT NULL,
    result jsonb DEFAULT '{}'::jsonb NOT NULL,
    request_id text,
    correlation_id text,
    trace_id text,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT queue_recovery_operations_operation_check CHECK ((operation = ANY (ARRAY['release-expired-lease'::text, 'retry'::text, 'dead-letter'::text, 'redrive'::text, 'rebalance'::text, 'poison-message'::text]))),
    CONSTRAINT queue_recovery_operations_status_check CHECK ((status = ANY (ARRAY['planned'::text, 'running'::text, 'completed'::text, 'failed'::text, 'cancelled'::text])))
);


--
-- Name: refund_attempts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.refund_attempts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_id uuid NOT NULL,
    refund_transaction_id uuid NOT NULL,
    provider text NOT NULL,
    status text NOT NULL,
    provider_refund_id text,
    provider_event_id text,
    idempotency_key text,
    request_id text,
    failure_reason text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT refund_attempts_provider_check CHECK ((provider = ANY (ARRAY['stripe'::text, 'razorpay'::text, 'paypal'::text, 'cod'::text, 'bank_transfer'::text, 'gift_card'::text]))),
    CONSTRAINT refund_attempts_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'succeeded'::text, 'failed'::text])))
);


--
-- Name: refund_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.refund_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_id uuid NOT NULL,
    refund_id uuid NOT NULL,
    return_line_id uuid,
    order_item_id uuid,
    amount numeric(12,2) NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT refund_lines_amount_check CHECK ((amount >= (0)::numeric)),
    CONSTRAINT refund_lines_quantity_check CHECK ((quantity > 0))
);


--
-- Name: refund_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.refund_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_id uuid NOT NULL,
    order_id uuid NOT NULL,
    payment_transaction_id uuid,
    amount numeric(12,2) NOT NULL,
    currency text DEFAULT 'INR'::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    refund_method text DEFAULT 'original_payment'::text NOT NULL,
    provider_refund_id text,
    provider_event_id text,
    reason text,
    idempotency_key text,
    request_id text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT refund_transactions_amount_check CHECK ((amount >= (0)::numeric)),
    CONSTRAINT refund_transactions_refund_method_check CHECK ((refund_method = ANY (ARRAY['original_payment'::text, 'gift_card'::text, 'manual'::text]))),
    CONSTRAINT refund_transactions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'succeeded'::text, 'failed'::text])))
);


--
-- Name: refunds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.refunds (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_id uuid NOT NULL,
    order_id uuid NOT NULL,
    return_id uuid,
    payment_transaction_id uuid,
    amount numeric(12,2) NOT NULL,
    currency text DEFAULT 'INR'::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    refund_method text DEFAULT 'original_payment'::text NOT NULL,
    provider text,
    provider_refund_id text,
    provider_event_id text,
    idempotency_key text NOT NULL,
    request_id text,
    reason text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT refunds_amount_check CHECK ((amount >= (0)::numeric)),
    CONSTRAINT refunds_refund_method_check CHECK ((refund_method = ANY (ARRAY['original_payment'::text, 'gift_card'::text, 'manual'::text]))),
    CONSTRAINT refunds_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'succeeded'::text, 'failed'::text, 'cancelled'::text])))
);


--
-- Name: regional_execution_diagnostics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.regional_execution_diagnostics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    region text NOT NULL,
    status text NOT NULL,
    accepts_reads boolean DEFAULT true NOT NULL,
    accepts_writes boolean DEFAULT true NOT NULL,
    queue_lag_ms integer DEFAULT 0 NOT NULL,
    replication_lag_ms integer DEFAULT 0 NOT NULL,
    reason text NOT NULL,
    diagnosed_at timestamp with time zone DEFAULT now() NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT regional_execution_diagnostics_status_check CHECK ((status = ANY (ARRAY['healthy'::text, 'degraded'::text, 'unavailable'::text])))
);


--
-- Name: replay_dry_run_results; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.replay_dry_run_results (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    replay_id text NOT NULL,
    scanned integer DEFAULT 0 NOT NULL,
    would_dispatch integer DEFAULT 0 NOT NULL,
    skipped integer DEFAULT 0 NOT NULL,
    failed integer DEFAULT 0 NOT NULL,
    impact jsonb DEFAULT '{}'::jsonb NOT NULL,
    request_id text,
    correlation_id text,
    trace_id text,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: replay_operation_schedules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.replay_operation_schedules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    replay_id text NOT NULL,
    owner_runtime text NOT NULL,
    site_id uuid,
    event_types text[] DEFAULT ARRAY[]::text[] NOT NULL,
    cursor jsonb DEFAULT '{}'::jsonb NOT NULL,
    batch_size integer DEFAULT 100 NOT NULL,
    dry_run boolean DEFAULT true NOT NULL,
    impact jsonb DEFAULT '{}'::jsonb NOT NULL,
    rollback_plan jsonb DEFAULT '{}'::jsonb NOT NULL,
    requested_by uuid,
    approved_by uuid,
    authorization_expires_at timestamp with time zone,
    status text DEFAULT 'planned'::text NOT NULL,
    request_id text,
    correlation_id text,
    trace_id text,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT replay_operation_schedules_status_check CHECK ((status = ANY (ARRAY['planned'::text, 'authorized'::text, 'running'::text, 'paused'::text, 'completed'::text, 'failed'::text, 'cancelled'::text])))
);


--
-- Name: restock_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.restock_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_id uuid NOT NULL,
    return_id uuid,
    return_line_id uuid,
    inventory_level_id uuid,
    location_id uuid,
    product_id uuid NOT NULL,
    variant_id uuid,
    order_id uuid,
    quantity integer NOT NULL,
    status text DEFAULT 'committed'::text NOT NULL,
    idempotency_key text NOT NULL,
    request_id text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT restock_events_quantity_check CHECK ((quantity > 0)),
    CONSTRAINT restock_events_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'committed'::text, 'voided'::text])))
);


--
-- Name: resume_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.resume_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid,
    template_id text NOT NULL,
    file_name text NOT NULL,
    pdf_url text NOT NULL,
    file_size_bytes bigint,
    download_count integer DEFAULT 0,
    is_primary boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone,
    created_by uuid
);


--
-- Name: return_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.return_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_id uuid NOT NULL,
    return_id uuid NOT NULL,
    order_id uuid NOT NULL,
    order_item_id uuid NOT NULL,
    product_id uuid,
    variant_id uuid,
    quantity integer NOT NULL,
    received_quantity integer DEFAULT 0 NOT NULL,
    restock_quantity integer DEFAULT 0 NOT NULL,
    refund_amount numeric(12,2) DEFAULT 0 NOT NULL,
    reason text,
    condition text DEFAULT 'sellable'::text,
    disposition text DEFAULT 'restock'::text,
    status text DEFAULT 'authorized'::text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT return_lines_condition_check CHECK ((condition = ANY (ARRAY['sellable'::text, 'opened'::text, 'damaged'::text, 'missing'::text, 'unknown'::text]))),
    CONSTRAINT return_lines_disposition_check CHECK ((disposition = ANY (ARRAY['restock'::text, 'scrap'::text, 'return_to_vendor'::text, 'no_restock'::text]))),
    CONSTRAINT return_lines_quantity_check CHECK ((quantity > 0)),
    CONSTRAINT return_lines_received_quantity_check CHECK ((received_quantity >= 0)),
    CONSTRAINT return_lines_refund_amount_check CHECK ((refund_amount >= (0)::numeric)),
    CONSTRAINT return_lines_restock_quantity_check CHECK ((restock_quantity >= 0)),
    CONSTRAINT return_lines_status_check CHECK ((status = ANY (ARRAY['requested'::text, 'authorized'::text, 'received'::text, 'inspected'::text, 'restocked'::text, 'refunded'::text, 'rejected'::text])))
);


--
-- Name: return_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.return_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    store_id uuid NOT NULL,
    reason text NOT NULL,
    description text,
    images text[] DEFAULT '{}'::text[],
    status text DEFAULT 'pending'::text,
    approved_at timestamp with time zone,
    refund_amount numeric(10,2),
    refund_method text,
    refunded_at timestamp with time zone,
    admin_notes text,
    processed_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT return_requests_reason_check CHECK ((reason = ANY (ARRAY['defective'::text, 'wrong_item'::text, 'not_as_described'::text, 'changed_mind'::text, 'too_late'::text, 'other'::text]))),
    CONSTRAINT return_requests_refund_method_check CHECK ((refund_method = ANY (ARRAY['original_payment'::text, 'store_credit'::text, 'bank_transfer'::text]))),
    CONSTRAINT return_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'processing'::text, 'refunded'::text, 'completed'::text])))
);


--
-- Name: returns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.returns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_id uuid NOT NULL,
    order_id uuid NOT NULL,
    status text DEFAULT 'requested'::text NOT NULL,
    customer_email text,
    reason text,
    refund_method text DEFAULT 'original_payment'::text NOT NULL,
    idempotency_key text NOT NULL,
    request_id text,
    authorized_at timestamp with time zone,
    received_at timestamp with time zone,
    inspected_at timestamp with time zone,
    refunded_at timestamp with time zone,
    closed_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT returns_refund_method_check CHECK ((refund_method = ANY (ARRAY['original_payment'::text, 'gift_card'::text, 'manual'::text]))),
    CONSTRAINT returns_status_check CHECK ((status = ANY (ARRAY['requested'::text, 'authorized'::text, 'rejected'::text, 'received'::text, 'inspected'::text, 'approved'::text, 'refunded'::text, 'closed'::text, 'cancelled'::text])))
);


--
-- Name: runtime_alert_evaluations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.runtime_alert_evaluations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    alert_name text NOT NULL,
    runtime_name text NOT NULL,
    severity text NOT NULL,
    firing boolean DEFAULT false NOT NULL,
    observed_value numeric DEFAULT 0 NOT NULL,
    reason text NOT NULL,
    runbook text,
    evaluated_at timestamp with time zone DEFAULT now() NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT runtime_alert_evaluations_severity_check CHECK ((severity = ANY (ARRAY['info'::text, 'warning'::text, 'critical'::text])))
);


--
-- Name: runtime_checkpoints; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.runtime_checkpoints (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    checkpoint_id text NOT NULL,
    owner_runtime text NOT NULL,
    checkpoint_kind text NOT NULL,
    execution_id text NOT NULL,
    step_name text,
    site_id uuid,
    state jsonb DEFAULT '{}'::jsonb NOT NULL,
    cursor jsonb DEFAULT '{}'::jsonb NOT NULL,
    attempt integer DEFAULT 0 NOT NULL,
    fencing_token text,
    request_id text,
    correlation_id text NOT NULL,
    trace_id text,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT runtime_checkpoints_checkpoint_kind_check CHECK ((checkpoint_kind = ANY (ARRAY['event-replay'::text, 'queue-consumer'::text, 'workflow'::text, 'projection'::text, 'provider-call'::text])))
);


--
-- Name: runtime_command_journal; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.runtime_command_journal (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    command_id text NOT NULL,
    command_name text NOT NULL,
    site_id uuid,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'accepted'::text NOT NULL,
    idempotency_key text NOT NULL,
    event_ids text[] DEFAULT ARRAY[]::text[] NOT NULL,
    checkpoint_id text,
    request_id text NOT NULL,
    correlation_id text NOT NULL,
    trace_id text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    completed_at timestamp with time zone,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT runtime_command_journal_status_check CHECK ((status = ANY (ARRAY['accepted'::text, 'completed'::text, 'rejected'::text])))
);


--
-- Name: runtime_deployment_topology_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.runtime_deployment_topology_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    topology_version integer NOT NULL,
    runtime_name text NOT NULL,
    runtime_root text NOT NULL,
    deployment_kind text NOT NULL,
    platform text NOT NULL,
    regions text[] DEFAULT ARRAY[]::text[] NOT NULL,
    startup_order integer DEFAULT 0 NOT NULL,
    dependencies jsonb DEFAULT '[]'::jsonb NOT NULL,
    scaling jsonb DEFAULT '{}'::jsonb NOT NULL,
    health jsonb DEFAULT '{}'::jsonb NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: runtime_event_retention_policies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.runtime_event_retention_policies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    policy_id text NOT NULL,
    retention_class text NOT NULL,
    minimum_age_days integer NOT NULL,
    archive_target text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT runtime_event_retention_policies_minimum_age_days_check CHECK ((minimum_age_days >= 0)),
    CONSTRAINT runtime_event_retention_policies_retention_class_check CHECK ((retention_class = ANY (ARRAY['hot'::text, 'warm'::text, 'archive'::text, 'legal-hold'::text])))
);


--
-- Name: runtime_health_projections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.runtime_health_projections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    runtime_name text NOT NULL,
    status text NOT NULL,
    region text,
    dependencies jsonb DEFAULT '[]'::jsonb NOT NULL,
    checked_at timestamp with time zone DEFAULT now() NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT runtime_health_projections_status_check CHECK ((status = ANY (ARRAY['healthy'::text, 'degraded'::text, 'unavailable'::text])))
);


--
-- Name: runtime_secret_rotation_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.runtime_secret_rotation_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    rotation_id text NOT NULL,
    runtime_name text NOT NULL,
    secret_name text NOT NULL,
    environment text NOT NULL,
    status text DEFAULT 'planned'::text NOT NULL,
    rotated_by uuid,
    rotated_at timestamp with time zone,
    verification jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT runtime_secret_rotation_events_environment_check CHECK ((environment = ANY (ARRAY['dev'::text, 'staging'::text, 'production'::text]))),
    CONSTRAINT runtime_secret_rotation_events_status_check CHECK ((status = ANY (ARRAY['planned'::text, 'rotated'::text, 'verified'::text, 'failed'::text, 'rolled-back'::text])))
);


--
-- Name: runtime_slo_definitions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.runtime_slo_definitions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slo_id text NOT NULL,
    runtime_name text NOT NULL,
    sli_name text NOT NULL,
    target_percent numeric(6,3) NOT NULL,
    "window" text NOT NULL,
    error_budget_policy text NOT NULL,
    alert_policy jsonb DEFAULT '{}'::jsonb NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: runtime_structured_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.runtime_structured_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    log_level text NOT NULL,
    message text NOT NULL,
    runtime_name text NOT NULL,
    site_id uuid,
    request_id text NOT NULL,
    correlation_id text NOT NULL,
    trace_id text,
    attributes jsonb DEFAULT '{}'::jsonb NOT NULL,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT runtime_structured_logs_log_level_check CHECK ((log_level = ANY (ARRAY['debug'::text, 'info'::text, 'warn'::text, 'error'::text])))
);


--
-- Name: runtime_telemetry_metrics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.runtime_telemetry_metrics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    metric_name text NOT NULL,
    metric_value numeric NOT NULL,
    unit text NOT NULL,
    runtime_name text,
    site_id uuid,
    dimensions jsonb DEFAULT '{}'::jsonb NOT NULL,
    request_id text,
    correlation_id text,
    trace_id text,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: runtime_telemetry_spans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.runtime_telemetry_spans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    trace_id text NOT NULL,
    span_id text NOT NULL,
    parent_span_id text,
    runtime_name text NOT NULL,
    span_name text NOT NULL,
    span_kind text NOT NULL,
    status text NOT NULL,
    started_at timestamp with time zone NOT NULL,
    ended_at timestamp with time zone,
    attributes jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT runtime_telemetry_spans_span_kind_check CHECK ((span_kind = ANY (ARRAY['server'::text, 'client'::text, 'consumer'::text, 'producer'::text, 'internal'::text]))),
    CONSTRAINT runtime_telemetry_spans_status_check CHECK ((status = ANY (ARRAY['unset'::text, 'ok'::text, 'error'::text])))
);


--
-- Name: sandbox_provider_contracts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sandbox_provider_contracts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider text NOT NULL,
    environment text NOT NULL,
    mode text NOT NULL,
    side_effect_policy text NOT NULL,
    secret_scope text NOT NULL,
    verification jsonb DEFAULT '{}'::jsonb NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT sandbox_provider_contracts_environment_check CHECK ((environment = ANY (ARRAY['local'::text, 'development'::text, 'staging'::text, 'production'::text]))),
    CONSTRAINT sandbox_provider_contracts_mode_check CHECK ((mode = ANY (ARRAY['sandbox'::text, 'live'::text]))),
    CONSTRAINT sandbox_provider_contracts_provider_check CHECK ((provider = ANY (ARRAY['stripe'::text, 'razorpay'::text, 'paypal'::text, 'email'::text, 'sms'::text, 'queue'::text, 'search'::text, 'storage'::text]))),
    CONSTRAINT sandbox_provider_contracts_secret_scope_check CHECK ((secret_scope = ANY (ARRAY['local-template'::text, 'development-secret-store'::text, 'staging-secret-store'::text, 'production-secret-store'::text]))),
    CONSTRAINT sandbox_provider_contracts_side_effect_policy_check CHECK ((side_effect_policy = ANY (ARRAY['none'::text, 'sandbox-only'::text, 'governed-live'::text])))
);


--
-- Name: search_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.search_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_id uuid NOT NULL,
    object_type text NOT NULL,
    object_id text NOT NULL,
    title text DEFAULT ''::text NOT NULL,
    subtitle text,
    searchable_text text DEFAULT ''::text NOT NULL,
    attributes jsonb DEFAULT '{}'::jsonb NOT NULL,
    source_event_id uuid,
    status text DEFAULT 'active'::text NOT NULL,
    indexed_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    search_vector tsvector GENERATED ALWAYS AS (to_tsvector('simple'::regconfig, searchable_text)) STORED,
    CONSTRAINT search_documents_status_check CHECK ((status = ANY (ARRAY['active'::text, 'hidden'::text, 'deleted'::text])))
);


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    device_id uuid,
    token text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    last_active timestamp with time zone DEFAULT now()
);


--
-- Name: shadow_traffic_comparison_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shadow_traffic_comparison_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    comparison_id text NOT NULL,
    environment text NOT NULL,
    runtime_root text NOT NULL,
    source_version text NOT NULL,
    shadow_version text NOT NULL,
    mirrored_requests integer DEFAULT 0 NOT NULL,
    matched_responses integer DEFAULT 0 NOT NULL,
    mismatched_responses integer DEFAULT 0 NOT NULL,
    p95_latency_delta_ms integer,
    side_effects_blocked boolean DEFAULT true NOT NULL,
    status text NOT NULL,
    result jsonb DEFAULT '{}'::jsonb NOT NULL,
    started_at timestamp with time zone,
    finished_at timestamp with time zone,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT shadow_traffic_comparison_runs_environment_check CHECK ((environment = ANY (ARRAY['staging'::text, 'production'::text]))),
    CONSTRAINT shadow_traffic_comparison_runs_status_check CHECK ((status = ANY (ARRAY['planned'::text, 'running'::text, 'passed'::text, 'failed'::text, 'aborted'::text])))
);


--
-- Name: shipment_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shipment_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_id uuid NOT NULL,
    shipment_id uuid NOT NULL,
    order_id uuid NOT NULL,
    event_type text NOT NULL,
    status text NOT NULL,
    description text,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    request_id text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT shipment_events_event_type_check CHECK ((event_type = ANY (ARRAY['label_created'::text, 'picked'::text, 'packed'::text, 'shipped'::text, 'in_transit'::text, 'out_for_delivery'::text, 'delivered'::text, 'failed'::text, 'cancelled'::text, 'tracking_updated'::text])))
);


--
-- Name: shipments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shipments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_id uuid NOT NULL,
    order_id uuid NOT NULL,
    fulfillment_order_id uuid,
    status text DEFAULT 'label_created'::text NOT NULL,
    carrier text,
    tracking_number text,
    tracking_url text,
    shipped_at timestamp with time zone,
    delivered_at timestamp with time zone,
    idempotency_key text NOT NULL,
    request_id text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT shipments_status_check CHECK ((status = ANY (ARRAY['label_created'::text, 'ready_to_ship'::text, 'shipped'::text, 'in_transit'::text, 'out_for_delivery'::text, 'delivered'::text, 'failed'::text, 'cancelled'::text])))
);


--
-- Name: shipping_rates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shipping_rates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    zone_id uuid NOT NULL,
    name text NOT NULL,
    type text,
    price numeric(10,2) DEFAULT 0,
    min_weight numeric(10,2),
    max_weight numeric(10,2),
    min_order_amount numeric(10,2),
    estimated_days_min integer,
    estimated_days_max integer,
    created_at timestamp with time zone DEFAULT now(),
    description text DEFAULT ''::text,
    max_order_amount numeric(10,2),
    min_weight_grams integer,
    max_weight_grams integer,
    is_active boolean DEFAULT true,
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone,
    created_by uuid,
    updated_by uuid,
    CONSTRAINT shipping_rates_type_check CHECK ((type = ANY (ARRAY['flat'::text, 'weight_based'::text, 'price_based'::text, 'free'::text])))
);


--
-- Name: shipping_zones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shipping_zones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    name text NOT NULL,
    countries text[] DEFAULT '{}'::text[],
    states text[] DEFAULT '{}'::text[],
    is_rest_of_world boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone,
    created_by uuid,
    updated_by uuid,
    zip_codes text[] DEFAULT '{}'::text[]
);


--
-- Name: site_api_clients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.site_api_clients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_id uuid NOT NULL,
    name text NOT NULL,
    key_hash text NOT NULL,
    scopes text[] DEFAULT ARRAY[]::text[] NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    last_used_at timestamp with time zone,
    expires_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT site_api_clients_status_check CHECK ((status = ANY (ARRAY['active'::text, 'paused'::text, 'revoked'::text])))
);


--
-- Name: site_entitlement_overrides; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.site_entitlement_overrides (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_id uuid NOT NULL,
    features_add text[] DEFAULT ARRAY[]::text[] NOT NULL,
    features_remove text[] DEFAULT ARRAY[]::text[] NOT NULL,
    limits jsonb DEFAULT '{}'::jsonb NOT NULL,
    entitlements jsonb DEFAULT '{}'::jsonb NOT NULL,
    reason text,
    starts_at timestamp with time zone DEFAULT now() NOT NULL,
    ends_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: site_memberships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.site_memberships (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_id uuid NOT NULL,
    custom_user_id uuid,
    legacy_user_id uuid,
    email text,
    status text DEFAULT 'active'::text NOT NULL,
    role_slugs text[] DEFAULT ARRAY['owner'::text] NOT NULL,
    permissions text[] DEFAULT ARRAY[]::text[] NOT NULL,
    accepted_at timestamp with time zone,
    expires_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT site_memberships_check CHECK (((custom_user_id IS NOT NULL) OR (legacy_user_id IS NOT NULL) OR (email IS NOT NULL))),
    CONSTRAINT site_memberships_status_check CHECK ((status = ANY (ARRAY['invited'::text, 'active'::text, 'suspended'::text, 'removed'::text])))
);


--
-- Name: site_role_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.site_role_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    role_id uuid NOT NULL,
    permission text NOT NULL,
    effect text DEFAULT 'allow'::text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT site_role_permissions_effect_check CHECK ((effect = ANY (ARRAY['allow'::text, 'deny'::text])))
);


--
-- Name: site_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.site_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_id uuid,
    slug text NOT NULL,
    name text NOT NULL,
    description text,
    is_system boolean DEFAULT false NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: sites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    name text NOT NULL,
    store_name text NOT NULL,
    tagline text,
    logo_url text,
    favicon_url text,
    site_type text NOT NULL,
    subdomain text NOT NULL,
    custom_domain text,
    custom_domain_status text DEFAULT 'none'::text,
    custom_domain_verification_token text,
    access_mode text DEFAULT 'public'::text NOT NULL,
    access_password_hash text,
    access_message text,
    published boolean DEFAULT false NOT NULL,
    theme_id text DEFAULT 'modern'::text,
    theme_settings jsonb DEFAULT '{}'::jsonb,
    template_config jsonb DEFAULT '{}'::jsonb,
    sections jsonb DEFAULT '[]'::jsonb,
    status text DEFAULT 'draft'::text,
    published_at timestamp with time zone,
    views_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    meta_title text,
    meta_description text,
    settings jsonb DEFAULT '{}'::jsonb,
    custom_user_id uuid,
    trial_started_at timestamp with time zone DEFAULT now(),
    trial_ends_at timestamp with time zone DEFAULT (now() + '14 days'::interval),
    trial_status text DEFAULT 'active'::text,
    frozen_at timestamp with time zone,
    og_image_url text,
    brand_color text DEFAULT '#6366f1'::text,
    domain_verified boolean DEFAULT false,
    ssl_status text DEFAULT 'pending'::text,
    currency text DEFAULT 'INR'::text,
    locale text DEFAULT 'en-IN'::text,
    tax_inclusive boolean DEFAULT true,
    industry text,
    product_count integer DEFAULT 0,
    order_count integer DEFAULT 0,
    page_count integer DEFAULT 0,
    description text,
    deleted_at timestamp with time zone,
    created_by uuid,
    updated_by uuid,
    version integer DEFAULT 1 NOT NULL,
    payment_settings jsonb DEFAULT '{}'::jsonb NOT NULL,
    online_payment_enabled boolean DEFAULT true NOT NULL,
    cod_enabled boolean DEFAULT true NOT NULL,
    current_theme_release_id uuid,
    storefront_release_version integer DEFAULT 0 NOT NULL,
    legal_name text,
    gstin text,
    gst_state_code text,
    invoice_prefix text DEFAULT 'LBY'::text,
    CONSTRAINT sites_access_mode_check CHECK ((access_mode = ANY (ARRAY['public'::text, 'password'::text, 'preview_only'::text, 'offline'::text]))),
    CONSTRAINT sites_custom_domain_status_check CHECK ((custom_domain_status = ANY (ARRAY['none'::text, 'pending'::text, 'review'::text, 'verifying'::text, 'active'::text, 'error'::text]))),
    CONSTRAINT sites_gst_state_code_check CHECK (((gst_state_code IS NULL) OR (gst_state_code ~ '^(0[1-9]|[12][0-9]|3[0-8]|97)$'::text))),
    CONSTRAINT sites_gstin_format_check CHECK (((gstin IS NULL) OR (gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'::text))),
    CONSTRAINT sites_site_type_check CHECK ((site_type = ANY (ARRAY['store'::text, 'portfolio'::text, 'resume'::text, 'landing'::text, 'blog'::text]))),
    CONSTRAINT sites_ssl_status_check CHECK ((ssl_status = ANY (ARRAY['pending'::text, 'active'::text, 'failed'::text]))),
    CONSTRAINT sites_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'unpublished'::text, 'frozen'::text, 'suspended'::text]))),
    CONSTRAINT sites_trial_status_check CHECK ((trial_status = ANY (ARRAY['active'::text, 'grace'::text, 'frozen'::text, 'cancelled'::text, 'paid'::text])))
);


--
-- Name: site_preview_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.site_preview_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_id uuid NOT NULL,
    jti text NOT NULL,
    scope text NOT NULL,
    theme_id text,
    created_by uuid,
    expires_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone,
    last_used_at timestamp with time zone,
    hit_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT site_preview_links_scope_check CHECK ((scope = ANY (ARRAY['merchant-preview'::text, 'share-link'::text])))
);


--
-- Name: site_gate_attempts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.site_gate_attempts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_id uuid NOT NULL,
    ip inet,
    host text NOT NULL,
    ts timestamp with time zone DEFAULT now() NOT NULL,
    ok boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);

--
-- Name: site_domain_reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.site_domain_reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_id uuid NOT NULL,
    domain text NOT NULL,
    risk_tier text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    reasons jsonb DEFAULT '[]'::jsonb NOT NULL,
    provider_evidence jsonb,
    decision_notes text,
    decided_at timestamp with time zone,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT site_domain_reviews_risk_tier_check CHECK ((risk_tier = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text]))),
    CONSTRAINT site_domain_reviews_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'denied'::text, 'rejected'::text])))
);

--
-- Name: domain_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domain_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_id uuid NOT NULL,
    domain text NOT NULL,
    provider text NOT NULL,
    status text DEFAULT 'created'::text NOT NULL,
    years integer DEFAULT 1 NOT NULL,
    currency text DEFAULT 'INR'::text NOT NULL,
    amount_minor integer DEFAULT 0 NOT NULL,
    payment_provider text DEFAULT 'razorpay'::text NOT NULL,
    payment_reference text NOT NULL,
    registrar_order_id text,
    registrar_payload jsonb,
    dns_payload jsonb,
    vercel_payload jsonb,
    failure_reason text,
    idempotency_key text NOT NULL,
    completed_at timestamp with time zone,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT domain_orders_provider_check CHECK ((provider = ANY (ARRAY['resellerclub'::text, 'opensrs'::text, 'sandbox'::text]))),
    CONSTRAINT domain_orders_status_check CHECK ((status = ANY (ARRAY['created'::text, 'registering'::text, 'provisioning'::text, 'active'::text, 'failed'::text])))
);


--
-- Name: skill_endorsements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.skill_endorsements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    skill_id uuid NOT NULL,
    endorser_name text NOT NULL,
    endorser_email text NOT NULL,
    endorser_title text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: skills; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.skills (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid,
    name text NOT NULL,
    category text DEFAULT 'technical'::text,
    proficiency_level integer DEFAULT 50,
    years_experience integer,
    certification_url text,
    icon_url text,
    display_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone,
    created_by uuid,
    proficiency integer DEFAULT 50,
    CONSTRAINT skills_proficiency_check CHECK (((proficiency >= 0) AND (proficiency <= 100))),
    CONSTRAINT skills_proficiency_level_check CHECK (((proficiency_level >= 0) AND (proficiency_level <= 100)))
);


--
-- Name: smart_collections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.smart_collections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    description text,
    conditions jsonb NOT NULL,
    match_type text DEFAULT 'all'::text,
    created_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone,
    created_by uuid,
    updated_by uuid,
    version integer DEFAULT 1 NOT NULL,
    CONSTRAINT smart_collections_match_type_check CHECK ((match_type = ANY (ARRAY['all'::text, 'any'::text])))
);


--
-- Name: store_customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.store_customers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    email text NOT NULL,
    password_hash text,
    full_name text,
    phone text,
    status text DEFAULT 'active'::text NOT NULL,
    total_orders integer DEFAULT 0 NOT NULL,
    total_spent numeric(12,2) DEFAULT 0 NOT NULL,
    addresses jsonb DEFAULT '[]'::jsonb,
    tags text[] DEFAULT '{}'::text[],
    notes text,
    accepts_marketing boolean DEFAULT false,
    last_order_at timestamp with time zone,
    last_login_at timestamp with time zone,
    login_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT store_customers_status_check CHECK ((status = ANY (ARRAY['active'::text, 'disabled'::text, 'guest'::text])))
);


--
-- Name: store_surveys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.store_surveys (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    industry text,
    target_audience text,
    business_goal text,
    brand_tone text,
    team_size text,
    revenue_range text,
    additional_notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: store_themes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.store_themes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    theme_id uuid NOT NULL,
    is_active boolean DEFAULT true,
    config_overrides jsonb DEFAULT '{}'::jsonb,
    installed_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: storefront_cache_tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.storefront_cache_tags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    tag text NOT NULL,
    resource_type text NOT NULL,
    resource_id text,
    release_id uuid,
    invalidated_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: storefront_page_revisions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.storefront_page_revisions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    page_id uuid NOT NULL,
    store_id uuid NOT NULL,
    revision_number integer NOT NULL,
    title text NOT NULL,
    slug text NOT NULL,
    seo jsonb DEFAULT '{}'::jsonb NOT NULL,
    content jsonb DEFAULT '{}'::jsonb NOT NULL,
    template_key text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: storefront_pages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.storefront_pages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    slug text NOT NULL,
    title text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    page_type text DEFAULT 'page'::text NOT NULL,
    seo jsonb DEFAULT '{}'::jsonb NOT NULL,
    content jsonb DEFAULT '{}'::jsonb NOT NULL,
    assigned_template_key text,
    published_revision_id uuid,
    published_at timestamp with time zone,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT storefront_pages_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text])))
);


--
-- Name: storefront_policies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.storefront_policies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    policy_type text NOT NULL,
    slug text NOT NULL,
    title text NOT NULL,
    body jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    seo jsonb DEFAULT '{}'::jsonb NOT NULL,
    published_at timestamp with time zone,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT storefront_policies_policy_type_check CHECK ((policy_type = ANY (ARRAY['privacy'::text, 'refund'::text, 'shipping'::text, 'terms'::text, 'contact'::text, 'custom'::text]))),
    CONSTRAINT storefront_policies_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text])))
);


--
-- Name: storefront_slug_redirects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.storefront_slug_redirects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    from_path text NOT NULL,
    to_path text NOT NULL,
    status_code integer DEFAULT 301 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT storefront_slug_redirects_status_code_check CHECK ((status_code = ANY (ARRAY[301, 302, 307, 308])))
);


--
-- Name: stores; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.stores AS
 SELECT id,
    user_id,
    custom_user_id,
    name,
    name AS store_name,
    tagline,
    logo_url,
    favicon_url,
    site_type,
    subdomain,
    custom_domain,
    theme_id,
    theme_settings,
    template_config,
    sections,
    status,
    published_at,
    views_count,
    trial_started_at,
    trial_ends_at,
    trial_status,
    frozen_at,
    og_image_url,
    brand_color,
    domain_verified,
    ssl_status,
    currency,
    locale,
    tax_inclusive,
    industry,
    product_count,
    order_count,
    page_count,
    description,
    created_at,
    updated_at,
    deleted_at,
    version,
    created_by,
    updated_by,
    name AS display_name,
    payment_settings,
    online_payment_enabled,
    cod_enabled,
    current_theme_release_id,
    storefront_release_version
   FROM public.sites;


--
-- Name: subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    plan text NOT NULL,
    status text DEFAULT 'active'::text,
    current_period_start timestamp with time zone,
    current_period_end timestamp with time zone,
    payment_gateway text,
    external_subscription_id text,
    stores_limit integer DEFAULT 1,
    products_limit integer DEFAULT 10,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    store_id uuid,
    billing_period text DEFAULT 'monthly'::text,
    promo_ends_at timestamp with time zone,
    plan_id uuid,
    amount_paid integer DEFAULT 0,
    currency text DEFAULT 'INR'::text,
    razorpay_order_id text,
    razorpay_payment_id text,
    cancelled_at timestamp with time zone,
    cancel_reason text,
    CONSTRAINT subscriptions_billing_period_check CHECK ((billing_period = ANY (ARRAY['monthly'::text, 'yearly'::text]))),
    CONSTRAINT subscriptions_payment_gateway_check CHECK ((payment_gateway = ANY (ARRAY['stripe'::text, 'razorpay'::text]))),
    CONSTRAINT subscriptions_plan_check CHECK ((plan = ANY (ARRAY['free'::text, 'starter'::text, 'business'::text, 'enterprise'::text]))),
    CONSTRAINT subscriptions_status_check CHECK ((status = ANY (ARRAY['active'::text, 'cancelled'::text, 'past_due'::text, 'trialing'::text])))
);


--
-- Name: super_admin_allowlist; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.super_admin_allowlist (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    email text NOT NULL,
    full_name text NOT NULL,
    two_factor_enabled boolean DEFAULT false,
    two_factor_secret text,
    allowed_ips text[] DEFAULT '{}'::text[],
    is_active boolean DEFAULT true,
    last_login_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: suppliers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.suppliers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_id uuid NOT NULL,
    name text NOT NULL,
    contact_name text,
    email text,
    phone text,
    address jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT suppliers_status_check CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text])))
);


--
-- Name: tax_rates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tax_rates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    name text NOT NULL,
    rate numeric(5,4) NOT NULL,
    country text DEFAULT 'IN'::text,
    state text,
    is_compound boolean DEFAULT false,
    is_shipping boolean DEFAULT false,
    priority integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone,
    created_by uuid,
    updated_by uuid,
    version integer DEFAULT 1 NOT NULL
);


--
-- Name: tenant_execution_quotas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_execution_quotas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_id uuid NOT NULL,
    max_concurrent_executions integer DEFAULT 25 NOT NULL,
    max_queued_jobs integer DEFAULT 10000 NOT NULL,
    max_requests_per_minute integer DEFAULT 600 NOT NULL,
    burst_multiplier numeric(8,2) DEFAULT 1 NOT NULL,
    priority_class text DEFAULT 'standard'::text NOT NULL,
    noisy_neighbor_protection boolean DEFAULT true NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT tenant_execution_quotas_priority_class_check CHECK ((priority_class = ANY (ARRAY['standard'::text, 'growth'::text, 'enterprise'::text, 'platform-critical'::text])))
);


--
-- Name: testimonials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.testimonials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid,
    author_name text NOT NULL,
    author_title text,
    author_company text,
    author_avatar text,
    content text NOT NULL,
    rating integer,
    is_featured boolean DEFAULT false,
    display_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone,
    created_by uuid,
    is_visible boolean DEFAULT true,
    CONSTRAINT testimonials_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);


--
-- Name: theme_assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.theme_assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    theme_package_version_id uuid NOT NULL,
    asset_key text NOT NULL,
    asset_type text NOT NULL,
    storage_provider text DEFAULT 'r2'::text NOT NULL,
    storage_path text NOT NULL,
    public_url text,
    content_type text,
    checksum text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT theme_assets_asset_type_check CHECK ((asset_type = ANY (ARRAY['stylesheet'::text, 'script'::text, 'font'::text, 'image'::text, 'media'::text, 'json'::text, 'other'::text])))
);


--
-- Name: theme_block_definitions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.theme_block_definitions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    theme_package_version_id uuid NOT NULL,
    block_key text NOT NULL,
    renderer_key text NOT NULL,
    block_schema jsonb DEFAULT '{}'::jsonb NOT NULL,
    availability_rules jsonb DEFAULT '{}'::jsonb NOT NULL,
    data_requirements jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT theme_block_definitions_status_check CHECK ((status = ANY (ARRAY['active'::text, 'deprecated'::text, 'disabled'::text])))
);


--
-- Name: theme_draft_patches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.theme_draft_patches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    draft_id uuid NOT NULL,
    store_id uuid NOT NULL,
    patch_sequence integer NOT NULL,
    patch_type text NOT NULL,
    operation jsonb DEFAULT '{}'::jsonb NOT NULL,
    path text NOT NULL,
    value jsonb,
    previous_value jsonb,
    actor_id uuid,
    request_id text,
    client_revision integer,
    server_revision integer NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT theme_draft_patches_patch_type_check CHECK ((patch_type = ANY (ARRAY['set'::text, 'unset'::text, 'insert'::text, 'move'::text, 'duplicate'::text, 'delete'::text, 'visibility'::text, 'schema_migration'::text])))
);


--
-- Name: theme_editor_drafts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.theme_editor_drafts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    theme_id text NOT NULL,
    draft_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    auto_saved_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: theme_instance_drafts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.theme_instance_drafts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    theme_instance_id uuid NOT NULL,
    store_id uuid NOT NULL,
    base_release_id uuid,
    draft_status text DEFAULT 'active'::text NOT NULL,
    draft_version integer DEFAULT 1 NOT NULL,
    working_manifest jsonb DEFAULT '{}'::jsonb NOT NULL,
    schema_manifest_version text DEFAULT '1.0.0'::text NOT NULL,
    locked_by uuid,
    locked_at timestamp with time zone,
    auto_saved_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT theme_instance_drafts_draft_status_check CHECK ((draft_status = ANY (ARRAY['active'::text, 'archived'::text, 'published'::text, 'discarded'::text])))
);


--
-- Name: theme_instances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.theme_instances (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    theme_package_id uuid NOT NULL,
    theme_package_version_id uuid NOT NULL,
    active_release_id uuid,
    theme_slug text NOT NULL,
    instance_status text DEFAULT 'installed'::text NOT NULL,
    settings jsonb DEFAULT '{}'::jsonb NOT NULL,
    installed_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    current_draft_id uuid,
    activated_at timestamp with time zone,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT theme_instances_instance_status_check CHECK ((instance_status = ANY (ARRAY['installed'::text, 'active'::text, 'inactive'::text, 'upgrading'::text, 'archived'::text])))
);


--
-- Name: theme_layouts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.theme_layouts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    theme_package_version_id uuid NOT NULL,
    layout_key text NOT NULL,
    name text NOT NULL,
    layout_schema jsonb DEFAULT '{}'::jsonb NOT NULL,
    section_group_keys text[] DEFAULT '{}'::text[] NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: theme_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.theme_migrations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    theme_package_id uuid NOT NULL,
    from_theme_package_version_id uuid,
    to_theme_package_version_id uuid NOT NULL,
    migration_key text NOT NULL,
    migration_manifest jsonb DEFAULT '{}'::jsonb NOT NULL,
    rollback_manifest jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_reversible boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: theme_package_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.theme_package_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    theme_package_id uuid NOT NULL,
    version text NOT NULL,
    version_number integer DEFAULT 1 NOT NULL,
    release_status text DEFAULT 'published'::text NOT NULL,
    renderer_version text DEFAULT '1.0.0'::text NOT NULL,
    schema_version text DEFAULT '1.0.0'::text NOT NULL,
    compatibility_range text,
    package_manifest jsonb DEFAULT '{}'::jsonb NOT NULL,
    checksum text,
    published_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT theme_package_versions_release_status_check CHECK ((release_status = ANY (ARRAY['draft'::text, 'published'::text, 'deprecated'::text, 'revoked'::text])))
);


--
-- Name: theme_packages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.theme_packages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    name text NOT NULL,
    description text,
    author_name text DEFAULT 'LetBuyy'::text NOT NULL,
    site_types text[] DEFAULT ARRAY['store'::text] NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    pricing_type text DEFAULT 'free'::text NOT NULL,
    price numeric(10,2) DEFAULT 0 NOT NULL,
    currency text DEFAULT 'INR'::text NOT NULL,
    marketplace_metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    legacy_theme_id uuid,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT theme_packages_pricing_type_check CHECK ((pricing_type = ANY (ARRAY['free'::text, 'paid'::text, 'subscription'::text]))),
    CONSTRAINT theme_packages_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'active'::text, 'disabled'::text, 'archived'::text])))
);


--
-- Name: theme_presets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.theme_presets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    theme_package_version_id uuid NOT NULL,
    preset_key text NOT NULL,
    name text NOT NULL,
    preset_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    preview_media jsonb DEFAULT '{}'::jsonb NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: theme_preview_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.theme_preview_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    theme_id text NOT NULL,
    draft_id uuid,
    draft_version integer DEFAULT 1 NOT NULL,
    token_hash text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone,
    last_used_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    theme_instance_draft_id uuid
);


--
-- Name: COLUMN theme_preview_sessions.theme_instance_draft_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.theme_preview_sessions.theme_instance_draft_id IS 'Optional pointer to theme_instance_drafts for release-engine previews. Legacy draft_id remains during migration.';


--
-- Name: theme_purchases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.theme_purchases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    theme_id uuid NOT NULL,
    price_paid_usd numeric(10,2) DEFAULT 0,
    price_paid_inr numeric(10,2) DEFAULT 0,
    currency text DEFAULT 'INR'::text,
    payment_id text,
    payment_method text,
    status text DEFAULT 'completed'::text,
    license_key text,
    purchased_at timestamp with time zone DEFAULT now(),
    payment_provider text,
    provider_order_id text,
    provider_payment_id text,
    payment_signature text,
    payment_idempotency_key text,
    payment_processed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT theme_purchases_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'completed'::text, 'refunded'::text, 'failed'::text])))
);


--
-- Name: theme_releases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.theme_releases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    theme_id text NOT NULL,
    release_version integer NOT NULL,
    release_status text DEFAULT 'published'::text NOT NULL,
    is_current boolean DEFAULT false NOT NULL,
    release_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    source_draft_id uuid,
    source_draft_version integer,
    publish_message text,
    published_by uuid,
    published_at timestamp with time zone DEFAULT now() NOT NULL,
    rollback_of_release_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    theme_instance_id uuid,
    theme_package_version_id uuid,
    release_manifest jsonb DEFAULT '{}'::jsonb NOT NULL,
    template_snapshot jsonb DEFAULT '{}'::jsonb NOT NULL,
    settings_snapshot jsonb DEFAULT '{}'::jsonb NOT NULL,
    asset_manifest jsonb DEFAULT '{}'::jsonb NOT NULL,
    cache_manifest jsonb DEFAULT '{}'::jsonb NOT NULL,
    data_binding_manifest jsonb DEFAULT '{}'::jsonb NOT NULL,
    schema_manifest_version text DEFAULT '1.0.0'::text NOT NULL,
    engine_version text DEFAULT 'theme-engine-v1'::text NOT NULL,
    CONSTRAINT theme_releases_release_status_check CHECK ((release_status = ANY (ARRAY['published'::text, 'superseded'::text, 'rolled_back'::text])))
);


--
-- Name: theme_renderer_manifests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.theme_renderer_manifests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    theme_package_version_id uuid NOT NULL,
    renderer_manifest jsonb DEFAULT '{}'::jsonb NOT NULL,
    approved_renderer_keys text[] DEFAULT '{}'::text[] NOT NULL,
    asset_manifest jsonb DEFAULT '{}'::jsonb NOT NULL,
    performance_budget jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: theme_reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.theme_reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    theme_id uuid NOT NULL,
    rating integer NOT NULL,
    title text,
    content text,
    is_verified_purchase boolean DEFAULT false,
    status text DEFAULT 'published'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT theme_reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5))),
    CONSTRAINT theme_reviews_status_check CHECK ((status = ANY (ARRAY['published'::text, 'pending'::text, 'rejected'::text])))
);


--
-- Name: theme_schema_manifests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.theme_schema_manifests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    theme_package_version_id uuid NOT NULL,
    manifest_version text DEFAULT '1.0.0'::text NOT NULL,
    schema_manifest jsonb DEFAULT '{}'::jsonb NOT NULL,
    section_schemas jsonb DEFAULT '{}'::jsonb NOT NULL,
    block_schemas jsonb DEFAULT '{}'::jsonb NOT NULL,
    settings_schema jsonb DEFAULT '{}'::jsonb NOT NULL,
    template_schema jsonb DEFAULT '{}'::jsonb NOT NULL,
    layout_schema jsonb DEFAULT '{}'::jsonb NOT NULL,
    validation_rules jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: theme_section_definitions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.theme_section_definitions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    theme_package_version_id uuid NOT NULL,
    section_key text NOT NULL,
    renderer_key text NOT NULL,
    section_schema jsonb DEFAULT '{}'::jsonb NOT NULL,
    block_schema jsonb DEFAULT '{}'::jsonb NOT NULL,
    presets jsonb DEFAULT '[]'::jsonb NOT NULL,
    availability_rules jsonb DEFAULT '{}'::jsonb NOT NULL,
    data_requirements jsonb DEFAULT '{}'::jsonb NOT NULL,
    performance_budget jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT theme_section_definitions_status_check CHECK ((status = ANY (ARRAY['active'::text, 'deprecated'::text, 'disabled'::text])))
);


--
-- Name: theme_template_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.theme_template_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    theme_instance_id uuid NOT NULL,
    route_type text NOT NULL,
    route_key text NOT NULL,
    template_key text NOT NULL,
    resource_id text,
    market text DEFAULT 'default'::text NOT NULL,
    locale text DEFAULT 'default'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    assigned_release_id uuid,
    priority integer DEFAULT 100 NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: theme_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.theme_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    theme_package_version_id uuid NOT NULL,
    template_key text NOT NULL,
    template_type text NOT NULL,
    layout_key text DEFAULT 'theme'::text NOT NULL,
    template_schema jsonb DEFAULT '{}'::jsonb NOT NULL,
    default_sections jsonb DEFAULT '[]'::jsonb NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: themes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.themes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    site_type text DEFAULT 'store'::text NOT NULL,
    category text,
    description text,
    preview_url text,
    thumbnail_url text,
    is_premium boolean DEFAULT false,
    price numeric(10,2) DEFAULT 0,
    config jsonb DEFAULT '{"fonts": {"body": "Inter", "heading": "Inter"}, "colors": {"text": "#1f2937", "accent": "#f59e0b", "primary": "#6366f1", "secondary": "#8b5cf6", "background": "#ffffff"}, "layout": {"maxWidth": 1280, "footerStyle": "standard", "headerStyle": "sticky"}, "darkMode": false}'::jsonb,
    author text DEFAULT 'LetBuyy'::text,
    version text DEFAULT '1.0'::text,
    is_active boolean DEFAULT true,
    sort_order integer DEFAULT 0,
    install_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    long_description text,
    industry text[] DEFAULT '{}'::text[],
    theme_preset_id text,
    letbuyy_pricing_type text DEFAULT 'free'::text,
    letbuyy_price_usd numeric(10,2) DEFAULT 0,
    letbuyy_price_inr numeric(10,2) DEFAULT 0,
    shopify_price_usd numeric(10,2),
    wordpress_price_usd numeric(10,2),
    screenshots text[] DEFAULT '{}'::text[],
    demo_url text,
    color_presets jsonb DEFAULT '[]'::jsonb,
    font_pairings jsonb DEFAULT '[]'::jsonb,
    features text[] DEFAULT '{}'::text[],
    supported_site_types text[] DEFAULT '{store}'::text[],
    supported_platforms text[] DEFAULT '{letbuyy}'::text[],
    tags text[] DEFAULT '{}'::text[],
    rating_avg numeric(3,2) DEFAULT 0,
    review_count integer DEFAULT 0,
    author_url text,
    author_avatar text,
    author_verified boolean DEFAULT false,
    updated_at timestamp with time zone DEFAULT now(),
    default_template jsonb DEFAULT '{}'::jsonb NOT NULL,
    section_schemas jsonb DEFAULT '{}'::jsonb NOT NULL,
    block_schemas jsonb DEFAULT '{}'::jsonb NOT NULL,
    settings_schema jsonb DEFAULT '{}'::jsonb NOT NULL,
    renderer_manifest jsonb DEFAULT '{}'::jsonb NOT NULL,
    schema_version text DEFAULT '1.0.0'::text NOT NULL,
    renderer_version text DEFAULT '1.0.0'::text NOT NULL,
    CONSTRAINT themes_letbuyy_pricing_type_check CHECK ((letbuyy_pricing_type = ANY (ARRAY['free'::text, 'one_time'::text, 'subscription'::text])))
);


--
-- Name: usage_meter_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usage_meter_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_id uuid NOT NULL,
    meter_id uuid NOT NULL,
    meter_name text NOT NULL,
    idempotency_key text NOT NULL,
    amount numeric(16,4) NOT NULL,
    source text DEFAULT 'api'::text NOT NULL,
    resource_type text,
    resource_id text,
    request_id text,
    trace_id text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT usage_meter_entries_amount_check CHECK ((amount <> (0)::numeric))
);


--
-- Name: user_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_profiles (
    id uuid NOT NULL,
    email text NOT NULL,
    full_name text,
    phone text,
    avatar_url text,
    subscription_tier text DEFAULT 'free'::text,
    stripe_customer_id text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT user_profiles_subscription_tier_check CHECK ((subscription_tier = ANY (ARRAY['free'::text, 'starter'::text, 'business'::text, 'enterprise'::text])))
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    display_name text,
    avatar_url text,
    subscription_tier text DEFAULT 'free'::text,
    subscription_expires_at timestamp with time zone,
    saved_accounts jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone,
    updated_by uuid,
    version integer DEFAULT 1 NOT NULL,
    CONSTRAINT users_subscription_tier_check CHECK ((subscription_tier = ANY (ARRAY['free'::text, 'starter'::text, 'business'::text, 'enterprise'::text])))
);


--
-- Name: users_custom; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users_custom (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    email_verified boolean DEFAULT false,
    password_hash text,
    full_name text,
    avatar_url text,
    auth_provider text DEFAULT 'email'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: verification_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.verification_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    email text NOT NULL,
    token text NOT NULL,
    type text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT verification_tokens_type_check CHECK ((type = ANY (ARRAY['email_verify'::text, 'magic_link'::text, 'password_reset'::text])))
);


--
-- Name: webhook_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.webhook_subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_id uuid NOT NULL,
    name text NOT NULL,
    target_url text NOT NULL,
    event_types text[] DEFAULT ARRAY['*'::text] NOT NULL,
    signing_secret text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    failure_count integer DEFAULT 0 NOT NULL,
    last_success_at timestamp with time zone,
    last_failure_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT webhook_subscriptions_status_check CHECK ((status = ANY (ARRAY['active'::text, 'paused'::text, 'disabled'::text])))
);


--
-- Name: wishlists; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wishlists (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    customer_email text NOT NULL,
    product_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: work_experience; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.work_experience (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid,
    company text NOT NULL,
    "position" text NOT NULL,
    location text,
    company_logo text,
    start_date date NOT NULL,
    end_date date,
    is_current boolean DEFAULT false,
    responsibilities text[] DEFAULT '{}'::text[],
    achievements text[] DEFAULT '{}'::text[],
    display_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone,
    created_by uuid,
    role text,
    description text
);


--
-- Name: worker_request_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.worker_request_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_id uuid,
    request_id text NOT NULL,
    trace_id text,
    method text NOT NULL,
    path text NOT NULL,
    route text,
    status_code integer NOT NULL,
    latency_ms integer NOT NULL,
    user_id uuid,
    auth_source text,
    ip_address text,
    user_agent text,
    error_code text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: workflow_heartbeats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workflow_heartbeats (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    execution_id text NOT NULL,
    workflow_name text NOT NULL,
    current_step text,
    owner_id text NOT NULL,
    heartbeat_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    request_id text,
    correlation_id text NOT NULL,
    trace_id text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: workflow_lifecycle; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workflow_lifecycle (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    execution_id text NOT NULL,
    workflow_name text NOT NULL,
    workflow_version text NOT NULL,
    site_id uuid,
    status text NOT NULL,
    current_step text,
    attempt integer DEFAULT 0 NOT NULL,
    state jsonb DEFAULT '{}'::jsonb NOT NULL,
    lease_id text,
    fencing_token text,
    timeout_at timestamp with time zone,
    recovery_decision jsonb,
    request_id text,
    correlation_id text NOT NULL,
    trace_id text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT workflow_lifecycle_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'running'::text, 'waiting'::text, 'completed'::text, 'failed'::text, 'compensating'::text, 'compensated'::text, 'timed-out'::text, 'dead-lettered'::text])))
);


--
-- Name: workflow_operation_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workflow_operation_snapshots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workflow_name text NOT NULL,
    site_id uuid,
    running integer DEFAULT 0 NOT NULL,
    waiting integer DEFAULT 0 NOT NULL,
    failed integer DEFAULT 0 NOT NULL,
    timed_out integer DEFAULT 0 NOT NULL,
    dead_lettered integer DEFAULT 0 NOT NULL,
    oldest_updated_at timestamp with time zone,
    sampled_at timestamp with time zone DEFAULT now() NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: distributed_event_store global_position; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.distributed_event_store ALTER COLUMN global_position SET DEFAULT nextval('public.distributed_event_store_global_position_seq'::regclass);


--
-- Name: ai_credits ai_credits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_credits
    ADD CONSTRAINT ai_credits_pkey PRIMARY KEY (id);


--
-- Name: ai_credits ai_credits_store_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_credits
    ADD CONSTRAINT ai_credits_store_id_key UNIQUE (store_id);


--
-- Name: ai_usage ai_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_usage
    ADD CONSTRAINT ai_usage_pkey PRIMARY KEY (id);


--
-- Name: analytics_event_stream analytics_event_stream_event_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_event_stream
    ADD CONSTRAINT analytics_event_stream_event_id_key UNIQUE (event_id);


--
-- Name: analytics_event_stream analytics_event_stream_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_event_stream
    ADD CONSTRAINT analytics_event_stream_pkey PRIMARY KEY (id);


--
-- Name: analytics_events analytics_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_events
    ADD CONSTRAINT analytics_events_pkey PRIMARY KEY (id);


--
-- Name: analytics_rollups_daily analytics_rollups_daily_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_rollups_daily
    ADD CONSTRAINT analytics_rollups_daily_pkey PRIMARY KEY (id);


--
-- Name: analytics_rollups_daily analytics_rollups_daily_site_id_metric_name_rollup_date_dim_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_rollups_daily
    ADD CONSTRAINT analytics_rollups_daily_site_id_metric_name_rollup_date_dim_key UNIQUE (site_id, metric_name, rollup_date, dimensions);


--
-- Name: app_billing_charges app_billing_charges_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_billing_charges
    ADD CONSTRAINT app_billing_charges_pkey PRIMARY KEY (id);


--
-- Name: app_billing_charges app_billing_charges_site_id_idempotency_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_billing_charges
    ADD CONSTRAINT app_billing_charges_site_id_idempotency_key_key UNIQUE (site_id, idempotency_key);


--
-- Name: app_categories app_categories_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_categories
    ADD CONSTRAINT app_categories_name_key UNIQUE (name);


--
-- Name: app_categories app_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_categories
    ADD CONSTRAINT app_categories_pkey PRIMARY KEY (id);


--
-- Name: app_categories app_categories_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_categories
    ADD CONSTRAINT app_categories_slug_key UNIQUE (slug);


--
-- Name: app_developers app_developers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_developers
    ADD CONSTRAINT app_developers_pkey PRIMARY KEY (id);


--
-- Name: app_developers app_developers_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_developers
    ADD CONSTRAINT app_developers_slug_key UNIQUE (slug);


--
-- Name: app_developers app_developers_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_developers
    ADD CONSTRAINT app_developers_user_id_key UNIQUE (user_id);


--
-- Name: app_extensions app_extensions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_extensions
    ADD CONSTRAINT app_extensions_pkey PRIMARY KEY (id);


--
-- Name: app_installations app_installations_app_id_store_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_installations
    ADD CONSTRAINT app_installations_app_id_store_id_key UNIQUE (app_id, store_id);


--
-- Name: app_installations app_installations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_installations
    ADD CONSTRAINT app_installations_pkey PRIMARY KEY (id);


--
-- Name: app_reviews app_reviews_app_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_reviews
    ADD CONSTRAINT app_reviews_app_id_user_id_key UNIQUE (app_id, user_id);


--
-- Name: app_reviews app_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_reviews
    ADD CONSTRAINT app_reviews_pkey PRIMARY KEY (id);


--
-- Name: app_webhooks app_webhooks_app_id_event_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_webhooks
    ADD CONSTRAINT app_webhooks_app_id_event_key UNIQUE (app_id, event);


--
-- Name: app_webhooks app_webhooks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_webhooks
    ADD CONSTRAINT app_webhooks_pkey PRIMARY KEY (id);


--
-- Name: audit_activity_events audit_activity_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_activity_events
    ADD CONSTRAINT audit_activity_events_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: billing_history billing_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_history
    ADD CONSTRAINT billing_history_pkey PRIMARY KEY (id);


--
-- Name: blog_categories blog_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blog_categories
    ADD CONSTRAINT blog_categories_pkey PRIMARY KEY (id);


--
-- Name: blog_categories blog_categories_store_id_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blog_categories
    ADD CONSTRAINT blog_categories_store_id_slug_key UNIQUE (store_id, slug);


--
-- Name: blog_comments blog_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blog_comments
    ADD CONSTRAINT blog_comments_pkey PRIMARY KEY (id);


--
-- Name: blog_post_tags blog_post_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blog_post_tags
    ADD CONSTRAINT blog_post_tags_pkey PRIMARY KEY (post_id, tag_id);


--
-- Name: blog_posts blog_posts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blog_posts
    ADD CONSTRAINT blog_posts_pkey PRIMARY KEY (id);


--
-- Name: blog_posts blog_posts_store_id_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blog_posts
    ADD CONSTRAINT blog_posts_store_id_slug_key UNIQUE (store_id, slug);


--
-- Name: blog_tags blog_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blog_tags
    ADD CONSTRAINT blog_tags_pkey PRIMARY KEY (id);


--
-- Name: blog_tags blog_tags_store_id_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blog_tags
    ADD CONSTRAINT blog_tags_store_id_slug_key UNIQUE (store_id, slug);


--
-- Name: cache_invalidation_events cache_invalidation_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cache_invalidation_events
    ADD CONSTRAINT cache_invalidation_events_pkey PRIMARY KEY (id);


--
-- Name: cache_operation_snapshots cache_operation_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cache_operation_snapshots
    ADD CONSTRAINT cache_operation_snapshots_pkey PRIMARY KEY (id);


--
-- Name: carts carts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carts
    ADD CONSTRAINT carts_pkey PRIMARY KEY (id);


--
-- Name: certifications certifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.certifications
    ADD CONSTRAINT certifications_pkey PRIMARY KEY (id);


--
-- Name: chaos_experiment_runs chaos_experiment_runs_experiment_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chaos_experiment_runs
    ADD CONSTRAINT chaos_experiment_runs_experiment_id_key UNIQUE (experiment_id);


--
-- Name: chaos_experiment_runs chaos_experiment_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chaos_experiment_runs
    ADD CONSTRAINT chaos_experiment_runs_pkey PRIMARY KEY (id);


--
-- Name: checkout_sessions checkout_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkout_sessions
    ADD CONSTRAINT checkout_sessions_pkey PRIMARY KEY (id);


--
-- Name: checkout_sessions checkout_sessions_site_id_idempotency_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkout_sessions
    ADD CONSTRAINT checkout_sessions_site_id_idempotency_key_key UNIQUE (site_id, idempotency_key);


--
-- Name: collection_products collection_products_collection_id_product_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_products
    ADD CONSTRAINT collection_products_collection_id_product_id_key UNIQUE (collection_id, product_id);


--
-- Name: collection_products collection_products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_products
    ADD CONSTRAINT collection_products_pkey PRIMARY KEY (id);


--
-- Name: collections collections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collections
    ADD CONSTRAINT collections_pkey PRIMARY KEY (id);


--
-- Name: contacts contacts_compat_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_compat_pkey PRIMARY KEY (id);


--
-- Name: contact_submissions contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_submissions
    ADD CONSTRAINT contacts_pkey PRIMARY KEY (id);


--
-- Name: coordination_operation_diagnostics coordination_operation_diagnostics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coordination_operation_diagnostics
    ADD CONSTRAINT coordination_operation_diagnostics_pkey PRIMARY KEY (id);


--
-- Name: coupons coupons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupons
    ADD CONSTRAINT coupons_pkey PRIMARY KEY (id);


--
-- Name: coupons coupons_site_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupons
    ADD CONSTRAINT coupons_site_id_code_key UNIQUE (store_id, code);


--
-- Name: customer_activity_log customer_activity_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_activity_log
    ADD CONSTRAINT customer_activity_log_pkey PRIMARY KEY (id);


--
-- Name: customer_addresses customer_addresses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_addresses
    ADD CONSTRAINT customer_addresses_pkey PRIMARY KEY (id);


--
-- Name: customer_credentials customer_credentials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_credentials
    ADD CONSTRAINT customer_credentials_pkey PRIMARY KEY (id);


--
-- Name: customer_credentials customer_credentials_store_id_email_or_phone_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_credentials
    ADD CONSTRAINT customer_credentials_store_id_email_or_phone_key UNIQUE (store_id, email_or_phone);


--
-- Name: customer_wishlists customer_wishlists_customer_id_product_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_wishlists
    ADD CONSTRAINT customer_wishlists_customer_id_product_id_key UNIQUE (customer_id, product_id);


--
-- Name: customer_wishlists customer_wishlists_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_wishlists
    ADD CONSTRAINT customer_wishlists_pkey PRIMARY KEY (id);


--
-- Name: database_operation_snapshots database_operation_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.database_operation_snapshots
    ADD CONSTRAINT database_operation_snapshots_pkey PRIMARY KEY (id);


--
-- Name: database_operation_snapshots database_operation_snapshots_snapshot_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.database_operation_snapshots
    ADD CONSTRAINT database_operation_snapshots_snapshot_id_key UNIQUE (snapshot_id);


--
-- Name: deployment_health_gate_results deployment_health_gate_results_gate_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deployment_health_gate_results
    ADD CONSTRAINT deployment_health_gate_results_gate_id_key UNIQUE (gate_id);


--
-- Name: deployment_health_gate_results deployment_health_gate_results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deployment_health_gate_results
    ADD CONSTRAINT deployment_health_gate_results_pkey PRIMARY KEY (id);


--
-- Name: deployment_promotion_runs deployment_promotion_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deployment_promotion_runs
    ADD CONSTRAINT deployment_promotion_runs_pkey PRIMARY KEY (id);


--
-- Name: deployment_promotion_runs deployment_promotion_runs_promotion_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deployment_promotion_runs
    ADD CONSTRAINT deployment_promotion_runs_promotion_id_key UNIQUE (promotion_id);


--
-- Name: device_tokens device_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_tokens
    ADD CONSTRAINT device_tokens_pkey PRIMARY KEY (id);


--
-- Name: device_tokens device_tokens_user_id_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_tokens
    ADD CONSTRAINT device_tokens_user_id_token_key UNIQUE (user_id, token);


--
-- Name: devices devices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devices
    ADD CONSTRAINT devices_pkey PRIMARY KEY (id);


--
-- Name: devices devices_user_id_fingerprint_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devices
    ADD CONSTRAINT devices_user_id_fingerprint_key UNIQUE (user_id, fingerprint);


--
-- Name: distributed_event_store distributed_event_store_event_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.distributed_event_store
    ADD CONSTRAINT distributed_event_store_event_id_key UNIQUE (event_id);


--
-- Name: distributed_event_store distributed_event_store_global_position_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.distributed_event_store
    ADD CONSTRAINT distributed_event_store_global_position_key UNIQUE (global_position);


--
-- Name: distributed_event_store distributed_event_store_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.distributed_event_store
    ADD CONSTRAINT distributed_event_store_pkey PRIMARY KEY (id);


--
-- Name: distributed_event_store distributed_event_store_stream_name_idempotency_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.distributed_event_store
    ADD CONSTRAINT distributed_event_store_stream_name_idempotency_key_key UNIQUE (stream_name, idempotency_key);


--
-- Name: distributed_event_store distributed_event_store_stream_name_stream_position_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.distributed_event_store
    ADD CONSTRAINT distributed_event_store_stream_name_stream_position_key UNIQUE (stream_name, stream_position);


--
-- Name: distributed_event_streams distributed_event_streams_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.distributed_event_streams
    ADD CONSTRAINT distributed_event_streams_pkey PRIMARY KEY (id);


--
-- Name: distributed_event_streams distributed_event_streams_stream_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.distributed_event_streams
    ADD CONSTRAINT distributed_event_streams_stream_name_key UNIQUE (stream_name);


--
-- Name: distributed_queue_heartbeats distributed_queue_heartbeats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.distributed_queue_heartbeats
    ADD CONSTRAINT distributed_queue_heartbeats_pkey PRIMARY KEY (id);


--
-- Name: distributed_queue_messages distributed_queue_messages_message_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.distributed_queue_messages
    ADD CONSTRAINT distributed_queue_messages_message_id_key UNIQUE (message_id);


--
-- Name: distributed_queue_messages distributed_queue_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.distributed_queue_messages
    ADD CONSTRAINT distributed_queue_messages_pkey PRIMARY KEY (id);


--
-- Name: distributed_queue_messages distributed_queue_messages_queue_name_idempotency_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.distributed_queue_messages
    ADD CONSTRAINT distributed_queue_messages_queue_name_idempotency_key_key UNIQUE (queue_name, idempotency_key);


--
-- Name: education education_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.education
    ADD CONSTRAINT education_pkey PRIMARY KEY (id);


--
-- Name: email_logs email_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_logs
    ADD CONSTRAINT email_logs_pkey PRIMARY KEY (id);


--
-- Name: employee_invites employee_invites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_invites
    ADD CONSTRAINT employee_invites_pkey PRIMARY KEY (id);


--
-- Name: employee_invites employee_invites_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_invites
    ADD CONSTRAINT employee_invites_token_key UNIQUE (token);


--
-- Name: employee_permissions employee_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_permissions
    ADD CONSTRAINT employee_permissions_pkey PRIMARY KEY (id);


--
-- Name: employee_permissions employee_permissions_role_permission_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_permissions
    ADD CONSTRAINT employee_permissions_role_permission_key UNIQUE (role, permission);


--
-- Name: employee_roles employee_roles_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_roles
    ADD CONSTRAINT employee_roles_name_key UNIQUE (name);


--
-- Name: employee_roles employee_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_roles
    ADD CONSTRAINT employee_roles_pkey PRIMARY KEY (id);


--
-- Name: employees employees_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_email_key UNIQUE (email);


--
-- Name: employees employees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_pkey PRIMARY KEY (id);


--
-- Name: event_store_integrity_checks event_store_integrity_checks_check_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_store_integrity_checks
    ADD CONSTRAINT event_store_integrity_checks_check_id_key UNIQUE (check_id);


--
-- Name: event_store_integrity_checks event_store_integrity_checks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_store_integrity_checks
    ADD CONSTRAINT event_store_integrity_checks_pkey PRIMARY KEY (id);


--
-- Name: event_stream_snapshots event_stream_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_stream_snapshots
    ADD CONSTRAINT event_stream_snapshots_pkey PRIMARY KEY (id);


--
-- Name: event_stream_snapshots event_stream_snapshots_stream_name_snapshot_version_stream__key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_stream_snapshots
    ADD CONSTRAINT event_stream_snapshots_stream_name_snapshot_version_stream__key UNIQUE (stream_name, snapshot_version, stream_position);


--
-- Name: execution_audit_trail execution_audit_trail_audit_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.execution_audit_trail
    ADD CONSTRAINT execution_audit_trail_audit_id_key UNIQUE (audit_id);


--
-- Name: execution_audit_trail execution_audit_trail_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.execution_audit_trail
    ADD CONSTRAINT execution_audit_trail_pkey PRIMARY KEY (id);


--
-- Name: failover_drill_runs failover_drill_runs_drill_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.failover_drill_runs
    ADD CONSTRAINT failover_drill_runs_drill_id_key UNIQUE (drill_id);


--
-- Name: failover_drill_runs failover_drill_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.failover_drill_runs
    ADD CONSTRAINT failover_drill_runs_pkey PRIMARY KEY (id);


--
-- Name: form_submissions form_submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_submissions
    ADD CONSTRAINT form_submissions_pkey PRIMARY KEY (id);


--
-- Name: fulfillment_order_lines fulfillment_order_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fulfillment_order_lines
    ADD CONSTRAINT fulfillment_order_lines_pkey PRIMARY KEY (id);


--
-- Name: fulfillment_orders fulfillment_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fulfillment_orders
    ADD CONSTRAINT fulfillment_orders_pkey PRIMARY KEY (id);


--
-- Name: fulfillment_orders fulfillment_orders_site_id_idempotency_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fulfillment_orders
    ADD CONSTRAINT fulfillment_orders_site_id_idempotency_key_key UNIQUE (site_id, idempotency_key);


--
-- Name: gallery_items gallery_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gallery_items
    ADD CONSTRAINT gallery_items_pkey PRIMARY KEY (id);


--
-- Name: gift_card_accounts gift_card_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gift_card_accounts
    ADD CONSTRAINT gift_card_accounts_pkey PRIMARY KEY (id);


--
-- Name: gift_card_accounts gift_card_accounts_site_id_code_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gift_card_accounts
    ADD CONSTRAINT gift_card_accounts_site_id_code_hash_key UNIQUE (site_id, code_hash);


--
-- Name: gift_card_ledger_entries gift_card_ledger_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gift_card_ledger_entries
    ADD CONSTRAINT gift_card_ledger_entries_pkey PRIMARY KEY (id);


--
-- Name: gift_card_ledger_entries gift_card_ledger_entries_site_id_idempotency_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gift_card_ledger_entries
    ADD CONSTRAINT gift_card_ledger_entries_site_id_idempotency_key_key UNIQUE (site_id, idempotency_key);


--
-- Name: gift_card_redemptions gift_card_redemptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gift_card_redemptions
    ADD CONSTRAINT gift_card_redemptions_pkey PRIMARY KEY (id);


--
-- Name: gift_card_redemptions gift_card_redemptions_site_id_idempotency_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gift_card_redemptions
    ADD CONSTRAINT gift_card_redemptions_site_id_idempotency_key_key UNIQUE (site_id, idempotency_key);


--
-- Name: gift_cards gift_cards_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gift_cards
    ADD CONSTRAINT gift_cards_code_key UNIQUE (code);


--
-- Name: gift_cards gift_cards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gift_cards
    ADD CONSTRAINT gift_cards_pkey PRIMARY KEY (id);


--
-- Name: idempotency_keys idempotency_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.idempotency_keys
    ADD CONSTRAINT idempotency_keys_pkey PRIMARY KEY (id);


--
-- Name: idempotency_keys idempotency_keys_site_id_scope_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.idempotency_keys
    ADD CONSTRAINT idempotency_keys_site_id_scope_key_key UNIQUE (site_id, scope, key);


--
-- Name: inventory_adjustments inventory_adjustments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_adjustments
    ADD CONSTRAINT inventory_adjustments_pkey PRIMARY KEY (id);


--
-- Name: inventory_events inventory_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_events
    ADD CONSTRAINT inventory_events_pkey PRIMARY KEY (id);


--
-- Name: inventory_events inventory_events_site_id_idempotency_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_events
    ADD CONSTRAINT inventory_events_site_id_idempotency_key_key UNIQUE (site_id, idempotency_key);


--
-- Name: inventory_level_duplicate_snapshots inventory_level_duplicate_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_level_duplicate_snapshots
    ADD CONSTRAINT inventory_level_duplicate_snapshots_pkey PRIMARY KEY (id);


--
-- Name: inventory_levels inventory_levels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_levels
    ADD CONSTRAINT inventory_levels_pkey PRIMARY KEY (id);


--
-- Name: inventory_levels inventory_levels_product_id_variant_id_location_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_levels
    ADD CONSTRAINT inventory_levels_product_id_variant_id_location_id_key UNIQUE (product_id, variant_id, location_id);


--
-- Name: inventory_locations inventory_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_locations
    ADD CONSTRAINT inventory_locations_pkey PRIMARY KEY (id);


--
-- Name: inventory_reservations inventory_reservations_idempotency_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_reservations
    ADD CONSTRAINT inventory_reservations_idempotency_key_key UNIQUE (idempotency_key);


--
-- Name: inventory_reservations inventory_reservations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_reservations
    ADD CONSTRAINT inventory_reservations_pkey PRIMARY KEY (id);


--
-- Name: inventory_transfer_lines inventory_transfer_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_transfer_lines
    ADD CONSTRAINT inventory_transfer_lines_pkey PRIMARY KEY (id);


--
-- Name: inventory_transfer_receipts inventory_transfer_receipts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_transfer_receipts
    ADD CONSTRAINT inventory_transfer_receipts_pkey PRIMARY KEY (id);


--
-- Name: inventory_transfer_receipts inventory_transfer_receipts_site_id_idempotency_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_transfer_receipts
    ADD CONSTRAINT inventory_transfer_receipts_site_id_idempotency_key_key UNIQUE (site_id, idempotency_key);


--
-- Name: inventory_transfers inventory_transfers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_transfers
    ADD CONSTRAINT inventory_transfers_pkey PRIMARY KEY (id);


--
-- Name: inventory_transfers inventory_transfers_site_id_idempotency_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_transfers
    ADD CONSTRAINT inventory_transfers_site_id_idempotency_key_key UNIQUE (site_id, idempotency_key);


--
-- Name: inventory_transfers inventory_transfers_site_id_transfer_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_transfers
    ADD CONSTRAINT inventory_transfers_site_id_transfer_number_key UNIQUE (site_id, transfer_number);


--
-- Name: lead_forms lead_forms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_forms
    ADD CONSTRAINT lead_forms_pkey PRIMARY KEY (id);


--
-- Name: leads leads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_pkey PRIMARY KEY (id);


--
-- Name: load_test_runs load_test_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.load_test_runs
    ADD CONSTRAINT load_test_runs_pkey PRIMARY KEY (id);


--
-- Name: load_test_runs load_test_runs_run_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.load_test_runs
    ADD CONSTRAINT load_test_runs_run_id_key UNIQUE (run_id);


--
-- Name: marketplace_apps marketplace_apps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketplace_apps
    ADD CONSTRAINT marketplace_apps_pkey PRIMARY KEY (id);


--
-- Name: marketplace_apps marketplace_apps_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketplace_apps
    ADD CONSTRAINT marketplace_apps_slug_key UNIQUE (slug);


--
-- Name: marketplace_review_records marketplace_review_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketplace_review_records
    ADD CONSTRAINT marketplace_review_records_pkey PRIMARY KEY (id);


--
-- Name: marketplace_review_records marketplace_review_records_submission_type_resource_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketplace_review_records
    ADD CONSTRAINT marketplace_review_records_submission_type_resource_id_key UNIQUE (submission_type, resource_id);


--
-- Name: media_assets media_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_assets
    ADD CONSTRAINT media_assets_pkey PRIMARY KEY (id);


--
-- Name: media media_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media
    ADD CONSTRAINT media_pkey PRIMARY KEY (id);


--
-- Name: navigation_menu_items navigation_menu_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.navigation_menu_items
    ADD CONSTRAINT navigation_menu_items_pkey PRIMARY KEY (id);


--
-- Name: navigation_menus navigation_menus_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.navigation_menus
    ADD CONSTRAINT navigation_menus_pkey PRIMARY KEY (id);


--
-- Name: navigation_menus navigation_menus_store_id_handle_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.navigation_menus
    ADD CONSTRAINT navigation_menus_store_id_handle_key UNIQUE (store_id, handle);


--
-- Name: notification_preferences notification_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: onboarding_attempts onboarding_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.onboarding_attempts
    ADD CONSTRAINT onboarding_attempts_pkey PRIMARY KEY (id);


--
-- Name: operation_metrics operation_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operation_metrics
    ADD CONSTRAINT operation_metrics_pkey PRIMARY KEY (id);


--
-- Name: operational_certification_reports operational_certification_reports_certification_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operational_certification_reports
    ADD CONSTRAINT operational_certification_reports_certification_id_key UNIQUE (certification_id);


--
-- Name: operational_certification_reports operational_certification_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operational_certification_reports
    ADD CONSTRAINT operational_certification_reports_pkey PRIMARY KEY (id);


--
-- Name: operational_dashboard_snapshots operational_dashboard_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operational_dashboard_snapshots
    ADD CONSTRAINT operational_dashboard_snapshots_pkey PRIMARY KEY (id);


--
-- Name: operational_dashboard_snapshots operational_dashboard_snapshots_snapshot_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operational_dashboard_snapshots
    ADD CONSTRAINT operational_dashboard_snapshots_snapshot_id_key UNIQUE (snapshot_id);


--
-- Name: operational_feature_flag_audit_events operational_feature_flag_audit_events_event_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operational_feature_flag_audit_events
    ADD CONSTRAINT operational_feature_flag_audit_events_event_id_key UNIQUE (event_id);


--
-- Name: operational_feature_flag_audit_events operational_feature_flag_audit_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operational_feature_flag_audit_events
    ADD CONSTRAINT operational_feature_flag_audit_events_pkey PRIMARY KEY (id);


--
-- Name: operational_feature_flag_exposures operational_feature_flag_exposures_exposure_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operational_feature_flag_exposures
    ADD CONSTRAINT operational_feature_flag_exposures_exposure_id_key UNIQUE (exposure_id);


--
-- Name: operational_feature_flag_exposures operational_feature_flag_exposures_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operational_feature_flag_exposures
    ADD CONSTRAINT operational_feature_flag_exposures_pkey PRIMARY KEY (id);


--
-- Name: operational_feature_flags operational_feature_flags_environment_flag_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operational_feature_flags
    ADD CONSTRAINT operational_feature_flags_environment_flag_key_key UNIQUE (environment, flag_key);


--
-- Name: operational_feature_flags operational_feature_flags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operational_feature_flags
    ADD CONSTRAINT operational_feature_flags_pkey PRIMARY KEY (id);


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- Name: order_line_adjustments order_line_adjustments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_line_adjustments
    ADD CONSTRAINT order_line_adjustments_pkey PRIMARY KEY (id);


--
-- Name: order_shipping_lines order_shipping_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_shipping_lines
    ADD CONSTRAINT order_shipping_lines_pkey PRIMARY KEY (id);


--
-- Name: order_tax_lines order_tax_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_tax_lines
    ADD CONSTRAINT order_tax_lines_pkey PRIMARY KEY (id);


--
-- Name: orders orders_order_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_order_number_key UNIQUE (order_number);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: outbox_dead_letters outbox_dead_letters_outbox_event_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outbox_dead_letters
    ADD CONSTRAINT outbox_dead_letters_outbox_event_id_key UNIQUE (outbox_event_id);


--
-- Name: outbox_dead_letters outbox_dead_letters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outbox_dead_letters
    ADD CONSTRAINT outbox_dead_letters_pkey PRIMARY KEY (id);


--
-- Name: outbox_events outbox_events_idempotency_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outbox_events
    ADD CONSTRAINT outbox_events_idempotency_key_key UNIQUE (idempotency_key);


--
-- Name: outbox_events outbox_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outbox_events
    ADD CONSTRAINT outbox_events_pkey PRIMARY KEY (id);


--
-- Name: pages pages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pages
    ADD CONSTRAINT pages_pkey PRIMARY KEY (id);


--
-- Name: pages pages_site_id_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pages
    ADD CONSTRAINT pages_site_id_slug_key UNIQUE (store_id, slug);


--
-- Name: partner_payout_ledger_entries partner_payout_ledger_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partner_payout_ledger_entries
    ADD CONSTRAINT partner_payout_ledger_entries_pkey PRIMARY KEY (id);


--
-- Name: partner_payout_ledger_entries partner_payout_ledger_entries_source_event_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partner_payout_ledger_entries
    ADD CONSTRAINT partner_payout_ledger_entries_source_event_id_key UNIQUE (source_event_id);


--
-- Name: payment_attempts payment_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_attempts
    ADD CONSTRAINT payment_attempts_pkey PRIMARY KEY (id);


--
-- Name: payment_transactions payment_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_transactions
    ADD CONSTRAINT payment_transactions_pkey PRIMARY KEY (id);


--
-- Name: payment_webhook_events payment_webhook_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_webhook_events
    ADD CONSTRAINT payment_webhook_events_pkey PRIMARY KEY (id);


--
-- Name: payment_webhook_events payment_webhook_events_provider_provider_event_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_webhook_events
    ADD CONSTRAINT payment_webhook_events_provider_provider_event_id_key UNIQUE (provider, provider_event_id);


--
-- Name: plan_entitlements plan_entitlements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_entitlements
    ADD CONSTRAINT plan_entitlements_pkey PRIMARY KEY (id);


--
-- Name: plan_entitlements plan_entitlements_site_type_plan_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_entitlements
    ADD CONSTRAINT plan_entitlements_site_type_plan_slug_key UNIQUE (site_type, plan_slug);


--
-- Name: plans plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plans
    ADD CONSTRAINT plans_pkey PRIMARY KEY (id);


--
-- Name: plans plans_site_type_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plans
    ADD CONSTRAINT plans_site_type_slug_key UNIQUE (site_type, slug);


--
-- Name: platform_queue_jobs platform_queue_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_queue_jobs
    ADD CONSTRAINT platform_queue_jobs_pkey PRIMARY KEY (id);


--
-- Name: platform_queue_jobs platform_queue_jobs_queue_name_idempotency_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_queue_jobs
    ADD CONSTRAINT platform_queue_jobs_queue_name_idempotency_key_key UNIQUE (queue_name, idempotency_key);


--
-- Name: product_options product_options_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_options
    ADD CONSTRAINT product_options_pkey PRIMARY KEY (id);


--
-- Name: product_reviews product_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_reviews
    ADD CONSTRAINT product_reviews_pkey PRIMARY KEY (id);


--
-- Name: product_variants product_variants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_variants
    ADD CONSTRAINT product_variants_pkey PRIMARY KEY (id);


--
-- Name: production_db_rollout_plans production_db_rollout_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_db_rollout_plans
    ADD CONSTRAINT production_db_rollout_plans_pkey PRIMARY KEY (id);


--
-- Name: production_db_rollout_plans production_db_rollout_plans_rollout_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_db_rollout_plans
    ADD CONSTRAINT production_db_rollout_plans_rollout_id_key UNIQUE (rollout_id);


--
-- Name: production_incident_events production_incident_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_incident_events
    ADD CONSTRAINT production_incident_events_pkey PRIMARY KEY (id);


--
-- Name: production_incidents production_incidents_incident_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_incidents
    ADD CONSTRAINT production_incidents_incident_id_key UNIQUE (incident_id);


--
-- Name: production_incidents production_incidents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_incidents
    ADD CONSTRAINT production_incidents_pkey PRIMARY KEY (id);


--
-- Name: production_readiness_gate_runs production_readiness_gate_runs_gate_run_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_readiness_gate_runs
    ADD CONSTRAINT production_readiness_gate_runs_gate_run_id_key UNIQUE (gate_run_id);


--
-- Name: production_readiness_gate_runs production_readiness_gate_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_readiness_gate_runs
    ADD CONSTRAINT production_readiness_gate_runs_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: projection_checkpoints projection_checkpoints_checkpoint_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projection_checkpoints
    ADD CONSTRAINT projection_checkpoints_checkpoint_id_key UNIQUE (checkpoint_id);


--
-- Name: projection_checkpoints projection_checkpoints_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projection_checkpoints
    ADD CONSTRAINT projection_checkpoints_pkey PRIMARY KEY (id);


--
-- Name: projection_operation_snapshots projection_operation_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projection_operation_snapshots
    ADD CONSTRAINT projection_operation_snapshots_pkey PRIMARY KEY (id);


--
-- Name: projection_rebuilds projection_rebuilds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projection_rebuilds
    ADD CONSTRAINT projection_rebuilds_pkey PRIMARY KEY (id);


--
-- Name: projection_rebuilds projection_rebuilds_rebuild_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projection_rebuilds
    ADD CONSTRAINT projection_rebuilds_rebuild_id_key UNIQUE (rebuild_id);


--
-- Name: projection_store projection_store_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projection_store
    ADD CONSTRAINT projection_store_pkey PRIMARY KEY (id);


--
-- Name: projection_store projection_store_projection_name_projection_version_site_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projection_store
    ADD CONSTRAINT projection_store_projection_name_projection_version_site_id_key UNIQUE (projection_name, projection_version, site_id, object_type, object_id);


--
-- Name: projects projects_compat_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_compat_pkey PRIMARY KEY (id);


--
-- Name: portfolio_projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portfolio_projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: promotion_codes promotion_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion_codes
    ADD CONSTRAINT promotion_codes_pkey PRIMARY KEY (id);


--
-- Name: promotion_codes promotion_codes_site_id_code_normalized_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion_codes
    ADD CONSTRAINT promotion_codes_site_id_code_normalized_key UNIQUE (site_id, code_normalized);


--
-- Name: promotion_effects promotion_effects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion_effects
    ADD CONSTRAINT promotion_effects_pkey PRIMARY KEY (id);


--
-- Name: promotion_redemptions promotion_redemptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion_redemptions
    ADD CONSTRAINT promotion_redemptions_pkey PRIMARY KEY (id);


--
-- Name: promotion_redemptions promotion_redemptions_site_id_idempotency_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion_redemptions
    ADD CONSTRAINT promotion_redemptions_site_id_idempotency_key_key UNIQUE (site_id, idempotency_key);


--
-- Name: promotion_rules promotion_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion_rules
    ADD CONSTRAINT promotion_rules_pkey PRIMARY KEY (id);


--
-- Name: promotion_usage_counters promotion_usage_counters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion_usage_counters
    ADD CONSTRAINT promotion_usage_counters_pkey PRIMARY KEY (id);


--
-- Name: promotion_usage_counters promotion_usage_counters_site_id_promotion_id_promotion_cod_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion_usage_counters
    ADD CONSTRAINT promotion_usage_counters_site_id_promotion_id_promotion_cod_key UNIQUE (site_id, promotion_id, promotion_code_id, coupon_id, customer_email);


--
-- Name: promotions promotions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotions
    ADD CONSTRAINT promotions_pkey PRIMARY KEY (id);


--
-- Name: provider_health_snapshots provider_health_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_health_snapshots
    ADD CONSTRAINT provider_health_snapshots_pkey PRIMARY KEY (id);


--
-- Name: provider_outage_events provider_outage_events_outage_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_outage_events
    ADD CONSTRAINT provider_outage_events_outage_id_key UNIQUE (outage_id);


--
-- Name: provider_outage_events provider_outage_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_outage_events
    ADD CONSTRAINT provider_outage_events_pkey PRIMARY KEY (id);


--
-- Name: provider_recovery_plans provider_recovery_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_recovery_plans
    ADD CONSTRAINT provider_recovery_plans_pkey PRIMARY KEY (id);


--
-- Name: purchase_order_lines purchase_order_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_lines
    ADD CONSTRAINT purchase_order_lines_pkey PRIMARY KEY (id);


--
-- Name: purchase_order_receipts purchase_order_receipts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_receipts
    ADD CONSTRAINT purchase_order_receipts_pkey PRIMARY KEY (id);


--
-- Name: purchase_order_receipts purchase_order_receipts_site_id_idempotency_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_receipts
    ADD CONSTRAINT purchase_order_receipts_site_id_idempotency_key_key UNIQUE (site_id, idempotency_key);


--
-- Name: purchase_orders purchase_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_pkey PRIMARY KEY (id);


--
-- Name: purchase_orders purchase_orders_site_id_idempotency_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_site_id_idempotency_key_key UNIQUE (site_id, idempotency_key);


--
-- Name: purchase_orders purchase_orders_site_id_po_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_site_id_po_number_key UNIQUE (site_id, po_number);


--
-- Name: query_snapshots query_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.query_snapshots
    ADD CONSTRAINT query_snapshots_pkey PRIMARY KEY (id);


--
-- Name: query_snapshots query_snapshots_query_name_query_version_cache_key_site_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.query_snapshots
    ADD CONSTRAINT query_snapshots_query_name_query_version_cache_key_site_id_key UNIQUE (query_name, query_version, cache_key, site_id);


--
-- Name: queue_operation_snapshots queue_operation_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.queue_operation_snapshots
    ADD CONSTRAINT queue_operation_snapshots_pkey PRIMARY KEY (id);


--
-- Name: queue_recovery_operations queue_recovery_operations_operation_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.queue_recovery_operations
    ADD CONSTRAINT queue_recovery_operations_operation_id_key UNIQUE (operation_id);


--
-- Name: queue_recovery_operations queue_recovery_operations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.queue_recovery_operations
    ADD CONSTRAINT queue_recovery_operations_pkey PRIMARY KEY (id);


--
-- Name: refund_attempts refund_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refund_attempts
    ADD CONSTRAINT refund_attempts_pkey PRIMARY KEY (id);


--
-- Name: refund_lines refund_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refund_lines
    ADD CONSTRAINT refund_lines_pkey PRIMARY KEY (id);


--
-- Name: refund_transactions refund_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refund_transactions
    ADD CONSTRAINT refund_transactions_pkey PRIMARY KEY (id);


--
-- Name: refunds refunds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refunds
    ADD CONSTRAINT refunds_pkey PRIMARY KEY (id);


--
-- Name: refunds refunds_site_id_idempotency_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refunds
    ADD CONSTRAINT refunds_site_id_idempotency_key_key UNIQUE (site_id, idempotency_key);


--
-- Name: regional_execution_diagnostics regional_execution_diagnostics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.regional_execution_diagnostics
    ADD CONSTRAINT regional_execution_diagnostics_pkey PRIMARY KEY (id);


--
-- Name: regional_routing_overrides regional_routing_overrides_override_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.regional_routing_overrides
    ADD CONSTRAINT regional_routing_overrides_override_id_key UNIQUE (override_id);


--
-- Name: regional_routing_overrides regional_routing_overrides_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.regional_routing_overrides
    ADD CONSTRAINT regional_routing_overrides_pkey PRIMARY KEY (id);


--
-- Name: replay_dry_run_results replay_dry_run_results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.replay_dry_run_results
    ADD CONSTRAINT replay_dry_run_results_pkey PRIMARY KEY (id);


--
-- Name: replay_operation_schedules replay_operation_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.replay_operation_schedules
    ADD CONSTRAINT replay_operation_schedules_pkey PRIMARY KEY (id);


--
-- Name: replay_operation_schedules replay_operation_schedules_replay_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.replay_operation_schedules
    ADD CONSTRAINT replay_operation_schedules_replay_id_key UNIQUE (replay_id);


--
-- Name: restock_events restock_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restock_events
    ADD CONSTRAINT restock_events_pkey PRIMARY KEY (id);


--
-- Name: restock_events restock_events_site_id_idempotency_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restock_events
    ADD CONSTRAINT restock_events_site_id_idempotency_key_key UNIQUE (site_id, idempotency_key);


--
-- Name: resume_versions resume_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resume_versions
    ADD CONSTRAINT resume_versions_pkey PRIMARY KEY (id);


--
-- Name: return_lines return_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.return_lines
    ADD CONSTRAINT return_lines_pkey PRIMARY KEY (id);


--
-- Name: return_requests return_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.return_requests
    ADD CONSTRAINT return_requests_pkey PRIMARY KEY (id);


--
-- Name: returns returns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.returns
    ADD CONSTRAINT returns_pkey PRIMARY KEY (id);


--
-- Name: returns returns_site_id_idempotency_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.returns
    ADD CONSTRAINT returns_site_id_idempotency_key_key UNIQUE (site_id, idempotency_key);


--
-- Name: rollout_stage_evidence rollout_stage_evidence_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rollout_stage_evidence
    ADD CONSTRAINT rollout_stage_evidence_pkey PRIMARY KEY (id);


--
-- Name: rollout_stage_evidence rollout_stage_evidence_stage_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rollout_stage_evidence
    ADD CONSTRAINT rollout_stage_evidence_stage_id_key UNIQUE (stage_id);


--
-- Name: runtime_alert_evaluations runtime_alert_evaluations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.runtime_alert_evaluations
    ADD CONSTRAINT runtime_alert_evaluations_pkey PRIMARY KEY (id);


--
-- Name: runtime_checkpoints runtime_checkpoints_checkpoint_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.runtime_checkpoints
    ADD CONSTRAINT runtime_checkpoints_checkpoint_id_key UNIQUE (checkpoint_id);


--
-- Name: runtime_checkpoints runtime_checkpoints_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.runtime_checkpoints
    ADD CONSTRAINT runtime_checkpoints_pkey PRIMARY KEY (id);


--
-- Name: runtime_command_journal runtime_command_journal_command_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.runtime_command_journal
    ADD CONSTRAINT runtime_command_journal_command_id_key UNIQUE (command_id);


--
-- Name: runtime_command_journal runtime_command_journal_idempotency_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.runtime_command_journal
    ADD CONSTRAINT runtime_command_journal_idempotency_key_key UNIQUE (idempotency_key);


--
-- Name: runtime_command_journal runtime_command_journal_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.runtime_command_journal
    ADD CONSTRAINT runtime_command_journal_pkey PRIMARY KEY (id);


--
-- Name: runtime_control_commands runtime_control_commands_command_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.runtime_control_commands
    ADD CONSTRAINT runtime_control_commands_command_id_key UNIQUE (command_id);


--
-- Name: runtime_control_commands runtime_control_commands_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.runtime_control_commands
    ADD CONSTRAINT runtime_control_commands_pkey PRIMARY KEY (id);


--
-- Name: runtime_deployment_topology_records runtime_deployment_topology_r_topology_version_runtime_root_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.runtime_deployment_topology_records
    ADD CONSTRAINT runtime_deployment_topology_r_topology_version_runtime_root_key UNIQUE (topology_version, runtime_root);


--
-- Name: runtime_deployment_topology_records runtime_deployment_topology_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.runtime_deployment_topology_records
    ADD CONSTRAINT runtime_deployment_topology_records_pkey PRIMARY KEY (id);


--
-- Name: runtime_diagnostics runtime_diagnostics_diagnostic_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.runtime_diagnostics
    ADD CONSTRAINT runtime_diagnostics_diagnostic_id_key UNIQUE (diagnostic_id);


--
-- Name: runtime_diagnostics runtime_diagnostics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.runtime_diagnostics
    ADD CONSTRAINT runtime_diagnostics_pkey PRIMARY KEY (id);


--
-- Name: runtime_event_retention_policies runtime_event_retention_policies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.runtime_event_retention_policies
    ADD CONSTRAINT runtime_event_retention_policies_pkey PRIMARY KEY (id);


--
-- Name: runtime_event_retention_policies runtime_event_retention_policies_policy_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.runtime_event_retention_policies
    ADD CONSTRAINT runtime_event_retention_policies_policy_id_key UNIQUE (policy_id);


--
-- Name: runtime_health_projections runtime_health_projections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.runtime_health_projections
    ADD CONSTRAINT runtime_health_projections_pkey PRIMARY KEY (id);


--
-- Name: runtime_health_projections runtime_health_projections_runtime_name_region_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.runtime_health_projections
    ADD CONSTRAINT runtime_health_projections_runtime_name_region_key UNIQUE (runtime_name, region);


--
-- Name: runtime_leases runtime_leases_fencing_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.runtime_leases
    ADD CONSTRAINT runtime_leases_fencing_token_key UNIQUE (fencing_token);


--
-- Name: runtime_leases runtime_leases_lease_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.runtime_leases
    ADD CONSTRAINT runtime_leases_lease_id_key UNIQUE (lease_id);


--
-- Name: runtime_leases runtime_leases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.runtime_leases
    ADD CONSTRAINT runtime_leases_pkey PRIMARY KEY (id);


--
-- Name: runtime_leases runtime_leases_resource_type_resource_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.runtime_leases
    ADD CONSTRAINT runtime_leases_resource_type_resource_id_key UNIQUE (resource_type, resource_id);


--
-- Name: runtime_replay_executions runtime_replay_executions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.runtime_replay_executions
    ADD CONSTRAINT runtime_replay_executions_pkey PRIMARY KEY (id);


--
-- Name: runtime_replay_executions runtime_replay_executions_replay_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.runtime_replay_executions
    ADD CONSTRAINT runtime_replay_executions_replay_id_key UNIQUE (replay_id);


--
-- Name: runtime_secret_rotation_events runtime_secret_rotation_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.runtime_secret_rotation_events
    ADD CONSTRAINT runtime_secret_rotation_events_pkey PRIMARY KEY (id);


--
-- Name: runtime_secret_rotation_events runtime_secret_rotation_events_rotation_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.runtime_secret_rotation_events
    ADD CONSTRAINT runtime_secret_rotation_events_rotation_id_key UNIQUE (rotation_id);


--
-- Name: runtime_slo_definitions runtime_slo_definitions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.runtime_slo_definitions
    ADD CONSTRAINT runtime_slo_definitions_pkey PRIMARY KEY (id);


--
-- Name: runtime_slo_definitions runtime_slo_definitions_slo_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.runtime_slo_definitions
    ADD CONSTRAINT runtime_slo_definitions_slo_id_key UNIQUE (slo_id);


--
-- Name: runtime_structured_logs runtime_structured_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.runtime_structured_logs
    ADD CONSTRAINT runtime_structured_logs_pkey PRIMARY KEY (id);


--
-- Name: runtime_telemetry_metrics runtime_telemetry_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.runtime_telemetry_metrics
    ADD CONSTRAINT runtime_telemetry_metrics_pkey PRIMARY KEY (id);


--
-- Name: runtime_telemetry_spans runtime_telemetry_spans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.runtime_telemetry_spans
    ADD CONSTRAINT runtime_telemetry_spans_pkey PRIMARY KEY (id);


--
-- Name: runtime_telemetry_spans runtime_telemetry_spans_trace_id_span_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.runtime_telemetry_spans
    ADD CONSTRAINT runtime_telemetry_spans_trace_id_span_id_key UNIQUE (trace_id, span_id);


--
-- Name: sandbox_provider_contracts sandbox_provider_contracts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sandbox_provider_contracts
    ADD CONSTRAINT sandbox_provider_contracts_pkey PRIMARY KEY (id);


--
-- Name: sandbox_provider_contracts sandbox_provider_contracts_provider_environment_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sandbox_provider_contracts
    ADD CONSTRAINT sandbox_provider_contracts_provider_environment_key UNIQUE (provider, environment);


--
-- Name: search_documents search_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.search_documents
    ADD CONSTRAINT search_documents_pkey PRIMARY KEY (id);


--
-- Name: search_documents search_documents_site_id_object_type_object_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.search_documents
    ADD CONSTRAINT search_documents_site_id_object_type_object_id_key UNIQUE (site_id, object_type, object_id);


--
-- Name: security_enforcement_events security_enforcement_events_enforcement_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_enforcement_events
    ADD CONSTRAINT security_enforcement_events_enforcement_id_key UNIQUE (enforcement_id);


--
-- Name: security_enforcement_events security_enforcement_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_enforcement_events
    ADD CONSTRAINT security_enforcement_events_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_token_key UNIQUE (token);


--
-- Name: shadow_traffic_comparison_runs shadow_traffic_comparison_runs_comparison_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shadow_traffic_comparison_runs
    ADD CONSTRAINT shadow_traffic_comparison_runs_comparison_id_key UNIQUE (comparison_id);


--
-- Name: shadow_traffic_comparison_runs shadow_traffic_comparison_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shadow_traffic_comparison_runs
    ADD CONSTRAINT shadow_traffic_comparison_runs_pkey PRIMARY KEY (id);


--
-- Name: shipment_events shipment_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipment_events
    ADD CONSTRAINT shipment_events_pkey PRIMARY KEY (id);


--
-- Name: shipments shipments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipments
    ADD CONSTRAINT shipments_pkey PRIMARY KEY (id);


--
-- Name: shipments shipments_site_id_idempotency_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipments
    ADD CONSTRAINT shipments_site_id_idempotency_key_key UNIQUE (site_id, idempotency_key);


--
-- Name: shipping_rates shipping_rates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_rates
    ADD CONSTRAINT shipping_rates_pkey PRIMARY KEY (id);


--
-- Name: shipping_zones shipping_zones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_zones
    ADD CONSTRAINT shipping_zones_pkey PRIMARY KEY (id);


--
-- Name: site_api_clients site_api_clients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_api_clients
    ADD CONSTRAINT site_api_clients_pkey PRIMARY KEY (id);


--
-- Name: site_api_clients site_api_clients_site_id_key_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_api_clients
    ADD CONSTRAINT site_api_clients_site_id_key_hash_key UNIQUE (site_id, key_hash);


--
-- Name: site_entitlement_overrides site_entitlement_overrides_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_entitlement_overrides
    ADD CONSTRAINT site_entitlement_overrides_pkey PRIMARY KEY (id);


--
-- Name: site_gate_attempts site_gate_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_gate_attempts
    ADD CONSTRAINT site_gate_attempts_pkey PRIMARY KEY (id);

--
-- Name: site_domain_reviews site_domain_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_domain_reviews
    ADD CONSTRAINT site_domain_reviews_pkey PRIMARY KEY (id);

--
-- Name: domain_orders domain_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_orders
    ADD CONSTRAINT domain_orders_pkey PRIMARY KEY (id);

--
-- Name: domain_orders domain_orders_idempotency_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_orders
    ADD CONSTRAINT domain_orders_idempotency_key UNIQUE (idempotency_key);


--
-- Name: site_memberships site_memberships_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_memberships
    ADD CONSTRAINT site_memberships_pkey PRIMARY KEY (id);


--
-- Name: site_role_permissions site_role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_role_permissions
    ADD CONSTRAINT site_role_permissions_pkey PRIMARY KEY (id);


--
-- Name: site_role_permissions site_role_permissions_role_id_permission_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_role_permissions
    ADD CONSTRAINT site_role_permissions_role_id_permission_key UNIQUE (role_id, permission);


--
-- Name: site_roles site_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_roles
    ADD CONSTRAINT site_roles_pkey PRIMARY KEY (id);


--
-- Name: site_roles site_roles_site_id_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_roles
    ADD CONSTRAINT site_roles_site_id_slug_key UNIQUE (site_id, slug);


--
-- Name: site_preview_links site_preview_links_jti_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_preview_links
    ADD CONSTRAINT site_preview_links_jti_key UNIQUE (jti);


--
-- Name: site_preview_links site_preview_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_preview_links
    ADD CONSTRAINT site_preview_links_pkey PRIMARY KEY (id);


--
-- Name: site_usage_meters site_usage_meters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_usage_meters
    ADD CONSTRAINT site_usage_meters_pkey PRIMARY KEY (id);


--
-- Name: site_usage_meters site_usage_meters_site_id_meter_name_period_start_period_en_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_usage_meters
    ADD CONSTRAINT site_usage_meters_site_id_meter_name_period_start_period_en_key UNIQUE (site_id, meter_name, period_start, period_end);


--
-- Name: sites sites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sites
    ADD CONSTRAINT sites_pkey PRIMARY KEY (id);


--
-- Name: sites sites_store_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sites
    ADD CONSTRAINT sites_store_name_key UNIQUE (store_name);


--
-- Name: sites sites_subdomain_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sites
    ADD CONSTRAINT sites_subdomain_key UNIQUE (subdomain);


--
-- Name: skill_endorsements skill_endorsements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.skill_endorsements
    ADD CONSTRAINT skill_endorsements_pkey PRIMARY KEY (id);


--
-- Name: skill_endorsements skill_endorsements_skill_id_endorser_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.skill_endorsements
    ADD CONSTRAINT skill_endorsements_skill_id_endorser_email_key UNIQUE (skill_id, endorser_email);


--
-- Name: skills skills_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.skills
    ADD CONSTRAINT skills_pkey PRIMARY KEY (id);


--
-- Name: smart_collections smart_collections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.smart_collections
    ADD CONSTRAINT smart_collections_pkey PRIMARY KEY (id);


--
-- Name: smart_collections smart_collections_store_id_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.smart_collections
    ADD CONSTRAINT smart_collections_store_id_slug_key UNIQUE (store_id, slug);


--
-- Name: sre_error_budget_snapshots sre_error_budget_snapshots_budget_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sre_error_budget_snapshots
    ADD CONSTRAINT sre_error_budget_snapshots_budget_id_key UNIQUE (budget_id);


--
-- Name: sre_error_budget_snapshots sre_error_budget_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sre_error_budget_snapshots
    ADD CONSTRAINT sre_error_budget_snapshots_pkey PRIMARY KEY (id);


--
-- Name: store_customers store_customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_customers
    ADD CONSTRAINT store_customers_pkey PRIMARY KEY (id);


--
-- Name: store_customers store_customers_store_id_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_customers
    ADD CONSTRAINT store_customers_store_id_email_key UNIQUE (store_id, email);


--
-- Name: store_surveys store_surveys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_surveys
    ADD CONSTRAINT store_surveys_pkey PRIMARY KEY (id);


--
-- Name: store_surveys store_surveys_store_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_surveys
    ADD CONSTRAINT store_surveys_store_id_key UNIQUE (store_id);


--
-- Name: store_themes store_themes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_themes
    ADD CONSTRAINT store_themes_pkey PRIMARY KEY (id);


--
-- Name: store_themes store_themes_store_id_theme_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_themes
    ADD CONSTRAINT store_themes_store_id_theme_id_key UNIQUE (store_id, theme_id);


--
-- Name: storefront_cache_tags storefront_cache_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.storefront_cache_tags
    ADD CONSTRAINT storefront_cache_tags_pkey PRIMARY KEY (id);


--
-- Name: storefront_cache_tags storefront_cache_tags_store_id_tag_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.storefront_cache_tags
    ADD CONSTRAINT storefront_cache_tags_store_id_tag_key UNIQUE (store_id, tag);


--
-- Name: storefront_page_revisions storefront_page_revisions_page_id_revision_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.storefront_page_revisions
    ADD CONSTRAINT storefront_page_revisions_page_id_revision_number_key UNIQUE (page_id, revision_number);


--
-- Name: storefront_page_revisions storefront_page_revisions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.storefront_page_revisions
    ADD CONSTRAINT storefront_page_revisions_pkey PRIMARY KEY (id);


--
-- Name: storefront_pages storefront_pages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.storefront_pages
    ADD CONSTRAINT storefront_pages_pkey PRIMARY KEY (id);


--
-- Name: storefront_pages storefront_pages_store_id_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.storefront_pages
    ADD CONSTRAINT storefront_pages_store_id_slug_key UNIQUE (store_id, slug);


--
-- Name: storefront_policies storefront_policies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.storefront_policies
    ADD CONSTRAINT storefront_policies_pkey PRIMARY KEY (id);


--
-- Name: storefront_policies storefront_policies_store_id_policy_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.storefront_policies
    ADD CONSTRAINT storefront_policies_store_id_policy_type_key UNIQUE (store_id, policy_type);


--
-- Name: storefront_slug_redirects storefront_slug_redirects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.storefront_slug_redirects
    ADD CONSTRAINT storefront_slug_redirects_pkey PRIMARY KEY (id);


--
-- Name: storefront_slug_redirects storefront_slug_redirects_store_id_from_path_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.storefront_slug_redirects
    ADD CONSTRAINT storefront_slug_redirects_store_id_from_path_key UNIQUE (store_id, from_path);


--
-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);


--
-- Name: super_admin_allowlist super_admins_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.super_admin_allowlist
    ADD CONSTRAINT super_admins_email_key UNIQUE (email);


--
-- Name: super_admin_allowlist super_admins_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.super_admin_allowlist
    ADD CONSTRAINT super_admins_pkey PRIMARY KEY (id);


--
-- Name: suppliers suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_pkey PRIMARY KEY (id);


--
-- Name: tax_rates tax_rates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_rates
    ADD CONSTRAINT tax_rates_pkey PRIMARY KEY (id);


--
-- Name: tenant_execution_quotas tenant_execution_quotas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_execution_quotas
    ADD CONSTRAINT tenant_execution_quotas_pkey PRIMARY KEY (id);


--
-- Name: tenant_execution_quotas tenant_execution_quotas_site_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_execution_quotas
    ADD CONSTRAINT tenant_execution_quotas_site_id_key UNIQUE (site_id);


--
-- Name: tenant_operation_projections tenant_operation_projections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_operation_projections
    ADD CONSTRAINT tenant_operation_projections_pkey PRIMARY KEY (id);


--
-- Name: tenant_operation_projections tenant_operation_projections_site_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_operation_projections
    ADD CONSTRAINT tenant_operation_projections_site_id_key UNIQUE (site_id);


--
-- Name: testimonials testimonials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.testimonials
    ADD CONSTRAINT testimonials_pkey PRIMARY KEY (id);


--
-- Name: theme_assets theme_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_assets
    ADD CONSTRAINT theme_assets_pkey PRIMARY KEY (id);


--
-- Name: theme_assets theme_assets_theme_package_version_id_asset_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_assets
    ADD CONSTRAINT theme_assets_theme_package_version_id_asset_key_key UNIQUE (theme_package_version_id, asset_key);


--
-- Name: theme_block_definitions theme_block_definitions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_block_definitions
    ADD CONSTRAINT theme_block_definitions_pkey PRIMARY KEY (id);


--
-- Name: theme_block_definitions theme_block_definitions_theme_package_version_id_block_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_block_definitions
    ADD CONSTRAINT theme_block_definitions_theme_package_version_id_block_key_key UNIQUE (theme_package_version_id, block_key);


--
-- Name: theme_draft_patches theme_draft_patches_draft_id_patch_sequence_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_draft_patches
    ADD CONSTRAINT theme_draft_patches_draft_id_patch_sequence_key UNIQUE (draft_id, patch_sequence);


--
-- Name: theme_draft_patches theme_draft_patches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_draft_patches
    ADD CONSTRAINT theme_draft_patches_pkey PRIMARY KEY (id);


--
-- Name: theme_editor_drafts theme_editor_drafts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_editor_drafts
    ADD CONSTRAINT theme_editor_drafts_pkey PRIMARY KEY (id);


--
-- Name: theme_editor_drafts theme_editor_drafts_store_id_theme_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_editor_drafts
    ADD CONSTRAINT theme_editor_drafts_store_id_theme_id_key UNIQUE (store_id, theme_id);


--
-- Name: theme_instance_drafts theme_instance_drafts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_instance_drafts
    ADD CONSTRAINT theme_instance_drafts_pkey PRIMARY KEY (id);


--
-- Name: theme_instances theme_instances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_instances
    ADD CONSTRAINT theme_instances_pkey PRIMARY KEY (id);


--
-- Name: theme_instances theme_instances_store_id_theme_package_id_deleted_at_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_instances
    ADD CONSTRAINT theme_instances_store_id_theme_package_id_deleted_at_key UNIQUE (store_id, theme_package_id, deleted_at);


--
-- Name: theme_layouts theme_layouts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_layouts
    ADD CONSTRAINT theme_layouts_pkey PRIMARY KEY (id);


--
-- Name: theme_layouts theme_layouts_theme_package_version_id_layout_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_layouts
    ADD CONSTRAINT theme_layouts_theme_package_version_id_layout_key_key UNIQUE (theme_package_version_id, layout_key);


--
-- Name: theme_migrations theme_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_migrations
    ADD CONSTRAINT theme_migrations_pkey PRIMARY KEY (id);


--
-- Name: theme_migrations theme_migrations_theme_package_id_migration_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_migrations
    ADD CONSTRAINT theme_migrations_theme_package_id_migration_key_key UNIQUE (theme_package_id, migration_key);


--
-- Name: theme_package_versions theme_package_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_package_versions
    ADD CONSTRAINT theme_package_versions_pkey PRIMARY KEY (id);


--
-- Name: theme_package_versions theme_package_versions_theme_package_id_version_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_package_versions
    ADD CONSTRAINT theme_package_versions_theme_package_id_version_key UNIQUE (theme_package_id, version);


--
-- Name: theme_packages theme_packages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_packages
    ADD CONSTRAINT theme_packages_pkey PRIMARY KEY (id);


--
-- Name: theme_packages theme_packages_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_packages
    ADD CONSTRAINT theme_packages_slug_key UNIQUE (slug);


--
-- Name: theme_presets theme_presets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_presets
    ADD CONSTRAINT theme_presets_pkey PRIMARY KEY (id);


--
-- Name: theme_presets theme_presets_theme_package_version_id_preset_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_presets
    ADD CONSTRAINT theme_presets_theme_package_version_id_preset_key_key UNIQUE (theme_package_version_id, preset_key);


--
-- Name: theme_preview_sessions theme_preview_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_preview_sessions
    ADD CONSTRAINT theme_preview_sessions_pkey PRIMARY KEY (id);


--
-- Name: theme_preview_sessions theme_preview_sessions_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_preview_sessions
    ADD CONSTRAINT theme_preview_sessions_token_hash_key UNIQUE (token_hash);


--
-- Name: theme_purchases theme_purchases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_purchases
    ADD CONSTRAINT theme_purchases_pkey PRIMARY KEY (id);


--
-- Name: theme_purchases theme_purchases_user_id_theme_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_purchases
    ADD CONSTRAINT theme_purchases_user_id_theme_id_key UNIQUE (user_id, theme_id);


--
-- Name: theme_releases theme_releases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_releases
    ADD CONSTRAINT theme_releases_pkey PRIMARY KEY (id);


--
-- Name: theme_releases theme_releases_store_id_release_version_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_releases
    ADD CONSTRAINT theme_releases_store_id_release_version_key UNIQUE (store_id, release_version);


--
-- Name: theme_renderer_manifests theme_renderer_manifests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_renderer_manifests
    ADD CONSTRAINT theme_renderer_manifests_pkey PRIMARY KEY (id);


--
-- Name: theme_renderer_manifests theme_renderer_manifests_theme_package_version_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_renderer_manifests
    ADD CONSTRAINT theme_renderer_manifests_theme_package_version_id_key UNIQUE (theme_package_version_id);


--
-- Name: theme_reviews theme_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_reviews
    ADD CONSTRAINT theme_reviews_pkey PRIMARY KEY (id);


--
-- Name: theme_reviews theme_reviews_user_id_theme_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_reviews
    ADD CONSTRAINT theme_reviews_user_id_theme_id_key UNIQUE (user_id, theme_id);


--
-- Name: theme_schema_manifests theme_schema_manifests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_schema_manifests
    ADD CONSTRAINT theme_schema_manifests_pkey PRIMARY KEY (id);


--
-- Name: theme_schema_manifests theme_schema_manifests_theme_package_version_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_schema_manifests
    ADD CONSTRAINT theme_schema_manifests_theme_package_version_id_key UNIQUE (theme_package_version_id);


--
-- Name: theme_section_definitions theme_section_definitions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_section_definitions
    ADD CONSTRAINT theme_section_definitions_pkey PRIMARY KEY (id);


--
-- Name: theme_section_definitions theme_section_definitions_theme_package_version_id_section__key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_section_definitions
    ADD CONSTRAINT theme_section_definitions_theme_package_version_id_section__key UNIQUE (theme_package_version_id, section_key);


--
-- Name: theme_template_assignments theme_template_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_template_assignments
    ADD CONSTRAINT theme_template_assignments_pkey PRIMARY KEY (id);


--
-- Name: theme_template_assignments theme_template_assignments_store_id_route_type_route_key_ma_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_template_assignments
    ADD CONSTRAINT theme_template_assignments_store_id_route_type_route_key_ma_key UNIQUE (store_id, route_type, route_key, market, locale, is_active);


--
-- Name: theme_templates theme_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_templates
    ADD CONSTRAINT theme_templates_pkey PRIMARY KEY (id);


--
-- Name: theme_templates theme_templates_theme_package_version_id_template_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_templates
    ADD CONSTRAINT theme_templates_theme_package_version_id_template_key_key UNIQUE (theme_package_version_id, template_key);


--
-- Name: themes themes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.themes
    ADD CONSTRAINT themes_pkey PRIMARY KEY (id);


--
-- Name: themes themes_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.themes
    ADD CONSTRAINT themes_slug_key UNIQUE (slug);


--
-- Name: usage_meter_entries usage_meter_entries_meter_id_idempotency_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usage_meter_entries
    ADD CONSTRAINT usage_meter_entries_meter_id_idempotency_key_key UNIQUE (meter_id, idempotency_key);


--
-- Name: usage_meter_entries usage_meter_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usage_meter_entries
    ADD CONSTRAINT usage_meter_entries_pkey PRIMARY KEY (id);


--
-- Name: user_profiles user_profiles_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_email_key UNIQUE (email);


--
-- Name: user_profiles user_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_pkey PRIMARY KEY (id);


--
-- Name: users_custom users_custom_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users_custom
    ADD CONSTRAINT users_custom_email_key UNIQUE (email);


--
-- Name: users_custom users_custom_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users_custom
    ADD CONSTRAINT users_custom_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: verification_tokens verification_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_tokens
    ADD CONSTRAINT verification_tokens_pkey PRIMARY KEY (id);


--
-- Name: verification_tokens verification_tokens_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_tokens
    ADD CONSTRAINT verification_tokens_token_key UNIQUE (token);


--
-- Name: webhook_deliveries webhook_deliveries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_deliveries
    ADD CONSTRAINT webhook_deliveries_pkey PRIMARY KEY (id);


--
-- Name: webhook_deliveries webhook_deliveries_subscription_id_event_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_deliveries
    ADD CONSTRAINT webhook_deliveries_subscription_id_event_id_key UNIQUE (subscription_id, event_id);


--
-- Name: webhook_subscriptions webhook_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_subscriptions
    ADD CONSTRAINT webhook_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: wishlists wishlists_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wishlists
    ADD CONSTRAINT wishlists_pkey PRIMARY KEY (id);


--
-- Name: wishlists wishlists_store_id_customer_email_product_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wishlists
    ADD CONSTRAINT wishlists_store_id_customer_email_product_id_key UNIQUE (store_id, customer_email, product_id);


--
-- Name: work_experience work_experience_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_experience
    ADD CONSTRAINT work_experience_pkey PRIMARY KEY (id);


--
-- Name: worker_request_logs worker_request_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.worker_request_logs
    ADD CONSTRAINT worker_request_logs_pkey PRIMARY KEY (id);


--
-- Name: workflow_heartbeats workflow_heartbeats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_heartbeats
    ADD CONSTRAINT workflow_heartbeats_pkey PRIMARY KEY (id);


--
-- Name: workflow_lifecycle workflow_lifecycle_execution_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_lifecycle
    ADD CONSTRAINT workflow_lifecycle_execution_id_key UNIQUE (execution_id);


--
-- Name: workflow_lifecycle workflow_lifecycle_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_lifecycle
    ADD CONSTRAINT workflow_lifecycle_pkey PRIMARY KEY (id);


--
-- Name: workflow_operation_snapshots workflow_operation_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_operation_snapshots
    ADD CONSTRAINT workflow_operation_snapshots_pkey PRIMARY KEY (id);


--
-- Name: idx_activity_log_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_log_customer ON public.customer_activity_log USING btree (customer_id);


--
-- Name: idx_activity_log_store; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_log_store ON public.customer_activity_log USING btree (store_id, created_at DESC);


--
-- Name: idx_activity_log_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_log_type ON public.customer_activity_log USING btree (activity_type);


--
-- Name: idx_adjustments_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_adjustments_product ON public.inventory_adjustments USING btree (product_id, created_at DESC);


--
-- Name: idx_ai_credits_store; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_credits_store ON public.ai_credits USING btree (store_id);


--
-- Name: idx_ai_usage_feature; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_usage_feature ON public.ai_usage USING btree (store_id, feature);


--
-- Name: idx_ai_usage_store; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_usage_store ON public.ai_usage USING btree (store_id, created_at DESC);


--
-- Name: idx_analytics_event_stream_site_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analytics_event_stream_site_created ON public.analytics_event_stream USING btree (site_id, created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_analytics_event_stream_type_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analytics_event_stream_type_created ON public.analytics_event_stream USING btree (event_type, created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_analytics_rollups_daily_site_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analytics_rollups_daily_site_date ON public.analytics_rollups_daily USING btree (site_id, rollup_date DESC, metric_name) WHERE (deleted_at IS NULL);


--
-- Name: idx_analytics_store; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analytics_store ON public.analytics_events USING btree (store_id, created_at DESC);


--
-- Name: idx_analytics_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analytics_type ON public.analytics_events USING btree (event_type, created_at DESC);


--
-- Name: idx_app_billing_charges_installation_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_app_billing_charges_installation_created ON public.app_billing_charges USING btree (installation_id, created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_app_billing_charges_partner_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_app_billing_charges_partner_created ON public.app_billing_charges USING btree (partner_id, created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_app_billing_charges_site_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_app_billing_charges_site_created ON public.app_billing_charges USING btree (site_id, created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_app_billing_charges_status_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_app_billing_charges_status_created ON public.app_billing_charges USING btree (status, created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_app_developers_country; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_app_developers_country ON public.app_developers USING btree (country);


--
-- Name: idx_app_developers_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_app_developers_status ON public.app_developers USING btree (status);


--
-- Name: idx_app_developers_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_app_developers_user ON public.app_developers USING btree (user_id);


--
-- Name: idx_app_extensions_app; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_app_extensions_app ON public.app_extensions USING btree (app_id);


--
-- Name: idx_app_extensions_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_app_extensions_type ON public.app_extensions USING btree (type);


--
-- Name: idx_app_installations_app; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_app_installations_app ON public.app_installations USING btree (app_id);


--
-- Name: idx_app_installations_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_app_installations_status ON public.app_installations USING btree (status);


--
-- Name: idx_app_installations_store; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_app_installations_store ON public.app_installations USING btree (store_id);


--
-- Name: idx_app_reviews_app; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_app_reviews_app ON public.app_reviews USING btree (app_id);


--
-- Name: idx_app_reviews_rating; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_app_reviews_rating ON public.app_reviews USING btree (rating);


--
-- Name: idx_app_reviews_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_app_reviews_user ON public.app_reviews USING btree (user_id);


--
-- Name: idx_app_webhooks_app; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_app_webhooks_app ON public.app_webhooks USING btree (app_id);


--
-- Name: idx_audit_activity_events_action_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_activity_events_action_created ON public.audit_activity_events USING btree (action, created_at DESC);


--
-- Name: idx_audit_activity_events_actor_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_activity_events_actor_created ON public.audit_activity_events USING btree (actor_id, created_at DESC) WHERE (actor_id IS NOT NULL);


--
-- Name: idx_audit_activity_events_store_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_activity_events_store_created ON public.audit_activity_events USING btree (store_id, created_at DESC);


--
-- Name: idx_audit_logs_actor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_actor ON public.audit_logs USING btree (actor_id);


--
-- Name: idx_audit_logs_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_created ON public.audit_logs USING btree (created_at);


--
-- Name: idx_audit_logs_resource; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_resource ON public.audit_logs USING btree (resource_type, resource_id);


--
-- Name: idx_billing_history_payment_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_billing_history_payment_id ON public.billing_history USING btree (payment_id) WHERE (payment_id IS NOT NULL);


--
-- Name: idx_billing_history_store; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_billing_history_store ON public.billing_history USING btree (store_id);


--
-- Name: idx_billing_history_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_billing_history_user ON public.billing_history USING btree (user_id);


--
-- Name: idx_blog_categories_store; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blog_categories_store ON public.blog_categories USING btree (store_id, parent_id);


--
-- Name: idx_blog_comments_post; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blog_comments_post ON public.blog_comments USING btree (post_id, status);


--
-- Name: idx_blog_comments_store; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blog_comments_store ON public.blog_comments USING btree (store_id, created_at DESC);


--
-- Name: idx_blog_posts_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blog_posts_active ON public.blog_posts USING btree (store_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_blog_posts_author; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blog_posts_author ON public.blog_posts USING btree (author_id);


--
-- Name: idx_blog_posts_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blog_posts_category ON public.blog_posts USING btree (category_id) WHERE (category_id IS NOT NULL);


--
-- Name: idx_blog_posts_featured; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blog_posts_featured ON public.blog_posts USING btree (store_id) WHERE ((is_featured = true) AND (status = 'published'::text));


--
-- Name: idx_blog_posts_published; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blog_posts_published ON public.blog_posts USING btree (store_id, published_at DESC) WHERE (status = 'published'::text);


--
-- Name: idx_blog_posts_search; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blog_posts_search ON public.blog_posts USING gin (to_tsvector('english'::regconfig, ((((title || ' '::text) || COALESCE(excerpt, ''::text)) || ' '::text) || COALESCE(content, ''::text))));


--
-- Name: idx_blog_posts_store; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blog_posts_store ON public.blog_posts USING btree (store_id, status);


--
-- Name: idx_blog_tags_store; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blog_tags_store ON public.blog_tags USING btree (store_id);


--
-- Name: idx_cache_invalidation_events_claim; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cache_invalidation_events_claim ON public.cache_invalidation_events USING btree (processed_at, created_at) WHERE ((processed_at IS NULL) AND (deleted_at IS NULL));


--
-- Name: idx_cache_operation_snapshots_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cache_operation_snapshots_key ON public.cache_operation_snapshots USING btree (cache_name, tenant_key, sampled_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_carts_abandoned; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_carts_abandoned ON public.carts USING btree (store_id, status) WHERE (status = 'abandoned'::text);


--
-- Name: idx_carts_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_carts_active ON public.carts USING btree (store_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_carts_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_carts_session ON public.carts USING btree (store_id, session_id) WHERE (session_id IS NOT NULL);


--
-- Name: idx_carts_store_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_carts_store_customer ON public.carts USING btree (store_id, customer_id);


--
-- Name: idx_certifications_store_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_certifications_store_active ON public.certifications USING btree (store_id, display_order) WHERE (deleted_at IS NULL);


--
-- Name: idx_checkout_sessions_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_checkout_sessions_order ON public.checkout_sessions USING btree (order_id) WHERE (order_id IS NOT NULL);


--
-- Name: idx_checkout_sessions_site_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_checkout_sessions_site_created ON public.checkout_sessions USING btree (site_id, created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_collections_store_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collections_store_active ON public.collections USING btree (store_id, created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_collections_store_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collections_store_id ON public.collections USING btree (store_id);


--
-- Name: idx_contact_submissions_store; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contact_submissions_store ON public.contact_submissions USING btree (store_id);


--
-- Name: idx_contacts_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contacts_active ON public.contacts USING btree (site_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_coupons_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coupons_active ON public.coupons USING btree (site_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_coupons_store_code_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_coupons_store_code_active ON public.coupons USING btree (store_id, upper(code)) WHERE (deleted_at IS NULL);


--
-- Name: idx_customer_addresses_store; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_addresses_store ON public.customer_addresses USING btree (store_id, customer_email);


--
-- Name: idx_customer_credentials_store; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_credentials_store ON public.customer_credentials USING btree (store_id, email_or_phone);


--
-- Name: idx_customer_wishlists_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_wishlists_customer ON public.customer_wishlists USING btree (customer_id);


--
-- Name: idx_customer_wishlists_store; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_wishlists_store ON public.customer_wishlists USING btree (store_id);


--
-- Name: idx_deployment_health_gate_results_runtime; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deployment_health_gate_results_runtime ON public.deployment_health_gate_results USING btree (runtime_root, environment, evaluated_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_devices_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_devices_user ON public.devices USING btree (user_id, fingerprint);


--
-- Name: idx_distributed_event_store_retention_archive; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_distributed_event_store_retention_archive ON public.distributed_event_store USING btree (retention_class, occurred_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_distributed_event_store_site_position; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_distributed_event_store_site_position ON public.distributed_event_store USING btree (site_id, global_position) WHERE (deleted_at IS NULL);


--
-- Name: idx_distributed_event_store_stream_position; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_distributed_event_store_stream_position ON public.distributed_event_store USING btree (stream_name, stream_position) WHERE (deleted_at IS NULL);


--
-- Name: idx_distributed_event_store_type_position; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_distributed_event_store_type_position ON public.distributed_event_store USING btree (event_type, global_position) WHERE (deleted_at IS NULL);


--
-- Name: idx_distributed_event_streams_site; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_distributed_event_streams_site ON public.distributed_event_streams USING btree (site_id, stream_name) WHERE (deleted_at IS NULL);


--
-- Name: idx_distributed_queue_heartbeats_message; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_distributed_queue_heartbeats_message ON public.distributed_queue_heartbeats USING btree (queue_name, message_id, heartbeat_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_distributed_queue_messages_claim; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_distributed_queue_messages_claim ON public.distributed_queue_messages USING btree (queue_name, partition_index, status, available_at, created_at) WHERE ((status = ANY (ARRAY['scheduled'::text, 'available'::text, 'retrying'::text])) AND (deleted_at IS NULL));


--
-- Name: idx_distributed_queue_messages_site; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_distributed_queue_messages_site ON public.distributed_queue_messages USING btree (site_id, queue_name, created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_distributed_queue_messages_status_available; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_distributed_queue_messages_status_available ON public.distributed_queue_messages USING btree (queue_name, status, available_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_education_store_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_education_store_active ON public.education USING btree (store_id, display_order) WHERE (deleted_at IS NULL);


--
-- Name: idx_email_logs_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_logs_created ON public.email_logs USING btree (created_at DESC);


--
-- Name: idx_email_logs_recipient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_logs_recipient ON public.email_logs USING btree (recipient_email);


--
-- Name: idx_email_logs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_logs_status ON public.email_logs USING btree (status);


--
-- Name: idx_email_logs_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_logs_type ON public.email_logs USING btree (email_type);


--
-- Name: idx_employee_invites_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employee_invites_email ON public.employee_invites USING btree (email);


--
-- Name: idx_employee_invites_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employee_invites_token ON public.employee_invites USING btree (token);


--
-- Name: idx_employees_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employees_email ON public.employees USING btree (email);


--
-- Name: idx_employees_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employees_role ON public.employees USING btree (role);


--
-- Name: idx_employees_store_status_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employees_store_status_active ON public.employees USING btree (store_id, status, created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_event_store_integrity_checks_stream; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_event_store_integrity_checks_stream ON public.event_store_integrity_checks USING btree (environment, stream_name, checked_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_event_stream_snapshots_stream; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_event_stream_snapshots_stream ON public.event_stream_snapshots USING btree (stream_name, stream_position DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_execution_audit_trail_resource; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_execution_audit_trail_resource ON public.execution_audit_trail USING btree (resource_type, resource_id, recorded_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_execution_audit_trail_site; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_execution_audit_trail_site ON public.execution_audit_trail USING btree (site_id, recorded_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_form_submissions_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_form_submissions_created ON public.form_submissions USING btree (store_id, created_at DESC);


--
-- Name: idx_form_submissions_store; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_form_submissions_store ON public.form_submissions USING btree (store_id, status);


--
-- Name: idx_form_submissions_store_type_status_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_form_submissions_store_type_status_active ON public.form_submissions USING btree (store_id, form_type, status, created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_form_submissions_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_form_submissions_type ON public.form_submissions USING btree (store_id, form_type);


--
-- Name: idx_fulfillment_order_lines_fulfillment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fulfillment_order_lines_fulfillment ON public.fulfillment_order_lines USING btree (fulfillment_order_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_fulfillment_order_lines_order_item; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fulfillment_order_lines_order_item ON public.fulfillment_order_lines USING btree (order_item_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_fulfillment_orders_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fulfillment_orders_order ON public.fulfillment_orders USING btree (order_id, created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_fulfillment_orders_site_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fulfillment_orders_site_status ON public.fulfillment_orders USING btree (site_id, status, created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_gallery_store; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gallery_store ON public.gallery_items USING btree (store_id, display_order);


--
-- Name: idx_gift_card_accounts_site_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gift_card_accounts_site_status ON public.gift_card_accounts USING btree (site_id, status, created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_gift_card_ledger_account_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gift_card_ledger_account_created ON public.gift_card_ledger_entries USING btree (gift_card_account_id, created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_gift_card_redemptions_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gift_card_redemptions_order ON public.gift_card_redemptions USING btree (order_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_gift_cards_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gift_cards_code ON public.gift_cards USING btree (code);


--
-- Name: idx_gift_cards_store_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gift_cards_store_active ON public.gift_cards USING btree (store_id, created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_gift_cards_store_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gift_cards_store_id ON public.gift_cards USING btree (store_id);


--
-- Name: idx_idempotency_keys_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_idempotency_keys_expires_at ON public.idempotency_keys USING btree (expires_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_idempotency_keys_site_scope; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_idempotency_keys_site_scope ON public.idempotency_keys USING btree (site_id, scope) WHERE (deleted_at IS NULL);


--
-- Name: idx_idempotency_keys_status_locked; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_idempotency_keys_status_locked ON public.idempotency_keys USING btree (status, locked_until) WHERE (deleted_at IS NULL);


--
-- Name: idx_inventory_events_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_events_order ON public.inventory_events USING btree (order_id) WHERE ((order_id IS NOT NULL) AND (deleted_at IS NULL));


--
-- Name: idx_inventory_events_product_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_events_product_created ON public.inventory_events USING btree (product_id, variant_id, created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_inventory_events_site_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_events_site_created ON public.inventory_events USING btree (site_id, created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_inventory_level_duplicate_snapshots_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_level_duplicate_snapshots_product ON public.inventory_level_duplicate_snapshots USING btree (product_id, location_id, created_at DESC);


--
-- Name: idx_inventory_levels_default_variant_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_inventory_levels_default_variant_unique ON public.inventory_levels USING btree (product_id, location_id) WHERE (variant_id IS NULL);


--
-- Name: idx_inventory_levels_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_levels_location ON public.inventory_levels USING btree (location_id);


--
-- Name: idx_inventory_levels_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_levels_product ON public.inventory_levels USING btree (product_id);


--
-- Name: idx_inventory_levels_variant_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_inventory_levels_variant_unique ON public.inventory_levels USING btree (product_id, variant_id, location_id) WHERE (variant_id IS NOT NULL);


--
-- Name: idx_inventory_locations_store; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_locations_store ON public.inventory_locations USING btree (store_id, status);


--
-- Name: idx_inventory_reservations_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_reservations_order ON public.inventory_reservations USING btree (order_id) WHERE (order_id IS NOT NULL);


--
-- Name: idx_inventory_reservations_product_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_reservations_product_status ON public.inventory_reservations USING btree (product_id, variant_id, status);


--
-- Name: idx_inventory_reservations_store_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_reservations_store_status ON public.inventory_reservations USING btree (store_id, status, expires_at);


--
-- Name: idx_inventory_transfer_lines_transfer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_transfer_lines_transfer ON public.inventory_transfer_lines USING btree (transfer_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_inventory_transfer_receipts_transfer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_transfer_receipts_transfer ON public.inventory_transfer_receipts USING btree (transfer_id, created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_inventory_transfers_site_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_transfers_site_status ON public.inventory_transfers USING btree (site_id, status, created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_leads_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_active ON public.leads USING btree (site_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_leads_store; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_store ON public.leads USING btree (store_id);


--
-- Name: idx_marketplace_apps_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_marketplace_apps_category ON public.marketplace_apps USING btree (category_id);


--
-- Name: idx_marketplace_apps_developer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_marketplace_apps_developer ON public.marketplace_apps USING btree (developer_id);


--
-- Name: idx_marketplace_apps_pricing; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_marketplace_apps_pricing ON public.marketplace_apps USING btree (pricing_model);


--
-- Name: idx_marketplace_apps_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_marketplace_apps_slug ON public.marketplace_apps USING btree (slug);


--
-- Name: idx_marketplace_apps_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_marketplace_apps_status ON public.marketplace_apps USING btree (status);


--
-- Name: idx_marketplace_review_records_developer_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_marketplace_review_records_developer_created ON public.marketplace_review_records USING btree (app_developer_id, created_at DESC) WHERE ((app_developer_id IS NOT NULL) AND (deleted_at IS NULL));


--
-- Name: idx_marketplace_review_records_partner_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_marketplace_review_records_partner_created ON public.marketplace_review_records USING btree (partner_user_id, created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_marketplace_review_records_resource; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_marketplace_review_records_resource ON public.marketplace_review_records USING btree (submission_type, resource_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_marketplace_review_records_status_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_marketplace_review_records_status_created ON public.marketplace_review_records USING btree (status, created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_marketplace_review_records_type_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_marketplace_review_records_type_status ON public.marketplace_review_records USING btree (submission_type, status, submitted_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_media_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_media_active ON public.media USING btree (store_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_media_assets_store_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_media_assets_store_type ON public.media_assets USING btree (store_id, asset_type, created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_media_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_media_created ON public.media USING btree (store_id, created_at DESC);


--
-- Name: idx_media_folder; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_media_folder ON public.media USING btree (store_id, folder);


--
-- Name: idx_media_store; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_media_store ON public.media USING btree (store_id, media_type);


--
-- Name: idx_navigation_menu_items_menu_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_navigation_menu_items_menu_order ON public.navigation_menu_items USING btree (menu_id, parent_item_id, sort_order) WHERE (deleted_at IS NULL);


--
-- Name: idx_navigation_menus_store_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_navigation_menus_store_location ON public.navigation_menus USING btree (store_id, location) WHERE (deleted_at IS NULL);


--
-- Name: idx_notification_prefs_user_store; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_prefs_user_store ON public.notification_preferences USING btree (user_id, store_id);


--
-- Name: idx_notifications_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_active ON public.notifications USING btree (user_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_notifications_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_created ON public.notifications USING btree (created_at DESC);


--
-- Name: idx_notifications_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_type ON public.notifications USING btree (type);


--
-- Name: idx_notifications_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_user ON public.notifications USING btree (user_id, is_read);


--
-- Name: idx_onboarding_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_onboarding_created ON public.onboarding_attempts USING btree (created_at DESC);


--
-- Name: idx_onboarding_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_onboarding_status ON public.onboarding_attempts USING btree (status);


--
-- Name: idx_onboarding_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_onboarding_user ON public.onboarding_attempts USING btree (user_id);


--
-- Name: idx_operation_metrics_name_recorded; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_operation_metrics_name_recorded ON public.operation_metrics USING btree (metric_name, recorded_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_operation_metrics_site_recorded; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_operation_metrics_site_recorded ON public.operation_metrics USING btree (site_id, recorded_at DESC) WHERE ((site_id IS NOT NULL) AND (deleted_at IS NULL));


--
-- Name: idx_operational_certification_reports_env; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_operational_certification_reports_env ON public.operational_certification_reports USING btree (environment, status, generated_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_operational_certification_reports_expiry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_operational_certification_reports_expiry ON public.operational_certification_reports USING btree (environment, expires_at) WHERE ((deleted_at IS NULL) AND (expires_at IS NOT NULL));


--
-- Name: idx_operational_dashboard_snapshots_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_operational_dashboard_snapshots_name ON public.operational_dashboard_snapshots USING btree (environment, dashboard_name, sampled_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_operational_feature_flag_audit_events_flag; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_operational_feature_flag_audit_events_flag ON public.operational_feature_flag_audit_events USING btree (environment, flag_key, recorded_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_operational_feature_flag_exposures_flag; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_operational_feature_flag_exposures_flag ON public.operational_feature_flag_exposures USING btree (environment, flag_key, evaluated_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_operational_feature_flag_exposures_site; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_operational_feature_flag_exposures_site ON public.operational_feature_flag_exposures USING btree (site_id, evaluated_at DESC) WHERE ((deleted_at IS NULL) AND (site_id IS NOT NULL));


--
-- Name: idx_operational_feature_flags_runtime; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_operational_feature_flags_runtime ON public.operational_feature_flags USING btree (environment, owner_runtime, status) WHERE (deleted_at IS NULL);


--
-- Name: idx_operational_feature_flags_site; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_operational_feature_flags_site ON public.operational_feature_flags USING btree (site_id, environment) WHERE ((deleted_at IS NULL) AND (site_id IS NOT NULL));


--
-- Name: idx_order_items_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_items_active ON public.order_items USING btree (order_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_order_items_hsn; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_items_hsn ON public.order_items USING btree (hsn_code) WHERE (hsn_code IS NOT NULL);


--
-- Name: idx_order_items_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_items_order ON public.order_items USING btree (order_id);


--
-- Name: idx_order_items_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_items_product ON public.order_items USING btree (product_id) WHERE (product_id IS NOT NULL);


--
-- Name: idx_order_line_adjustments_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_line_adjustments_order ON public.order_line_adjustments USING btree (order_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_order_shipping_lines_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_shipping_lines_order ON public.order_shipping_lines USING btree (order_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_order_tax_lines_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_tax_lines_order ON public.order_tax_lines USING btree (order_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_orders_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_active ON public.orders USING btree (store_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_orders_last_payment_event_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_last_payment_event_id ON public.orders USING btree (last_payment_event_id) WHERE (last_payment_event_id IS NOT NULL);


--
-- Name: idx_orders_payment_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_payment_id ON public.orders USING btree (payment_id) WHERE (payment_id IS NOT NULL);


--
-- Name: idx_orders_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_status ON public.orders USING btree (status);


--
-- Name: idx_orders_store; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_store ON public.orders USING btree (store_id);


--
-- Name: idx_orders_store_gst_invoice_number; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_orders_store_gst_invoice_number ON public.orders USING btree (store_id, gst_invoice_number) WHERE (gst_invoice_number IS NOT NULL);


--
-- Name: idx_outbox_dead_letters_event_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_outbox_dead_letters_event_type ON public.outbox_dead_letters USING btree (event_type, created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_outbox_dead_letters_site_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_outbox_dead_letters_site_created ON public.outbox_dead_letters USING btree (site_id, created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_outbox_events_dead_lettered; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_outbox_events_dead_lettered ON public.outbox_events USING btree (dead_lettered_at DESC) WHERE (status = 'dead'::text);


--
-- Name: idx_outbox_events_dispatch_claim; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_outbox_events_dispatch_claim ON public.outbox_events USING btree (status, next_attempt_at, available_at, created_at) WHERE (status = ANY (ARRAY['queued'::text, 'failed'::text]));


--
-- Name: idx_outbox_events_event_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_outbox_events_event_id ON public.outbox_events USING btree (event_id);


--
-- Name: idx_outbox_events_locked_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_outbox_events_locked_by ON public.outbox_events USING btree (locked_by, locked_at) WHERE (locked_by IS NOT NULL);


--
-- Name: idx_outbox_events_site_status_available; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_outbox_events_site_status_available ON public.outbox_events USING btree (site_id, status, available_at, created_at);


--
-- Name: idx_outbox_events_status_available; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_outbox_events_status_available ON public.outbox_events USING btree (status, available_at, created_at);


--
-- Name: idx_outbox_events_store_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_outbox_events_store_created ON public.outbox_events USING btree (store_id, created_at DESC) WHERE (store_id IS NOT NULL);


--
-- Name: idx_outbox_events_type_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_outbox_events_type_created ON public.outbox_events USING btree (event_type, created_at DESC);


--
-- Name: idx_pages_store; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pages_store ON public.pages USING btree (store_id);


--
-- Name: idx_pages_store_slug_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pages_store_slug_active ON public.pages USING btree (store_id, slug) WHERE (deleted_at IS NULL);


--
-- Name: idx_pages_store_status_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pages_store_status_active ON public.pages USING btree (store_id, status, updated_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_partner_payout_ledger_partner_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_partner_payout_ledger_partner_created ON public.partner_payout_ledger_entries USING btree (partner_id, created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_partner_payout_ledger_site_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_partner_payout_ledger_site_created ON public.partner_payout_ledger_entries USING btree (site_id, created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_partner_payout_ledger_status_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_partner_payout_ledger_status_created ON public.partner_payout_ledger_entries USING btree (status, created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_payment_attempts_order_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_attempts_order_created ON public.payment_attempts USING btree (order_id, created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_payment_attempts_provider_event; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_payment_attempts_provider_event ON public.payment_attempts USING btree (site_id, provider, provider_event_id) WHERE ((provider_event_id IS NOT NULL) AND (deleted_at IS NULL));


--
-- Name: idx_payment_attempts_site_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_attempts_site_status ON public.payment_attempts USING btree (site_id, status, created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_payment_transactions_idempotency; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_payment_transactions_idempotency ON public.payment_transactions USING btree (site_id, idempotency_key) WHERE ((idempotency_key IS NOT NULL) AND (deleted_at IS NULL));


--
-- Name: idx_payment_transactions_provider_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_transactions_provider_order ON public.payment_transactions USING btree (gateway, provider_order_id) WHERE ((provider_order_id IS NOT NULL) AND (deleted_at IS NULL));


--
-- Name: idx_payment_transactions_site_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_transactions_site_status ON public.payment_transactions USING btree (site_id, status, created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_payment_txn_gateway; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_txn_gateway ON public.payment_transactions USING btree (gateway, gateway_txn_id);


--
-- Name: idx_payment_txn_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_txn_order ON public.payment_transactions USING btree (order_id);


--
-- Name: idx_payment_txn_store; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_txn_store ON public.payment_transactions USING btree (store_id, status);


--
-- Name: idx_payment_webhook_events_event_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_webhook_events_event_type ON public.payment_webhook_events USING btree (event_type, created_at DESC);


--
-- Name: idx_payment_webhook_events_provider_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_webhook_events_provider_status ON public.payment_webhook_events USING btree (provider, processing_status, created_at DESC);


--
-- Name: idx_plan_entitlements_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_plan_entitlements_active ON public.plan_entitlements USING btree (site_type, plan_slug) WHERE ((is_active = true) AND (deleted_at IS NULL));


--
-- Name: idx_plans_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_plans_active ON public.plans USING btree (is_active) WHERE (is_active = true);


--
-- Name: idx_plans_site_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_plans_site_type ON public.plans USING btree (site_type);


--
-- Name: idx_platform_queue_jobs_claim; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_platform_queue_jobs_claim ON public.platform_queue_jobs USING btree (queue_name, status, available_at, created_at) WHERE ((status = ANY (ARRAY['queued'::text, 'failed'::text])) AND (deleted_at IS NULL));


--
-- Name: idx_platform_queue_jobs_event_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_platform_queue_jobs_event_id ON public.platform_queue_jobs USING btree (event_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_platform_queue_jobs_site_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_platform_queue_jobs_site_created ON public.platform_queue_jobs USING btree (site_id, created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_portfolio_projects_store; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_portfolio_projects_store ON public.portfolio_projects USING btree (store_id);


--
-- Name: idx_portfolio_projects_store_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_portfolio_projects_store_active ON public.portfolio_projects USING btree (store_id, display_order) WHERE (deleted_at IS NULL);


--
-- Name: idx_product_options_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_options_product_id ON public.product_options USING btree (product_id);


--
-- Name: idx_product_reviews_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_reviews_active ON public.product_reviews USING btree (product_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_product_reviews_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_reviews_product ON public.product_reviews USING btree (product_id, is_approved, created_at DESC);


--
-- Name: idx_product_reviews_store; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_reviews_store ON public.product_reviews USING btree (store_id, is_approved);


--
-- Name: idx_product_reviews_store_status_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_reviews_store_status_created ON public.product_reviews USING btree (store_id, status, created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_product_variants_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_variants_product_id ON public.product_variants USING btree (product_id);


--
-- Name: idx_production_db_rollout_plans_environment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_production_db_rollout_plans_environment ON public.production_db_rollout_plans USING btree (environment, created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_production_incident_events_incident; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_production_incident_events_incident ON public.production_incident_events USING btree (incident_id, recorded_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_production_incidents_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_production_incidents_status ON public.production_incidents USING btree (status, severity, started_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_production_readiness_gate_runs_env; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_production_readiness_gate_runs_env ON public.production_readiness_gate_runs USING btree (environment, status, created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_products_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_active ON public.products USING btree (site_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_products_store; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_store ON public.products USING btree (store_id);


--
-- Name: idx_products_store_hsn; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_store_hsn ON public.products USING btree (store_id, hsn_code) WHERE (hsn_code IS NOT NULL);


--
-- Name: idx_projection_checkpoints_identity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_projection_checkpoints_identity ON public.projection_checkpoints USING btree (projection_name, projection_version, site_id, object_type, object_id, recorded_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_projection_rebuilds_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_projection_rebuilds_status ON public.projection_rebuilds USING btree (status, created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_projection_store_site_projection; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_projection_store_site_projection ON public.projection_store USING btree (site_id, projection_name, projection_version, updated_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_projection_store_source_event; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_projection_store_source_event ON public.projection_store USING btree (source_event_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_projects_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_projects_active ON public.projects USING btree (site_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_promotion_codes_promotion; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_promotion_codes_promotion ON public.promotion_codes USING btree (promotion_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_promotion_effects_promotion; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_promotion_effects_promotion ON public.promotion_effects USING btree (promotion_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_promotion_redemptions_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_promotion_redemptions_customer ON public.promotion_redemptions USING btree (site_id, customer_email, created_at DESC) WHERE ((customer_email IS NOT NULL) AND (deleted_at IS NULL));


--
-- Name: idx_promotion_redemptions_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_promotion_redemptions_order ON public.promotion_redemptions USING btree (order_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_promotion_rules_promotion; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_promotion_rules_promotion ON public.promotion_rules USING btree (promotion_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_promotion_usage_site; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_promotion_usage_site ON public.promotion_usage_counters USING btree (site_id, updated_at DESC);


--
-- Name: idx_promotions_site_status_priority; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_promotions_site_status_priority ON public.promotions USING btree (site_id, status, priority, created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_provider_health_snapshots_provider; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_provider_health_snapshots_provider ON public.provider_health_snapshots USING btree (provider, operation, checked_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_provider_outage_events_provider; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_provider_outage_events_provider ON public.provider_outage_events USING btree (provider, operation, started_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_purchase_order_lines_po; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_order_lines_po ON public.purchase_order_lines USING btree (purchase_order_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_purchase_order_receipts_po; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_order_receipts_po ON public.purchase_order_receipts USING btree (purchase_order_id, created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_purchase_orders_site_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_orders_site_status ON public.purchase_orders USING btree (site_id, status, created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_query_snapshots_expiry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_query_snapshots_expiry ON public.query_snapshots USING btree (expires_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_queue_operation_snapshots_queue; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_queue_operation_snapshots_queue ON public.queue_operation_snapshots USING btree (queue_name, sampled_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_refund_attempts_refund_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refund_attempts_refund_created ON public.refund_attempts USING btree (refund_transaction_id, created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_refund_lines_refund; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refund_lines_refund ON public.refund_lines USING btree (refund_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_refund_transactions_idempotency; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_refund_transactions_idempotency ON public.refund_transactions USING btree (site_id, idempotency_key) WHERE ((idempotency_key IS NOT NULL) AND (deleted_at IS NULL));


--
-- Name: idx_refund_transactions_order_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refund_transactions_order_created ON public.refund_transactions USING btree (order_id, created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_refunds_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refunds_order ON public.refunds USING btree (order_id, created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_refunds_site_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refunds_site_status ON public.refunds USING btree (site_id, status, created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_regional_routing_overrides_runtime; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_regional_routing_overrides_runtime ON public.regional_routing_overrides USING btree (environment, runtime_root, status, created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_restock_events_return; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_restock_events_return ON public.restock_events USING btree (return_id, created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_return_lines_return; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_return_lines_return ON public.return_lines USING btree (return_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_return_requests_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_return_requests_order ON public.return_requests USING btree (order_id);


--
-- Name: idx_return_requests_store; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_return_requests_store ON public.return_requests USING btree (store_id, status);


--
-- Name: idx_returns_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_returns_order ON public.returns USING btree (order_id, created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_returns_site_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_returns_site_status ON public.returns USING btree (site_id, status, created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_rollout_stage_evidence_runtime; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rollout_stage_evidence_runtime ON public.rollout_stage_evidence USING btree (environment, runtime_root, strategy, created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_runtime_checkpoints_execution; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_runtime_checkpoints_execution ON public.runtime_checkpoints USING btree (execution_id, checkpoint_kind, recorded_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_runtime_checkpoints_site; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_runtime_checkpoints_site ON public.runtime_checkpoints USING btree (site_id, recorded_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_runtime_command_journal_site; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_runtime_command_journal_site ON public.runtime_command_journal USING btree (site_id, created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_runtime_deployment_topology_startup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_runtime_deployment_topology_startup ON public.runtime_deployment_topology_records USING btree (topology_version, startup_order, runtime_name) WHERE (deleted_at IS NULL);


--
-- Name: idx_runtime_diagnostics_runtime; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_runtime_diagnostics_runtime ON public.runtime_diagnostics USING btree (runtime_name, category, created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_runtime_leases_expiry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_runtime_leases_expiry ON public.runtime_leases USING btree (expires_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_runtime_replay_executions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_runtime_replay_executions_status ON public.runtime_replay_executions USING btree (status, created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_runtime_structured_logs_runtime; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_runtime_structured_logs_runtime ON public.runtime_structured_logs USING btree (runtime_name, recorded_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_runtime_telemetry_metrics_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_runtime_telemetry_metrics_created ON public.runtime_telemetry_metrics USING btree (metric_name, created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_runtime_telemetry_metrics_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_runtime_telemetry_metrics_name ON public.runtime_telemetry_metrics USING btree (metric_name, recorded_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_runtime_telemetry_spans_trace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_runtime_telemetry_spans_trace ON public.runtime_telemetry_spans USING btree (trace_id, started_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_search_documents_site_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_search_documents_site_type ON public.search_documents USING btree (site_id, object_type, updated_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_search_documents_vector; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_search_documents_vector ON public.search_documents USING gin (search_vector);


--
-- Name: idx_security_enforcement_events_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_security_enforcement_events_status ON public.security_enforcement_events USING btree (environment, status, severity, recorded_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_sessions_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_expires ON public.sessions USING btree (expires_at);


--
-- Name: idx_sessions_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_token ON public.sessions USING btree (token);


--
-- Name: idx_sessions_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_user ON public.sessions USING btree (user_id);


--
-- Name: idx_shadow_traffic_comparison_runs_runtime; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shadow_traffic_comparison_runs_runtime ON public.shadow_traffic_comparison_runs USING btree (environment, runtime_root, created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_shipment_events_shipment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shipment_events_shipment ON public.shipment_events USING btree (shipment_id, occurred_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_shipments_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shipments_order ON public.shipments USING btree (order_id, created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_shipments_tracking; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shipments_tracking ON public.shipments USING btree (site_id, carrier, tracking_number) WHERE ((tracking_number IS NOT NULL) AND (deleted_at IS NULL));


--
-- Name: idx_shipping_rates_zone_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shipping_rates_zone_active ON public.shipping_rates USING btree (zone_id, is_active, deleted_at);


--
-- Name: idx_shipping_zones_store_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shipping_zones_store_active ON public.shipping_zones USING btree (store_id, deleted_at);


--
-- Name: idx_site_api_clients_site_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_site_api_clients_site_status ON public.site_api_clients USING btree (site_id, status) WHERE (deleted_at IS NULL);


--
-- Name: idx_site_entitlement_overrides_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_site_entitlement_overrides_active ON public.site_entitlement_overrides USING btree (site_id, starts_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_site_gate_attempts_rate; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_site_gate_attempts_rate ON public.site_gate_attempts USING btree (site_id, host, ip, ts DESC);


--
-- Name: idx_site_gate_attempts_site_ts; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_site_gate_attempts_site_ts ON public.site_gate_attempts USING btree (site_id, ts DESC);

--
-- Name: idx_site_domain_reviews_site; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_site_domain_reviews_site ON public.site_domain_reviews USING btree (site_id, created_at DESC) WHERE (deleted_at IS NULL);

--
-- Name: idx_site_domain_reviews_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_site_domain_reviews_status ON public.site_domain_reviews USING btree (status, risk_tier, created_at DESC) WHERE (deleted_at IS NULL);

--
-- Name: idx_domain_orders_site; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_domain_orders_site ON public.domain_orders USING btree (site_id, created_at DESC) WHERE (deleted_at IS NULL);

--
-- Name: idx_domain_orders_domain; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_domain_orders_domain ON public.domain_orders USING btree (lower(domain)) WHERE (deleted_at IS NULL);


--
-- Name: idx_site_memberships_custom_user; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_site_memberships_custom_user ON public.site_memberships USING btree (site_id, custom_user_id) WHERE ((custom_user_id IS NOT NULL) AND (deleted_at IS NULL));


--
-- Name: idx_site_memberships_email; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_site_memberships_email ON public.site_memberships USING btree (site_id, lower(email)) WHERE ((email IS NOT NULL) AND (deleted_at IS NULL));


--
-- Name: idx_site_memberships_legacy_user; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_site_memberships_legacy_user ON public.site_memberships USING btree (site_id, legacy_user_id) WHERE ((legacy_user_id IS NOT NULL) AND (deleted_at IS NULL));


--
-- Name: idx_site_memberships_site_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_site_memberships_site_status ON public.site_memberships USING btree (site_id, status, created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_site_role_permissions_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_site_role_permissions_role ON public.site_role_permissions USING btree (role_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_site_roles_site; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_site_roles_site ON public.site_roles USING btree (site_id, slug) WHERE (deleted_at IS NULL);


--
-- Name: idx_site_roles_system_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_site_roles_system_slug ON public.site_roles USING btree (slug) WHERE ((site_id IS NULL) AND (deleted_at IS NULL));


--
-- Name: idx_site_preview_links_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_site_preview_links_active ON public.site_preview_links USING btree (site_id, jti) WHERE ((revoked_at IS NULL) AND (deleted_at IS NULL));


--
-- Name: idx_site_preview_links_site_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_site_preview_links_site_id ON public.site_preview_links USING btree (site_id, expires_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_site_usage_meters_site_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_site_usage_meters_site_period ON public.site_usage_meters USING btree (site_id, meter_name, period_start DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_sites_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sites_active ON public.sites USING btree (user_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_sites_access_mode; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sites_access_mode ON public.sites USING btree (access_mode) WHERE (deleted_at IS NULL);


--
-- Name: idx_sites_current_theme_release; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sites_current_theme_release ON public.sites USING btree (current_theme_release_id) WHERE (current_theme_release_id IS NOT NULL);


--
-- Name: idx_sites_custom_domain_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sites_custom_domain_status ON public.sites USING btree (custom_domain_status) WHERE (custom_domain_status <> 'none'::text);


--
-- Name: sites_custom_domain_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX sites_custom_domain_unique ON public.sites USING btree (lower(custom_domain)) WHERE ((custom_domain IS NOT NULL) AND (deleted_at IS NULL));


--
-- Name: idx_sites_custom_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sites_custom_user ON public.sites USING btree (custom_user_id);


--
-- Name: idx_sites_gstin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sites_gstin ON public.sites USING btree (gstin) WHERE (gstin IS NOT NULL);


--
-- Name: idx_sites_published; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sites_published ON public.sites USING btree (published) WHERE (deleted_at IS NULL);


--
-- Name: idx_sites_site_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sites_site_type ON public.sites USING btree (site_type);


--
-- Name: idx_sites_storefront_release_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sites_storefront_release_version ON public.sites USING btree (id, storefront_release_version);


--
-- Name: idx_sites_trial_ends; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sites_trial_ends ON public.sites USING btree (trial_ends_at);


--
-- Name: idx_sites_trial_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sites_trial_status ON public.sites USING btree (trial_status);


--
-- Name: idx_skills_store_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_skills_store_active ON public.skills USING btree (store_id, display_order) WHERE (deleted_at IS NULL);


--
-- Name: idx_sre_error_budget_snapshots_runtime; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sre_error_budget_snapshots_runtime ON public.sre_error_budget_snapshots USING btree (environment, runtime_name, sampled_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_store_customers_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_store_customers_active ON public.store_customers USING btree (store_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_store_customers_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_store_customers_created ON public.store_customers USING btree (store_id, created_at DESC);


--
-- Name: idx_store_customers_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_store_customers_email ON public.store_customers USING btree (email);


--
-- Name: idx_store_customers_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_store_customers_status ON public.store_customers USING btree (store_id, status);


--
-- Name: idx_store_customers_store_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_store_customers_store_id ON public.store_customers USING btree (store_id);


--
-- Name: idx_store_themes_store; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_store_themes_store ON public.store_themes USING btree (store_id, is_active);


--
-- Name: idx_storefront_cache_tags_invalidated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_storefront_cache_tags_invalidated ON public.storefront_cache_tags USING btree (invalidated_at DESC) WHERE (invalidated_at IS NOT NULL);


--
-- Name: idx_storefront_cache_tags_store; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_storefront_cache_tags_store ON public.storefront_cache_tags USING btree (store_id, created_at DESC);


--
-- Name: idx_storefront_pages_store_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_storefront_pages_store_status ON public.storefront_pages USING btree (store_id, status, updated_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_stores_site_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stores_site_type ON public.sites USING btree (site_type);


--
-- Name: idx_stores_subdomain; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stores_subdomain ON public.sites USING btree (subdomain);


--
-- Name: idx_stores_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stores_user_id ON public.sites USING btree (user_id);


--
-- Name: idx_subscriptions_external_subscription_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_external_subscription_id ON public.subscriptions USING btree (external_subscription_id) WHERE (external_subscription_id IS NOT NULL);


--
-- Name: idx_subscriptions_razorpay_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_razorpay_order_id ON public.subscriptions USING btree (razorpay_order_id) WHERE (razorpay_order_id IS NOT NULL);


--
-- Name: idx_subscriptions_razorpay_payment_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_razorpay_payment_id ON public.subscriptions USING btree (razorpay_payment_id) WHERE (razorpay_payment_id IS NOT NULL);


--
-- Name: idx_subscriptions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_status ON public.subscriptions USING btree (status);


--
-- Name: idx_subscriptions_store; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_store ON public.subscriptions USING btree (store_id);


--
-- Name: idx_subscriptions_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_user ON public.subscriptions USING btree (user_id);


--
-- Name: idx_suppliers_site_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_suppliers_site_status ON public.suppliers USING btree (site_id, status, name) WHERE (deleted_at IS NULL);


--
-- Name: idx_tax_rates_store; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tax_rates_store ON public.tax_rates USING btree (store_id, is_active);


--
-- Name: idx_testimonials_store_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_testimonials_store_active ON public.testimonials USING btree (store_id, display_order) WHERE (deleted_at IS NULL);


--
-- Name: idx_theme_assets_package_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_theme_assets_package_type ON public.theme_assets USING btree (theme_package_version_id, asset_type) WHERE (deleted_at IS NULL);


--
-- Name: idx_theme_draft_patches_draft_sequence; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_theme_draft_patches_draft_sequence ON public.theme_draft_patches USING btree (draft_id, patch_sequence);


--
-- Name: idx_theme_draft_patches_store_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_theme_draft_patches_store_created ON public.theme_draft_patches USING btree (store_id, created_at DESC);


--
-- Name: idx_theme_editor_drafts_store_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_theme_editor_drafts_store_id ON public.theme_editor_drafts USING btree (store_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_theme_editor_drafts_theme_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_theme_editor_drafts_theme_id ON public.theme_editor_drafts USING btree (theme_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_theme_instance_drafts_one_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_theme_instance_drafts_one_active ON public.theme_instance_drafts USING btree (theme_instance_id) WHERE ((draft_status = 'active'::text) AND (deleted_at IS NULL));


--
-- Name: idx_theme_instance_drafts_store; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_theme_instance_drafts_store ON public.theme_instance_drafts USING btree (store_id, updated_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_theme_instances_one_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_theme_instances_one_active ON public.theme_instances USING btree (store_id) WHERE ((instance_status = 'active'::text) AND (deleted_at IS NULL));


--
-- Name: idx_theme_instances_store_package_live; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_theme_instances_store_package_live ON public.theme_instances USING btree (store_id, theme_package_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_theme_instances_store_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_theme_instances_store_status ON public.theme_instances USING btree (store_id, instance_status) WHERE (deleted_at IS NULL);


--
-- Name: idx_theme_package_versions_package; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_theme_package_versions_package ON public.theme_package_versions USING btree (theme_package_id, version_number DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_theme_package_versions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_theme_package_versions_status ON public.theme_package_versions USING btree (release_status, published_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_theme_packages_site_types; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_theme_packages_site_types ON public.theme_packages USING gin (site_types);


--
-- Name: idx_theme_packages_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_theme_packages_status ON public.theme_packages USING btree (status, created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_theme_preview_sessions_instance_draft; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_theme_preview_sessions_instance_draft ON public.theme_preview_sessions USING btree (theme_instance_draft_id) WHERE (theme_instance_draft_id IS NOT NULL);


--
-- Name: idx_theme_preview_sessions_store; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_theme_preview_sessions_store ON public.theme_preview_sessions USING btree (store_id, created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_theme_preview_sessions_token_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_theme_preview_sessions_token_active ON public.theme_preview_sessions USING btree (token_hash, expires_at) WHERE ((revoked_at IS NULL) AND (deleted_at IS NULL));


--
-- Name: idx_theme_purchases_payment_idempotency; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_theme_purchases_payment_idempotency ON public.theme_purchases USING btree (user_id, theme_id, payment_idempotency_key) WHERE ((payment_idempotency_key IS NOT NULL) AND (deleted_at IS NULL));


--
-- Name: idx_theme_purchases_provider_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_theme_purchases_provider_order ON public.theme_purchases USING btree (payment_provider, provider_order_id) WHERE ((provider_order_id IS NOT NULL) AND (deleted_at IS NULL));


--
-- Name: idx_theme_purchases_provider_payment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_theme_purchases_provider_payment ON public.theme_purchases USING btree (payment_provider, provider_payment_id) WHERE ((provider_payment_id IS NOT NULL) AND (deleted_at IS NULL));


--
-- Name: idx_theme_purchases_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_theme_purchases_status ON public.theme_purchases USING btree (status);


--
-- Name: idx_theme_purchases_theme; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_theme_purchases_theme ON public.theme_purchases USING btree (theme_id);


--
-- Name: idx_theme_purchases_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_theme_purchases_user ON public.theme_purchases USING btree (user_id);


--
-- Name: idx_theme_purchases_user_status_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_theme_purchases_user_status_active ON public.theme_purchases USING btree (user_id, status, purchased_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_theme_releases_instance_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_theme_releases_instance_version ON public.theme_releases USING btree (theme_instance_id, release_version DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_theme_releases_one_current; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_theme_releases_one_current ON public.theme_releases USING btree (store_id) WHERE ((is_current = true) AND (deleted_at IS NULL));


--
-- Name: idx_theme_releases_package_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_theme_releases_package_version ON public.theme_releases USING btree (theme_package_version_id, published_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_theme_releases_store_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_theme_releases_store_version ON public.theme_releases USING btree (store_id, release_version DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_theme_releases_theme; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_theme_releases_theme ON public.theme_releases USING btree (theme_id, published_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_theme_reviews_rating; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_theme_reviews_rating ON public.theme_reviews USING btree (rating);


--
-- Name: idx_theme_reviews_theme; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_theme_reviews_theme ON public.theme_reviews USING btree (theme_id);


--
-- Name: idx_theme_reviews_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_theme_reviews_user ON public.theme_reviews USING btree (user_id);


--
-- Name: idx_theme_section_definitions_renderer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_theme_section_definitions_renderer ON public.theme_section_definitions USING btree (renderer_key) WHERE (deleted_at IS NULL);


--
-- Name: idx_theme_template_assignments_store_route; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_theme_template_assignments_store_route ON public.theme_template_assignments USING btree (store_id, route_type, route_key, priority) WHERE (deleted_at IS NULL);


--
-- Name: idx_theme_templates_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_theme_templates_type ON public.theme_templates USING btree (theme_package_version_id, template_type) WHERE (deleted_at IS NULL);


--
-- Name: idx_themes_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_themes_category ON public.themes USING btree (category);


--
-- Name: idx_themes_industry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_themes_industry ON public.themes USING gin (industry);


--
-- Name: idx_themes_pricing; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_themes_pricing ON public.themes USING btree (letbuyy_pricing_type);


--
-- Name: idx_themes_supported_types; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_themes_supported_types ON public.themes USING gin (supported_site_types);


--
-- Name: idx_themes_tags; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_themes_tags ON public.themes USING gin (tags);


--
-- Name: idx_themes_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_themes_type ON public.themes USING btree (site_type, is_active);


--
-- Name: idx_tokens_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tokens_email ON public.verification_tokens USING btree (email);


--
-- Name: idx_tokens_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tokens_expires ON public.verification_tokens USING btree (expires_at);


--
-- Name: idx_tokens_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tokens_token ON public.verification_tokens USING btree (token);


--
-- Name: idx_usage_meter_entries_site_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_usage_meter_entries_site_created ON public.usage_meter_entries USING btree (site_id, meter_name, created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_users_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_active ON public.users USING btree (id) WHERE (deleted_at IS NULL);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_email ON public.users_custom USING btree (email);


--
-- Name: idx_webhook_deliveries_claim; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_webhook_deliveries_claim ON public.webhook_deliveries USING btree (status, next_attempt_at, created_at) WHERE ((status = ANY (ARRAY['pending'::text, 'failed'::text])) AND (deleted_at IS NULL));


--
-- Name: idx_webhook_deliveries_event_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_webhook_deliveries_event_id ON public.webhook_deliveries USING btree (event_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_webhook_deliveries_site_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_webhook_deliveries_site_created ON public.webhook_deliveries USING btree (site_id, created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_webhook_subscriptions_events; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_webhook_subscriptions_events ON public.webhook_subscriptions USING gin (event_types);


--
-- Name: idx_webhook_subscriptions_site_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_webhook_subscriptions_site_status ON public.webhook_subscriptions USING btree (site_id, status) WHERE (deleted_at IS NULL);


--
-- Name: idx_wishlists_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wishlists_customer ON public.wishlists USING btree (store_id, customer_email);


--
-- Name: idx_wishlists_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wishlists_product ON public.wishlists USING btree (product_id);


--
-- Name: idx_work_experience_store_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_work_experience_store_active ON public.work_experience USING btree (store_id, display_order) WHERE (deleted_at IS NULL);


--
-- Name: idx_worker_request_logs_request_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_worker_request_logs_request_id ON public.worker_request_logs USING btree (request_id);


--
-- Name: idx_worker_request_logs_route_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_worker_request_logs_route_status ON public.worker_request_logs USING btree (path, status_code, created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_worker_request_logs_site_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_worker_request_logs_site_created ON public.worker_request_logs USING btree (site_id, created_at DESC) WHERE ((site_id IS NOT NULL) AND (deleted_at IS NULL));


--
-- Name: idx_workflow_heartbeats_execution; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workflow_heartbeats_execution ON public.workflow_heartbeats USING btree (execution_id, heartbeat_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_workflow_lifecycle_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workflow_lifecycle_status ON public.workflow_lifecycle USING btree (status, updated_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_workflow_operation_snapshots_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workflow_operation_snapshots_name ON public.workflow_operation_snapshots USING btree (workflow_name, sampled_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: employee_invites audit_employee_invites; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_employee_invites AFTER INSERT OR DELETE OR UPDATE ON public.employee_invites FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();


--
-- Name: employees audit_employees; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_employees AFTER INSERT OR DELETE OR UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();


--
-- Name: subscriptions audit_subscriptions; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_subscriptions AFTER INSERT OR DELETE OR UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();


--
-- Name: super_admin_allowlist audit_super_admins; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_super_admins AFTER INSERT OR DELETE OR UPDATE ON public.super_admin_allowlist FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();


--
-- Name: app_installations notify_app_install; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER notify_app_install AFTER INSERT ON public.app_installations FOR EACH ROW EXECUTE FUNCTION public.notify_on_app_install();


--
-- Name: theme_purchases notify_theme_purchase; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER notify_theme_purchase AFTER INSERT ON public.theme_purchases FOR EACH ROW EXECUTE FUNCTION public.notify_on_theme_purchase();


--
-- Name: orders set_order_number; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_order_number BEFORE INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION public.generate_order_number();


--
-- Name: shipping_rates shipping_rates_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER shipping_rates_updated_at BEFORE UPDATE ON public.shipping_rates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: shipping_zones shipping_zones_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER shipping_zones_updated_at BEFORE UPDATE ON public.shipping_zones FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: ai_credits trg_ai_credits_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ai_credits_updated_at BEFORE UPDATE ON public.ai_credits FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: blog_categories trg_blog_categories_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_blog_categories_updated_at BEFORE UPDATE ON public.blog_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: blog_comments trg_blog_comments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_blog_comments_updated_at BEFORE UPDATE ON public.blog_comments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: blog_posts trg_blog_posts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_blog_posts_updated_at BEFORE UPDATE ON public.blog_posts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: blog_posts trg_blog_posts_version; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_blog_posts_version BEFORE UPDATE ON public.blog_posts FOR EACH ROW EXECUTE FUNCTION public.increment_version();


--
-- Name: checkout_sessions trg_checkout_sessions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_checkout_sessions_updated_at BEFORE UPDATE ON public.checkout_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: coupons trg_coupons_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_coupons_updated_at BEFORE UPDATE ON public.coupons FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: coupons trg_coupons_version; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_coupons_version BEFORE UPDATE ON public.coupons FOR EACH ROW EXECUTE FUNCTION public.increment_version();


--
-- Name: customer_addresses trg_customer_addresses_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_customer_addresses_updated_at BEFORE UPDATE ON public.customer_addresses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: customer_credentials trg_customer_credentials_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_customer_credentials_updated_at BEFORE UPDATE ON public.customer_credentials FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: form_submissions trg_form_submissions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_form_submissions_updated_at BEFORE UPDATE ON public.form_submissions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: fulfillment_order_lines trg_fulfillment_order_lines_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_fulfillment_order_lines_updated_at BEFORE UPDATE ON public.fulfillment_order_lines FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: fulfillment_orders trg_fulfillment_orders_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_fulfillment_orders_updated_at BEFORE UPDATE ON public.fulfillment_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: gift_card_accounts trg_gift_card_accounts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_gift_card_accounts_updated_at BEFORE UPDATE ON public.gift_card_accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: gift_card_ledger_entries trg_gift_card_ledger_entries_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_gift_card_ledger_entries_updated_at BEFORE UPDATE ON public.gift_card_ledger_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: gift_card_redemptions trg_gift_card_redemptions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_gift_card_redemptions_updated_at BEFORE UPDATE ON public.gift_card_redemptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: inventory_events trg_inventory_events_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_inventory_events_updated_at BEFORE UPDATE ON public.inventory_events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: inventory_transfer_lines trg_inventory_transfer_lines_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_inventory_transfer_lines_updated_at BEFORE UPDATE ON public.inventory_transfer_lines FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: inventory_transfer_receipts trg_inventory_transfer_receipts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_inventory_transfer_receipts_updated_at BEFORE UPDATE ON public.inventory_transfer_receipts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: inventory_transfers trg_inventory_transfers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_inventory_transfers_updated_at BEFORE UPDATE ON public.inventory_transfers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: lead_forms trg_lead_forms_version; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lead_forms_version BEFORE UPDATE ON public.lead_forms FOR EACH ROW EXECUTE FUNCTION public.increment_version();


--
-- Name: media trg_media_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_media_updated_at BEFORE UPDATE ON public.media FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: notification_preferences trg_notification_prefs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_notification_prefs_updated_at BEFORE UPDATE ON public.notification_preferences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: order_items trg_order_items_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_order_items_updated_at BEFORE UPDATE ON public.order_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: order_line_adjustments trg_order_line_adjustments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_order_line_adjustments_updated_at BEFORE UPDATE ON public.order_line_adjustments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: order_shipping_lines trg_order_shipping_lines_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_order_shipping_lines_updated_at BEFORE UPDATE ON public.order_shipping_lines FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: order_tax_lines trg_order_tax_lines_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_order_tax_lines_updated_at BEFORE UPDATE ON public.order_tax_lines FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: orders trg_orders_version; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_orders_version BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.increment_version();


--
-- Name: payment_attempts trg_payment_attempts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_payment_attempts_updated_at BEFORE UPDATE ON public.payment_attempts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: payment_transactions trg_payment_transactions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_payment_transactions_updated_at BEFORE UPDATE ON public.payment_transactions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: plans trg_plans_version; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_plans_version BEFORE UPDATE ON public.plans FOR EACH ROW EXECUTE FUNCTION public.increment_version();


--
-- Name: product_reviews trg_product_reviews_moderation_status; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_product_reviews_moderation_status BEFORE INSERT OR UPDATE ON public.product_reviews FOR EACH ROW EXECUTE FUNCTION public.sync_product_review_moderation_status();


--
-- Name: products trg_products_version; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_products_version BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.increment_version();


--
-- Name: projects trg_projects_version; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_projects_version BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.increment_version();


--
-- Name: promotion_codes trg_promotion_codes_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_promotion_codes_updated_at BEFORE UPDATE ON public.promotion_codes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: promotion_effects trg_promotion_effects_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_promotion_effects_updated_at BEFORE UPDATE ON public.promotion_effects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: promotion_redemptions trg_promotion_redemptions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_promotion_redemptions_updated_at BEFORE UPDATE ON public.promotion_redemptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: promotion_rules trg_promotion_rules_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_promotion_rules_updated_at BEFORE UPDATE ON public.promotion_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: promotion_usage_counters trg_promotion_usage_counters_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_promotion_usage_counters_updated_at BEFORE UPDATE ON public.promotion_usage_counters FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: promotions trg_promotions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_promotions_updated_at BEFORE UPDATE ON public.promotions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: purchase_order_lines trg_purchase_order_lines_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_purchase_order_lines_updated_at BEFORE UPDATE ON public.purchase_order_lines FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: purchase_order_receipts trg_purchase_order_receipts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_purchase_order_receipts_updated_at BEFORE UPDATE ON public.purchase_order_receipts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: purchase_orders trg_purchase_orders_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_purchase_orders_updated_at BEFORE UPDATE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: refund_attempts trg_refund_attempts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_refund_attempts_updated_at BEFORE UPDATE ON public.refund_attempts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: refund_lines trg_refund_lines_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_refund_lines_updated_at BEFORE UPDATE ON public.refund_lines FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: refund_transactions trg_refund_transactions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_refund_transactions_updated_at BEFORE UPDATE ON public.refund_transactions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: refunds trg_refunds_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_refunds_updated_at BEFORE UPDATE ON public.refunds FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: restock_events trg_restock_events_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_restock_events_updated_at BEFORE UPDATE ON public.restock_events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: return_lines trg_return_lines_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_return_lines_updated_at BEFORE UPDATE ON public.return_lines FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: return_requests trg_return_requests_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_return_requests_updated_at BEFORE UPDATE ON public.return_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: returns trg_returns_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_returns_updated_at BEFORE UPDATE ON public.returns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: shipment_events trg_shipment_events_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_shipment_events_updated_at BEFORE UPDATE ON public.shipment_events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: shipments trg_shipments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_shipments_updated_at BEFORE UPDATE ON public.shipments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: site_gate_attempts update_site_gate_attempts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_site_gate_attempts_updated_at BEFORE UPDATE ON public.site_gate_attempts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

--
-- Name: site_domain_reviews update_site_domain_reviews_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_site_domain_reviews_updated_at BEFORE UPDATE ON public.site_domain_reviews FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

--
-- Name: domain_orders update_domain_orders_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_domain_orders_updated_at BEFORE UPDATE ON public.domain_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: site_preview_links update_site_preview_links_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_site_preview_links_updated_at BEFORE UPDATE ON public.site_preview_links FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: sites trg_sites_version; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sites_version BEFORE UPDATE ON public.sites FOR EACH ROW EXECUTE FUNCTION public.increment_version();


--
-- Name: smart_collections trg_smart_collections_version; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_smart_collections_version BEFORE UPDATE ON public.smart_collections FOR EACH ROW EXECUTE FUNCTION public.increment_version();


--
-- Name: store_customers trg_store_customers_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_store_customers_updated BEFORE UPDATE ON public.store_customers FOR EACH ROW EXECUTE FUNCTION public.update_store_customers_updated_at();


--
-- Name: suppliers trg_suppliers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_suppliers_updated_at BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: tax_rates trg_tax_rates_version; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_tax_rates_version BEFORE UPDATE ON public.tax_rates FOR EACH ROW EXECUTE FUNCTION public.increment_version();


--
-- Name: users trg_users_version; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_users_version BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.increment_version();


--
-- Name: analytics_event_stream update_analytics_event_stream_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_analytics_event_stream_updated_at BEFORE UPDATE ON public.analytics_event_stream FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: analytics_rollups_daily update_analytics_rollups_daily_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_analytics_rollups_daily_updated_at BEFORE UPDATE ON public.analytics_rollups_daily FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: app_billing_charges update_app_billing_charges_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_app_billing_charges_updated_at BEFORE UPDATE ON public.app_billing_charges FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: app_developers update_app_developers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_app_developers_updated_at BEFORE UPDATE ON public.app_developers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: app_reviews update_app_rating_on_review; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_app_rating_on_review AFTER INSERT OR DELETE OR UPDATE ON public.app_reviews FOR EACH ROW EXECUTE FUNCTION public.update_app_rating();


--
-- Name: app_reviews update_app_reviews_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_app_reviews_updated_at BEFORE UPDATE ON public.app_reviews FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: cache_invalidation_events update_cache_invalidation_events_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_cache_invalidation_events_updated_at BEFORE UPDATE ON public.cache_invalidation_events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: cache_operation_snapshots update_cache_operation_snapshots_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_cache_operation_snapshots_updated_at BEFORE UPDATE ON public.cache_operation_snapshots FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: carts update_carts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_carts_updated_at BEFORE UPDATE ON public.carts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: chaos_experiment_runs update_chaos_experiment_runs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_chaos_experiment_runs_updated_at BEFORE UPDATE ON public.chaos_experiment_runs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: coordination_operation_diagnostics update_coordination_operation_diagnostics_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_coordination_operation_diagnostics_updated_at BEFORE UPDATE ON public.coordination_operation_diagnostics FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: database_operation_snapshots update_database_operation_snapshots_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_database_operation_snapshots_updated_at BEFORE UPDATE ON public.database_operation_snapshots FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: deployment_health_gate_results update_deployment_health_gate_results_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_deployment_health_gate_results_updated_at BEFORE UPDATE ON public.deployment_health_gate_results FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: deployment_promotion_runs update_deployment_promotion_runs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_deployment_promotion_runs_updated_at BEFORE UPDATE ON public.deployment_promotion_runs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: distributed_event_store update_distributed_event_store_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_distributed_event_store_updated_at BEFORE UPDATE ON public.distributed_event_store FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: distributed_event_streams update_distributed_event_streams_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_distributed_event_streams_updated_at BEFORE UPDATE ON public.distributed_event_streams FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: distributed_queue_heartbeats update_distributed_queue_heartbeats_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_distributed_queue_heartbeats_updated_at BEFORE UPDATE ON public.distributed_queue_heartbeats FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: distributed_queue_messages update_distributed_queue_messages_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_distributed_queue_messages_updated_at BEFORE UPDATE ON public.distributed_queue_messages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: event_store_integrity_checks update_event_store_integrity_checks_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_event_store_integrity_checks_updated_at BEFORE UPDATE ON public.event_store_integrity_checks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: event_stream_snapshots update_event_stream_snapshots_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_event_stream_snapshots_updated_at BEFORE UPDATE ON public.event_stream_snapshots FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: execution_audit_trail update_execution_audit_trail_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_execution_audit_trail_updated_at BEFORE UPDATE ON public.execution_audit_trail FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: failover_drill_runs update_failover_drill_runs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_failover_drill_runs_updated_at BEFORE UPDATE ON public.failover_drill_runs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: idempotency_keys update_idempotency_keys_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_idempotency_keys_updated_at BEFORE UPDATE ON public.idempotency_keys FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: app_installations update_install_count_on_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_install_count_on_change AFTER INSERT OR DELETE OR UPDATE ON public.app_installations FOR EACH ROW EXECUTE FUNCTION public.update_app_install_count();


--
-- Name: inventory_levels update_inventory_levels_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_inventory_levels_updated_at BEFORE UPDATE ON public.inventory_levels FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: inventory_reservations update_inventory_reservations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_inventory_reservations_updated_at BEFORE UPDATE ON public.inventory_reservations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: load_test_runs update_load_test_runs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_load_test_runs_updated_at BEFORE UPDATE ON public.load_test_runs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: marketplace_apps update_marketplace_apps_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_marketplace_apps_updated_at BEFORE UPDATE ON public.marketplace_apps FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: marketplace_review_records update_marketplace_review_records_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_marketplace_review_records_updated_at BEFORE UPDATE ON public.marketplace_review_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: media_assets update_media_assets_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_media_assets_updated_at BEFORE UPDATE ON public.media_assets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: navigation_menu_items update_navigation_menu_items_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_navigation_menu_items_updated_at BEFORE UPDATE ON public.navigation_menu_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: navigation_menus update_navigation_menus_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_navigation_menus_updated_at BEFORE UPDATE ON public.navigation_menus FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: notification_preferences update_notification_prefs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_notification_prefs_updated_at BEFORE UPDATE ON public.notification_preferences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: operation_metrics update_operation_metrics_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_operation_metrics_updated_at BEFORE UPDATE ON public.operation_metrics FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: operational_certification_reports update_operational_certification_reports_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_operational_certification_reports_updated_at BEFORE UPDATE ON public.operational_certification_reports FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: operational_dashboard_snapshots update_operational_dashboard_snapshots_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_operational_dashboard_snapshots_updated_at BEFORE UPDATE ON public.operational_dashboard_snapshots FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: operational_feature_flag_audit_events update_operational_feature_flag_audit_events_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_operational_feature_flag_audit_events_updated_at BEFORE UPDATE ON public.operational_feature_flag_audit_events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: operational_feature_flag_exposures update_operational_feature_flag_exposures_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_operational_feature_flag_exposures_updated_at BEFORE UPDATE ON public.operational_feature_flag_exposures FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: operational_feature_flags update_operational_feature_flags_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_operational_feature_flags_updated_at BEFORE UPDATE ON public.operational_feature_flags FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: orders update_orders_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: outbox_dead_letters update_outbox_dead_letters_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_outbox_dead_letters_updated_at BEFORE UPDATE ON public.outbox_dead_letters FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: outbox_events update_outbox_events_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_outbox_events_updated_at BEFORE UPDATE ON public.outbox_events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: pages update_pages_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_pages_updated_at BEFORE UPDATE ON public.pages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: partner_payout_ledger_entries update_partner_payout_ledger_entries_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_partner_payout_ledger_entries_updated_at BEFORE UPDATE ON public.partner_payout_ledger_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: payment_webhook_events update_payment_webhook_events_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_payment_webhook_events_updated_at BEFORE UPDATE ON public.payment_webhook_events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: plan_entitlements update_plan_entitlements_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_plan_entitlements_updated_at BEFORE UPDATE ON public.plan_entitlements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: plans update_plans_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_plans_updated_at BEFORE UPDATE ON public.plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: platform_queue_jobs update_platform_queue_jobs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_platform_queue_jobs_updated_at BEFORE UPDATE ON public.platform_queue_jobs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: portfolio_projects update_portfolio_projects_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_portfolio_projects_updated_at BEFORE UPDATE ON public.portfolio_projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: production_db_rollout_plans update_production_db_rollout_plans_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_production_db_rollout_plans_updated_at BEFORE UPDATE ON public.production_db_rollout_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: production_incident_events update_production_incident_events_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_production_incident_events_updated_at BEFORE UPDATE ON public.production_incident_events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: production_incidents update_production_incidents_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_production_incidents_updated_at BEFORE UPDATE ON public.production_incidents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: production_readiness_gate_runs update_production_readiness_gate_runs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_production_readiness_gate_runs_updated_at BEFORE UPDATE ON public.production_readiness_gate_runs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: products update_products_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: projection_checkpoints update_projection_checkpoints_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_projection_checkpoints_updated_at BEFORE UPDATE ON public.projection_checkpoints FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: projection_operation_snapshots update_projection_operation_snapshots_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_projection_operation_snapshots_updated_at BEFORE UPDATE ON public.projection_operation_snapshots FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: projection_rebuilds update_projection_rebuilds_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_projection_rebuilds_updated_at BEFORE UPDATE ON public.projection_rebuilds FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: projection_store update_projection_store_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_projection_store_updated_at BEFORE UPDATE ON public.projection_store FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: provider_health_snapshots update_provider_health_snapshots_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_provider_health_snapshots_updated_at BEFORE UPDATE ON public.provider_health_snapshots FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: provider_outage_events update_provider_outage_events_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_provider_outage_events_updated_at BEFORE UPDATE ON public.provider_outage_events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: provider_recovery_plans update_provider_recovery_plans_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_provider_recovery_plans_updated_at BEFORE UPDATE ON public.provider_recovery_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: query_snapshots update_query_snapshots_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_query_snapshots_updated_at BEFORE UPDATE ON public.query_snapshots FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: queue_operation_snapshots update_queue_operation_snapshots_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_queue_operation_snapshots_updated_at BEFORE UPDATE ON public.queue_operation_snapshots FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: queue_recovery_operations update_queue_recovery_operations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_queue_recovery_operations_updated_at BEFORE UPDATE ON public.queue_recovery_operations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: regional_execution_diagnostics update_regional_execution_diagnostics_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_regional_execution_diagnostics_updated_at BEFORE UPDATE ON public.regional_execution_diagnostics FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: regional_routing_overrides update_regional_routing_overrides_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_regional_routing_overrides_updated_at BEFORE UPDATE ON public.regional_routing_overrides FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: replay_dry_run_results update_replay_dry_run_results_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_replay_dry_run_results_updated_at BEFORE UPDATE ON public.replay_dry_run_results FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: replay_operation_schedules update_replay_operation_schedules_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_replay_operation_schedules_updated_at BEFORE UPDATE ON public.replay_operation_schedules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: rollout_stage_evidence update_rollout_stage_evidence_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_rollout_stage_evidence_updated_at BEFORE UPDATE ON public.rollout_stage_evidence FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: runtime_alert_evaluations update_runtime_alert_evaluations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_runtime_alert_evaluations_updated_at BEFORE UPDATE ON public.runtime_alert_evaluations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: runtime_checkpoints update_runtime_checkpoints_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_runtime_checkpoints_updated_at BEFORE UPDATE ON public.runtime_checkpoints FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: runtime_command_journal update_runtime_command_journal_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_runtime_command_journal_updated_at BEFORE UPDATE ON public.runtime_command_journal FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: runtime_control_commands update_runtime_control_commands_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_runtime_control_commands_updated_at BEFORE UPDATE ON public.runtime_control_commands FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: runtime_deployment_topology_records update_runtime_deployment_topology_records_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_runtime_deployment_topology_records_updated_at BEFORE UPDATE ON public.runtime_deployment_topology_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: runtime_diagnostics update_runtime_diagnostics_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_runtime_diagnostics_updated_at BEFORE UPDATE ON public.runtime_diagnostics FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: runtime_event_retention_policies update_runtime_event_retention_policies_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_runtime_event_retention_policies_updated_at BEFORE UPDATE ON public.runtime_event_retention_policies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: runtime_health_projections update_runtime_health_projections_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_runtime_health_projections_updated_at BEFORE UPDATE ON public.runtime_health_projections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: runtime_leases update_runtime_leases_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_runtime_leases_updated_at BEFORE UPDATE ON public.runtime_leases FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: runtime_replay_executions update_runtime_replay_executions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_runtime_replay_executions_updated_at BEFORE UPDATE ON public.runtime_replay_executions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: runtime_secret_rotation_events update_runtime_secret_rotation_events_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_runtime_secret_rotation_events_updated_at BEFORE UPDATE ON public.runtime_secret_rotation_events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: runtime_slo_definitions update_runtime_slo_definitions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_runtime_slo_definitions_updated_at BEFORE UPDATE ON public.runtime_slo_definitions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: runtime_structured_logs update_runtime_structured_logs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_runtime_structured_logs_updated_at BEFORE UPDATE ON public.runtime_structured_logs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: runtime_telemetry_metrics update_runtime_telemetry_metrics_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_runtime_telemetry_metrics_updated_at BEFORE UPDATE ON public.runtime_telemetry_metrics FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: runtime_telemetry_spans update_runtime_telemetry_spans_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_runtime_telemetry_spans_updated_at BEFORE UPDATE ON public.runtime_telemetry_spans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: sandbox_provider_contracts update_sandbox_provider_contracts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_sandbox_provider_contracts_updated_at BEFORE UPDATE ON public.sandbox_provider_contracts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: search_documents update_search_documents_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_search_documents_updated_at BEFORE UPDATE ON public.search_documents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: security_enforcement_events update_security_enforcement_events_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_security_enforcement_events_updated_at BEFORE UPDATE ON public.security_enforcement_events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: shadow_traffic_comparison_runs update_shadow_traffic_comparison_runs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_shadow_traffic_comparison_runs_updated_at BEFORE UPDATE ON public.shadow_traffic_comparison_runs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: site_api_clients update_site_api_clients_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_site_api_clients_updated_at BEFORE UPDATE ON public.site_api_clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: site_entitlement_overrides update_site_entitlement_overrides_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_site_entitlement_overrides_updated_at BEFORE UPDATE ON public.site_entitlement_overrides FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: site_memberships update_site_memberships_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_site_memberships_updated_at BEFORE UPDATE ON public.site_memberships FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: site_role_permissions update_site_role_permissions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_site_role_permissions_updated_at BEFORE UPDATE ON public.site_role_permissions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: site_roles update_site_roles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_site_roles_updated_at BEFORE UPDATE ON public.site_roles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: site_usage_meters update_site_usage_meters_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_site_usage_meters_updated_at BEFORE UPDATE ON public.site_usage_meters FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: sre_error_budget_snapshots update_sre_error_budget_snapshots_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_sre_error_budget_snapshots_updated_at BEFORE UPDATE ON public.sre_error_budget_snapshots FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: storefront_cache_tags update_storefront_cache_tags_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_storefront_cache_tags_updated_at BEFORE UPDATE ON public.storefront_cache_tags FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: storefront_pages update_storefront_pages_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_storefront_pages_updated_at BEFORE UPDATE ON public.storefront_pages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: storefront_policies update_storefront_policies_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_storefront_policies_updated_at BEFORE UPDATE ON public.storefront_policies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: storefront_slug_redirects update_storefront_slug_redirects_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_storefront_slug_redirects_updated_at BEFORE UPDATE ON public.storefront_slug_redirects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: sites update_stores_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_stores_updated_at BEFORE UPDATE ON public.sites FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: subscriptions update_subscriptions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: tenant_execution_quotas update_tenant_execution_quotas_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_tenant_execution_quotas_updated_at BEFORE UPDATE ON public.tenant_execution_quotas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: tenant_operation_projections update_tenant_operation_projections_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_tenant_operation_projections_updated_at BEFORE UPDATE ON public.tenant_operation_projections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: theme_assets update_theme_assets_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_theme_assets_updated_at BEFORE UPDATE ON public.theme_assets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: theme_block_definitions update_theme_block_definitions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_theme_block_definitions_updated_at BEFORE UPDATE ON public.theme_block_definitions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: theme_editor_drafts update_theme_editor_drafts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_theme_editor_drafts_updated_at BEFORE UPDATE ON public.theme_editor_drafts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: store_themes update_theme_install_count_on_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_theme_install_count_on_change AFTER INSERT OR DELETE OR UPDATE ON public.store_themes FOR EACH ROW EXECUTE FUNCTION public.update_theme_install_count();


--
-- Name: theme_instance_drafts update_theme_instance_drafts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_theme_instance_drafts_updated_at BEFORE UPDATE ON public.theme_instance_drafts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: theme_instances update_theme_instances_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_theme_instances_updated_at BEFORE UPDATE ON public.theme_instances FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: theme_layouts update_theme_layouts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_theme_layouts_updated_at BEFORE UPDATE ON public.theme_layouts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: theme_package_versions update_theme_package_versions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_theme_package_versions_updated_at BEFORE UPDATE ON public.theme_package_versions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: theme_packages update_theme_packages_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_theme_packages_updated_at BEFORE UPDATE ON public.theme_packages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: theme_presets update_theme_presets_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_theme_presets_updated_at BEFORE UPDATE ON public.theme_presets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: theme_preview_sessions update_theme_preview_sessions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_theme_preview_sessions_updated_at BEFORE UPDATE ON public.theme_preview_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: theme_purchases update_theme_purchases_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_theme_purchases_updated_at BEFORE UPDATE ON public.theme_purchases FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: theme_reviews update_theme_rating_on_review; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_theme_rating_on_review AFTER INSERT OR DELETE OR UPDATE ON public.theme_reviews FOR EACH ROW EXECUTE FUNCTION public.update_theme_rating();


--
-- Name: theme_releases update_theme_releases_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_theme_releases_updated_at BEFORE UPDATE ON public.theme_releases FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: theme_renderer_manifests update_theme_renderer_manifests_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_theme_renderer_manifests_updated_at BEFORE UPDATE ON public.theme_renderer_manifests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: theme_reviews update_theme_reviews_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_theme_reviews_updated_at BEFORE UPDATE ON public.theme_reviews FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: theme_schema_manifests update_theme_schema_manifests_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_theme_schema_manifests_updated_at BEFORE UPDATE ON public.theme_schema_manifests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: theme_section_definitions update_theme_section_definitions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_theme_section_definitions_updated_at BEFORE UPDATE ON public.theme_section_definitions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: theme_template_assignments update_theme_template_assignments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_theme_template_assignments_updated_at BEFORE UPDATE ON public.theme_template_assignments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: theme_templates update_theme_templates_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_theme_templates_updated_at BEFORE UPDATE ON public.theme_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: usage_meter_entries update_usage_meter_entries_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_usage_meter_entries_updated_at BEFORE UPDATE ON public.usage_meter_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: user_profiles update_user_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: users update_users_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: webhook_deliveries update_webhook_deliveries_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_webhook_deliveries_updated_at BEFORE UPDATE ON public.webhook_deliveries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: webhook_subscriptions update_webhook_subscriptions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_webhook_subscriptions_updated_at BEFORE UPDATE ON public.webhook_subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: worker_request_logs update_worker_request_logs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_worker_request_logs_updated_at BEFORE UPDATE ON public.worker_request_logs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: workflow_heartbeats update_workflow_heartbeats_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_workflow_heartbeats_updated_at BEFORE UPDATE ON public.workflow_heartbeats FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: workflow_lifecycle update_workflow_lifecycle_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_workflow_lifecycle_updated_at BEFORE UPDATE ON public.workflow_lifecycle FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: workflow_operation_snapshots update_workflow_operation_snapshots_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_workflow_operation_snapshots_updated_at BEFORE UPDATE ON public.workflow_operation_snapshots FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: ai_credits ai_credits_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_credits
    ADD CONSTRAINT ai_credits_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: ai_usage ai_usage_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_usage
    ADD CONSTRAINT ai_usage_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: ai_usage ai_usage_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_usage
    ADD CONSTRAINT ai_usage_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users_custom(id) ON DELETE SET NULL;


--
-- Name: analytics_event_stream analytics_event_stream_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_event_stream
    ADD CONSTRAINT analytics_event_stream_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: analytics_events analytics_events_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_events
    ADD CONSTRAINT analytics_events_site_id_fkey FOREIGN KEY (store_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: analytics_rollups_daily analytics_rollups_daily_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_rollups_daily
    ADD CONSTRAINT analytics_rollups_daily_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: app_billing_charges app_billing_charges_app_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_billing_charges
    ADD CONSTRAINT app_billing_charges_app_id_fkey FOREIGN KEY (app_id) REFERENCES public.marketplace_apps(id) ON DELETE CASCADE;


--
-- Name: app_billing_charges app_billing_charges_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_billing_charges
    ADD CONSTRAINT app_billing_charges_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users_custom(id) ON DELETE SET NULL;


--
-- Name: app_billing_charges app_billing_charges_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_billing_charges
    ADD CONSTRAINT app_billing_charges_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users_custom(id) ON DELETE SET NULL;


--
-- Name: app_billing_charges app_billing_charges_installation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_billing_charges
    ADD CONSTRAINT app_billing_charges_installation_id_fkey FOREIGN KEY (installation_id) REFERENCES public.app_installations(id) ON DELETE CASCADE;


--
-- Name: app_billing_charges app_billing_charges_partner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_billing_charges
    ADD CONSTRAINT app_billing_charges_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES public.app_developers(id) ON DELETE CASCADE;


--
-- Name: app_billing_charges app_billing_charges_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_billing_charges
    ADD CONSTRAINT app_billing_charges_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: app_billing_charges app_billing_charges_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_billing_charges
    ADD CONSTRAINT app_billing_charges_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users_custom(id) ON DELETE SET NULL;


--
-- Name: app_developers app_developers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_developers
    ADD CONSTRAINT app_developers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users_custom(id) ON DELETE CASCADE;


--
-- Name: app_extensions app_extensions_app_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_extensions
    ADD CONSTRAINT app_extensions_app_id_fkey FOREIGN KEY (app_id) REFERENCES public.marketplace_apps(id) ON DELETE CASCADE;


--
-- Name: app_installations app_installations_app_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_installations
    ADD CONSTRAINT app_installations_app_id_fkey FOREIGN KEY (app_id) REFERENCES public.marketplace_apps(id) ON DELETE CASCADE;


--
-- Name: app_installations app_installations_installed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_installations
    ADD CONSTRAINT app_installations_installed_by_fkey FOREIGN KEY (installed_by) REFERENCES public.users_custom(id);


--
-- Name: app_installations app_installations_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_installations
    ADD CONSTRAINT app_installations_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: app_reviews app_reviews_app_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_reviews
    ADD CONSTRAINT app_reviews_app_id_fkey FOREIGN KEY (app_id) REFERENCES public.marketplace_apps(id) ON DELETE CASCADE;


--
-- Name: app_reviews app_reviews_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_reviews
    ADD CONSTRAINT app_reviews_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.sites(id);


--
-- Name: app_reviews app_reviews_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_reviews
    ADD CONSTRAINT app_reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users_custom(id);


--
-- Name: app_webhooks app_webhooks_app_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_webhooks
    ADD CONSTRAINT app_webhooks_app_id_fkey FOREIGN KEY (app_id) REFERENCES public.marketplace_apps(id) ON DELETE CASCADE;


--
-- Name: audit_activity_events audit_activity_events_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_activity_events
    ADD CONSTRAINT audit_activity_events_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.sites(id) ON DELETE SET NULL;


--
-- Name: billing_history billing_history_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_history
    ADD CONSTRAINT billing_history_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: billing_history billing_history_subscription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_history
    ADD CONSTRAINT billing_history_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.subscriptions(id) ON DELETE SET NULL;


--
-- Name: billing_history billing_history_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_history
    ADD CONSTRAINT billing_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users_custom(id) ON DELETE CASCADE;


--
-- Name: blog_categories blog_categories_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blog_categories
    ADD CONSTRAINT blog_categories_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.blog_categories(id) ON DELETE SET NULL;


--
-- Name: blog_categories blog_categories_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blog_categories
    ADD CONSTRAINT blog_categories_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: blog_comments blog_comments_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blog_comments
    ADD CONSTRAINT blog_comments_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.blog_comments(id) ON DELETE CASCADE;


--
-- Name: blog_comments blog_comments_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blog_comments
    ADD CONSTRAINT blog_comments_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.blog_posts(id) ON DELETE CASCADE;


--
-- Name: blog_comments blog_comments_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blog_comments
    ADD CONSTRAINT blog_comments_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: blog_comments blog_comments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blog_comments
    ADD CONSTRAINT blog_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users_custom(id) ON DELETE SET NULL;


--
-- Name: blog_post_tags blog_post_tags_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blog_post_tags
    ADD CONSTRAINT blog_post_tags_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.blog_posts(id) ON DELETE CASCADE;


--
-- Name: blog_post_tags blog_post_tags_tag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blog_post_tags
    ADD CONSTRAINT blog_post_tags_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.blog_tags(id) ON DELETE CASCADE;


--
-- Name: blog_posts blog_posts_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blog_posts
    ADD CONSTRAINT blog_posts_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users_custom(id) ON DELETE SET NULL;


--
-- Name: blog_posts blog_posts_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blog_posts
    ADD CONSTRAINT blog_posts_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.blog_categories(id) ON DELETE SET NULL;


--
-- Name: blog_posts blog_posts_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blog_posts
    ADD CONSTRAINT blog_posts_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: blog_tags blog_tags_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blog_tags
    ADD CONSTRAINT blog_tags_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: cache_invalidation_events cache_invalidation_events_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cache_invalidation_events
    ADD CONSTRAINT cache_invalidation_events_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: carts carts_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carts
    ADD CONSTRAINT carts_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: certifications certifications_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.certifications
    ADD CONSTRAINT certifications_site_id_fkey FOREIGN KEY (store_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: checkout_sessions checkout_sessions_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkout_sessions
    ADD CONSTRAINT checkout_sessions_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;


--
-- Name: checkout_sessions checkout_sessions_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkout_sessions
    ADD CONSTRAINT checkout_sessions_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: collection_products collection_products_collection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_products
    ADD CONSTRAINT collection_products_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES public.collections(id) ON DELETE CASCADE;


--
-- Name: collection_products collection_products_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_products
    ADD CONSTRAINT collection_products_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: collections collections_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collections
    ADD CONSTRAINT collections_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: contact_submissions contact_submissions_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_submissions
    ADD CONSTRAINT contact_submissions_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: contact_submissions contacts_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_submissions
    ADD CONSTRAINT contacts_site_id_fkey FOREIGN KEY (store_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: contacts contacts_site_id_fkey1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_site_id_fkey1 FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: coupons coupons_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupons
    ADD CONSTRAINT coupons_site_id_fkey FOREIGN KEY (store_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: coupons coupons_site_id_fkey1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupons
    ADD CONSTRAINT coupons_site_id_fkey1 FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: customer_activity_log customer_activity_log_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_activity_log
    ADD CONSTRAINT customer_activity_log_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.store_customers(id) ON DELETE CASCADE;


--
-- Name: customer_activity_log customer_activity_log_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_activity_log
    ADD CONSTRAINT customer_activity_log_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: customer_addresses customer_addresses_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_addresses
    ADD CONSTRAINT customer_addresses_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: customer_credentials customer_credentials_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_credentials
    ADD CONSTRAINT customer_credentials_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: customer_wishlists customer_wishlists_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_wishlists
    ADD CONSTRAINT customer_wishlists_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.store_customers(id) ON DELETE CASCADE;


--
-- Name: customer_wishlists customer_wishlists_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_wishlists
    ADD CONSTRAINT customer_wishlists_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: device_tokens device_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_tokens
    ADD CONSTRAINT device_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: devices devices_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devices
    ADD CONSTRAINT devices_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users_custom(id) ON DELETE CASCADE;


--
-- Name: distributed_event_store distributed_event_store_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.distributed_event_store
    ADD CONSTRAINT distributed_event_store_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: distributed_event_store distributed_event_store_stream_name_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.distributed_event_store
    ADD CONSTRAINT distributed_event_store_stream_name_fkey FOREIGN KEY (stream_name) REFERENCES public.distributed_event_streams(stream_name) ON DELETE RESTRICT;


--
-- Name: distributed_event_streams distributed_event_streams_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.distributed_event_streams
    ADD CONSTRAINT distributed_event_streams_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: distributed_queue_messages distributed_queue_messages_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.distributed_queue_messages
    ADD CONSTRAINT distributed_queue_messages_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: education education_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.education
    ADD CONSTRAINT education_site_id_fkey FOREIGN KEY (store_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: employee_invites employee_invites_invited_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_invites
    ADD CONSTRAINT employee_invites_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES auth.users(id);


--
-- Name: employees employees_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: employees employees_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.employee_roles(id);


--
-- Name: employees employees_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: employees employees_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: event_stream_snapshots event_stream_snapshots_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_stream_snapshots
    ADD CONSTRAINT event_stream_snapshots_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: event_stream_snapshots event_stream_snapshots_stream_name_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_stream_snapshots
    ADD CONSTRAINT event_stream_snapshots_stream_name_fkey FOREIGN KEY (stream_name) REFERENCES public.distributed_event_streams(stream_name) ON DELETE CASCADE;


--
-- Name: execution_audit_trail execution_audit_trail_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.execution_audit_trail
    ADD CONSTRAINT execution_audit_trail_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: form_submissions form_submissions_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_submissions
    ADD CONSTRAINT form_submissions_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users_custom(id) ON DELETE SET NULL;


--
-- Name: form_submissions form_submissions_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_submissions
    ADD CONSTRAINT form_submissions_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: fulfillment_order_lines fulfillment_order_lines_fulfillment_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fulfillment_order_lines
    ADD CONSTRAINT fulfillment_order_lines_fulfillment_order_id_fkey FOREIGN KEY (fulfillment_order_id) REFERENCES public.fulfillment_orders(id) ON DELETE CASCADE;


--
-- Name: fulfillment_order_lines fulfillment_order_lines_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fulfillment_order_lines
    ADD CONSTRAINT fulfillment_order_lines_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: fulfillment_order_lines fulfillment_order_lines_order_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fulfillment_order_lines
    ADD CONSTRAINT fulfillment_order_lines_order_item_id_fkey FOREIGN KEY (order_item_id) REFERENCES public.order_items(id) ON DELETE CASCADE;


--
-- Name: fulfillment_order_lines fulfillment_order_lines_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fulfillment_order_lines
    ADD CONSTRAINT fulfillment_order_lines_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;


--
-- Name: fulfillment_order_lines fulfillment_order_lines_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fulfillment_order_lines
    ADD CONSTRAINT fulfillment_order_lines_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: fulfillment_order_lines fulfillment_order_lines_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fulfillment_order_lines
    ADD CONSTRAINT fulfillment_order_lines_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id) ON DELETE SET NULL;


--
-- Name: fulfillment_orders fulfillment_orders_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fulfillment_orders
    ADD CONSTRAINT fulfillment_orders_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.inventory_locations(id) ON DELETE SET NULL;


--
-- Name: fulfillment_orders fulfillment_orders_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fulfillment_orders
    ADD CONSTRAINT fulfillment_orders_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: fulfillment_orders fulfillment_orders_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fulfillment_orders
    ADD CONSTRAINT fulfillment_orders_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: gallery_items gallery_items_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gallery_items
    ADD CONSTRAINT gallery_items_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;


--
-- Name: gallery_items gallery_items_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gallery_items
    ADD CONSTRAINT gallery_items_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: gift_card_accounts gift_card_accounts_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gift_card_accounts
    ADD CONSTRAINT gift_card_accounts_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: gift_card_ledger_entries gift_card_ledger_entries_gift_card_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gift_card_ledger_entries
    ADD CONSTRAINT gift_card_ledger_entries_gift_card_account_id_fkey FOREIGN KEY (gift_card_account_id) REFERENCES public.gift_card_accounts(id) ON DELETE CASCADE;


--
-- Name: gift_card_ledger_entries gift_card_ledger_entries_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gift_card_ledger_entries
    ADD CONSTRAINT gift_card_ledger_entries_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;


--
-- Name: gift_card_ledger_entries gift_card_ledger_entries_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gift_card_ledger_entries
    ADD CONSTRAINT gift_card_ledger_entries_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: gift_card_redemptions gift_card_redemptions_gift_card_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gift_card_redemptions
    ADD CONSTRAINT gift_card_redemptions_gift_card_account_id_fkey FOREIGN KEY (gift_card_account_id) REFERENCES public.gift_card_accounts(id) ON DELETE CASCADE;


--
-- Name: gift_card_redemptions gift_card_redemptions_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gift_card_redemptions
    ADD CONSTRAINT gift_card_redemptions_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: gift_card_redemptions gift_card_redemptions_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gift_card_redemptions
    ADD CONSTRAINT gift_card_redemptions_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: gift_cards gift_cards_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gift_cards
    ADD CONSTRAINT gift_cards_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: idempotency_keys idempotency_keys_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.idempotency_keys
    ADD CONSTRAINT idempotency_keys_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: inventory_adjustments inventory_adjustments_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_adjustments
    ADD CONSTRAINT inventory_adjustments_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.inventory_locations(id);


--
-- Name: inventory_adjustments inventory_adjustments_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_adjustments
    ADD CONSTRAINT inventory_adjustments_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: inventory_adjustments inventory_adjustments_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_adjustments
    ADD CONSTRAINT inventory_adjustments_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id);


--
-- Name: inventory_events inventory_events_inventory_level_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_events
    ADD CONSTRAINT inventory_events_inventory_level_id_fkey FOREIGN KEY (inventory_level_id) REFERENCES public.inventory_levels(id) ON DELETE SET NULL;


--
-- Name: inventory_events inventory_events_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_events
    ADD CONSTRAINT inventory_events_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.inventory_locations(id) ON DELETE SET NULL;


--
-- Name: inventory_events inventory_events_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_events
    ADD CONSTRAINT inventory_events_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;


--
-- Name: inventory_events inventory_events_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_events
    ADD CONSTRAINT inventory_events_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: inventory_events inventory_events_reservation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_events
    ADD CONSTRAINT inventory_events_reservation_id_fkey FOREIGN KEY (reservation_id) REFERENCES public.inventory_reservations(id) ON DELETE SET NULL;


--
-- Name: inventory_events inventory_events_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_events
    ADD CONSTRAINT inventory_events_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: inventory_events inventory_events_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_events
    ADD CONSTRAINT inventory_events_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id) ON DELETE SET NULL;


--
-- Name: inventory_levels inventory_levels_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_levels
    ADD CONSTRAINT inventory_levels_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.inventory_locations(id) ON DELETE CASCADE;


--
-- Name: inventory_levels inventory_levels_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_levels
    ADD CONSTRAINT inventory_levels_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: inventory_levels inventory_levels_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_levels
    ADD CONSTRAINT inventory_levels_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id) ON DELETE CASCADE;


--
-- Name: inventory_locations inventory_locations_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_locations
    ADD CONSTRAINT inventory_locations_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: inventory_reservations inventory_reservations_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_reservations
    ADD CONSTRAINT inventory_reservations_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.inventory_locations(id) ON DELETE CASCADE;


--
-- Name: inventory_reservations inventory_reservations_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_reservations
    ADD CONSTRAINT inventory_reservations_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;


--
-- Name: inventory_reservations inventory_reservations_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_reservations
    ADD CONSTRAINT inventory_reservations_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: inventory_reservations inventory_reservations_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_reservations
    ADD CONSTRAINT inventory_reservations_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: inventory_reservations inventory_reservations_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_reservations
    ADD CONSTRAINT inventory_reservations_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id) ON DELETE SET NULL;


--
-- Name: inventory_transfer_lines inventory_transfer_lines_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_transfer_lines
    ADD CONSTRAINT inventory_transfer_lines_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: inventory_transfer_lines inventory_transfer_lines_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_transfer_lines
    ADD CONSTRAINT inventory_transfer_lines_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: inventory_transfer_lines inventory_transfer_lines_transfer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_transfer_lines
    ADD CONSTRAINT inventory_transfer_lines_transfer_id_fkey FOREIGN KEY (transfer_id) REFERENCES public.inventory_transfers(id) ON DELETE CASCADE;


--
-- Name: inventory_transfer_lines inventory_transfer_lines_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_transfer_lines
    ADD CONSTRAINT inventory_transfer_lines_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id) ON DELETE SET NULL;


--
-- Name: inventory_transfer_receipts inventory_transfer_receipts_destination_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_transfer_receipts
    ADD CONSTRAINT inventory_transfer_receipts_destination_location_id_fkey FOREIGN KEY (destination_location_id) REFERENCES public.inventory_locations(id) ON DELETE SET NULL;


--
-- Name: inventory_transfer_receipts inventory_transfer_receipts_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_transfer_receipts
    ADD CONSTRAINT inventory_transfer_receipts_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: inventory_transfer_receipts inventory_transfer_receipts_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_transfer_receipts
    ADD CONSTRAINT inventory_transfer_receipts_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: inventory_transfer_receipts inventory_transfer_receipts_source_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_transfer_receipts
    ADD CONSTRAINT inventory_transfer_receipts_source_location_id_fkey FOREIGN KEY (source_location_id) REFERENCES public.inventory_locations(id) ON DELETE SET NULL;


--
-- Name: inventory_transfer_receipts inventory_transfer_receipts_transfer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_transfer_receipts
    ADD CONSTRAINT inventory_transfer_receipts_transfer_id_fkey FOREIGN KEY (transfer_id) REFERENCES public.inventory_transfers(id) ON DELETE CASCADE;


--
-- Name: inventory_transfer_receipts inventory_transfer_receipts_transfer_line_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_transfer_receipts
    ADD CONSTRAINT inventory_transfer_receipts_transfer_line_id_fkey FOREIGN KEY (transfer_line_id) REFERENCES public.inventory_transfer_lines(id) ON DELETE SET NULL;


--
-- Name: inventory_transfer_receipts inventory_transfer_receipts_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_transfer_receipts
    ADD CONSTRAINT inventory_transfer_receipts_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id) ON DELETE SET NULL;


--
-- Name: inventory_transfers inventory_transfers_destination_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_transfers
    ADD CONSTRAINT inventory_transfers_destination_location_id_fkey FOREIGN KEY (destination_location_id) REFERENCES public.inventory_locations(id) ON DELETE RESTRICT;


--
-- Name: inventory_transfers inventory_transfers_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_transfers
    ADD CONSTRAINT inventory_transfers_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: inventory_transfers inventory_transfers_source_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_transfers
    ADD CONSTRAINT inventory_transfers_source_location_id_fkey FOREIGN KEY (source_location_id) REFERENCES public.inventory_locations(id) ON DELETE RESTRICT;


--
-- Name: lead_forms lead_forms_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_forms
    ADD CONSTRAINT lead_forms_site_id_fkey FOREIGN KEY (store_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: lead_forms lead_forms_site_id_fkey1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_forms
    ADD CONSTRAINT lead_forms_site_id_fkey1 FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: leads leads_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_site_id_fkey FOREIGN KEY (store_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: leads leads_site_id_fkey1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_site_id_fkey1 FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: marketplace_apps marketplace_apps_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketplace_apps
    ADD CONSTRAINT marketplace_apps_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.app_categories(id);


--
-- Name: marketplace_apps marketplace_apps_developer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketplace_apps
    ADD CONSTRAINT marketplace_apps_developer_id_fkey FOREIGN KEY (developer_id) REFERENCES public.app_developers(id) ON DELETE CASCADE;


--
-- Name: marketplace_review_records marketplace_review_records_app_developer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketplace_review_records
    ADD CONSTRAINT marketplace_review_records_app_developer_id_fkey FOREIGN KEY (app_developer_id) REFERENCES public.app_developers(id) ON DELETE SET NULL;


--
-- Name: marketplace_review_records marketplace_review_records_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketplace_review_records
    ADD CONSTRAINT marketplace_review_records_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users_custom(id) ON DELETE SET NULL;


--
-- Name: marketplace_review_records marketplace_review_records_partner_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketplace_review_records
    ADD CONSTRAINT marketplace_review_records_partner_user_id_fkey FOREIGN KEY (partner_user_id) REFERENCES public.users_custom(id) ON DELETE CASCADE;


--
-- Name: marketplace_review_records marketplace_review_records_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketplace_review_records
    ADD CONSTRAINT marketplace_review_records_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users_custom(id) ON DELETE SET NULL;


--
-- Name: marketplace_review_records marketplace_review_records_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketplace_review_records
    ADD CONSTRAINT marketplace_review_records_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users_custom(id) ON DELETE SET NULL;


--
-- Name: media_assets media_assets_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_assets
    ADD CONSTRAINT media_assets_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: media_assets media_assets_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_assets
    ADD CONSTRAINT media_assets_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: media media_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media
    ADD CONSTRAINT media_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: media media_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media
    ADD CONSTRAINT media_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users_custom(id) ON DELETE SET NULL;


--
-- Name: navigation_menu_items navigation_menu_items_menu_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.navigation_menu_items
    ADD CONSTRAINT navigation_menu_items_menu_id_fkey FOREIGN KEY (menu_id) REFERENCES public.navigation_menus(id) ON DELETE CASCADE;


--
-- Name: navigation_menu_items navigation_menu_items_parent_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.navigation_menu_items
    ADD CONSTRAINT navigation_menu_items_parent_item_id_fkey FOREIGN KEY (parent_item_id) REFERENCES public.navigation_menu_items(id) ON DELETE CASCADE;


--
-- Name: navigation_menu_items navigation_menu_items_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.navigation_menu_items
    ADD CONSTRAINT navigation_menu_items_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: navigation_menus navigation_menus_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.navigation_menus
    ADD CONSTRAINT navigation_menus_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: navigation_menus navigation_menus_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.navigation_menus
    ADD CONSTRAINT navigation_menus_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: navigation_menus navigation_menus_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.navigation_menus
    ADD CONSTRAINT navigation_menus_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: notification_preferences notification_preferences_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: notification_preferences notification_preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users_custom(id) ON DELETE CASCADE;


--
-- Name: onboarding_attempts onboarding_attempts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.onboarding_attempts
    ADD CONSTRAINT onboarding_attempts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users_custom(id) ON DELETE CASCADE;


--
-- Name: operation_metrics operation_metrics_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operation_metrics
    ADD CONSTRAINT operation_metrics_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE SET NULL;


--
-- Name: operational_feature_flag_exposures operational_feature_flag_exposures_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operational_feature_flag_exposures
    ADD CONSTRAINT operational_feature_flag_exposures_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: operational_feature_flags operational_feature_flags_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operational_feature_flags
    ADD CONSTRAINT operational_feature_flags_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: order_items order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: order_items order_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;


--
-- Name: order_line_adjustments order_line_adjustments_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_line_adjustments
    ADD CONSTRAINT order_line_adjustments_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: order_line_adjustments order_line_adjustments_order_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_line_adjustments
    ADD CONSTRAINT order_line_adjustments_order_item_id_fkey FOREIGN KEY (order_item_id) REFERENCES public.order_items(id) ON DELETE CASCADE;


--
-- Name: order_line_adjustments order_line_adjustments_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_line_adjustments
    ADD CONSTRAINT order_line_adjustments_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: order_shipping_lines order_shipping_lines_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_shipping_lines
    ADD CONSTRAINT order_shipping_lines_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: order_shipping_lines order_shipping_lines_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_shipping_lines
    ADD CONSTRAINT order_shipping_lines_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: order_tax_lines order_tax_lines_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_tax_lines
    ADD CONSTRAINT order_tax_lines_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: order_tax_lines order_tax_lines_order_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_tax_lines
    ADD CONSTRAINT order_tax_lines_order_item_id_fkey FOREIGN KEY (order_item_id) REFERENCES public.order_items(id) ON DELETE CASCADE;


--
-- Name: order_tax_lines order_tax_lines_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_tax_lines
    ADD CONSTRAINT order_tax_lines_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: orders orders_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_site_id_fkey FOREIGN KEY (store_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: orders orders_site_id_fkey1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_site_id_fkey1 FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: outbox_dead_letters outbox_dead_letters_outbox_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outbox_dead_letters
    ADD CONSTRAINT outbox_dead_letters_outbox_event_id_fkey FOREIGN KEY (outbox_event_id) REFERENCES public.outbox_events(id) ON DELETE CASCADE;


--
-- Name: outbox_dead_letters outbox_dead_letters_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outbox_dead_letters
    ADD CONSTRAINT outbox_dead_letters_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE SET NULL;


--
-- Name: outbox_events outbox_events_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outbox_events
    ADD CONSTRAINT outbox_events_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE SET NULL;


--
-- Name: outbox_events outbox_events_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outbox_events
    ADD CONSTRAINT outbox_events_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.sites(id) ON DELETE SET NULL;


--
-- Name: pages pages_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pages
    ADD CONSTRAINT pages_site_id_fkey FOREIGN KEY (store_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: partner_payout_ledger_entries partner_payout_ledger_entries_app_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partner_payout_ledger_entries
    ADD CONSTRAINT partner_payout_ledger_entries_app_id_fkey FOREIGN KEY (app_id) REFERENCES public.marketplace_apps(id) ON DELETE SET NULL;


--
-- Name: partner_payout_ledger_entries partner_payout_ledger_entries_installation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partner_payout_ledger_entries
    ADD CONSTRAINT partner_payout_ledger_entries_installation_id_fkey FOREIGN KEY (installation_id) REFERENCES public.app_installations(id) ON DELETE SET NULL;


--
-- Name: partner_payout_ledger_entries partner_payout_ledger_entries_partner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partner_payout_ledger_entries
    ADD CONSTRAINT partner_payout_ledger_entries_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES public.app_developers(id) ON DELETE CASCADE;


--
-- Name: partner_payout_ledger_entries partner_payout_ledger_entries_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partner_payout_ledger_entries
    ADD CONSTRAINT partner_payout_ledger_entries_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE SET NULL;


--
-- Name: payment_attempts payment_attempts_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_attempts
    ADD CONSTRAINT payment_attempts_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: payment_attempts payment_attempts_payment_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_attempts
    ADD CONSTRAINT payment_attempts_payment_transaction_id_fkey FOREIGN KEY (payment_transaction_id) REFERENCES public.payment_transactions(id) ON DELETE SET NULL;


--
-- Name: payment_attempts payment_attempts_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_attempts
    ADD CONSTRAINT payment_attempts_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: payment_transactions payment_transactions_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_transactions
    ADD CONSTRAINT payment_transactions_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: payment_transactions payment_transactions_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_transactions
    ADD CONSTRAINT payment_transactions_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: payment_transactions payment_transactions_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_transactions
    ADD CONSTRAINT payment_transactions_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: platform_queue_jobs platform_queue_jobs_outbox_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_queue_jobs
    ADD CONSTRAINT platform_queue_jobs_outbox_event_id_fkey FOREIGN KEY (outbox_event_id) REFERENCES public.outbox_events(id) ON DELETE SET NULL;


--
-- Name: platform_queue_jobs platform_queue_jobs_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_queue_jobs
    ADD CONSTRAINT platform_queue_jobs_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: portfolio_projects portfolio_projects_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portfolio_projects
    ADD CONSTRAINT portfolio_projects_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: product_options product_options_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_options
    ADD CONSTRAINT product_options_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: product_reviews product_reviews_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_reviews
    ADD CONSTRAINT product_reviews_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: product_reviews product_reviews_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_reviews
    ADD CONSTRAINT product_reviews_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: product_variants product_variants_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_variants
    ADD CONSTRAINT product_variants_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: production_incident_events production_incident_events_incident_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_incident_events
    ADD CONSTRAINT production_incident_events_incident_id_fkey FOREIGN KEY (incident_id) REFERENCES public.production_incidents(incident_id) ON DELETE CASCADE;


--
-- Name: products products_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_site_id_fkey FOREIGN KEY (store_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: products products_site_id_fkey1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_site_id_fkey1 FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: projection_checkpoints projection_checkpoints_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projection_checkpoints
    ADD CONSTRAINT projection_checkpoints_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: projection_operation_snapshots projection_operation_snapshots_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projection_operation_snapshots
    ADD CONSTRAINT projection_operation_snapshots_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: projection_rebuilds projection_rebuilds_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projection_rebuilds
    ADD CONSTRAINT projection_rebuilds_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: projection_store projection_store_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projection_store
    ADD CONSTRAINT projection_store_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: portfolio_projects projects_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portfolio_projects
    ADD CONSTRAINT projects_site_id_fkey FOREIGN KEY (store_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: projects projects_site_id_fkey1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_site_id_fkey1 FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: promotion_codes promotion_codes_promotion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion_codes
    ADD CONSTRAINT promotion_codes_promotion_id_fkey FOREIGN KEY (promotion_id) REFERENCES public.promotions(id) ON DELETE CASCADE;


--
-- Name: promotion_codes promotion_codes_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion_codes
    ADD CONSTRAINT promotion_codes_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: promotion_effects promotion_effects_promotion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion_effects
    ADD CONSTRAINT promotion_effects_promotion_id_fkey FOREIGN KEY (promotion_id) REFERENCES public.promotions(id) ON DELETE CASCADE;


--
-- Name: promotion_effects promotion_effects_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion_effects
    ADD CONSTRAINT promotion_effects_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: promotion_redemptions promotion_redemptions_coupon_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion_redemptions
    ADD CONSTRAINT promotion_redemptions_coupon_id_fkey FOREIGN KEY (coupon_id) REFERENCES public.coupons(id) ON DELETE SET NULL;


--
-- Name: promotion_redemptions promotion_redemptions_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion_redemptions
    ADD CONSTRAINT promotion_redemptions_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: promotion_redemptions promotion_redemptions_promotion_code_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion_redemptions
    ADD CONSTRAINT promotion_redemptions_promotion_code_id_fkey FOREIGN KEY (promotion_code_id) REFERENCES public.promotion_codes(id) ON DELETE SET NULL;


--
-- Name: promotion_redemptions promotion_redemptions_promotion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion_redemptions
    ADD CONSTRAINT promotion_redemptions_promotion_id_fkey FOREIGN KEY (promotion_id) REFERENCES public.promotions(id) ON DELETE SET NULL;


--
-- Name: promotion_redemptions promotion_redemptions_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion_redemptions
    ADD CONSTRAINT promotion_redemptions_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: promotion_rules promotion_rules_promotion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion_rules
    ADD CONSTRAINT promotion_rules_promotion_id_fkey FOREIGN KEY (promotion_id) REFERENCES public.promotions(id) ON DELETE CASCADE;


--
-- Name: promotion_rules promotion_rules_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion_rules
    ADD CONSTRAINT promotion_rules_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: promotion_usage_counters promotion_usage_counters_coupon_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion_usage_counters
    ADD CONSTRAINT promotion_usage_counters_coupon_id_fkey FOREIGN KEY (coupon_id) REFERENCES public.coupons(id) ON DELETE CASCADE;


--
-- Name: promotion_usage_counters promotion_usage_counters_promotion_code_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion_usage_counters
    ADD CONSTRAINT promotion_usage_counters_promotion_code_id_fkey FOREIGN KEY (promotion_code_id) REFERENCES public.promotion_codes(id) ON DELETE CASCADE;


--
-- Name: promotion_usage_counters promotion_usage_counters_promotion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion_usage_counters
    ADD CONSTRAINT promotion_usage_counters_promotion_id_fkey FOREIGN KEY (promotion_id) REFERENCES public.promotions(id) ON DELETE CASCADE;


--
-- Name: promotion_usage_counters promotion_usage_counters_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion_usage_counters
    ADD CONSTRAINT promotion_usage_counters_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: promotions promotions_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotions
    ADD CONSTRAINT promotions_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: purchase_order_lines purchase_order_lines_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_lines
    ADD CONSTRAINT purchase_order_lines_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.inventory_locations(id) ON DELETE SET NULL;


--
-- Name: purchase_order_lines purchase_order_lines_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_lines
    ADD CONSTRAINT purchase_order_lines_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: purchase_order_lines purchase_order_lines_purchase_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_lines
    ADD CONSTRAINT purchase_order_lines_purchase_order_id_fkey FOREIGN KEY (purchase_order_id) REFERENCES public.purchase_orders(id) ON DELETE CASCADE;


--
-- Name: purchase_order_lines purchase_order_lines_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_lines
    ADD CONSTRAINT purchase_order_lines_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: purchase_order_lines purchase_order_lines_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_lines
    ADD CONSTRAINT purchase_order_lines_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id) ON DELETE SET NULL;


--
-- Name: purchase_order_receipts purchase_order_receipts_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_receipts
    ADD CONSTRAINT purchase_order_receipts_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.inventory_locations(id) ON DELETE SET NULL;


--
-- Name: purchase_order_receipts purchase_order_receipts_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_receipts
    ADD CONSTRAINT purchase_order_receipts_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: purchase_order_receipts purchase_order_receipts_purchase_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_receipts
    ADD CONSTRAINT purchase_order_receipts_purchase_order_id_fkey FOREIGN KEY (purchase_order_id) REFERENCES public.purchase_orders(id) ON DELETE CASCADE;


--
-- Name: purchase_order_receipts purchase_order_receipts_purchase_order_line_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_receipts
    ADD CONSTRAINT purchase_order_receipts_purchase_order_line_id_fkey FOREIGN KEY (purchase_order_line_id) REFERENCES public.purchase_order_lines(id) ON DELETE SET NULL;


--
-- Name: purchase_order_receipts purchase_order_receipts_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_receipts
    ADD CONSTRAINT purchase_order_receipts_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: purchase_order_receipts purchase_order_receipts_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_receipts
    ADD CONSTRAINT purchase_order_receipts_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id) ON DELETE SET NULL;


--
-- Name: purchase_orders purchase_orders_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.inventory_locations(id) ON DELETE SET NULL;


--
-- Name: purchase_orders purchase_orders_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: purchase_orders purchase_orders_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE SET NULL;


--
-- Name: query_snapshots query_snapshots_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.query_snapshots
    ADD CONSTRAINT query_snapshots_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: queue_operation_snapshots queue_operation_snapshots_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.queue_operation_snapshots
    ADD CONSTRAINT queue_operation_snapshots_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: refund_attempts refund_attempts_refund_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refund_attempts
    ADD CONSTRAINT refund_attempts_refund_transaction_id_fkey FOREIGN KEY (refund_transaction_id) REFERENCES public.refund_transactions(id) ON DELETE CASCADE;


--
-- Name: refund_attempts refund_attempts_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refund_attempts
    ADD CONSTRAINT refund_attempts_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: refund_lines refund_lines_order_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refund_lines
    ADD CONSTRAINT refund_lines_order_item_id_fkey FOREIGN KEY (order_item_id) REFERENCES public.order_items(id) ON DELETE SET NULL;


--
-- Name: refund_lines refund_lines_refund_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refund_lines
    ADD CONSTRAINT refund_lines_refund_id_fkey FOREIGN KEY (refund_id) REFERENCES public.refunds(id) ON DELETE CASCADE;


--
-- Name: refund_lines refund_lines_return_line_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refund_lines
    ADD CONSTRAINT refund_lines_return_line_id_fkey FOREIGN KEY (return_line_id) REFERENCES public.return_lines(id) ON DELETE SET NULL;


--
-- Name: refund_lines refund_lines_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refund_lines
    ADD CONSTRAINT refund_lines_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: refund_transactions refund_transactions_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refund_transactions
    ADD CONSTRAINT refund_transactions_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: refund_transactions refund_transactions_payment_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refund_transactions
    ADD CONSTRAINT refund_transactions_payment_transaction_id_fkey FOREIGN KEY (payment_transaction_id) REFERENCES public.payment_transactions(id) ON DELETE SET NULL;


--
-- Name: refund_transactions refund_transactions_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refund_transactions
    ADD CONSTRAINT refund_transactions_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: refunds refunds_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refunds
    ADD CONSTRAINT refunds_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: refunds refunds_payment_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refunds
    ADD CONSTRAINT refunds_payment_transaction_id_fkey FOREIGN KEY (payment_transaction_id) REFERENCES public.payment_transactions(id) ON DELETE SET NULL;


--
-- Name: refunds refunds_return_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refunds
    ADD CONSTRAINT refunds_return_id_fkey FOREIGN KEY (return_id) REFERENCES public.returns(id) ON DELETE SET NULL;


--
-- Name: refunds refunds_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refunds
    ADD CONSTRAINT refunds_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: regional_routing_overrides regional_routing_overrides_tenant_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.regional_routing_overrides
    ADD CONSTRAINT regional_routing_overrides_tenant_site_id_fkey FOREIGN KEY (tenant_site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: replay_dry_run_results replay_dry_run_results_replay_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.replay_dry_run_results
    ADD CONSTRAINT replay_dry_run_results_replay_id_fkey FOREIGN KEY (replay_id) REFERENCES public.replay_operation_schedules(replay_id) ON DELETE CASCADE;


--
-- Name: replay_operation_schedules replay_operation_schedules_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.replay_operation_schedules
    ADD CONSTRAINT replay_operation_schedules_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: restock_events restock_events_inventory_level_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restock_events
    ADD CONSTRAINT restock_events_inventory_level_id_fkey FOREIGN KEY (inventory_level_id) REFERENCES public.inventory_levels(id) ON DELETE SET NULL;


--
-- Name: restock_events restock_events_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restock_events
    ADD CONSTRAINT restock_events_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.inventory_locations(id) ON DELETE SET NULL;


--
-- Name: restock_events restock_events_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restock_events
    ADD CONSTRAINT restock_events_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;


--
-- Name: restock_events restock_events_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restock_events
    ADD CONSTRAINT restock_events_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: restock_events restock_events_return_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restock_events
    ADD CONSTRAINT restock_events_return_id_fkey FOREIGN KEY (return_id) REFERENCES public.returns(id) ON DELETE SET NULL;


--
-- Name: restock_events restock_events_return_line_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restock_events
    ADD CONSTRAINT restock_events_return_line_id_fkey FOREIGN KEY (return_line_id) REFERENCES public.return_lines(id) ON DELETE SET NULL;


--
-- Name: restock_events restock_events_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restock_events
    ADD CONSTRAINT restock_events_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: restock_events restock_events_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restock_events
    ADD CONSTRAINT restock_events_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id) ON DELETE SET NULL;


--
-- Name: resume_versions resume_versions_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resume_versions
    ADD CONSTRAINT resume_versions_site_id_fkey FOREIGN KEY (store_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: return_lines return_lines_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.return_lines
    ADD CONSTRAINT return_lines_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: return_lines return_lines_order_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.return_lines
    ADD CONSTRAINT return_lines_order_item_id_fkey FOREIGN KEY (order_item_id) REFERENCES public.order_items(id) ON DELETE CASCADE;


--
-- Name: return_lines return_lines_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.return_lines
    ADD CONSTRAINT return_lines_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;


--
-- Name: return_lines return_lines_return_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.return_lines
    ADD CONSTRAINT return_lines_return_id_fkey FOREIGN KEY (return_id) REFERENCES public.returns(id) ON DELETE CASCADE;


--
-- Name: return_lines return_lines_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.return_lines
    ADD CONSTRAINT return_lines_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: return_lines return_lines_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.return_lines
    ADD CONSTRAINT return_lines_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id) ON DELETE SET NULL;


--
-- Name: return_requests return_requests_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.return_requests
    ADD CONSTRAINT return_requests_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: return_requests return_requests_processed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.return_requests
    ADD CONSTRAINT return_requests_processed_by_fkey FOREIGN KEY (processed_by) REFERENCES public.users_custom(id) ON DELETE SET NULL;


--
-- Name: return_requests return_requests_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.return_requests
    ADD CONSTRAINT return_requests_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: returns returns_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.returns
    ADD CONSTRAINT returns_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: returns returns_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.returns
    ADD CONSTRAINT returns_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: runtime_checkpoints runtime_checkpoints_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.runtime_checkpoints
    ADD CONSTRAINT runtime_checkpoints_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: runtime_command_journal runtime_command_journal_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.runtime_command_journal
    ADD CONSTRAINT runtime_command_journal_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: runtime_diagnostics runtime_diagnostics_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.runtime_diagnostics
    ADD CONSTRAINT runtime_diagnostics_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: runtime_replay_executions runtime_replay_executions_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.runtime_replay_executions
    ADD CONSTRAINT runtime_replay_executions_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: runtime_structured_logs runtime_structured_logs_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.runtime_structured_logs
    ADD CONSTRAINT runtime_structured_logs_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: runtime_telemetry_metrics runtime_telemetry_metrics_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.runtime_telemetry_metrics
    ADD CONSTRAINT runtime_telemetry_metrics_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: search_documents search_documents_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.search_documents
    ADD CONSTRAINT search_documents_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: site_gate_attempts site_gate_attempts_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_gate_attempts
    ADD CONSTRAINT site_gate_attempts_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;

--
-- Name: site_domain_reviews site_domain_reviews_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_domain_reviews
    ADD CONSTRAINT site_domain_reviews_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;

--
-- Name: domain_orders domain_orders_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_orders
    ADD CONSTRAINT domain_orders_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: site_preview_links site_preview_links_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_preview_links
    ADD CONSTRAINT site_preview_links_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_device_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_device_id_fkey FOREIGN KEY (device_id) REFERENCES public.devices(id);


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users_custom(id) ON DELETE CASCADE;


--
-- Name: shipment_events shipment_events_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipment_events
    ADD CONSTRAINT shipment_events_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: shipment_events shipment_events_shipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipment_events
    ADD CONSTRAINT shipment_events_shipment_id_fkey FOREIGN KEY (shipment_id) REFERENCES public.shipments(id) ON DELETE CASCADE;


--
-- Name: shipment_events shipment_events_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipment_events
    ADD CONSTRAINT shipment_events_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: shipments shipments_fulfillment_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipments
    ADD CONSTRAINT shipments_fulfillment_order_id_fkey FOREIGN KEY (fulfillment_order_id) REFERENCES public.fulfillment_orders(id) ON DELETE SET NULL;


--
-- Name: shipments shipments_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipments
    ADD CONSTRAINT shipments_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: shipments shipments_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipments
    ADD CONSTRAINT shipments_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: shipping_rates shipping_rates_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_rates
    ADD CONSTRAINT shipping_rates_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.shipping_zones(id) ON DELETE CASCADE;


--
-- Name: shipping_zones shipping_zones_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_zones
    ADD CONSTRAINT shipping_zones_site_id_fkey FOREIGN KEY (store_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: site_api_clients site_api_clients_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_api_clients
    ADD CONSTRAINT site_api_clients_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: site_entitlement_overrides site_entitlement_overrides_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_entitlement_overrides
    ADD CONSTRAINT site_entitlement_overrides_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: site_memberships site_memberships_custom_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_memberships
    ADD CONSTRAINT site_memberships_custom_user_id_fkey FOREIGN KEY (custom_user_id) REFERENCES public.users_custom(id) ON DELETE CASCADE;


--
-- Name: site_memberships site_memberships_legacy_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_memberships
    ADD CONSTRAINT site_memberships_legacy_user_id_fkey FOREIGN KEY (legacy_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: site_memberships site_memberships_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_memberships
    ADD CONSTRAINT site_memberships_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: site_role_permissions site_role_permissions_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_role_permissions
    ADD CONSTRAINT site_role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.site_roles(id) ON DELETE CASCADE;


--
-- Name: site_roles site_roles_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_roles
    ADD CONSTRAINT site_roles_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: site_usage_meters site_usage_meters_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_usage_meters
    ADD CONSTRAINT site_usage_meters_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: sites sites_current_theme_release_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sites
    ADD CONSTRAINT sites_current_theme_release_fk FOREIGN KEY (current_theme_release_id) REFERENCES public.theme_releases(id) ON DELETE SET NULL;


--
-- Name: sites sites_custom_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sites
    ADD CONSTRAINT sites_custom_user_id_fkey FOREIGN KEY (custom_user_id) REFERENCES public.users_custom(id) ON DELETE CASCADE;


--
-- Name: sites sites_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sites
    ADD CONSTRAINT sites_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: skill_endorsements skill_endorsements_skill_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.skill_endorsements
    ADD CONSTRAINT skill_endorsements_skill_id_fkey FOREIGN KEY (skill_id) REFERENCES public.skills(id) ON DELETE CASCADE;


--
-- Name: skills skills_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.skills
    ADD CONSTRAINT skills_site_id_fkey FOREIGN KEY (store_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: smart_collections smart_collections_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.smart_collections
    ADD CONSTRAINT smart_collections_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: store_customers store_customers_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_customers
    ADD CONSTRAINT store_customers_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: store_themes store_themes_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_themes
    ADD CONSTRAINT store_themes_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: store_themes store_themes_theme_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_themes
    ADD CONSTRAINT store_themes_theme_id_fkey FOREIGN KEY (theme_id) REFERENCES public.themes(id) ON DELETE CASCADE;


--
-- Name: storefront_cache_tags storefront_cache_tags_release_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.storefront_cache_tags
    ADD CONSTRAINT storefront_cache_tags_release_id_fkey FOREIGN KEY (release_id) REFERENCES public.theme_releases(id) ON DELETE SET NULL;


--
-- Name: storefront_cache_tags storefront_cache_tags_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.storefront_cache_tags
    ADD CONSTRAINT storefront_cache_tags_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: storefront_page_revisions storefront_page_revisions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.storefront_page_revisions
    ADD CONSTRAINT storefront_page_revisions_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: storefront_page_revisions storefront_page_revisions_page_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.storefront_page_revisions
    ADD CONSTRAINT storefront_page_revisions_page_id_fkey FOREIGN KEY (page_id) REFERENCES public.storefront_pages(id) ON DELETE CASCADE;


--
-- Name: storefront_page_revisions storefront_page_revisions_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.storefront_page_revisions
    ADD CONSTRAINT storefront_page_revisions_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: storefront_pages storefront_pages_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.storefront_pages
    ADD CONSTRAINT storefront_pages_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: storefront_pages storefront_pages_published_revision_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.storefront_pages
    ADD CONSTRAINT storefront_pages_published_revision_fk FOREIGN KEY (published_revision_id) REFERENCES public.storefront_page_revisions(id) ON DELETE SET NULL;


--
-- Name: storefront_pages storefront_pages_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.storefront_pages
    ADD CONSTRAINT storefront_pages_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: storefront_pages storefront_pages_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.storefront_pages
    ADD CONSTRAINT storefront_pages_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: storefront_policies storefront_policies_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.storefront_policies
    ADD CONSTRAINT storefront_policies_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: storefront_policies storefront_policies_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.storefront_policies
    ADD CONSTRAINT storefront_policies_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: storefront_policies storefront_policies_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.storefront_policies
    ADD CONSTRAINT storefront_policies_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: storefront_slug_redirects storefront_slug_redirects_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.storefront_slug_redirects
    ADD CONSTRAINT storefront_slug_redirects_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: storefront_slug_redirects storefront_slug_redirects_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.storefront_slug_redirects
    ADD CONSTRAINT storefront_slug_redirects_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: subscriptions subscriptions_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.plans(id);


--
-- Name: subscriptions subscriptions_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: subscriptions subscriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users_custom(id) ON DELETE CASCADE;


--
-- Name: super_admin_allowlist super_admins_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.super_admin_allowlist
    ADD CONSTRAINT super_admins_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: super_admin_allowlist super_admins_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.super_admin_allowlist
    ADD CONSTRAINT super_admins_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: suppliers suppliers_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: tax_rates tax_rates_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_rates
    ADD CONSTRAINT tax_rates_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: tenant_execution_quotas tenant_execution_quotas_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_execution_quotas
    ADD CONSTRAINT tenant_execution_quotas_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: tenant_operation_projections tenant_operation_projections_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_operation_projections
    ADD CONSTRAINT tenant_operation_projections_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: testimonials testimonials_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.testimonials
    ADD CONSTRAINT testimonials_site_id_fkey FOREIGN KEY (store_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: theme_assets theme_assets_theme_package_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_assets
    ADD CONSTRAINT theme_assets_theme_package_version_id_fkey FOREIGN KEY (theme_package_version_id) REFERENCES public.theme_package_versions(id) ON DELETE CASCADE;


--
-- Name: theme_block_definitions theme_block_definitions_theme_package_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_block_definitions
    ADD CONSTRAINT theme_block_definitions_theme_package_version_id_fkey FOREIGN KEY (theme_package_version_id) REFERENCES public.theme_package_versions(id) ON DELETE CASCADE;


--
-- Name: theme_draft_patches theme_draft_patches_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_draft_patches
    ADD CONSTRAINT theme_draft_patches_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: theme_draft_patches theme_draft_patches_draft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_draft_patches
    ADD CONSTRAINT theme_draft_patches_draft_id_fkey FOREIGN KEY (draft_id) REFERENCES public.theme_instance_drafts(id) ON DELETE CASCADE;


--
-- Name: theme_draft_patches theme_draft_patches_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_draft_patches
    ADD CONSTRAINT theme_draft_patches_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: theme_editor_drafts theme_editor_drafts_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_editor_drafts
    ADD CONSTRAINT theme_editor_drafts_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: theme_editor_drafts theme_editor_drafts_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_editor_drafts
    ADD CONSTRAINT theme_editor_drafts_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: theme_editor_drafts theme_editor_drafts_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_editor_drafts
    ADD CONSTRAINT theme_editor_drafts_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id);


--
-- Name: theme_instance_drafts theme_instance_drafts_base_release_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_instance_drafts
    ADD CONSTRAINT theme_instance_drafts_base_release_id_fkey FOREIGN KEY (base_release_id) REFERENCES public.theme_releases(id) ON DELETE SET NULL;


--
-- Name: theme_instance_drafts theme_instance_drafts_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_instance_drafts
    ADD CONSTRAINT theme_instance_drafts_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: theme_instance_drafts theme_instance_drafts_locked_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_instance_drafts
    ADD CONSTRAINT theme_instance_drafts_locked_by_fkey FOREIGN KEY (locked_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: theme_instance_drafts theme_instance_drafts_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_instance_drafts
    ADD CONSTRAINT theme_instance_drafts_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: theme_instance_drafts theme_instance_drafts_theme_instance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_instance_drafts
    ADD CONSTRAINT theme_instance_drafts_theme_instance_id_fkey FOREIGN KEY (theme_instance_id) REFERENCES public.theme_instances(id) ON DELETE CASCADE;


--
-- Name: theme_instance_drafts theme_instance_drafts_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_instance_drafts
    ADD CONSTRAINT theme_instance_drafts_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: theme_instances theme_instances_active_release_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_instances
    ADD CONSTRAINT theme_instances_active_release_id_fkey FOREIGN KEY (active_release_id) REFERENCES public.theme_releases(id) ON DELETE SET NULL;


--
-- Name: theme_instances theme_instances_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_instances
    ADD CONSTRAINT theme_instances_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: theme_instances theme_instances_current_draft_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_instances
    ADD CONSTRAINT theme_instances_current_draft_fk FOREIGN KEY (current_draft_id) REFERENCES public.theme_instance_drafts(id) ON DELETE SET NULL;


--
-- Name: theme_instances theme_instances_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_instances
    ADD CONSTRAINT theme_instances_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: theme_instances theme_instances_theme_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_instances
    ADD CONSTRAINT theme_instances_theme_package_id_fkey FOREIGN KEY (theme_package_id) REFERENCES public.theme_packages(id) ON DELETE RESTRICT;


--
-- Name: theme_instances theme_instances_theme_package_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_instances
    ADD CONSTRAINT theme_instances_theme_package_version_id_fkey FOREIGN KEY (theme_package_version_id) REFERENCES public.theme_package_versions(id) ON DELETE RESTRICT;


--
-- Name: theme_instances theme_instances_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_instances
    ADD CONSTRAINT theme_instances_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: theme_layouts theme_layouts_theme_package_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_layouts
    ADD CONSTRAINT theme_layouts_theme_package_version_id_fkey FOREIGN KEY (theme_package_version_id) REFERENCES public.theme_package_versions(id) ON DELETE CASCADE;


--
-- Name: theme_migrations theme_migrations_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_migrations
    ADD CONSTRAINT theme_migrations_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: theme_migrations theme_migrations_from_theme_package_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_migrations
    ADD CONSTRAINT theme_migrations_from_theme_package_version_id_fkey FOREIGN KEY (from_theme_package_version_id) REFERENCES public.theme_package_versions(id) ON DELETE SET NULL;


--
-- Name: theme_migrations theme_migrations_theme_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_migrations
    ADD CONSTRAINT theme_migrations_theme_package_id_fkey FOREIGN KEY (theme_package_id) REFERENCES public.theme_packages(id) ON DELETE CASCADE;


--
-- Name: theme_migrations theme_migrations_to_theme_package_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_migrations
    ADD CONSTRAINT theme_migrations_to_theme_package_version_id_fkey FOREIGN KEY (to_theme_package_version_id) REFERENCES public.theme_package_versions(id) ON DELETE CASCADE;


--
-- Name: theme_package_versions theme_package_versions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_package_versions
    ADD CONSTRAINT theme_package_versions_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: theme_package_versions theme_package_versions_theme_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_package_versions
    ADD CONSTRAINT theme_package_versions_theme_package_id_fkey FOREIGN KEY (theme_package_id) REFERENCES public.theme_packages(id) ON DELETE CASCADE;


--
-- Name: theme_packages theme_packages_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_packages
    ADD CONSTRAINT theme_packages_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: theme_packages theme_packages_legacy_theme_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_packages
    ADD CONSTRAINT theme_packages_legacy_theme_id_fkey FOREIGN KEY (legacy_theme_id) REFERENCES public.themes(id) ON DELETE SET NULL;


--
-- Name: theme_presets theme_presets_theme_package_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_presets
    ADD CONSTRAINT theme_presets_theme_package_version_id_fkey FOREIGN KEY (theme_package_version_id) REFERENCES public.theme_package_versions(id) ON DELETE CASCADE;


--
-- Name: theme_preview_sessions theme_preview_sessions_draft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_preview_sessions
    ADD CONSTRAINT theme_preview_sessions_draft_id_fkey FOREIGN KEY (draft_id) REFERENCES public.theme_editor_drafts(id) ON DELETE SET NULL;


--
-- Name: theme_preview_sessions theme_preview_sessions_instance_draft_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_preview_sessions
    ADD CONSTRAINT theme_preview_sessions_instance_draft_fk FOREIGN KEY (theme_instance_draft_id) REFERENCES public.theme_instance_drafts(id) ON DELETE SET NULL;


--
-- Name: theme_preview_sessions theme_preview_sessions_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_preview_sessions
    ADD CONSTRAINT theme_preview_sessions_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: theme_purchases theme_purchases_theme_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_purchases
    ADD CONSTRAINT theme_purchases_theme_id_fkey FOREIGN KEY (theme_id) REFERENCES public.themes(id) ON DELETE CASCADE;


--
-- Name: theme_purchases theme_purchases_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_purchases
    ADD CONSTRAINT theme_purchases_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users_custom(id);


--
-- Name: theme_releases theme_releases_rollback_of_release_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_releases
    ADD CONSTRAINT theme_releases_rollback_of_release_id_fkey FOREIGN KEY (rollback_of_release_id) REFERENCES public.theme_releases(id) ON DELETE SET NULL;


--
-- Name: theme_releases theme_releases_source_draft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_releases
    ADD CONSTRAINT theme_releases_source_draft_id_fkey FOREIGN KEY (source_draft_id) REFERENCES public.theme_editor_drafts(id) ON DELETE SET NULL;


--
-- Name: theme_releases theme_releases_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_releases
    ADD CONSTRAINT theme_releases_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: theme_releases theme_releases_theme_instance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_releases
    ADD CONSTRAINT theme_releases_theme_instance_id_fkey FOREIGN KEY (theme_instance_id) REFERENCES public.theme_instances(id) ON DELETE SET NULL;


--
-- Name: theme_releases theme_releases_theme_package_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_releases
    ADD CONSTRAINT theme_releases_theme_package_version_id_fkey FOREIGN KEY (theme_package_version_id) REFERENCES public.theme_package_versions(id) ON DELETE SET NULL;


--
-- Name: theme_renderer_manifests theme_renderer_manifests_theme_package_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_renderer_manifests
    ADD CONSTRAINT theme_renderer_manifests_theme_package_version_id_fkey FOREIGN KEY (theme_package_version_id) REFERENCES public.theme_package_versions(id) ON DELETE CASCADE;


--
-- Name: theme_reviews theme_reviews_theme_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_reviews
    ADD CONSTRAINT theme_reviews_theme_id_fkey FOREIGN KEY (theme_id) REFERENCES public.themes(id) ON DELETE CASCADE;


--
-- Name: theme_reviews theme_reviews_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_reviews
    ADD CONSTRAINT theme_reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users_custom(id);


--
-- Name: theme_schema_manifests theme_schema_manifests_theme_package_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_schema_manifests
    ADD CONSTRAINT theme_schema_manifests_theme_package_version_id_fkey FOREIGN KEY (theme_package_version_id) REFERENCES public.theme_package_versions(id) ON DELETE CASCADE;


--
-- Name: theme_section_definitions theme_section_definitions_theme_package_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_section_definitions
    ADD CONSTRAINT theme_section_definitions_theme_package_version_id_fkey FOREIGN KEY (theme_package_version_id) REFERENCES public.theme_package_versions(id) ON DELETE CASCADE;


--
-- Name: theme_template_assignments theme_template_assignments_assigned_release_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_template_assignments
    ADD CONSTRAINT theme_template_assignments_assigned_release_id_fkey FOREIGN KEY (assigned_release_id) REFERENCES public.theme_releases(id) ON DELETE SET NULL;


--
-- Name: theme_template_assignments theme_template_assignments_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_template_assignments
    ADD CONSTRAINT theme_template_assignments_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: theme_template_assignments theme_template_assignments_theme_instance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_template_assignments
    ADD CONSTRAINT theme_template_assignments_theme_instance_id_fkey FOREIGN KEY (theme_instance_id) REFERENCES public.theme_instances(id) ON DELETE CASCADE;


--
-- Name: theme_templates theme_templates_theme_package_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_templates
    ADD CONSTRAINT theme_templates_theme_package_version_id_fkey FOREIGN KEY (theme_package_version_id) REFERENCES public.theme_package_versions(id) ON DELETE CASCADE;


--
-- Name: usage_meter_entries usage_meter_entries_meter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usage_meter_entries
    ADD CONSTRAINT usage_meter_entries_meter_id_fkey FOREIGN KEY (meter_id) REFERENCES public.site_usage_meters(id) ON DELETE CASCADE;


--
-- Name: usage_meter_entries usage_meter_entries_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usage_meter_entries
    ADD CONSTRAINT usage_meter_entries_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: user_profiles user_profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: verification_tokens verification_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_tokens
    ADD CONSTRAINT verification_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users_custom(id) ON DELETE CASCADE;


--
-- Name: webhook_deliveries webhook_deliveries_outbox_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_deliveries
    ADD CONSTRAINT webhook_deliveries_outbox_event_id_fkey FOREIGN KEY (outbox_event_id) REFERENCES public.outbox_events(id) ON DELETE SET NULL;


--
-- Name: webhook_deliveries webhook_deliveries_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_deliveries
    ADD CONSTRAINT webhook_deliveries_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: webhook_deliveries webhook_deliveries_subscription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_deliveries
    ADD CONSTRAINT webhook_deliveries_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.webhook_subscriptions(id) ON DELETE CASCADE;


--
-- Name: webhook_subscriptions webhook_subscriptions_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_subscriptions
    ADD CONSTRAINT webhook_subscriptions_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: wishlists wishlists_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wishlists
    ADD CONSTRAINT wishlists_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: wishlists wishlists_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wishlists
    ADD CONSTRAINT wishlists_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: work_experience work_experience_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_experience
    ADD CONSTRAINT work_experience_site_id_fkey FOREIGN KEY (store_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: worker_request_logs worker_request_logs_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.worker_request_logs
    ADD CONSTRAINT worker_request_logs_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE SET NULL;


--
-- Name: workflow_heartbeats workflow_heartbeats_execution_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_heartbeats
    ADD CONSTRAINT workflow_heartbeats_execution_id_fkey FOREIGN KEY (execution_id) REFERENCES public.workflow_lifecycle(execution_id) ON DELETE CASCADE;


--
-- Name: workflow_lifecycle workflow_lifecycle_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_lifecycle
    ADD CONSTRAINT workflow_lifecycle_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: workflow_operation_snapshots workflow_operation_snapshots_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_operation_snapshots
    ADD CONSTRAINT workflow_operation_snapshots_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: wishlists Anyone can manage their wishlists via API; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can manage their wishlists via API" ON public.wishlists USING (true) WITH CHECK ((store_id IN ( SELECT sites.id
   FROM public.sites
  WHERE (sites.status = 'published'::text))));


--
-- Name: form_submissions Anyone can submit forms; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can submit forms" ON public.form_submissions FOR INSERT WITH CHECK ((store_id IN ( SELECT sites.id
   FROM public.sites
  WHERE (sites.status = 'published'::text))));


--
-- Name: blog_comments Authenticated users create comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users create comments" ON public.blog_comments FOR INSERT TO authenticated WITH CHECK ((post_id IN ( SELECT blog_posts.id
   FROM public.blog_posts
  WHERE ((blog_posts.status = 'published'::text) AND (blog_posts.allow_comments = true)))));


--
-- Name: theme_reviews Public can read published theme reviews; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can read published theme reviews" ON public.theme_reviews FOR SELECT USING ((status = 'published'::text));


--
-- Name: blog_comments Public can view approved comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can view approved comments" ON public.blog_comments FOR SELECT USING (((status = 'approved'::text) AND (post_id IN ( SELECT blog_posts.id
   FROM public.blog_posts
  WHERE ((blog_posts.status = 'published'::text) AND (blog_posts.store_id IN ( SELECT sites.id
           FROM public.sites
          WHERE (sites.status = 'published'::text))))))));


--
-- Name: blog_post_tags Public can view blog post tags; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can view blog post tags" ON public.blog_post_tags FOR SELECT USING ((post_id IN ( SELECT blog_posts.id
   FROM public.blog_posts
  WHERE (blog_posts.status = 'published'::text))));


--
-- Name: blog_tags Public can view blog tags; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can view blog tags" ON public.blog_tags FOR SELECT USING ((store_id IN ( SELECT sites.id
   FROM public.sites
  WHERE (sites.status = 'published'::text))));


--
-- Name: media Public can view media from published stores; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can view media from published stores" ON public.media FOR SELECT USING ((store_id IN ( SELECT sites.id
   FROM public.sites
  WHERE (sites.status = 'published'::text))));


--
-- Name: blog_posts Public can view published blog posts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can view published blog posts" ON public.blog_posts FOR SELECT USING (((status = 'published'::text) AND (store_id IN ( SELECT sites.id
   FROM public.sites
  WHERE (sites.status = 'published'::text)))));


--
-- Name: blog_categories Public can view visible blog categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can view visible blog categories" ON public.blog_categories FOR SELECT USING (((is_visible = true) AND (store_id IN ( SELECT sites.id
   FROM public.sites
  WHERE (sites.status = 'published'::text)))));


--
-- Name: devices Service role full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role full access" ON public.devices USING (true) WITH CHECK (true);


--
-- Name: sessions Service role full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role full access" ON public.sessions USING (true) WITH CHECK (true);


--
-- Name: users_custom Service role full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role full access" ON public.users_custom USING (true) WITH CHECK (true);


--
-- Name: verification_tokens Service role full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role full access" ON public.verification_tokens USING (true) WITH CHECK (true);


--
-- Name: ai_usage Service role manages AI usage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role manages AI usage" ON public.ai_usage FOR INSERT WITH CHECK (true);


--
-- Name: customer_credentials Service role manages customer credentials; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role manages customer credentials" ON public.customer_credentials USING (true) WITH CHECK (true);


--
-- Name: store_themes Store owners can install themes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Store owners can install themes" ON public.store_themes FOR INSERT WITH CHECK ((store_id IN ( SELECT sites.id
   FROM public.sites
  WHERE ((sites.user_id = auth.uid()) OR (sites.custom_user_id = auth.uid())))));


--
-- Name: store_themes Store owners can uninstall themes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Store owners can uninstall themes" ON public.store_themes FOR DELETE USING ((store_id IN ( SELECT sites.id
   FROM public.sites
  WHERE ((sites.user_id = auth.uid()) OR (sites.custom_user_id = auth.uid())))));


--
-- Name: store_themes Store owners can update their themes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Store owners can update their themes" ON public.store_themes FOR UPDATE USING ((store_id IN ( SELECT sites.id
   FROM public.sites
  WHERE ((sites.user_id = auth.uid()) OR (sites.custom_user_id = auth.uid())))));


--
-- Name: store_themes Store owners can view their themes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Store owners can view their themes" ON public.store_themes FOR SELECT USING ((store_id IN ( SELECT sites.id
   FROM public.sites
  WHERE ((sites.user_id = auth.uid()) OR (sites.custom_user_id = auth.uid())))));


--
-- Name: ai_credits Store owners manage AI credits; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Store owners manage AI credits" ON public.ai_credits USING ((store_id IN ( SELECT sites.id
   FROM public.sites
  WHERE true))) WITH CHECK ((store_id IN ( SELECT sites.id
   FROM public.sites
  WHERE true)));


--
-- Name: blog_categories Store owners manage blog categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Store owners manage blog categories" ON public.blog_categories USING ((store_id IN ( SELECT sites.id
   FROM public.sites
  WHERE true))) WITH CHECK ((store_id IN ( SELECT sites.id
   FROM public.sites
  WHERE true)));


--
-- Name: blog_post_tags Store owners manage blog post tags; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Store owners manage blog post tags" ON public.blog_post_tags USING ((post_id IN ( SELECT bp.id
   FROM (public.blog_posts bp
     JOIN public.sites s ON ((bp.store_id = s.id)))
  WHERE true))) WITH CHECK ((post_id IN ( SELECT bp.id
   FROM (public.blog_posts bp
     JOIN public.sites s ON ((bp.store_id = s.id)))
  WHERE true)));


--
-- Name: blog_posts Store owners manage blog posts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Store owners manage blog posts" ON public.blog_posts USING ((store_id IN ( SELECT sites.id
   FROM public.sites
  WHERE true))) WITH CHECK ((store_id IN ( SELECT sites.id
   FROM public.sites
  WHERE true)));


--
-- Name: blog_tags Store owners manage blog tags; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Store owners manage blog tags" ON public.blog_tags USING ((store_id IN ( SELECT sites.id
   FROM public.sites
  WHERE true))) WITH CHECK ((store_id IN ( SELECT sites.id
   FROM public.sites
  WHERE true)));


--
-- Name: customer_addresses Store owners manage customer addresses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Store owners manage customer addresses" ON public.customer_addresses USING ((store_id IN ( SELECT sites.id
   FROM public.sites
  WHERE true))) WITH CHECK ((store_id IN ( SELECT sites.id
   FROM public.sites
  WHERE true)));


--
-- Name: customer_credentials Store owners manage customer credentials; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Store owners manage customer credentials" ON public.customer_credentials USING ((store_id IN ( SELECT sites.id
   FROM public.sites
  WHERE true))) WITH CHECK ((store_id IN ( SELECT sites.id
   FROM public.sites
  WHERE true)));


--
-- Name: form_submissions Store owners manage form submissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Store owners manage form submissions" ON public.form_submissions USING ((store_id IN ( SELECT sites.id
   FROM public.sites
  WHERE true)));


--
-- Name: media Store owners manage media; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Store owners manage media" ON public.media USING ((store_id IN ( SELECT sites.id
   FROM public.sites
  WHERE true))) WITH CHECK ((store_id IN ( SELECT sites.id
   FROM public.sites
  WHERE true)));


--
-- Name: return_requests Store owners manage returns; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Store owners manage returns" ON public.return_requests USING ((store_id IN ( SELECT sites.id
   FROM public.sites
  WHERE true)));


--
-- Name: blog_comments Store owners moderate comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Store owners moderate comments" ON public.blog_comments USING ((store_id IN ( SELECT sites.id
   FROM public.sites
  WHERE true)));


--
-- Name: ai_usage Store owners view AI usage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Store owners view AI usage" ON public.ai_usage FOR SELECT USING ((store_id IN ( SELECT sites.id
   FROM public.sites
  WHERE true)));


--
-- Name: wishlists Store owners view wishlists; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Store owners view wishlists" ON public.wishlists FOR SELECT USING ((store_id IN ( SELECT sites.id
   FROM public.sites
  WHERE true)));


--
-- Name: notifications System can insert notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "System can insert notifications" ON public.notifications FOR INSERT WITH CHECK (true);


--
-- Name: themes Themes are viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Themes are viewable by everyone" ON public.themes FOR SELECT USING (true);


--
-- Name: theme_purchases Users create theme purchases; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users create theme purchases" ON public.theme_purchases FOR INSERT WITH CHECK (true);


--
-- Name: notifications Users delete own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users delete own notifications" ON public.notifications FOR DELETE USING (true);


--
-- Name: theme_reviews Users manage own theme reviews; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage own theme reviews" ON public.theme_reviews USING (true);


--
-- Name: notification_preferences Users manage their notification preferences; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage their notification preferences" ON public.notification_preferences USING (true) WITH CHECK (true);


--
-- Name: notifications Users update own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users update own notifications" ON public.notifications FOR UPDATE USING (true);


--
-- Name: notifications Users view own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users view own notifications" ON public.notifications FOR SELECT USING (true);


--
-- Name: theme_purchases Users view own theme purchases; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users view own theme purchases" ON public.theme_purchases FOR SELECT USING (true);


--
-- Name: ai_credits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_credits ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_usage; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

--
-- Name: analytics_event_stream; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.analytics_event_stream ENABLE ROW LEVEL SECURITY;

--
-- Name: analytics_event_stream analytics_event_stream_owner_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY analytics_event_stream_owner_read ON public.analytics_event_stream FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.sites
  WHERE ((sites.id = analytics_event_stream.site_id) AND ((sites.user_id = auth.uid()) OR (sites.custom_user_id = auth.uid())) AND (sites.deleted_at IS NULL)))));


--
-- Name: analytics_event_stream analytics_event_stream_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY analytics_event_stream_service_all ON public.analytics_event_stream USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: analytics_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

--
-- Name: analytics_rollups_daily; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.analytics_rollups_daily ENABLE ROW LEVEL SECURITY;

--
-- Name: analytics_rollups_daily analytics_rollups_daily_owner_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY analytics_rollups_daily_owner_read ON public.analytics_rollups_daily FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.sites
  WHERE ((sites.id = analytics_rollups_daily.site_id) AND ((sites.user_id = auth.uid()) OR (sites.custom_user_id = auth.uid())) AND (sites.deleted_at IS NULL)))));


--
-- Name: analytics_rollups_daily analytics_rollups_daily_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY analytics_rollups_daily_service_all ON public.analytics_rollups_daily USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: skill_endorsements anyone_create_endorsements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anyone_create_endorsements ON public.skill_endorsements FOR INSERT TO authenticated, anon WITH CHECK (true);


--
-- Name: plans anyone_read_plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anyone_read_plans ON public.plans FOR SELECT USING (true);


--
-- Name: employee_roles anyone_read_roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anyone_read_roles ON public.employee_roles FOR SELECT USING (true);


--
-- Name: app_billing_charges; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.app_billing_charges ENABLE ROW LEVEL SECURITY;

--
-- Name: app_billing_charges app_billing_charges_partner_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY app_billing_charges_partner_read ON public.app_billing_charges FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.app_developers
  WHERE ((app_developers.id = app_billing_charges.partner_id) AND (app_developers.user_id = auth.uid())))));


--
-- Name: app_billing_charges app_billing_charges_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY app_billing_charges_service_all ON public.app_billing_charges USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: app_billing_charges app_billing_charges_store_owner_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY app_billing_charges_store_owner_read ON public.app_billing_charges FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.sites
  WHERE ((sites.id = app_billing_charges.site_id) AND (sites.user_id = auth.uid())))));


--
-- Name: app_categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.app_categories ENABLE ROW LEVEL SECURITY;

--
-- Name: app_developers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.app_developers ENABLE ROW LEVEL SECURITY;

--
-- Name: app_extensions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.app_extensions ENABLE ROW LEVEL SECURITY;

--
-- Name: app_installations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.app_installations ENABLE ROW LEVEL SECURITY;

--
-- Name: app_reviews; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.app_reviews ENABLE ROW LEVEL SECURITY;

--
-- Name: app_webhooks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.app_webhooks ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_activity_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_activity_events ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_activity_events audit_activity_events_owner_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY audit_activity_events_owner_read ON public.audit_activity_events FOR SELECT USING (((store_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.sites
  WHERE ((sites.id = audit_activity_events.store_id) AND (sites.user_id = auth.uid()) AND (sites.deleted_at IS NULL))))));


--
-- Name: audit_activity_events audit_activity_events_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY audit_activity_events_service_all ON public.audit_activity_events USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: audit_logs audit_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY audit_insert ON public.audit_logs FOR INSERT WITH CHECK (true);


--
-- Name: audit_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_logs audit_read_super_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY audit_read_super_admin ON public.audit_logs FOR SELECT USING (public.is_super_admin());


--
-- Name: billing_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.billing_history ENABLE ROW LEVEL SECURITY;

--
-- Name: blog_categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.blog_categories ENABLE ROW LEVEL SECURITY;

--
-- Name: blog_comments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.blog_comments ENABLE ROW LEVEL SECURITY;

--
-- Name: blog_post_tags; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.blog_post_tags ENABLE ROW LEVEL SECURITY;

--
-- Name: blog_posts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

--
-- Name: blog_tags; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.blog_tags ENABLE ROW LEVEL SECURITY;

--
-- Name: cache_invalidation_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cache_invalidation_events ENABLE ROW LEVEL SECURITY;

--
-- Name: cache_invalidation_events cache_invalidation_events_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cache_invalidation_events_service_all ON public.cache_invalidation_events USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: cache_operation_snapshots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cache_operation_snapshots ENABLE ROW LEVEL SECURITY;

--
-- Name: cache_operation_snapshots cache_operation_snapshots_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cache_operation_snapshots_service_all ON public.cache_operation_snapshots USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: carts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;

--
-- Name: certifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.certifications ENABLE ROW LEVEL SECURITY;

--
-- Name: chaos_experiment_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chaos_experiment_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: chaos_experiment_runs chaos_experiment_runs_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chaos_experiment_runs_service_all ON public.chaos_experiment_runs USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: checkout_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.checkout_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: checkout_sessions checkout_sessions_owner_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY checkout_sessions_owner_read ON public.checkout_sessions FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.sites
  WHERE ((sites.id = checkout_sessions.site_id) AND (sites.user_id = auth.uid()) AND (sites.deleted_at IS NULL)))));


--
-- Name: checkout_sessions checkout_sessions_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY checkout_sessions_service_all ON public.checkout_sessions USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: collection_products; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.collection_products ENABLE ROW LEVEL SECURITY;

--
-- Name: collections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;

--
-- Name: contact_submissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;

--
-- Name: coordination_operation_diagnostics; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.coordination_operation_diagnostics ENABLE ROW LEVEL SECURITY;

--
-- Name: coordination_operation_diagnostics coordination_operation_diagnostics_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY coordination_operation_diagnostics_service_all ON public.coordination_operation_diagnostics USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: coupons; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

--
-- Name: customer_activity_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customer_activity_log ENABLE ROW LEVEL SECURITY;

--
-- Name: customer_addresses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;

--
-- Name: customer_credentials; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customer_credentials ENABLE ROW LEVEL SECURITY;

--
-- Name: customer_wishlists; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customer_wishlists ENABLE ROW LEVEL SECURITY;

--
-- Name: carts customers_manage_own_carts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY customers_manage_own_carts ON public.carts TO authenticated USING ((customer_id = auth.uid())) WITH CHECK ((customer_id = auth.uid()));


--
-- Name: database_operation_snapshots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.database_operation_snapshots ENABLE ROW LEVEL SECURITY;

--
-- Name: database_operation_snapshots database_operation_snapshots_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY database_operation_snapshots_service_all ON public.database_operation_snapshots USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: deployment_health_gate_results; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.deployment_health_gate_results ENABLE ROW LEVEL SECURITY;

--
-- Name: deployment_health_gate_results deployment_health_gate_results_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY deployment_health_gate_results_service_all ON public.deployment_health_gate_results USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: deployment_promotion_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.deployment_promotion_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: deployment_promotion_runs deployment_promotion_runs_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY deployment_promotion_runs_service_all ON public.deployment_promotion_runs USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: device_tokens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: devices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

--
-- Name: distributed_event_store; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.distributed_event_store ENABLE ROW LEVEL SECURITY;

--
-- Name: distributed_event_store distributed_event_store_owner_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY distributed_event_store_owner_read ON public.distributed_event_store FOR SELECT USING (((site_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.sites
  WHERE ((sites.id = distributed_event_store.site_id) AND ((sites.user_id = auth.uid()) OR (sites.custom_user_id = auth.uid())) AND (sites.deleted_at IS NULL))))));


--
-- Name: distributed_event_store distributed_event_store_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY distributed_event_store_service_all ON public.distributed_event_store USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: distributed_event_streams; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.distributed_event_streams ENABLE ROW LEVEL SECURITY;

--
-- Name: distributed_event_streams distributed_event_streams_owner_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY distributed_event_streams_owner_read ON public.distributed_event_streams FOR SELECT USING (((site_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.sites
  WHERE ((sites.id = distributed_event_streams.site_id) AND ((sites.user_id = auth.uid()) OR (sites.custom_user_id = auth.uid())) AND (sites.deleted_at IS NULL))))));


--
-- Name: distributed_event_streams distributed_event_streams_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY distributed_event_streams_service_all ON public.distributed_event_streams USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: distributed_queue_heartbeats; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.distributed_queue_heartbeats ENABLE ROW LEVEL SECURITY;

--
-- Name: distributed_queue_heartbeats distributed_queue_heartbeats_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY distributed_queue_heartbeats_service_all ON public.distributed_queue_heartbeats USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: distributed_queue_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.distributed_queue_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: distributed_queue_messages distributed_queue_messages_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY distributed_queue_messages_service_all ON public.distributed_queue_messages USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: education; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.education ENABLE ROW LEVEL SECURITY;

--
-- Name: email_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: employee_invites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.employee_invites ENABLE ROW LEVEL SECURITY;

--
-- Name: employee_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.employee_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: employees; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

--
-- Name: event_store_integrity_checks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.event_store_integrity_checks ENABLE ROW LEVEL SECURITY;

--
-- Name: event_store_integrity_checks event_store_integrity_checks_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY event_store_integrity_checks_service_all ON public.event_store_integrity_checks USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: event_stream_snapshots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.event_stream_snapshots ENABLE ROW LEVEL SECURITY;

--
-- Name: event_stream_snapshots event_stream_snapshots_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY event_stream_snapshots_service_all ON public.event_stream_snapshots USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: execution_audit_trail; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.execution_audit_trail ENABLE ROW LEVEL SECURITY;

--
-- Name: execution_audit_trail execution_audit_trail_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY execution_audit_trail_service_all ON public.execution_audit_trail USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: failover_drill_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.failover_drill_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: failover_drill_runs failover_drill_runs_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY failover_drill_runs_service_all ON public.failover_drill_runs USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: form_submissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.form_submissions ENABLE ROW LEVEL SECURITY;

--
-- Name: fulfillment_order_lines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fulfillment_order_lines ENABLE ROW LEVEL SECURITY;

--
-- Name: fulfillment_order_lines fulfillment_order_lines_owner_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY fulfillment_order_lines_owner_read ON public.fulfillment_order_lines FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.sites
  WHERE ((sites.id = fulfillment_order_lines.site_id) AND (sites.user_id = auth.uid()) AND (sites.deleted_at IS NULL)))));


--
-- Name: fulfillment_order_lines fulfillment_order_lines_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY fulfillment_order_lines_service_all ON public.fulfillment_order_lines USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: fulfillment_orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fulfillment_orders ENABLE ROW LEVEL SECURITY;

--
-- Name: fulfillment_orders fulfillment_orders_owner_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY fulfillment_orders_owner_read ON public.fulfillment_orders FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.sites
  WHERE ((sites.id = fulfillment_orders.site_id) AND (sites.user_id = auth.uid()) AND (sites.deleted_at IS NULL)))));


--
-- Name: fulfillment_orders fulfillment_orders_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY fulfillment_orders_service_all ON public.fulfillment_orders USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: gallery_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.gallery_items ENABLE ROW LEVEL SECURITY;

--
-- Name: gift_card_accounts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.gift_card_accounts ENABLE ROW LEVEL SECURITY;

--
-- Name: gift_card_accounts gift_card_accounts_owner_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY gift_card_accounts_owner_read ON public.gift_card_accounts FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.sites
  WHERE ((sites.id = gift_card_accounts.site_id) AND (sites.user_id = auth.uid()) AND (sites.deleted_at IS NULL)))));


--
-- Name: gift_card_accounts gift_card_accounts_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY gift_card_accounts_service_all ON public.gift_card_accounts USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: gift_card_ledger_entries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.gift_card_ledger_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: gift_card_ledger_entries gift_card_ledger_entries_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY gift_card_ledger_entries_service_all ON public.gift_card_ledger_entries USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: gift_card_redemptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.gift_card_redemptions ENABLE ROW LEVEL SECURITY;

--
-- Name: gift_card_redemptions gift_card_redemptions_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY gift_card_redemptions_service_all ON public.gift_card_redemptions USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: gift_cards; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.gift_cards ENABLE ROW LEVEL SECURITY;

--
-- Name: idempotency_keys; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_adjustments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_adjustments ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_events ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_events inventory_events_owner_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_events_owner_read ON public.inventory_events FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.sites
  WHERE ((sites.id = inventory_events.site_id) AND (sites.user_id = auth.uid()) AND (sites.deleted_at IS NULL)))));


--
-- Name: inventory_events inventory_events_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_events_service_all ON public.inventory_events USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: inventory_level_duplicate_snapshots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_level_duplicate_snapshots ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_level_duplicate_snapshots inventory_level_duplicate_snapshots_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_level_duplicate_snapshots_service_all ON public.inventory_level_duplicate_snapshots USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: inventory_levels; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_levels ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_locations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_locations ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_reservations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_reservations ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_reservations inventory_reservations_owner_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_reservations_owner_read ON public.inventory_reservations FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.sites
  WHERE ((sites.id = inventory_reservations.store_id) AND (sites.user_id = auth.uid()) AND (sites.deleted_at IS NULL)))));


--
-- Name: inventory_reservations inventory_reservations_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_reservations_service_all ON public.inventory_reservations USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: inventory_transfer_lines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_transfer_lines ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_transfer_lines inventory_transfer_lines_owner_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_transfer_lines_owner_read ON public.inventory_transfer_lines FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.sites
  WHERE ((sites.id = inventory_transfer_lines.site_id) AND (sites.user_id = auth.uid()) AND (sites.deleted_at IS NULL)))));


--
-- Name: inventory_transfer_lines inventory_transfer_lines_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_transfer_lines_service_all ON public.inventory_transfer_lines USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: inventory_transfer_receipts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_transfer_receipts ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_transfer_receipts inventory_transfer_receipts_owner_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_transfer_receipts_owner_read ON public.inventory_transfer_receipts FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.sites
  WHERE ((sites.id = inventory_transfer_receipts.site_id) AND (sites.user_id = auth.uid()) AND (sites.deleted_at IS NULL)))));


--
-- Name: inventory_transfer_receipts inventory_transfer_receipts_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_transfer_receipts_service_all ON public.inventory_transfer_receipts USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: inventory_transfers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_transfers ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_transfers inventory_transfers_owner_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_transfers_owner_read ON public.inventory_transfers FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.sites
  WHERE ((sites.id = inventory_transfers.site_id) AND (sites.user_id = auth.uid()) AND (sites.deleted_at IS NULL)))));


--
-- Name: inventory_transfers inventory_transfers_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_transfers_service_all ON public.inventory_transfers USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: lead_forms; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lead_forms ENABLE ROW LEVEL SECURITY;

--
-- Name: leads; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

--
-- Name: load_test_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.load_test_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: load_test_runs load_test_runs_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY load_test_runs_service_all ON public.load_test_runs USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: marketplace_apps; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.marketplace_apps ENABLE ROW LEVEL SECURITY;

--
-- Name: marketplace_review_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.marketplace_review_records ENABLE ROW LEVEL SECURITY;

--
-- Name: marketplace_review_records marketplace_review_records_partner_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY marketplace_review_records_partner_read ON public.marketplace_review_records FOR SELECT USING (((partner_user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.app_developers
  WHERE ((app_developers.id = marketplace_review_records.app_developer_id) AND (app_developers.user_id = auth.uid()))))));


--
-- Name: marketplace_review_records marketplace_review_records_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY marketplace_review_records_service_all ON public.marketplace_review_records USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: media; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.media ENABLE ROW LEVEL SECURITY;

--
-- Name: media_assets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;

--
-- Name: media_assets media_assets_owner_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY media_assets_owner_manage ON public.media_assets USING ((EXISTS ( SELECT 1
   FROM public.sites
  WHERE ((sites.id = media_assets.store_id) AND ((sites.user_id = auth.uid()) OR (sites.custom_user_id = auth.uid())) AND (sites.deleted_at IS NULL))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.sites
  WHERE ((sites.id = media_assets.store_id) AND ((sites.user_id = auth.uid()) OR (sites.custom_user_id = auth.uid())) AND (sites.deleted_at IS NULL)))));


--
-- Name: media_assets media_assets_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY media_assets_public_read ON public.media_assets FOR SELECT USING (((deleted_at IS NULL) AND (EXISTS ( SELECT 1
   FROM public.sites
  WHERE ((sites.id = media_assets.store_id) AND (sites.status = 'published'::text) AND (sites.deleted_at IS NULL))))));


--
-- Name: navigation_menu_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.navigation_menu_items ENABLE ROW LEVEL SECURITY;

--
-- Name: navigation_menu_items navigation_menu_items_owner_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY navigation_menu_items_owner_manage ON public.navigation_menu_items USING ((EXISTS ( SELECT 1
   FROM public.sites
  WHERE ((sites.id = navigation_menu_items.store_id) AND ((sites.user_id = auth.uid()) OR (sites.custom_user_id = auth.uid())) AND (sites.deleted_at IS NULL))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.sites
  WHERE ((sites.id = navigation_menu_items.store_id) AND ((sites.user_id = auth.uid()) OR (sites.custom_user_id = auth.uid())) AND (sites.deleted_at IS NULL)))));


--
-- Name: navigation_menu_items navigation_menu_items_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY navigation_menu_items_public_read ON public.navigation_menu_items FOR SELECT USING (((is_visible = true) AND (deleted_at IS NULL) AND (EXISTS ( SELECT 1
   FROM public.sites
  WHERE ((sites.id = navigation_menu_items.store_id) AND (sites.status = 'published'::text) AND (sites.deleted_at IS NULL))))));


--
-- Name: navigation_menus; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.navigation_menus ENABLE ROW LEVEL SECURITY;

--
-- Name: navigation_menus navigation_menus_owner_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY navigation_menus_owner_manage ON public.navigation_menus USING ((EXISTS ( SELECT 1
   FROM public.sites
  WHERE ((sites.id = navigation_menus.store_id) AND ((sites.user_id = auth.uid()) OR (sites.custom_user_id = auth.uid())) AND (sites.deleted_at IS NULL))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.sites
  WHERE ((sites.id = navigation_menus.store_id) AND ((sites.user_id = auth.uid()) OR (sites.custom_user_id = auth.uid())) AND (sites.deleted_at IS NULL)))));


--
-- Name: navigation_menus navigation_menus_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY navigation_menus_public_read ON public.navigation_menus FOR SELECT USING (((status = 'active'::text) AND (deleted_at IS NULL) AND (EXISTS ( SELECT 1
   FROM public.sites
  WHERE ((sites.id = navigation_menus.store_id) AND (sites.status = 'published'::text) AND (sites.deleted_at IS NULL))))));


--
-- Name: notification_preferences; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: onboarding_attempts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.onboarding_attempts ENABLE ROW LEVEL SECURITY;

--
-- Name: operation_metrics; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.operation_metrics ENABLE ROW LEVEL SECURITY;

--
-- Name: operation_metrics operation_metrics_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY operation_metrics_service_all ON public.operation_metrics USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: operational_certification_reports; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.operational_certification_reports ENABLE ROW LEVEL SECURITY;

--
-- Name: operational_certification_reports operational_certification_reports_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY operational_certification_reports_service_all ON public.operational_certification_reports USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: operational_dashboard_snapshots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.operational_dashboard_snapshots ENABLE ROW LEVEL SECURITY;

--
-- Name: operational_dashboard_snapshots operational_dashboard_snapshots_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY operational_dashboard_snapshots_service_all ON public.operational_dashboard_snapshots USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: operational_feature_flag_audit_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.operational_feature_flag_audit_events ENABLE ROW LEVEL SECURITY;

--
-- Name: operational_feature_flag_audit_events operational_feature_flag_audit_events_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY operational_feature_flag_audit_events_service_all ON public.operational_feature_flag_audit_events USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: operational_feature_flag_exposures; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.operational_feature_flag_exposures ENABLE ROW LEVEL SECURITY;

--
-- Name: operational_feature_flag_exposures operational_feature_flag_exposures_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY operational_feature_flag_exposures_service_all ON public.operational_feature_flag_exposures USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: operational_feature_flags; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.operational_feature_flags ENABLE ROW LEVEL SECURITY;

--
-- Name: operational_feature_flags operational_feature_flags_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY operational_feature_flags_service_all ON public.operational_feature_flags USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: order_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

--
-- Name: order_line_adjustments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.order_line_adjustments ENABLE ROW LEVEL SECURITY;

--
-- Name: order_line_adjustments order_line_adjustments_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY order_line_adjustments_service_all ON public.order_line_adjustments USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: order_shipping_lines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.order_shipping_lines ENABLE ROW LEVEL SECURITY;

--
-- Name: order_shipping_lines order_shipping_lines_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY order_shipping_lines_service_all ON public.order_shipping_lines USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: order_tax_lines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.order_tax_lines ENABLE ROW LEVEL SECURITY;

--
-- Name: order_tax_lines order_tax_lines_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY order_tax_lines_service_all ON public.order_tax_lines USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

--
-- Name: outbox_dead_letters; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.outbox_dead_letters ENABLE ROW LEVEL SECURITY;

--
-- Name: outbox_dead_letters outbox_dead_letters_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY outbox_dead_letters_service_all ON public.outbox_dead_letters USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: outbox_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.outbox_events ENABLE ROW LEVEL SECURITY;

--
-- Name: outbox_events outbox_events_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY outbox_events_service_all ON public.outbox_events USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: pages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pages ENABLE ROW LEVEL SECURITY;

--
-- Name: partner_payout_ledger_entries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.partner_payout_ledger_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: partner_payout_ledger_entries partner_payout_ledger_entries_partner_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY partner_payout_ledger_entries_partner_read ON public.partner_payout_ledger_entries FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.app_developers
  WHERE ((app_developers.id = partner_payout_ledger_entries.partner_id) AND (app_developers.user_id = auth.uid())))));


--
-- Name: partner_payout_ledger_entries partner_payout_ledger_entries_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY partner_payout_ledger_entries_service_all ON public.partner_payout_ledger_entries USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: payment_attempts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payment_attempts ENABLE ROW LEVEL SECURITY;

--
-- Name: payment_attempts payment_attempts_owner_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY payment_attempts_owner_read ON public.payment_attempts FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.sites
  WHERE ((sites.id = payment_attempts.site_id) AND (sites.user_id = auth.uid()) AND (sites.deleted_at IS NULL)))));


--
-- Name: payment_attempts payment_attempts_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY payment_attempts_service_all ON public.payment_attempts USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: payment_transactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: payment_transactions payment_transactions_owner_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY payment_transactions_owner_read ON public.payment_transactions FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.sites
  WHERE ((sites.id = payment_transactions.site_id) AND (sites.user_id = auth.uid()) AND (sites.deleted_at IS NULL)))));


--
-- Name: payment_transactions payment_transactions_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY payment_transactions_service_all ON public.payment_transactions USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: payment_webhook_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payment_webhook_events ENABLE ROW LEVEL SECURITY;

--
-- Name: payment_webhook_events payment_webhook_events_service_role_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY payment_webhook_events_service_role_all ON public.payment_webhook_events USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: plan_entitlements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.plan_entitlements ENABLE ROW LEVEL SECURITY;

--
-- Name: plan_entitlements plan_entitlements_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY plan_entitlements_public_read ON public.plan_entitlements FOR SELECT USING (((is_active = true) AND (deleted_at IS NULL)));


--
-- Name: plan_entitlements plan_entitlements_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY plan_entitlements_service_all ON public.plan_entitlements USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: plans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

--
-- Name: platform_queue_jobs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.platform_queue_jobs ENABLE ROW LEVEL SECURITY;

--
-- Name: platform_queue_jobs platform_queue_jobs_owner_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY platform_queue_jobs_owner_read ON public.platform_queue_jobs FOR SELECT USING (((site_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.sites
  WHERE ((sites.id = platform_queue_jobs.site_id) AND ((sites.user_id = auth.uid()) OR (sites.custom_user_id = auth.uid())) AND (sites.deleted_at IS NULL))))));


--
-- Name: platform_queue_jobs platform_queue_jobs_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY platform_queue_jobs_service_all ON public.platform_queue_jobs USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: portfolio_projects; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.portfolio_projects ENABLE ROW LEVEL SECURITY;

--
-- Name: product_options; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_options ENABLE ROW LEVEL SECURITY;

--
-- Name: product_reviews; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;

--
-- Name: product_variants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

--
-- Name: production_db_rollout_plans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.production_db_rollout_plans ENABLE ROW LEVEL SECURITY;

--
-- Name: production_db_rollout_plans production_db_rollout_plans_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY production_db_rollout_plans_service_all ON public.production_db_rollout_plans USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: production_incident_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.production_incident_events ENABLE ROW LEVEL SECURITY;

--
-- Name: production_incident_events production_incident_events_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY production_incident_events_service_all ON public.production_incident_events USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: production_incidents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.production_incidents ENABLE ROW LEVEL SECURITY;

--
-- Name: production_incidents production_incidents_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY production_incidents_service_all ON public.production_incidents USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: production_readiness_gate_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.production_readiness_gate_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: production_readiness_gate_runs production_readiness_gate_runs_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY production_readiness_gate_runs_service_all ON public.production_readiness_gate_runs USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: products; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

--
-- Name: projection_checkpoints; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.projection_checkpoints ENABLE ROW LEVEL SECURITY;

--
-- Name: projection_checkpoints projection_checkpoints_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY projection_checkpoints_service_all ON public.projection_checkpoints USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: projection_operation_snapshots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.projection_operation_snapshots ENABLE ROW LEVEL SECURITY;

--
-- Name: projection_operation_snapshots projection_operation_snapshots_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY projection_operation_snapshots_service_all ON public.projection_operation_snapshots USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: projection_rebuilds; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.projection_rebuilds ENABLE ROW LEVEL SECURITY;

--
-- Name: projection_rebuilds projection_rebuilds_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY projection_rebuilds_service_all ON public.projection_rebuilds USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: projection_store; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.projection_store ENABLE ROW LEVEL SECURITY;

--
-- Name: projection_store projection_store_owner_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY projection_store_owner_read ON public.projection_store FOR SELECT USING (((site_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.sites
  WHERE ((sites.id = projection_store.site_id) AND ((sites.user_id = auth.uid()) OR (sites.custom_user_id = auth.uid())) AND (sites.deleted_at IS NULL))))));


--
-- Name: projection_store projection_store_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY projection_store_service_all ON public.projection_store USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: promotion_codes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.promotion_codes ENABLE ROW LEVEL SECURITY;

--
-- Name: promotion_codes promotion_codes_owner_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY promotion_codes_owner_read ON public.promotion_codes FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.sites
  WHERE ((sites.id = promotion_codes.site_id) AND (sites.user_id = auth.uid()) AND (sites.deleted_at IS NULL)))));


--
-- Name: promotion_codes promotion_codes_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY promotion_codes_service_all ON public.promotion_codes USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: promotion_effects; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.promotion_effects ENABLE ROW LEVEL SECURITY;

--
-- Name: promotion_effects promotion_effects_owner_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY promotion_effects_owner_read ON public.promotion_effects FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.sites
  WHERE ((sites.id = promotion_effects.site_id) AND (sites.user_id = auth.uid()) AND (sites.deleted_at IS NULL)))));


--
-- Name: promotion_effects promotion_effects_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY promotion_effects_service_all ON public.promotion_effects USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: promotion_redemptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.promotion_redemptions ENABLE ROW LEVEL SECURITY;

--
-- Name: promotion_redemptions promotion_redemptions_owner_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY promotion_redemptions_owner_read ON public.promotion_redemptions FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.sites
  WHERE ((sites.id = promotion_redemptions.site_id) AND (sites.user_id = auth.uid()) AND (sites.deleted_at IS NULL)))));


--
-- Name: promotion_redemptions promotion_redemptions_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY promotion_redemptions_service_all ON public.promotion_redemptions USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: promotion_rules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.promotion_rules ENABLE ROW LEVEL SECURITY;

--
-- Name: promotion_rules promotion_rules_owner_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY promotion_rules_owner_read ON public.promotion_rules FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.sites
  WHERE ((sites.id = promotion_rules.site_id) AND (sites.user_id = auth.uid()) AND (sites.deleted_at IS NULL)))));


--
-- Name: promotion_rules promotion_rules_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY promotion_rules_service_all ON public.promotion_rules USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: promotion_usage_counters; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.promotion_usage_counters ENABLE ROW LEVEL SECURITY;

--
-- Name: promotion_usage_counters promotion_usage_counters_owner_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY promotion_usage_counters_owner_read ON public.promotion_usage_counters FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.sites
  WHERE ((sites.id = promotion_usage_counters.site_id) AND (sites.user_id = auth.uid()) AND (sites.deleted_at IS NULL)))));


--
-- Name: promotion_usage_counters promotion_usage_counters_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY promotion_usage_counters_service_all ON public.promotion_usage_counters USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: promotions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

--
-- Name: promotions promotions_owner_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY promotions_owner_read ON public.promotions FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.sites
  WHERE ((sites.id = promotions.site_id) AND (sites.user_id = auth.uid()) AND (sites.deleted_at IS NULL)))));


--
-- Name: promotions promotions_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY promotions_service_all ON public.promotions USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: provider_health_snapshots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.provider_health_snapshots ENABLE ROW LEVEL SECURITY;

--
-- Name: provider_health_snapshots provider_health_snapshots_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY provider_health_snapshots_service_all ON public.provider_health_snapshots USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: provider_outage_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.provider_outage_events ENABLE ROW LEVEL SECURITY;

--
-- Name: provider_outage_events provider_outage_events_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY provider_outage_events_service_all ON public.provider_outage_events USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: provider_recovery_plans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.provider_recovery_plans ENABLE ROW LEVEL SECURITY;

--
-- Name: provider_recovery_plans provider_recovery_plans_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY provider_recovery_plans_service_all ON public.provider_recovery_plans USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: product_reviews public_read_approved_reviews; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY public_read_approved_reviews ON public.product_reviews FOR SELECT TO authenticated, anon USING ((is_approved = true));


--
-- Name: sites public_read_published_stores; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY public_read_published_stores ON public.sites FOR SELECT USING ((status = 'published'::text));


--
-- Name: contact_submissions public_submit_contact; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY public_submit_contact ON public.contact_submissions FOR INSERT WITH CHECK (true);


--
-- Name: leads public_submit_leads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY public_submit_leads ON public.leads FOR INSERT WITH CHECK (true);


--
-- Name: analytics_events public_track_analytics; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY public_track_analytics ON public.analytics_events FOR INSERT WITH CHECK (true);


--
-- Name: lead_forms public_view_active_forms; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY public_view_active_forms ON public.lead_forms FOR SELECT USING (((is_active = true) AND (store_id IN ( SELECT sites.id
   FROM public.sites
  WHERE (sites.status = 'published'::text)))));


--
-- Name: products public_view_active_products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY public_view_active_products ON public.products FOR SELECT USING (((is_active = true) AND (store_id IN ( SELECT sites.id
   FROM public.sites
  WHERE (sites.status = 'published'::text)))));


--
-- Name: certifications public_view_certifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY public_view_certifications ON public.certifications FOR SELECT USING ((store_id IN ( SELECT sites.id
   FROM public.sites
  WHERE (sites.status = 'published'::text))));


--
-- Name: education public_view_education; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY public_view_education ON public.education FOR SELECT USING ((store_id IN ( SELECT sites.id
   FROM public.sites
  WHERE (sites.status = 'published'::text))));


--
-- Name: skill_endorsements public_view_endorsements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY public_view_endorsements ON public.skill_endorsements FOR SELECT TO authenticated, anon USING (true);


--
-- Name: gallery_items public_view_gallery; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY public_view_gallery ON public.gallery_items FOR SELECT TO anon USING ((is_visible = true));


--
-- Name: portfolio_projects public_view_portfolio_projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY public_view_portfolio_projects ON public.portfolio_projects FOR SELECT USING ((store_id IN ( SELECT sites.id
   FROM public.sites
  WHERE (sites.status = 'published'::text))));


--
-- Name: pages public_view_published_pages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY public_view_published_pages ON public.pages FOR SELECT USING (((status = 'published'::text) AND (store_id IN ( SELECT sites.id
   FROM public.sites
  WHERE (sites.status = 'published'::text)))));


--
-- Name: resume_versions public_view_resume_versions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY public_view_resume_versions ON public.resume_versions FOR SELECT USING ((store_id IN ( SELECT sites.id
   FROM public.sites
  WHERE (sites.status = 'published'::text))));


--
-- Name: shipping_zones public_view_shipping_zones; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY public_view_shipping_zones ON public.shipping_zones FOR SELECT USING ((store_id IN ( SELECT sites.id
   FROM public.sites
  WHERE (sites.status = 'published'::text))));


--
-- Name: skills public_view_skills; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY public_view_skills ON public.skills FOR SELECT USING ((store_id IN ( SELECT sites.id
   FROM public.sites
  WHERE (sites.status = 'published'::text))));


--
-- Name: smart_collections public_view_smart_collections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY public_view_smart_collections ON public.smart_collections FOR SELECT TO anon USING (true);


--
-- Name: testimonials public_view_testimonials; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY public_view_testimonials ON public.testimonials FOR SELECT USING ((store_id IN ( SELECT sites.id
   FROM public.sites
  WHERE (sites.status = 'published'::text))));


--
-- Name: work_experience public_view_work_experience; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY public_view_work_experience ON public.work_experience FOR SELECT USING ((store_id IN ( SELECT sites.id
   FROM public.sites
  WHERE (sites.status = 'published'::text))));


--
-- Name: purchase_order_lines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.purchase_order_lines ENABLE ROW LEVEL SECURITY;

--
-- Name: purchase_order_lines purchase_order_lines_owner_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY purchase_order_lines_owner_read ON public.purchase_order_lines FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.sites
  WHERE ((sites.id = purchase_order_lines.site_id) AND (sites.user_id = auth.uid()) AND (sites.deleted_at IS NULL)))));


--
-- Name: purchase_order_lines purchase_order_lines_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY purchase_order_lines_service_all ON public.purchase_order_lines USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: purchase_order_receipts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.purchase_order_receipts ENABLE ROW LEVEL SECURITY;

--
-- Name: purchase_order_receipts purchase_order_receipts_owner_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY purchase_order_receipts_owner_read ON public.purchase_order_receipts FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.sites
  WHERE ((sites.id = purchase_order_receipts.site_id) AND (sites.user_id = auth.uid()) AND (sites.deleted_at IS NULL)))));


--
-- Name: purchase_order_receipts purchase_order_receipts_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY purchase_order_receipts_service_all ON public.purchase_order_receipts USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: purchase_orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

--
-- Name: purchase_orders purchase_orders_owner_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY purchase_orders_owner_read ON public.purchase_orders FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.sites
  WHERE ((sites.id = purchase_orders.site_id) AND (sites.user_id = auth.uid()) AND (sites.deleted_at IS NULL)))));


--
-- Name: purchase_orders purchase_orders_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY purchase_orders_service_all ON public.purchase_orders USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: query_snapshots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.query_snapshots ENABLE ROW LEVEL SECURITY;

--
-- Name: query_snapshots query_snapshots_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY query_snapshots_service_all ON public.query_snapshots USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: queue_operation_snapshots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.queue_operation_snapshots ENABLE ROW LEVEL SECURITY;

--
-- Name: queue_operation_snapshots queue_operation_snapshots_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY queue_operation_snapshots_service_all ON public.queue_operation_snapshots USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: queue_recovery_operations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.queue_recovery_operations ENABLE ROW LEVEL SECURITY;

--
-- Name: queue_recovery_operations queue_recovery_operations_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY queue_recovery_operations_service_all ON public.queue_recovery_operations USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: refund_attempts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.refund_attempts ENABLE ROW LEVEL SECURITY;

--
-- Name: refund_attempts refund_attempts_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY refund_attempts_service_all ON public.refund_attempts USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: refund_lines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.refund_lines ENABLE ROW LEVEL SECURITY;

--
-- Name: refund_lines refund_lines_owner_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY refund_lines_owner_read ON public.refund_lines FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.sites
  WHERE ((sites.id = refund_lines.site_id) AND (sites.user_id = auth.uid()) AND (sites.deleted_at IS NULL)))));


--
-- Name: refund_lines refund_lines_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY refund_lines_service_all ON public.refund_lines USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: refund_transactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.refund_transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: refund_transactions refund_transactions_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY refund_transactions_service_all ON public.refund_transactions USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: refunds; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;

--
-- Name: refunds refunds_owner_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY refunds_owner_read ON public.refunds FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.sites
  WHERE ((sites.id = refunds.site_id) AND (sites.user_id = auth.uid()) AND (sites.deleted_at IS NULL)))));


--
-- Name: refunds refunds_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY refunds_service_all ON public.refunds USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: regional_execution_diagnostics; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.regional_execution_diagnostics ENABLE ROW LEVEL SECURITY;

--
-- Name: regional_execution_diagnostics regional_execution_diagnostics_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY regional_execution_diagnostics_service_all ON public.regional_execution_diagnostics USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: regional_routing_overrides; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.regional_routing_overrides ENABLE ROW LEVEL SECURITY;

--
-- Name: regional_routing_overrides regional_routing_overrides_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY regional_routing_overrides_service_all ON public.regional_routing_overrides USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: replay_dry_run_results; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.replay_dry_run_results ENABLE ROW LEVEL SECURITY;

--
-- Name: replay_dry_run_results replay_dry_run_results_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY replay_dry_run_results_service_all ON public.replay_dry_run_results USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: replay_operation_schedules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.replay_operation_schedules ENABLE ROW LEVEL SECURITY;

--
-- Name: replay_operation_schedules replay_operation_schedules_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY replay_operation_schedules_service_all ON public.replay_operation_schedules USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: restock_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.restock_events ENABLE ROW LEVEL SECURITY;

--
-- Name: restock_events restock_events_owner_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY restock_events_owner_read ON public.restock_events FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.sites
  WHERE ((sites.id = restock_events.site_id) AND (sites.user_id = auth.uid()) AND (sites.deleted_at IS NULL)))));


--
-- Name: restock_events restock_events_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY restock_events_service_all ON public.restock_events USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: resume_versions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.resume_versions ENABLE ROW LEVEL SECURITY;

--
-- Name: return_lines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.return_lines ENABLE ROW LEVEL SECURITY;

--
-- Name: return_lines return_lines_owner_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY return_lines_owner_read ON public.return_lines FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.sites
  WHERE ((sites.id = return_lines.site_id) AND (sites.user_id = auth.uid()) AND (sites.deleted_at IS NULL)))));


--
-- Name: return_lines return_lines_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY return_lines_service_all ON public.return_lines USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: return_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.return_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: returns; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;

--
-- Name: returns returns_owner_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY returns_owner_read ON public.returns FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.sites
  WHERE ((sites.id = returns.site_id) AND (sites.user_id = auth.uid()) AND (sites.deleted_at IS NULL)))));


--
-- Name: returns returns_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY returns_service_all ON public.returns USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: rollout_stage_evidence; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rollout_stage_evidence ENABLE ROW LEVEL SECURITY;

--
-- Name: rollout_stage_evidence rollout_stage_evidence_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rollout_stage_evidence_service_all ON public.rollout_stage_evidence USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: runtime_alert_evaluations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.runtime_alert_evaluations ENABLE ROW LEVEL SECURITY;

--
-- Name: runtime_alert_evaluations runtime_alert_evaluations_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY runtime_alert_evaluations_service_all ON public.runtime_alert_evaluations USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: runtime_checkpoints; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.runtime_checkpoints ENABLE ROW LEVEL SECURITY;

--
-- Name: runtime_checkpoints runtime_checkpoints_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY runtime_checkpoints_service_all ON public.runtime_checkpoints USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: runtime_command_journal; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.runtime_command_journal ENABLE ROW LEVEL SECURITY;

--
-- Name: runtime_command_journal runtime_command_journal_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY runtime_command_journal_service_all ON public.runtime_command_journal USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: runtime_control_commands; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.runtime_control_commands ENABLE ROW LEVEL SECURITY;

--
-- Name: runtime_control_commands runtime_control_commands_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY runtime_control_commands_service_all ON public.runtime_control_commands USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: runtime_deployment_topology_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.runtime_deployment_topology_records ENABLE ROW LEVEL SECURITY;

--
-- Name: runtime_deployment_topology_records runtime_deployment_topology_records_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY runtime_deployment_topology_records_service_all ON public.runtime_deployment_topology_records USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: runtime_diagnostics; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.runtime_diagnostics ENABLE ROW LEVEL SECURITY;

--
-- Name: runtime_diagnostics runtime_diagnostics_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY runtime_diagnostics_service_all ON public.runtime_diagnostics USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: runtime_event_retention_policies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.runtime_event_retention_policies ENABLE ROW LEVEL SECURITY;

--
-- Name: runtime_event_retention_policies runtime_event_retention_policies_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY runtime_event_retention_policies_service_all ON public.runtime_event_retention_policies USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: runtime_health_projections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.runtime_health_projections ENABLE ROW LEVEL SECURITY;

--
-- Name: runtime_health_projections runtime_health_projections_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY runtime_health_projections_service_all ON public.runtime_health_projections USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: runtime_leases; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.runtime_leases ENABLE ROW LEVEL SECURITY;

--
-- Name: runtime_leases runtime_leases_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY runtime_leases_service_all ON public.runtime_leases USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: runtime_replay_executions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.runtime_replay_executions ENABLE ROW LEVEL SECURITY;

--
-- Name: runtime_replay_executions runtime_replay_executions_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY runtime_replay_executions_service_all ON public.runtime_replay_executions USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: runtime_secret_rotation_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.runtime_secret_rotation_events ENABLE ROW LEVEL SECURITY;

--
-- Name: runtime_secret_rotation_events runtime_secret_rotation_events_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY runtime_secret_rotation_events_service_all ON public.runtime_secret_rotation_events USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: runtime_slo_definitions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.runtime_slo_definitions ENABLE ROW LEVEL SECURITY;

--
-- Name: runtime_slo_definitions runtime_slo_definitions_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY runtime_slo_definitions_service_all ON public.runtime_slo_definitions USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: runtime_structured_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.runtime_structured_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: runtime_structured_logs runtime_structured_logs_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY runtime_structured_logs_service_all ON public.runtime_structured_logs USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: runtime_telemetry_metrics; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.runtime_telemetry_metrics ENABLE ROW LEVEL SECURITY;

--
-- Name: runtime_telemetry_metrics runtime_telemetry_metrics_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY runtime_telemetry_metrics_service_all ON public.runtime_telemetry_metrics USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: runtime_telemetry_spans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.runtime_telemetry_spans ENABLE ROW LEVEL SECURITY;

--
-- Name: runtime_telemetry_spans runtime_telemetry_spans_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY runtime_telemetry_spans_service_all ON public.runtime_telemetry_spans USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: sandbox_provider_contracts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sandbox_provider_contracts ENABLE ROW LEVEL SECURITY;

--
-- Name: sandbox_provider_contracts sandbox_provider_contracts_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sandbox_provider_contracts_service_all ON public.sandbox_provider_contracts USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: search_documents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.search_documents ENABLE ROW LEVEL SECURITY;

--
-- Name: search_documents search_documents_owner_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY search_documents_owner_read ON public.search_documents FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.sites
  WHERE ((sites.id = search_documents.site_id) AND ((sites.user_id = auth.uid()) OR (sites.custom_user_id = auth.uid())) AND (sites.deleted_at IS NULL)))));


--
-- Name: search_documents search_documents_public_active_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY search_documents_public_active_read ON public.search_documents FOR SELECT USING (((status = 'active'::text) AND (deleted_at IS NULL) AND (EXISTS ( SELECT 1
   FROM public.sites
  WHERE ((sites.id = search_documents.site_id) AND (sites.status = 'published'::text) AND (sites.deleted_at IS NULL))))));


--
-- Name: search_documents search_documents_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY search_documents_service_all ON public.search_documents USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: security_enforcement_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.security_enforcement_events ENABLE ROW LEVEL SECURITY;

--
-- Name: security_enforcement_events security_enforcement_events_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY security_enforcement_events_service_all ON public.security_enforcement_events USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: carts service_all_carts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_all_carts ON public.carts TO service_role USING (true) WITH CHECK (true);


--
-- Name: customer_activity_log service_all_customer_activity_log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_all_customer_activity_log ON public.customer_activity_log USING (true) WITH CHECK (true);


--
-- Name: customer_wishlists service_all_customer_wishlists; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_all_customer_wishlists ON public.customer_wishlists USING (true) WITH CHECK (true);


--
-- Name: gallery_items service_all_gallery; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_all_gallery ON public.gallery_items TO service_role USING (true) WITH CHECK (true);


--
-- Name: inventory_adjustments service_all_inventory_adjustments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_all_inventory_adjustments ON public.inventory_adjustments TO service_role USING (true) WITH CHECK (true);


--
-- Name: inventory_levels service_all_inventory_levels; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_all_inventory_levels ON public.inventory_levels TO service_role USING (true) WITH CHECK (true);


--
-- Name: inventory_locations service_all_inventory_locations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_all_inventory_locations ON public.inventory_locations TO service_role USING (true) WITH CHECK (true);


--
-- Name: order_items service_all_order_items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_all_order_items ON public.order_items TO service_role USING (true) WITH CHECK (true);


--
-- Name: product_reviews service_all_reviews; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_all_reviews ON public.product_reviews TO service_role USING (true) WITH CHECK (true);


--
-- Name: store_customers service_all_store_customers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_all_store_customers ON public.store_customers USING (true) WITH CHECK (true);


--
-- Name: tax_rates service_all_tax_rates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_all_tax_rates ON public.tax_rates TO service_role USING (true) WITH CHECK (true);


--
-- Name: app_categories service_role_app_categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_app_categories ON public.app_categories USING (true) WITH CHECK (true);


--
-- Name: app_developers service_role_app_developers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_app_developers ON public.app_developers USING (true) WITH CHECK (true);


--
-- Name: app_extensions service_role_app_extensions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_app_extensions ON public.app_extensions USING (true) WITH CHECK (true);


--
-- Name: app_installations service_role_app_installations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_app_installations ON public.app_installations USING (true) WITH CHECK (true);


--
-- Name: app_reviews service_role_app_reviews; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_app_reviews ON public.app_reviews USING (true) WITH CHECK (true);


--
-- Name: app_webhooks service_role_app_webhooks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_app_webhooks ON public.app_webhooks USING (true) WITH CHECK (true);


--
-- Name: billing_history service_role_billing_history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_billing_history ON public.billing_history USING (true) WITH CHECK (true);


--
-- Name: collection_products service_role_collection_products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_collection_products ON public.collection_products USING (true) WITH CHECK (true);


--
-- Name: collections service_role_collections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_collections ON public.collections USING (true) WITH CHECK (true);


--
-- Name: email_logs service_role_email_logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_email_logs ON public.email_logs USING (true) WITH CHECK (true);


--
-- Name: gift_cards service_role_gift_cards; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_gift_cards ON public.gift_cards USING (true) WITH CHECK (true);


--
-- Name: idempotency_keys service_role_idempotency_keys; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_idempotency_keys ON public.idempotency_keys USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: super_admin_allowlist service_role_manage_allowlist; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_manage_allowlist ON public.super_admin_allowlist USING (true) WITH CHECK (true);


--
-- Name: marketplace_apps service_role_marketplace_apps; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_marketplace_apps ON public.marketplace_apps USING (true) WITH CHECK (true);


--
-- Name: onboarding_attempts service_role_onboarding; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_onboarding ON public.onboarding_attempts USING (true) WITH CHECK (true);


--
-- Name: orders service_role_orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_orders ON public.orders USING (true) WITH CHECK (true);


--
-- Name: pages service_role_pages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_pages ON public.pages USING (true) WITH CHECK (true);


--
-- Name: product_options service_role_product_options; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_product_options ON public.product_options USING (true) WITH CHECK (true);


--
-- Name: product_variants service_role_product_variants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_product_variants ON public.product_variants USING (true) WITH CHECK (true);


--
-- Name: products service_role_products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_products ON public.products USING (true) WITH CHECK (true);


--
-- Name: sites service_role_sites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_sites ON public.sites USING (true) WITH CHECK (true);


--
-- Name: store_surveys service_role_store_surveys; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_store_surveys ON public.store_surveys USING (true) WITH CHECK (true);


--
-- Name: subscriptions service_role_subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_subscriptions ON public.subscriptions USING (true) WITH CHECK (true);


--
-- Name: sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: shadow_traffic_comparison_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.shadow_traffic_comparison_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: shadow_traffic_comparison_runs shadow_traffic_comparison_runs_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shadow_traffic_comparison_runs_service_all ON public.shadow_traffic_comparison_runs USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: shipment_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.shipment_events ENABLE ROW LEVEL SECURITY;

--
-- Name: shipment_events shipment_events_owner_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shipment_events_owner_read ON public.shipment_events FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.sites
  WHERE ((sites.id = shipment_events.site_id) AND (sites.user_id = auth.uid()) AND (sites.deleted_at IS NULL)))));


--
-- Name: shipment_events shipment_events_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shipment_events_service_all ON public.shipment_events USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: shipments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;

--
-- Name: shipments shipments_owner_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shipments_owner_read ON public.shipments FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.sites
  WHERE ((sites.id = shipments.site_id) AND (sites.user_id = auth.uid()) AND (sites.deleted_at IS NULL)))));


--
-- Name: shipments shipments_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shipments_service_all ON public.shipments USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: shipping_rates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.shipping_rates ENABLE ROW LEVEL SECURITY;

--
-- Name: shipping_zones; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.shipping_zones ENABLE ROW LEVEL SECURITY;

--
-- Name: site_api_clients; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.site_api_clients ENABLE ROW LEVEL SECURITY;

--
-- Name: site_api_clients site_api_clients_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY site_api_clients_service_all ON public.site_api_clients USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: site_entitlement_overrides; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.site_entitlement_overrides ENABLE ROW LEVEL SECURITY;

--
-- Name: site_entitlement_overrides site_entitlement_overrides_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY site_entitlement_overrides_service_all ON public.site_entitlement_overrides USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: site_gate_attempts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.site_gate_attempts ENABLE ROW LEVEL SECURITY;

--
-- Name: site_gate_attempts site_gate_attempts_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY site_gate_attempts_service_all ON public.site_gate_attempts USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));

--
-- Name: site_domain_reviews; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.site_domain_reviews ENABLE ROW LEVEL SECURITY;

--
-- Name: site_domain_reviews site_domain_reviews_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY site_domain_reviews_service_all ON public.site_domain_reviews USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));

--
-- Name: domain_orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.domain_orders ENABLE ROW LEVEL SECURITY;

--
-- Name: domain_orders domain_orders_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY domain_orders_service_all ON public.domain_orders USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: site_memberships; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.site_memberships ENABLE ROW LEVEL SECURITY;

--
-- Name: site_memberships site_memberships_owner_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY site_memberships_owner_read ON public.site_memberships FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.sites
  WHERE ((sites.id = site_memberships.site_id) AND ((sites.user_id = auth.uid()) OR (sites.custom_user_id = auth.uid())) AND (sites.deleted_at IS NULL)))));


--
-- Name: site_memberships site_memberships_self_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY site_memberships_self_read ON public.site_memberships FOR SELECT USING (((custom_user_id = auth.uid()) OR (legacy_user_id = auth.uid())));


--
-- Name: site_memberships site_memberships_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY site_memberships_service_all ON public.site_memberships USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: idempotency_keys site_owner_idempotency_keys_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY site_owner_idempotency_keys_read ON public.idempotency_keys FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.sites
  WHERE ((sites.id = idempotency_keys.site_id) AND ((sites.user_id = auth.uid()) OR (sites.custom_user_id = auth.uid()))))));


--
-- Name: site_role_permissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.site_role_permissions ENABLE ROW LEVEL SECURITY;

--
-- Name: site_role_permissions site_role_permissions_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY site_role_permissions_service_all ON public.site_role_permissions USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: site_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.site_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: site_roles site_roles_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY site_roles_service_all ON public.site_roles USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: site_preview_links; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.site_preview_links ENABLE ROW LEVEL SECURITY;

--
-- Name: site_preview_links site_preview_links_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY site_preview_links_service_all ON public.site_preview_links USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: site_usage_meters; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.site_usage_meters ENABLE ROW LEVEL SECURITY;

--
-- Name: site_usage_meters site_usage_meters_owner_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY site_usage_meters_owner_read ON public.site_usage_meters FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.sites
  WHERE ((sites.id = site_usage_meters.site_id) AND ((sites.user_id = auth.uid()) OR (sites.custom_user_id = auth.uid())) AND (sites.deleted_at IS NULL)))));


--
-- Name: site_usage_meters site_usage_meters_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY site_usage_meters_service_all ON public.site_usage_meters USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: sites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;

--
-- Name: skill_endorsements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.skill_endorsements ENABLE ROW LEVEL SECURITY;

--
-- Name: skill_endorsements skill_owner_manage_endorsements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY skill_owner_manage_endorsements ON public.skill_endorsements FOR DELETE TO authenticated USING ((skill_id IN ( SELECT s.id
   FROM (public.skills s
     JOIN public.sites st ON ((s.store_id = st.id)))
  WHERE (st.user_id = auth.uid()))));


--
-- Name: skills; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;

--
-- Name: smart_collections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.smart_collections ENABLE ROW LEVEL SECURITY;

--
-- Name: sre_error_budget_snapshots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sre_error_budget_snapshots ENABLE ROW LEVEL SECURITY;

--
-- Name: sre_error_budget_snapshots sre_error_budget_snapshots_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sre_error_budget_snapshots_service_all ON public.sre_error_budget_snapshots USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: store_customers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.store_customers ENABLE ROW LEVEL SECURITY;

--
-- Name: analytics_events store_owner_analytics; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY store_owner_analytics ON public.analytics_events FOR SELECT USING ((store_id IN ( SELECT sites.id
   FROM public.sites
  WHERE (sites.user_id = auth.uid()))));


--
-- Name: certifications store_owner_certifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY store_owner_certifications ON public.certifications USING ((store_id IN ( SELECT sites.id
   FROM public.sites
  WHERE (sites.user_id = auth.uid()))));


--
-- Name: contact_submissions store_owner_contact_submissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY store_owner_contact_submissions ON public.contact_submissions USING ((store_id IN ( SELECT sites.id
   FROM public.sites
  WHERE (sites.user_id = auth.uid()))));


--
-- Name: coupons store_owner_coupons; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY store_owner_coupons ON public.coupons USING ((store_id IN ( SELECT sites.id
   FROM public.sites
  WHERE (sites.user_id = auth.uid()))));


--
-- Name: education store_owner_education; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY store_owner_education ON public.education USING ((store_id IN ( SELECT sites.id
   FROM public.sites
  WHERE (sites.user_id = auth.uid()))));


--
-- Name: lead_forms store_owner_lead_forms; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY store_owner_lead_forms ON public.lead_forms USING ((store_id IN ( SELECT sites.id
   FROM public.sites
  WHERE (sites.user_id = auth.uid()))));


--
-- Name: leads store_owner_leads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY store_owner_leads ON public.leads USING ((store_id IN ( SELECT sites.id
   FROM public.sites
  WHERE (sites.user_id = auth.uid()))));


--
-- Name: order_items store_owner_order_items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY store_owner_order_items ON public.order_items USING ((order_id IN ( SELECT orders.id
   FROM public.orders
  WHERE (orders.store_id IN ( SELECT sites.id
           FROM public.sites
          WHERE (sites.user_id = auth.uid()))))));


--
-- Name: orders store_owner_orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY store_owner_orders ON public.orders USING ((store_id IN ( SELECT sites.id
   FROM public.sites
  WHERE (sites.user_id = auth.uid()))));


--
-- Name: pages store_owner_pages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY store_owner_pages ON public.pages USING ((store_id IN ( SELECT sites.id
   FROM public.sites
  WHERE (sites.user_id = auth.uid()))));


--
-- Name: portfolio_projects store_owner_portfolio_projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY store_owner_portfolio_projects ON public.portfolio_projects USING ((store_id IN ( SELECT sites.id
   FROM public.sites
  WHERE (sites.user_id = auth.uid()))));


--
-- Name: products store_owner_products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY store_owner_products ON public.products USING ((store_id IN ( SELECT sites.id
   FROM public.sites
  WHERE (sites.user_id = auth.uid()))));


--
-- Name: resume_versions store_owner_resume_versions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY store_owner_resume_versions ON public.resume_versions USING ((store_id IN ( SELECT sites.id
   FROM public.sites
  WHERE (sites.user_id = auth.uid()))));


--
-- Name: shipping_rates store_owner_shipping_rates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY store_owner_shipping_rates ON public.shipping_rates USING ((zone_id IN ( SELECT shipping_zones.id
   FROM public.shipping_zones
  WHERE (shipping_zones.store_id IN ( SELECT sites.id
           FROM public.sites
          WHERE (sites.user_id = auth.uid()))))));


--
-- Name: shipping_zones store_owner_shipping_zones; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY store_owner_shipping_zones ON public.shipping_zones USING ((store_id IN ( SELECT sites.id
   FROM public.sites
  WHERE (sites.user_id = auth.uid()))));


--
-- Name: skills store_owner_skills; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY store_owner_skills ON public.skills USING ((store_id IN ( SELECT sites.id
   FROM public.sites
  WHERE (sites.user_id = auth.uid()))));


--
-- Name: testimonials store_owner_testimonials; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY store_owner_testimonials ON public.testimonials USING ((store_id IN ( SELECT sites.id
   FROM public.sites
  WHERE (sites.user_id = auth.uid()))));


--
-- Name: work_experience store_owner_work_experience; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY store_owner_work_experience ON public.work_experience USING ((store_id IN ( SELECT sites.id
   FROM public.sites
  WHERE (sites.user_id = auth.uid()))));


--
-- Name: gallery_items store_owners_manage_gallery; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY store_owners_manage_gallery ON public.gallery_items TO authenticated USING ((store_id IN ( SELECT sites.id
   FROM public.sites
  WHERE (sites.user_id = auth.uid())))) WITH CHECK ((store_id IN ( SELECT sites.id
   FROM public.sites
  WHERE (sites.user_id = auth.uid()))));


--
-- Name: inventory_levels store_owners_manage_levels; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY store_owners_manage_levels ON public.inventory_levels TO authenticated USING ((product_id IN ( SELECT products.id
   FROM public.products
  WHERE (products.store_id IN ( SELECT sites.id
           FROM public.sites
          WHERE (sites.user_id = auth.uid())))))) WITH CHECK ((product_id IN ( SELECT products.id
   FROM public.products
  WHERE (products.store_id IN ( SELECT sites.id
           FROM public.sites
          WHERE (sites.user_id = auth.uid()))))));


--
-- Name: inventory_locations store_owners_manage_locations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY store_owners_manage_locations ON public.inventory_locations TO authenticated USING ((store_id IN ( SELECT sites.id
   FROM public.sites
  WHERE (sites.user_id = auth.uid())))) WITH CHECK ((store_id IN ( SELECT sites.id
   FROM public.sites
  WHERE (sites.user_id = auth.uid()))));


--
-- Name: order_items store_owners_manage_order_items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY store_owners_manage_order_items ON public.order_items TO authenticated USING ((order_id IN ( SELECT o.id
   FROM (public.orders o
     JOIN public.sites s ON ((o.store_id = s.id)))
  WHERE (s.user_id = auth.uid())))) WITH CHECK ((order_id IN ( SELECT o.id
   FROM (public.orders o
     JOIN public.sites s ON ((o.store_id = s.id)))
  WHERE (s.user_id = auth.uid()))));


--
-- Name: product_reviews store_owners_manage_reviews; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY store_owners_manage_reviews ON public.product_reviews TO authenticated USING ((store_id IN ( SELECT sites.id
   FROM public.sites
  WHERE (sites.user_id = auth.uid())))) WITH CHECK ((store_id IN ( SELECT sites.id
   FROM public.sites
  WHERE (sites.user_id = auth.uid()))));


--
-- Name: smart_collections store_owners_manage_smart_collections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY store_owners_manage_smart_collections ON public.smart_collections TO authenticated USING ((store_id IN ( SELECT sites.id
   FROM public.sites
  WHERE (sites.user_id = auth.uid())))) WITH CHECK ((store_id IN ( SELECT sites.id
   FROM public.sites
  WHERE (sites.user_id = auth.uid()))));


--
-- Name: tax_rates store_owners_manage_tax; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY store_owners_manage_tax ON public.tax_rates TO authenticated USING ((store_id IN ( SELECT sites.id
   FROM public.sites
  WHERE (sites.user_id = auth.uid())))) WITH CHECK ((store_id IN ( SELECT sites.id
   FROM public.sites
  WHERE (sites.user_id = auth.uid()))));


--
-- Name: inventory_adjustments store_owners_view_adjustments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY store_owners_view_adjustments ON public.inventory_adjustments FOR SELECT TO authenticated USING ((product_id IN ( SELECT products.id
   FROM public.products
  WHERE (products.store_id IN ( SELECT sites.id
           FROM public.sites
          WHERE (sites.user_id = auth.uid()))))));


--
-- Name: store_surveys; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.store_surveys ENABLE ROW LEVEL SECURITY;

--
-- Name: store_themes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.store_themes ENABLE ROW LEVEL SECURITY;

--
-- Name: storefront_cache_tags; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.storefront_cache_tags ENABLE ROW LEVEL SECURITY;

--
-- Name: storefront_cache_tags storefront_cache_tags_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY storefront_cache_tags_service_all ON public.storefront_cache_tags USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: storefront_page_revisions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.storefront_page_revisions ENABLE ROW LEVEL SECURITY;

--
-- Name: storefront_page_revisions storefront_page_revisions_owner_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY storefront_page_revisions_owner_read ON public.storefront_page_revisions FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.sites
  WHERE ((sites.id = storefront_page_revisions.store_id) AND ((sites.user_id = auth.uid()) OR (sites.custom_user_id = auth.uid())) AND (sites.deleted_at IS NULL)))));


--
-- Name: storefront_pages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.storefront_pages ENABLE ROW LEVEL SECURITY;

--
-- Name: storefront_pages storefront_pages_owner_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY storefront_pages_owner_manage ON public.storefront_pages USING ((EXISTS ( SELECT 1
   FROM public.sites
  WHERE ((sites.id = storefront_pages.store_id) AND ((sites.user_id = auth.uid()) OR (sites.custom_user_id = auth.uid())) AND (sites.deleted_at IS NULL))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.sites
  WHERE ((sites.id = storefront_pages.store_id) AND ((sites.user_id = auth.uid()) OR (sites.custom_user_id = auth.uid())) AND (sites.deleted_at IS NULL)))));


--
-- Name: storefront_pages storefront_pages_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY storefront_pages_public_read ON public.storefront_pages FOR SELECT USING (((status = 'published'::text) AND (deleted_at IS NULL) AND (EXISTS ( SELECT 1
   FROM public.sites
  WHERE ((sites.id = storefront_pages.store_id) AND (sites.status = 'published'::text) AND (sites.deleted_at IS NULL))))));


--
-- Name: storefront_policies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.storefront_policies ENABLE ROW LEVEL SECURITY;

--
-- Name: storefront_policies storefront_policies_owner_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY storefront_policies_owner_manage ON public.storefront_policies USING ((EXISTS ( SELECT 1
   FROM public.sites
  WHERE ((sites.id = storefront_policies.store_id) AND ((sites.user_id = auth.uid()) OR (sites.custom_user_id = auth.uid())) AND (sites.deleted_at IS NULL))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.sites
  WHERE ((sites.id = storefront_policies.store_id) AND ((sites.user_id = auth.uid()) OR (sites.custom_user_id = auth.uid())) AND (sites.deleted_at IS NULL)))));


--
-- Name: storefront_policies storefront_policies_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY storefront_policies_public_read ON public.storefront_policies FOR SELECT USING (((status = 'published'::text) AND (deleted_at IS NULL) AND (EXISTS ( SELECT 1
   FROM public.sites
  WHERE ((sites.id = storefront_policies.store_id) AND (sites.status = 'published'::text) AND (sites.deleted_at IS NULL))))));


--
-- Name: storefront_slug_redirects; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.storefront_slug_redirects ENABLE ROW LEVEL SECURITY;

--
-- Name: storefront_slug_redirects storefront_slug_redirects_owner_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY storefront_slug_redirects_owner_manage ON public.storefront_slug_redirects USING ((EXISTS ( SELECT 1
   FROM public.sites
  WHERE ((sites.id = storefront_slug_redirects.store_id) AND ((sites.user_id = auth.uid()) OR (sites.custom_user_id = auth.uid())) AND (sites.deleted_at IS NULL))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.sites
  WHERE ((sites.id = storefront_slug_redirects.store_id) AND ((sites.user_id = auth.uid()) OR (sites.custom_user_id = auth.uid())) AND (sites.deleted_at IS NULL)))));


--
-- Name: subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: super_admin_allowlist; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.super_admin_allowlist ENABLE ROW LEVEL SECURITY;

--
-- Name: employees super_admin_employees; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY super_admin_employees ON public.employees USING (public.is_super_admin());


--
-- Name: employee_invites super_admin_invites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY super_admin_invites ON public.employee_invites USING (public.is_super_admin());


--
-- Name: super_admin_allowlist super_admin_manage_allowlist; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY super_admin_manage_allowlist ON public.super_admin_allowlist USING (public.is_super_admin());


--
-- Name: employees super_admin_manage_employees; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY super_admin_manage_employees ON public.employees USING ((EXISTS ( SELECT 1
   FROM public.super_admin_allowlist
  WHERE ((super_admin_allowlist.user_id = auth.uid()) AND (super_admin_allowlist.is_active = true)))));


--
-- Name: employee_invites super_admin_manage_invites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY super_admin_manage_invites ON public.employee_invites USING ((EXISTS ( SELECT 1
   FROM public.super_admin_allowlist
  WHERE ((super_admin_allowlist.user_id = auth.uid()) AND (super_admin_allowlist.is_active = true)))));


--
-- Name: plans super_admin_manage_plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY super_admin_manage_plans ON public.plans USING (public.is_super_admin());


--
-- Name: employee_roles super_admin_manage_roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY super_admin_manage_roles ON public.employee_roles USING ((EXISTS ( SELECT 1
   FROM public.super_admin_allowlist
  WHERE ((super_admin_allowlist.user_id = auth.uid()) AND (super_admin_allowlist.is_active = true)))));


--
-- Name: super_admin_allowlist super_admin_read_allowlist; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY super_admin_read_allowlist ON public.super_admin_allowlist FOR SELECT USING (public.is_super_admin());


--
-- Name: audit_logs super_admin_read_audit_logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY super_admin_read_audit_logs ON public.audit_logs FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.super_admin_allowlist
  WHERE ((super_admin_allowlist.user_id = auth.uid()) AND (super_admin_allowlist.is_active = true)))));


--
-- Name: suppliers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

--
-- Name: suppliers suppliers_owner_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY suppliers_owner_read ON public.suppliers FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.sites
  WHERE ((sites.id = suppliers.site_id) AND (sites.user_id = auth.uid()) AND (sites.deleted_at IS NULL)))));


--
-- Name: suppliers suppliers_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY suppliers_service_all ON public.suppliers USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: tax_rates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tax_rates ENABLE ROW LEVEL SECURITY;

--
-- Name: tenant_execution_quotas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tenant_execution_quotas ENABLE ROW LEVEL SECURITY;

--
-- Name: tenant_execution_quotas tenant_execution_quotas_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_execution_quotas_service_all ON public.tenant_execution_quotas USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: tenant_operation_projections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tenant_operation_projections ENABLE ROW LEVEL SECURITY;

--
-- Name: tenant_operation_projections tenant_operation_projections_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_operation_projections_service_all ON public.tenant_operation_projections USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: testimonials; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;

--
-- Name: theme_assets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.theme_assets ENABLE ROW LEVEL SECURITY;

--
-- Name: theme_assets theme_assets_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY theme_assets_public_read ON public.theme_assets FOR SELECT USING ((deleted_at IS NULL));


--
-- Name: theme_block_definitions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.theme_block_definitions ENABLE ROW LEVEL SECURITY;

--
-- Name: theme_block_definitions theme_block_definitions_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY theme_block_definitions_public_read ON public.theme_block_definitions FOR SELECT USING ((deleted_at IS NULL));


--
-- Name: theme_draft_patches; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.theme_draft_patches ENABLE ROW LEVEL SECURITY;

--
-- Name: theme_draft_patches theme_draft_patches_owner_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY theme_draft_patches_owner_manage ON public.theme_draft_patches USING ((EXISTS ( SELECT 1
   FROM public.sites
  WHERE ((sites.id = theme_draft_patches.store_id) AND ((sites.user_id = auth.uid()) OR (sites.custom_user_id = auth.uid())) AND (sites.deleted_at IS NULL))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.sites
  WHERE ((sites.id = theme_draft_patches.store_id) AND ((sites.user_id = auth.uid()) OR (sites.custom_user_id = auth.uid())) AND (sites.deleted_at IS NULL)))));


--
-- Name: theme_editor_drafts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.theme_editor_drafts ENABLE ROW LEVEL SECURITY;

--
-- Name: theme_editor_drafts theme_editor_drafts_owner_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY theme_editor_drafts_owner_delete ON public.theme_editor_drafts FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.sites
  WHERE ((sites.id = theme_editor_drafts.store_id) AND (sites.user_id = auth.uid())))));


--
-- Name: theme_editor_drafts theme_editor_drafts_owner_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY theme_editor_drafts_owner_insert ON public.theme_editor_drafts FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.sites
  WHERE ((sites.id = theme_editor_drafts.store_id) AND (sites.user_id = auth.uid())))));


--
-- Name: theme_editor_drafts theme_editor_drafts_owner_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY theme_editor_drafts_owner_select ON public.theme_editor_drafts FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.sites
  WHERE ((sites.id = theme_editor_drafts.store_id) AND (sites.user_id = auth.uid())))));


--
-- Name: theme_editor_drafts theme_editor_drafts_owner_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY theme_editor_drafts_owner_update ON public.theme_editor_drafts FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.sites
  WHERE ((sites.id = theme_editor_drafts.store_id) AND (sites.user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.sites
  WHERE ((sites.id = theme_editor_drafts.store_id) AND (sites.user_id = auth.uid())))));


--
-- Name: theme_instance_drafts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.theme_instance_drafts ENABLE ROW LEVEL SECURITY;

--
-- Name: theme_instance_drafts theme_instance_drafts_owner_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY theme_instance_drafts_owner_manage ON public.theme_instance_drafts USING ((EXISTS ( SELECT 1
   FROM public.sites
  WHERE ((sites.id = theme_instance_drafts.store_id) AND ((sites.user_id = auth.uid()) OR (sites.custom_user_id = auth.uid())) AND (sites.deleted_at IS NULL))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.sites
  WHERE ((sites.id = theme_instance_drafts.store_id) AND ((sites.user_id = auth.uid()) OR (sites.custom_user_id = auth.uid())) AND (sites.deleted_at IS NULL)))));


--
-- Name: theme_instances; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.theme_instances ENABLE ROW LEVEL SECURITY;

--
-- Name: theme_instances theme_instances_owner_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY theme_instances_owner_manage ON public.theme_instances USING ((EXISTS ( SELECT 1
   FROM public.sites
  WHERE ((sites.id = theme_instances.store_id) AND ((sites.user_id = auth.uid()) OR (sites.custom_user_id = auth.uid())) AND (sites.deleted_at IS NULL))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.sites
  WHERE ((sites.id = theme_instances.store_id) AND ((sites.user_id = auth.uid()) OR (sites.custom_user_id = auth.uid())) AND (sites.deleted_at IS NULL)))));


--
-- Name: theme_instances theme_instances_public_active_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY theme_instances_public_active_read ON public.theme_instances FOR SELECT USING (((instance_status = 'active'::text) AND (deleted_at IS NULL) AND (EXISTS ( SELECT 1
   FROM public.sites
  WHERE ((sites.id = theme_instances.store_id) AND (sites.status = 'published'::text) AND (sites.deleted_at IS NULL))))));


--
-- Name: theme_layouts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.theme_layouts ENABLE ROW LEVEL SECURITY;

--
-- Name: theme_layouts theme_layouts_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY theme_layouts_public_read ON public.theme_layouts FOR SELECT USING ((deleted_at IS NULL));


--
-- Name: theme_migrations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.theme_migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: theme_migrations theme_migrations_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY theme_migrations_service_all ON public.theme_migrations USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: theme_package_versions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.theme_package_versions ENABLE ROW LEVEL SECURITY;

--
-- Name: theme_package_versions theme_package_versions_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY theme_package_versions_public_read ON public.theme_package_versions FOR SELECT USING (((release_status = 'published'::text) AND (deleted_at IS NULL)));


--
-- Name: theme_packages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.theme_packages ENABLE ROW LEVEL SECURITY;

--
-- Name: theme_packages theme_packages_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY theme_packages_public_read ON public.theme_packages FOR SELECT USING (((status = 'active'::text) AND (deleted_at IS NULL)));


--
-- Name: theme_presets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.theme_presets ENABLE ROW LEVEL SECURITY;

--
-- Name: theme_presets theme_presets_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY theme_presets_public_read ON public.theme_presets FOR SELECT USING ((deleted_at IS NULL));


--
-- Name: theme_preview_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.theme_preview_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: theme_preview_sessions theme_preview_sessions_owner_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY theme_preview_sessions_owner_manage ON public.theme_preview_sessions USING ((EXISTS ( SELECT 1
   FROM public.sites
  WHERE ((sites.id = theme_preview_sessions.store_id) AND (sites.user_id = auth.uid()) AND (sites.deleted_at IS NULL))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.sites
  WHERE ((sites.id = theme_preview_sessions.store_id) AND (sites.user_id = auth.uid()) AND (sites.deleted_at IS NULL)))));


--
-- Name: theme_preview_sessions theme_preview_sessions_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY theme_preview_sessions_service_all ON public.theme_preview_sessions USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: theme_purchases; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.theme_purchases ENABLE ROW LEVEL SECURITY;

--
-- Name: theme_releases; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.theme_releases ENABLE ROW LEVEL SECURITY;

--
-- Name: theme_releases theme_releases_owner_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY theme_releases_owner_read ON public.theme_releases FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.sites
  WHERE ((sites.id = theme_releases.store_id) AND (sites.user_id = auth.uid()) AND (sites.deleted_at IS NULL)))));


--
-- Name: theme_releases theme_releases_public_current_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY theme_releases_public_current_read ON public.theme_releases FOR SELECT USING (((is_current = true) AND (release_status = 'published'::text) AND (deleted_at IS NULL) AND (EXISTS ( SELECT 1
   FROM public.sites
  WHERE ((sites.id = theme_releases.store_id) AND (sites.status = 'published'::text) AND (sites.deleted_at IS NULL))))));


--
-- Name: theme_releases theme_releases_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY theme_releases_service_all ON public.theme_releases USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: theme_renderer_manifests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.theme_renderer_manifests ENABLE ROW LEVEL SECURITY;

--
-- Name: theme_renderer_manifests theme_renderer_manifests_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY theme_renderer_manifests_public_read ON public.theme_renderer_manifests FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.theme_package_versions
  WHERE ((theme_package_versions.id = theme_renderer_manifests.theme_package_version_id) AND (theme_package_versions.release_status = 'published'::text) AND (theme_package_versions.deleted_at IS NULL)))));


--
-- Name: theme_reviews; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.theme_reviews ENABLE ROW LEVEL SECURITY;

--
-- Name: theme_schema_manifests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.theme_schema_manifests ENABLE ROW LEVEL SECURITY;

--
-- Name: theme_schema_manifests theme_schema_manifests_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY theme_schema_manifests_public_read ON public.theme_schema_manifests FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.theme_package_versions
  WHERE ((theme_package_versions.id = theme_schema_manifests.theme_package_version_id) AND (theme_package_versions.release_status = 'published'::text) AND (theme_package_versions.deleted_at IS NULL)))));


--
-- Name: theme_section_definitions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.theme_section_definitions ENABLE ROW LEVEL SECURITY;

--
-- Name: theme_section_definitions theme_section_definitions_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY theme_section_definitions_public_read ON public.theme_section_definitions FOR SELECT USING ((deleted_at IS NULL));


--
-- Name: theme_template_assignments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.theme_template_assignments ENABLE ROW LEVEL SECURITY;

--
-- Name: theme_template_assignments theme_template_assignments_owner_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY theme_template_assignments_owner_manage ON public.theme_template_assignments USING ((EXISTS ( SELECT 1
   FROM public.sites
  WHERE ((sites.id = theme_template_assignments.store_id) AND ((sites.user_id = auth.uid()) OR (sites.custom_user_id = auth.uid())) AND (sites.deleted_at IS NULL))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.sites
  WHERE ((sites.id = theme_template_assignments.store_id) AND ((sites.user_id = auth.uid()) OR (sites.custom_user_id = auth.uid())) AND (sites.deleted_at IS NULL)))));


--
-- Name: theme_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.theme_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: theme_templates theme_templates_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY theme_templates_public_read ON public.theme_templates FOR SELECT USING ((deleted_at IS NULL));


--
-- Name: themes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.themes ENABLE ROW LEVEL SECURITY;

--
-- Name: usage_meter_entries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.usage_meter_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: usage_meter_entries usage_meter_entries_owner_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY usage_meter_entries_owner_read ON public.usage_meter_entries FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.sites
  WHERE ((sites.id = usage_meter_entries.site_id) AND ((sites.user_id = auth.uid()) OR (sites.custom_user_id = auth.uid())) AND (sites.deleted_at IS NULL)))));


--
-- Name: usage_meter_entries usage_meter_entries_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY usage_meter_entries_service_all ON public.usage_meter_entries USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: user_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

--
-- Name: users_custom; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.users_custom ENABLE ROW LEVEL SECURITY;

--
-- Name: sites users_manage_own_stores; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_manage_own_stores ON public.sites USING ((user_id = auth.uid()));


--
-- Name: billing_history users_own_billing; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_own_billing ON public.billing_history USING ((user_id = auth.uid()));


--
-- Name: users users_own_data; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_own_data ON public.users USING ((id = auth.uid()));


--
-- Name: device_tokens users_own_devices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_own_devices ON public.device_tokens USING ((user_id = auth.uid()));


--
-- Name: notification_preferences users_own_notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_own_notifications ON public.notification_preferences USING ((user_id = auth.uid()));


--
-- Name: user_profiles users_own_profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_own_profile ON public.user_profiles USING ((id = auth.uid()));


--
-- Name: subscriptions users_own_subscription; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_own_subscription ON public.subscriptions USING ((user_id = auth.uid()));


--
-- Name: verification_tokens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.verification_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: webhook_deliveries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;

--
-- Name: webhook_deliveries webhook_deliveries_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY webhook_deliveries_service_all ON public.webhook_deliveries USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: webhook_subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.webhook_subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: webhook_subscriptions webhook_subscriptions_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY webhook_subscriptions_service_all ON public.webhook_subscriptions USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: wishlists; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;

--
-- Name: work_experience; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.work_experience ENABLE ROW LEVEL SECURITY;

--
-- Name: worker_request_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.worker_request_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: worker_request_logs worker_request_logs_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY worker_request_logs_service_all ON public.worker_request_logs USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: workflow_heartbeats; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workflow_heartbeats ENABLE ROW LEVEL SECURITY;

--
-- Name: workflow_heartbeats workflow_heartbeats_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workflow_heartbeats_service_all ON public.workflow_heartbeats USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: workflow_lifecycle; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workflow_lifecycle ENABLE ROW LEVEL SECURITY;

--
-- Name: workflow_lifecycle workflow_lifecycle_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workflow_lifecycle_service_all ON public.workflow_lifecycle USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: workflow_operation_snapshots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workflow_operation_snapshots ENABLE ROW LEVEL SECURITY;

--
-- Name: workflow_operation_snapshots workflow_operation_snapshots_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workflow_operation_snapshots_service_all ON public.workflow_operation_snapshots USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- PostgreSQL database dump complete
--
