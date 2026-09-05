-- 229 — seller_follows: the buyer→seller follower graph (CAP-FB-SOCIAL, D-9).
--
-- Replaces System A's Firestore shape `seller_followers/{sellerId}/followers/{userId}`
-- (packages/dart/marketplace_services/lib/src/reel_service.dart). Two defects come across with it and
-- are fixed here rather than reproduced:
--
--   1. TWO SOURCES OF TRUTH FOR THE COUNT. reel_service both counts the subcollection
--      (`getFollowerCount`) and increments a denormalised counter on the `sellers` document on every
--      follow/unfollow. Those drift the moment one write lands and the other does not, and nothing
--      reconciles them. Here the count is a PROJECTION — `count(*)` over this table — and there is
--      deliberately NO follower_count column anywhere. If the count ever needs materialising, it must
--      be a maintained cache with a single writer, never a second authority.
--   2. A FOLLOW WAS A DOCUMENT WRITE. `.set()` on the same path overwrote, so a double-follow was
--      silently absorbed but so was any concurrent state. The PRIMARY KEY on (buyer_account_id,
--      site_id) makes a duplicate follow IMPOSSIBLE rather than absorbed, and lets follow be
--      idempotent by ON CONFLICT DO NOTHING instead of by luck.
--
-- Platform-owned, exactly like buyer_store_customers (223): the row spans a platform-level buyer
-- identity and one tenant, so it belongs to neither realm alone and must not be reachable by a tenant
-- role. It is NOT a tenant table and must not enter tenant-tables.registry.ts -- `site_id` here is a
-- REFERENCE to the followed seller, not the tenant boundary of the row.
--
-- Merchant-facing follower IDENTITIES are deliberately not exposed by this migration. A merchant
-- learning which platform buyer accounts follow them links a cross-store identity to one store, which
-- is a privacy decision to take on purpose, not a side effect of building a follow button.
--
-- Rollback: database/supabase/rollback/229_seller_follow_graph.rollback.sql

BEGIN;

CREATE TABLE IF NOT EXISTS public.seller_follows (
  buyer_account_id uuid NOT NULL REFERENCES public.buyer_accounts(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  followed_at timestamptz NOT NULL DEFAULT now(),
  -- The pair is the identity of a follow. A buyer either follows a seller or does not; there is no
  -- second row to disagree with the first.
  PRIMARY KEY (buyer_account_id, site_id)
);

-- The public follower count reads by site. The PK already serves "who do I follow" (buyer prefix).
CREATE INDEX IF NOT EXISTS seller_follows_site_idx ON public.seller_follows (site_id);

-- A buyer must not be able to follow a seller that is not publicly visible. A CHECK cannot reach
-- another table and a route guard is bypassable by any later writer, so the rule lives in a trigger:
-- it holds for every INSERT regardless of who makes it.
--
-- This governs CREATING a follow only. A site that is later unpublished keeps its existing rows —
-- deleting a buyer's follows because a merchant paused their store would destroy the buyer's data on
-- a merchant's action — so every READ path filters by current site status instead.
CREATE OR REPLACE FUNCTION public.enforce_followable_site()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.sites s
     WHERE s.id = NEW.site_id
       AND s.status = 'published'
       AND s.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'site % is not followable (must be a published, non-deleted site)', NEW.site_id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seller_follows_followable_site ON public.seller_follows;
CREATE TRIGGER trg_seller_follows_followable_site
  BEFORE INSERT ON public.seller_follows
  FOR EACH ROW EXECUTE FUNCTION public.enforce_followable_site();

ALTER TABLE public.seller_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_follows FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages seller follows" ON public.seller_follows;
CREATE POLICY "Service role manages seller follows" ON public.seller_follows
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Revoked, not merely unpolicied (223's reasoning): FORCE RLS with no matching policy already yields
-- zero rows, but an explicit REVOKE means a later permissive policy cannot open this to a tenant by
-- accident. A merchant reading the platform buyer ids of their followers would be a privacy change,
-- and it must not be possible to make it by adding a policy alone.
REVOKE ALL ON public.seller_follows FROM app_tenant, authenticated, anon;

-- Granted EXPLICITLY: a policy carries no table privilege, and Supabase's project-level default
-- privileges are part of the hosted bootstrap and absent from a local container, so relying on them
-- makes the platform path unverifiable anywhere this programme can run a database (D-11).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seller_follows TO service_role;

COMMIT;
