# Mobile Design System Report — Phase 1.5 Adoption

**Date:** 2026-06-09 · read-only · calculated counts over `apps/mobile/merchant-app/lib` (159 `.dart` files) + `packages/dart/ui_kit`.
**Headline:** the Flutter merchant app is, in practice, **a separate design system**. The web→Flutter token bridge exists and passes its parity check, but **the live `ThemeData` does not consume it** — overall canonical-token adoption is **~11.5%**, and the generated bridge's real reach is **~6%** of color/spacing/type sites.

## 1. Live theme source — the generated bridge is bypassed
`apps/mobile/merchant-app/lib/theme/store_theme.dart` imports `package:letbuyy_ui_kit` only (lines 1-3); it does **not** import the generated `letbuyy_color_tokens.dart` (`grep -c` → 0). `light()` (L13) and `dark()` (L278) bind **ui_kit `LetbuyyColorTokens` + ui_kit `AppColors`**. The generated bridge file is imported by **62 screen/widget files** but never by the theme. So `mobile-tokens.ts → letbuyy_color_tokens.dart` feeds screen code, not the theme that actually colors the app.

**Class-name collision (active):** two classes named `LetbuyyColorTokens` — `packages/dart/ui_kit/lib/src/tokens/letbuyy_tokens.dart:44` (semantic: `primary`, `surfaceDark`, `danger`) vs `apps/mobile/merchant-app/lib/theme/letbuyy_color_tokens.dart:13` (primitive: `brandPrimary`, `success`, `slate900`). 8 files import both, disambiguating the generated one `as mobile_tokens`.

## 2. Token parity & coverage
`node scripts/generators/generate-mobile-tokens.mjs --check` → **PASS** (in sync). But `mobile-tokens.ts` (68 lines) covers **colors + spacing only — no typography**. The app needs type tokens (712 raw `fontSize:` live) and theme-aware light/dark accessors; neither is in the bridge.

## 3. Calculated adoption by dimension
| Dimension | Canonical | Flutter actual | **Adoption %** | Drift |
|---|---|---|:---:|---|
| Live theme palette | generated `letbuyy_color_tokens.dart` | ThemeData binds ui_kit `LetbuyyColorTokens`+`AppColors` | bridge reaches theme: **0%** | High |
| Color | generated tokens (status reconciled #22C55E/#EF4444/#F59E0B) | 4 competing classes (`AppColors`, `StoreAdminColors`, `Light/DarkThemeColors`, 2×`LetbuyyColorTokens`) + 951 raw literals (295 `Color(0x`, 656 `Colors.`) | **45%** any-class / **23%** canonical / **14%** generated-bridge | High |
| Spacing | `LetbuyySpacingTokens` + `LetbuyyDensity` | 102 token refs vs 1,767 raw `EdgeInsets`/`SizedBox`; density tokens **0** refs | **5.5%** | High |
| Typography | `AppTextStyles`/`LetbuyyTypographyTokens` (neither in bridge) | 0 token refs; **712** raw `fontSize:`; 44 inline `GoogleFonts.inter` | **0%** | Critical |
| Dark mode | token-driven light/dark | complete & symmetric (18 component blocks each), default `dark`, key `app_theme_mode` | structurally 100%; **ui_kit-sourced, not generated** | Medium |
| Other apps | merchant/operator/shopper | merchant only (159 `.dart`); operator + shopper = manifest-only stubs (0 `.dart`) | n/a | expected |

> **Overall mobile canonical-token adoption: ~11.5%** (pooled color+spacing+type). **Remaining migration: ~88%.** Dark mode is the most mature surface but renders ui_kit `AppColors` teal body text (`#D3E4E3/#AED9D8/#89CBCB`, `app_colors.dart:83-85`), not the canonical slate ramp.

## 4. Top offending files (raw `Color(0x`)
`theme/store_admin_colors.dart` (47), `theme/light_theme_colors.dart` (29), `theme/dark_theme_colors.dart` (28), `widgets/editor/device_frames/laptop_frame.dart` (21), `screens/auth/login_screen.dart` (18), `widgets/dashboard/hero_store_card.dart` (17), `widgets/editor/compact_settings_sheet.dart` (16).

## 5. Required refactors (file:line)
1. **Resolve the dual-`LetbuyyColorTokens` collision** — pick the generated bridge as canonical; rename/delete the ui_kit semantic class or have it re-export the generated primitives. (`letbuyy_tokens.dart:44` vs `letbuyy_color_tokens.dart:13`; 8 dual-import files.)
2. **Point live `ThemeData` at the generated bridge** — `store_theme.dart:16-25` (light) + `:282-292` (dark) re-based on generated tokens + theme-aware accessors, so the web→Flutter bridge actually drives the app.
3. **Add typography to the bridge** — extend `mobile-tokens.ts` + generator to emit a type scale; replace the inline `GoogleFonts.inter(fontSize:…)` ladder (`store_theme.dart:31-94`) and 712 raw `fontSize:`.
4. **Wire spacing tokens into the theme** — migrate 1,767 raw `EdgeInsets`/`SizedBox` literals to `LetbuyySpacingTokens`; adopt `LetbuyyDensity` (currently 0%).
5. **Collapse the 4 competing color classes** (`store_admin_colors.dart`, `light/dark_theme_colors.dart`, `AppColors`) and fix the dark-text teal drift into the slate ramp.

## 6. Token parity status
Bridge **in sync** (`--check` PASS) and CI-gated (`validate:mobile-tokens`) — but it governs only the *generated file*, which the theme ignores. **Parity is real; relevance is ~6%.** Closing the gap = refactors #1–#2 (make the theme consume the bridge), after which the existing CI gate becomes meaningful for the rendered app.
