# 15. Evidence Appendix

Primary evidence index. Paths relative to repository root. Line numbers from `database/supabase/migrations/000_baseline.sql` ("baseline") and route files as of 2026-06-05.

## A. Database Schema (baseline = `database/supabase/migrations/000_baseline.sql`)

| Evidence | Location |
|---|---|
| `employees` (dual-purpose: nullable `store_id`, role enum, status enum, `department`) | baseline:9161-9183 |
| `employee_permissions` (role→permission strings) | baseline:9136-9141 |
| `employee_roles` (permissions jsonb) | baseline:9148-9154 |
| `employee_invites` | baseline (CREATE TABLE public.employee_invites) |
| `super_admin_allowlist` (2FA fields, `allowed_ips`) | baseline:12328-12345 |
| `audit_logs` (actor_type: user/employee/super_admin/system; old/new values; IP/UA) | baseline:8429-8444 |
| `sites` status enums (`draft/published/unpublished/frozen/suspended`; trial states) | baseline:12007-12008 |
| `marketplace_review_records` (5 statuses; reviewed_by/at; review_notes; automated_checks) | baseline + `services/api-gateway/src/lib/marketplace-review-records.ts:29-64` |
| `marketplace_apps` status (`draft/in_review/published/suspended/rejected`) | baseline CHECK |
| `app_developers` status (`pending/approved/suspended/rejected`) | baseline CHECK |
| `app_billing_charges` (merchant-approval billing states) | baseline CHECK |
| `partner_payout_ledger_entries` (rev-share 8000 bps; rails incl. `manual`; pending→released states) | baseline:10222-10254 |
| `theme_packages` / `theme_package_versions` / `theme_purchases` / `theme_migrations` / `theme_releases` / `theme_instances` | baseline (incl. theme_migrations:12593-12604) |
| `production_incidents` / `production_incident_events` | baseline:6055-6140 |
| `operational_feature_flags` (status incl. `approved`; rollout_percent) — no mutation API | baseline:9973-9995 |
| `operational_dashboard_snapshots` | baseline:5654-5670 |
| `email_logs` (types incl. OTP/order emails; sent/failed/bounced) | baseline:9097-9111 |
| `contact_submissions` (shopper→merchant mail) | baseline |
| `onboarding_attempts`, `site_memberships`/`site_roles`/`site_role_permissions` (allow/deny) | baseline:11885-11943 |
| Seeded employee permissions (support/marketing/operations) | `database/supabase/seeds/001_seed.sql:7-19` |
| Urban Kicks sole theme (free, LetBuyy-authored, perf budgets LCP 2500ms/JS 180KB) | `database/supabase/seeds/urban-kicks-theme.sql`; `database/supabase/verification/055_only_urban_kicks_theme_catalog.sql` |
| Product review moderation status | `database/supabase/verification/037_product_reviews_moderation_status.sql` |
| Cashfree provider | `database/supabase/migrations/075_cashfree_payment_provider.sql` |
| Table census: 233 tables; no support/ticket, fraud, dispute, case, DSR, team, task tables | `grep "CREATE TABLE" database/supabase/migrations/*.sql` |

## B. API Gateway (`services/api-gateway/src/`)

| Evidence | Location |
|---|---|
| Admin gating (`requireRoleCategory('ops')` + `requireSuperAdmin` on all routes) | `routes/admin.ts:9` |
| Store status mutation + audit write | `routes/admin.ts:104-138` |
| Store hard delete | `routes/admin.ts:139` |
| Employee invite / deactivate / delete (invite email TODO) | `routes/admin.ts:255-318` |
| Employee accept-invite / login; tickets **501 SUPPORT_TICKETS_UNAVAILABLE** | `routes/employee.ts:89-144, 296-317` |
| Ops allowlist lookup (`super_admin_allowlist`) | `middleware/rbac.ts:30-53`; role categories 103-141 |
| Marketplace review list/decision (+status cascades, domain events, idempotency keys) | `routes/operations.ts:300-383` |
| Runtime ops suite (outbox/dead-letters/replay, jobs, webhooks, queues recover/redrive, replays+authorize, control commands, incidents CRUD, drills/chaos/load, deployments/gates, event-store integrity/archive, dashboards, error budgets) | `routes/operations.ts:385-1316` |
| Internal console read API (summary/analytics/settings/users/stores/subscriptions/employees/audit-logs) | `routes/internal-console.ts:132-353` |
| App submission + automated checks (ws13 manifest) | `routes/app-store.ts:~2575-2675` |
| Theme upload + review-record creation; purchase (free/Razorpay) | `routes/themes.ts:489-557, 647-703+` |
| Merchant self-delete sets `status='suspended'`+`deleted_at` | `routes/stores.ts:627-647` |
| Storefront excludes suspended sites | `routes/storefront.ts:2010,2031,2077` |

## C. Internal Apps

