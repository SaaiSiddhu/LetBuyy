# CODEX FOUNDATION STATUS V2

Status: BLOCKED — AWAITING HUMAN

The local foundation mission is green through Phase 5. Code, ledger, governance, typecheck, lint, build, Node tests, and Playwright E2E have passing local evidence. This is not marked COMPLETE because production launch still depends on human-gated credentials, provider accounts, final pricing policy, and production database rollout.

## Phase Completion

| Phase | Result | Evidence |
|---|---|---|
| Phase 0 — Truth & Safety | DONE | Baseline recorded, orphan package quarantine completed, governed stubs retained, route freeze active, One Commerce API declared. Governance 128/128. |
| Phase 1 — One Contract + Backend Collapse | DONE | Shared contract expanded, gateway schemas aligned, `@letbuyy/api-client` added, domain logic moved into core packages behind gateway, shared session verifier in `@letbuyy/auth-core`. |
| Phase 2 — Payments | DONE with human skips | `@letbuyy/payments` exists, Razorpay path wired, secondary India providers scaffolded, webhook verifier centralized. Live provider credentials are skipped. |
| Phase 3 — Themes-as-Data | DONE | Theme bundle contract, data-described renderers, JSON/Liquid renderer seam, generic schema-driven editor, bundle upload/install, and dynamic catalog migration 067. |
| Phase 4 — App Platform | DONE | App blocks, scoped OAuth lifecycle, webhooks, Razorpay billing test flow, and embedded App Bridge example. |
| Phase 5 — India-Native | DONE with human skips | GST invoice generation, logistics scaffolds, locale bundles/admin locale scaffold, pricing tier defaults/free activation, and governance recommendation logged. |

## Success Criteria

| # | Criterion | Result | Evidence |
|---:|---|---|---|
| 1 | Apps are thin clients of one Commerce API; no direct `@supabase/*` imports under `apps/**`; shared types from `@letbuyy/shared-types`. | PASS locally | `rg "from ['\"]@supabase/|import\\(['\"]@supabase/" apps` -> no matches. Phase 1 ledger records shared contract, typed API client, domain core moves, and auth verifier consolidation. Auth/console Supabase use remains through governed runtime-composition adapters for SSO/operator auth. |
| 2 | Exactly one implementation of each domain. | PASS locally | Domain planners/normalizers live in core packages and gateway routes keep transport/database execution. Phase 1/2/3/5 ledger entries record Product, Order, Customer, Payment, Theme, CMS, Billing, GST, Logistics ownership moves. |
| 3 | Second theme can be added with zero storefront code changes; editor generated from `settings_schema.json`. | PASS locally | Migration 067 seeds `starter-store`; Phase 3 gate rendered Urban Kicks and Starter Store from bundles and round-tripped generic editor settings. |
| 4 | One payment path with India-native providers. | PARTIAL — HUMAN BLOCKED | `find apps/storefront-runtime/src/app/api/payments -type f | wc -l` -> 0. `@letbuyy/payments` provider interface exists; Razorpay adapter is wired; Cashfree, PhonePe, UPI, and COD compile as scaffolds. Live Razorpay/Cashfree/PhonePe/UPI credentials and account activation are human-gated. |
| 5 | Governance, typecheck, lint, build, and Playwright all pass. | PASS locally | Final gate: `pnpm turbo typecheck` -> 57/57 PASS; `pnpm lint` -> 8/8 PASS with existing warnings; escalated `pnpm turbo build` -> 57/57 PASS; escalated `pnpm test` -> 197/197 PASS; Playwright suite -> 6/6 PASS; `pnpm run validate:governance` -> 128/128 PASS. |
| 6 | Ledger and final status summarize every task as DONE or SKIP. | PASS | `CODEX_MISSION_LEDGER.md` maintained through every phase; `CODEX_FOUNDATION_STATUS_V2.md` generated here. |

## Skipped — Needs Human

- Final production pricing approval: owner-approved paid plan prices, annual discounts, transaction fee percentages, promo policy, Enterprise sales policy, and production rollout command/migration.
- Live logistics provider account activation: Shiprocket, Delhivery, and/or Pickrr account setup, KYC, pickup verification, API credentials, and provider priority/fallback policy.
- GST e-invoice provider integration and production IRN submission: GSP/ASP vendor choice, paid account/KYC, credentials, legal/compliance sign-off, and production rollout.
- Production Razorpay billing plan activation: create/confirm live Razorpay plans and populate `plans.razorpay_plan_id_monthly/yearly`.
- Apply migration 067 to production Supabase project `qtrzgnnqnvboifoqntfi`: requires owner-approved production migration process after backup/PITR checkpoint.
- Razorpay live credential activation: `npx wrangler secret put RAZORPAY_KEY_ID --config services/api-gateway/wrangler.toml`, `npx wrangler secret put RAZORPAY_KEY_SECRET --config services/api-gateway/wrangler.toml`, and `npx wrangler secret put RAZORPAY_WEBHOOK_SECRET --config services/webhook-service/wrangler.toml`.
- Cashfree, PhonePe, and UPI AutoPay account enablement: provider accounts, KYC, API credentials, and final provider priority/fallback policy.

## Final Validation

- `pnpm turbo typecheck`: PASS, 57/57.
- `pnpm lint`: PASS, 8/8, existing warnings only.
- `pnpm turbo build`: PASS, 57/57 after escalation for Next Google Fonts network access.
- `pnpm test`: PASS, 197/197 after escalation for local loopback binding.
- `pnpm exec playwright test --project=chromium`: PASS, 6/6 against a deterministic local E2E harness covering marketing/accounts/admin/API, merchant signup/product/publish, and storefront cart/checkout.
- `pnpm run validate:governance`: PASS, 128/128 after generated artifact cleanup.

## Launch Blockers

The remaining blockers are not local code blockers. They are production authority blockers: live payment credentials, paid provider account setup, production Supabase migration approval, legal/compliance vendor selection, and final pricing policy. No production database mutation or remote git mutation was performed.
