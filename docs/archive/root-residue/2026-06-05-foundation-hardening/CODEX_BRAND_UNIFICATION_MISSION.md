# Codex Brand Unification Mission

Generated: 2026-06-03
Mission type: color-only implementation mission.
Official brand: **LetBuyy Brand Purple `#8B5CF6`**.

## Mission Objective

Run autonomously wave-by-wave to migrate LetBuyy from fragmented brand colors to the Purple V1 color system. Update all affected applications without redesigning components, changing typography, changing spacing, or altering product flows.

The final state must make these surfaces visually feel like one company:

- Merchant Flutter App
- Merchant Control Plane
- Platform Console
- Platform Operations Portal
- Developer/App Marketplace
- Future apps using shared tokens

## Source Documents

Read these before editing:

- `AGENTS.md`
- `memory/lessons.md`
- `tasks/todo.md`
- Relevant local `AGENTS.md` files for each runtime/package
- `LETBUYY_BRAND_DECISION_REPORT.md`
- `LETBUYY_BRAND_SYSTEM_V1.md`
- `LETBUYY_COLOR_IMPACT_REPORT.md`
- `LETBUYY_COLOR_UNIFICATION_PLAN.md`
- `LETBUYY_RUNTIME_THEME_VERIFICATION.md` if present

## Non-Negotiable Rules

1. Do not redesign anything.
2. Do not change component structure unless required to swap color tokens.
3. Do not analyze or modify typography, spacing, icons, or layout.
4. Do not replace semantic red danger states.
5. Do not replace blue info states unless they are being used as brand/action color.
6. Do not replace provider/payment brand colors.
7. Do not replace merchant theme presets, tenant storefront palettes, chart palettes, or category palettes unless they are incorrectly used as LetBuyy's own app chrome.
8. Preserve runtime boundaries and package governance.
9. Keep builds green or document unrelated blockers with file-level evidence.
10. Produce screenshots and before/after comparisons for every affected runtime.

## Canonical Values

```txt
Brand Purple: #8B5CF6
Primary: #8B5CF6
Primary Hover: #7C3AED
Primary Active: #6D28D9
Primary Subtle: rgba(139, 92, 246, 0.12)
Background Light: #F8FAFC
Background Dark: #0A0F1A
Surface Light: #FFFFFF
Surface Dark: #0F172A
Text Primary Light: #0F172A
Text Primary Dark: #FFFFFF
Text Secondary Light: #475569
Text Secondary Dark: #94A3B8
Text Muted: #64748B
Border Light: #E2E8F0
Border Dark: #334155
Success: #22C55E
Warning: #F59E0B
Danger: #EF4444
Info: #3B82F6
```

## Execution Workflow

For each wave:

1. Read the local runtime/package `AGENTS.md`.
2. Inspect the current files before editing.
3. Capture before screenshots where the runtime can run.
4. Make scoped color-only changes.
5. Run the wave-specific validation.
6. Capture after screenshots.
7. Compare before/after for brand consistency and contrast regressions.
8. Document changed files, preserved exceptions, validation output, and screenshots.
9. Continue to the next wave only when the current wave is stable or the blocker is clearly unrelated.

## Wave 1: Design Tokens

### Edit

- `packages/typescript/ui/src/tokens.ts`
- `packages/typescript/ui/src/design-system-root.tsx` only if emitted variables need alignment

### Required Changes

- Replace blue primary defaults with Purple V1.
- Emit `--lb-color-primary`, `--lb-color-primary-hover`, `--lb-color-primary-active`, and `--lb-color-primary-subtle`.
- Preserve semantic success/warning/danger/info.
- Ensure light and dark themes map to `LETBUYY_BRAND_SYSTEM_V1.md`.

### Validate

- Run shared UI typecheck/build.
- Inspect emitted token CSS.
- Confirm no shared UI brand token resolves to `#2563eb` or `#60a5fa`.

## Wave 2: Shared UI Package

### Edit

- Shared Button, Input, DataTable, PageHeader, Banner, EmptyState, and visual preview files if present.

### Required Changes

- Consume shared Purple V1 tokens.
- Remove blue primary defaults.
- Keep semantic status colors.

### Validate

- Run shared UI package typecheck/build.
- Screenshot controls and focus states.

## Wave 3: Merchant Control Plane

### Edit

- `apps/merchant-control-plane/src/app/globals.css`
- `apps/merchant-control-plane/src/app/[store]/settings/subscribe/checkout/SubscribeCheckoutClient.tsx`
- Other files only when direct brand drift is found.

