# LetBuyy — Typography & Spacing Governance Audit

**Auditor:** Principal Design Systems Architect / UI Governance
**Date:** 2026-06-09
**Scope:** Typography governance, spacing governance, and (by cross-reference) color governance across the 9 web apps and the Flutter app.
**Method:** Read the type/space scales in `tokens.ts`; counted token vs raw usage with `rg`. No code modified. (Color governance is covered in depth in `DESIGN_TOKEN_AUDIT.md`; summarized here for completeness.)

> **One-line verdict:** The typographic and spatial *scales are fully defined and themable* — a role-based type scale (`page-title`, `section-title`, `body`, `caption`…) and a 12-step space scale, both emitted as `--lb-*` variables and density-aware. But apps consume them inconsistently: **~720 raw `px` font-sizes vs ~188 token font-sizes (≈4:1 raw-to-token)**, **~1,331 raw `px` spacing declarations in CSS**, and **99 inline `font-family` declarations** — almost all concentrated in the same few multi-thousand-line `globals.css` files that escape the (dormant) CSS governance.

---

## 1. The scales are defined and good

### Typography (`tokens.ts:672-730`)
- **Families** (`:673-677`): `body`/`display`/`mono` via `letbuyyFontStacks` (`fonts.ts`), referencing `--font-letbuyy-sans/display/mono` (wired through `next/font` in every app — 13 `next/font` usages, **0 `@font-face`**).
- **Role-based sizes** (`:678-700`): `display 32`, `h1 28`, `h2 24`, `pageTitle 24`, `sectionTitle 18`, `cardTitle 16`, `bodyLarge 16`, `body 14`, `secondary 13`, `caption 12`, `badge 12`, plus fluid `clamp()` variants for display/h1/h2. Matching `lineHeight` (`:701-723`) and `fontWeight` (`:724-729`).
- Emitted as `--lb-font-size-*` / `--lb-line-height-*` / `--lb-font-weight-*` (`tokens.ts:846-892`).

### Spacing (`tokens.ts:731-744`)
- 12-step scale `none/xs 4 / sm 8 / md 12 / lg 16 / xl 20 / 2xl 24 / 3xl 32 / 4xl 40 / 5xl 48 / 6xl 64 / 7xl 96`, emitted as both numeric `--lb-space-0..11` and named `--lb-space-xs..xl` (`tokens.ts:894-910`).
- **Density-aware spacing** (`tokens.ts:500-585`): `pageGap`, `sectionGap`, `cardGap`, `cardPadding`, `modalPadding`, control heights all shift per density via `--lb-density-*`.

Token spacing **is** used heavily: `var(--lb-space*)` appears **~1,339×** (and `--lb-density*` ~128× more) platform-wide. The defined system is real and adopted in parallel with raw values — not instead of them.

---

## 2. Typography findings

### TYP-1 — ~4:1 raw-px-to-token font-size ratio; type scale bypassed in CSS
**Severity: High** · **Affected: app-marketplace, merchant-control-plane, identity-platform, marketing-site**

**Root cause.** Hand-authored `globals.css` files set font-size in raw `px` instead of `var(--lb-font-size-*)`. Counts of `font-size: NNpx`: app-marketplace **234**, merchant-control-plane **184**, identity-platform **132**, marketing-site **129**, storefront-runtime **36** — vs only **188** total `var(--lb-font-size-*)` usages platform-wide. platform-console & platform-operations-portal are the control group: **0** raw-px font-sizes (their globals.css is 37–38 lines).

**Code evidence.** `rg -No "font-size:\s*[0-9]+px" apps --glob '*.{tsx,css}'` per-app counts above; `tokens.ts:678-700` (the scale they bypass).

**Recommended canonical direction.** Migrate raw `px` font-sizes to the role tokens; expose `Text` (`index.ts:31`) with role variants (`variant="pageTitle|body|caption"`) and prefer it over ad-hoc CSS. Enforce via stylelint (a `declaration-property-value-allowed-list` for `font-size` permitting only `var(--lb-font-size-*)` and relative units).

---

### TYP-2 — 99 inline `font-family` declarations
**Severity: Medium** · **Affected: merchant-control-plane (46), storefront-runtime (25), identity-platform (13)**

**Root cause.** Components/CSS re-declare font stacks instead of inheriting `--lb-font-family-body`. Risk: a future font change requires editing 99 sites. merchant-control-plane alone has 46.

