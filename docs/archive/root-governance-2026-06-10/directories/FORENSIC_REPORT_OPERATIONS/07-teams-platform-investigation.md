# 7. Teams Platform Investigation

How LetBuyy's own workforce is modeled, managed, and coordinated.

## Employee Accounts — PARTIAL (and split-brained)

One table serves two populations (`000_baseline.sql:9161-9183`):

```sql
CREATE TABLE public.employees (
    ... email, full_name, role text NOT NULL, permissions jsonb,
    role_id uuid, department text, store_id uuid,        -- ← discriminator
    status text DEFAULT 'invited',                        -- invited|active|disabled|removed
    CHECK (role IN ('support','sales','marketing','operations','manager',
                    'admin','editor','viewer','fulfillment','staff')) ...
```

- `store_id = NULL` → LetBuyy platform employee; `store_id` set → merchant store staff. Same role enum mixes platform roles (support/operations) and store roles (editor/fulfillment).
- Platform employees managed by super-admins: `POST /admin/employees/invite`, `PATCH /admin/employees/:id/deactivate`, `DELETE /admin/employees/:id` (`services/api-gateway/src/routes/admin.ts:255-318`).
- Merchant staff managed by store owners: `/employees/invite` (`employee.ts:255-290`) + `merchant-control-plane /settings/users` UI (roles manager/editor/viewer/fulfillment).
- **Broken link in both flows:** invite email sending is `// TODO: Send invite email via Resend` — invitees never receive the token unless it's handed over out-of-band. Accept flow exists (`POST /employees/auth/accept-invite` creates auth user + employee row), login flow exists (`POST /employees/auth/login`, requires `status='active'`).

## Departments — SCHEMA ONLY
`employees.department` text column exists; zero APIs, zero UI, zero seed data, never queried.

## Teams — MISSING
No team tables, no team membership, no team-scoped queues or routing anywhere in schema or code.

## Roles — PARTIAL
- `employee_roles` (name, display_name, permissions jsonb) and `employee_permissions` (role → permission strings) exist and are seeded (`001_seed.sql`): support (4 perms), marketing (4, incl. `campaigns.manage`, `banners.manage`), operations (3: `disputes.manage`, `health.view`, `sellers.verify`).
- **Enforcement: none.** Repo-wide, nothing reads `employee_permissions` or `employee_roles.permissions` to authorize a request. Actual authorization is binary: super-admin (allowlist) or not (see report 9).

## Permissions — DEFINED, NOT ENFORCED (report 9 details)

## Approvals — MISSING (for internal work)
Only approval workflow in the platform is the one-step marketplace review decision. No approval chains for: employee onboarding, store suspension, refunds over threshold, payout release, feature-flag changes (the `operational_feature_flags` table even has a `status='approved'` state with no approver mechanism).

## Internal Communication — MISSING
No internal messaging, no announcements, no comment threads on any operational entity (merchants, reviews, incidents). No Slack/Teams integration. Ops portal `/operations/communications` page shows 4 hardcoded email templates with no send backend.

## Task Management — MISSING
No tasks/assignments tables. CRM "assign follow-up", onboarding "assign operator", support "assign ticket" — all rendered as disabled buttons.

## Activity Tracking — PARTIAL
- `employees.last_login_at`, `login_count` columns exist; console `/employees` shows roster with last login.
- `audit_logs.actor_type` includes `'employee'`, so the schema anticipates employee action logging — but since no employee-permission-gated mutations exist, virtually all logged actions are `super_admin` (and console auth hardcodes `actor_type: 'super_admin'` — `apps/platform-console/src/lib/console-auth-server.ts:180`).
- No per-employee activity dashboards, no reviewer QA trail.

## Audit Logs — EXISTS (best piece of the teams story)
`audit_logs` (actor_id/type/email, action, resource_type/id, old/new values, metadata, IP, UA) + `audit_activity_events` + `execution_audit_trail`. Console `/audit-logs` viewer with actor/action/date filters and pagination. Gaps: no reason/justification field on sensitive actions; retention policy not wired; no export.

## Governance Doc vs. Reality
`docs/governance/actor-governance.md` mandates platform operators/employees use console + ops portal with "allowlist/RBAC/MFA direction, audit events." Reality: console honors it (allowlist + MFA); **ops portal honors none of it** — its login page is an unwired form with `// TODO: Employee login with email allowlist`, and the API client authenticates with the *merchant* session cookie (`apps/platform-operations-portal/src/lib/api/client.ts`). Any merchant session can browse employee surfaces (data exposure is bounded only by what backend endpoints reject).

## Conclusion
LetBuyy has an employee *records* system, not a teams *platform*. People can technically exist (rows), be invited (minus the email), and log in (employee auth routes) — but they cannot be organized (no teams/departments), constrained (no enforced permissions), coordinated (no tasks/comms), or supervised (no meaningful activity tracking). Headcount growth beyond founders has no system to land in.
