# CODEX SHOPIFY UX LEDGER - started 2026-06-02T09:31:20Z

## BASELINE (UX0)
- Mission source read: `CODEX_SHOPIFY_UX_MISSION.md` (211 lines) and `LETBUYY_MERCHANT_EXPERIENCE_AUDIT.md` (459 lines).
- Repository memory read: root `AGENTS.md`, `CLAUDE.md`, `memory/lessons.md`, `tasks/todo.md`, `apps/merchant-control-plane/AGENTS.md`, and `packages/typescript/ui/AGENTS.md`.
- Merchant app source surface: 56 `page.tsx` files under `apps/merchant-control-plane/src/app`; 1 route-level `loading.tsx`.
- Major merchant screens queued for baseline screenshots: Dashboard, Products, Orders, Customers, Themes, Apps, Analytics, Settings.
- Shared UI package today: `Button`, `Input`, `Textarea`, `DataTable`, `Badge`, `DesignSystemRoot`, font exports, and icon exports from `packages/typescript/ui/src/index.ts`.
- Storybook status: no Storybook files or scripts detected in `packages/typescript/ui`.
- Token status: no shared token module in `@letbuyy/ui`; merchant app owns app-local variables in `apps/merchant-control-plane/src/app/globals.css`.
- Merchant CSS baseline: `apps/merchant-control-plane/src/app/globals.css` is 9,248 lines.
- Inline style baseline: `rg -l "style=\\{\\{" apps/merchant-control-plane/src | wc -l` -> 63 files; `rg -n "style=\\{\\{" apps/merchant-control-plane/src | wc -l` -> 995 occurrences.
- Feedback baseline: `rg -l "toast|Toast|saveMessage|uploadMessage|settings-toast|trial-toast" apps/merchant-control-plane/src | wc -l` -> 12 files.
- Loading baseline: `rg -l "skeleton|Skeleton|loading|Loading" apps/merchant-control-plane/src | wc -l` -> 47 files; route loading files -> 1.
- Empty-state baseline: `rg -l "empty|Empty|No .* yet|No .* found|will appear here" apps/merchant-control-plane/src/app apps/merchant-control-plane/src/components | wc -l` -> 39 files with ad-hoc empty-state language.
- Navigation baseline: `apps/merchant-control-plane/src/components/Sidebar.tsx` contains app-local dynamic nav groups for store, portfolio, resume, landing, and blog site types. Store nav exposes Home, Orders, Products with five children, Customers, Reviews, Discounts, Analytics, Apps, Online Store with three children, plus Settings in the footer. It uses Material icon names and `globals.css` classes rather than shared UI navigation components.
- Command palette baseline: `apps/merchant-control-plane/src/components/CommandPalette.tsx` exists as an app-local route/action palette with static commands. It is not a shared `@letbuyy/ui` component and does not yet search gateway entities.
- Workflow baseline: Dashboard has a setup/dashboard client and trial banner; Products, Orders, Customers, Themes, Apps, Analytics, and Settings pages exist, but current UX patterns are page-local, CSS-class driven, and inconsistently use empty, skeleton, toast, and save states.
- Before-screenshots (real local stack): `artifacts/shopify-ux/ux0/before/dashboard.png`, `artifacts/shopify-ux/ux0/before/products.png`, `artifacts/shopify-ux/ux0/before/orders.png`, `artifacts/shopify-ux/ux0/before/customers.png`, `artifacts/shopify-ux/ux0/before/themes.png`, `artifacts/shopify-ux/ux0/before/apps.png`, `artifacts/shopify-ux/ux0/before/analytics.png`, `artifacts/shopify-ux/ux0/before/settings.png`.

