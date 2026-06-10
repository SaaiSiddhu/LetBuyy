# CODEX DESIGN SYSTEM COMPLETION MISSION — LetBuyy WS1

**Driver:** Codex agent. Reasoning: `xhigh`.
**Mode:** Continuous, autonomous. Never stop while unblocked work remains.
**Domain Ownership:** `packages/typescript/ui/**` ONLY. No other folders.
**Predecessor:** `CODEX_SHOPIFY_UX_MISSION.md` UX1 (tokens + core components already built).

---

## 0. PRIME DIRECTIVE

Complete `@letbuyy/ui` into a production-grade, Polaris-class design system that all 9 apps can consume. Every component is token-driven, accessible, responsive, and Storybook-documented.

**SUCCESS CRITERIA:**
1. All components from the §1 checklist are built, token-driven, accessible (WCAG-AA), and responsive.
2. Storybook builds and documents every component with usage examples.
3. No component hard-codes color, spacing, or typography — all from CSS variables.
4. Responsive breakpoints baked into `Page`, `Card`, `Section`, and table components.
5. Build is network-free. No external font/CDN fetches.
6. Governance 128/128 maintained.

---

## 1. COMPONENT CHECKLIST

### Already Built (verify + document)
- [x] Button (primary/secondary/tertiary/destructive)
- [x] Input, Textarea
- [x] DataTable
- [x] Badge (status variants)
- [x] Page, PageHeader, Card, Section
- [x] Banner (info/warning/critical/success)
- [x] Toast + ToastProvider
- [x] Skeleton (text/card/table)
- [x] EmptyState
- [x] Modal, ConfirmDialog
- [x] Tabs
- [x] Select, Combobox
- [x] Tooltip
- [x] MetricCard
- [x] Avatar
- [x] Pagination
- [x] IndexTable
- [x] SaveBar
- [x] CommandPalette
- [x] DesignSystemRoot
- [x] Design tokens (CSS vars + TS)

### To Build
- [ ] **Chart** (line, bar, area — for analytics; token-driven, responsive)
- [ ] **DateRangePicker** (with compare-to-previous toggle)
- [ ] **DensityToggle** (comfortable/compact on tables/lists)
- [ ] **FilterChips** (clearable filter pills for lists)
- [ ] **ProgressBar** (for setup guide, upload progress)
- [ ] **Breadcrumbs** (integrated with PageHeader)
- [ ] **DescriptionList** (key-value pairs for detail pages)
- [ ] **Divider** (horizontal/vertical separator)
- [ ] **Spinner** (loading indicator)
- [ ] **TextStyle** (subdued/strong/positive/negative/code variants)

### Responsive Enhancement
- [ ] `Page` responsive padding/max-width at mobile breakpoints
- [ ] `Card` stacking at < 768px
- [ ] `Section` single-column at mobile
- [ ] `IndexTable` → card-based list at < 640px
- [ ] `SaveBar` full-width at mobile
- [ ] `CommandPalette` full-screen at mobile
- [ ] `Modal` full-screen at mobile

### Storybook Documentation
- [ ] Every component has at least one story
- [ ] Responsive stories with viewport controls
- [ ] Token documentation page
- [ ] Usage guidelines per component

---

## 2. OPERATING CONTRACT

1. Touch ONLY `packages/typescript/ui/**`. No other files.
2. All components consume `--lb-*` CSS variables. No hard-coded values.
3. Every component: keyboard navigable, visible focus, ARIA roles/labels, WCAG-AA contrast.
4. Storybook must build without network.
5. `pnpm turbo typecheck` + `pnpm lint` + `pnpm run validate:governance` after every component.
6. Max 3 attempts per task → log BLOCKED → next.
7. No fabrication — every DONE needs evidence.

---

## 3. ARCHITECTURE INVARIANTS — DO NOT TOUCH

- Everything outside `packages/typescript/ui/**`
- Never import from apps or services
- Never add provider SDKs, data clients, or secrets
- Never modify `packages/shared-types/**`, `packages/typescript/api-client/**`

---

## 4. LEDGER

Maintain `CODEX_DESIGN_SYSTEM_LEDGER.md` at the repo root:
```
# CODEX DESIGN SYSTEM LEDGER — started <ISO ts>
## PROGRESS LOG (newest first)
- <ts> [DS#] <component> — DONE — evidence — commit <sha>
## BLOCKED
- <ts> [DS#] <component> — BLOCKED — reason
## VALIDATOR LEDGER
- <ts> validate:governance -> 128/128 PASS after <sha>
```

---

## 5. LAUNCH PROMPT

```
Read CODEX_DESIGN_SYSTEM_MISSION.md in full.
Execute continuously and autonomously.

Hard rules:
- Touch ONLY packages/typescript/ui/**. Nothing else.
- Every component is token-driven (CSS variables), accessible (WCAG-AA),
  responsive, and has a Storybook story.
- No hard-coded colors, spacing, or typography.
- pnpm turbo typecheck + pnpm lint + validate:governance green after every commit.
- Build is network-free.
- Max 3 attempts per task then BLOCKED.
- Maintain CODEX_DESIGN_SYSTEM_LEDGER.md.

Begin with the responsive enhancement tasks, then new components, then Storybook docs.
```
