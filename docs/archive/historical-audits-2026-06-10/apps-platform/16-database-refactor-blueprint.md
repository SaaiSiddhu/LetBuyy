# Database Refactoring Blueprint (Phase 15 · Deliverable 23: New Tables)

Baseline: 233 tables, 352 RLS policies (39 permissive), 365 indexes, 389 FKs; migrations `000_baseline.sql` + `073–078`. Naming: adopt timestamped migrations (`YYYYMMDDHHMMSS_*`) from next migration onward (sequential 073–078 grandfathered).

---

## 1. Hardening Existing Tables (migration set A)

| Table | Change | Fixes |
|---|---|---|
| `app_installations` (8350) | `store_id` NOT NULL + FK→sites(id); add `app_version_id` FK (nullable until P6), `status` enum constraint, `uninstalled_at`, `purge_after`; composite idx `(store_id,status)`; **replace** `service_role_app_installations USING(true)` with store-owner policy (checkout_sessions pattern) + narrow service-role | C1, H3, M13 |
| `marketplace_apps` (9693) | FK→`partner_orgs` (after backfill; interim FK→app_developers), status enum constraint, `current_version_id` | H3 |
| `webhook_subscriptions` (13049) | `signing_secret`→`signing_secret_hash` (show-once issuance), add `app_installation_id` FK NULL (links per-store subscriptions to installs; expansion already exists via `planAppWebhookSubscriptions`), `(site_id,status)` idx, per-site count cap via trigger or app-layer | C4, H2, M13 |
| `app_webhooks` (8391) | Keep as app-level **definitions** table: drop `secret` column (subscriptions own secrets), add FK→marketplace_apps, document definitions→subscriptions expansion contract | H2 |
| `marketplace_review_records` (9736) | backfill diff→`app_reviews` → drop | H2 |
| `app_reviews` (8368) | add `installation_id` FK (verified-install reviews), `developer_response` | doc 14 §2 |
| `app_billing_charges` (8245) | FK→app_installations, `subscription_id` FK NULL, idempotency unique idx | integrity |
| `app_extensions` (8333) + 076 registry | FK→`theme_app_extensions(id)`; status enum `enabled|disabled|revoked` | doc 11 §2 |
| `sessions/users_custom/devices/verification_tokens/customer_credentials` | rewrite permissive policies per-table owner scoping | C1 |
| All app-platform tables | `created_by/updated_by` audit columns + audit_logs triggers on app_installations & webhook_subscriptions; flag-audit tables append-only (revoke UPDATE/DELETE) | M6 |

## 2. New Tables (Deliverable 23 — DDL sketches)

```sql
-- identity & authz (doc 10 §3)
oauth_clients            (id uuid pk, app_id fk marketplace_apps, client_id text uniq, client_secret_hash text,
                          secondary_secret_hash text, redirect_uris text[], scopes text[], client_type text, created_at, rotated_at)
oauth_grants             (id pk, installation_id fk, scopes_granted text[], granted_by fk users, consent_artifact jsonb, created_at)
oauth_tokens             (id pk, installation_id fk, kind text check in (offline,online,embed), token_hash text uniq,
                          scopes text[], expires_at, last_used_at, rotated_from fk, revoked_at, created_ip inet)
api_keys                 (id pk, org_id fk, app_id fk null, key_hash uniq, scopes text[], label, last_used_at, revoked_at)

-- partner platform (doc 15)
partner_orgs             (id pk, name, slug uniq, country, payout_profile jsonb, tier, status)
partner_org_members      (org_id fk, user_id fk, role, status, invited_by, pk(org_id,user_id))
collaborator_access      (id pk, org_id fk, store_id fk, scopes text[], status)

-- versioning & extensions (docs 11/14)
app_versions             (id pk, app_id fk, semver, changelog, manifest jsonb, status, submitted_at, reviewed_by, published_at,
                          uniq(app_id,semver))
app_listing_revisions    (id pk, app_id fk, content jsonb, media jsonb, status, created_at)
app_review_artifacts     (id pk, app_version_id fk, reviewer fk, checklist jsonb, decision, notes, created_at)
theme_app_extensions     (id pk, app_version_id fk, manifest jsonb, validation_report jsonb, status)
theme_app_extension_files(id pk, extension_id fk, path, kind, sha256, r2_key, bytes)
app_block_placements     (id pk, store_id fk NOT NULL, installation_id fk, extension_handle, block_handle,
                          template_key, section_id, position int, settings jsonb, status, uniq(store_id,template_key,section_id,position))
app_embed_states         (id pk, store_id fk NOT NULL, installation_id fk, embed_handle, enabled bool, settings jsonb,
                          uniq(store_id,installation_id,embed_handle))

-- billing (doc 14 §4)
app_pricing_plans        (id pk, app_id fk, kind check in (free,one_time,recurring,usage), price_minor, currency,
                          interval, trial_days, usage_meter, capped_amount_minor, status)
app_subscriptions        (id pk, installation_id fk, plan_id fk, status check in (trialing,active,past_due,cancelled,frozen),
                          trial_ends_at, current_period_end, cancelled_at)
app_usage_records        (id pk, subscription_id fk, meter, quantity numeric, amount_minor, idempotency_key uniq, recorded_at)
payout_batches           (id pk, org_id fk, period_start, period_end, gross_minor, fee_minor, net_minor, status, released_at)

-- ops
app_install_events       (id pk, app_id fk, store_id fk, kind check in (install,uninstall,update,suspend), source, survey jsonb, created_at)
idempotency_keys         (key pk, scope, response_hash, created_at)   -- install/charge dedupe (H9)
```
RLS posture for new tables: store-scoped rows → store-owner pattern; org-scoped rows → org-membership pattern; token tables → **no anon/auth access at all**, RPC-only via gateway service functions.

## 3. Consolidations & Drops
- Drops after dual-write: `app_webhooks`, `marketplace_review_records` (§1).
- Orphan candidates (~15–20 ops/telemetry tables, doc 08 Batch 3): 30-day usage monitor → single drop migration; **verify `deployment_*` against `infrastructure/scripts/*certif*` writers first**.
- `app_developers` → compatibility view over `partner_orgs` during P6–P10, drop at P11.

## 4. Tenant-Isolation Standard (applies to every new/changed table)
1. Tenant column NOT NULL + FK (store_id→sites, org_id→partner_orgs).
2. RLS: owner-scoped USING/WITH CHECK; no `USING(true)` outside append-only system tables; service-role narrowed to named RPCs.
3. Dual-axis app rows: `(store_id, installation_id)` both present; app-token API layer additionally filters by token's installation (defense beyond RLS).
4. Composite indexes on `(tenant, status)` hot paths; FK columns indexed (existing discipline is good — keep).
5. Migration tests: `tests/migrations/migration-safety` extended with fresh-replay job in CI (provisions empty DB, applies all migrations — closes the "fresh provisioning" historical wound and proves the chain forever).

## 5. Migration Sequencing
A-set (hardening, no new features) → B-set (new identity/partner tables) → C-set (versioning/extensions) → D-set (billing) → E-set (drops). Each set: forward-only, with explicit `-- rollback:` companion scripts in `database/supabase/rollbacks/`; never edit applied migrations; verification SQL added to `database/supabase/verification/` per existing convention (65 files there today).
