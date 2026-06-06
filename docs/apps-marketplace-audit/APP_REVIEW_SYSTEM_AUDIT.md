# App Review System Audit (Phase 10)

How are apps reviewed, and how are malicious apps, dangerous permissions, and unsafe updates prevented? Benchmarked against Shopify. Parent: [Master Audit](../LETBUYY_APPS_MARKETPLACE_MASTER_AUDIT.md).

## How review actually works today

1. **Submit** (`POST /app-store/developers/apps`, `developer-routes.ts`): requires a developer profile; validates submission + optional manifest; mints OAuth client credentials; inserts `marketplace_apps` (status `draft` or `in_review`); creates a `marketplace_review_records` row with `automated_checks`.
2. **Automated checks** attached at submit are effectively **rubber stamps**: `schema_validation` = passed, `developer_profile` = passed, `extension_lifecycle_contract` = passed, `built_for_letbuyy_quality_gate` = passed/warning depending only on whether a `quality_gate` object was supplied. **No static analysis, dependency/malware scan, URL/TLS verification, scope-justification check, or runtime sandbox test runs.**
3. **Human decision** happens **outside the marketplace**, in the platform-operations portal: `POST /operations/marketplace-reviews/:id/decision` maps `approved → marketplace_apps.status = published` (+ `app.approved` event), `rejected → rejected`, `changes_requested → stays`. (`operations.ts`)
4. **Publish** flips status; the catalog only lists `status = published` apps.

## What's good

- A real **review record model** exists (`marketplace_review_records`: status `pending/in_review/approved/rejected/changes_requested`, `reviewed_by`, `reviewed_at`, `review_notes`, automated_checks blob) — the right schema to build on.
- **Verified-install-only reviews** (separate from app review) prevent fake ratings.
- Submission **mints OAuth credentials** and can persist a validated **manifest** + extensions/functions, so the review packet has real structure.
- Decisions **emit domain events** (`app.approved`/`app.rejected`) for downstream notification/automation.

## What's missing or weak

| Area | Gap | Risk |
|---|---|---|
| Security scanning | No static/dynamic analysis, no malware/dependency scan | Malicious or vulnerable apps can pass |
| Permission review | Scopes accepted as declared; no justification or least-privilege check | Over-scoped apps |
| URL/asset checks | `app_url`/`privacy_url` not verified (reachability, TLS, ownership) | Dead/spoofed endpoints |
| Update re-review | **No update flow exists**, so no re-review on new versions/scope changes | Post-approval scope creep impossible to govern (because updates are impossible at all) |
| Published rubric | No review requirements/policy/timelines published in-product | Opaque to developers |
| Reviewer tooling | Decision endpoint exists; auth/RBAC on `/operations/marketplace-reviews*` should be confirmed | Unauthorized approvals if unguarded |
| Automated gates as evidence | Checks are recorded as "passed" without performing the check | False assurance in the audit trail |
| Suspension/appeal | `suspended`/`rejected` statuses exist; no in-product appeal/again-review UX | Dead-end for developers |
| Anti-abuse | No rate limits/anti-spam on submission noted | Submission flooding |

## Compared to Shopify

Shopify gates on: GraphQL-only for new apps (Apr 2025), **mandatory GDPR webhooks verified before review**, performance budgets, design standards, documented requirements, automated + human review, and **annual re-review** of Built-for-Shopify apps. LetBuyy has the *records and events* but not the *gates*: its automated checks assert success without testing, and its strongest equivalent control (compliance webhooks) lives in the backend but isn't verified at submission.

## Recommendations (in order)
1. Make automated checks **actually run**: manifest lint, scope-justification, `app_url`/`privacy_url` reachability + TLS, basic static scan, and **verify the GDPR webhooks respond** before allowing `in_review`.
2. Build the **app update/version** flow and require **re-review when scopes or extension surfaces change**.
3. Publish a **review rubric + SLA** in the developer portal.
4. Confirm and harden **RBAC** on the operations review-decision endpoints.
5. Record automated-check results **truthfully** (pass only when the check executed and passed) to keep the audit trail meaningful.
6. Add **suspension/appeal** UX and **annual re-review** for any earned "Built for LetBuyy" badge.
