# 02 — Backend / data fixes (fully verifiable, no UI guesswork)

Three confirmed-clean fixes the orchestrator executed directly (each verified against the real types via the integrated typecheck + contract tests).

## Shipping — rate-edit PATCH proxy (Shipping 75% → ~78%)
`api/stores/[store]/shipping/rates/[rateId]/route.ts` — added `PATCH` → `shipping.rates.update(rateId, body)`. The gateway `PATCH /shipping-tax/shipping/:id` + the api-client `rates.update` already existed; only this proxy verb was missing, so merchants could add/delete a rate but not edit one. Mirrors the file's existing DELETE + the zones `[zoneId]` PATCH. (The UI still hardcodes `type:'flat'` + needs an edit button — documented, UI/visual work.)

## Analytics — real `revenueByMonth` (Analytics 68% → ~72%, placeholder eliminated)
`api/stores/[store]/analytics/route.ts` — replaced the hardcoded `revenueByMonth: []` with a **real** aggregation: call `analytics.revenue({ store_id, period })`, bucket its daily rollup `chart` (`{ date:'YYYY-MM-DD', revenue }`, from `analytics_rollups_daily`) into months (`{ month:'Mon YYYY', revenue }`). **No fabrication** — stays empty (the page shows its honest empty state) until rollups populate; renders real data once orders flow. Matches the page's expected `Array<{ month; revenue }>` shape.

## Staff — `products:read` permission label (cosmetic)
`lib/staff/roles.ts` — added `{ key: 'products:read', label: 'View products' }` to `STAFF_PERMISSIONS`. The viewer role used the key but `permissionLabel()` returned the raw string. (RBAC **enforcement** remains the real Staff gap — chipped, security-sensitive, not blind-applied.)

## Verification
All covered by the integrated `tsc --noEmit` (EXIT 0) + `lb-merchant-admin` contract tests (shipping PATCH, analytics revenueByMonth-not-`[]`, staff label) + 177/177 launch + anti-fabrication PASS.
