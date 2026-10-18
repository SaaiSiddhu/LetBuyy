-- N1.4: final-chain named closure after post-256 replacements and additions.
-- Gateway is the caller of these RPCs. The Data API roles must not acquire
-- backend authority from a late compatibility grant (272 reopened feed/origins).
-- Function bodies, ownership, policy helpers and backend effective access stay
-- unchanged. Signatures are bound to the owned final-chain catalog through 308.
-- Every actual privilege delta is journaled before it changes; reapply does not
-- replace the original journal. Rollback 309 restores only its recorded deltas.

BEGIN;
SET LOCAL search_path = pg_catalog, public;

DO $closure_309_precondition$
BEGIN
  IF to_regclass('public.migration_privilege_journal') IS NULL THEN
    RAISE EXCEPTION '309 requires the existing private migration privilege journal';
  END IF;
END;
$closure_309_precondition$;

-- Identity binding makes a rollback refuse later DROP/recreate, owner or body
-- changes instead of restoring old grants onto a different implementation.
ALTER TABLE public.migration_privilege_journal ADD COLUMN IF NOT EXISTS object_oid oid;
ALTER TABLE public.migration_privilege_journal ADD COLUMN IF NOT EXISTS object_owner oid;
ALTER TABLE public.migration_privilege_journal ADD COLUMN IF NOT EXISTS object_definition_hash text;

DO $closure_309$
DECLARE
  v_target record;
  v_fn record;
  v_entry record;
  v_acl aclitem[];
  v_role text;
  v_named boolean;
  v_named_grantable boolean;
  v_effective boolean;
  v_grantable boolean;
  v_public boolean;
  v_definition_hash text;