## PROGRESS LOG (newest first)
- 2026-06-02T11:51:11Z [UX2.2] Settings page migration to shared page grammar - DONE - evidence: `pnpm --filter @letbuyy/merchant-control-plane typecheck` -> PASS; `pnpm --filter @letbuyy/merchant-control-plane lint` -> PASS with 47 pre-existing warnings; `pnpm lint` -> PASS with pre-existing warnings; `pnpm turbo typecheck` -> 57/57 tasks successful; `pnpm run validate:governance` -> `Governance validation passed (128 validators)` after removing generated verification outputs - screenshot `artifacts/shopify-ux/ux2/settings-after.png` - commit `b8affa9`.
- 2026-06-02T11:51:11Z [UX2.2] Analytics page migration to shared page grammar - DONE - evidence: `pnpm --filter @letbuyy/merchant-control-plane typecheck` -> PASS; `pnpm --filter @letbuyy/merchant-control-plane lint` -> PASS with 47 pre-existing warnings; `pnpm lint` -> PASS with pre-existing warnings; `pnpm turbo typecheck` -> 57/57 tasks successful; `pnpm run validate:governance` -> `Governance validation passed (128 validators)` after removing generated verification outputs - screenshot `artifacts/shopify-ux/ux2/analytics-after.png` - commit `b8affa9`.
- 2026-06-02T11:35:40Z [UX2.2] Apps page migration to shared page grammar - DONE - evidence: `pnpm --filter @letbuyy/merchant-control-plane typecheck` -> PASS; `pnpm --filter @letbuyy/merchant-control-plane lint` -> PASS with 47 pre-existing warnings; `pnpm lint` -> PASS with pre-existing warnings; `pnpm turbo typecheck` -> 57/57 tasks successful; `pnpm run validate:governance` -> `Governance validation passed (128 validators)` after removing generated verification outputs - screenshot `artifacts/shopify-ux/ux2/apps-after.png` - commit `65e2cf9`.
- 2026-06-02T11:30:21Z [UX2.2] Themes page migration to shared page grammar - DONE - evidence: `pnpm --filter @letbuyy/merchant-control-plane typecheck` -> PASS; `pnpm --filter @letbuyy/merchant-control-plane lint` -> PASS with 47 pre-existing warnings; `pnpm lint` -> PASS with pre-existing warnings; `pnpm turbo typecheck` -> 57/57 tasks successful; `pnpm run validate:governance` -> `Governance validation passed (128 validators)` after removing generated verification outputs - screenshot `artifacts/shopify-ux/ux2/themes-after.png` - commit `2a0f106`.
- 2026-06-02T11:22:37Z [UX2.2] Dashboard page migration to shared page grammar - DONE - evidence: `pnpm --filter @letbuyy/merchant-control-plane typecheck` -> PASS; `pnpm --filter @letbuyy/merchant-control-plane lint` -> PASS with 47 pre-existing warnings; `pnpm lint` -> PASS with pre-existing warnings; `pnpm turbo typecheck` -> 57/57 tasks successful; `pnpm run validate:governance` -> `Governance validation passed (128 validators)` after removing generated verification outputs - screenshot `artifacts/shopify-ux/ux2/dashboard-after.png` - commit `d3b4257`.
- 2026-06-02T11:13:21Z [UX2.2] Customers page migration to shared page grammar - DONE - evidence: `pnpm --filter @letbuyy/merchant-control-plane typecheck` -> PASS; `pnpm --filter @letbuyy/merchant-control-plane lint` -> PASS with 47 pre-existing warnings; `pnpm lint` -> PASS with pre-existing warnings; `pnpm turbo typecheck` -> 57/57 tasks successful; `pnpm run validate:governance` -> `Governance validation passed (128 validators)` after removing generated verification outputs - screenshot `artifacts/shopify-ux/ux2/customers-after.png` - commit `fb4baa4`.
- 2026-06-02T11:07:36Z [UX2.2] Orders page migration to shared page grammar - DONE - evidence: `pnpm --filter @letbuyy/merchant-control-plane typecheck` -> PASS; `pnpm --filter @letbuyy/merchant-control-plane lint` -> PASS with 47 pre-existing warnings; `pnpm lint` -> PASS with pre-existing warnings; `pnpm turbo typecheck` -> 57/57 tasks successful; `pnpm run validate:governance` -> `Governance validation passed (128 validators)` after removing generated verification outputs - screenshot `artifacts/shopify-ux/ux2/orders-after.png` - commit `cf6af8c`.
- 2026-06-02T10:56:33Z [UX2.2] Products page migration to shared page grammar - DONE - evidence: `pnpm --filter @letbuyy/merchant-control-plane typecheck` -> PASS; `pnpm --filter @letbuyy/merchant-control-plane lint` -> PASS with 47 pre-existing warnings; `pnpm lint` -> PASS with pre-existing warnings; `pnpm turbo typecheck` -> 57/57 tasks successful; `pnpm run validate:governance` -> `Governance validation passed (128 validators)` after removing generated verification outputs - screenshot `artifacts/shopify-ux/ux2/products-after.png` - commit `ddc8910`.
- 2026-06-02T10:56:33Z [UX2.1] Standard `Page -> PageHeader -> Card -> Section` template - DONE - evidence: `PageGrammar` Storybook story in `@letbuyy/ui` plus Products page consuming the grammar - screenshot `artifacts/shopify-ux/ux1/storybook/page-grammar.png` and `artifacts/shopify-ux/ux2/products-after.png` - commit `4502bf4` / `ddc8910`.
- 2026-06-02T10:39:02Z [GATE UX1] Design system foundation gate - DONE - evidence: `pnpm --filter @letbuyy/ui typecheck` -> PASS; `pnpm --filter @letbuyy/ui build-storybook` -> completed successfully; `pnpm lint` -> PASS with pre-existing warnings; `pnpm turbo typecheck` -> 57/57 tasks successful; `pnpm run validate:governance` -> `Governance validation passed (128 validators)` after removing generated `node_modules`, `.turbo`, `dist`, and `storybook-static` verification outputs - screenshot `artifacts/shopify-ux/ux1/storybook/*.png` - commit `2e41580`.
- 2026-06-02T10:39:02Z [UX1.3] Token guardrail and Storybook documentation - DONE - evidence: color/palette/literal-size `rg` guardrail scans -> no matches outside `tokens.ts`; `pnpm --filter @letbuyy/ui typecheck` -> PASS; `pnpm --filter @letbuyy/ui build-storybook` -> completed successfully; Playwright screenshot -> captured `usage-guidelines.png` - screenshot `artifacts/shopify-ux/ux1/storybook/usage-guidelines.png` - commit `2e41580`.
- 2026-06-02T10:23:32Z [UX1.2] Token-driven component layer and Storybook - DONE - evidence: `pnpm --filter @letbuyy/ui typecheck` -> PASS; `pnpm --filter @letbuyy/ui build-storybook` -> completed successfully; `node .tmp/ux1-storybook-screenshots.mjs` -> 5 screenshots captured; `pnpm lint` -> PASS with pre-existing warnings; `pnpm turbo typecheck` -> 57/57 tasks successful - screenshot `artifacts/shopify-ux/ux1/storybook/*.png` - commit `4502bf4`.
- 2026-06-02T10:02:07Z [UX1.1] Design token foundation - DONE - evidence: `pnpm --filter @letbuyy/ui typecheck` -> PASS; `pnpm lint` -> PASS with pre-existing warnings; `pnpm turbo typecheck` -> 57/57 tasks successful - screenshot n/a (token source and CSS-variable export; component visual proof starts in UX1.2) - commit `5164abc`.
- 2026-06-02T09:54:56Z [GATE UX0] Baseline visual inventory and governance gate - DONE - evidence: `pnpm lint` -> PASS with pre-existing warnings; `pnpm turbo typecheck` -> 57/57 tasks successful; `pnpm run validate:governance` -> `Governance validation passed (128 validators)` after removing local-stack generated `.next`, nested `node_modules`, `.turbo`, `dist`, and `.wrangler` caches - screenshot `artifacts/shopify-ux/ux0/before/*.png` - commit `6a94a25`.
- 2026-06-02T09:46:28Z [UX0.2] Before-state visual inventory - DONE - evidence: `pnpm run federation:local:up` -> real local stack booted after clearing stale listeners; `node .tmp/ux0-before-screenshots.mjs` -> 8 screenshots captured - screenshot `artifacts/shopify-ux/ux0/before/*.png` - commit `6a94a25`.
- 2026-06-02T09:31:20Z [UX0.1] Baseline ledger and source inventory - DONE - evidence: source reads and inventory commands recorded above - screenshot n/a - commit `6a94a25`.

