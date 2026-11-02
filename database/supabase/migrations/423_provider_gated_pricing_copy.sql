-- Keep the public plan matrix truthful while KYC and payout providers are unbound.
-- This changes display text only; plan entitlements and billing are unchanged.
BEGIN;

WITH updated AS (
  SELECT p.id,
         jsonb_agg(
           CASE WHEN category.value->>'category' IN ('Payments', 'Security') THEN
             jsonb_set(
               category.value, '{items}',
               (SELECT jsonb_agg(
                         CASE
                           WHEN item.value->>'label' = 'Wallet & payouts'
                             AND item.value->>'description' = 'Track your balance and settlements.' THEN
                             item.value || '{"label":"Payment records","description":"View order payment records; provider statements show actual settlements, fees, refunds and holds."}'::jsonb
                           WHEN item.value->>'label' = 'KYC verification'
                             AND item.value->>'description' = 'Verify your business to receive payouts.' THEN
                             item.value || '{"label":"Private KYC document upload","description":"Secure storage and provider onboarding are required before this feature opens.","launch":"In setup","growth":"In setup","scale":"In setup","commerce_os":"In setup"}'::jsonb
                           ELSE item.value
                         END ORDER BY item.position)
                  FROM jsonb_array_elements(category.value->'items') WITH ORDINALITY AS item(value, position))
             )
           ELSE category.value
           END ORDER BY category.position
         ) AS compare_features
  FROM public.plans AS p
  CROSS JOIN LATERAL jsonb_array_elements(p.compare_features) WITH ORDINALITY AS category(value, position)
  WHERE p.site_type = 'store'
    AND jsonb_typeof(p.compare_features) = 'array'
  GROUP BY p.id
)
UPDATE public.plans AS p
   SET compare_features = updated.compare_features,
       updated_at = now()
  FROM updated
 WHERE p.id = updated.id
   AND p.compare_features IS DISTINCT FROM updated.compare_features;

COMMIT;
