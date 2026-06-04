# LetBuyy Brand Decision Report

Generated: 2026-06-03
Scope: color only. This report does not analyze components, typography, spacing, icons, or layout.

## Decision

LetBuyy's official brand direction is **Purple**, anchored on **`#8B5CF6`**.

`#8B5CF6` becomes **LetBuyy Brand Purple** and the canonical brand anchor for web, Flutter, platform, developer, and future product surfaces.

## Runtime Evidence

The repository does not currently have one unified brand source. The active color sources are split across runtimes:

| Runtime | Runtime source | Current brand signal | Decision |
|---|---|---:|---|
| Merchant Flutter App | `apps/mobile/merchant-app/lib/main.dart` -> `apps/mobile/merchant-app/lib/app/app.dart` -> `apps/mobile/merchant-app/lib/theme/store_theme.dart` -> `packages/dart/ui_kit/lib/src/themes/app_colors.dart` | `#00B3B3` | Replace |
| Merchant Control Plane | `apps/merchant-control-plane/src/app/layout.tsx` -> `DesignSystemRoot` plus `apps/merchant-control-plane/src/app/globals.css` | `#8B5CF6` | Canonical, align shared tokens |
| Shared UI Package | `packages/typescript/ui/src/design-system-root.tsx` -> `packages/typescript/ui/src/tokens.ts` | `#2563eb` | Replace |
| Platform Console | `apps/platform-console/src/app/layout.tsx` -> `DesignSystemRoot`; local login/dashboard classes | Red | Replace as brand, keep as danger |
| Platform Operations Portal | `apps/platform-operations-portal/src/app/layout.tsx` -> `DesignSystemRoot`; local login/invite/dashboard classes | Indigo | Replace as brand |
| Developer/App Marketplace | `apps/app-marketplace/src/app/layout.tsx` -> `DesignSystemRoot` plus `apps/app-marketplace/src/app/globals.css` | `#8B5CF6` | Canonical, align shared tokens |

Key code references:

- `apps/mobile/merchant-app/lib/main.dart:59` creates `ThemeProvider()..loadTheme()`.
- `apps/mobile/merchant-app/lib/app/app.dart:20` applies `StoreTheme.light()`.
- `apps/mobile/merchant-app/lib/app/app.dart:21` applies `StoreTheme.dark()`.
- `apps/mobile/merchant-app/lib/services/theme_provider.dart:9` defaults runtime theme mode to dark.
- `packages/dart/ui_kit/lib/src/themes/app_colors.dart:8` sets Flutter `AppColors.primary` to `Color(0xFF00B3B3)`.
- `apps/merchant-control-plane/src/app/globals.css:16` sets `--primary: #8B5CF6`.
- `packages/typescript/ui/src/tokens.ts:19` sets shared UI light primary to `#2563eb`.
- `packages/typescript/ui/src/tokens.ts:44` sets shared UI dark primary to `#60a5fa`.
- `apps/platform-console/src/app/(auth)/login/page.tsx:94` uses `bg-red-600` as the login action color.
- `apps/platform-operations-portal/src/app/(auth)/login/page.tsx:38` uses `bg-indigo-600` as the login action color.
- `apps/app-marketplace/src/app/globals.css:15` sets `--primary: #8B5CF6`.

## Candidate Evaluation

| Candidate | Existing source | Premium SaaS feel | Dark mode quality | Light mode quality | Accessibility | Merchant trust | Memorability | Migration cost | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| Cyan `#00B3B3` | Flutter `AppColors.primary`, isolated editor values | Medium | Medium | Medium | Weak for small white text | Medium | Medium | High | Reject |
| Purple `#8B5CF6` | Merchant Control Plane, App Marketplace, Flutter sub-surfaces | High | High | High | Good with darker ladder | High | High | Low-medium | Select |
| Blue `#2563EB` | Shared UI package default | Medium | High | High | High | High | Low | Medium | Reject |
| Indigo `#6366F1` | Operations portal and support shade | Medium-high | High | High | Good | Medium-high | Medium | Medium | Reject as primary |
| Red | Platform Console brand-like action color | Low as brand | Medium | Medium | Good | Low for default brand | High, wrong meaning | Medium | Reject as brand |

## Final Recommendation

**Purple wins. `#8B5CF6` becomes LetBuyy Brand Purple.**

This is the correct permanent direction because it is already the strongest runtime signal in merchant-facing web surfaces, app marketplace/developer surfaces, and Flutter merchant sub-surfaces. Cyan is isolated to Flutter `ColorScheme`, blue is an unbranded shared UI default, red is an operations danger/accent color, and indigo is a nearby support shade rather than the clearest brand.

## Rejected Directions

### Cyan `#00B3B3`

Reject as official brand.

Cyan is isolated to the Flutter UI kit runtime primary and a few Flutter/editor surfaces. It is weaker for premium SaaS positioning, has poorer white-text contrast at small sizes, and reads closer to utility, health, fintech, or operational status than Shopify-class commerce management.

### Blue `#2563EB`

Reject as official brand.

Blue is accessible and stable, but generic. In the repository it is primarily a shared UI package default rather than an intentional LetBuyy brand direction. Keeping blue as the brand would flatten LetBuyy's memorability and make the product feel like a default SaaS scaffold.

### Indigo `#6366F1`

Reject as primary brand.

Indigo is a useful support shade and can remain close to the purple family where already appropriate, but it is less aligned with the merchant control plane and app marketplace than `#8B5CF6`.

### Red

Reject as brand.

Red must remain reserved for danger, critical operations, destructive actions, failed states, and security risk. It should not define LetBuyy's default product identity.

## Accessibility Decision

`#8B5CF6` is the brand anchor. For small white-text primary buttons, use the darker interaction ladder where needed:

| Token | Value | White text role |
|---|---:|---|
| Primary | `#8B5CF6` | Brand anchor, larger CTAs, focus/accent |
| Primary Hover | `#7C3AED` | Preferred small-button background when contrast requires it |
| Primary Active | `#6D28D9` | Strongest small-button and pressed-state background |

## Product Implication

After migration, every LetBuyy runtime should feel like one company:

- Merchant App
- Merchant Control Plane
- Platform Console
- Platform Operations Portal
- Developer/App Marketplace
- Future Apps

This is a color-source decision only. It does not require redesigning components or changing product hierarchy.
