# CODEX WS9 (SETTINGS) LEDGER - started 2026-06-03 07:16:34 IST

Ledger kept inside the owned settings route boundary to satisfy WS9 ownership constraints.

## BASELINE (S0)

13 existing settings panes inventoried:

| Pane | Route | Current frontend data source | Gateway/source authority | Status |
|---|---|---|---|---|
| Settings index | `/[store]/settings` | Local settings index | Presentation only | DONE S0.1 |
| Store details | `/[store]/settings/general` | `GET/PATCH/DELETE /api/stores/:store/settings` | `stores.ts` / `sites` store profile | DONE S0.1 |
| Payments | `/[store]/settings/payments` | `GET/POST /api/stores/:store/payment-config` | `payments.ts` / `payment_configs` | DONE S0.1 |
| Domains | `/[store]/settings/domains` | `GET/PATCH /api/stores/:store/settings` | `stores.ts` / domain fields | DONE S0.1 |
| Plan | `/[store]/settings/plan` | `GET /api/stores/:store/plan`, `POST /plan/cancel`, `GET /api/plans` | `billing-core`, subscriptions, plans | DONE S0.1 |
| Billing | `/[store]/settings/billing` | `GET /api/stores/:store/billing` | `billing-core`, subscriptions, invoices, payment config | DONE S0.1 |
| Subscribe checkout | `/[store]/settings/subscribe/checkout` | Server `payments.plans`, `POST /api/subscribe`, `POST /api/subscribe/verify` | `billing-core`, `payments.ts`, Razorpay checkout | DONE S0.1 |
| Users and permissions | `/[store]/settings/users` | `GET/POST /api/stores/:store/users`, `PATCH/DELETE /users/:employeeId` | `employee.ts`, `auth-core` RBAC | DONE S0.1 |
| Checkout | `/[store]/settings/checkout` | `GET/PATCH /api/stores/:store/settings.site_settings.checkout` | `checkout-core` compatibility fields | DONE S0.1 |
| Shipping and delivery | `/[store]/settings/shipping` | `GET/POST /api/stores/:store/shipping/zones`, `PATCH/DELETE /shipping/zones/:zoneId` | `shipping-tax.ts` / `shipping_zones` | DONE S0.1 |
| Taxes and duties | `/[store]/settings/taxes` | `GET/PATCH/POST /api/stores/:store/taxes`, `PATCH/DELETE /taxes/:taxId` | `shipping-tax.ts` / `tax_rates` | DONE S0.1 |
| Notifications | `/[store]/settings/notifications` | `GET/PATCH /api/stores/:store/settings.site_settings.notifications` | `notifications.ts` compatibility via `site_settings` | DONE S0.1 |
| Policies | `/[store]/settings/policies` | `GET/PATCH /api/stores/:store/settings` policy fields | `pages.ts` / `cms-core` policy content compatibility | DONE S0.1 |

Before screenshots: PENDING - requires reachable authenticated merchant route and dev/browser verification.

## PROGRESS LOG (newest first)

- 2026-06-03 09:05 IST [S5.5] Tightened mobile settings drawer behavior with initial dialog focus, page scroll lock while open, and focus restoration on close.
- 2026-06-03 08:53 IST [S5.4] Added mobile settings drawer dialog semantics, labelled title, modal state, and Escape-to-close behavior inside the owned settings shell.
- 2026-06-03 08:47 IST [S5.3] Replaced full-page retry reloads with abort-safe pane-local data reload handlers for General, Domains, Checkout, Notifications, and Policies, preserving each pane's existing gateway/app-boundary data flow.
- 2026-06-03 08:33 IST [S2.3] Migrated Billing invoice history from a raw table to shared `IndexTable` while preserving invoice formatting, empty state, and existing `/api/stores/:store/billing` data flow.
- 2026-06-03 08:29 IST [S3.1] Hardened Apps and sales channels installed-app rendering against malformed `scopes_granted` compatibility data while preserving the existing app-store gateway contract.
- 2026-06-03 08:05 IST [S4.2/S5.2] Fixed settings shell search a11y by giving desktop and mobile drawer search instances unique input/result IDs while keeping shared query state and drawer navigation behavior.
- 2026-06-03 08:00 IST [S2.1-S2.9] Normalized the remaining settings panes through `SettingsPane` so per-pane headers, guidance, and SaveBar placement share one shell: Settings index, General, Payments, Domains, Plan, Billing, Users, Checkout, Shipping, Taxes, Notifications, Policies, and Subscribe checkout. Settings hub now reads the same local nav manifest as the left index/search, including missing backend-needed panes.
- 2026-06-03 07:31 IST [S2.4/S2.5] Migrated subscribe checkout off bespoke global CSS into `SettingsPane`/Card/Section controls and migrated Users staff list to `IndexTable` - typecheck pass before cleanup; governance pass after generated artifact cleanup.
- 2026-06-03 07:24 IST [S3] Added missing panes: Apps and sales channels (gateway-backed), Business details (partial read + backend-needed mutation), Languages and localization (partial read + backend-needed locale endpoint), Security (backend-needed), Custom Data (backend-needed) - `pnpm --filter @letbuyy/merchant-control-plane typecheck` -> pass; lint -> pass with 5 pre-existing warnings outside WS9.
- 2026-06-03 07:16 IST [S1.1/S4.1/S5.1] Settings shell components created - grouped left index, settings search, mobile drawer, active route ARIA, and owned layout replacement - verification pending.
- 2026-06-03 07:16 IST [S1.2] `SettingsPane` wrapper created for Page -> Section -> Card panes and shared SaveBar placement - verification pending.
- 2026-06-03 07:16 IST [S0.1] Baseline inventory complete for 13 existing panes and gateway data sources.

