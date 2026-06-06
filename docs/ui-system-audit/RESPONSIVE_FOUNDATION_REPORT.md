# RESPONSIVE_FOUNDATION_REPORT.md

**Scope:** breakpoint / container / grid / layout systems and device support in `@letbuyy/ui`.
**Audit date:** 2026-06-06

---

## Executive summary (for leadership)

Responsiveness in `@letbuyy/ui` is **implemented but not systematized.** Individual components — `IndexTable` (table→cards), `Modal`/`CommandPalette` (full-screen→centered), `SaveBar`, `PageHeader` — have genuinely thoughtful mobile behavior. But the foundation has **no breakpoint tokens, no container primitive, and no grid primitive.** Every responsive decision is a raw Tailwind literal (`sm:`/`md:`/`xl:`) hand-written inside each component's class string.

Consequences:
- **Breakpoints are invisible and unchangeable.** They're Tailwind defaults (640/768/1024/1280) buried in strings. A consumer cannot discover them, theme them, or align to them.
- **The breakpoint choice is inconsistent per component** — some switch at `sm` (640), some at `md` (768), some at `xl` (1280) for similar layout decisions, with no documented rationale.
- **No `Grid`/`Columns` primitive** — multi-column layouts are re-implemented with ad-hoc `grid-cols-*` in `Section`, `IndexTable`, `DescriptionList`, `FilterBar`, each slightly differently.

Mobile/tablet/desktop **rendering** is largely covered; mobile/tablet/desktop **as a system** is not. This is the weakest foundational area after token hygiene, and it's the one most likely to bite when a new app (or the reserved mobile shopper/operator apps) needs a different device profile.

---

## 1. Breakpoint system — ❌ not tokenized

**There are no breakpoint tokens.** `tokens.ts` defines color/typography/space/radius/shadow/motion/size/density — but **no `breakpoint`/`screens` scale.** Verified: `rg "breakpoint|screens|640px|768px|1024px|1280px" tokens.ts` → none.

Responsive behavior is expressed as Tailwind variant literals embedded in components:

| Component | Breakpoint logic (verbatim from source) | Switch point |
|---|---|---|
| `Page` | `px-[..] sm:px-[--lb-density-card-padding] sm:py-[..]` | `sm` (640) |
| `Section` | `md:grid md:grid-cols-2`, `xl:grid-cols-3` | `md` (768) / `xl` (1280) |
| `Card` (`split`) | `md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]` | `md` |
| `PageHeader` | `md:flex-row md:items-center md:justify-between` | `md` |
| `PageHeaderActions` | `[&>*]:max-sm:flex-1 sm:w-auto sm:justify-end` | `sm` |
| `IndexTable` | `md:hidden` (cards) + `hidden md:block` (table) | `md` |
| `Modal` | `sm:items-center sm:w-[min(640px,…)] sm:rounded-…` | `sm` |
| `CommandPalette` | `sm:items-start sm:w-[min(720px,…)] sm:rounded-…` | `sm` |
| `SaveBar` | `sm:bottom-… sm:w-[min(920px,…)] sm:flex-row` | `sm` |
| `DateRangePicker` | `sm:grid-cols-2` | `sm` |

**Finding R-1 (HIGH):** the system silently depends on the consuming app's Tailwind config defining `sm/md/lg/xl` identically. If any app overrides Tailwind's `screens`, **every component's responsive behavior shifts** — and nothing in `@letbuyy/ui` declares or guards the contract. The breakpoints should be tokens (`--lb-bp-sm` etc.) and/or the package should own its `screens` config.

**Finding R-2 (MEDIUM):** breakpoint choice is inconsistent — layout columns switch at `md`, but Modal/SaveBar/Page switch at `sm`, and 3-column at `xl`. There's no documented "mobile < X, tablet X–Y, desktop > Y" model; each component picked a point independently.

---

## 2. Container system — ⚠️ partial

There is **one** container concept: `Page` (`max-w-[var(--lb-size-page-max)]` = **1440px**, centered, `mx-auto`, density-aware padding). Related sizing tokens exist:
- `--lb-size-page-max` 1440px, `--lb-size-content-measure` 720px, `--lb-size-empty-state-measure` 440px, `--lb-size-save-bar-width` 920px, `--lb-size-command-palette-width` 720px.

