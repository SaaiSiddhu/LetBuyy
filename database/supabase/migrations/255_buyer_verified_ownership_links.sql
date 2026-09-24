-- 255 — buyer ownership requires a verified buyer, and every ownership edge is explicit and audited
-- (APPID-P3, D-ONE-BUYER, OWNER_DECISION 2026-09-24).
--
-- ============================================================================
-- WHAT IS WRONG (traced in code, not inferred)
-- ============================================================================
-- /buyer/register creates buyer_accounts with email_verified = false, and identity-platform mints a
-- buyer session in the same request. /buyer/link-store-customer then finds or creates the
-- store_customers row carrying that email at a store_id the caller supplies, and links it. Nothing
-- on that path asks whether the email was ever proven. Two consumers treat the link as ownership:
--   * request_order_return (225): buyer -> buyer_store_customers -> store_customers.email -> orders;
--   * the loyalty earner (services/queue-workers/src/loyalty-earn.ts): same chain, then
--     award_loyalty_points credits whichever buyer the chain names.
-- So registering someone else's address, never verifying it, and linking one store is enough to file
-- returns against that person's orders there and to collect their loyalty points. The founder,
-- 2026-09-24: "Never expose orders just because their contact email matches a new signup."
--
-- ============================================================================
-- THE MODEL AFTER THIS MIGRATION
-- ============================================================================
-- 1. A store link (buyer_store_customers) records the merchant relationship: loyalty, consent and
--    notes stay per merchant. It now carries a link_basis. Only link_buyer_store_customer() creates a
--    'verified_email' link, and only for a buyer whose email is verified. Every existing row becomes
--    'legacy_unverified': kept, not deleted (live data is UNKNOWN), and trusted by nothing.
-- 2. Order ownership is a row of its own, buyer_order_links, one per order. Here it is written by a
--    claim from a buyer whose email is verified and equals the order's contact email, or by an operator
--    resolution; 'authenticated_checkout' is reserved for the buyer-session checkout that APPID-P6
--    wires, and its writer ships with that caller. Returns and loyalty read this row and nothing else.
--    An order nobody has claimed belongs to nobody, which is the safe answer.
-- 3. A link held by another buyer is never moved by a buyer. The attempt is refused and written to
--    audit_logs, and an operator resolves it with resolve_buyer_store_customer_link() or
--    resolve_buyer_order_link(), which record who, why and what changed.
--
-- WHY buyer_order_links IS A PLATFORM TABLE AND NOT A COLUMN ON orders
-- orders is readable by its merchant under site RLS, and a buyer account id is a stable cross-store
-- identifier. As a column it would let two merchants establish that the same person shops at both,
-- the correlation migration 223 made structurally impossible. So, exactly like buyer_store_customers:
-- service_role only, ENABLE + FORCE RLS, and app_tenant, authenticated and anon REVOKED outright.
-- Tables created after 164 inherit a default grant to app_tenant, so the revoke is load-bearing.
--
-- WHY audit_logs
-- It is the canonical audit table, it has no site_id, and only super admins can read it, so buyer
-- account ids in its metadata reach no merchant. Its actor_type gains 'buyer' for buyer-initiated
-- actions; nothing else about it changes. Metadata carries ids, never an email address.
--
-- WHAT THIS DOES NOT DO
--   * It does not verify anyone. The verification flow is identity-platform's (APPID-P4). Until it
--     ships, no buyer is verified, so linking and claiming are refused for everyone: fail-closed.
--   * It does not delete or rewrite a store link, an order or an order snapshot.
--   * It does not touch money RPCs. award_loyalty_points is unchanged; its caller now resolves the
--     buyer from buyer_order_links.
--
-- Rollback: database/supabase/rollback/255_buyer_verified_ownership_links.rollback.sql

BEGIN;

-- ---------------------------------------------------------------------------------------------------
-- 1. When a buyer's email was verified. The trigger keeps the pair consistent for every writer, so a
--    verified row always says when, and an unverified row never claims a time.
-- ---------------------------------------------------------------------------------------------------
ALTER TABLE public.buyer_accounts ADD COLUMN IF NOT EXISTS email_verified_at timestamptz;

