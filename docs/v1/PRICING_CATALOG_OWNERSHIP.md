# Pricing Catalog Ownership (V1)

> Governance contract for LetBuyy plan/pricing content. Enforced by
> `scripts/validators/pricing-catalog-validator.mjs` (wired into the governance gate).

## Source of truth

The **`plans`** table (Supabase) is the single source of truth for all plan and
pricing content. Runtime entitlements live in **`plan_entitlements`**
(resolved by `resolve_site_entitlements`). Founding pricing/availability is owned
by the **Founding Merchant Program** (`founding_merchant_program` + RPCs) and is
read-only to the pricing experience.

Flow (one direction, no duplication):

```
plans  →  /v1/payments/plans (gateway, select *)  →  /api/plans (app proxy)
       →  lib/billing/plan-ui.ts (shared view model)
       →  Merchant Control Plane pricing page  AND  Marketing pricing page
```

## Catalog-owned fields (edit only via a migration)

| Field | Meaning |
|---|---|
| `price_monthly_inr`, `price_yearly_inr` | Tier pricing (INR **minor / paise**). |
| `founding_price_inr` | Lifetime founding price (Launch/Growth only). Display override. |
| `gmv_percentage` | Platform commission — **always 0** (see migration `162`). |
| `promo_price_inr`, `promo_months`, `promo_label` | Intro promo (currently unused / 0). |
| `ai_credits_monthly`, `storage_mb`, `staff_limit`, `products/orders/pages_limit` | Tier limits. |
| `features` (jsonb) | Plan-card bullet list. |
| `compare_features` (jsonb) | The full compare matrix — **authored once**, written to every plan. |
| `support_level`, `custom_domain`, `branding_removable`, `trial_days` | Tier capabilities. |
| `is_popular`, `display_order`, `status`, `purchasable`, `requires_contact` | Merchandising/state. |
| `razorpay_plan_id_monthly`, `razorpay_plan_id_yearly` | Billing wiring (ops/ARB-set; never fabricated). |

## Forbidden

- **No hardcoded plan content** (prices, feature bullets, compare rows, founding
  prices, support levels, limits) in the Merchant Control Plane, Marketing site,
  Checkout, or Billing UI. All such content originates from catalog data.
- **No duplicate matrices** between MCP and Marketing — both consume the same
  `plan-ui.ts` view model.
- **No non-zero `gmv_percentage`** — platform commission is a permanent 0%.

## Commerce OS positioning (must not regress)

Commerce OS is a **strategic operating system / intelligence layer**, not
"Scale Plus" or an "Enterprise Plan". It must always render in its **own category**
(separate from the Launch/Growth/Scale "Commerce Platform" group) on the picker and
the compare matrix.

## Founding positioning hierarchy

Order of emphasis on the pricing experience: **0% Commission Forever → platform
features → Growth recommendation → Commerce OS vision → Founding Merchant Program**
(a limited bonus, never the page hero).

## Changing the catalog

Add a new, sequential, additive Supabase migration (`ON CONFLICT DO UPDATE`).
Never overwrite pricing history — see [PLAN_VERSIONING.md](./PLAN_VERSIONING.md).
