# LetBuyy Color Impact Report

Generated: 2026-06-03
Scope: color only. No source migration is included in this documentation step.

## Scan Scope

The repository was scanned for cyan, purple, blue, indigo, and red usage across source and documentation files:

- Extensions: `.ts`, `.tsx`, `.css`, `.dart`, `.md`
- Included roots: `apps`, `packages`, `services`, `docs`, `config`, `database`, `infrastructure`, `memory`, `tasks`
- Excluded generated/build output: `node_modules`, `.next`, `dist`, `build`, `.turbo`, `.cache`, `.dart_tool`, `.wrangler`, `.vercel`, `coverage`, `Pods`, `.symlinks`

## Classification Rules

| Classification | Meaning |
|---|---|
| Canonical | Already using Brand Purple `#8B5CF6`, approved purple ladder, approved neutrals, or semantic colors through tokens |
| Replace | Brand drift that must migrate to LetBuyy Brand Purple tokens |
| Legacy | Archived docs, old generated intelligence, stale design notes, or historical references |
| Exception | Semantic danger/info/success/warning, provider/payment colors, merchant theme presets, storefront theme palettes, chart/category palettes |

## Target Tokens

| Current family | Replace with |
|---|---|
| Cyan as brand | `--lb-color-primary`, `LetBuyyColors.primary`, `#8B5CF6` |
| Blue as brand/shared default | `--lb-color-primary`, `#8B5CF6` |
| Indigo as brand | `--lb-color-primary`, `#8B5CF6` |
| Red as brand/action accent | `--lb-color-primary`, `#8B5CF6`; keep red only for danger |
| Purple `#8B5CF6` | Canonical, keep |
| Purple hover `#7C3AED` | Canonical, keep |
| Purple active `#6D28D9` | Canonical, keep |

## High Priority Impact Inventory

| File | Current color/family | Target color/token | Classification | Priority | Risk |
|---|---|---|---|---|---|
| `packages/typescript/ui/src/tokens.ts` | Blue `#2563eb`, `#60a5fa` | Purple V1 shared tokens | Replace | P0 | High: shared package affects multiple apps |
| `packages/dart/ui_kit/lib/src/themes/app_colors.dart` | Cyan `Color(0xFF00B3B3)` | `LetBuyyColors.primary` / `#8B5CF6` | Replace | P0 | High: final Flutter runtime primary source |
| `apps/merchant-control-plane/src/app/globals.css` | Purple local tokens plus shared `--lb-*` blue conflict | Purple V1 `--lb-*` alignment | Canonical, align | P1 | Medium: large stylesheet and runtime token overlap |
| `apps/app-marketplace/src/app/globals.css` | Purple-first, includes cyan accents | Purple V1 alignment; preserve accent exceptions as needed | Canonical, align | P2 | Medium: developer/app marketplace is already close |
| `apps/platform-console/src/app/(auth)/login/page.tsx` | Red brand-like login CTA | Purple V1 primary token | Replace | P1 | Medium: auth entry point visual identity |
| `apps/platform-console/src/app/(auth)/mfa/page.tsx` | Red brand-like auth accent | Purple V1 primary token | Replace | P1 | Medium: security flow must keep danger semantics clear |
| `apps/platform-console/src/app/(dashboard)/layout.tsx` | Red console badge/action accents | Purple V1 for brand; red only danger | Replace | P1 | Medium |
| `apps/platform-operations-portal/src/app/(auth)/login/page.tsx` | Indigo `bg-indigo-600` | Purple V1 primary token | Replace | P1 | Medium |
| `apps/platform-operations-portal/src/app/(auth)/invite/page.tsx` | Indigo `bg-indigo-600` | Purple V1 primary token | Replace | P1 | Medium |
| `apps/platform-operations-portal/src/app/(dashboard)/layout.tsx` | Indigo badge/accent | Purple V1 primary token | Replace | P1 | Medium |

## Runtime Replacement Inventory

