# Production and staging Worker release — 25 October 2026

The owner requested current Worker code in both environments. **Source upload is complete for the seven existing Workers; activation and hosted end-to-end acceptance remain blocked.** The Worker candidates were built from main/develop/staging `a175c729caef8a3c71307ee4b51b29a70131e9b9`. The initial upload subphase changed no application or Worker source and applied no hosted SQL. A later identity UI repair is recorded below.

## Observed state

The account contains four production Workers and three staging Workers. Staging Mobile BFF is absent. All four packages pass typecheck. Gateway unit tests pass 1,789/1,789; queue tests 76/76; BFF 17/17; webhook 16/16. All eight governed production/staging build dry-runs pass. These checks do not establish database compatibility or hosted end-to-end correctness.

The staging API upload first failed Cloudflare startup validation (10021). Its local startup profile showed substantial collection/initialization cost. Standard Wrangler minification reduced the upload from 7,783 to 4,466 KiB and passed provider startup validation (747 ms staging; 835 ms production). The successful minified candidates use the same pinned runtime source; the earlier unminified production candidate was accepted at 976 ms and is superseded for this release.

| Worker | Uploaded candidate | Traffic |
|---|---|---|
| letbuyy-api | 7f79fc35-ab18-4ea4-a8c3-f3c9f416f4f9 | inactive |
| letbuyy-queue-workers | 52a30d4a-35f7-41a6-8b1b-25369c5d2053 | inactive |
| letbuyy-mobile-bff | 48ef1a70-8eb3-449f-b429-698453dfb4ec | inactive |
| letbuyy-webhook | 8ad690f7-25d2-441e-aa2f-91cc3e1635a0 | inactive |
| letbuyy-api-staging | 14914715-0c80-4cb8-915e-7d6f1e22006a | inactive |
| letbuyy-queue-workers-staging | 5ae5ae64-adbe-4f43-bb01-c358ef74bf0c | inactive |
| letbuyy-webhook-staging | 36d43851-f86e-496b-b95f-2286f458624b | inactive |

Uploads preserve saved variables and encrypted secrets. They do not activate routes, change traffic or update scheduled/queue triggers. Provider versions, deployment allocation and module hashes are independently checked in private evidence under `.tmp/local-dev/production-auth-rotation-20261025/worker-release/`. Public previews remain disabled. No secrets, real records, recovery material or bearer links are included in this document.

## Database prerequisite and recovery

Both Supabase projects have only five recorded migrations (176, 177, 178, 183, 186 under historical timestamp versions). Both lack `letbuyy_maintenance.lock_catalogs_v1()`, `consume_internal_auth_replay_jti` and `auth_password_set_intents`. Production's managed `postgres` role is not a superuser. Migration history alone is insufficient to decide which earlier schema changes are present.

A new production backup covers application schema, auth/storage schema, data and roles. The archive is encrypted with a separate private local recovery key; decryption was hash-verified. The complete schema and data restored successfully into an owned, isolated PostgreSQL 17.6 database. The pending repository migration rehearsal applied 275 migrations successfully, then correctly refused migration353 with `LETBUYY_PROVIDER_ADMIN_CATALOG_FENCE_REQUIRED`. No production or staging schema was changed. The rehearsal container was stopped without touching the developer's local stack.

The repository already has the provider request and exact install/retirement package: `database/supabase/deploy/provider-admin-catalog-fence.sql`, its rollback and the 22 October Supabase compatibility evidence. That request covers both projects. The owner reports no installation confirmation. The live absence was independently verified. Do not impersonate `supabase_admin`, weaken the native lock guards or activate incompatible API code.

Earlier migration078 also creates a password-intent policy without `TO service_role`. It must be restricted before introducing that table to hosted environments (SEC-R6). A possible migration396 was considered at claim time but **no new migration or security implementation was written** during this blocked operational release.

The managed worktree's repository-wide baseline has six failing checks (typecheck, lint, contracts, gateway test lane, governance tests and stale-artifact sweep). This is a pre-implementation baseline on a branch containing only the documentation claim. It is not a green release gate; the focused Worker checks above ran successfully in the primary checkout. Full logs remain private. No failures are suppressed or reclassified as passing.

## Required continuation

Verify Supabase's supported installation on staging first, then production, using the exact owner/body/ACL profile. Complete the hosted migration/history reconciliation, close the password-intent policy issue, preserve original records and verify positive/negative identity, replay and tenant behavior. Provision the missing staging BFF and staging queue secret, verify all environment-specific secrets and bindings, then activate through the governed deployment path. Reconcile the old storefront Vercel internal-secret consumer separately. Full hosted login, signup, merchant, buyer and asynchronous acceptance remains unverified and production login is still reported failing.

## Follow-up: login email never arrives

The owner clarified that the email is missing, rather than a received link failing to open. Two reproduced UI defects concealed this: lookup navigated to check-email without inspecting the send response, and resend sent a literal placeholder instead of a Turnstile proof and ignored errors. A third reproduced race cleared the parent busy state before its automatic send finished.

The two identity pages now require an acknowledged successful send before advancing/resetting cooldown, show bounded localized failure messages through the canonical Banner, use the existing real Turnstile widget with token reset, and wait for automatic sends. Password-reset resends use the existing send-reset route. Unknown-account success behavior remains unchanged for privacy. No email provider credential, server authentication guard, database or Worker source changed.

Tests execute the actual page handlers with synthetic browser/network ports: 14 of the first 15 failed before repair, then all15 passed; the additional busy-state regression failed before its fix and all16 now pass. Existing identity unit51 and contracts6 pass. App typecheck and production build pass; changed-page ESLint has zero errors and one pre-existing hook warning. The worktree gate at dd6e980cf passes typecheck/lint/contracts/gateway unit/CI and113 validators; its stale-artifact sweep is attributable to normal generated directories, and its one governance failure is the owned-client guard refusing a preserved merchant .env.local. The exact lifecycle case passed1/1 in a clean source clone, and the actual artifact-cleaning governance lane at b5976767a passes114/114 (one validator not applicable). Branch ancestry was separately verified in the real repository because the temporary clone lacks local develop refs. Auth/security tests outside the database fixture passed56; the separately executed owned PostgreSQL security suite passed23/23. The direct security invocation's23 cancelled cases are preserved as a failed attempt, not counted as a pass.

A local production-build browser check with synthetic recipient confirmed a rejected resend displays an error and leaves the ready retry control available. This is UI recovery proof, not email delivery. Provider/runtime logs older than the Hobby retention window are unavailable; the current production alias and its previously configured environment were verified unchanged before this repair. Fresh hosted send and inbox acceptance remain required after the accounts-only Vercel update.