## SKIPPED - NEEDS HUMAN / BACKEND / HANDOFF

- [HANDOFF -> WS2] Register Settings group in the shared app-shell route manifest if WS2 exposes one. No safe route manifest was present in this branch, and WS9 must not edit Sidebar/global layout.
- [DONE] Apps and sales channels uses existing gateway data: `GET /v1/app-store/installations?store_id=:id` through `createMerchantApiClient().appStore.installations`; uninstall uses existing `DELETE /v1/app-store/apps/:appId/install?store_id=:id`.
- [SKIP - NEEDS BACKEND] Business details requires `PATCH /v1/stores/:id` and app boundary `PATCH /api/stores/:store/settings` to accept `legal_name`, `gstin`, `gst_state_code`, `invoice_prefix`, and `billing_address`.
- [SKIP - NEEDS BACKEND] Languages and localization requires `GET/PATCH /api/stores/:store/localization` or `GET/PATCH /v1/stores/:id/localization` for enabled locales and default storefront locale.
- [SKIP - NEEDS BACKEND] Security requires merchant 2FA/passkey/recovery-code endpoints.
- [SKIP - NEEDS BACKEND] Custom data requires metafields/metaobjects API such as `GET/PATCH /api/stores/:store/custom-data` or a versioned gateway equivalent.

## VISUAL LEDGER

- Before screenshots: BLOCKED - mission doc was untracked in the original checkout and the new WS9 worktree started from committed `develop`; no pre-change browser screenshots were available before edits.
- After screenshots: BLOCKED - merchant dev server started at `http://localhost:3002`, but `/demo/settings` returned `307` to `http://localhost:3001/lookup?return_to=...` because no authenticated merchant session/local accounts app is available. Browser plugin also reported `net::ERR_BLOCKED_BY_CLIENT` for both `localhost` and `127.0.0.1`.

## VALIDATOR LEDGER

