# LETBUYY_UI_SYSTEM_V2.md

**Scope:** the target-state design system `@letbuyy/ui` should become.
**Audit date:** 2026-06-06
**References:** Shopify Polaris (commerce admin vocabulary), Stripe (token rigor + overlay suite), Vercel/Geist (restraint, near-black CTA, distribution discipline).

---

## Executive summary (for leadership)

V2 is **not a rewrite — it is a hardening of V1.** The architecture (three-tier tokens, density axis, CSS-variable theming, Polaris-shaped components) is correct and should be preserved verbatim. V2 keeps ~90% of the existing code and changes the **contract around it**: one API grammar, internally-composed components, the missing overlay primitives, real theming, and a release process.

The target is a system where:
- a developer can guess any component's API from any other,
- a merchant/marketplace surface can be re-branded by setting one input,
- a core change is caught by tests and codemodded across consumers,
- and the design system is **the** way to build UI (not one of several), because raw `<button>`/`<input>`/hex are lint errors.

This document is the blueprint; `UI_SYSTEM_GOVERNANCE.md` is the execution path.

---

## 1. Design principles (the constitution V1 lacks)

1. **One grammar.** Handlers are `onXChange`. Size is `size`. Helper is `helperText`. Intent is `tone`. Booleans are `is*`/`has*`/`show*`. No synonyms.
2. **Compose, don't re-implement.** Every button in the system is `<Button>`. Every breadcrumb is `<Breadcrumbs>`. No raw `<button>` inside `PageHeader`/`SaveBar`/`IndexTable`.
3. **Tokens are the only styling source.** Components never contain literal hex/px for themable properties; apps never contain hex for brand colors (lint-enforced).
4. **Accessible by default.** Focus traps, ARIA wiring, AA contrast are built into primitives — a developer cannot ship an inaccessible Modal because the Modal handles it.
5. **Themable to the tenant.** Light/dark/auto + per-surface + per-brand, all via CSS-variable overrides on the root.
6. **Versioned and codemoddable.** Breaking changes are rare, classified, and ship with migrations.

---

## 2. Token system V2

Keep the three-tier model and density axis. Changes:

| Change | From | To |
|---|---|---|
| **Add breakpoint tokens** | none (raw Tailwind) | `--lb-bp-{sm,md,lg,xl}` + owned Tailwind `screens` preset |
| **Add z-index scale** | hardcoded `z-50`/`z-40` | `--lb-z-{base,dropdown,sticky,overlay,modal,toast,tooltip}` |
| **Collapse color aliases** | `text`+`textPrimary`, `border`+`borderDefault`… | one canonical name each |
| **Unify spacing names** | `space-1..8` **and** `space-xs..xl` | one scale (t-shirt **or** numeric) |
| **Unify type scale** | `pageTitle…` **and** `h1..h4`/`heading` | one named scale (`display/title/heading/body/caption/…`) |
| **One status vocabulary** | `danger`+`critical` | `critical` only |
| **One shadow source** | `shadow.*` **and** `card.shadow` literal | `card.shadow` references `--lb-shadow-*` |
| **`prefers-color-scheme`** | absent | emitted for `auto` roots |
| **Wire `surface`** | inert attribute | `[data-letbuyy-surface="…"]` variable overrides |
| **Brand ramp as input** | hardcoded purple | `createTheme({ brand })` rewrites primary ramp + focus + CTA |
| **Light primary CTA** | slate-900 (off-brand) | `--lb-color-primary` (decide: brand or ink — then apply consistently) |

**Theme contract (published):** the set of `--lb-*` variables a tenant/theme may override, with AA-contrast guardrails on brand inputs.

---

## 3. Component architecture V2

### Tier 0 — Primitives (foundation)
`Box`, `BlockStack`, `InlineStack`, **`Grid`/`Columns`** (NEW — responsive `columns`/`gap`), **`Container`** (NEW — max-width measure), `Text` (merged from Text+TextStyle), `Divider`, `Icon`/`MaterialIcon` (typed `name`).

### Tier 1 — Controls
`Button` (+ `as`/`asChild` polymorphism, `iconLeading`/`iconTrailing`), `Input`, `Textarea`, **`NumberField`** (NEW), `Select`, `Combobox`, `Checkbox`, `Radio`, `ChoiceList`, **`Switch`** (NEW), `Tabs`, **`SegmentedControl`** (generalize `DensityToggle`).

### Tier 2 — Overlays (the biggest gap to close)
`Modal` (focus-trapped), `ConfirmDialog` (no hardcoded copy), `Tooltip` (trigger-associated), `CommandPalette` (arrow-nav + trap), **`Drawer`** (NEW — required, missing today), **`Popover`** (NEW), **`Dropdown`/`Menu`** (NEW — required, missing today). All share one `useFocusTrap` + `useDismiss` + `--lb-z-*`.