| Runtime | File | Current family | Target | Classification | Priority | Risk |
|---|---|---|---|---|---|---|
| Merchant Flutter App | `apps/mobile/merchant-app/lib/screens/products/import_products_screen.dart` | Cyan | Flutter Purple V1 token | Replace | P1 | Medium |
| Merchant Flutter App | `apps/mobile/merchant-app/lib/screens/products/products_screen.dart` | Cyan | Flutter Purple V1 token | Replace | P1 | Medium |
| Merchant Flutter App | `apps/mobile/merchant-app/lib/screens/customize/theme_screen.dart` | Cyan, Blue, Purple | Preserve theme preset swatches; use Purple V1 for runtime UI | Exception plus Replace | P1 | Medium |
| Merchant Flutter App | `apps/mobile/merchant-app/lib/widgets/editor/compact_settings_sheet.dart` | Cyan | Flutter Purple V1 token | Replace | P1 | Medium |
| Merchant Flutter App | `apps/mobile/merchant-app/lib/widgets/editor/preview_sections/preview_about.dart` | Indigo | Flutter Purple V1 token | Replace | P1 | Medium |
| Merchant Flutter App | `apps/mobile/merchant-app/lib/widgets/editor/preview_sections/preview_footer.dart` | Cyan/Indigo support values | Flutter Purple V1 token unless tenant preset | Replace | P1 | Medium |
| Merchant Flutter App | `apps/mobile/merchant-app/lib/widgets/editor/preview_sections/preview_hero.dart` | Cyan/Indigo support values | Flutter Purple V1 token unless tenant preset | Replace | P1 | Medium |
| Merchant Flutter App | `apps/mobile/merchant-app/lib/widgets/editor/preview_sections/preview_newsletter.dart` | Cyan/Indigo support values | Flutter Purple V1 token unless tenant preset | Replace | P1 | Medium |
| Merchant Flutter App | `apps/mobile/merchant-app/lib/widgets/editor/preview_sections/preview_products.dart` | Cyan/Indigo support values | Flutter Purple V1 token unless tenant preset | Replace | P1 | Medium |
| Merchant Flutter App | `apps/mobile/merchant-app/lib/widgets/editor/preview_sections/preview_testimonials.dart` | Cyan/Indigo support values | Flutter Purple V1 token unless tenant preset | Replace | P1 | Medium |
| Merchant Flutter App | `apps/mobile/merchant-app/lib/widgets/editor/section_type_icon.dart` | Blue/Indigo | Flutter Purple V1 token for UI chrome | Replace | P1 | Low |
| Merchant Flutter App | `apps/mobile/merchant-app/lib/widgets/theme/color_picker_row.dart` | Cyan | Preserve if merchant color picker swatch; do not use as runtime brand | Exception | P2 | Low |
| Merchant Control Plane | `apps/merchant-control-plane/src/app/[store]/settings/subscribe/checkout/SubscribeCheckoutClient.tsx` | Fallback `#2563eb` | Purple V1 fallback or token | Replace | P1 | Medium |
| Merchant Control Plane | `apps/merchant-control-plane/src/components/plans/ComparePlans.tsx` | Uses primary class | Ensure class resolves Purple V1 | Canonical | P2 | Low |
| Merchant Control Plane | `apps/merchant-control-plane/src/components/plans/PlanCard.tsx` | Uses primary class | Ensure class resolves Purple V1 | Canonical | P2 | Low |
| Platform Console | `apps/platform-console/src/app/(dashboard)/audit-logs/page.tsx` | Blue focus/action classes | Purple V1 brand/focus token | Replace | P1 | Medium |
| Platform Console | `apps/platform-console/src/app/(dashboard)/employees/page.tsx` | Blue focus/action classes | Purple V1 brand/focus token | Replace | P1 | Medium |
| Platform Console | `apps/platform-console/src/app/(dashboard)/operations/page.tsx` | Red action/critical usage | Purple for brand; red only true danger | Replace plus Exception | P1 | High |
| Platform Console | `apps/platform-console/src/app/(dashboard)/stores/page.tsx` | Blue action classes | Purple V1 brand/focus token | Replace | P1 | Medium |
| Platform Console | `apps/platform-console/src/app/(dashboard)/subscriptions/page.tsx` | Blue action classes | Purple V1 brand/focus token | Replace | P1 | Medium |
| Platform Console | `apps/platform-console/src/components/ConsoleDataTable.tsx` | Blue and red state classes | Purple for focus/action; keep red danger | Replace plus Exception | P1 | Medium |
| Platform Operations Portal | `apps/platform-operations-portal/src/app/(dashboard)/operations/page.tsx` | Red failed/critical states | Keep semantic red; remove brand drift only | Exception plus Replace | P2 | Medium |
| Platform Operations Portal | `apps/platform-operations-portal/src/app/(dashboard)/stores/page.tsx` | Indigo action/accent classes | Purple V1 brand/focus token | Replace | P1 | Medium |
| Platform Operations Portal | `apps/platform-operations-portal/src/app/(dashboard)/users/page.tsx` | Indigo action/accent classes | Purple V1 brand/focus token | Replace | P1 | Medium |
| Storefront Runtime | `apps/storefront-runtime/src/components/layout/dynamic-footer.tsx` | Cyan | Preserve tenant theme if palette-driven; otherwise Purple V1 | Exception plus Replace | P2 | Medium |
| Storefront Runtime | `apps/storefront-runtime/src/components/layout/dynamic-header.tsx` | Cyan | Preserve tenant theme if palette-driven; otherwise Purple V1 | Exception plus Replace | P2 | Medium |
| Shared Types | `packages/shared-types/src/index.ts` | Cyan/blue theme defaults | Purple V1 only for LetBuyy-owned default theme | Replace plus Exception | P1 | High |
| API Gateway | `services/api-gateway/src/execution/schema-registry-execution.adapter.ts` | Cyan/blue theme defaults | Purple V1 only for LetBuyy-owned default theme | Replace plus Exception | P1 | High |

