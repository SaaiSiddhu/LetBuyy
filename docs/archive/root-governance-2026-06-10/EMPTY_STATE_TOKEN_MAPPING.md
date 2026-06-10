# LetBuyy Empty State Token Mapping

**Phase 6 of the Empty State Design System mission.** Every element of the empty-state system mapped to the exact design token that drives it, with light/dark resolved values traced to `packages/typescript/ui/src/tokens.ts`. This is what makes the illustrations *token-driven* rather than decorated — change a token, the whole system moves.

- **Date:** 2026-06-09
- **Rule:** in-product code references the **CSS variable**; concrete hex appears only in the static `assets/*.svg` library (for Canva / design hand-off). Both columns below are derived from the same token, so they can never drift.

---

## 1. Color tokens

| Element | Token (CSS var) | Source in `tokens.ts` | Light | Dark |
|---|---|---|---|---|
| Illustration ink (all line-art) | `--lb-component-empty-state-illustration-ink` | `component.*.emptyState.illustrationInk` → `semantic.accent.brand` | `#8B5CF6` | `#8B5CF6` |
| Tinted panel fill | `--lb-component-empty-state-illustration-bg` | `…emptyState.illustrationBg` → `semantic.accent.subtle` | `rgba(139,92,246,0.12)` | `rgba(139,92,246,0.12)` |
| Card / chip surface | `--lb-component-empty-state-bg` | `…emptyState.bg` → `semantic.background.card` | `#FFFFFF` | `#1F2937` |
| Dashed border + chip hairline | `--lb-component-empty-state-border` | `…emptyState.border` → `semantic.border.default` | `#E5E7EB` | `#334155` |
| Title text | `--lb-component-empty-state-title` | `…emptyState.title` → `semantic.text.primary` | `#111827` | `#FFFFFF` |
| Body text | `--lb-component-empty-state-body` | `…emptyState.body` → `semantic.text.secondary` | `#6B7280` | `#CBD5E1` |
| Primary CTA fill | `--lb-component-button-primary-bg` | `component.*.button.primary.bg` (purple-700) | `#6D28D9` | `#6D28D9` |
| Primary CTA text | `--lb-component-button-primary-text` | `…button.primary.text` | `#FFFFFF` | `#FFFFFF` |
| Secondary CTA border | `--lb-color-border` | `color.*.border` | `#E5E7EB` | `#334155` |
| Secondary CTA text | `--lb-color-text` | `color.*.text` | `#111827` | `#FFFFFF` |
| Focus ring (CTAs) | `--lb-color-focus-ring` | `semantic.focusRing` | `#5B21B6` | `#8B5CF6` |
| Page background (behind card) | `--lb-color-bg` | `semantic.background.page` | `#F6F7F9` | `#111827` |

**The theme-invariance that makes one ink work in both modes:** `illustrationInk` and `illustrationBg` resolve to `accent.brand` / `accent.subtle`, which are identical in `semantic.light` and `semantic.dark` (`tokens.ts:223–229` vs `287–293`). Only surface/border/title/body flip.

### 1.1 Opacity ladder (applied to the ink)

The motif is one color at graded opacity — these are the only allowed steps, encoded directly in the SVG (no token needed, but governed):

| Layer | Opacity | Used by |
|---|---|---|
| Inner frame stroke | `0.20` | shared frame |
| Horizon wave | `0.22` | shared frame |
| Primary motif strokes | `0.55–0.70` | the meaning |
| Secondary motif strokes | `0.34–0.50` | supporting detail |
| Soft fills / floating accent | `0.10–0.28` | depth, `data-lb-empty-float="secondary"` |
| Solid accent dot (rare) | `0.85–0.90` | e.g. `notifications` badge |

---

## 2. Spacing tokens

| Element | Token | Value |
|---|---|---|
| Outer column gap (illus→copy→actions) | `--lb-density-section-gap` | 12 / 16 / 20px (compact/comfortable/spacious) |
| Card padding | `--lb-density-card-padding` | 16 / 20 / 24px |
| Title↔body gap | `--lb-space-2` | 8px |
| Action button gap | `--lb-space-2` | 8px |
| Copy block max-width (measure) | `--lb-size-empty-state-measure` | 440px |

## 3. Typography tokens

| Element | Size token | Line-height token | Weight |
|---|---|---|---|
| Title | `--lb-font-size-card-title` (16px) | `--lb-line-height-card-title` (20px) | `--lb-font-weight-semibold` (600) |
| Body | `--lb-font-size-empty-state` (14px) | `--lb-line-height-empty-state` (20px) | `--lb-font-weight-regular` (400) |
| CTA label | `--lb-font-size-body` (14px) | `--lb-line-height-body` (20px) | `--lb-font-weight-medium` (500) |
| Family | `--lb-font-family-body` | — | — |

## 4. Border-radius tokens

