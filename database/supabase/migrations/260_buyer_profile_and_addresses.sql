-- 260: the canonical buyer profile fields (D1) and buyer address book (D2), SUSTAINED-J Phase 2.
--
-- Both extend the ONE buyer principal established by 223 (buyer_accounts, D-ONE-BUYER) -- never a
-- second buyer-account or session model, and never store_customers/customer_addresses, which stay
-- exactly what they already are: a per-store merchant relationship (D-ONE-BUYER's own words) with
-- its own already-complete profile/address UI in apps/commerce/web's /api/customer/* family. This
-- migration adds the CROSS-STORE counterpart D1/D2 ask for, shared by apps/commerce/web's own
-- account surfaces and apps/marketplace/mobile, never conflated with the per-store one.
--
-- D1 -- full_name, phone. NOT email (email identifies the account and changing it is a verified-
-- ownership operation the existing 257 email-challenge family already owns) and NOT password
-- (identity-platform's domain, per buyer-account-routes.ts's own file header). Both nullable: a
-- buyer authenticates with only email+password today, so no migration backfill has a source value
-- for either. No phone_verified column: no phone verification mechanism (OTP/SMS) exists anywhere
-- in the buyer realm to back one, and a column that claims verification with nothing enforcing it
-- would be worse than no column -- OPEN_FOUNDER_DECISION, not invented here. phone is stored as an
-- unverified contact field, exactly as honest as that is.
BEGIN;

ALTER TABLE public.buyer_accounts
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS phone text;

-- D2 -- buyer_addresses. Same field shape and the same three CHECK constraints as
-- public.customer_addresses (000_baseline.sql) -- deliberately reused, not reinvented, so the two
-- address books stay interchangeable in shape even though they are deliberately separate tables.
-- Keyed by buyer_account_id, NOT store_id/customer_email: this is the ONE buyer's address book,
-- shared across every store and the marketplace, which is the entire reason D2 exists. Ownership
-- of a store-placed order's own delivery/contact snapshot is untouched by this table and this
-- migration -- orders.shipping_address (or equivalent) already carries its own point-in-time copy;
-- nothing here mutates a placed order when a buyer edits or deletes a saved address, by construction
-- (no foreign key from any order table to this one).
--
-- THE SAME INVERSE TENANCY RULE 223 ESTABLISHED. This table has NO site_id and is NOT a tenant
-- table: it holds one buyer's addresses across every store, and a tenant role reading it would hand
-- every merchant a channel to a buyer's saved addresses at every OTHER store. service_role-only,
-- ENABLE + FORCE RLS, app_tenant/authenticated/anon explicitly REVOKED -- not merely unpolicied.
CREATE TABLE IF NOT EXISTS public.buyer_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_account_id uuid NOT NULL REFERENCES public.buyer_accounts(id) ON DELETE CASCADE,
  label text DEFAULT 'home',
  full_name text NOT NULL,
  phone text,
  address_line1 text NOT NULL,
  address_line2 text,
  city text NOT NULL,
  state text NOT NULL,
  postal_code text NOT NULL,
  country text DEFAULT 'IN',
  landmark text,
  is_default boolean DEFAULT false,
  gstin text,
  state_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT buyer_addresses_gstin_format_check CHECK (gstin IS NULL OR gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'),
  CONSTRAINT buyer_addresses_label_check CHECK (label = ANY (ARRAY['home', 'work', 'other'])),
  CONSTRAINT buyer_addresses_state_code_check CHECK (state_code IS NULL OR state_code ~ '^(0[1-9]|[12][0-9]|3[0-8]|97)$')
);

CREATE INDEX IF NOT EXISTS buyer_addresses_buyer_account_idx
  ON public.buyer_addresses (buyer_account_id);

CREATE OR REPLACE FUNCTION public.update_buyer_addresses_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS buyer_addresses_set_updated_at ON public.buyer_addresses;
CREATE TRIGGER buyer_addresses_set_updated_at
  BEFORE UPDATE ON public.buyer_addresses
  FOR EACH ROW EXECUTE FUNCTION public.update_buyer_addresses_updated_at();

ALTER TABLE public.buyer_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buyer_addresses FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages buyer addresses" ON public.buyer_addresses;
CREATE POLICY "Service role manages buyer addresses" ON public.buyer_addresses
  FOR ALL TO service_role USING (true) WITH CHECK (true);

REVOKE ALL ON public.buyer_addresses FROM app_tenant, authenticated, anon;

-- Explicit, matching 223's own note: Supabase's hosted default privileges are not present in a
-- local container, so relying on them means this path cannot be verified anywhere this programme
-- can actually run a database.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.buyer_addresses TO service_role;

COMMIT;
