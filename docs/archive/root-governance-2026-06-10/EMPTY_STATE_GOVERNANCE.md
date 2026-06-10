# LetBuyy Empty State Governance

**Phases 1 & 2 of the Empty State Design System mission** — the rulebook and the style decision. Phase 0 (`LETBUYY_DESIGN_LANGUAGE_AUDIT.md`) is the evidence; this document turns it into enforceable rules. If an empty state violates a **MUST** here, it is a bug.

- **Date:** 2026-06-09
- **Applies to:** every LetBuyy surface that can be empty — Merchant Control Plane, Identity Platform, App Marketplace, Storefront Runtime admin, Platform Console, Operations Portal, Developer Portal, and the mobile merchant app (parity, not pixel-identical).
- **Owner component:** `EmptyState` / `EmptyStateIllustration` in `@letbuyy/ui` (`feedback.tsx`).

---

## 1. What an empty state is for

An empty state is shown when a collection, view, or result set has **zero items**. It must do three jobs, in priority order:

1. **Orient** — say what this surface is and why it's empty (first run vs. filtered-to-nothing vs. error vs. permission).
2. **Activate** — give the single most useful next action, and at most one alternative.
3. **Reassure** — make "nothing here" feel intentional and safe, never broken.

Empty ≠ loading ≠ error. Use `Skeleton` while loading; use the empty state only once data has resolved to zero. See §9 for the four empty-state *types*.

---

## 2. The style decision (Phase 2)

The mission asked us to choose between six illustration styles. We evaluated each against the documented LetBuyy language and the brand bar (Stripe / Linear / Shopify, India-first, operator-focused, trustworthy B2B). **Decision: A token-driven monochrome line-art system** — formally, *"flat illustration"* (option C) executed as single-color `currentColor` line work on a tinted panel with a central icon chip. This is not a new style; it is the **codification of what `EmptyStateIllustration` already does**.

| # | Candidate style | Verdict | Evidence / reason |
|---|---|---|---|
| A | Product mockups (screenshots of UI) | ❌ Reject | Brittle (every UI change re-shoots them), heavy, can't theme or brand-inject, reads as marketing not operator tooling. |
| B | 3D isometric objects | ❌ Reject | That register belongs to the **logo** (`letbuyy-mark.svg`, blue 3D). Using it in-app would split the brand and fight the flat UI. Can't bind to a single `currentColor`/brand token. |
| **C** | **Flat illustration (line-art)** | ✅ **Adopt** | Exactly the existing `EmptyStateIllustration` language; theme-invariant; survives brand-injection; matches lucide iconography; Stripe/Linear register. |
| D | Glassmorphism | ❌ Reject | Blur/transparency stacks fail on the dashed-card surface, tank contrast in dark mode, and aren't anywhere else in the system. |
| E | Characters / mascots | ❌ Reject | Not operator-appropriate; ages badly; localization/culture risk for an India-first B2B tool; no precedent in the codebase. |
| F | Abstract shapes | ⚠️ Partial | Permitted *only* as the secondary floating accent and the panel/horizon — never as the primary meaning-bearing motif. Pure abstraction fails the "Commerce relevance" score (Phase 7). |

### 2.1 Style board — the one visual language

Every illustration is built from the same five-layer recipe (the live reference is `docs/design-system/empty-states/gallery.html`):

```
┌─────────────────────────────────────────┐
│  ① tinted panel  (rx16, purple-subtle)    │
│   ┌───────────────────────────────────┐   │
│   │ ② inner frame (rx12, ink @ .20)    │   │
│   │        ╭───────╮                    │   │
│   │  ④motif│ ③chip │ + ⑤ floating accent │   │
│   │        ╰───────╯  (drift, ink @ .12)│   │
│   │  ~~~ horizon wave (ink @ .22) ~~~   │   │
│   └───────────────────────────────────┘   │
└─────────────────────────────────────────┘
   one ink colour · graded opacity · 192×128
```

