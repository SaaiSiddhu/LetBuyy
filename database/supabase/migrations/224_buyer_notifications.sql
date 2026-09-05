-- 224: the marketplace buyer notification inbox (CAP-FB-NOTIF, under D-9).
--
-- FB-2 measured `notifications` as the single largest Firestore gap in customer_app -- 28 references
-- -- with no canonical owner. This is that owner.
--
-- ============================================================================
-- WHY A SEPARATE TABLE AND NOT A REALM COLUMN ON public.notifications
-- ============================================================================
-- public.notifications is the MERCHANT inbox, and that is measured rather than assumed: its user_id
-- is a users_custom id, and its own type CHECK lists merchant events (app_installed, theme_purchased,
-- plan_upgraded, store_published). Nothing in the gateway's notifications router reads a customer or
-- buyer session.
--
-- Adding a realm column there would put ids from two different realms in one user_id column with
-- nothing structural telling them apart. A query that forgot the realm filter would address the wrong
-- person's inbox and NOTHING WOULD FAIL -- no type error, no constraint violation, no empty result to
-- notice. It would also force one type vocabulary to serve two audiences, so every buyer event would
-- widen a CHECK the merchant inbox has to keep honouring.
--
-- A separate table makes that mistake impossible instead of merely discouraged, and gives the FK the
-- database can actually enforce: buyer_account_id REFERENCES buyer_accounts(id).
--
-- ============================================================================
-- TENANCY
-- ============================================================================
-- A buyer notification belongs to a BUYER, not a store, so like buyer_accounts this table carries no
-- site_id and is deliberately absent from the tenant registry. `origin_site_id` is nullable
-- provenance -- which seller's event produced it -- and is named to match migration 219's precedent
-- so the registry generator, which matches the exact names site_id/store_id, keeps this table out.
-- It is NOT a tenancy boundary and must never be used as one: a merchant must not be able to read a
-- buyer's inbox, not even the entries their own store caused.
--
-- Rollback: database/supabase/rollback/224_buyer_notifications.rollback.sql

BEGIN;

CREATE TABLE IF NOT EXISTS public.buyer_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_account_id uuid NOT NULL REFERENCES public.buyer_accounts(id) ON DELETE CASCADE,
  -- Provenance only. See the tenancy note above: never a boundary.
  origin_site_id uuid NULL REFERENCES public.sites(id) ON DELETE SET NULL,
  type text NOT NULL,
  title text NOT NULL,
  body text NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  action_url text NULL,
  read_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- A BUYER vocabulary, independent of the merchant one. Deliberately small: an event type nothing
  -- emits is a promise the product has not made.
  CONSTRAINT buyer_notifications_type_check CHECK (type IN (
    'order_placed',
    'order_shipped',
    'order_delivered',
    'order_cancelled',
    'refund_issued',
    'listing_back_in_stock',
    'system'
  ))
);

-- The inbox query: one buyer's notifications, newest first.
CREATE INDEX IF NOT EXISTS buyer_notifications_inbox_idx
  ON public.buyer_notifications (buyer_account_id, created_at DESC);

-- The unread badge. Partial, because the badge only ever counts unread rows and a full index would
-- grow with every read notification forever.
CREATE INDEX IF NOT EXISTS buyer_notifications_unread_idx
  ON public.buyer_notifications (buyer_account_id)
  WHERE read_at IS NULL;

ALTER TABLE public.buyer_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buyer_notifications FORCE ROW LEVEL SECURITY;

-- The ONLY policy, matching buyer_accounts. There is deliberately no merchant-realm policy: a
-- merchant must not read a buyer's inbox, including entries their own store caused. The gateway
-- scopes every read to the buyer id from a VERIFIED session, never a request parameter.
DROP POLICY IF EXISTS service_role_buyer_notifications ON public.buyer_notifications;
CREATE POLICY service_role_buyer_notifications ON public.buyer_notifications
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Revoked, not merely unpolicied -- so a later permissive policy cannot open it by accident.
REVOKE ALL ON public.buyer_notifications FROM app_tenant, authenticated, anon;
-- Granted explicitly rather than inherited from Supabase's hosted default privileges, which are not
-- present locally. BUYER-1 found that omission the hard way: without this the platform path is dead
-- on arrival and unverifiable anywhere this programme can run a database (D-11).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.buyer_notifications TO service_role;

COMMIT;
