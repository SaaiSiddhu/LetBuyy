-- Rollback for 178_v1_pricing_plans_seed.sql
-- Removes the seeded V1 plans, entitlements, program singleton, and baseline
-- snapshots. SAFE ONLY PRE-LAUNCH: deleting the program row discards live slot
-- counters; deleting plans referenced by existing subscriptions may orphan plan_id.

DELETE FROM public.pricing_snapshots WHERE reason = 'baseline_v1' AND plan_slug IN ('launch','growth');
DELETE FROM public.founding_merchant_program WHERE program_key = 'v1';
DELETE FROM public.plan_entitlements WHERE site_type = 'store' AND plan_slug IN ('launch','growth');
DELETE FROM public.plans WHERE site_type = 'store' AND slug IN ('launch','growth','scale','commerce_os');
