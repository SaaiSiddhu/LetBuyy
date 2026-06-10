# 4. App Marketplace Operations Report

## Lifecycle State Machines (database-enforced)

| Entity | States | Source |
|---|---|---|
| `marketplace_apps.status` | `draft → in_review → published \| rejected \| suspended` | `000_baseline.sql` CHECK |
| `app_developers.status` | `pending \| approved \| suspended \| rejected` (+ `verified` bool) | CHECK |
| `marketplace_review_records.status` | `pending \| in_review \| approved \| rejected \| changes_requested` | CHECK |
| `app_installations.status` | `active \| paused \| uninstalled` | CHECK |
| `app_billing_charges.status` | `pending_merchant_approval \| approved \| active \| cancelled \| failed` | CHECK |
| `app_extension_registrations.status` | `enabled \| disabled \| revoked` | CHECK + `076_app_extension_registry.sql` |
| `partner_payout_ledger_entries.status` | `pending \| processing \| released \| failed \| cancelled` | CHECK |

## Operational Workflow Verdicts

### App Submission — EXISTS
`POST /app-store/developers/apps` (`services/api-gateway/src/routes/app-store.ts` ~line 2575): creates `marketplace_apps`, auto-creates a `marketplace_review_records` row for non-draft submissions, runs 4 automated checks (`schema_validation`, `developer_profile`, `built_for_letbuyy_quality_gate`, `extension_lifecycle_contract` — manifest schema version `2026-06-05.ws13`), emits `app.submitted` domain event. Developer-facing submission UI exists (`apps/app-marketplace /developers/apps/new`, `apps/developer-portal`).

### App Review — PARTIAL
- Queue API: `GET /operations/marketplace-reviews` (status/type filters, limit 200) — `operations.ts:300`.
- Decision API: `POST /operations/marketplace-reviews/:id/decision` (`approved|rejected|changes_requested` + ≤2000-char reason; sets `reviewed_by/reviewed_at/review_notes`; cascades app status; emits `app.approved`/`app.rejected`) — `operations.ts:320-378`.
- Queue UI: **EXISTS** at `apps/platform-operations-portal/src/app/(dashboard)/operations/page.tsx` — pending list, automated-check badges, reason textarea, three wired decision buttons (server action `submitMarketplaceReviewDecision`).
- **Missing:** review detail page, version/metadata diff, scope-change review, code/static analysis, reviewer assignment, SLA clock, batch ops, rejection-reason taxonomy, internal notes thread.

### App Approval / Rejection — EXISTS (one-step)
Single reviewer decision; no two-person rule, no approval chain. Gated `requireRoleCategory('ops')` + `requireSuperAdmin` — only super-admins can review.

### App Suspension — PARTIAL
`marketplace_apps.status='suspended'` reachable via data layer; extension registrations revocable (`status='revoked'` with timestamps); installation pause/uninstall states exist. **No UI and no dedicated suspension endpoint with reason/audit; no merchant notification pipeline on suspension.**

### App Moderation — MISSING
No post-publish monitoring: no abuse reports against apps, no error/crash telemetry per app, no automated re-review on update, no policy strike system.

### Developer Communication — MISSING
One-way, one-shot `review_notes` text. No thread, no templates, no notification on decision verified beyond domain event, no appeal/resubmission dialogue. Invite/notify emails elsewhere in the employee flow are TODOs.

### App Analytics — PARTIAL
Developer dashboard (`apps/app-marketplace /developers/dashboard`): active installs, uninstalls, gross/partner earnings, payout pending/released, GST. Platform-side: install counts + ratings triggers only. **No usage, error-rate, latency, or merchant-complaint analytics for staff.**

### App Billing — EXISTS (rails), PARTIAL (ops)
Charges with merchant-approval step; revenue share default 8000 bps (80% partner) with 18% GST on partner share; payout rails `razorpay_route | razorpayx | upi | manual`; ledger entries link charge→payout. **No payout release workflow/UI; nothing feeds `processing → released` transitions; no reconciliation reports.**

## Can an App Reviewer do the job today?

**Barely.** With a super-admin session they can list pending submissions and approve/reject with a reason in the ops portal. They review blind: name/description/automated-check badges only — no code, no scopes diff, no app preview, no developer history, no SLA, no second pair of eyes, no way to retract a bad approval from the UI.

## Top Gaps (priority order)
1. Review detail view (metadata, scopes, extensions, developer history) + version diff
2. Static/security analysis in automated checks (currently contract-shape checks only)
3. Reviewer roles below super-admin (employee permissions exist but unenforced)
4. Decision→developer notification + appeal/resubmission flow
5. Post-publish kill-switch UI + per-app health telemetry
6. Payout release + reconciliation operations