## Canonical Or Near-Canonical Files

| File | Current color/family | Classification | Required action |
|---|---|---|---|
| `apps/merchant-control-plane/src/app/globals.css` | Purple `#8B5CF6`, `#7C3AED`, `#6D28D9` | Canonical, align | Keep purple; align `--lb-*` shared token bridge |
| `apps/app-marketplace/src/app/globals.css` | Purple `#8B5CF6`, `#7C3AED`, `#6D28D9` | Canonical, align | Keep purple; align with shared tokens |
| `apps/identity-platform/src/app/globals.css` | Purple-family auth direction | Canonical support | No immediate wave required unless shared tokens expose drift |
| `docs/Codex_waves/LETBUYY_MASTER_EXECUTION_BLUEPRINT_V2.md` | Purple decision references | Canonical docs | Keep unless superseded |

## Exception Inventory

These files may contain scanned colors that are not brand violations when used for semantic states, provider colors, theme presets, storefront palettes, charts, category colors, or documentation examples:

| File or area | Reason |
|---|---|
| `apps/storefront-runtime/src/app/**` | Tenant storefront palettes and shopper theme colors |
| `apps/storefront-runtime/src/components/**` | Storefront theme palettes, cart/status semantics, dynamic tenant styling |
| `apps/theme-marketplace/**` | Theme preview palettes and marketplace theme examples |
| `apps/app-marketplace/**` | Provider/category/accent examples; app marketplace remains purple-first |
| `packages/dart/models/lib/src/merchant_app/store_theme_model.dart` | Merchant theme preset data |
| `packages/dart/models/lib/src/store_template_model.dart` | Store template palette data |
| `packages/theme-engine/**` | Theme engine examples and storefront theme definitions |
| `services/api-gateway/src/routes/payments.ts` | Payment/provider status and semantic colors if present |
| `services/api-gateway/src/routes/themes.ts` | Theme marketplace or tenant theme palettes |
| `database/**` | Stored seed/theme values where tenant palette authority applies |
| Chart, analytics, and category palette files | Distinct data colors are allowed when not used as brand |

## Legacy Documentation Inventory

The following docs may contain old color names, runtime references, or generated intelligence. Treat them as historical unless they are regenerated from source:

| File or area | Classification | Action |
|---|---|---|
| `docs/archive/**` | Legacy | Do not migrate unless archive is rewritten |
| `docs/archive/architecture/SYSTEM_INTELLIGENCE_REPORT.md` | Legacy | Leave historical |
| `docs/architecture/master-system-intelligence.md` | Generated intelligence | Regenerate only after source migration |
| `LETBUYY_ENTERPRISE_ARCHITECTURE_AUDIT.md` | User-owned untracked doc | Do not modify in this mission |
| `LETBUYY_MERCHANT_EXPERIENCE_AUDIT.md` | User-owned untracked doc | Do not modify in this mission |
| `CODEX_SHOPIFY_UX_MISSION.md` | User-owned untracked doc | Do not modify in this mission |

## Violations Summary

| Violation | Source | Required fix |
|---|---|---|
| Flutter runtime primary is cyan | `packages/dart/ui_kit/lib/src/themes/app_colors.dart:8` | Replace with Purple V1 |
| Shared UI package primary is blue | `packages/typescript/ui/src/tokens.ts:19` | Replace with Purple V1 |
| Shared UI dark primary is blue | `packages/typescript/ui/src/tokens.ts:44` | Replace with Purple V1 dark mapping |
| Platform Console uses red as brand/action | `apps/platform-console/src/app/(auth)/login/page.tsx:94` | Replace with Purple V1; keep red only for danger |
| Operations Portal uses indigo as brand/action | `apps/platform-operations-portal/src/app/(auth)/login/page.tsx:38` | Replace with Purple V1 |
| Merchant web has local purple and shared blue token overlap | `apps/merchant-control-plane/src/app/globals.css` plus `packages/typescript/ui/src/tokens.ts` | Align shared `--lb-*` tokens to Purple V1 |

## Migration Priority

1. P0: Shared token sources that can create cross-runtime drift.
2. P1: Runtime entry points, auth CTAs, dashboard shell accents, Flutter final runtime primary, and web `--lb-*` bridges.
3. P2: Already-purple surfaces, marketplace/developer alignment, storefront dynamic exceptions, charts, examples, and docs.

## Final Impact Verdict

LetBuyy currently has five visible brand signals: cyan, purple, blue, red, and indigo. Purple is already the strongest product direction. The migration should replace cyan, blue, red-as-brand, and indigo-as-brand with Purple V1 while preserving semantic, provider, merchant theme preset, storefront palette, and chart exceptions.