BEGIN
  IF to_regclass('public.migration_privilege_journal') IS NULL THEN
    RAISE EXCEPTION '309 requires the existing private migration privilege journal';
  END IF;
  FOR v_target IN SELECT signature FROM (VALUES
    ('public.allocate_ad_campaign_budget(uuid,uuid,bigint,text,text,uuid)'),
    ('public.assign_marketplace_listing_reviewer(uuid,uuid,uuid,uuid,text,text,integer)'),
    ('public.bind_hosted_checkout_buyer(uuid,uuid,text,text,uuid,integer)'),
    ('public.bind_marketplace_order_category_snapshot()'),
    ('public.capture_channel_offer_price_observations(uuid,text)'),
    ('public.capture_listing_offer_price_observation()'),
    ('public.capture_payout_statement_source_ledger_lineage()'),
    ('public.capture_product_price_observation()'),
    ('public.capture_removed_marketplace_offer_price_observation(uuid,uuid)'),
    ('public.capture_site_offer_price_observations()'),
    ('public.channel_listing_review_revision_guard()'),
    ('public.channel_listing_reviewer_assignment_guard()'),
    ('public.claim_marketplace_listing_review(uuid,uuid,uuid,text,text,integer)'),
    ('public.claim_payout_statement_release(uuid,uuid,text,uuid)'),
    ('public.collect_cod_order_with_lock(uuid,uuid,bigint,text,text,uuid)'),
    ('public.complete_storefront_web_onboarding_draft(uuid,uuid,uuid)'),
    ('public.confirm_customer_password_reset(uuid,text,text,text)'),
    ('public.consume_buyer_email_challenge(uuid,text,text,text)'),
    ('public.consume_internal_auth_replay_jti(text,text,integer)'),
    ('public.create_checkout_order_for_buyer(uuid,integer,uuid,text,text,text,jsonb,jsonb,text,text,text,text,text,text,uuid,text,uuid,numeric,text,jsonb,bigint)'),
    ('public.create_marketplace_checkout_order(uuid,text,text,text,jsonb,jsonb,text,text,text,text,text,text,uuid,text,uuid,numeric,text,jsonb,uuid,integer)'),
    ('public.create_marketplace_checkout_order_with_delivery_rate(uuid,text,text,text,jsonb,jsonb,text,text,text,text,text,text,uuid,text,uuid,numeric,text,jsonb,uuid,integer,numeric)'),
    ('public.create_payout_statement_with_effects(uuid,text,text,text,text,bigint,bigint,bigint,bigint,date,date,date,text,uuid[],uuid,jsonb,uuid)'),
    ('public.create_settlement_payout_with_effects(uuid,uuid,bigint,date,uuid,text)'),
    ('public.create_storefront_checkout_order_with_delivery_rate(uuid,text,text,text,jsonb,jsonb,text,text,text,text,text,text,uuid,text,uuid,numeric,text,jsonb,uuid,integer,numeric)'),
    ('public.ensure_canonical_money_wallet_projection(uuid)'),
    ('public.execute_operator_support_mutation(uuid,text,text,uuid,text,jsonb,text[],integer,integer)'),
    ('public.finalize_ad_credit_purchase(uuid,uuid,text,text,text,uuid)'),
    ('public.finalize_manual_payment_refund_attempt(uuid,uuid,text,bigint,text,text,uuid)'),
    ('public.finalize_payout_statement_release_with_effects(uuid,uuid,text,text,timestamp with time zone,text,text,text,uuid,jsonb)'),
    ('public.invalidate_marketplace_listing_review(uuid,text)'),
    ('public.invalidate_review_after_listing_change()'),
    ('public.invalidate_review_after_option_change()'),
    ('public.invalidate_review_after_product_change()'),
    ('public.invalidate_review_after_variant_change()'),
    ('public.issue_buyer_authorization_code(uuid,text,text,uuid,text)'),
    ('public.link_buyer_firebase_uid(uuid,text,text,text)'),
    ('public.link_support_trust_safety_case(uuid,uuid,text,text)'),
    ('public.load_owned_payment_session(uuid,uuid,uuid)'),
    ('public.marketplace_feed(text,text,integer,timestamp with time zone,uuid)'),
    ('public.marketplace_feed(text,text,integer,timestamp with time zone,uuid,text)'),
    ('public.marketplace_listing_review_fingerprint(uuid)'),
    ('public.marketplace_listing_review_snapshot(uuid)'),
    ('public.marketplace_order_item_listing_guard()'),
    ('public.marketplace_origins()'),
    ('public.marketplace_sponsored_products(integer)'),
    ('public.open_buyer_support_ticket_with_complaint(text,timestamp with time zone,timestamp with time zone,uuid,uuid,text,text)'),
    ('public.post_ledger_transaction(uuid,text,text,text,text,jsonb,jsonb,text)'),
    ('public.post_settlement_ledger_transaction(uuid,text,text,text,jsonb,jsonb,text)'),
    ('public.prevent_checkout_order_item_snapshot_update()'),
    ('public.product_price_reference_window(uuid[],timestamp with time zone,text)'),
    ('public.reconcile_cod_remittance_with_ledger_checked(uuid,uuid,bigint,text,text,uuid,text)'),
    ('public.reconcile_payment_refund_attempt(uuid,uuid,text,text,text,text,bigint,text,text)'),
    ('public.record_ad_credit_purchase(uuid,bigint,text,text,text,uuid)'),
    ('public.record_ad_spend(uuid,uuid,text,integer,text,text,uuid)'),
    ('public.record_payout_statement_source_ledger_lineage(uuid,uuid,jsonb,timestamp with time zone)'),
    ('public.redeem_buyer_authorization_code(text,text,text,text)'),
    ('public.release_ad_campaign_budget(uuid,uuid,bigint,text,text,uuid)'),
    ('public.reply_to_support_ticket(uuid,uuid,text,text,text,text,uuid,jsonb,jsonb,text)'),
    ('public.reserve_payment_refund_attempt(uuid,bigint,text,text,uuid,jsonb)'),
    ('public.resolve_money_ledger_source_site_id(text,text,jsonb)'),
    ('public.resolve_payment_for_refund_provider_event(text,text)'),
    ('public.resubmit_rejected_marketplace_listing(uuid,uuid,uuid,text,text)'),
    ('public.revoke_buyer_sessions(uuid)'),
    ('public.save_storefront_web_onboarding_draft(uuid,integer,text,text,text,text[])'),
    ('public.start_buyer_email_challenge(uuid,text)')
  ) AS targets(signature) LOOP
    SELECT p.* INTO v_fn FROM pg_proc p WHERE p.oid=to_regprocedure(v_target.signature);
    IF NOT FOUND OR NOT v_fn.prosecdef THEN
      RAISE EXCEPTION '309 refuses unexpected function ABI: %', v_target.signature;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policy pol WHERE
      (coalesce(pg_get_expr(pol.polqual,pol.polrelid),'') || ' ' ||
       coalesce(pg_get_expr(pol.polwithcheck,pol.polrelid),'')) ~ ('\m' || v_fn.proname || '\s*\(')) THEN
      RAISE EXCEPTION '309 refuses to close an RLS policy helper: %', v_target.signature;
    END IF;
    v_definition_hash := encode(sha256(convert_to(pg_get_functiondef(v_fn.oid),'UTF8')),'hex');
    IF EXISTS(SELECT 1 FROM public.migration_privilege_journal j WHERE j.migration='309'
      AND j.object_signature=v_target.signature AND
      (j.object_oid IS DISTINCT FROM v_fn.oid OR j.object_owner IS DISTINCT FROM v_fn.proowner
       OR j.object_definition_hash IS DISTINCT FROM v_definition_hash)) THEN
      RAISE EXCEPTION '309 refuses a changed journaled function: %',v_target.signature;
    END IF;
    v_acl := coalesce(v_fn.proacl, acldefault('f',v_fn.proowner));
    -- Preserve effective execution AND grant options, including authority
    -- inherited through a grant that the named closure below removes.
    FOREACH v_role IN ARRAY ARRAY['app_tenant','service_role'] LOOP
      v_effective := has_function_privilege(v_role,v_fn.oid,'EXECUTE');
      v_grantable := has_function_privilege(v_role,v_fn.oid,'EXECUTE WITH GRANT OPTION');
      SELECT coalesce(bool_or(true),false),coalesce(bool_or(a.is_grantable),false)
        INTO v_named,v_named_grantable FROM aclexplode(v_acl) a
       WHERE a.grantee=v_role::regrole::oid AND a.privilege_type='EXECUTE';
      IF v_effective AND NOT v_named THEN
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO %I%s',v_target.signature,v_role,
          CASE WHEN v_grantable THEN ' WITH GRANT OPTION' ELSE '' END);
        INSERT INTO public.migration_privilege_journal(migration,object_signature,grantee,privilege,action,object_oid,object_owner,object_definition_hash)
          VALUES('309',v_target.signature,v_role,'EXECUTE','granted',v_fn.oid,v_fn.proowner,v_definition_hash) ON CONFLICT DO NOTHING;
      ELSIF v_grantable AND NOT v_named_grantable THEN
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO %I WITH GRANT OPTION',v_target.signature,v_role);
        INSERT INTO public.migration_privilege_journal(migration,object_signature,grantee,privilege,action,object_oid,object_owner,object_definition_hash)
          VALUES('309',v_target.signature,v_role,'GRANT OPTION FOR EXECUTE','granted',v_fn.oid,v_fn.proowner,v_definition_hash) ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
    SELECT EXISTS(SELECT 1 FROM aclexplode(v_acl) a WHERE a.grantee=0 AND a.privilege_type='EXECUTE') INTO v_public;
    IF v_public THEN
      INSERT INTO public.migration_privilege_journal(migration,object_signature,grantee,privilege,action,object_oid,object_owner,object_definition_hash)
        VALUES('309',v_target.signature,'PUBLIC','EXECUTE','revoked',v_fn.oid,v_fn.proowner,v_definition_hash) ON CONFLICT DO NOTHING;
    END IF;
    FOREACH v_role IN ARRAY ARRAY['anon','authenticated'] LOOP
      FOR v_entry IN SELECT a.is_grantable
        FROM aclexplode(v_acl) a WHERE a.grantee=v_role::regrole::oid AND a.privilege_type='EXECUTE'
      LOOP
        INSERT INTO public.migration_privilege_journal(migration,object_signature,grantee,privilege,action,object_oid,object_owner,object_definition_hash)
          VALUES('309',v_target.signature,v_role,
            CASE WHEN v_entry.is_grantable THEN 'EXECUTE WITH GRANT OPTION' ELSE 'EXECUTE' END,'revoked',v_fn.oid,v_fn.proowner,v_definition_hash) ON CONFLICT DO NOTHING;
      END LOOP;
    END LOOP;
  END LOOP;
