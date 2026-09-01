# LB-11 — Dead Surface Cleanup: Implementation Strategy

**Date:** 2026-06-13 · **Mode:** research/blueprint · all claims cite file:line.

## TL;DR

Every dead surface is a **HIDE**, not a DELETE. Two clusters: (1) gift cards (split-brain: issued codes unredeemable), (2) frozen marketplace/theme-store links. Use the **existing precedents** — nav-array removal + `BackendNeededPane` — not a new feature flag (none exists for nav). **One hard trap:** do **not** delete `api/.../gift-cards/route.ts` — it's one of the 127 routes in the `domain-boundary-validator` ratchet.

## Cluster 1 — Gift cards (split-brain CONFIRMED)

Issuance writes `gift_cards` (`products.ts:1062` `db.from('gift_cards').insert`); checkout redeems `gift_card_accounts` keyed by `code_hash` (`170_v1_shipping_rates_gst.sql:203`). Two tables, no bridge → **every issued code is unredeemable.**

| Surface | State | file:line | Action |
|---|---|---|---|
| Nav child "Gift cards" | ACTIVE | `merchantNavigation.ts:93` | **HIDE** — remove the child line |
| `GiftCardsPage` (issue form) | BROKEN | `products/gift-cards/page.tsx` | **HIDE** — convert body to `BackendNeededPane`-style "not available for V1" (keep file → no 404, no ratchet hit) |
| Merchant API proxy | ACTIVE | `api/stores/[store]/gift-cards/route.ts` (GET:5,POST:25) | **KEEP — do NOT delete** (counted in the 127-route ratchet) |
| Gateway issue/list | ACTIVE | `products.ts:1019,1044` | KEEP (backend, out of scope) |
| Shared client `products.giftCards.*` | ACTIVE | `packages/typescript/api-client/src/index.ts` | KEEP (consumed by the proxy) |
| Storefront gift-card UI | DOES NOT EXIST | (pass-through only `storefront .../api/orders/route.ts:55`) | n/a |

**Hidden-dependency check: CLEAR.** Grep for `gift-cards|GiftCard` across `apps/merchant-control-plane/src` (excluding the page folder) → exactly the one nav line `merchantNavigation.ts:93`. No layout/route-group/test imports the page.

## Cluster 2 — Marketplace / app-store / theme-store / dev-portal links

Targets `apps.letbuyy.com`→`apps/app-marketplace` and `themes.letbuyy.com`→`apps/theme-marketplace` are **frozen, not deployed** (`app-marketplace/runtime.manifest.json:9,49,91`; `docs/governance/domain-topology-governance.md:6-7` = "Target/planned … not yet live"). Every link below points at an undeployed host = **DEAD → HIDE**.

| Surface | Target | file:line | Action |
|---|---|---|---|
| Apps page "Browse marketplace" | apps.letbuyy.com | `apps/page.tsx:42` | HIDE |
| Apps page empty-state "Browse apps" | apps.letbuyy.com | `apps/page.tsx:84,88` | HIDE |
| AppsSettings `APP_MARKETPLACE_URL` + actions | apps.letbuyy.com | `AppsSettingsClient.tsx:26,148,192,198` | HIDE (drop external href/primaryAction; keep the pane) |
| Themes "Visit Theme Store" ×2 | themes.letbuyy.com | `online-store/themes/page.tsx:457-458,496-498` | HIDE |
| `getThemeMarketplaceUrl` helper | themes.letbuyy.com | `lib/public-urls.ts:4,47-52` | KEEP (env helper; just stop calling — harmless if unreferenced) |
| Developer portal links | — | none found | n/a |
| Storefront marketplace links | — | none (grep clean) | n/a |
| `accounts.letbuyy.com` (auth) | identity-platform (LIVE) | `public-urls.ts:1,16` | **KEEP — do not touch** |

## Hide mechanism (precedent — do NOT invent)

There is **no UI feature-flag / nav-filter mechanism** in the merchant app (grep `NEXT_PUBLIC_FEATURE|FEATURE_FLAG|featureFlags|isFeatureEnabled` in `apps/merchant-control-plane/src` → empty). The platform flag system is gateway/env-scoped (backend mounts), not per-nav. Use the two established precedents:

1. **Nav-array removal** — delete the dead nav children/links from the static `navigationByType` arrays. Direct precedent: the removed `ats-score`/`PDF export` resume routes that `legacy-site-type-validator.mjs:163` now asserts are **absent**.
2. **`BackendNeededPane`** (`components/settings/BackendNeededPane.tsx:20`) — already used by `settings/localization|business|custom-data/page.tsx`. Convert the gift-cards page body to this (or a plain `EmptyState` "not available for V1") so a URL hit shows an honest notice instead of the broken issue form.

## Ratchet safety

| Validator | Asserts | Impact |
|---|---|---|
| `domain-boundary-validator.mjs:209` (`appApiRoutes.length === 127`) | exact count of `apps/**/api/**/route.ts` | **SAFE iff you do NOT delete a `route.ts`.** Hiding nav/pages/links touches zero route files. Deleting `gift-cards/route.ts` → 126 → FAIL. |
| `tests/federation/app-api-route-ownership.test.mjs:18,31` | mirrors 127 | same |
| `legacy-site-type-validator.mjs:161-165` | `merchantNavigation.ts` lacks `ats-score`/`PDF export` | SAFE (no gift-card ref) |
| `shell-single-validator.mjs:27-29` | `merchantNavigation.ts` contains `'Money'` + `settings/billing` | SAFE (untouched, lines 73-81) |
| `validate-design-system` / baseline | token/shell rules | SAFE (no nav/snapshot pin) |
| `settings-apps-dead-twin-validator` | `AppsSettingsContent.tsx` stays archived | SAFE (editing the link in `AppsSettingsClient.tsx` is fine) |
| `marketplace-single-source-validator` | frozen-marketplace internals | SAFE |

**All LB-11 hides are validator-safe; nothing needs a lockstep update.** The only constraint: keep `gift-cards/route.ts` on disk.

## Classification summary

- **KEEP:** `gift-cards/route.ts` (proxy, ratchet), `api-client.giftCards.*`, `getThemeMarketplaceUrl` helper, `accounts.letbuyy.com`, all gateway backends.
- **HIDE:** gift-cards nav (`merchantNavigation.ts:93`) + page body; 6 apps/themes external links.
- **DELETE:** none required for V1.

## Rollout / rollback

- **Rollout:** one PR (nav lines + link blocks + gift-cards page body). Validate gate (expect green — no ratchet touched) + design-system.
- **Rollback:** revert the PR; surfaces reappear. No data/state.

**Effort: ~0.5 day. Risk: low. Commit: 1 (separate).**