## SKIPPED - NEEDS HUMAN / BACKEND

## VISUAL LEDGER
- 2026-06-02T10:39:02Z UX1 Usage guardrails story - before n/a | after `artifacts/shopify-ux/ux1/storybook/usage-guidelines.png`
- 2026-06-02T10:23:32Z UX1 Page grammar story - before n/a | after `artifacts/shopify-ux/ux1/storybook/page-grammar.png`
- 2026-06-02T10:23:32Z UX1 Forms and feedback story - before n/a | after `artifacts/shopify-ux/ux1/storybook/forms-and-feedback.png`
- 2026-06-02T10:23:32Z UX1 Empty and loading states story - before n/a | after `artifacts/shopify-ux/ux1/storybook/empty-and-loading-states.png`
- 2026-06-02T10:23:32Z UX1 Tables and productivity story - before n/a | after `artifacts/shopify-ux/ux1/storybook/tables-and-productivity.png`
- 2026-06-02T10:23:32Z UX1 Overlays and command palette story - before n/a | after `artifacts/shopify-ux/ux1/storybook/overlays-and-command-palette.png`
- 2026-06-02T11:22:37Z Dashboard - before `artifacts/shopify-ux/ux0/before/dashboard.png` | after `artifacts/shopify-ux/ux2/dashboard-after.png`
- 2026-06-02T10:56:33Z Products - before `artifacts/shopify-ux/ux0/before/products.png` | after `artifacts/shopify-ux/ux2/products-after.png`
- 2026-06-02T11:07:36Z Orders - before `artifacts/shopify-ux/ux0/before/orders.png` | after `artifacts/shopify-ux/ux2/orders-after.png`
- 2026-06-02T11:13:21Z Customers - before `artifacts/shopify-ux/ux0/before/customers.png` | after `artifacts/shopify-ux/ux2/customers-after.png`
- 2026-06-02T11:30:21Z Themes - before `artifacts/shopify-ux/ux0/before/themes.png` | after `artifacts/shopify-ux/ux2/themes-after.png`
- 2026-06-02T11:35:40Z Apps - before `artifacts/shopify-ux/ux0/before/apps.png` | after `artifacts/shopify-ux/ux2/apps-after.png`
- 2026-06-02T11:51:11Z Analytics - before `artifacts/shopify-ux/ux0/before/analytics.png` | after `artifacts/shopify-ux/ux2/analytics-after.png`
- 2026-06-02T11:51:11Z Settings - before `artifacts/shopify-ux/ux0/before/settings.png` | after `artifacts/shopify-ux/ux2/settings-after.png`

