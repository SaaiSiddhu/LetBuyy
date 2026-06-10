# LetBuyy Design Language Audit

**Phase 0 of the Empty State Design System mission.** This is the evidence base for every downstream decision. It documents the design language *as it actually exists in code* — not as aspiration. Every value below is traced to a file, and where the code contradicts the docs or itself, that is called out.

- **Date:** 2026-06-09
- **Source of truth:** `packages/typescript/ui/src/tokens.ts` (1,389 lines), `packages/typescript/ui/src/feedback.tsx`, `packages/typescript/ui/src/fonts.ts`, `docs/design-system/*`, `config/tailwind/letbuyy-tokens.css`
- **Companion reports already in repo:** `DESIGN_TOKEN_AUDIT.md`, `DESIGN_SYSTEM_MASTER_AUDIT.md`, `THEME_ARCHITECTURE_AUDIT.md`, `LIGHT_DARK_MODE_AUDIT.md`, `TYPOGRAPHY_SPACING_AUDIT.md`. This audit does not restate them; it extracts the slice the empty-state system depends on.

---

## 0. Executive summary

LetBuyy already has a **Polaris-grade, three-tier token architecture** (primitive → semantic → component), light/dark/system theming through a single provider, three densities, five surfaces, brand-injection with WCAG contrast validation, and — critically for this mission — **a fully tokenized `EmptyState` and `EmptyStateIllustration` component that already ships**. The design language is mature; the gap is not architecture but **coverage, governance, and documentation of the illustration layer**.

The single most important finding for this mission:

> **The LetBuyy empty-state illustration language already exists and is opinionated.** It is *monochrome brand-purple line-art* (`currentColor` = `#8B5CF6`) drawn at graded opacity on a *purple-subtle tinted panel*, with exactly one *floating secondary motif* and a *central elevated icon chip*, animated by two named keyframes and disabled under reduced-motion. This is a Stripe/Linear-class system, not a placeholder. The mission must **extend** it, not replace it.

A second finding governs color: **the product UI accent is purple; the marketing logo is a blue 3D gradient mark.** These are intentionally different registers. Operator empty states live in the product UI and therefore inherit the *purple line-art* register, never the 3D blue logo treatment.

---

## 1. Color system

### 1.1 Primitive palette — `tokens.ts:47–121` (`letbuyyPrimitiveTokens.color`)

| Ramp | Stops (hex) |
|---|---|
| **purple (brand)** | 100 `#EDE9FE` · 200 `#DDD6FE` · 300 `#C4B5FD` · 400 `#A78BFA` · **500 `#8B5CF6`** · 600 `#7C3AED` · 700 `#6D28D9` · 800 `#5B21B6` · 900 `#4C1D95` |
| gray | 50 `#F9FAFB` · 100 `#F5F5F7` · 125 `#F6F7F9` · 150 `#EFEFF1` · 175 `#F1F2F4` · 200 `#E5E7EB` · 300 `#D1D5DB` · 400 `#94A3B8` · 500 `#6B7280` · 600 `#4B5563` · 700 `#374151` · 800 `#1F2937` · 900 `#111827` |
| slate | 200 `#E2E8F0` · 300 `#CBD5E1` · 400 `#94A3B8` · 600 `#475569` · 700 `#334155` · 800 `#1E293B` · 850 `#1F2937` · 900 `#0F172A` · 950 `#0A0F1A` |
| green | 100 `#DCFCE7` · 500 `#22C55E` · 700 `#15803D` · 950 `#052E16` |
| amber | 100 `#FEF3C7` · 500 `#F59E0B` · 800 `#92400E` · 950 `#422006` |
| red | 100 `#FEE2E2` · 300 `#FCA5A5` · 500 `#EF4444` · 600 `#DC2626` · 700 `#B91C1C` · 950 `#451A1A` |
| blue (info) | 100 `#E0F2FE` · 300 `#7DD3FC` · 500 `#3B82F6` · 700 `#1D4ED8` · 950 `#082F49` |
| neutral | white `#FFFFFF`, black `#000000` |
| opacity | `purpleSubtle` = `rgba(139,92,246,0.12)`; overlays `rgb(15 23 42 / 56%)` (light) / `rgb(0 0 0 / 64%)` (dark) |