CREATE OR REPLACE FUNCTION public.buyer_accounts_stamp_email_verified_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NOT NEW.email_verified THEN
    NEW.email_verified_at := NULL;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.email IS DISTINCT FROM OLD.email THEN
      -- A changed address is unproven. It stays verified only when the writer records a fresh
      -- verification time for it, which is what a verified change-of-address flow does.
      IF NEW.email_verified_at IS NULL OR NEW.email_verified_at IS NOT DISTINCT FROM OLD.email_verified_at THEN
        NEW.email_verified := false;
        NEW.email_verified_at := NULL;
      END IF;
      RETURN NEW;
    END IF;
    NEW.email_verified_at := COALESCE(NEW.email_verified_at, OLD.email_verified_at, now());
    RETURN NEW;
  END IF;

  NEW.email_verified_at := COALESCE(NEW.email_verified_at, now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS buyer_accounts_stamp_email_verified_at ON public.buyer_accounts;
CREATE TRIGGER buyer_accounts_stamp_email_verified_at
  BEFORE INSERT OR UPDATE ON public.buyer_accounts
  FOR EACH ROW EXECUTE FUNCTION public.buyer_accounts_stamp_email_verified_at();

-- ---------------------------------------------------------------------------------------------------
-- 2. The basis of a store link. Existing rows become legacy_unverified by default and stay inert.
-- ---------------------------------------------------------------------------------------------------
ALTER TABLE public.buyer_store_customers
  ADD COLUMN IF NOT EXISTS link_basis text NOT NULL DEFAULT 'legacy_unverified',
  ADD COLUMN IF NOT EXISTS verified_at timestamptz;

ALTER TABLE public.buyer_store_customers DROP CONSTRAINT IF EXISTS buyer_store_customers_link_basis_check;
ALTER TABLE public.buyer_store_customers ADD CONSTRAINT buyer_store_customers_link_basis_check
  CHECK (link_basis IN ('legacy_unverified', 'verified_email', 'operator_resolution'));

ALTER TABLE public.buyer_store_customers DROP CONSTRAINT IF EXISTS buyer_store_customers_verified_at_check;
ALTER TABLE public.buyer_store_customers ADD CONSTRAINT buyer_store_customers_verified_at_check
  CHECK ((link_basis = 'legacy_unverified') = (verified_at IS NULL));

-- ---------------------------------------------------------------------------------------------------
-- 3. Explicit order ownership. Platform-only; see the header.
-- ---------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.buyer_order_links (
  order_id uuid PRIMARY KEY REFERENCES public.orders(id) ON DELETE CASCADE,
  buyer_account_id uuid NOT NULL REFERENCES public.buyer_accounts(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  link_basis text NOT NULL,
  linked_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT buyer_order_links_basis_check
    CHECK (link_basis IN ('authenticated_checkout', 'verified_email', 'operator_resolution'))
);

CREATE INDEX IF NOT EXISTS buyer_order_links_buyer_idx
  ON public.buyer_order_links (buyer_account_id, linked_at DESC);
CREATE INDEX IF NOT EXISTS buyer_order_links_buyer_site_idx
  ON public.buyer_order_links (buyer_account_id, site_id);
CREATE INDEX IF NOT EXISTS buyer_order_links_site_idx
  ON public.buyer_order_links (site_id);

ALTER TABLE public.buyer_order_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buyer_order_links FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages buyer order links" ON public.buyer_order_links;
CREATE POLICY "Service role manages buyer order links" ON public.buyer_order_links
  FOR ALL TO service_role USING (true) WITH CHECK (true);

REVOKE ALL ON public.buyer_order_links FROM app_tenant, authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.buyer_order_links TO service_role;

-- ---------------------------------------------------------------------------------------------------
-- 4. audit_logs learns the buyer actor. Additive: every existing value stays valid.
-- ---------------------------------------------------------------------------------------------------
ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_actor_type_check;
ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_actor_type_check
  CHECK (actor_type = ANY (ARRAY['user'::text, 'employee'::text, 'super_admin'::text, 'system'::text, 'buyer'::text]));

-- ---------------------------------------------------------------------------------------------------
-- 5. Link a verified buyer to their customer record at one store.
--    Outcomes: linked | already_linked | unverified | conflict | buyer_unavailable | store_unavailable.
--    The caller maps outcomes to responses and never learns another buyer's id.
-- ---------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.link_buyer_store_customer(
  p_buyer_account_id uuid,
  p_site_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_buyer   public.buyer_accounts%ROWTYPE;
  v_sc_id   uuid;
  v_link    public.buyer_store_customers%ROWTYPE;
  v_other   uuid;
BEGIN
  IF p_buyer_account_id IS NULL OR p_site_id IS NULL THEN
    RAISE EXCEPTION 'buyer account and store are required';
  END IF;

  -- One linking decision per buyer and store at a time.
  PERFORM pg_advisory_xact_lock(hashtextextended('buyer_store_link:' || p_buyer_account_id::text || ':' || p_site_id::text, 0));

  SELECT * INTO v_buyer FROM public.buyer_accounts WHERE id = p_buyer_account_id FOR SHARE;
  IF NOT FOUND OR v_buyer.status <> 'active' THEN
    RETURN jsonb_build_object('outcome', 'buyer_unavailable');
  END IF;

  IF NOT v_buyer.email_verified THEN
    INSERT INTO public.audit_logs (actor_id, actor_type, action, resource_type, resource_id, metadata)
    VALUES (p_buyer_account_id, 'buyer', 'buyer_store_link.refused_unverified', 'buyer_account', p_buyer_account_id,
            jsonb_build_object('site_id', p_site_id));
    RETURN jsonb_build_object('outcome', 'unverified');
  END IF;

  PERFORM 1 FROM public.sites s
   WHERE s.id = p_site_id AND s.deleted_at IS NULL AND s.site_type = 'store';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('outcome', 'store_unavailable');
  END IF;

  -- The customer record at this store for this verified address. Case variants of one address are
  -- one person; the oldest record is the relationship.
  SELECT sc.id INTO v_sc_id
    FROM public.store_customers sc
   WHERE sc.store_id = p_site_id
     AND lower(btrim(sc.email)) = v_buyer.email
     AND sc.deleted_at IS NULL
   ORDER BY sc.created_at, sc.id
   LIMIT 1
   FOR UPDATE;

  IF v_sc_id IS NULL THEN
    INSERT INTO public.store_customers (store_id, email)
    VALUES (p_site_id, v_buyer.email)
    ON CONFLICT (store_id, email) DO NOTHING
    RETURNING id INTO v_sc_id;
    IF v_sc_id IS NULL THEN
      SELECT sc.id INTO v_sc_id FROM public.store_customers sc
       WHERE sc.store_id = p_site_id AND sc.email = v_buyer.email FOR UPDATE;
    END IF;
  END IF;

  SELECT * INTO v_link FROM public.buyer_store_customers WHERE store_customer_id = v_sc_id FOR UPDATE;
  IF FOUND THEN
    IF v_link.buyer_account_id <> p_buyer_account_id THEN
      INSERT INTO public.audit_logs (actor_id, actor_type, action, resource_type, resource_id, metadata)
      VALUES (p_buyer_account_id, 'buyer', 'buyer_store_link.conflict', 'store_customer', v_sc_id,
              jsonb_build_object('site_id', p_site_id, 'requesting_buyer_account_id', p_buyer_account_id,
                                 'linked_buyer_account_id', v_link.buyer_account_id, 'linked_basis', v_link.link_basis));
      RETURN jsonb_build_object('outcome', 'conflict');
    END IF;
    IF v_link.link_basis = 'legacy_unverified' THEN
      UPDATE public.buyer_store_customers
         SET link_basis = 'verified_email', verified_at = now()
       WHERE store_customer_id = v_sc_id;
      INSERT INTO public.audit_logs (actor_id, actor_type, action, resource_type, resource_id, metadata)
      VALUES (p_buyer_account_id, 'buyer', 'buyer_store_link.verified', 'store_customer', v_sc_id,
              jsonb_build_object('site_id', p_site_id, 'previous_basis', 'legacy_unverified',
                                 'email_verified_at', v_buyer.email_verified_at));
      RETURN jsonb_build_object('outcome', 'linked', 'store_customer_id', v_sc_id);
    END IF;
    RETURN jsonb_build_object('outcome', 'already_linked', 'store_customer_id', v_sc_id);
  END IF;

  -- One customer record per buyer per store: a buyer already linked here through a different record
  -- (an earlier address) is a conflict for a person to resolve, not something to guess at.
  SELECT bsc.store_customer_id INTO v_other
    FROM public.buyer_store_customers bsc
   WHERE bsc.buyer_account_id = p_buyer_account_id AND bsc.site_id = p_site_id;
  IF v_other IS NOT NULL THEN
    INSERT INTO public.audit_logs (actor_id, actor_type, action, resource_type, resource_id, metadata)
    VALUES (p_buyer_account_id, 'buyer', 'buyer_store_link.conflict', 'store_customer', v_sc_id,
            jsonb_build_object('site_id', p_site_id, 'requesting_buyer_account_id', p_buyer_account_id,
                               'existing_store_customer_id', v_other));
    RETURN jsonb_build_object('outcome', 'conflict');
  END IF;

  INSERT INTO public.buyer_store_customers (buyer_account_id, store_customer_id, site_id, link_basis, verified_at)
  VALUES (p_buyer_account_id, v_sc_id, p_site_id, 'verified_email', now());

  INSERT INTO public.audit_logs (actor_id, actor_type, action, resource_type, resource_id, metadata)
  VALUES (p_buyer_account_id, 'buyer', 'buyer_store_link.linked', 'store_customer', v_sc_id,
          jsonb_build_object('site_id', p_site_id, 'basis', 'verified_email',
                             'email_verified_at', v_buyer.email_verified_at));

  RETURN jsonb_build_object('outcome', 'linked', 'store_customer_id', v_sc_id);
END;
$$;

-- ---------------------------------------------------------------------------------------------------
-- 6. A verified buyer claims the orders placed with their verified address.
--    Orders another buyer already owns are counted as conflicts and left alone.
--    Outcomes: claimed | unverified | buyer_unavailable.
-- ---------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_buyer_orders(
  p_buyer_account_id uuid,
  p_site_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_buyer      public.buyer_accounts%ROWTYPE;
  v_linked     integer := 0;
  v_already    integer := 0;
  v_conflicts  uuid[] := ARRAY[]::uuid[];
  v_order      RECORD;
  v_owner      uuid;
BEGIN
  IF p_buyer_account_id IS NULL THEN
    RAISE EXCEPTION 'buyer account is required';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('buyer_order_claim:' || p_buyer_account_id::text, 0));

  SELECT * INTO v_buyer FROM public.buyer_accounts WHERE id = p_buyer_account_id FOR SHARE;
  IF NOT FOUND OR v_buyer.status <> 'active' THEN
    RETURN jsonb_build_object('outcome', 'buyer_unavailable');
  END IF;

  IF NOT v_buyer.email_verified THEN
    INSERT INTO public.audit_logs (actor_id, actor_type, action, resource_type, resource_id, metadata)
    VALUES (p_buyer_account_id, 'buyer', 'buyer_orders.claim_refused_unverified', 'buyer_account', p_buyer_account_id,
            jsonb_build_object('site_id', p_site_id));
    RETURN jsonb_build_object('outcome', 'unverified');
  END IF;

  -- No row lock on orders: the payment and fulfilment paths own those rows. The primary key of
  -- buyer_order_links is what makes a race between two claimants (or a claim and a checkout) safe:
  -- the second insert does nothing, and the owner is then read back.
  FOR v_order IN
    SELECT o.id, o.site_id
      FROM public.orders o
     WHERE lower(btrim(o.customer_email)) = v_buyer.email
       AND o.site_id IS NOT NULL
       AND o.deleted_at IS NULL
       AND (p_site_id IS NULL OR o.site_id = p_site_id)
     ORDER BY o.created_at, o.id
  LOOP
    INSERT INTO public.buyer_order_links (order_id, buyer_account_id, site_id, link_basis)
    VALUES (v_order.id, p_buyer_account_id, v_order.site_id, 'verified_email')
    ON CONFLICT (order_id) DO NOTHING;
    IF FOUND THEN
      v_linked := v_linked + 1;
    ELSE
      SELECT bol.buyer_account_id INTO v_owner FROM public.buyer_order_links bol WHERE bol.order_id = v_order.id;
      IF v_owner = p_buyer_account_id THEN
        v_already := v_already + 1;
      ELSE
        v_conflicts := v_conflicts || v_order.id;
      END IF;
    END IF;
  END LOOP;

  INSERT INTO public.audit_logs (actor_id, actor_type, action, resource_type, resource_id, metadata)
  VALUES (p_buyer_account_id, 'buyer', 'buyer_orders.claimed', 'buyer_account', p_buyer_account_id,
          jsonb_build_object('site_id', p_site_id, 'linked', v_linked, 'already_linked', v_already,
                             'conflict_order_ids', to_jsonb(v_conflicts),
                             'email_verified_at', v_buyer.email_verified_at));

  RETURN jsonb_build_object('outcome', 'claimed', 'linked', v_linked, 'already_linked', v_already,
                            'conflicts', coalesce(array_length(v_conflicts, 1), 0));
END;
$$;

-- ---------------------------------------------------------------------------------------------------
-- 7. Operator conflict resolution. An operator who has established out of band which buyer owns a
--    record moves it, with a reason. The target buyer must be verified. Every change is audited with
--    the previous owner, so a wrong resolution can itself be reversed by the same path.
-- ---------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_buyer_store_customer_link(
  p_store_customer_id uuid,
  p_buyer_account_id uuid,
  p_operator_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_site     uuid;
  v_previous public.buyer_store_customers%ROWTYPE;
  v_other    uuid;
BEGIN
  IF p_store_customer_id IS NULL OR p_buyer_account_id IS NULL OR p_operator_id IS NULL
     OR nullif(btrim(coalesce(p_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'store customer, buyer account, operator and reason are required';
  END IF;

  SELECT sc.store_id INTO v_site FROM public.store_customers sc WHERE sc.id = p_store_customer_id FOR UPDATE;
  IF v_site IS NULL THEN
    RETURN jsonb_build_object('outcome', 'store_customer_unavailable');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('buyer_store_link:' || p_buyer_account_id::text || ':' || v_site::text, 0));

  PERFORM 1 FROM public.buyer_accounts b
   WHERE b.id = p_buyer_account_id AND b.status = 'active' AND b.email_verified;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('outcome', 'buyer_unavailable_or_unverified');
  END IF;

  SELECT bsc.store_customer_id INTO v_other
    FROM public.buyer_store_customers bsc
   WHERE bsc.buyer_account_id = p_buyer_account_id AND bsc.site_id = v_site
     AND bsc.store_customer_id <> p_store_customer_id;
  IF v_other IS NOT NULL THEN
    RETURN jsonb_build_object('outcome', 'buyer_has_other_record_at_store');
  END IF;

  SELECT * INTO v_previous FROM public.buyer_store_customers WHERE store_customer_id = p_store_customer_id FOR UPDATE;
  DELETE FROM public.buyer_store_customers WHERE store_customer_id = p_store_customer_id;

  INSERT INTO public.buyer_store_customers (buyer_account_id, store_customer_id, site_id, link_basis, verified_at)
  VALUES (p_buyer_account_id, p_store_customer_id, v_site, 'operator_resolution', now());

  INSERT INTO public.audit_logs (actor_id, actor_type, action, resource_type, resource_id, metadata)
  VALUES (p_operator_id, 'employee', 'buyer_store_link.operator_resolved', 'store_customer', p_store_customer_id,
          jsonb_build_object('site_id', v_site, 'buyer_account_id', p_buyer_account_id,
                             'previous_buyer_account_id', v_previous.buyer_account_id,
                             'previous_basis', v_previous.link_basis, 'reason', btrim(p_reason)));

  RETURN jsonb_build_object('outcome', 'resolved');
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_buyer_order_link(
  p_order_id uuid,
  p_buyer_account_id uuid,
  p_operator_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_site     uuid;
  v_previous public.buyer_order_links%ROWTYPE;
BEGIN
  IF p_order_id IS NULL OR p_buyer_account_id IS NULL OR p_operator_id IS NULL
     OR nullif(btrim(coalesce(p_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'order, buyer account, operator and reason are required';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('buyer_order_link:' || p_order_id::text, 0));

  SELECT o.site_id INTO v_site FROM public.orders o WHERE o.id = p_order_id AND o.site_id IS NOT NULL;
  IF v_site IS NULL THEN
    RETURN jsonb_build_object('outcome', 'order_unavailable');
  END IF;

  PERFORM 1 FROM public.buyer_accounts b
   WHERE b.id = p_buyer_account_id AND b.status = 'active' AND b.email_verified;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('outcome', 'buyer_unavailable_or_unverified');
  END IF;

  SELECT * INTO v_previous FROM public.buyer_order_links WHERE order_id = p_order_id FOR UPDATE;

  INSERT INTO public.buyer_order_links (order_id, buyer_account_id, site_id, link_basis, linked_at)
  VALUES (p_order_id, p_buyer_account_id, v_site, 'operator_resolution', now())
  ON CONFLICT (order_id) DO UPDATE
     SET buyer_account_id = EXCLUDED.buyer_account_id,
         link_basis = 'operator_resolution',
         linked_at = now();

  INSERT INTO public.audit_logs (actor_id, actor_type, action, resource_type, resource_id, metadata)
  VALUES (p_operator_id, 'employee', 'buyer_order_link.operator_resolved', 'order', p_order_id,
          jsonb_build_object('site_id', v_site, 'buyer_account_id', p_buyer_account_id,
                             'previous_buyer_account_id', v_previous.buyer_account_id,
                             'previous_basis', v_previous.link_basis, 'reason', btrim(p_reason)));

  RETURN jsonb_build_object('outcome', 'resolved');
END;
$$;

-- ---------------------------------------------------------------------------------------------------
-- 8. Returns read explicit ownership. The body is 225's with one change: the ownership query.
-- ---------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.request_order_return(
  p_buyer_account_id uuid,
  p_order_id uuid,
  p_reason text,
  p_description text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  order_id uuid,
  reason text,
  description text,
  status text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_order       RECORD;
  v_existing_id uuid;
  v_new_id      uuid;
BEGIN
  IF p_buyer_account_id IS NULL OR p_order_id IS NULL OR p_reason IS NULL THEN
    RAISE EXCEPTION 'buyer account, order and reason are required';
  END IF;

  -- Serialize per order. Without this, two concurrent requests both see no open return and both
  -- insert one. Keyed on the order because that is the thing a duplicate would be about.
  PERFORM pg_advisory_xact_lock(hashtextextended('return_request:' || p_order_id::text, 0));

  -- Ownership is the explicit order link (255), never an email match: a matching address proves
  -- nothing until its owner has verified it and claimed the order.
  SELECT o.id, o.site_id
    INTO v_order
    FROM public.orders o
    JOIN public.buyer_order_links bol
      ON bol.order_id = o.id
     AND bol.buyer_account_id = p_buyer_account_id
   WHERE o.id = p_order_id
   LIMIT 1;

  IF NOT FOUND THEN
    -- Not this buyer's order, or no such order. The caller cannot tell which, deliberately.
    RETURN;
  END IF;

  SELECT rr.id INTO v_existing_id
    FROM public.return_requests rr
   WHERE rr.order_id = v_order.id
     AND rr.status IN ('pending', 'approved', 'processing')
   LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RAISE EXCEPTION 'a return request is already open for this order'
      USING ERRCODE = '23505';
  END IF;

  -- status is written here, never taken from the caller. return_requests also carries
  -- refund_amount, approved_at, refunded_at, processed_by and admin_notes -- all merchant-owned, and
  -- none of them is a parameter of this function, so a buyer cannot file a return that is already
  -- refunded for an amount of their choosing.
  INSERT INTO public.return_requests (order_id, store_id, reason, description, status)
  VALUES (v_order.id, v_order.site_id, p_reason, nullif(btrim(coalesce(p_description, '')), ''), 'pending')
  RETURNING return_requests.id INTO v_new_id;

  RETURN QUERY
  SELECT rr.id, rr.order_id, rr.reason, rr.description, rr.status, rr.created_at
    FROM public.return_requests rr
   WHERE rr.id = v_new_id;
END;
$$;

-- ---------------------------------------------------------------------------------------------------
-- 9. Only the backend may call any of these.
--     REVOKE FROM PUBLIC is not enough on Supabase: its default privileges GRANT ALL ON FUNCTIONS to
--     anon and authenticated BY NAME when a function is created, and a revoke from PUBLIC leaves
--     those named grants in place. Each of these takes a buyer or operator id as a parameter and runs
--     as its owner, so either role reaching one through the Data API could act as any buyer. The API
--     roles and app_tenant are therefore revoked by name, and request_order_return, which 225
--     protected only from PUBLIC, is closed the same way here.
-- ---------------------------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.link_buyer_store_customer(uuid, uuid) FROM PUBLIC, anon, authenticated, app_tenant;
REVOKE ALL ON FUNCTION public.claim_buyer_orders(uuid, uuid) FROM PUBLIC, anon, authenticated, app_tenant;
REVOKE ALL ON FUNCTION public.resolve_buyer_store_customer_link(uuid, uuid, uuid, text) FROM PUBLIC, anon, authenticated, app_tenant;
REVOKE ALL ON FUNCTION public.resolve_buyer_order_link(uuid, uuid, uuid, text) FROM PUBLIC, anon, authenticated, app_tenant;
REVOKE ALL ON FUNCTION public.request_order_return(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated, app_tenant;
REVOKE ALL ON FUNCTION public.buyer_accounts_stamp_email_verified_at() FROM PUBLIC, anon, authenticated, app_tenant;

GRANT EXECUTE ON FUNCTION public.link_buyer_store_customer(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_buyer_orders(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.resolve_buyer_store_customer_link(uuid, uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.resolve_buyer_order_link(uuid, uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.request_order_return(uuid, uuid, text, text) TO service_role;

COMMIT;
