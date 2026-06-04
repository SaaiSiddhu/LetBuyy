# CODEX MARKETPLACE UX MISSION — LetBuyy WS3

**Driver:** Codex agent. Reasoning: `xhigh`.
**Mode:** Continuous, autonomous. Never stop while unblocked work remains.
**Domain Ownership:** `apps/app-marketplace/src/**` and `apps/theme-marketplace/src/**` ONLY.
**Dependencies:** `@letbuyy/ui` components (consume only, never modify).

---

## 0. PRIME DIRECTIVE

Make the App Marketplace and Theme Marketplace feel **trustworthy, premium, and browsable** — comparable to the Shopify App Store and Theme Store. Every page uses `@letbuyy/ui` components. Every action provides feedback. Every empty state is designed.

**SUCCESS CRITERIA:**
1. App cards show icon, rating, category, pricing, and "Built for LetBuyy" badge.
2. App detail page has screenshot carousel, reviews, permissions list, pricing.
3. App install flow has a clear consent screen (scopes listed) + success toast + auto-launch.
4. Theme cards show 16:9 preview, name, price, rating.
5. Theme detail page has full preview, screenshots, "Preview in your store" action.
6. Theme filter rail (industry, layout, price, free/paid).
7. Both marketplaces use shared `Page`/`PageHeader`/`Card` grammar.
8. Toasts on all actions, skeletons on all loads, empty states everywhere.
9. Governance 128/128 maintained.

---

## 1. THE WORK

### MK1 — App Marketplace Redesign
- **MK1.1** Migrate app listing to `Page`/`PageHeader`/`Card` grammar with search + category filters.
- **MK1.2** Build app cards: icon, name, rating stars (visual), category tag, pricing line, "Built for LetBuyy" badge.
- **MK1.3** Build app detail page: screenshot carousel, description, reviews section, permissions/scopes list, pricing table, install button.
- **MK1.4** Implement consent screen: modal listing exactly what the app accesses (scopes from declared permissions).
- **MK1.5** Post-install success: toast + auto-navigate to the embedded app view.
- **MK1.6** Uninstall: `ConfirmDialog` with data-loss note.
- **MK1.7** Screenshots of all states (empty, browsing, detail, consent, installed).
- **GATE MK1:** app marketplace redesigned; before/after screenshots; governance 128/128.

### MK2 — Theme Marketplace Redesign
- **MK2.1** Migrate theme listing to `Page`/`PageHeader`/`Card` grammar with filter rail.
- **MK2.2** Build theme cards: 16:9 preview image, name, price, rating, hover-to-preview.
- **MK2.3** Filter rail: industry, layout type, price range, free/paid toggle.
- **MK2.4** Theme detail page: full-width preview, description, features, "Preview in your store" button, "Add to library" button.
- **MK2.5** Search with autocomplete over existing theme data.
- **MK2.6** Toasts on all purchase/install actions, skeletons on loads.
- **MK2.7** Screenshots of all states.
- **GATE MK2:** theme marketplace redesigned; before/after; governance 128/128.

---

## 2. OPERATING CONTRACT

1. Touch ONLY `apps/app-marketplace/src/**` and `apps/theme-marketplace/src/**`.
2. Consume `@letbuyy/ui` and `@letbuyy/api-client` — never modify them.
3. If a UX feature needs API data the gateway doesn't return, build the best UI with placeholder data and log `[SKIP — NEEDS BACKEND]`.
4. Visual proof (before/after screenshots) for every page change.
5. `pnpm turbo typecheck` + `pnpm lint` + `validate:governance` green after every commit.
6. Accessibility baseline on all new components.
7. Max 3 attempts per task → BLOCKED → next.

---

## 3. DO NOT TOUCH

- `services/**`, `packages/*-core/**`, `database/**`
- `packages/shared-types/**`, `packages/typescript/api-client/**`
- `packages/typescript/ui/**` (consume only)
- `apps/merchant-control-plane/**`, `apps/storefront-runtime/**`, `apps/identity-platform/**`
- `scripts/validators/**`, `docs/governance/**`

---

## 4. LAUNCH PROMPT

```
Read CODEX_MARKETPLACE_UX_MISSION.md in full.
Execute MK1→MK2 continuously and autonomously.

Hard rules:
- Touch ONLY apps/app-marketplace/src/** and apps/theme-marketplace/src/**.
- Compose every screen from @letbuyy/ui. No ad-hoc CSS where a component exists.
- If API data is missing, build the UI with graceful placeholders and log
  [SKIP — NEEDS BACKEND].
- Visual proof: before/after screenshots for every page.
- Keep governance 128/128 green after every commit.
- Max 3 attempts per task then BLOCKED.
- Maintain CODEX_MARKETPLACE_LEDGER.md.

Begin with MK1.1 now.
```
