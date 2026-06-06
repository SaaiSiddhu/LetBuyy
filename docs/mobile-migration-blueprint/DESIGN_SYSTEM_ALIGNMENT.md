# DESIGN SYSTEM ALIGNMENT — Web vs Flutter

**Goal:** visual parity with existing LetBuyy branding. **Not** a redesign. Match the canonical tokens; close the divergences where the Flutter app hardcodes values instead of consuming tokens.

**Sources of truth:**
- **Web/TS:** `packages/typescript/ui/src/tokens.ts` (canonical) + `@letbuyy/ui` composition primitives (`BlockStack`/`InlineStack`).
- **Flutter/Dart:** `packages/dart/ui_kit/lib/src/tokens/letbuyy_tokens.dart` (mirror) + app-local `apps/mobile/merchant-app/lib/theme/**`.

**Headline:** The token *layer* is already mirrored TS→Dart and matches on the essentials (brand purple, Inter, 4/8/12/16 spacing). The gap is **consumption**: many Flutter screens hardcode `Color(0xFF8B5CF6)` and raw values instead of referencing the tokens, and there are two coexisting Dart color systems.

---

## 1. Color

| Token | Web (`tokens.ts`) | Dart token (`letbuyy_tokens.dart`) | App-local (`store_admin_colors.dart`) | Aligned? |
|---|---|---|---|---|
| Brand primary (purple 500) | `#8B5CF6` | `purple500 = 0xFF8B5CF6` (`brandPurple`/`primary`) | `#8B5CF6` | ✅ |
| Primary hover (600) | `#7C3AED` | `purple600 = 0xFF7C3AED` | `#7C3AED` (secondary) | ✅ |
| Primary active (700) | `#6D28D9` | `purple700 = 0xFF6D28D9` | — | ✅ |
| Secondary (brief: `#6366F1`) | indigo `#6366F1` (per mission) | present in ramp | `#7C3AED` used as "secondary" | 🟠 naming drift |
| Accent (pink) | — | — | `#EC4899` | app-only |
| Success / Warning / Error / Info | standard | tokens | `#10B981 / #F59E0B / #EF4444 / #3B82F6` | ✅ |
| Neutral ramp | Slate 50–950 | tokens | Slate 50–950 | ✅ |
| Subtle purple | — | `purpleSubtle = 0x1F8B5CF6` | — | ✅ |

**Divergences to fix:**
- **Hardcoded brand purple.** `Color(0xFF8B5CF6)` appears raw in `auth_wrapper.dart`, `settings_*`, `products_*`, `import_products`, `wizard`, `dashboard`, `orders`, and `theme/dark_theme_colors.dart` — instead of `LetbuyyColorTokens.primary`. → Replace raw literals with token references so a brand change propagates.
- **Two Dart color systems coexist:** static `StoreAdminColors` (brand palette) and context-aware `AppThemeColors` (light/dark, glassmorphism, elevation). → Pick `AppThemeColors`/tokens as canonical; treat `StoreAdminColors` as a thin alias to avoid double sources.
- **Secondary naming:** mission says secondary `#6366F1` (indigo); app uses `#7C3AED` (purple-600) as "secondary". → Reconcile the label (cosmetic, but causes confusion).

---

## 2. Typography

| Aspect | Web | Dart token | App theme | Aligned? |
|---|---|---|---|---|
| Body font | **Inter** | `fontBody = 'Inter'` | `store_theme.dart` GoogleFonts **Inter** | ✅ |
| Display font | Inter | `fontDisplay = 'Inter'` | ui_kit `AppTextStyles` uses **Poppins** for display/headline | 🟠 **conflict** |
| Mono | ui-mono | `fontMono = 'ui-monospace'` | n/a | ✅ |
| Scale | display 32 / h1 28 / h2 24 / h3 20 / body 14 / caption 12 | identical | identical | ✅ |
| Weights | 400–700 | w400–w700 | — | ✅ |

**Divergence to fix — the Poppins/Inter conflict.** The canonical token family is **Inter only**, and `store_theme.dart` correctly uses Inter, but `ui_kit`'s `AppTextStyles` applies **Poppins** for display/headline. → Standardize on **Inter** everywhere (drop Poppins) to match web, *or* formally adopt Poppins for display in the web tokens too. Inter-only is the lower-risk parity choice.