### Required Changes

- Keep purple direction.
- Align app variables with shared `--lb-*` tokens.
- Replace blue fallback `#2563eb`.

### Validate

- Run Merchant Control Plane typecheck/build.
- Screenshot dashboard, products, orders, settings, checkout, and theme editor.

## Wave 4: Merchant Flutter App

### Edit

- `packages/dart/ui_kit/lib/src/themes/app_colors.dart`
- `apps/mobile/merchant-app/lib/theme/store_theme.dart`
- Flutter app screens/widgets with hardcoded brand cyan/blue/indigo.

### Required Changes

- Replace cyan runtime primary with Purple V1.
- Align `StoreTheme`, `AppThemeColors`, `StoreAdminColors`, `LightThemeColors`, and `DarkThemeColors`.
- Preserve merchant theme presets and color picker swatches as exceptions.

### Validate

- Run `flutter analyze`.
- Screenshot key screens in light and dark mode where feasible.
- Confirm `Color(0xFF00B3B3)` is not the runtime primary.

## Wave 5: Platform Console

### Edit

- `apps/platform-console/src/app/(auth)/login/page.tsx`
- `apps/platform-console/src/app/(auth)/mfa/page.tsx`
- `apps/platform-console/src/app/(dashboard)/layout.tsx`
- `apps/platform-console/src/app/(dashboard)/**`
- `apps/platform-console/src/components/ConsoleDataTable.tsx`

### Required Changes

- Replace red-as-brand with Purple V1.
- Keep red for danger, destructive actions, failed states, and critical operations.
- Replace blue focus/action classes with Purple V1 where used as brand.

### Validate

- Run Platform Console typecheck/build.
- Screenshot login, MFA, dashboard, operations, users/employees, stores, subscriptions, and audit logs.

## Wave 6: Platform Operations Portal

### Edit

- `apps/platform-operations-portal/src/app/(auth)/login/page.tsx`
- `apps/platform-operations-portal/src/app/(auth)/invite/page.tsx`
- `apps/platform-operations-portal/src/app/(dashboard)/layout.tsx`
- `apps/platform-operations-portal/src/app/(dashboard)/**`

### Required Changes

- Replace indigo-as-brand with Purple V1.
- Keep red only for failed, danger, or critical states.

### Validate

- Run Operations Portal typecheck/build.
- Screenshot login, invite, dashboard, support, users, stores, and operations pages.

## Wave 7: Developer/App Marketplace

### Edit

- `apps/app-marketplace/src/app/globals.css`
- Developer route files under `apps/app-marketplace/src/app/(auth)/**`

### Required Changes

- Keep purple-first direction.
- Align variables with shared Purple V1 tokens.
- Preserve marketplace category, provider, and illustration accents when they are not acting as brand.

### Validate

- Run App Marketplace typecheck/build.
- Screenshot marketplace home, developer register, my apps/dashboard, and app submission flow.

## Screenshot Requirements

Produce before/after screenshots for each affected runtime where local execution is feasible:

- Merchant Control Plane: dashboard, products, orders, settings, checkout, theme editor
- Merchant Flutter App: dashboard, products, editor/customize, settings
- Platform Console: login, MFA, dashboard, operations, stores, subscriptions, audit logs
- Platform Operations Portal: login, invite, dashboard, users, stores, operations
- App Marketplace/Developer Portal: marketplace home, developers page, my apps/dashboard, app submission

Store screenshots in an ignored analysis or artifact directory unless the user explicitly requests committed evidence.

## Final Migration Report

At the end of execution, generate `LETBUYY_COLOR_MIGRATION_REPORT.md` with:

- Changed files by wave
- Before/after screenshot paths
- Validation commands and results
- Remaining exceptions
- Any unresolved blockers
- Confirmation that cyan, blue, indigo, and red are no longer active brand colors

## Final Success Criteria

- `#8B5CF6` is the official brand source across shared web tokens and Flutter color authority.
- Shared UI no longer emits blue as the default primary brand.
- Flutter no longer emits cyan as the runtime primary brand.
- Platform Console no longer uses red as default brand/action identity.
- Platform Operations Portal no longer uses indigo as default brand/action identity.
- Developer/App Marketplace remains purple-first and aligned to shared tokens.
- All semantic/provider/theme-preset exceptions are preserved and documented.
- Builds/typechecks/analyze are green or blocked only by unrelated pre-existing issues.
