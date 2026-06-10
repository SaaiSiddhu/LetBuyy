# UI_USAGE_GRAPH.md

**Scope:** consumption of `@letbuyy/ui` across the LetBuyy monorepo.
**Audit date:** 2026-06-06
**Method:** JSX-instantiation counts (`<Component`) and import-site counts via ripgrep over **`apps/` only** (`.tsx`/`.ts`, excluding `node_modules`) — i.e. **real product consumption**. These exclude the UI package's own Storybook stories; verification confirmed *all* non-app usage is exclusively those stories (e.g. Card: 284 apps + 44 stories = 328 repo-wide), and no non-`ui` package or service instantiates these components. Counts are *static occurrences*, not runtime renders — they are the blast radius for a change.

---

## Executive summary (for leadership)

`@letbuyy/ui` is **already the de-facto foundation**: **203 files import it across 9 apps.** Consumption is extremely **concentrated**:

- **`merchant-control-plane` is 35% of all import sites (72/203)** and the dominant consumer of nearly every component (219 of 284 Cards, 192 of 218 Buttons). It is effectively the reference application — but also the single point that any change must be validated against first.
- **5 components carry the system:** `Card` (284), `Section` (261), `Button` (218), `Badge` (114), `Input` (103). Touch any of these and you touch the entire product surface.
- The **long tail is thin** — `Tabs` (5), `Chart` (4), `DataTable` (2), `Modal` (1), `CommandPalette` (1). These are safe to change.

**Two adoption red flags** that the import counts hide:

1. **The design system is heavily bypassed.** Apps contain **282 raw `<button>`, 138 raw `<input>`, 21 raw `<table>`, and 417 hardcoded hex colors** — i.e., the DS is *a* way to build UI, not *the* way. Real coverage of the product is well below what the component counts suggest.
2. **`marketing-site` renders `@letbuyy/ui` components without `DesignSystemRoot`** (no token CSS injected), so those components render with undefined CSS variables — a live correctness gap, not just style drift.

---

## Consumer map (import sites per app)

