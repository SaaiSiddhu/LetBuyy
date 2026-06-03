# CODEX WS9 (SETTINGS) LEDGER - started 2026-06-03T13:16:59Z

## CURRENT STATUS
- Stage: WS9 Settings Architecture.
- Branch: `stream/master-execution`.
- Active task: S1.1 settings shell/index implementation pending.
- Source ownership: `apps/merchant-control-plane/src/app/[store]/settings/**` and `apps/merchant-control-plane/src/components/settings/**` only. Root ledgers are bookkeeping exceptions.

## BASELINE (S0)
- 2026-06-03T13:16:59Z [S0.1] Settings inventory - DONE. Evidence: read `docs/Codex_waves/CODEX_SETTINGS_ARCHITECTURE_MISSION.md`, `docs/Codex_waves/CODEX_MERCHANT_UX_MISSION.md`, `LETBUYY_MERCHANT_EXPERIENCE_AUDIT.md`, `CODEX_SHOPIFY_UX_MISSION.md`, `docs/Codex_waves/CODEX_OPERATIONS_MISSION.md`, and local AGENTS for merchant control plane, platform console, and operations portal. `find apps/merchant-control-plane/src/app/[store]/settings -maxdepth 4 -type f` found current settings files for index, layout, billing, checkout, domains, general, notifications, payments, plan, policies, shipping, taxes, users, and subscribe checkout. `find apps/merchant-control-plane/src/app/api/stores/[store] -maxdepth 3 -type f` confirmed local merchant API proxy routes for settings data sources.

## SETTINGS PANE INVENTORY
| Pane | Existing route/file | Current data source | S0 notes |
|---|---|---|---|
| Settings index / hub | `settings/page.tsx` | Server session/store lookup via `getSessionUser` and `getStoreForUser`; hardcoded preview sections | Uses ad-hoc `settings-*` classes and imports `SettingsSidebar` from the WS2-owned component root. Needs WS9-owned shell/index replacement. |
| Shell layout | `settings/layout.tsx` | Server session/store lookup via `getSessionUser` and `getStoreForUser` | Wraps children with ad-hoc `settings-shell` and root `SettingsSidebar`. Needs grouped hub shell and WS9-owned components. |
| Store details / General | `settings/general/page.tsx` | `/api/stores/[store]/settings` -> `createMerchantApiClient().stores.get/update/remove` | Existing real store data, save state, toast, delete flow. Needs hub grammar consistency. |
| Plan | `settings/plan/page.tsx` | `/api/stores/[store]/plan` -> `payments.subscription.get`; cancel via `/plan/cancel` | Existing real subscription data. Needs hub grammar consistency and plan comparison polish. |
| Billing | `settings/billing/page.tsx` | `/api/stores/[store]/billing` -> subscription, subscription history, payment config | Existing real billing/payment summary. Needs invoice/app-charge clarity. |
| Subscribe checkout | `settings/subscribe/checkout/page.tsx`, `SubscribeCheckoutClient.tsx` | `/api/subscribe`, `/api/subscribe/verify`, `/api/plans` | Razorpay checkout flow exists. WS9 should restyle only and not change payment contracts. |
| Users and permissions | `settings/users/page.tsx` | `/api/stores/[store]/users` and `/users/[employeeId]` -> employee list/create/update/delete | Existing real staff data and destructive delete path. Needs role chips/index grammar consistency. |
| Payments | `settings/payments/page.tsx` | `/api/stores/[store]/payment-config` -> `stores.paymentConfig.get/save` | Existing Razorpay/COD configuration. Needs provider-card grammar and Cashfree/UPI graceful states if no data. |
| Checkout | `settings/checkout/page.tsx` | Existing page-local/static checkout settings; gateway data source not confirmed in current S0 scan | Treat missing persisted checkout branding/options as `[SKIP - NEEDS BACKEND]` if no existing API is available. |
| Shipping and delivery | `settings/shipping/page.tsx` | `/api/stores/[store]/shipping/zones` and `/shipping/zones/[zoneId]` -> shipping zones/rates | Existing real zones/rates data. Needs profiles/zones/rates grammar consistency. |
| Taxes and duties | `settings/taxes/page.tsx` | `/api/stores/[store]/taxes` and `/taxes/[taxId]` -> store tax inclusive flag and tax rates | Existing real GST/tax-rate data. Needs regional guidance. |
| Domains | `settings/domains/page.tsx` | Existing page-local/static domain settings; `/api/stores/[store]/settings` can provide store subdomain | Treat custom-domain verification as `[SKIP - NEEDS BACKEND]` if no current endpoint exists. |
| Notifications | `settings/notifications/page.tsx` | `/api/stores/[store]/settings` -> `site_settings.notifications` | Existing real site settings persistence. Needs template/preference grouping. |
| Policies | `settings/policies/page.tsx` | `/api/stores/[store]/policies` and `/policies/[policyId]` -> pages policy API | Existing real policies data. Needs legal-policy grammar consistency. |