**Brand anchor:** purple `500 #8B5CF6` is `brandPurple`/`primary`; the *CTA* fill is the darker `700 #6D28D9` (`button.primary.bg`) for AA text contrast on purple. This split — light accent for ink, dark accent for filled buttons — is the backbone of the whole UI.

### 1.2 Semantic tiers — `tokens.ts:186–315` (`letbuyySemanticTokens.light/dark`)

Resolved values that empty states consume:

| Role | Light | Dark |
|---|---|---|
| `background.page` | `#F6F7F9` (gray-125) | `#111827` (gray-900) |
| `background.card` | `#FFFFFF` | `#1F2937` (slate-850) |
| `background.subdued` | `#F9FAFB` | `#0A0F1A` |
| `text.primary` | `#111827` | `#FFFFFF` |
| `text.secondary` | `#6B7280` (gray-500) | `#CBD5E1` (slate-300) |
| `border.default` | `#E5E7EB` | `#334155` |
| `accent.brand` | `#8B5CF6` | `#8B5CF6` |
| `accent.subtle` | `rgba(139,92,246,0.12)` | `rgba(139,92,246,0.12)` |
| `status.success / warning / danger / info` | `#22C55E` / `#F59E0B` / `#EF4444` / `#3B82F6` | same hues |
| `focusRing` | `#5B21B6` (purple-800) | `#8B5CF6` |

**Key insight for illustration:** `accent.brand` and `accent.subtle` are **identical across light and dark**. The brand purple ink and its 12% tinted panel are *theme-invariant*; only the card surface, hairline border, and elevation flip. This is exactly why a single ink color can serve both modes (verified visually in the generated gallery).

### 1.3 Status text/soft pairs — `tokens.ts:236–311`

Light uses dark-on-pale (`statusText.success #15803D` on `statusSoft.success #DCFCE7`); dark uses bright-on-deep (`#22C55E` on `#052E16`). Empty states do not use status color except for the rare *error/destructive* empty state (see Governance §error states).

### 1.4 Brand injection + contrast validation — `tokens.ts:1154–1234`

`createLetbuyyBrandVariables()` lets a merchant override `--lb-color-primary` and derives hover/active/subtle/CTA, including **`--lb-component-empty-state-illustration-bg` and `--lb-component-empty-state-illustration-ink`** (lines 1231–1232). `validateLetbuyyBrandContrast()` (1154–1185) computes WCAG ratios for primary text (≥4.5), CTA text (≥4.5), focus ring (≥3). **Consequence:** illustrations must read on *any* injected brand color, which is the strongest possible argument for the monochrome-`currentColor` approach — it re-tints automatically.

---

## 2. Typography system — `tokens.ts:672–730`, `fonts.ts`

- **Families** (`fonts.ts`): body = `--font-letbuyy-sans` → `ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI"`; display = `--font-letbuyy-display` (falls back to sans); mono = `--font-letbuyy-mono`.
- **Role-based scale** (px): display 32 · h1 28 · h2 24 · h3 20 · h4 18 · pageTitle 24 · sectionTitle 18 · cardTitle 16 · bodyLarge 16 · **body 14** · secondary/table 13 · **emptyState 14** · caption/badge 12. Fluid clamps exist for hero type (`displayFluid`, `h1Fluid`, `h2Fluid`).
- **Line heights** are absolute px paired to each size (e.g. body 14/20, cardTitle 16/20, emptyState 14/20).
- **Weights:** regular 400 · medium 500 · semibold 600 · bold 700.

**Empty-state typography is already defined as its own role:** title = `cardTitle` (16/20, **semibold**), body = `emptyState` (14/20, regular), exposed as `--lb-font-size-empty-state` / `--lb-line-height-empty-state`.

---

## 3. Spacing system — `tokens.ts:731–744`

Numeric scale (4px base): none 0 · xs 4 · sm 8 · md 12 · lg 16 · xl 20 · 2xl 24 · 3xl 32 · 4xl 40 · 5xl 48 · 6xl 64 · 7xl 96. Emitted as both numeric (`--lb-space-1..11`) and named (`--lb-space-xs..xl`) variables (`tokens.ts:894–910`). Density overrides gaps/padding (see §6).

---

## 4. Border radius system — `tokens.ts:745–751`