- **① Panel:** `--lb-component-empty-state-illustration-bg` (brand purple @ 12%), radius `xl`.
- **② Inner frame + ⑤ horizon:** `currentColor` at opacity 0.20 / 0.22 — quiet scaffolding, identical across all motifs (continuity).
- **③ Chip:** elevated rounded-`xl` square, `--lb-component-empty-state-bg`, hairline border, `--lb-component-card-shadow`, holding one lucide glyph. The chip is the constant that makes 18 different motifs feel like one family.
- **④ Motif:** the meaning. 3–5 strokes/fills in `currentColor` at opacity 0.28–0.70. Commerce-literal (a parcel, a receipt, a shield), never decorative.
- **⑤ Floating accent:** exactly one element at opacity ≤ 0.16, marked `data-lb-empty-float="secondary"`.

---

## 3. Illustration rules

- **MUST** use a single ink color via `currentColor`, resolved from `--lb-component-empty-state-illustration-ink`. **No** second hue, **no** gradient, **no** raster image. *(Survives theme + brand-injection; see Audit §1.4.)*
- **MUST** draw on the 192×128 canvas with the shared panel + inner frame + horizon, so all motifs nest in one family.
- **MUST** carry exactly one `data-lb-empty-float="primary"` group (the motif) and at most one `data-lb-empty-float="secondary"` accent.
- **MUST** pair with a lucide glyph in the chip drawn at 2px stroke, round caps/joins, on the 24×24 grid.
- **Opacity ladder** (the only allowed values, for cross-motif consistency): structural `0.20–0.22`, primary strokes `0.55–0.70`, secondary strokes `0.34–0.50`, soft fills `0.10–0.28`, the rare solid accent dot `0.85–0.90`.
- **MUST NOT** use text inside the illustration, national flags, currency symbols baked into art (use copy for ₹/locale), photoreal detail, or more than ~6 drawn elements (clutter fails mobile readability).
- **MUST NOT** introduce per-app illustration forks. One library in `@letbuyy/ui`; surfaces select a `kind`, they do not ship their own art.

## 4. Layout rules

- **MUST** use the `EmptyState` component layout: centered column, order = illustration → title → body → actions, `min-height` = `--lb-density-empty-state-min-height`, gap = `--lb-density-section-gap`.
- **Copy measure MUST** cap at `--lb-size-empty-state-measure` (440px) so body text never runs wide.
- **Container:** dashed border (`--lb-component-empty-state-border`), radius = card radius (16px), background = `--lb-component-empty-state-bg`. Dashed = "a place for content that isn't here yet"; solid card is for content that *is*.
- **Placement:** the empty state fills the region the populated content would occupy (table body, card grid, page region) — not a modal, not a full-page takeover, except for whole-page first-run (e.g. a brand-new store) where it MAY center in the page region.
- **Responsive:** below `sm` (640px) the illustration scales via density tokens and actions stack full-width; the title/body never reflow to the left — stay centered.

## 5. Typography rules

- **Title:** `--lb-font-size-card-title` (16/20), weight `semibold`, color `--lb-component-empty-state-title`. One line where possible, ≤ ~40 chars. Sentence case. State the situation, not the feature name ("No orders yet", not "Orders").
- **Body:** `--lb-font-size-empty-state` (14/20), weight regular, color `--lb-component-empty-state-body`. 1–2 sentences, ≤ ~140 chars. Say what will appear here and what the action does. No exclamation marks.
- **Voice:** calm, direct, second person, India-first plain English. Avoid "Oops", "Uh-oh", cutesy apologies, and jargon. (Aligns with the `design:ux-copy` skill conventions.)

## 6. CTA rules

- **Primary action:** at most **one**, using the primary button (`--lb-component-button-primary-*`, purple-700 fill, white text). It performs the orienting action (create / connect / invite / import). Omit entirely when the user can't act (no permission, or the surface fills itself).
- **Secondary action:** at most **one**, secondary button (transparent, hairline border). Use for "learn more", "import", or "view settings". Order in DOM = secondary **then** primary (primary is visually last/right).
- **Never** more than two buttons. A third option becomes a help link in the body or is dropped.
- **Permission-aware:** if the viewer lacks rights to the primary action, replace it with guidance ("Ask an admin to…") — never show a button that will fail.
- **Labels:** verb-first, ≤ 3 words ("Add product", "Connect domain", "Invite staff"). Mirror the inventory (`EMPTY_STATE_INVENTORY.md`).

## 7. Animation rules