| App | Files importing `@letbuyy/ui` | Wraps in `DesignSystemRoot`? | Role |
|---|---|---|---|
| **merchant-control-plane** | **72** | ✅ | Dominant consumer / reference app |
| storefront-runtime | 34 | ✅ | Heavy |
| theme-marketplace | 22 | ✅ | Heavy |
| app-marketplace | 20 | ✅ | Medium |
| developer-portal | 13 | ✅ | Medium |
| identity-platform | 11 | ✅ | Medium |
| platform-console | 11 | ✅ | Medium |
| platform-operations-portal | 10 | ✅ | Medium |
| **marketing-site** | **9** | ❌ **no token CSS** | Light — **broken theming** |
| mobile/* | 0 | — | Flutter; not a consumer |
| **Total** | **203** | 8 of 9 | — |

---

## Component usage ranking (full)

| Rank | Component | Apps uses | Risk tier if changed |
|---|---|---|---|
| 1 | **Card** | 284 | 🔴 Catastrophic |
| 2 | **Section** | 261 | 🔴 Catastrophic |
| 3 | **Button** | 218 | 🔴 Catastrophic |
| 4 | **Badge** | 114 | 🔴 Severe |
| 5 | **Input** | 103 | 🔴 Severe |
| 6 | MaterialIcon | 93 | 🔴 Severe |
| 7 | Banner | 91 | 🟠 High |
| 8 | Skeleton | 86 | 🟠 High |
| 9 | Page | 68 | 🟠 High |
| 10 | EmptyState | 66 | 🟠 High |
| 11 | PageHeader | 62 | 🟠 High |
| 12 | Select | 27 | 🟡 Moderate |
| 13 | ConfirmDialog | 27 | 🟡 Moderate |
| 14 | MetricCard | 23 | 🟡 Moderate |
| 15 | SaveBar | 20 | 🟡 Moderate |
| 16 | IndexTable | 19 | 🟡 Moderate |
| 17 | Textarea | 17 | 🟡 Moderate |
| 18 | Avatar | 11 | 🟢 Low |
| 19 | PageContent | 8 | 🟢 Low |
| 20 | ProgressBar | 7 | 🟢 Low |
| 21 | Tabs | 5 | 🟢 Low |
| 22 | Chart / DescriptionList | 4 | 🟢 Low |
| 24 | FilterBar | 3 | 🟢 Low |
| 25 | DataTable | 2 | 🟢 Low |
| 26 | Modal / CommandPalette | 1 | 🟢 Low |

### ⚪ Zero app adoption — Storybook-only (the surprising finding)

**17 exported components are never instantiated in any app** (verified apps-only = 0; they appear only in the library's own stories):

> `Box`, `BlockStack`, `InlineStack`, `Text`, `TextStyle`, `Checkbox`, `Radio`, `ChoiceList`, `Combobox`, `Tooltip`, `Spinner`, `Divider`, `Pagination`, `Breadcrumbs`, `FilterChips`, `DensityToggle`, `DateRangePicker`

This is one of the audit's most important findings: **the best-engineered, most-accessible parts of the library — the layout primitives (Box/Stack) and the ARIA-complete form controls (Checkbox/Radio/ChoiceList/Combobox) — have zero production adoption.** Apps instead hand-roll raw `<div className="flex">`, raw `<input type="checkbox">`, and raw `<button>` (see bypass graph below). So the library's quality and the library's adoption are *inversely* distributed: teams adopt the simple surfaces (Card/Section/Button/Badge/Input) and ignore the sophisticated ones. Any "make this the foundation" effort must drive adoption of these unused primitives, not just ship more components.

---

## Phase-4 required components — consumer trace

The brief asks specifically for: Card, Button, Input, Modal, Drawer, Tabs, Table, Badge, Avatar, Dropdown, Command Palette.

| Required | Exists? | Uses | Consumers (apps) | Risk |
|---|---|---|---|---|
| **Card** | ✅ | 284 | merchant-control-plane (219), developer-portal (36), theme-marketplace (17), platform-ops (6), platform-console (4), app-marketplace (2), + others | 🔴 |
| **Button** | ✅ | 218 | merchant-control-plane (192), identity-platform (17), platform-ops (8), platform-console (1), + storefront/theme/app-marketplace | 🔴 |
| **Input** | ✅ | 103 | broad; merchant-control-plane dominant | 🔴 |
| **Modal** | ✅ | 1 (+27 via ConfirmDialog) | merchant-control-plane + a few | 🟡 (ConfirmDialog lifts effective blast radius) |
| **Drawer** | ❌ **MISSING** | — | — | Gap — apps hand-roll drawers/sidebars with raw markup |
| **Tabs** | ✅ | 5 | merchant-control-plane + ops | 🟢 |
| **Table** | ✅ (two) | DataTable 2 + IndexTable 19 | IndexTable: merchant-control-plane, platform-console, platform-ops; DataTable: merchant-control-plane only | 🟡 (split surface) |
| **Badge** | ✅ | 114 | broad | 🔴 |
| **Avatar** | ✅ | 11 | merchant-control-plane + identity | 🟢 |
| **Dropdown** | ❌ **MISSING** | — | — | Gap — apps use raw `<select>`/custom menus |
| **Command Palette** | ✅ | 1 | merchant-control-plane | 🟢 |

**Two of the eleven requested patterns (Drawer, Dropdown/Menu) do not exist.** Their absence is itself a usage finding: teams are building those affordances *outside* the system (contributing to the 282 raw `<button>` / 138 raw `<input>` count).

---

## The bypass graph (what the import counts hide)

| Raw pattern in `apps/*.tsx` | Count | DS component that should be used |
|---|---|---|
| `<button>` | **282** | `Button` |
| `<input>` | **138** | `Input` / `Checkbox` / `Radio` |
| `<table>` | **21** | `IndexTable` / `DataTable` |
| hardcoded `#rrggbb` | **417** (in 36 files) | color tokens (`--lb-color-*`) |

There are **more raw `<button>` (282) than DS `<Button>` (218)** and **more raw `<input>` (138) than DS `<Input>` (103)** — for the two most fundamental controls, the bypass *outweighs* adoption. Counting raw + DS together, the design system renders **well under half** of the product's buttons and inputs. This is the single most important number in the audit for "can `@letbuyy/ui` become *the* foundation": coverage today is partial, the gap is concentrated in exactly the primitives the library already provides, and the most accessible of those primitives (Checkbox/Radio/ChoiceList) have **zero** adoption.

---

## Concentration / bus-factor

```
merchant-control-plane  ████████████████████████████████████ 72  (35%)
storefront-runtime      █████████████████ 34  (17%)
theme-marketplace       ███████████ 22  (11%)
app-marketplace         ██████████ 20  (10%)
developer-portal        ██████ 13   (6%)
identity-platform       █████ 11    (5%)
platform-console        █████ 11    (5%)
platform-operations     █████ 10    (5%)
marketing-site          ████ 9      (4%)   ⚠ no DesignSystemRoot
```

**Implication for change management:** any change can be *validated* primarily against `merchant-control-plane` (it exercises ~all components), but must be *regression-tested* against `marketing-site` (no token root) and the table consumers (`platform-console`, `platform-ops`) which use `IndexTable` but not `DataTable`.

---

## Risk-tiered change protocol (feeds `BREAKING_CHANGE_IMPACT_REPORT.md`)

- 🔴 **Card / Section / Button / Badge / Input / MaterialIcon** — additive-only without a major version + codemod + full visual regression across all 8 token-rooted apps.
- 🟠 **Banner / PageHeader / Skeleton / Page / EmptyState** — additive-only; coordinate with merchant-control-plane owners.
- 🟡 **MetricCard / Select / ConfirmDialog / SaveBar / IndexTable / Textarea / TextStyle** — changeable with a deprecation cycle.
- 🟢 **Everything ≤14 uses** — safe to refactor with a single changelog note.
