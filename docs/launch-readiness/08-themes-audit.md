# Themes Audit

**Date:** 2026-06-19  
**LCIS Domain:** `themes` (1 route, 4 RPCs, 32 tables, 28 policies)  
**Evidence:** `packages/theme-engine/src/theme-renderer.ts` (932 lines), migrations 180–182 (Urban Kicks), `V1_SCOPE_LOCK_2026_06_12/LIQUID_V1_FEASIBILITY_REPORT.md`, `ACTUAL_STATE.md`

---

## Completion Score: **78%**

*Two open blockers (LB-8, LB-9) prevent production-readiness.*

---

## Sub-System Audit

### Liquid Engine
**Score: 75%**

**What exists:**
- Liquid engine implementation in `packages/theme-engine/`
- `theme-renderer.ts` (932 lines) — the core renderer
- `portable-to-liquid.ts` — portability layer
- `execution-runtime.ts` — Liquid execution context
- `theme-bundle.ts` — bundle management
- `theme-registry.ts` — section/block registry
- `theme-governance.ts` — governance enforcement
- `built-in-section-schemas.ts` — built-in section definitions
- Migration 180: `180_urban_kicks_liquid_theme.sql` — Urban Kicks Liquid theme committed
- Migration 181: `181_urban_kicks_settings_schema_complete.sql`
- Liquid sanitizer: `FORBID` lists, `outputEscape:'escape'`, XSS protection
- Template resolver: `apps/storefront-runtime/src/lib/theme-engine/template-resolver.ts`

**What is missing:**
- **Production Liquid is OFF** (`FEATURE_LIQUID="false"` in `wrangler.toml:245`, `THEME_LIQUID_RENDERING_DEFAULT_ENABLED=false`)
- Liquid canary is not active — React renderer is the live path
- CAP-C08: "Liquid production canary, full snapshot corpus, ARB default flip, and React deletion proof" — NOT completed
- Liquid section parity is not 100% (announcement bar missing, per LB-8)

**Evidence:** `ACTUAL_STATE.md` — "Liquid is off in production"; `no-new-react-sections-validator.mjs:9-40`; `wrangler.toml:245`

---

### Theme Editor
**Score: 85%**

**What exists:**
- Theme editor page: `apps/merchant-control-plane/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx`
- Theme editor API route: `apps/merchant-control-plane/src/app/api/themes/[themeId]/editor/route.ts`
- Theme draft management: `theme_editor_drafts`, `theme_instance_drafts`, `theme_draft_patches` tables
- Live preview in editor
- Theme publish path: `publish_theme_release` RPC
- Section customization via schema-driven editor
- CAP-C12: "repository-side web and mobile editor publish paths now send canonical template_config plus Liquid bundle/canary" — implemented
- Mobile theme editor (Flutter): `apps/mobile/merchant-app/lib/services/theme_service.dart`

**What is missing:**
- LB-8: Announcement bar section missing → merchant tries to add it → gets `UnknownSectionFallback`
- LB-9: Appearance settings written to `sites.site_settings` but **never read by storefront** (dead island)

**Evidence:** Editor pages, `theme_editor_drafts` table, `ACTUAL_STATE.md` LB-8/LB-9

---

### Theme Runtime
**Score: 82%**

**What exists:**
- React-based theme renderer (current live path)
- 20 frozen React sections
- Urban Kicks theme: `docs/theme-urban-kicks.md`, migration 180
- Theme instance management: `theme_instances`, `theme_releases`, `theme_template_assignments`
- Storefront theme delivery: `apps/storefront-runtime/src/lib/`
- Theme cache via `storefront_cache_tags` table
- CACHE binding in Cloudflare Worker for edge caching
- Theme preview sessions: `theme_preview_sessions` table

**What is blocked:**
- LB-8: `announcementBar` section → `UnknownSectionFallback` (renderer-registry.tsx:56-203,243-275)
- LB-9: `sites.site_settings` written on Appearance save but omitted from `STOREFRONT_SITE_SELECT` (storefront.ts:345)
- React sections frozen: `no-new-react-sections-validator.mjs` blocks adding new React sections

**Evidence:** `ACTUAL_STATE.md` LB-8/LB-9 with exact file:line evidence

---

### Theme Marketplace
**Score: 15%** ← **FROZEN**

**What exists:**
- Database tables: `theme_packages`, `theme_marketplace_settings`, `theme_developer_listings`, `theme_developer_payout_accounts`, `theme_reviews`, `theme_purchases`, `theme_purchase_receipts`
- `theme-marketplace` app exists but FROZEN per CLAUDE.md
- `theme_collections`, `theme_saved_searches` tables

**What is missing:**
- The `apps/theme-marketplace` app is frozen and not a production deploy target
- Merchant-visible theme store is behind frozen app
- Theme purchase flow not accessible from merchant admin

**Evidence:** CLAUDE.md — "apps/theme-marketplace frozen or pending consolidation, not production deploy targets"

---

### Presets
**Score: 70%**

**What exists:**
- `theme_presets` table
- Preset management in theme engine
- Urban Kicks preset shipped via migration 181
- Preset schema definitions in `built-in-section-schemas.ts`

**What is missing:**
- `apply_preset` API — discovered in theme research as a gap
- Preset application from merchant UI (selecting a preset applies it to the theme)
- Multiple preset variations for the same theme

**Evidence:** Theme research in `docs/theme-research/`, `theme_presets` table, theme discovery in `docs/theme-discovery/`

---

## Blockers

| # | Blocker | Severity | Impact |
|---|---|---|---|
| LB-8 | Announcement bar missing + governance-trapped | 🔴 Critical | Common storefront feature renders broken fallback |
| LB-9 | Appearance bridge dead island | 🔴 Critical | Merchant appearance customizations not applied |
| CAP-C08 | Liquid canary + ARB flip | Capability gap | React cannot be removed; Liquid not default |

---

## LB-8 Decision Required

The `no-new-react-sections-validator` freezes React sections at 20. Options (per `LETBUYY_V1_BLOCKER_REPORT.md §B`):

1. **Recommended:** Fold announcement bar into the existing `header` section — renders the strip inside `header.tsx` driven by `announcementBar` schema/settings. Avoids the freeze validator. ~1 day.
2. Rejected: Flip Liquid on (ARB-gated, forbidden without approval)
3. Rejected: Amend validator (governance change, needs owner sign-off)

**This decision must be made before any LB-8 code is written.**

---

## Launch Readiness

**Themes is NOT production-ready due to LB-8 and LB-9.** Merchants can customize their store, but:
- The announcement bar renders broken
- Appearance settings (colors, fonts) don't reach the storefront

Both blockers are 2–4 total dev-days to fix. After fixing, themes are launch-ready for React (V1). Liquid activation is a V1.1 milestone.

**Recommended V1.0.0 scope:** Urban Kicks theme (React) + theme editor + fixed appearance bridge + announcement bar fix. One theme included in V1.

**Delay to V1.1:** Liquid canary activation (CAP-C08), theme marketplace, preset selector, additional themes.