**Finding R-3 (MEDIUM):** these are good *max-width* tokens, but there is **no reusable `Container`/`Box maxWidth` primitive** — only `Page` applies `page-max`, and the measures are used ad-hoc inside specific components. A new screen that isn't a full `Page` has no standard way to constrain width to a readable measure.

---

## 3. Grid system — ❌ no primitive

There is **no `Grid`/`Columns` component.** Multi-column layout is re-implemented per component with raw Tailwind `grid`:
- `Section` → `columns?: 1|2|3` → `md:grid-cols-2` / `xl:grid-cols-3`.
- `DescriptionList` → `columns?: 1|2` → `md:grid-cols-2`.
- `IndexTable` toolbar → `md:grid-cols-[minmax(0,1fr)_auto_auto]`.
- `FilterBar` → `md:grid-cols-[minmax(0,1fr)_auto_auto]`.
- `Card` split → `md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]`.

**Finding R-4 (MEDIUM):** five different grid implementations with overlapping intent and no shared API. A `Grid`/`Columns` primitive (`columns`, `gap`, responsive `columns={{base:1, md:2, xl:3}}`) would unify these and is table-stakes in Polaris/Chakra/Geist.

**Strength:** `min-w-0` is applied pervasively (`Box`, stacks, `Card`, table cells, `Text`) — this correctly prevents flex/grid overflow blowouts, a detail many systems miss.

---

## 4. Layout system — ✅ the strong part

`BlockStack` / `InlineStack` / `Box` are solid, token-driven flex primitives (`gap`/`align`/`justify`/`wrap`/`padding`/`tone`). `Page`/`PageContent`/`Section` give a clear page skeleton. The **density system** (`compact`/`comfortable`/`spacious`) layers cleanly on top via `--lb-density-*` and is genuinely differentiated.

**Finding R-5 (LOW):** stacks are responsive only via passed `className` (no responsive `gap`/`direction` props). Reference systems (Polaris `InlineStack`, Chakra) accept responsive values. Today, switching a stack's direction by breakpoint means hand-writing `flex-col md:flex-row` in `className`.

---

## 5. Device support assessment

| Device | Support | Evidence | Gaps |
|---|---|---|---|
| **Desktop** | ✅ Strong | 1440px page max, multi-column grids, full table | none material |
| **Tablet** | ⚠️ Implicit | `md` (768) is the main pivot | no dedicated tablet tier; `lg` (1024) almost unused |
| **Mobile** | ✅ Good per-component | IndexTable cards, full-screen Modal/CommandPalette, stacked SaveBar/PageHeader, `max-sm:flex-1` action buttons | no system-level mobile contract; depends on app Tailwind config |

**Notable strength:** `IndexTable`'s mobile story is excellent — it renders a labeled card list (`dl`/`dt`/`dd`) under `md`, a true responsive data pattern, not a horizontally-scrolling table. `DataTable`, by contrast, is **desktop-only** (`overflow-auto` table, no mobile view) — another reason it should be retired in favor of `IndexTable`.

---

## Scorecard

| Sub-system | Grade | Note |
|---|---|---|
| Breakpoint tokens | **F** | Don't exist; raw Tailwind literals |
| Breakpoint consistency | **C−** | `sm`/`md`/`xl` chosen ad-hoc per component |
| Container system | **C+** | Only `Page`; good max-width tokens, no reusable container |
| Grid system | **D** | No primitive; 5 ad-hoc implementations |
| Layout primitives | **B+** | Strong stacks/Box; not responsive-prop-aware |
| Density system | **A** | Differentiated and clean |
| Mobile rendering | **B** | Great in IndexTable/overlays; DataTable desktop-only |

---

## Recommendations (feed `LETBUYY_UI_SYSTEM_V2.md`)

1. **Add breakpoint tokens** (`--lb-bp-sm/md/lg/xl`) and ship the package's own Tailwind `screens` preset so the responsive contract is owned, not inherited.
2. **Add a `Grid`/`Columns` primitive** with responsive `columns`/`gap`; migrate `Section`, `DescriptionList`, `FilterBar`, `Card(split)` onto it.
3. **Add a `Container` primitive** (or `Box maxWidth`) using the existing measure tokens.
4. **Make stacks responsive-prop-aware** (`gap`/`direction` accept `{base, md, …}`).
5. **Document one device model** (mobile < 768, tablet 768–1024, desktop > 1024) and align every component's pivot to it.
6. **Retire `DataTable`** (desktop-only) in favor of `IndexTable`'s responsive pattern.