**Code evidence.** `rg -No "font-family\s*:" apps` per-app counts; canonical stack at `fonts.ts:7-11`.

**Recommended canonical direction.** Set `font-family: var(--lb-font-family-body)` once at the design-system root (already done — `tokens.ts:1315`) and delete local re-declarations; reserve `--lb-font-family-display/mono` for explicit display/code use.

---

### TYP-3 — Mobile type scale exists but 712 raw `fontSize:` literals ignore it
**Severity: Medium** · **Affected: apps/mobile/merchant-app**

**Root cause.** The Flutter theme defines a structured scale (`AppTextStyles`, `LetbuyyTypographyTokens` — `display 32 / h1 28 / body 14 / caption 12`, matching web) and uses `GoogleFonts.inter` (family parity ✔), but screens hardcode **712** `fontSize:` literals. (Detail in `COMPONENT_DUPLICATION_REPORT.md` DUP-8.)

**Recommended canonical direction.** Route screen text through the named text styles; lint raw `fontSize:` outside the theme layer.

---

## 3. Spacing findings

### SPC-1 — ~1,331 raw-px spacing declarations live in ungoverned CSS
**Severity: High** · **Affected: app-marketplace (485), merchant-control-plane (453), marketing-site (248), identity-platform (94), storefront-runtime (46)**

**Root cause.** `padding/margin/gap: NNpx` literals in `globals.css` bypass `--lb-space-*` / `--lb-density-*`. Because `.stylelintrc.cjs` is dormant (`DESIGN_TOKEN_AUDIT.md` TOK-1), nothing flags them. platform-console & platform-operations-portal again = **0** (tiny globals.css), proving the discipline is achievable.

**Code evidence.** `rg -No "(padding|margin|gap):\s*[0-9]+px" apps --glob '*.css'` per-app counts above; the scale at `tokens.ts:731-744`.

**Recommended canonical direction.** Migrate to `var(--lb-space-*)`; for density-sensitive surfaces use `--lb-density-*`. Add a stylelint allowed-list for spacing properties (permit `var(--lb-*)`, `0`, and relative units). Prefer layout primitives (`BlockStack`/`InlineStack`/`Box gap=`) over raw CSS gaps.

---

### SPC-2 — The density spacing axis is largely unused by apps
**Severity: Low** · **Affected: all apps**

**Root cause.** `cardPadding`/`pageGap`/`sectionGap` shift per density, but apps that hardcode px spacing opt out of density entirely — so the "compact/comfortable/spacious" promise doesn't reach most screens. (Related to `THEME_ARCHITECTURE_AUDIT.md` THEME-5.)

**Recommended canonical direction.** Once SPC-1 migration lands, density "just works" for migrated surfaces; make that the selling point of the migration.

---

## 4. Color governance (summary — full detail in `DESIGN_TOKEN_AUDIT.md`)

- **Hex** is essentially eliminated in TSX (ESLint `no-hardcoded-hex` = error) — only **25** hex remain, all in `marketing-site/globals.css`.
- **But CSS color is ungoverned:** **560** naked `color/background: rgb(...)` declarations + **254** raw Tailwind-palette classes (`bg-gray-*`, `bg-white`; led by platform-console **115**) survive because the relevant rules are warn-only or CSS-blind, and stylelint is dormant.
- **Mobile** diverges on semantic colors (`success`/`error`) despite matching brand purple.

See `DESIGN_TOKEN_AUDIT.md` TOK-1/TOK-2 for the color-governance findings and fixes.

---

## 5. Typography & spacing scorecard (component of the master scorecard)

| Dimension | Rating | Basis |
|---|---|---|
| Type scale definition | **4.5 / 5** | Role-based, fluid variants, density-aware. |
| Type adoption discipline | **2.0 / 5** | ~4:1 raw-px ratio; 99 inline families. |
| Space scale definition | **4.5 / 5** | 12-step, density-aware, dual aliases. |
| Space adoption discipline | **2.5 / 5** | ~1,339 token uses *and* ~1,331 raw-px islands. |
| Enforcement | **1.5 / 5** | Stylelint dormant; no type/space lint. |
| **Typography & spacing (overall)** | **2.5 / 5** | Excellent scales, leaky adoption, no CSS gate. |

See `DESIGN_SYSTEM_MASTER_AUDIT.md` for the consolidated scorecard.