sm 4 · md 8 · lg 12 · xl 16 · full 999. **Cards and the empty-state panel use `xl` (16px)**; the inner illustration frame uses `lg` (12px); pills/badges use `full`. The icon chip uses `xl` (16px) rounding.

---

## 5. Elevation system — `tokens.ts:149–155`

| Token | Value |
|---|---|
| `sm` | `0 1px 2px rgb(0 0 0 / 4%)` |
| `md` | `0 4px 12px rgb(15 23 42 / 6%)` |
| `lg` | `0 12px 32px rgb(15 23 42 / 8%)` |
| `cardLight` | `0 1px 2px rgb(15 23 42 / 5%), 0 8px 24px rgb(15 23 42 / 4%)` |
| `cardDark` | `0 1px 2px rgb(0 0 0 / 18%), 0 10px 26px rgb(0 0 0 / 16%)` |

Elevation is **soft and low**: a tight contact shadow plus a wide ambient shadow. Dark mode deepens opacity rather than changing geometry. The empty-state icon chip carries `--lb-component-card-shadow` (= cardLight/cardDark), which is what makes it "float" above the tinted panel.

---

## 6. Surface & density systems

- **Surfaces** — `tokens.ts:1113` (`admin`, `marketplace`, `storefront`, `identity`, `operations`). Each emits a scoped CSS variable set via `[data-letbuyy-surface]` selectors (`tokens.ts:1253–1272`). Empty states inherit whatever surface they render in; they reference *semantic/component* tokens, never surface-specific ones, so they are surface-portable.
- **Density** — `tokens.ts:500–585` (`compact` / `comfortable` / `spacious`). Density controls the **entire empty-state footprint**:

| Density | illustration W×H | min-height | scale | page icon |
|---|---|---|---|---|
| compact | 160×108 | 180px | 0.72 | 18px |
| comfortable | 184×122 | 220px | 0.88 | 20px |
| spacious | 208×138 | 260px | 1.0 | 22px |

These are first-class tokens (`emptyStateIllustrationWidth/Height`, `emptyStateMinHeight`, `emptyStateScale`), proving empty states were designed as a system primitive, not an afterthought.

---

## 7. Motion system — `tokens.ts:753–771`, `1360–1387`

- **Durations:** hover/menu/fast 150ms · normal 180ms · slow 200ms · carousel 300ms.
- **Easing:** standard/out = `ease-out`; emphasized = `cubic-bezier(0.16, 1, 0.3, 1)`.
- **Transforms:** hover lift 2px, hover scale 1.01.
- **Empty-state-specific keyframes** (`tokens.ts:1374–1387`): `lb-empty-state-float` (4.8s, translateY ±6px) on `[data-lb-empty-float="primary"]`; `lb-empty-state-drift` (5.6s, translate + opacity 0.72→1) on `[data-lb-empty-float="secondary"]`.
- **Reduced motion** (`tokens.ts:1360–1372`): all motion durations zeroed and `[data-lb-empty-float]` animations set to `none !important` under `prefers-reduced-motion: reduce`.

Motion is *ambient and slow* — a gentle float, never a bounce or spin. This is the Linear/Stripe register and rules out playful "flying rocket" motion.

---

## 8. Iconography — `packages/typescript/ui/src/icons.tsx`, `feedback.tsx:1–25`

A single curated **lucide-react** export set (`Activity, AlertCircle, BarChart3, ClipboardList, CreditCard, Globe, LayoutGrid, Megaphone, Package, Palette, Puzzle, ShoppingBag, Sparkles, Tag, Users, …`). Stroke-based, 2px nominal weight, round caps, 24×24 grid. The page-header icon treatment (`tokens.ts:372–382`) uses stroke-width `2.45` with an 18% `currentColor` fill — a slightly heavier, "duotone-lite" look. **Empty-state chips reuse these exact icons**, so any new illustration must pair with a lucide glyph and the same stroke language.

---

## 9. Illustration style (the load-bearing finding) — `feedback.tsx:321–538`

The shipping `EmptyStateIllustration` defines the language precisely:

