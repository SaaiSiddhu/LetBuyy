-- Rollback for 176_v1_founding_program_schema.sql
-- Drops the founding tables + additive columns and restores the original
-- subscriptions.plan CHECK. SAFE ONLY PRE-LAUNCH: if any subscription already uses a
-- V1 slug (launch/growth/scale/commerce_os) the restored CHECK will fail — migrate
-- those rows first. Dropping the founding tables/columns discards any allocation data.

ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_plan_check;
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_plan_check
    CHECK (plan IN ('free','starter','business','enterprise'));

ALTER TABLE public.plans DROP CONSTRAINT IF EXISTS plans_status_check;
ALTER TABLE public.plans DROP COLUMN IF EXISTS status;
ALTER TABLE public.plans DROP COLUMN IF EXISTS purchasable;
ALTER TABLE public.plans DROP COLUMN IF EXISTS founding_price_inr;

ALTER TABLE public.sites DROP CONSTRAINT IF EXISTS sites_allocation_source_check;
ALTER TABLE public.sites DROP CONSTRAINT IF EXISTS sites_intended_allocation_source_check;
ALTER TABLE public.sites DROP COLUMN IF EXISTS is_founding_merchant;
ALTER TABLE public.sites DROP COLUMN IF EXISTS founding_number;
ALTER TABLE public.sites DROP COLUMN IF EXISTS founding_allocated_at;
ALTER TABLE public.sites DROP COLUMN IF EXISTS price_lock_enabled;
ALTER TABLE public.sites DROP COLUMN IF EXISTS locked_launch_price;
ALTER TABLE public.sites DROP COLUMN IF EXISTS locked_growth_price;
ALTER TABLE public.sites DROP COLUMN IF EXISTS allocation_source;
ALTER TABLE public.sites DROP COLUMN IF EXISTS intended_allocation_source;

DROP TABLE IF EXISTS public.pricing_snapshots;
DROP TABLE IF EXISTS public.founding_merchant_allocations;
DROP TABLE IF EXISTS public.founding_merchant_program;
