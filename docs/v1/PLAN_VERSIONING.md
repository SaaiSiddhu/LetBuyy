# Plan Versioning & Pricing History (V1)

> How LetBuyy evolves plan pricing without breaking historical reporting,
> active subscriptions, or founding price locks.

## Principles

1. **Append-only history.** Pricing changes never overwrite the record of what a
   plan cost in the past. Each commercial change appends a `pricing_snapshots`
   row (with a `reason`, e.g. `baseline_v1`, `recompete_v1`).
2. **Catalog edits are migrations.** The `plans` / `plan_entitlements` rows are
   updated only via sequential, additive Supabase migrations using
   `ON CONFLICT (site_type, slug) DO UPDATE`. The current state always reflects
   the latest migration; history is preserved in snapshots.
3. **Optimistic version.** `plans.version` guards concurrent catalog edits.
4. **Active subscriptions are unaffected.** Subscriptions store the price they were
   activated at; changing the catalog does not retro-bill existing merchants.
5. **Founding locks are permanent.** `founding_merchant_program` counters and
   per-merchant locked prices are never reset by a catalog migration
   (`ON CONFLICT DO NOTHING` on the program singleton).

## Tables

| Table | Role |
|---|---|
| `plans` | Current catalog state (latest values). |
| `plan_entitlements` | Current runtime grants per tier. |
| `pricing_snapshots` | Append-only proof of prices at each commercial change (`plan_slug`, `site_type`, `price_monthly_inr`, `founding_price_inr`, `reason`). |
| `founding_merchant_program` | Founding slots + locked launch/growth prices (never reset). |
| `subscriptions` | Per-store activation, including the price the merchant is on. |

## Reporting expectations

- Historical revenue/price reporting reads `pricing_snapshots` + `subscriptions`,
  never the live `plans` row alone.
- LCIS pricing/conversion intelligence must label live funnel/adoption values
  **CONNECTED / NOT CONNECTED** with an exact source — never inferred or fabricated.

## Making a pricing change (checklist)

1. New sequential migration: `ON CONFLICT DO UPDATE` the affected `plans` rows.
2. Append a `pricing_snapshots` row per changed plan with a descriptive `reason`.
3. Do **not** touch `founding_merchant_program` unless explicitly approved.
4. Regenerate LCIS (`pnpm graph:db && graph:domain` + intel scripts).
5. The compare matrix update is data-only (`plans.compare_features`) — no React change.