- 2026-06-03 07:16 IST `pnpm install` -> success, 35 workspace projects, lockfile up to date.
- 2026-06-03 07:24 IST `pnpm --filter @letbuyy/merchant-control-plane typecheck` -> pass.
- 2026-06-03 07:24 IST `pnpm --filter @letbuyy/merchant-control-plane lint` -> pass with 5 pre-existing warnings outside WS9 (`products/page.tsx`, `stores/AllStoresClient.tsx`, `HeaderBar.tsx`, `lib/auth/session.ts`).
- 2026-06-03 07:31 IST `pnpm run validate:governance` -> pass, 128 validators, after removing generated nested `node_modules` and `tsconfig.tsbuildinfo` artifacts created by install/typecheck.
- 2026-06-03 07:36 IST Visual route check -> `curl -I http://localhost:3002/demo/settings` returned 307 auth redirect to accounts app; screenshots blocked without local authenticated merchant session.
- 2026-06-03 08:00 IST `pnpm --filter @letbuyy/merchant-control-plane typecheck` -> pass after remaining pane wrapper migration.
- 2026-06-03 08:00 IST `pnpm --filter @letbuyy/merchant-control-plane lint` -> pass with same 5 pre-existing warnings outside WS9 (`products/page.tsx`, `stores/AllStoresClient.tsx`, `HeaderBar.tsx`, `lib/auth/session.ts`).
- 2026-06-03 08:00 IST `pnpm run validate:governance` -> pass, 128 validators, after removing generated nested `node_modules` and `tsconfig.tsbuildinfo` artifacts created by offline install/typecheck.
- 2026-06-03 08:05 IST `pnpm --filter @letbuyy/merchant-control-plane typecheck` -> pass after shell/search a11y cleanup.
- 2026-06-03 08:05 IST `pnpm --filter @letbuyy/merchant-control-plane lint` -> pass with same 5 pre-existing warnings outside WS9 (`products/page.tsx`, `stores/AllStoresClient.tsx`, `HeaderBar.tsx`, `lib/auth/session.ts`).
- 2026-06-03 08:05 IST `pnpm run validate:governance` -> pass, 128 validators, after removing generated nested `node_modules` and `tsconfig.tsbuildinfo` artifacts created by offline install/typecheck.
- 2026-06-03 08:29 IST `pnpm --filter @letbuyy/merchant-control-plane typecheck` -> pass after Apps settings runtime guard.
- 2026-06-03 08:29 IST `pnpm --filter @letbuyy/merchant-control-plane lint` -> pass with same 5 pre-existing warnings outside WS9 (`products/page.tsx`, `stores/AllStoresClient.tsx`, `HeaderBar.tsx`, `lib/auth/session.ts`).
- 2026-06-03 08:29 IST `pnpm run validate:governance` -> pass, 128 validators, after removing generated nested `node_modules` and `tsconfig.tsbuildinfo` artifacts created by offline install/typecheck.
- 2026-06-03 08:33 IST `pnpm --filter @letbuyy/merchant-control-plane typecheck` -> pass after Billing invoice `IndexTable` migration.
- 2026-06-03 08:33 IST `pnpm --filter @letbuyy/merchant-control-plane lint` -> pass with same 5 pre-existing warnings outside WS9 (`products/page.tsx`, `stores/AllStoresClient.tsx`, `HeaderBar.tsx`, `lib/auth/session.ts`).
- 2026-06-03 08:33 IST `pnpm run validate:governance` -> pass, 128 validators, after removing generated nested `node_modules` and `tsconfig.tsbuildinfo` artifacts created by offline install/typecheck.
- 2026-06-03 08:47 IST `pnpm --filter @letbuyy/merchant-control-plane typecheck` -> pass after pane-local retry loader cleanup.
- 2026-06-03 08:47 IST `pnpm --filter @letbuyy/merchant-control-plane lint` -> pass with same 5 pre-existing warnings outside WS9 (`products/page.tsx`, `stores/AllStoresClient.tsx`, `HeaderBar.tsx`, `lib/auth/session.ts`).
- 2026-06-03 08:47 IST `pnpm run validate:governance` -> pass, 128 validators, after removing generated nested `node_modules` and `tsconfig.tsbuildinfo` artifacts created by offline install/typecheck.
- 2026-06-03 08:53 IST `pnpm --filter @letbuyy/merchant-control-plane typecheck` -> pass after mobile drawer a11y cleanup.
- 2026-06-03 08:53 IST `pnpm --filter @letbuyy/merchant-control-plane lint` -> pass with same 5 pre-existing warnings outside WS9 (`products/page.tsx`, `stores/AllStoresClient.tsx`, `HeaderBar.tsx`, `lib/auth/session.ts`).
- 2026-06-03 08:53 IST `pnpm run validate:governance` -> pass, 128 validators, after removing generated nested `node_modules` and `tsconfig.tsbuildinfo` artifacts created by offline install/typecheck.
- 2026-06-03 09:05 IST `pnpm --filter @letbuyy/merchant-control-plane typecheck` -> pass after drawer focus/scroll handling.
- 2026-06-03 09:05 IST `pnpm --filter @letbuyy/merchant-control-plane lint` -> pass with same 5 pre-existing warnings outside WS9 (`products/page.tsx`, `stores/AllStoresClient.tsx`, `HeaderBar.tsx`, `lib/auth/session.ts`).
- 2026-06-03 09:05 IST `pnpm run validate:governance` -> pass, 128 validators, after removing generated nested `node_modules` and `tsconfig.tsbuildinfo` artifacts created by offline install/typecheck.
