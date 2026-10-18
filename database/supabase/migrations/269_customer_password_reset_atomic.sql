-- Consume one customer reset token and replace both password hashes atomically.
-- A row lock serializes concurrent redemptions; the waiting caller rechecks the live-token predicate.
BEGIN;

CREATE OR REPLACE FUNCTION public.confirm_customer_password_reset(
    p_store_id uuid,
    p_email text,
    p_reset_token_hash text,
    p_password_hash text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_credential_id uuid;
    v_customer public.store_customers%ROWTYPE;
BEGIN
    IF p_store_id IS NULL
        OR p_email IS NULL
        OR p_email = ''
        OR p_email IS DISTINCT FROM pg_catalog.lower(pg_catalog.btrim(p_email))
        OR p_reset_token_hash IS NULL
        OR p_password_hash IS NULL
    THEN
        RETURN NULL;
    END IF;

    SELECT credential.id
      INTO v_credential_id
      FROM public.customer_credentials AS credential
     WHERE credential.store_id = p_store_id
       AND credential.email_or_phone = p_email
       AND credential.reset_token_hash = p_reset_token_hash
       AND credential.reset_used_at IS NULL
       AND credential.reset_expires_at > pg_catalog.clock_timestamp()
     FOR UPDATE;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    SELECT customer.*
      INTO v_customer
      FROM public.store_customers AS customer
     WHERE customer.store_id = p_store_id
       AND customer.email = p_email
       AND customer.status <> 'disabled'
       AND customer.deleted_at IS NULL
     FOR UPDATE;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    UPDATE public.store_customers
       SET password_hash = p_password_hash,
           status = 'active'
     WHERE id = v_customer.id
       AND store_id = p_store_id
       AND deleted_at IS NULL
     RETURNING * INTO v_customer;

    UPDATE public.customer_credentials
       SET password_hash = p_password_hash,
           reset_token_hash = NULL,
           reset_used_at = pg_catalog.clock_timestamp()
     WHERE id = v_credential_id
       AND store_id = p_store_id
       AND reset_token_hash = p_reset_token_hash
       AND reset_used_at IS NULL;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'Customer reset state changed during confirmation';
    END IF;

    RETURN pg_catalog.jsonb_build_object(
        'id', v_customer.id,
        'store_id', v_customer.store_id,
        'email', v_customer.email,
        'full_name', v_customer.full_name,
        'phone', v_customer.phone,
        'status', v_customer.status,
        'accepts_marketing', v_customer.accepts_marketing,
        'updated_at', v_customer.updated_at
    );
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_customer_password_reset(uuid,text,text,text)
    FROM PUBLIC, anon, authenticated, app_tenant;
GRANT EXECUTE ON FUNCTION public.confirm_customer_password_reset(uuid,text,text,text)
    TO service_role;

COMMIT;
