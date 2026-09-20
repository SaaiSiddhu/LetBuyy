# CANARY EXECUTION PACKET (L15)

**Date:** 2026-06-13 · **HEAD:** `77b681f1` · Repository truth. Canary stays OFF by default.

## Mechanism (already built — repo-side)
- **Per-store flag:** `resolveThemeLiquidRenderingEnabled` (`theme-governance.ts:144-168`) reads `template_config.liquidRenderingCanary` (also theme/release/renderer manifests). Default `false` (`THEME_LIQUID_RENDERING_DEFAULT_ENABLED=false`), platform flip `deferred`.
- **Render switch:** `template-resolver.ts:229-233` — Liquid only when `liquidEnabled` (canary) is true AND `resolveLiquidBundle(store)` returns a bundle. The store's `template_config.liquidBundle` is carried by migration 172 / install.
- **Instant rollback:** set the store's `liquidRenderingCanary` back to `false` → next render is React. No deploy, no data change.

## Operator runbook (run when a deployed env exists — `HR-LIQUID-CANARY-DEPLOY`)
```sql
-- Enable Liquid for ONE canary store (staging first). The store must already carry template_config.liquidBundle
-- (from theme install or migration 172). This only flips the per-store flag; production stores are untouched.
UPDATE public.sites
SET template_config = COALESCE(template_config,'{}'::jsonb) || jsonb_build_object('liquidRenderingCanary', true),
    updated_at = NOW()
WHERE subdomain = '<canary-store-subdomain>';
-- ROLLBACK (instant): jsonb_build_object('liquidRenderingCanary', false)
```

## Monitor (collect into `CANARY_VALIDATION_REPORT.md`)
| Signal | Source |
|---|---|
| Render errors | storefront logs / `result.warnings` from the renderer |
| Hydration errors | island console errors (`lb-add-to-cart`/`lb-cart-drawer`/`lb-search`/`lb-variant-picker`) |
| Checkout handoff | `/cart/:token/checkout-url` signed-handoff success rate |
| Cart behavior | add → cart page → qty → remove over shared `lb_cart` |
| Customer behavior | account/login session (HS256) |
| Search behavior | `?search=` results |
| Theme behavior | styled render (`:root` tokens + `lb-*`) |

**Rollback validation:** flip the flag off mid-canary, confirm the store reverts to React within one render cycle; record the trace.

**Exit:** canary metrics clean + rollback proven → L16. **Not satisfiable in-sandbox** (no deployed env/traffic).
