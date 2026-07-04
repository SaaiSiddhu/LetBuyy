-- 176_v1_founding_program_schema.sql
-- V1 Commercial Launch — Founding Merchant Program schema (additive, idempotent).
--
-- Extends the existing canonical billing spine (plans + subscriptions + sites) with:
--   * founding_merchant_program     — program-config singleton + slot counters
--   * founding_merchant_allocations — one row per founding merchant (the ledger)
--   * pricing_snapshots             — immutable price-change audit (append-only)
-- Plus additive founding columns on sites, catalog columns on plans
-- (status/purchasable/founding_price_inr), and an expanded subscriptions.plan CHECK
-- accepting the V1 slugs (launch/growth/scale/commerce_os) while preserving the
-- legacy values (free/starter/business/enterprise).
--
-- These are NOT money-ledger tables (canonical-ledger-only-validator governs only
-- payments/payouts/refunds/settlements/wallet/gift-card/ai_credits) — founding
-- allocation never posts to the canonical money ledger. All allocation/price-lock
-- business logic lives in SECURITY DEFINER RPCs (177). Seed data is in 178.
--
-- remaining_slots is a GENERATED column (total_slots - used_slots) so it can never
-- drift. Pool sub-counters are CHECK-bounded; the global cap is enforced by
-- (used_slots <= total_slots) AND the FOR UPDATE lock in allocate_founding_merchant.
--
-- Canonical allocation eligibility: docs/v1/FOUNDING_ALLOCATION_DEFINITION.md.

-- ============================================================================
-- 1) Program config (singleton, program_key = 'v1')
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.founding_merchant_program (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    program_key text NOT NULL UNIQUE DEFAULT 'v1',
    total_slots integer NOT NULL DEFAULT 100 CHECK (total_slots >= 0),
    public_slots integer NOT NULL DEFAULT 70 CHECK (public_slots >= 0),
    invited_slots integer NOT NULL DEFAULT 20 CHECK (invited_slots >= 0),
    partner_slots integer NOT NULL DEFAULT 10 CHECK (partner_slots >= 0),
    used_slots integer NOT NULL DEFAULT 0 CHECK (used_slots >= 0),
    public_used integer NOT NULL DEFAULT 0 CHECK (public_used >= 0),
    invited_used integer NOT NULL DEFAULT 0 CHECK (invited_used >= 0),
    partner_used integer NOT NULL DEFAULT 0 CHECK (partner_used >= 0),
    remaining_slots integer GENERATED ALWAYS AS (total_slots - used_slots) STORED,
    launch_price integer NOT NULL DEFAULT 19900 CHECK (launch_price >= 0),   -- INR minor (paise): ₹199
    growth_price integer NOT NULL DEFAULT 69900 CHECK (growth_price >= 0),   -- INR minor (paise): ₹699
    active boolean NOT NULL DEFAULT true,
    paused boolean NOT NULL DEFAULT false,
    paused_reason text,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    actor_type text NOT NULL DEFAULT 'system' CHECK (actor_type IN ('system','worker','super_admin')),
    actor_id uuid,
    request_id text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    created_by uuid,
    updated_by uuid,
    deleted_by uuid,
    version integer NOT NULL DEFAULT 1,
    CONSTRAINT founding_program_used_within_total CHECK (used_slots <= total_slots),
    CONSTRAINT founding_program_public_used_within CHECK (public_used <= public_slots),
    CONSTRAINT founding_program_invited_used_within CHECK (invited_used <= invited_slots),
    CONSTRAINT founding_program_partner_used_within CHECK (partner_used <= partner_slots)
);

-- ============================================================================
-- 2) Allocation ledger (one row per founding merchant; site_id is the idempotency anchor)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.founding_merchant_allocations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    program_key text NOT NULL DEFAULT 'v1',
    site_id uuid NOT NULL REFERENCES public.sites(id),
    founding_number integer NOT NULL CHECK (founding_number >= 1),
    allocation_source text NOT NULL CHECK (allocation_source IN ('PUBLIC','INVITED','PARTNER')),
    subscription_id uuid,
    plan_slug text NOT NULL CHECK (plan_slug IN ('launch','growth')),
    locked_launch_price integer NOT NULL CHECK (locked_launch_price >= 0),
    locked_growth_price integer NOT NULL CHECK (locked_growth_price >= 0),
    locked_monthly_price integer NOT NULL CHECK (locked_monthly_price >= 0),
    benefits jsonb NOT NULL DEFAULT jsonb_build_object(
        'price_lock', true, 'badge', true, 'priority_support', true,
        'early_access', true, 'feature_preview', true
    ),
    allocated_at timestamptz NOT NULL DEFAULT now(),
    released_at timestamptz,
    release_reason text,
    founding_released boolean NOT NULL DEFAULT false,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    actor_type text NOT NULL DEFAULT 'system' CHECK (actor_type IN ('system','worker','super_admin')),
    actor_id uuid,
    request_id text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid,
    updated_by uuid,
    CONSTRAINT founding_allocations_number_unique UNIQUE (founding_number)
);

-- At most ONE active (un-released) allocation per site. A reclaimed row keeps its
-- history (released_at set) and does not block a future re-allocation of the same
-- site. founding_number stays globally unique (monotonic join-order badge; gaps from
-- reclaims are preserved).
CREATE UNIQUE INDEX IF NOT EXISTS founding_alloc_active_site_unique
    ON public.founding_merchant_allocations (site_id) WHERE released_at IS NULL;