---

## 3. Spacing, radius, shadow

| Scale | Web (mission) | Dart token (`letbuyy_tokens.dart`) | Aligned? |
|---|---|---|---|
| Spacing | 4·8·12·16·24·32·48 | xs4 / sm8 / md12 / lg16 / xl20 / x2l24 / x3l32 / x4l40 | 🟠 minor: Dart inserts **20**, tops at **40** (no 48) |
| Radius | sm/md/lg/xl | sm4 / md8 / lg12 / xl16 / full999 | ✅ |
| Shadow | sm/md/lg | `BoxShadow` sm/md/lg | ✅ |
| Density | — | `LetbuyyDensityTokens` (compact/comfortable/spacious) | Dart-only (fine for mobile) |

**Divergence to fix:** add `x5l48` (or align web to drop 48) so the scales are identical; document the `20` step. Low priority.

---

## 4. Component mapping (web → Flutter)

| Web component | Flutter equivalent | Status |
|---|---|---|
| AdminShell (Header + Sidebar + CommandPalette) | `store_main_screen.dart` 5-tab bottom nav | 🟠 different paradigm (mobile tabs vs desktop sidebar) — correct for mobile |
| Cards / surfaces | ui_kit `GlassContainer`, `AppThemeColors.glassCard/bentoCard/solidCard` | ✅ richer on mobile (glassmorphism) |
| Tables (orders, products, customers) | Flutter `ListView`/cards (`products_screen`, `orders_screen`) | 🟠 mobile uses cards/lists, not tables — appropriate |
| Forms (`SchemaFormRenderer`) | `product_form_screen`, editor settings sheets | 🟠 schema-form renderer **not** generalized on mobile |
| Buttons | ui_kit `CustomButton` + Material 3 themes | ✅ |
| Inputs | ui_kit `CustomTextField` | ✅ |
| Dialogs / modals | ui_kit `ConfirmationDialog`; `store_theme.dart` dialog/sheet themes (radius 20) | ✅ |
| Badges / status chips | ui_kit `BadgeWidget`; chip theme | ✅ |
| Empty/Loading/Error states | ui_kit `EmptyState`, `LoadingIndicator/Overlay`, `ErrorView`, `ShimmerLoading` | ✅ strong |
| Theme editor panels | `widgets/editor/*` (sheets, layers drawer, device frames) | ✅ native, advanced |
| Navigation menu builder | — | ❌ missing on mobile |
| App Bridge (embedded iframe) | — | ❌ missing on mobile (hard) |

---

## 5. What's already good (keep)

- **Token mirror exists** TS→Dart with matching brand purple, Inter, and spacing/radius/shadow — the hard part is done.
- **Mobile design language is richer than web in places:** glassmorphism system, elevation scale, motion constants, density tokens, bento/glass card presets, device-frame previews — these are genuinely mobile-native and on-brand.
- **Material 3 theming** in `store_theme.dart` is comprehensive (AppBar, buttons, inputs, cards, chips, bottom-nav, FAB, dialogs, sheets, snackbar) with standardized radii.

---

## 6. Alignment backlog (do, in order)

1. **Kill hardcoded `Color(0xFF8B5CF6)`** across screens → reference `LetbuyyColorTokens`/`AppThemeColors`. (Highest-value: makes the brand single-sourced.)
2. **Resolve Poppins vs Inter** → standardize on Inter (match web). Fix `ui_kit/AppTextStyles`.
3. **Collapse the two Dart color systems** → `AppThemeColors`/tokens canonical; `StoreAdminColors` becomes an alias.
4. **Reconcile "secondary" color naming** (`#6366F1` vs `#7C3AED`).
5. **Add the `48` spacing step** (or align web) so scales match exactly.
6. **Generalize a schema-form renderer** on mobile to mirror `SchemaFormRenderer` (enables fast build-out of the missing settings screens with consistent styling).
7. **Document the mobile component library** (ui_kit widgets) as the counterpart to `docs/design-system/README.md`, and regenerate that stale README (it still references deleted files).

**Non-goals:** redesigning the visual language, changing the brand purple, or porting the desktop sidebar IA verbatim. Mobile keeps tabs + sheets; web keeps sidebar — same tokens, platform-appropriate layout.