END;
$closure_309$;

-- Explicit typed closures are the source tripwire, not a broad dynamic exception.
REVOKE ALL ON FUNCTION public.allocate_ad_campaign_budget(uuid,uuid,bigint,text,text,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assign_marketplace_listing_reviewer(uuid,uuid,uuid,uuid,text,text,integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bind_hosted_checkout_buyer(uuid,uuid,text,text,uuid,integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bind_marketplace_order_category_snapshot() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.capture_channel_offer_price_observations(uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.capture_listing_offer_price_observation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.capture_payout_statement_source_ledger_lineage() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.capture_product_price_observation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.capture_removed_marketplace_offer_price_observation(uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.capture_site_offer_price_observations() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.channel_listing_review_revision_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.channel_listing_reviewer_assignment_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_marketplace_listing_review(uuid,uuid,uuid,text,text,integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_payout_statement_release(uuid,uuid,text,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.collect_cod_order_with_lock(uuid,uuid,bigint,text,text,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_storefront_web_onboarding_draft(uuid,uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.confirm_customer_password_reset(uuid,text,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.consume_buyer_email_challenge(uuid,text,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.consume_internal_auth_replay_jti(text,text,integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_checkout_order_for_buyer(uuid,integer,uuid,text,text,text,jsonb,jsonb,text,text,text,text,text,text,uuid,text,uuid,numeric,text,jsonb,bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_marketplace_checkout_order(uuid,text,text,text,jsonb,jsonb,text,text,text,text,text,text,uuid,text,uuid,numeric,text,jsonb,uuid,integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_marketplace_checkout_order_with_delivery_rate(uuid,text,text,text,jsonb,jsonb,text,text,text,text,text,text,uuid,text,uuid,numeric,text,jsonb,uuid,integer,numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_payout_statement_with_effects(uuid,text,text,text,text,bigint,bigint,bigint,bigint,date,date,date,text,uuid[],uuid,jsonb,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_settlement_payout_with_effects(uuid,uuid,bigint,date,uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_storefront_checkout_order_with_delivery_rate(uuid,text,text,text,jsonb,jsonb,text,text,text,text,text,text,uuid,text,uuid,numeric,text,jsonb,uuid,integer,numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ensure_canonical_money_wallet_projection(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.execute_operator_support_mutation(uuid,text,text,uuid,text,jsonb,text[],integer,integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finalize_ad_credit_purchase(uuid,uuid,text,text,text,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finalize_manual_payment_refund_attempt(uuid,uuid,text,bigint,text,text,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finalize_payout_statement_release_with_effects(uuid,uuid,text,text,timestamp with time zone,text,text,text,uuid,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.invalidate_marketplace_listing_review(uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.invalidate_review_after_listing_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.invalidate_review_after_option_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.invalidate_review_after_product_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.invalidate_review_after_variant_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.issue_buyer_authorization_code(uuid,text,text,uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.link_buyer_firebase_uid(uuid,text,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.link_support_trust_safety_case(uuid,uuid,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.load_owned_payment_session(uuid,uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.marketplace_feed(text,text,integer,timestamp with time zone,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.marketplace_feed(text,text,integer,timestamp with time zone,uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.marketplace_listing_review_fingerprint(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.marketplace_listing_review_snapshot(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.marketplace_order_item_listing_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.marketplace_origins() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.marketplace_sponsored_products(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.open_buyer_support_ticket_with_complaint(text,timestamp with time zone,timestamp with time zone,uuid,uuid,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.post_ledger_transaction(uuid,text,text,text,text,jsonb,jsonb,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.post_settlement_ledger_transaction(uuid,text,text,text,jsonb,jsonb,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prevent_checkout_order_item_snapshot_update() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.product_price_reference_window(uuid[],timestamp with time zone,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reconcile_cod_remittance_with_ledger_checked(uuid,uuid,bigint,text,text,uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reconcile_payment_refund_attempt(uuid,uuid,text,text,text,text,bigint,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_ad_credit_purchase(uuid,bigint,text,text,text,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_ad_spend(uuid,uuid,text,integer,text,text,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_payout_statement_source_ledger_lineage(uuid,uuid,jsonb,timestamp with time zone) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.redeem_buyer_authorization_code(text,text,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_ad_campaign_budget(uuid,uuid,bigint,text,text,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reply_to_support_ticket(uuid,uuid,text,text,text,text,uuid,jsonb,jsonb,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reserve_payment_refund_attempt(uuid,bigint,text,text,uuid,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.resolve_money_ledger_source_site_id(text,text,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.resolve_payment_for_refund_provider_event(text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.resubmit_rejected_marketplace_listing(uuid,uuid,uuid,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.revoke_buyer_sessions(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_storefront_web_onboarding_draft(uuid,integer,text,text,text,text[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.start_buyer_email_challenge(uuid,text) FROM PUBLIC, anon, authenticated;

DO $closure_309_verify$
DECLARE v_open text;
BEGIN
  SELECT string_agg(p.oid::regprocedure::text,', ' ORDER BY p.oid::regprocedure::text) INTO v_open
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.prosecdef
     AND (has_function_privilege('anon',p.oid,'EXECUTE') OR has_function_privilege('authenticated',p.oid,'EXECUTE'))
     AND NOT EXISTS(SELECT 1 FROM pg_policy pol WHERE
       (coalesce(pg_get_expr(pol.polqual,pol.polrelid),'') || ' ' ||
        coalesce(pg_get_expr(pol.polwithcheck,pol.polrelid),'')) ~ ('\m' || p.proname || '\s*\('));
  IF v_open IS NOT NULL THEN RAISE EXCEPTION '309: direct Data API definer access remains: %',v_open; END IF;
END;
$closure_309_verify$;

NOTIFY pgrst, 'reload schema';
COMMIT;
