# 8. Internal Admin Investigation

Does a super-admin platform exist? **Yes — read-mostly, two heads, one real lock.**

## The Two Internal Apps

| | `apps/platform-console` | `apps/platform-operations-portal` |
|---|---|---|
| Audience | Super-admins (founder/ops) | Platform employees (support/success/ops) |
| Auth | Magic link + email allowlist (`PLATFORM_CONSOLE_ALLOWED_EMAILS`) + **TOTP MFA enforced** (`requireConsoleSession({ mfa: true })`) | **None effective** — merchant session cookie; login page is an unwired TODO |
| Pages wired | ~10/13 (users, stores, subscriptions, employees, audit-logs, analytics, settings, operations, login, mfa) | ~6/12 (support shell, merchant-health, crm, onboarding, marketplace reviews, communications partial) |
| Write actions in UI | 0 (all read-only/disabled) | 1 (marketplace review decisions) |
| Backend | `/internal/console/*` + `/operations/runtime/overview` via `PLATFORM_CONSOLE_API_TOKEN` | `@letbuyy/api-client` → api-gateway |

## Search Capability Audit

| Search | Verdict | Evidence |
|---|---|---|
| Global search | MISSING | No unified search in either app |
| Merchant/store search | PARTIAL | Console `/stores` has q-param search + status filter + pagination (`GET /internal/console/stores`); ops-portal `/stores` is a dead input with TODO |
| Order search | MISSING | No platform-side order lookup at all |
| Customer (shopper) search | MISSING | Console `/users` lists/searches *account* users; no shopper-by-order/email tooling |
| User search | PARTIAL | Console `/users` wired (email/name/provider/verification) |
| App search | MISSING | No internal app catalog browser (marketplace itself is merchant-facing) |
| Theme search | MISSING | Same |
| Employee search | PARTIAL | Console `/employees` roster with search/status filter |

## Admin Actions Audit

| Action | API | UI | Audit |
|---|---|---|---|
| Suspend/freeze/publish store | EXISTS — `PATCH /admin/stores/:id/status` (`admin.ts:104`) | MISSING (T&S buttons disabled) | YES — `audit_logs` `store_status_*` |
| Hard-delete store | EXISTS — `DELETE /admin/stores/:id` | MISSING | partial |
| Invite/deactivate/delete employee | EXISTS (`admin.ts:255-318`) | MISSING (roster read-only) | partial |
| Marketplace review decision | EXISTS | EXISTS (ops portal) | YES (reviewed_by/at/notes) |
| Refund on behalf of merchant | MISSING | MISSING | — |
| Impersonate merchant | MISSING (no impersonate/assume/act-as code repo-wide) | MISSING | — |
| Toggle feature flag | MISSING (table `operational_feature_flags` has no mutation route) | MISSING | flag audit tables exist, unused |
| Reset user MFA / revoke sessions | MISSING | MISSING | — |

## Platform & Emergency Controls

Backend-only (super-admin token via raw API; none surfaced in UI):
- Incidents: create/update (`POST /operations/runtime/incidents`, `PATCH .../:incidentId/status`)
- Queue recovery: `recover-leases`, `redrive-dead-letters` per queue
- Replays: create + two-step **authorize** (`POST /runtime/replays/:replayId/authorize` — the only two-step control in the platform)
- Control commands: `POST /runtime/control-commands` (runtime command journal tables back this)
- Deployments/readiness/health gates, failover drills, chaos experiments, load tests, event-store integrity/archive, SRE error budgets
- CLI: `infrastructure/scripts/production-rollback.mjs`, `production-deploy.mjs`, secret rotation; 131 validators in `scripts/validators/`

Storefront kill behavior exists structurally: suspended sites are filtered from all public storefront queries (`storefront.ts:2010+`). There is no merchant-wide or platform-wide emergency switch (e.g., pause checkout globally, freeze payouts).

## Security Posture of the Admin Plane

Strong: console MFA implementation (TOTP with ±1 window, HOTP), allowlist normalization, session secret separation, console auth events written to `audit_logs`. `super_admin_allowlist` table supports per-admin 2FA + `allowed_ips` (IP allowlist enforcement not found in middleware).

Weak:
1. **Ops portal trusts merchant sessions** — flagship finding; violates `actor-governance.md`.
2. Dev MFA bypass env (`PLATFORM_CONSOLE_DEV_MFA_CODE`) and dev fallback session secret (`'dev-only-console-session-secret'`).
3. Console audit hardcodes `actor_type='super_admin'`; no per-action reason capture.
4. No rate limiting on console login; no admin session revocation.
5. Allowlist lives in an env var, not the `super_admin_allowlist` table the RBAC middleware checks — two sources of admin truth (`console-auth-server.ts` vs `middleware/rbac.ts:30-53`).

## Conclusion
A genuine super-admin nucleus exists — properly authenticated console, audited store-status mutations, and an unusually deep runtime-operations API. But it is an **observation deck, not a control room**: 1 of ~20 expected admin actions is operable from UI, search is fragmentary, impersonation is absent, and the employee-facing portal undermines the whole access model by skipping authentication.