### Tier 3 — Feedback
`Badge`, `Banner`, `Toast` (positioning options), `Skeleton`, `Spinner`, `ProgressBar`, `EmptyState`, `SaveBar` (built from `Button`), **`InlineError`** (NEW).

### Tier 4 — Data & navigation
**`Table`** (single — merge DataTable+IndexTable; responsive cards, selection, bulk, saved views), `MetricCard`, `Chart`, `Avatar`, **`Pagination`** (page numbers + page-size), `DescriptionList`, `Breadcrumbs` (consumed by `PageHeader`), `FilterBar`, `FilterChips`, `DateRangePicker`.

### Tier 5 — App shell
`DesignSystemRoot` (fixed `auto`, wired `surface`, `brand` input, dedup `<style>`), `Page`/`PageContent`/`PageHeader`/`Section`, **`AppFrame`/`Navigation`/`Sidebar`** (NEW — the nav primitives apps currently hand-roll).

**Net new components:** Grid, Container, NumberField, Switch, Drawer, Popover, Dropdown/Menu, InlineError, AppFrame/Navigation. **Net merges:** Table (×2→1), Text (×2→1), alias removals.

---

## 4. The V2 ergonomics target (before/after)

```tsx
// V1 — five grammars, raw buttons, off-brand CTA, no focus trap
<Checkbox onCheckedChange={...} />
<Combobox onValueChange={...} />
<Pagination onPageChange={...} />
<PageHeader primaryAction={{label, onClick}} />     // renders a raw <button>
<Modal open ... />                                  // no focus trap

// V2 — one grammar, composed, themable, accessible
<Checkbox onChange={...} />
<Combobox onChange={...} />
<Pagination onChange={...} />
<PageHeader primaryAction={<Button>Save</Button>} /> // composes Button
<Modal open ... />                                   // focus-trapped by default
<DesignSystemRoot brand="#0EA5E9" surface="marketplace" theme="auto" />
```

---

## 5. Distribution & DX V2

- **Build:** `tsup`/`tsc` → `dist` (ESM + types). `main`/`types` → `dist`. Internals hidden.
- **Subpaths:** `@letbuyy/ui` (components), `/tokens`, `/preview` (move visual helpers here), `/formatting`, `/icons`.
- **Tests:** RTL + jest-axe on all Tier 0–3; Storybook visual regression in CI; cross-app build gate.
- **Docs:** Storybook with usage/do-don't per component + an API style-guide page + a live theme playground (brand/surface/density/theme switcher).
- **Lint:** an `@letbuyy/eslint-plugin-ui` that bans raw `<button>`/`<input>`/`<table>`/hex in `apps/*` and steers to components/tokens.

---

## 6. Migration map (V1 → V2, codemoddable)

| V1 | V2 | Transform |
|---|---|---|
| `DataTable`, `IndexTable` | `Table` | unify props/`render`; codemod both shapes |
| `Text` + `TextStyle` | `Text` | map `TextStyle variant`→`Text tone`/`variant` |
| `PageShell`,`PageActions`,`TableFilterBar` | `Page`,`PageHeaderActions`,`FilterBar` | rename |
| `Badge variant="danger"` | `variant="critical"` | string swap |
| `onCheckedChange`/`onValueChange`/`onPageChange` | `onChange` | rename handler |
| `Select controlSize` | `size` | rename |
| `--lb-color-text-primary` etc. | `--lb-color-text` | CSS-var rename |
| raw `<button>`/`<input>` in apps | `Button`/`Input` | assisted (lint + partial codemod) |
| `DensityToggle` | `SegmentedControl` | wrap |

---

## 7. Phased roadmap

- **Q1 — Foundation safety:** `dist` build, tests, visual regression, eslint adoption rule, token-var snapshot. *(No API changes.)*
- **Q2 — Correctness + theming:** focus-trap overlays, Input ARIA, z-index + breakpoint tokens, fix `auto`, wire `surface`, `brand` input, fix `marketing-site`.
- **Q3 — Consolidation:** merge Table, merge Text, remove aliases, collapse token aliases, one API grammar (codemods).
- **Q4 — Expansion + 1.0:** add Drawer/Popover/Dropdown/Switch/Grid/Container/Navigation; freeze 🟢 tier; cut **`@letbuyy/ui` 1.0** with full docs.

**Definition of done for "the single design foundation":** raw `<button>`/`<input>`/hex are lint errors; all 9 apps build green on every UI change in CI; every requested pattern (incl. Drawer, Dropdown) exists; light/dark/auto + per-surface + per-brand all work; and a new app can be themed by setting `brand`+`surface` on one root.