| Element | Token | Value |
|---|---|---|
| Empty-state container | `--lb-component-card-radius` | 16px |
| Illustration tinted panel | (SVG `rx`) `--lb-radius-xl` | 16px |
| Illustration inner frame | (SVG `rx`) `--lb-radius-lg` | 12px |
| Icon chip | `--lb-radius-xl` | 16px |
| CTA buttons | `--lb-radius-md` | 8px |

## 5. Elevation / shadow tokens

| Element | Token | Light | Dark |
|---|---|---|---|
| Icon chip float | `--lb-component-card-shadow` | `0 1px 2px rgb(15 23 42 /5%), 0 8px 24px rgb(15 23 42 /4%)` | `0 1px 2px rgb(0 0 0 /18%), 0 10px 26px rgb(0 0 0 /16%)` |
| Toast/SaveBar (adjacent) | `--lb-shadow-lg` | `0 12px 32px rgb(15 23 42 /8%)` | same geometry |

The container itself is **flat** (no shadow) — only the chip is elevated, which is what reads as "floating".

## 6. Surface & density / sizing tokens

| Element | Token | compact | comfortable | spacious |
|---|---|---|---|---|
| Illustration width | `--lb-density-empty-state-illustration-width` | 160px | 184px | 208px |
| Illustration height | `--lb-density-empty-state-illustration-height` | 108px | 122px | 138px |
| Container min-height | `--lb-density-empty-state-min-height` | 180px | 220px | 260px |
| Empty-state scale hook | `--lb-density-empty-state-scale` | 0.72 | 0.88 | 1.0 |
| Chip side (= button-lg) | `--lb-density-button-height-large` | 40px | 44px | 48px |
| Page/chip glyph size | `--lb-density-page-icon-size` | 18px | 20px | 22px |

**Surfaces:** empty states reference only semantic/component tokens, so they inherit any `[data-letbuyy-surface]` scope (admin/marketplace/storefront/identity/operations) without per-surface art.

## 7. Motion tokens

| Element | Token / keyframe | Value |
|---|---|---|
| Primary motif float | `@keyframes lb-empty-state-float` | 4.8s ease-in-out infinite, translateY 0→−6px→0 |
| Secondary accent drift | `@keyframes lb-empty-state-drift` | 5.6s ease-in-out infinite, translate + opacity 0.72→1 |
| Hover lift | `--lb-motion-hover-lift` / `--lb-motion-slow` / `--lb-ease-out` | 4px, 200ms, ease-out |
| Reduced motion | `@media (prefers-reduced-motion: reduce)` | all the above → `none` / 0 (`tokens.ts:1360–1372`) |

---

## 8. Static-asset baked values (design library / Canva only)

The `assets/<motif>.<theme>.svg` files alpha-composite the tinted panel over the card so they're correct standalone:

| Baked element | Light | Dark | Derivation |
|---|---|---|---|
| Panel fill | `#F1EBFE` | `#2C2F4E` | `#8B5CF6 @ 12%` over card (`#FFFFFF` / `#1F2937`) |
| Ink | `#8B5CF6` | `#8B5CF6` | theme-invariant |
| Card/chip | `#FFFFFF` | `#1F2937` | `background.card` |
| Border | `#E5E7EB` | `#334155` | `border.default` |
| Chip shadow | `0 6px / 12 blur #0F172A @8%` | `0 8px / 16 blur #000 @30%` | ≈ `cardLight` / `cardDark` |

These are **outputs of the generator** (`generate-empty-states.mjs`), computed from the tokens above — never hand-edited.

## 9. Wiring new motifs into the live component (future, optional)

The 7 new motifs extend the existing `EmptyStateKind` union. If/when LetBuyy ships them (out of scope for this deliverables-only pass), the change is additive and localized:

| New motif | Add to `EmptyStateKind` (`feedback.tsx:332`) | `emptyStateIconMap` glyph (lucide) | `renderEmptyStateMotif` case |
|---|---|---|---|
| `shipping` | `'shipping'` | `Truck` | new `case 'shipping'` |
| `payouts` | `'payouts'` | `Banknote` / `Landmark` | new case |
| `messaging` | `'messaging'` | `MessageCircle` | new case |
| `notifications` | `'notifications'` | `Bell` | new case |
| `identity` | `'identity'` | `IdCard` / `Fingerprint` | new case |
| `security` | `'security'` | `ShieldCheck` | new case |
| `permissions` | `'permissions'` | `KeyRound` / `UserCog` | new case |

Existing kinds (`generic, orders, products, inventory, customers, payments, discounts, analytics, domains, themes, apps`) already map 1:1. `marketing`/`content`/`collections` remain as aliases (marketing→`discounts` motif, etc.). **No new tokens are required** — every value the new motifs need already exists, which validates the Audit §12 conclusion that the gap was coverage, not architecture.

*Cross-references:* [[LETBUYY_DESIGN_LANGUAGE_AUDIT]], [[EMPTY_STATE_GOVERNANCE]], [[EMPTY_STATE_INVENTORY]], [[EMPTY_STATE_SCORECARD]].
