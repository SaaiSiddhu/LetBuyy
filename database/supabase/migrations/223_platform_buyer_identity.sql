-- 223: the platform buyer identity (D-8, OWNER_DECISION 2026-09-05).
--
-- The marketplace had no buyer account. store_customers is UNIQUE (store_id, email) and
-- customer_credentials is UNIQUE (store_id, email_or_phone) -- the customer realm is PER STORE, so
-- the same person shopping two sellers was two unrelated rows with two separate passwords, and no id
-- spanned them. users_custom is platform-level but is the merchant/operator realm, which ART-05 and
-- SEC-R7 keep strictly separate from buyers. Phase FB-3 stopped on exactly this and the owner chose a
-- platform buyer realm.
--
-- This migration is the DATA MODEL ONLY. Issuance (identity-platform, asymmetric EdDSA/ES256,
-- realm 'buyer', mirroring createIdentityIssuedMerchantSessionToken) and the gateway verifier are
-- later slices. Nothing here grants a login.
--
-- ============================================================================
-- THE INVERSE TENANCY RULE -- read this before adding a policy to either table
-- ============================================================================
-- Every other table in this schema is scoped to site_id, and the reflex when adding RLS is "scope it
-- to the tenant". That reflex is EXACTLY WRONG here and would be a serious leak.
--
-- buyer_accounts holds ONE ROW PER HUMAN, across all stores. It is cross-tenant by design. A tenant
-- role must never be able to read it: doing so would hand every merchant the platform's entire buyer
-- graph. So both tables here are service_role-only, ENABLE + FORCE RLS, with app_tenant explicitly
-- REVOKED -- not merely unpolicied, revoked, so a future permissive policy cannot silently open them.
--
-- ============================================================================
-- WHY THE LINK IS A JOIN TABLE AND NOT A COLUMN ON store_customers
-- ============================================================================
-- The obvious shape is store_customers.buyer_account_id. It is rejected on privacy grounds, and the
-- reason is not theoretical: store_customers is readable by its owning merchant under existing
-- site-scoped RLS, and a buyer account id is a STABLE CROSS-STORE IDENTIFIER. Two merchants comparing
-- their own customer lists could then establish that the same person shops at both -- cross-merchant
-- tracking no buyer consented to. Nothing in the tenancy model forbids a merchant reading their own
-- customer's columns, so that leak would have shipped silently and looked correct.
--
-- The link therefore lives in buyer_store_customers, which tenant roles cannot read at all. The
-- correlation is structurally impossible rather than merely discouraged, and store_customers is left
-- completely untouched, so no existing tenant query changes behaviour.
--
-- ============================================================================
-- WHY buyer_store_customers APPEARS IN THE TENANT REGISTRY AND IS STILL NOT TENANT-READABLE
-- ============================================================================
-- generate-tenant-table-registry.mjs derives TENANT_TABLES from schema, so buyer_store_customers is
-- listed there: it genuinely carries site_id. That entry is correct and harmless -- the registry's
-- only enforcement (rls-force-coverage-validator) is "a new tenant table must add FORCE ROW LEVEL
-- SECURITY in the same migration", which this migration does.
--
-- Do NOT read that entry as "this table should therefore be readable under a tenant context". It must
-- not be, and the REVOKE below is what stops it. buyer_accounts is correctly ABSENT from the registry
-- because it has no site_id at all. A contract test
-- (tests/contracts/platform-buyer-identity-isolation.test.ts) fails if the REVOKE is ever narrowed.
--
-- Rollback: database/supabase/rollback/223_platform_buyer_identity.rollback.sql

BEGIN;

-- One row per human. NO site_id column, deliberately -- see the inverse tenancy rule above.
CREATE TABLE IF NOT EXISTS public.buyer_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  password_hash text,
  email_verified boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT buyer_accounts_status_check CHECK (status IN ('active', 'disabled')),
  -- Stored normalized. A case-varying duplicate is a second account for the same person, which is
  -- how "I already have an account" turns into two carts and two order histories.
  CONSTRAINT buyer_accounts_email_normalized_check CHECK (email = lower(btrim(email)))
);

CREATE UNIQUE INDEX IF NOT EXISTS buyer_accounts_email_key
  ON public.buyer_accounts (email);

-- The platform-owned link. Tenant roles cannot read this table at all.
CREATE TABLE IF NOT EXISTS public.buyer_store_customers (
  buyer_account_id uuid NOT NULL REFERENCES public.buyer_accounts(id) ON DELETE CASCADE,
  store_customer_id uuid NOT NULL REFERENCES public.store_customers(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  linked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (buyer_account_id, store_customer_id)
);

-- A store_customers row belongs to at most ONE buyer account. Without this a second link would
-- silently move a person's order history onto another account.
CREATE UNIQUE INDEX IF NOT EXISTS buyer_store_customers_store_customer_key
  ON public.buyer_store_customers (store_customer_id);

-- One buyer has at most one customer record per store, which is what makes "my orders at this
-- seller" a single well-defined set.
CREATE UNIQUE INDEX IF NOT EXISTS buyer_store_customers_buyer_site_key
  ON public.buyer_store_customers (buyer_account_id, site_id);

CREATE INDEX IF NOT EXISTS buyer_store_customers_site_idx
  ON public.buyer_store_customers (site_id);

ALTER TABLE public.buyer_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buyer_accounts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.buyer_store_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buyer_store_customers FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages buyer accounts" ON public.buyer_accounts;
CREATE POLICY "Service role manages buyer accounts" ON public.buyer_accounts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role manages buyer store links" ON public.buyer_store_customers;
CREATE POLICY "Service role manages buyer store links" ON public.buyer_store_customers
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Revoked, not merely unpolicied. FORCE RLS with no matching policy already yields zero rows, but an
-- explicit REVOKE means a later permissive policy cannot open these tables to a tenant by accident.
REVOKE ALL ON public.buyer_accounts FROM app_tenant, authenticated, anon;
REVOKE ALL ON public.buyer_store_customers FROM app_tenant, authenticated, anon;

-- Granted EXPLICITLY rather than inherited. A policy grants no table privilege of its own: without
-- this, service_role is denied and the platform path is dead on arrival. Every other table here
-- reaches service_role through Supabase's project-level default privileges, which are part of the
-- hosted bootstrap and are NOT present in a local container -- so relying on them means the platform
-- path cannot be verified anywhere this programme can actually run a database (D-11). Being explicit
-- costs two lines and makes the intent testable. Found by probing as service_role and getting
-- 'permission denied'; users_custom shows the identical gap, which is why the reliance was invisible.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.buyer_accounts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.buyer_store_customers TO service_role;

COMMIT;
