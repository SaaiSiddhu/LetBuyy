-- 186_v1_scale_commerce_os_coming_soon.sql
-- Scale and Commerce OS are not yet open for purchase — mark as coming_soon.
-- Both the marketing pricing page and the merchant select-plan page check
-- status/purchasable to decide whether to render a CTA or "Coming soon".
-- Revert: set status = 'available', purchasable = true.

UPDATE public.plans
SET
    status      = 'coming_soon',
    purchasable = false,
    updated_at  = now()
WHERE site_type = 'store'
  AND slug IN ('scale', 'commerce_os');