## MISSING PANE INVENTORY
| Missing pane | Planned route | Existing data source | S0 disposition |
|---|---|---|---|
| Apps and Sales Channels | `settings/apps/page.tsx` | App installs endpoint not confirmed in merchant app S0 scan | Build placeholder or consume existing app-store API if found later; otherwise `[SKIP - NEEDS BACKEND: installed app/sales channel settings endpoint]`. |
| Business details | `settings/business/page.tsx` | Store settings route may expose partial business fields | Build from existing store fields where present; missing legal entity/GSTIN fields become `[SKIP - NEEDS BACKEND: business_details fields on sites]`. |
| Languages and Localization | `settings/localization/page.tsx` | Theme locale endpoint not confirmed | Placeholder with `[SKIP - NEEDS BACKEND: store locales endpoint/default locale fields]` if no current endpoint is found. |
| Security | `settings/security/page.tsx` | 2FA/passkey endpoints not confirmed in merchant settings scan | Placeholder with `[SKIP - NEEDS BACKEND: merchant 2FA/passkey/recovery-code endpoints]`. |
| Custom Data | `settings/custom-data/page.tsx` | Metafields/metaobjects endpoint not confirmed | Placeholder with `[SKIP - NEEDS BACKEND: metafields/metaobjects API]`. |

## PROGRESS LOG
- 2026-06-03T13:31:44Z [S0.2] Before screenshots - DONE. Commands: clean `pnpm run federation:local:up` -> PASS after resolving stale local `workerd` inspector port with `pnpm run federation:local:down` and `kill -9 30414`; `npx tsx .tmp/ws9-settings-before.ts` -> PASS, created local merchant session through `/v1/auth/custom/sessions/create`, visited all 13 settings panes on `http://127.0.0.1:3002/urban-kicks-demo/settings*`, and saved 26 desktop/mobile screenshots; `file .tmp/screenshots/ws9-before/*.png` -> PASS, all PNGs have expected desktop/mobile dimensions. Manifest: `/Users/saai_sidd/Git/Letbuyy_Store/.tmp/screenshots/ws9-before/manifest.json`.
- 2026-06-03T13:16:59Z [S0.1] Baseline inventory - DONE. Commands: `find 'apps/merchant-control-plane/src/app/[store]/settings' -maxdepth 4 -type f`, `find 'apps/merchant-control-plane/src/app/api/stores/[store]' -maxdepth 3 -type f`, and `rg` over settings/proxy routes -> PASS. Result: 13 current settings surfaces inventoried plus 5 missing panes mapped to current or backend-needed data.

## SKIPPED - NEEDS HUMAN / BACKEND / HANDOFF
- None yet. Backend gaps are identified as S0 dispositions only; final skip entries will be appended when a pane is implemented as a placeholder.

## VISUAL LEDGER
- 2026-06-03T13:31:44Z [S0.2 before] Real stack screenshot manifest: `/Users/saai_sidd/Git/Letbuyy_Store/.tmp/screenshots/ws9-before/manifest.json` (26 files: desktop + mobile for index, general, plan, billing, subscribe checkout, users, payments, checkout, shipping, taxes, domains, notifications, policies).
- Representative visual sanity checks completed: `/Users/saai_sidd/Git/Letbuyy_Store/.tmp/screenshots/ws9-before/ws9-before-desktop-index.png` and `/Users/saai_sidd/Git/Letbuyy_Store/.tmp/screenshots/ws9-before/ws9-before-mobile-payments.png` render seeded `Urban Kicks Demo` settings data without auth redirects.

## VALIDATOR LEDGER
- 2026-06-03T13:36:12Z [S0.2 pre-commit] `pnpm run validate:governance` after before-screenshot proof and generated artifact cleanup -> PASS (128/128 validators).
- 2026-06-03T13:13:44Z [Stage 3 baseline] `pnpm run validate:governance` after Stage 2 closeout -> PASS (128/128 validators).