-- Traceability indexes: founding_number -> allocation -> site -> subscription -> events.
CREATE INDEX IF NOT EXISTS idx_founding_alloc_site ON public.founding_merchant_allocations (site_id);
CREATE INDEX IF NOT EXISTS idx_founding_alloc_number ON public.founding_merchant_allocations (founding_number);
CREATE INDEX IF NOT EXISTS idx_founding_alloc_subscription ON public.founding_merchant_allocations (subscription_id);
CREATE INDEX IF NOT EXISTS idx_founding_alloc_allocated_at ON public.founding_merchant_allocations (allocated_at DESC);
CREATE INDEX IF NOT EXISTS idx_founding_alloc_released_at ON public.founding_merchant_allocations (released_at);
CREATE INDEX IF NOT EXISTS idx_founding_alloc_active_source
    ON public.founding_merchant_allocations (allocation_source)
    WHERE released_at IS NULL;

-- ============================================================================
-- 3) Pricing snapshots (immutable, append-only audit of catalog/founding prices)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.pricing_snapshots (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_slug text NOT NULL,
    site_type text NOT NULL DEFAULT 'store',
    price_monthly_inr integer NOT NULL CHECK (price_monthly_inr >= 0),
    founding_price_inr integer NOT NULL DEFAULT 0 CHECK (founding_price_inr >= 0),
    reason text NOT NULL DEFAULT 'baseline',
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    captured_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid
);
CREATE INDEX IF NOT EXISTS idx_pricing_snapshots_plan ON public.pricing_snapshots (plan_slug, captured_at DESC);

-- ============================================================================
-- 4) updated_at triggers (reuse canonical helper)
-- ============================================================================
DROP TRIGGER IF EXISTS update_founding_merchant_program_updated_at ON public.founding_merchant_program;
CREATE TRIGGER update_founding_merchant_program_updated_at
    BEFORE UPDATE ON public.founding_merchant_program
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_founding_merchant_allocations_updated_at ON public.founding_merchant_allocations;
CREATE TRIGGER update_founding_merchant_allocations_updated_at
    BEFORE UPDATE ON public.founding_merchant_allocations
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================================
-- 5) RLS — forced. Writes via service_role (gateway) or SECURITY DEFINER RPCs only.
--    Public counts are exposed ONLY through get_founding_program_public() (DEFINER).
--    Merchants read their own allocation through the gateway (service_role, scoped by
--    verified site ownership) — no broad tenant SELECT policy needed.
-- ============================================================================
ALTER TABLE public.founding_merchant_program ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.founding_merchant_program FORCE ROW LEVEL SECURITY;
ALTER TABLE public.founding_merchant_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.founding_merchant_allocations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_snapshots FORCE ROW LEVEL SECURITY;

CREATE POLICY founding_program_service_role_all ON public.founding_merchant_program
    FOR ALL TO service_role USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY founding_program_super_admin_read ON public.founding_merchant_program
    FOR SELECT TO authenticated USING (public.is_super_admin());

CREATE POLICY founding_allocations_service_role_all ON public.founding_merchant_allocations
    FOR ALL TO service_role USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY founding_allocations_super_admin_read ON public.founding_merchant_allocations
    FOR SELECT TO authenticated USING (public.is_super_admin());

-- pricing_snapshots is append-only: service_role may INSERT + SELECT (no UPDATE/DELETE policy).
CREATE POLICY pricing_snapshots_service_role_insert ON public.pricing_snapshots
    FOR INSERT TO service_role WITH CHECK (auth.role() = 'service_role');
CREATE POLICY pricing_snapshots_service_role_read ON public.pricing_snapshots
    FOR SELECT TO service_role USING (auth.role() = 'service_role');
CREATE POLICY pricing_snapshots_super_admin_read ON public.pricing_snapshots
    FOR SELECT TO authenticated USING (public.is_super_admin());

-- ============================================================================
-- 6) sites — additive founding columns (lock lives on the tenant, survives lifecycle)
-- ============================================================================
ALTER TABLE public.sites
    ADD COLUMN IF NOT EXISTS is_founding_merchant boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS founding_number integer,
    ADD COLUMN IF NOT EXISTS founding_allocated_at timestamptz,
    ADD COLUMN IF NOT EXISTS price_lock_enabled boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS locked_launch_price integer,
    ADD COLUMN IF NOT EXISTS locked_growth_price integer,
    ADD COLUMN IF NOT EXISTS allocation_source text,
    ADD COLUMN IF NOT EXISTS intended_allocation_source text;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sites_allocation_source_check') THEN
        ALTER TABLE public.sites ADD CONSTRAINT sites_allocation_source_check
            CHECK (allocation_source IS NULL OR allocation_source IN ('PUBLIC','INVITED','PARTNER'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sites_intended_allocation_source_check') THEN
        ALTER TABLE public.sites ADD CONSTRAINT sites_intended_allocation_source_check
            CHECK (intended_allocation_source IS NULL OR intended_allocation_source IN ('PUBLIC','INVITED','PARTNER'));
    END IF;
END $$;

-- ============================================================================
-- 7) plans — additive catalog columns for V1 (status / purchasable / founding price)
-- ============================================================================
ALTER TABLE public.plans
    ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'available',
    ADD COLUMN IF NOT EXISTS purchasable boolean NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS founding_price_inr integer NOT NULL DEFAULT 0;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'plans_status_check') THEN
        ALTER TABLE public.plans ADD CONSTRAINT plans_status_check
            CHECK (status IN ('available','coming_soon','retired'));
    END IF;
END $$;

-- ============================================================================
-- 8) subscriptions.plan — expand CHECK for V1 slugs, preserve legacy values
-- ============================================================================
ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_plan_check;
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_plan_check
    CHECK (plan IN ('free','starter','business','enterprise','launch','growth','scale','commerce_os'));