1. **Canvas:** `viewBox 0 0 192 128`, `fill="none"`.
2. **Panel:** rounded rect (rx 16) filled with `--lb-component-empty-state-illustration-bg` (purple-subtle).
3. **Inner frame:** rounded rect (rx 12) stroked in `currentColor` at opacity 0.2.
4. **Horizon:** a single soft wave path at opacity 0.22.
5. **Motif:** a per-kind group (`data-lb-empty-float="primary"`) of strokes/fills in `currentColor` at graded opacity (0.1–0.7), plus one element marked `data-lb-empty-float="secondary"` that drifts.
6. **Chip:** a `button-height-large` square, rounded `xl`, `--lb-component-empty-state-bg` fill, hairline border, `--lb-component-card-shadow`, centered, holding the lucide glyph.
7. **Color:** the whole illustration is **one color** — `currentColor` resolved from `--lb-component-empty-state-illustration-ink` — at varying opacity. No gradients, no second hue.

`EmptyStateKind` (`feedback.tsx:332–346`) already enumerates 14 kinds: `generic, products, collections, inventory, orders, customers, discounts, marketing, content, domains, themes, analytics, apps, payments`, each with a motif (`renderEmptyStateMotif`, 365–478) and an icon (`emptyStateIconMap`, 348–363).

**Explicitly *not* the illustration language:** the marketing app mark (`apps/marketing-site/public/icons/letbuyy-mark.svg`) is a multi-gradient **blue 3D** storefront-in-phone with globe/orbit and drop-shadow filters. It is a *logo*, a different register, and must not leak into operator empty states.

---

## 10. Component language — `feedback.tsx`, `tokens.ts:317–488`

Component tokens exist per theme for `button`, `card`, `sidebar`, **`emptyState`**, `input`, `table`, `pageHeader`, `badge`, `banner`. The `emptyState` component token (`tokens.ts:344–351`, `429–436`) is explicit:

```
emptyState: { bg, border, illustrationBg, illustrationInk, title, body }
```

The `EmptyState` component itself (`feedback.tsx:510–538`) is the canonical layout: dashed-border card (rx = card radius), centered column — illustration → (title + body, max-width 440px via `--lb-size-empty-state-measure`) → actions (secondary then primary). This is the contract the new illustrations and governance must honor.

**Adjacent components** that set the visual tone empty states sit among: `Badge`/`StatusBadge` (pill, `statusToBadgeVariant` maps strings→tone), `Banner`, `Toast`, `Skeleton` (the loading counterpart to empty), `SaveBar`. All are token-driven with `var(--lb-*)` classes — there are **no raw hex values** in `feedback.tsx`.

---

## 11. Light/dark architecture — `docs/design-system/dark-mode.md`, `tokens.ts:1236–1298`

One provider — `LetbuyyThemeProvider` (`@letbuyy/ui`) — owns `light | dark | system`, persists to `localStorage["letbuyy-theme"]`, sets `<html data-theme>` + `.light/.dark`, and renders `DesignSystemRoot` with the **resolved** theme (never `auto`). `<ThemeScript>` prevents flash. `letbuyyTokenCss` (`tokens.ts:1274–1388`) emits `:root`/`[data-theme]`/`@media (prefers-color-scheme)` blocks. Enforced by `validate:design-system`. **Implication:** an empty state never needs to know the theme; it reads `--lb-component-empty-state-*` and is correct in both. The new illustration assets are delivered in both concrete-hex variants only for the *static design library / Canva* — the in-app path stays variable-driven.

---

## 12. What this means for the Empty State System (hand-off to Phase 1)

1. **Adopt, don't invent.** The line-art-on-tinted-panel-with-chip language is canonical and excellent. Extend it.
2. **Stay monochrome + `currentColor`.** It is the only approach that survives merchant brand-injection and theme-invariance.
3. **Reuse the existing tokens** — `--lb-component-empty-state-*`, density footprint tokens, `emptyStateMeasure`, the two float keyframes. Do not introduce new tokens unless a real gap exists (Phase 6 confirms none is needed).
4. **Curate, don't proliferate.** 14 kinds already cover the core; the 40-surface inventory should map to ~18 motifs, not 40 one-offs (Phase 2/3).
5. **Reject** 3D, gradients, characters, mascots, undraw/clipart, and the blue logo treatment — all contradict the documented language above.

*Cross-references:* [[EMPTY_STATE_GOVERNANCE]], [[EMPTY_STATE_INVENTORY]], [[EMPTY_STATE_TOKEN_MAPPING]], [[EMPTY_STATE_SCORECARD]].