- **MUST** reuse the two existing keyframes only: `lb-empty-state-float` (primary, 4.8s, ±6px Y) and `lb-empty-state-drift` (secondary, 5.6s, slow translate + opacity). No new animations.
- **Optional hover:** the illustration MAY lift `4px` on hover (matches the shipping component) — never scale, rotate, or bounce.
- **MUST** be disabled under `prefers-reduced-motion: reduce` (already handled by `letbuyyTokenCss`). Reduced-motion is the accessible default, not an afterthought.
- Motion is ambient and looping, never attention-grabbing; it must never delay or gate the CTA.

## 8. Light / dark rules

- **MUST** resolve all color from `--lb-component-empty-state-*`; never hard-code hex in app code. Ink + tinted panel are theme-invariant by design (Audit §1.2); the card surface, border, and shadow flip automatically.
- **Static assets** (`assets/*.light.svg`, `*.dark.svg`) exist only for the design library / Canva and bake the alpha-composited panel (`#F1EBFE` light, `#2C2F4E`-class dark). In-product, the variable-driven path is the source of truth.
- **MUST** verify both modes for every motif (Phase 7 scores both). A motif that only works in light mode is not done.

## 9. Empty-state types (semantics)

| Type | When | Illustration | Primary CTA |
|---|---|---|---|
| **First-run** | Never had data | Motif for the surface | The creating action |
| **Filtered-empty** | Query/filter returns 0 | Same motif, or `generic` | "Clear filters" (secondary), no creating CTA |
| **Permission** | Viewer lacks access | `security`/`permissions` motif | None — guidance text |
| **Error** | Load failed | `generic` motif | "Try again" (this is the *only* case that may use a status/danger tone in copy, never in the art) |

The illustration stays calm in all four; only copy and CTA change. Do not invent red/broken illustrations.

## 10. Accessibility rules (WCAG 2.1 AA)

- The illustration is **decorative**: `aria-hidden="true"` (chip + svg). Meaning lives in the title/body text, which MUST be real DOM text (never baked into the SVG).
- **Contrast:** title and body already meet AA on both card surfaces (`#111827`/`#6B7280` on `#FFFFFF`; `#FFFFFF`/`#CBD5E1` on `#1F2937`). The purple ink is decorative and exempt, but the chip glyph maintains ≥3:1 against the chip surface in both modes.
- **Focus:** CTAs are real `<button>`/`<a>` with visible focus ring (`--lb-color-focus-ring`, ≥3:1). Order: secondary → primary in the DOM matches reading + tab order.
- **Touch targets:** buttons ≥ 40px high (comfortable) — meets the 44px guidance at default density on mobile via density tokens; verify ≥44px on the mobile app.
- **Motion:** respects `prefers-reduced-motion` (§7).
- **SR experience:** a screen-reader user hears "No orders yet. Orders placed in your store will show up here… Create order" — a complete, actionable sentence. Run the `design:accessibility-review` skill before shipping any new surface.

## 11. Anti-patterns (hard rejects)

3D/isometric art · gradients in the motif · mascots/characters · stock or undraw-style illustration · clipart · flying rockets / confetti / celebratory motion · multiple accent colors · text inside the SVG · more than two CTAs · per-app illustration forks · using the blue logo mark as an in-app illustration · a "broken robot"/error mascot · spinners inside an empty state (that's loading, use `Skeleton`).

## 12. Enforcement

- **Code:** consume `<EmptyState kind="…">` from `@letbuyy/ui`. The existing `validate:design-system` and the `@letbuyy/ui` ESLint plugin already flag raw hex and raw elements; keep illustrations inside the component so they're covered.
- **Review:** new surfaces get an empty-state check in design review against §§3–10; the gallery is the reference.
- **Future option (not in this deliverables-only pass):** extend `EmptyStateKind` with the new motifs (`shipping, payouts, messaging, notifications, identity, security, permissions`) — mapping in `EMPTY_STATE_TOKEN_MAPPING.md` §7.

*Cross-references:* [[LETBUYY_DESIGN_LANGUAGE_AUDIT]], [[EMPTY_STATE_INVENTORY]], [[EMPTY_STATE_TOKEN_MAPPING]], [[EMPTY_STATE_SCORECARD]].