| Evidence | Location |
|---|---|
| Console auth: allowlist env, magic link, TOTP (±1 window), dev bypass, session secret fallback, audit writes hardcoding `actor_type='super_admin'` | `apps/platform-console/src/lib/console-auth-server.ts:35-198`, `console-session.ts:23-31` |
| Console MFA-gated layout | `apps/platform-console/src/app/(dashboard)/layout.tsx:21` |
| Console pages (users/stores/subscriptions/employees/audit-logs/analytics/settings/operations) wired read-only | `apps/platform-console/src/app/(dashboard)/*/page.tsx` |
| Trust & Safety disabled actions + "backend needed" banner | `apps/platform-console/src/app/(dashboard)/trust-safety/page.tsx`, `TrustSafetyIndexTable.tsx` |
| Ops portal marketplace review UI (wired server action) | `apps/platform-operations-portal/src/app/(dashboard)/operations/page.tsx:1-80` |
| Ops portal login TODO ("Employee login with email allowlist"); invite TODO; role-filter TODO | `apps/platform-operations-portal/src/app/(auth)/login/page.tsx`, `(auth)/invite/page.tsx`, layout.tsx:19 |
| Ops portal client uses merchant session cookie | `apps/platform-operations-portal/src/lib/api/client.ts` (incl. lines 35-41) |
| Stub pages (stores/users search inputs, marketing cards, hardcoded comms templates, zeroed dashboard) | respective `(dashboard)/*/page.tsx` |
| Merchant health / CRM / onboarding computed dashboards, actions disabled | `(dashboard)/merchant-health/page.tsx`, `crm/page.tsx`, `operations/onboarding/page.tsx` |
| Merchant staff management UI | `apps/merchant-control-plane/src/app/[store]/settings/users/page.tsx` |
| Merchant contact inbox (shopper mail) | `apps/merchant-control-plane/src/app/[store]/contact/page.tsx` |
| Signup/store-creation flow | `apps/marketing-site/src/app/create/page.tsx`; `apps/identity-platform/src/app/api/auth/signup/route.ts`, `create-store/route.ts` |
| Operator app = Flutter counter demo | `apps/mobile/operator-app/lib/main.dart` (lines 14-33) |
| Developer surfaces | `apps/app-marketplace/src/app/(auth)/developers/dashboard/page.tsx`, `developers/apps/new/page.tsx`; `apps/developer-portal/` |

## D. Packages, Services, Governance, Tooling

| Evidence | Location |
|---|---|
| ActorType union + Permission interface | `packages/auth-core/src/index.ts:43,59-63` |
| Scope normalization on app install | `packages/app-engine/src/index.ts` (`normalizeAppInstallScopes` used in app-store.ts) |
| Reserved services (manifest-only) | `services/{analytics-pipeline,checkout-runtime,event-bus,media-service,notification-service,search-service}/` |
| Real services | `services/api-gateway/src/index.ts`; `services/webhook-service/src/index.ts`; `services/queue-workers/src/platform-queue-consumer.ts` |
| Actor governance (operator/employee surfaces, MFA/allowlist direction) | `docs/governance/actor-governance.md` |
| Operational evidence governance | `docs/governance/operational-evidence-governance.md` |
| Governance corpus (~115 files) / validators (131) | `docs/governance/`; `scripts/validators/` |
| Ops CLI (deploy/rollback/chaos/load/certify/secrets) | `infrastructure/scripts/` |
| Engineering constitution (canonical runtimes, actor segmentation, single-gateway rule) | `AGENTS.md` (generated 2026-05-25) |
| Runbooks present vs missing | `docs/runbooks/survivability-suite.md`, `staging-development-lifecycle.md`; none for escalation/suspension-appeal/payout-dispute/DSR |

## E. Negative Findings (verified absences, repo-wide searches)
- No `support_tickets`/`tickets`/`conversations`/chat tables or vendor integrations (zendesk/intercom/freshdesk): 0 hits outside docs.
- No `impersonate`/`assume_role`/`act_as` implementation.
- No fraud/risk/chargeback/dispute/KYC tables or routes (only `gift_card_ledger_entries.fraud_hold_reason`; seeded `disputes.manage` permission string).
- No reads of `employee_permissions`/`employee_roles.permissions` anywhere in `services/` or `apps/`.
- No mutation route for `operational_feature_flags`.
- No trial-expiry/dunning job transitioning `sites.status` to `frozen`.
- No theme delist/unpublish endpoint post-approval; no `theme_purchases`→payout-ledger linkage.
- No DSR (export/delete) pipeline; `retention_policies` table unreferenced by jobs.

## F. Method Note
Findings compiled from: full table census of all migrations; route-level reads of admin/employee/operations/internal-console/app-store/themes/stores/storefront routers; page-level reads of both internal apps; six parallel deep-scan passes (internal apps; identity/permissions; app marketplace; theme marketplace; merchant lifecycle; services/ops sweep); targeted verification of every load-bearing claim (501 ticket endpoint, review-UI server action, suspension endpoint, status enums, RBAC middleware). Where agent passes disagreed (e.g., existence of a reviewer UI), the claim was re-verified directly against source; the verified version is what appears in these reports.