## VALIDATOR LEDGER
- 2026-06-02T11:51:11Z pnpm --filter @letbuyy/merchant-control-plane typecheck -> PASS
- 2026-06-02T11:51:11Z pnpm --filter @letbuyy/merchant-control-plane lint -> PASS (47 pre-existing warnings)
- 2026-06-02T11:51:11Z pnpm lint -> PASS (pre-existing warnings only)
- 2026-06-02T11:51:11Z pnpm turbo typecheck -> PASS (57/57 tasks successful)
- 2026-06-02T11:51:11Z validate:governance -> 128/128 PASS after Analytics and Settings migrations (`b8affa9`)
- 2026-06-02T11:35:40Z pnpm --filter @letbuyy/merchant-control-plane typecheck -> PASS
- 2026-06-02T11:35:40Z pnpm --filter @letbuyy/merchant-control-plane lint -> PASS (47 pre-existing warnings)
- 2026-06-02T11:35:40Z pnpm lint -> PASS (pre-existing warnings only)
- 2026-06-02T11:35:40Z pnpm turbo typecheck -> PASS (57/57 tasks successful)
- 2026-06-02T11:35:40Z validate:governance -> 128/128 PASS after Apps migration (`65e2cf9`)
- 2026-06-02T11:30:21Z pnpm --filter @letbuyy/merchant-control-plane typecheck -> PASS
- 2026-06-02T11:30:21Z pnpm --filter @letbuyy/merchant-control-plane lint -> PASS (47 pre-existing warnings)
- 2026-06-02T11:30:21Z pnpm lint -> PASS (pre-existing warnings only)
- 2026-06-02T11:30:21Z pnpm turbo typecheck -> PASS (57/57 tasks successful)
- 2026-06-02T11:30:21Z validate:governance -> 128/128 PASS after Themes migration (`2a0f106`)
- 2026-06-02T11:22:37Z pnpm --filter @letbuyy/merchant-control-plane typecheck -> PASS
- 2026-06-02T11:22:37Z pnpm --filter @letbuyy/merchant-control-plane lint -> PASS (47 pre-existing warnings)
- 2026-06-02T11:22:37Z pnpm lint -> PASS (pre-existing warnings only)
- 2026-06-02T11:22:37Z pnpm turbo typecheck -> PASS (57/57 tasks successful)
- 2026-06-02T11:22:37Z validate:governance -> 128/128 PASS after Dashboard migration (`d3b4257`)
- 2026-06-02T11:13:21Z pnpm --filter @letbuyy/merchant-control-plane typecheck -> PASS
- 2026-06-02T11:13:21Z pnpm --filter @letbuyy/merchant-control-plane lint -> PASS (47 pre-existing warnings)
- 2026-06-02T11:13:21Z pnpm lint -> PASS (pre-existing warnings only)
- 2026-06-02T11:13:21Z pnpm turbo typecheck -> PASS (57/57 tasks successful)
- 2026-06-02T11:13:21Z validate:governance -> 128/128 PASS after Customers migration (`fb4baa4`)
- 2026-06-02T11:07:36Z pnpm --filter @letbuyy/merchant-control-plane typecheck -> PASS
- 2026-06-02T11:07:36Z pnpm --filter @letbuyy/merchant-control-plane lint -> PASS (47 pre-existing warnings)
- 2026-06-02T11:07:36Z pnpm lint -> PASS (pre-existing warnings only)
- 2026-06-02T11:07:36Z pnpm turbo typecheck -> PASS (57/57 tasks successful)
- 2026-06-02T11:07:36Z validate:governance -> 128/128 PASS after Orders migration (`cf6af8c`)
- 2026-06-02T10:56:33Z pnpm --filter @letbuyy/merchant-control-plane typecheck -> PASS
- 2026-06-02T10:56:33Z pnpm --filter @letbuyy/merchant-control-plane lint -> PASS (47 pre-existing warnings)
- 2026-06-02T10:56:33Z pnpm lint -> PASS (pre-existing warnings only)
- 2026-06-02T10:56:33Z pnpm turbo typecheck -> PASS (57/57 tasks successful)
- 2026-06-02T10:56:33Z validate:governance -> 128/128 PASS after Products migration (`ddc8910`)
- 2026-06-02T10:39:02Z UI token guardrail scans -> PASS (no color/palette/literal-size matches outside `tokens.ts`)
- 2026-06-02T10:39:02Z pnpm --filter @letbuyy/ui typecheck -> PASS
- 2026-06-02T10:39:02Z pnpm --filter @letbuyy/ui build-storybook -> PASS
- 2026-06-02T10:39:02Z pnpm lint -> PASS (pre-existing warnings only)
- 2026-06-02T10:39:02Z pnpm turbo typecheck -> PASS (57/57 tasks successful)
- 2026-06-02T10:39:02Z validate:governance -> 128/128 PASS after UX1 foundation (`2e41580`)
- 2026-06-02T10:23:32Z pnpm --filter @letbuyy/ui typecheck -> PASS
- 2026-06-02T10:23:32Z pnpm --filter @letbuyy/ui build-storybook -> PASS
- 2026-06-02T10:23:32Z pnpm lint -> PASS (pre-existing warnings only)
- 2026-06-02T10:23:32Z pnpm turbo typecheck -> PASS (57/57 tasks successful)
- 2026-06-02T10:02:07Z pnpm --filter @letbuyy/ui typecheck -> PASS
- 2026-06-02T10:02:07Z pnpm lint -> PASS (pre-existing warnings only)
- 2026-06-02T10:02:07Z pnpm turbo typecheck -> PASS (57/57 tasks successful)
- 2026-06-02T09:54:56Z pnpm lint -> PASS (pre-existing warnings only)
- 2026-06-02T09:54:56Z pnpm turbo typecheck -> PASS (57/57 tasks successful)
- 2026-06-02T09:54:56Z validate:governance -> 128/128 PASS after UX0 baseline (`6a94a25`)
