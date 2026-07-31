# AF_04 — Migration Chain & DB-State Audit

**Workstream:** AF-D (Migration Chain & DB-State)
**Phase:** AF.0 read-only discovery
**Status:** EVIDENCE_COMPLETE — sequential-migration validator EXIT 1 (untracked 186/187); migration-safety validator PASS; no-public-using-true validator PASS; rollback-integrity validator PASS (infrastructure, not migration rollbacks)
**Evidence timestamp:** 2026-07-17 (Asia/Kolkata)
**Methodology:** Read-only — git ls-files, git status --porcelain, git diff HEAD, git log, direct file reads, three validators (sequential-migration, migration-safety, no-public-using-true). No DB connection. No migration apply. No file mutation. Git status count before validators: 378; after all validators: 378 (confirmed no mutation).

---

## 0. Executive Summary

| Finding | Status | Severity |
|---------|--------|----------|
| 120 migration files on disk, 118 tracked, 2 UNTRACKED (186/187) | FOREIGN_WIP | HIGH — blocks CI |
| Sequential-migration validator: EXIT 1 (186/187 untracked) | BROKEN | HIGH |
| No sequence gaps after 073, no duplicate numbers | VERIFIED_CURRENT | INFO |
| 4 tracked migrations modified in working tree (100, 109, 111, 142) | FOREIGN_WIP | MEDIUM |
| config.toml modified in working tree (analytics disabled) | FOREIGN_WIP | LOW |
| Migration 191 (theme_purchases RLS): user_id = auth.uid() correct defensive posture but UUID namespace mismatch confirmed | STRUCTURAL_ONLY | MEDIUM |
| R-23 paired-rollback gap: 17 migrations ≥138 lack rollback files | BROKEN | HIGH |
| Rollbacks 176–178 exist on disk but are UNTRACKED | FOREIGN_WIP | MEDIUM |
| Migration apply state (staging/production): UNKNOWN — no live evidence in repo | NOT_CONNECTED | CRITICAL |
| Migration 100: USING(true) without TO role on 4 frozen app-marketplace tables | SECURITY_REVIEW_REQUIRED | MEDIUM |
| Migration 189 carries explicit ARB gate comment | IMPLEMENTED_NOT_LIVE | MEDIUM |

---

## 1. Full Ordered Migration Inventory

**Inventory basis:** `ls database/supabase/migrations/` (120 files) vs `git ls-files database/supabase/migrations/` (118 files) vs `git status --porcelain database/supabase/migrations/`.

**Known sequence gap:** 001–072 (72 slots) — absent by design (pre-programme baseline; documented in `sequential-migration-validator.mjs` line 7: `const KNOWN_GAP_END = 72`).

**Post-073 sequence:** 073…191 — **no gaps, no duplicates** (verified by sequential-migration-validator and independently by Python count).

### 1.1 Complete inventory table

| # | Name | Git State | Rollback File | Rollback Tracked | Classification |
|---|------|-----------|---------------|-----------------|----------------|
| 000 | baseline | TRACKED | — | — | TRACKED_CURRENT (pre-R-23) |
| 073 | order_item_required_field_compatibility | TRACKED | — | — | TRACKED_CURRENT (pre-R-23) |
| 074 | cod_pending_status | TRACKED | — | — | TRACKED_CURRENT (pre-R-23) |
| 075 | cashfree_payment_provider | TRACKED | — | — | TRACKED_CURRENT (pre-R-23) |
| 076 | app_extension_registry | TRACKED | — | — | TRACKED_CURRENT (pre-R-23) |
| 077 | customer_reset_tokens | TRACKED | — | — | TRACKED_CURRENT (pre-R-23) |
| 078 | password_set_intents | TRACKED | — | — | TRACKED_CURRENT (pre-R-23) |
| 079 | partition_worker_request_logs | TRACKED | — | — | TRACKED_CURRENT (pre-R-23) |
| 080 | partition_runtime_telemetry_metrics | TRACKED | — | — | TRACKED_CURRENT (pre-R-23) |
| 081 | partition_outbox_events | TRACKED | — | — | TRACKED_CURRENT (pre-R-23) |
| 082 | partition_platform_queue_jobs | TRACKED | — | — | TRACKED_CURRENT (pre-R-23) |
| 083 | partition_webhook_deliveries | TRACKED | — | — | TRACKED_CURRENT (pre-R-23) |
| 084 | trigram_search_indexes | TRACKED | — | — | TRACKED_CURRENT (pre-R-23) |
| 085 | orders_items_reconcile | TRACKED | — | — | TRACKED_CURRENT (pre-R-23) |
| 086 | products_variants_reconcile | TRACKED | — | — | TRACKED_CURRENT (pre-R-23) |
| 087 | theme_template_drafts | TRACKED | — | — | TRACKED_CURRENT (pre-R-23) |
| 088 | inventory_available_batch | TRACKED | — | — | TRACKED_CURRENT (pre-R-23) |
| 089 | quarantine_platform_queue_job | TRACKED | — | — | TRACKED_CURRENT (pre-R-23) |
| 090 | custom_domains_and_store_access | TRACKED | — | — | TRACKED_CURRENT (pre-R-23) |
| 091 | theme_marketplace_stepup | TRACKED | — | — | TRACKED_CURRENT (pre-R-23) |
| 092 | app_marketplace_pricing_policy | TRACKED | — | — | TRACKED_CURRENT (pre-R-23) |
| 093 | app_pricing_plans | TRACKED | — | — | TRACKED_CURRENT (pre-R-23) |
| 094 | app_billing_trials | TRACKED | — | — | TRACKED_CURRENT (pre-R-23) |
| 095 | app_usage_metering | TRACKED | — | — | TRACKED_CURRENT (pre-R-23) |
| 096 | app_spend_controls | TRACKED | — | — | TRACKED_CURRENT (pre-R-23) |
| 097 | app_uninstall_feedback | TRACKED | — | — | TRACKED_CURRENT (pre-R-23) |
| 098 | app_versions | TRACKED | — | — | TRACKED_CURRENT (pre-R-23) |
| 099 | app_developer_consent_and_approval | TRACKED | — | — | TRACKED_CURRENT (pre-R-23) |
| 100 | app_discovery_foundation | TRACKED+MODIFIED | — | — | TRACKED_CURRENT — SECURITY_REVIEW_REQUIRED (see §5.1) |
| 101 | app_trust_reviews_content | TRACKED | — | — | TRACKED_CURRENT (pre-R-23) |
| 102 | app_developer_tooling_analytics | TRACKED | — | — | TRACKED_CURRENT (pre-R-23) |
| 103 | app_api_quota_and_legacy_rls | TRACKED | — | — | TRACKED_CURRENT (pre-R-23) |
| 104 | app_marketplace_scale_services | TRACKED | — | — | TRACKED_CURRENT (pre-R-23) |
| 105 | app_marketplace_responsiveness_i18n | TRACKED | — | — | TRACKED_CURRENT (pre-R-23) |
| 106 | app_marketplace_growth_polish | TRACKED | — | — | TRACKED_CURRENT (pre-R-23) |
| 107 | security_rls_hardening_and_payment_uniqueness | TRACKED | — | — | TRACKED_CURRENT — SECURITY_REVIEW_REQUIRED |
| 108 | orders_tenant_key_not_null | TRACKED | — | — | TRACKED_CURRENT (pre-R-23) |
| 109 | orders_money_width | TRACKED+MODIFIED | — | — | TRACKED_CURRENT — IMMUTABILITY_CONCERN (see §4.2) |
| 110 | fk_hygiene_and_order_indexes | TRACKED | — | — | TRACKED_CURRENT (pre-R-23) |
| 111 | customer_credentials_source_of_truth | TRACKED+MODIFIED | — | — | TRACKED_CURRENT — IMMUTABILITY_CONCERN (see §4.3) |
| 112 | app_marketplace_parity_data_layer | TRACKED | — | — | TRACKED_CURRENT (pre-R-23) |
| 113 | internal_os_rbac_spine | TRACKED | — | — | TRACKED_CURRENT (pre-R-23) |
| 114 | mobile_onboarding_attempt_progress | TRACKED | — | — | TRACKED_CURRENT (pre-R-23) |
| 115 | product_review_merchant_replies | TRACKED | — | — | TRACKED_CURRENT (pre-R-23) |
| 116 | mobile_draft_orders | TRACKED | — | — | TRACKED_CURRENT (pre-R-23) |
| 117 | mobile_customer_notes_tags | TRACKED | — | — | TRACKED_CURRENT (pre-R-23) |
| 118 | mobile_shipping_labels | TRACKED | — | — | TRACKED_CURRENT (pre-R-23) |
| 119 | mobile_money_ledgers | TRACKED | — | — | TRACKED_CURRENT (pre-R-23) |
| 120 | mobile_kyc_documents | TRACKED | — | — | TRACKED_CURRENT (pre-R-23) |
| 121 | mobile_merchant_2fa_factors | TRACKED | — | — | TRACKED_CURRENT (pre-R-23) |
| 122 | mobile_business_profile | TRACKED | — | — | TRACKED_CURRENT (pre-R-23) |
| 123 | mobile_tax_rate_parity | TRACKED | — | — | TRACKED_CURRENT (pre-R-23) |
| 124 | internal_os_risk_detection | TRACKED | — | — | TRACKED_CURRENT (pre-R-23) |
| 125 | internal_os_trust_safety_cases | TRACKED | — | — | TRACKED_CURRENT (pre-R-23) |
| 126 | internal_os_merchant_360_impersonation | TRACKED | — | — | TRACKED_CURRENT (pre-R-23) |
| 127 | internal_os_support_ticketing | TRACKED | — | — | TRACKED_CURRENT (pre-R-23) |
| 128 | internal_os_review_check_runs | TRACKED | — | — | TRACKED_CURRENT (pre-R-23) |
| 129 | mobile_customer_segments | TRACKED | — | — | TRACKED_CURRENT (pre-R-23) |
| 130 | orders_site_id_not_null | TRACKED | — | — | TRACKED_CURRENT (pre-R-23) |
| 131 | hot_table_partition_shadow_mirror | TRACKED | — | — | TRACKED_CURRENT (pre-R-23) |
| 132 | mobile_whatsapp_commerce | TRACKED | — | — | TRACKED_CURRENT (pre-R-23) |
| 133 | internal_os_incident_command | TRACKED | — | — | TRACKED_CURRENT (pre-R-23) |
| 134 | internal_os_developer_360_payout_reconciliation | TRACKED | — | — | TRACKED_CURRENT (pre-R-23) |
| 135 | internal_os_compliance_data_subjects | TRACKED | — | — | TRACKED_CURRENT (pre-R-23) |
| 136 | mobile_marketing_email_campaigns | TRACKED | — | — | TRACKED_CURRENT (pre-R-23) |
| 137 | mobile_storefront_localization | TRACKED | — | — | TRACKED_CURRENT (pre-R-23) |
| 138 | mobile_store_metafields | TRACKED | — | — | TRACKED_CURRENT — R-23 ROLLBACK GAP (LEG-059) |
| 139 | executable_foundation_ledger_core | TRACKED | YES | TRACKED | TRACKED_CURRENT — SECURITY_DEFINER |
| 140 | mobile_cod_reconciliation | TRACKED | — | — | TRACKED_CURRENT — R-23 ROLLBACK GAP (LEG-059) |
| 141 | executable_inventory_reservations | TRACKED | YES | TRACKED | TRACKED_CURRENT — SECURITY_DEFINER |
| 142 | executable_payment_sessions | TRACKED+MODIFIED | YES | TRACKED | TRACKED_CURRENT — IMMUTABILITY_CONCERN (see §4.4) |
| 143 | executable_discount_stack | TRACKED | YES | TRACKED | TRACKED_CURRENT |
| 144 | executable_tax_gst_invoices | TRACKED | YES | TRACKED | TRACKED_CURRENT |
| 145 | executable_shipping_serviceability | TRACKED | YES | TRACKED | TRACKED_CURRENT |
| 146 | executable_checkout_state_machine | TRACKED | YES | TRACKED | TRACKED_CURRENT |
| 147 | executable_order_state_risk | TRACKED | YES | TRACKED | TRACKED_CURRENT |
| 148 | executable_notifications_router | TRACKED | YES | TRACKED | TRACKED_CURRENT |
| 149 | executable_email_delivery | TRACKED | YES | TRACKED | TRACKED_CURRENT |
| 150 | executable_whatsapp_scoped | TRACKED | YES | TRACKED | TRACKED_CURRENT |
| 151 | executable_settlement_ledger | TRACKED | YES | TRACKED | TRACKED_CURRENT — SECURITY_DEFINER |
| 152 | executable_billing_autopay | TRACKED | YES | TRACKED | TRACKED_CURRENT |
| 153 | executable_identity_security | TRACKED | YES | TRACKED | TRACKED_CURRENT — AUTH |
| 154 | executable_analytics_media_ai_seam | TRACKED | YES | TRACKED | TRACKED_CURRENT — SECURITY_DEFINER |
| 155 | storefront_session_analytics | TRACKED | YES | TRACKED | TRACKED_CURRENT |
| 156 | executable_cart_channel_handoff | TRACKED | YES | TRACKED | TRACKED_CURRENT |
| 157 | product_metadata | TRACKED | — | — | TRACKED_CURRENT — R-23 ROLLBACK GAP (LEG-059) |
| 158 | order_items_tenant_scope | TRACKED | YES | TRACKED | TRACKED_CURRENT |
| 159 | identity_foundation_core | TRACKED | YES | TRACKED | TRACKED_CURRENT — AUTH/RLS |
| 160 | foundation_money_ledger_authority | TRACKED | YES | TRACKED | TRACKED_CURRENT — SECURITY_DEFINER/MONEY |
| 161 | foundation_session_security | TRACKED | YES | TRACKED | TRACKED_CURRENT — AUTH/SECURITY_DEFINER |
| 162 | phase_a_commission_zero | TRACKED | YES | TRACKED | TRACKED_CURRENT |
| 163 | d2_live_data_leak_rls | TRACKED | YES | TRACKED | TRACKED_CURRENT — RLS/SECURITY |
| 164 | d4_tenant_role_guc | TRACKED | YES | TRACKED | TRACKED_CURRENT — RLS |
| 165 | d5_canonical_money_paths | TRACKED | YES | TRACKED | TRACKED_CURRENT — SECURITY_DEFINER/MONEY |
| 166 | d6_checkout_handoff_inventory | TRACKED | YES | TRACKED | TRACKED_CURRENT — MONEY |
| 167 | app_billing_provider_mode_sandbox | TRACKED | YES | TRACKED | TRACKED_CURRENT |
| 168 | b1_b2_capture_refund_ledgering | TRACKED | YES | TRACKED | TRACKED_CURRENT — MONEY |
| 169 | internal_os_executive_analytics_rollups | TRACKED | YES | TRACKED | TRACKED_CURRENT |
| 170 | v1_shipping_rates_gst | TRACKED | — | — | TRACKED_CURRENT — SECURITY_DEFINER/MONEY — R-23 GAP |
| 171 | liquid_bundle_persistence | TRACKED | YES | TRACKED | TRACKED_CURRENT — THEME |
| 172 | liquid_bundle_refresh | TRACKED | YES | TRACKED | TRACKED_CURRENT — THEME |
| 173 | v1_gift_card_issuance_lifecycle | TRACKED | YES | TRACKED | TRACKED_CURRENT — MONEY/SECURITY_DEFINER |
| 174 | v1_gift_card_refund_restore | TRACKED | YES | TRACKED | TRACKED_CURRENT — MONEY/SECURITY_DEFINER |
| 175 | fix_session_rpc_search_path | TRACKED | — | — | TRACKED_CURRENT — AUTH/SECURITY_DEFINER — R-23 GAP |
| 176 | v1_founding_program_schema | TRACKED | YES | **UNTRACKED** | TRACKED_CURRENT — SECURITY_DEFINER — rollback untracked |
| 177 | v1_founding_program_rpcs | TRACKED | YES | **UNTRACKED** | TRACKED_CURRENT — SECURITY_DEFINER — rollback untracked |
| 178 | v1_pricing_plans_seed | TRACKED | YES | **UNTRACKED** | TRACKED_CURRENT — rollback untracked |
| 179 | outbox_partition_shadow_published_at | TRACKED | — | — | TRACKED_CURRENT — R-23 GAP |
| 180 | urban_kicks_liquid_theme | TRACKED | — | — | TRACKED_CURRENT — THEME — R-23 GAP |
| 181 | urban_kicks_settings_schema_complete | TRACKED | — | — | TRACKED_CURRENT — THEME — R-23 GAP |
| 182 | v1_sites_timezone | TRACKED | — | — | TRACKED_CURRENT — R-23 GAP |
| 183 | v1_pricing_recompete | TRACKED | — | — | TRACKED_CURRENT — R-23 GAP |
| 184 | v1_subscription_coupons | TRACKED | — | — | TRACKED_CURRENT — SECURITY_DEFINER — R-23 GAP |
| 185 | v1_site_domains | TRACKED | YES | TRACKED | TRACKED_CURRENT — THEME-adjacent |
| 186 | v1_scale_commerce_os_coming_soon | **UNTRACKED (??)** | — | — | FOREIGN_WIP — ORDER_BLOCKED |
| 187 | v1_sites_site_settings | **UNTRACKED (??)** | — | — | FOREIGN_WIP — ORDER_BLOCKED |
| 188 | letbuyy_core_theme_row | TRACKED | — | — | TRACKED_CURRENT — THEME — R-23 GAP |
| 189 | theme_persistence_idempotency | TRACKED | — | — | TRACKED_CURRENT — THEME — R-23 GAP — ARB_GATE |
| 190 | theme_library_q | TRACKED | — | — | TRACKED_CURRENT — THEME — R-23 GAP |
| 191 | theme_purchases_rls_tenant_scope | TRACKED | — | — | TRACKED_CURRENT — RLS/SECURITY — SECURITY_REVIEW_REQUIRED — R-23 GAP |

---

## 2. Sequence Integrity (Validators)

### 2.1 Sequential-migration validator

**Command:** `node scripts/validators/sequential-migration-validator.mjs`
**Exit code:** **1 (FAIL)**
**Failures:**
```
- Untracked migration file found on disk but not committed:
  database/supabase/migrations/186_v1_scale_commerce_os_coming_soon.sql
- Untracked migration file found on disk but not committed:
  database/supabase/migrations/187_v1_sites_site_settings.sql
```
**Validator source:** `scripts/validators/sequential-migration-validator.mjs` — read-only; uses `getTrackedFiles()` + `getUntrackedFiles()`, reads only, no writes. Confirmed safe to run.

**Gate impact:** This validator is in the 107-validator gate (`scripts/validate-governance.mjs`, line 58). Its current EXIT 1 status means the governance gate is FAILING due to 186/187 being untracked.

### 2.2 Migration-safety validator

**Command:** `node scripts/validators/migration-safety-validator.mjs`
**Exit code:** **0 (PASS)**
**Scope:** Checks tracked migrations only for forbidden patterns (DROP TABLE, DROP COLUMN, TRUNCATE, RENAME TABLE, CREATE TABLE stores). No violations found.

### 2.3 No-public-using-true validator

**Command:** `node scripts/validators/no-public-using-true-validator.mjs`
**Exit code:** **0 (PASS)**
**Caveat:** The validator checks FINAL policy state for `sensitiveTables` only (products, orders, sites, store_customers, etc.). The four `app_*` tables in migration 100 (`app_collections`, `app_collection_items`, `app_featured_placements`, `app_discovery_events`) with USING(true) without TO role qualifier are NOT in `sensitiveTables` and are NOT checked. See §5.1 for the SECURITY_REVIEW_REQUIRED finding.

### 2.4 Rollback-integrity validator

**Command:** `node scripts/validators/rollback-integrity-validator.mjs`
**Exit code:** **0 (PASS)**
**Scope:** Infrastructure deployment rollback manifests (3 runtimes: api-gateway, webhook-service, queue-workers). Does NOT check per-migration rollback file coverage.

### 2.5 Mutation side-effect check

Git status --porcelain count: 378 before validators, 378 after all four validators. **No mutation.**
`scripts/validate-governance.mjs` calls `fs.rmSync` on `generatedDirectoryNames` (node_modules, .next, .turbo, dist, .dart_tool, build, coverage, .cache, .wrangler, .vercel, .symlinks, Pods). Confirmed: `git ls-files apps/ packages/ services/ | grep -E "/(node_modules|\.next|..." → **0 tracked files** in those directories. Therefore `validate-governance.mjs` is **SAFE** to run (deletes only gitignored output). This workstream did NOT run the full governance gate (to avoid the risk of the rmSync side-effects on the large tree); individual read-only validators were run instead.

---

## 3. Migrations 186 and 187 — Ownership, Dependency, and Ordering

### 3.1 Git tracking state

Both files are **UNTRACKED (??)**. Verified by:
- `git status --porcelain database/supabase/migrations/` — lines beginning `??`
- `git log --all --diff-filter=A -- <path>` → no output: **neither file appears in any commit in the full git history**

These files were never committed on any branch. They are locally-authored files that exist on disk but are invisible to CI and will not be applied by Supabase CLI in any tracked pipeline.

### 3.2 Content summary

**186 — v1_scale_commerce_os_coming_soon.sql (22 lines, data migration)**
```sql
UPDATE public.plans
SET status = 'coming_soon', purchasable = false, updated_at = now()
WHERE site_type = 'store' AND slug IN ('scale', 'commerce_os');
```
Pure data mutation on `public.plans`. No schema change. No SECURITY DEFINER. No RLS.

**187 — v1_sites_site_settings.sql (16 lines, additive schema)**
```sql
ALTER TABLE public.sites
  ADD COLUMN IF NOT EXISTS site_settings jsonb NOT NULL DEFAULT '{}'::jsonb;
```
Additive `ADD COLUMN IF NOT EXISTS` on `public.sites`. Idempotent. No SECURITY DEFINER. No RLS.

### 3.3 Source dependencies

**Migration 186 (`public.plans.status/purchasable`):**
- `services/api-gateway/src/lib/founding-pricing.ts:61` — `isNonReservedPlan()` checks `plan.purchasable !== false && plan.status !== 'coming_soon'`
- `apps/merchant-control-plane/src/app/[store]/access_account/checkout/select-plan/SelectPlanClient.tsx:69,141` — `plan.status === 'coming_soon' || plan.purchasable === false`
- `apps/marketing-site/src/components/Pricing.tsx:255` — `plan.status === 'coming_soon' || !plan.purchasable`

If 186 is unapplied in a live DB, the `coming_soon` gate in gateway/UI has no effect (scale/commerce_os plans would appear purchasable). **Source code already written and committed; missing only the DB data mutation.**

**Migration 187 (`public.sites.site_settings`):**
- `services/api-gateway/src/routes/stores.ts:722` — `site_settings` in PATCH allow-list
- `services/api-gateway/src/routes/storefront.ts:345,349` — `site_settings` in STOREFRONT_SITE_SELECT strings

If 187 is unapplied, any PATCH or SELECT referencing `site_settings` will silently fail (column does not exist). **Source code already written and committed; missing only the DB schema change.** This is a live-path regression risk.

### 3.4 Order dependency analysis

186 and 187 sit between committed 185 and committed 188 in the numeric sequence. A Supabase CLI `supabase db push` applies migrations in numeric order; if 186/187 are committed, they would run between 185 and 188. SQL analysis confirms:
- 188, 189, 190, 191 do NOT reference `public.plans.status`, `public.plans.purchasable`, or `public.sites.site_settings` — confirmed by grep returning no output.
- 186 (`UPDATE plans`) and 187 (`ADD COLUMN IF NOT EXISTS sites.site_settings`) are both idempotent and safe to apply after 191 if a live DB already has 188-191 applied, because:
  - 186 is a data mutation (safe to apply at any time)
  - 187 uses `ADD COLUMN IF NOT EXISTS` (idempotent)

**Conclusion:** No SQL-level dependency requires 186/187 to precede 188-191. However, the **sequence number gap** (185 → 188 in commit history, skipping 186/187) is an immutability and traceability concern that blocks CI.

---

## 4. Modified Historical Migrations (Immutability Concerns)

Already-numbered and previously-committed migrations modified in the working tree represent an immutability violation: a migration that has been applied to any environment cannot be safely changed retroactively. The current git status confirms four such files.

### 4.1 Migration 100 — app_discovery_foundation (TRACKED+MODIFIED)

**Evidence:** `git diff HEAD database/supabase/migrations/100_app_discovery_foundation.sql`

**Change:** `billing_mode = 'free'` → `billing_mode = NULL` in a seed INSERT ON CONFLICT block. Idempotent data change (ON CONFLICT DO UPDATE SET billing_mode = NULL).

**Concern:** Any environment where this migration has already been applied with `billing_mode = 'free'` would not be updated by the ON CONFLICT branch unless the plan row is re-inserted. **Risk: existing rows retain `'free'` until the ON CONFLICT update fires on next apply.**

**Additional concern (SECURITY_REVIEW_REQUIRED):** This migration's committed form (same in HEAD and working tree) defines 4 RLS policies on frozen app-marketplace tables WITHOUT an explicit `TO role` qualifier:
```sql
-- Lines 133, 145, 152, 155 of 100_app_discovery_foundation.sql
CREATE POLICY app_collections_service_all ON public.app_collections USING (true) WITH CHECK (true);
CREATE POLICY app_collection_items_service_all ON public.app_collection_items USING (true) WITH CHECK (true);
CREATE POLICY app_featured_placements_service_all ON public.app_featured_placements USING (true) WITH CHECK (true);
CREATE POLICY app_discovery_events_service_all ON public.app_discovery_events USING (true) WITH CHECK (true);
```
A PostgreSQL policy without `TO role` applies to ALL roles (PUBLIC, anon, authenticated, service_role). These policies grant unrestricted read AND write to all authenticated/anon clients on four app-marketplace tables. The `no-public-using-true-validator` does NOT catch these because these tables are not in its `sensitiveTables` set. Classified: ART-08/09 candidate violation — SECURITY_REVIEW_REQUIRED.

### 4.2 Migration 109 — orders_money_width (TRACKED+MODIFIED)

**Evidence:** `git diff HEAD database/supabase/migrations/109_orders_money_width.sql`

**Change:** Adds `DROP TRIGGER IF EXISTS trg_orders_pending_cod_status ON public.orders` before the ALTER TABLE, then recreates the trigger with an expanded `UPDATE OF` clause (adds `total, status` to the column list). This is a fix for a known trigger incompatibility with the ALTER TABLE.

**Impact if already applied:** If migration 109 was already applied WITHOUT this trigger fix, the trigger `trg_orders_pending_cod_status` is watching only `payment_method, payment_status`. The working-tree version recreates it watching `payment_method, payment_status, total, status`. If 109 is re-applied (or applied fresh), the trigger is correctly reconstructed. **If 109 cannot be re-applied (already applied to a live DB), this fix is stranded and requires a new migration.** No rollback file exists for migration 109.

### 4.3 Migration 111 — customer_credentials_source_of_truth (TRACKED+MODIFIED)

**Evidence:** `git diff HEAD database/supabase/migrations/111_customer_credentials_source_of_truth.sql`

**Change:** Prepends `ALTER TABLE public.customer_credentials ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.store_customers(id) ON DELETE SET NULL;` before the existing INSERT block.

**Concern:** This is an additive schema change (`ADD COLUMN IF NOT EXISTS`) prepended to an existing migration. If 111 has already been applied, this column addition is stranded; it would need its own new migration to land in a live DB.

### 4.4 Migration 142 — executable_payment_sessions (TRACKED+MODIFIED)

**Evidence:** `git diff HEAD database/supabase/migrations/142_executable_payment_sessions.sql`

**Change:** `customer_id uuid REFERENCES public.customers(id)` → `REFERENCES public.store_customers(id)` in the `payment_tokens` table CREATE. The `customers` table presumably does not exist in the current schema; `store_customers` is the canonical table.

**Rollback note:** Rollback file `142_executable_payment_sessions.rollback.sql` drops the `payment_tokens` table entirely (DROP TABLE IF EXISTS), which makes the FK change irrelevant for rollback purposes. The rollback remains valid.

### 4.5 config.toml (MODIFIED)

**Evidence:** `git diff HEAD database/supabase/config.toml` — `analytics.enabled: true` → `false`.

**Impact:** Local Supabase analytics is now disabled in the working-tree config. This is a developer environment configuration change with no runtime production impact. It does not affect migration apply.

---

## 5. Migration 191 — theme_purchases RLS Tenant Scope

**File:** `database/supabase/migrations/191_theme_purchases_rls_tenant_scope.sql`
**Commit:** `7e1441a6` (HEAD) — `feat(theme): add marketplace partner-submission validation gate + close theme_purchases RLS (Phase AE)`
**Git state:** TRACKED, committed in HEAD

### 5.1 Policy analysis

Migration 191 remediates RISK-SEC-001. It:
1. Drops the two wide-open baseline policies ("Users create theme purchases" WITH CHECK(true) and "Users view own theme purchases" USING(true)).
2. Creates `tp_service_role` FOR ALL TO service_role USING(true) WITH CHECK(true).
3. Creates `tp_authenticated_select` FOR SELECT TO authenticated USING (user_id = auth.uid()).
4. Creates `tp_authenticated_insert` FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid()).

**Baseline confirmation:** `database/supabase/migrations/000_baseline.sql` lines 24156-24201 confirm the wide-open policies existed in the baseline. Lines 27775-27778 confirm `ALTER TABLE public.theme_purchases ENABLE ROW LEVEL SECURITY` was in the baseline.

### 5.2 UUID namespace analysis (user_id vs auth.uid())

The migration's own comment (lines 24-36) is architecturally correct and confirmed by this audit:

**`theme_purchases.user_id`:** FK to `public.users_custom(id)`. Source: `000_baseline.sql:23603` — `ADD CONSTRAINT theme_purchases_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users_custom(id)`.

**`public.users_custom.id`:** UUID generated via `gen_random_uuid()` with NO FK to `auth.users`. Source: `000_baseline.sql:13127-13138` — the table definition shows `id uuid DEFAULT gen_random_uuid() NOT NULL` with no reference to `auth.users`.

**`auth.uid()`:** Returns the `auth.users.id` UUID for the current Supabase-auth session. `auth.users` is used as FK target by other tables (e.g., `device_tokens`, `employees`, `notification_preferences`) but NOT by `users_custom`.

**Conclusion:** `public.users_custom.id` and `auth.users.id` are SEPARATE UUID namespaces. They are not linked by a FK or any synchronization mechanism visible in the migration chain. The policies `USING (user_id = auth.uid())` will ONLY match rows where `users_custom.id` happens to equal the Supabase auth UUID — which the migration comments correctly identify as "not the normal case."

**Net security posture:** The migration's stated design intent is correct — the `TO authenticated` policies function as an effective DENY for direct Supabase-auth client access (since UUIDs won't match), while service_role (the gateway path) bypasses RLS entirely. This is the correct defensive posture for theme_purchases.

**Residual concern (SECURITY_REVIEW_REQUIRED):** The UUID namespace separation means the "user_id = auth.uid()" predicate is defensive-by-accident, not by explicit site_id-scoped tenancy. A future change that links `users_custom.id` to `auth.users.id` would inadvertently make the predicate effective — which is desirable. But the current policy creates a gap: if a `users_custom.id` happens to collide (UUIDs are random; astronomically unlikely), a wrong user could see records. Formal closure would require an explicit `site_id`-scoped predicate consistent with the D2/D4 RLS pattern. **Deferred: this matches the "RISK-AE-SEC-003" classification in the HEAD commit message.**

### 5.3 Migration 191 rollback gap (R-23)

No rollback file exists for migration 191. Forward-fix is possible (drop and recreate policies), but no paired rollback is provided.

---

## 6. Rollback Coverage (R-23 Compliance)

**R-23 (Constitution line 424):** "Every migration MUST ship a paired rollback."

**Scope definition (LEG-059, LETBUYY_LEGACY_ELIMINATION_MASTER_PLAN.md line 188):** Rollback coverage is required for migrations ≥138.

### 6.1 Summary

| Category | Count |
|----------|------:|
| Migrations ≥138 on disk (including untracked 186/187) | 54 |
| Rollback files on disk | 37 |
| **Missing rollback files (≥138)** | **17** |
| Rollback files tracked | 34 |
| Rollback files UNTRACKED (176/177/178) | 3 |

### 6.2 Missing rollback files (17 gaps)

The following migrations ≥138 lack paired rollback files:

| # | Name | Notes |
|---|------|-------|
| 138 | mobile_store_metafields | LEG-059 pre-existing debt |
| 140 | mobile_cod_reconciliation | LEG-059 pre-existing debt |
| 157 | product_metadata | LEG-059 pre-existing debt |
| 170 | v1_shipping_rates_gst | SECURITY_DEFINER, MONEY — new gap post-LEG-059 |
| 175 | fix_session_rpc_search_path | AUTH/SECURITY_DEFINER — new gap |
| 179 | outbox_partition_shadow_published_at | new gap |
| 180 | urban_kicks_liquid_theme | THEME — new gap |
| 181 | urban_kicks_settings_schema_complete | THEME — new gap |
| 182 | v1_sites_timezone | new gap |
| 183 | v1_pricing_recompete | new gap |
| 184 | v1_subscription_coupons | SECURITY_DEFINER — new gap |
| 186 | v1_scale_commerce_os_coming_soon | UNTRACKED — cannot have rollback |
| 187 | v1_sites_site_settings | UNTRACKED — cannot have rollback |
| 188 | letbuyy_core_theme_row | THEME — new gap |
| 189 | theme_persistence_idempotency | THEME, ARB gate — new gap |
| 190 | theme_library_q | THEME — new gap |
| 191 | theme_purchases_rls_tenant_scope | RLS — new gap |

**Growth from LEG-059 baseline:** LEG-059 documented 3 missing rollbacks (138/140/157) with "21 files vs 24 forwards ≥138". The current state is 37 rollbacks vs 54 forward migrations ≥138 — a gap of 17 (14 new since LEG-059).

### 6.3 Untracked rollback files (176/177/178)

Rollback files for migrations 176, 177, and 178 exist on disk but are not committed (`git status --porcelain database/supabase/rollback/` shows `??` for all three). The forward migrations (176/177/178) ARE tracked. This creates a pair where:
- Forward migration: committed ✓
- Rollback: authored locally but not committed ✗

These must be committed (along with 186/187 or in a separate commit) to satisfy R-23.

### 6.4 Migration 189 explicit ARB gate

Migration 189 (`theme_persistence_idempotency.sql`) contains at line 33: `-- ARB gate: this migration must NOT be applied to production without ARB sign-off.` This is a MIGRATION-internal governance control. The migration is committed but carries an explicit advisory that production apply requires ARB approval before staging apply. Classification: IMPLEMENTED_NOT_LIVE (structure correct; production application explicitly gated).

---

## 7. Migration Apply State Assessment

**Hard finding: No live apply evidence exists in this repository for any migration, for any environment.**

Evidence sources examined:
- `database/supabase/.branches/_current_branch` — contains `main`; this is a local branch tracking file, not a live DB apply record
- `docs/central-intelligence/deployment-state.md` — states `Latest migration: 174_v1_gift_card_refund_restore.sql` at HEAD `4a91fa96` (generated 2026-06-14). This document is STALE: current HEAD is `7e1441a6` (migration 191). The document itself declares `mode: governance-contract-not-live-evidence`
- `config/runtime/deployment-lineage-manifest.json` — `mode: "governance-contract-not-live-evidence"` — explicitly states this is NOT live evidence
- No Supabase migration history file (e.g., `supabase_migrations.csv`, `schema_migrations` dump) exists in the repository

**Classification:** Apply state for ALL migrations (staging AND production) is **NOT_CONNECTED**. Whether migrations 186-191 (or any subset) have been applied to any live environment CANNOT be determined from repository evidence alone. A human with live Supabase credentials must run `supabase migration list --db-url <url>` against staging and production.

**Hard rule:** No migration proceeds to staging (Phase AI) until:
1. The apply state of ALL migrations through 191 is confirmed against live environments
2. 186/187 are committed (or explicitly abandoned with a documented decision)
3. The 17 R-23 rollback gaps for ≥138 are resolved or formally excepted
4. Modified historical migrations (100/109/111/142) are resolved (new migrations written for any fix that needs to land in a live DB)

---

## 8. Theme-Related Migration Chain

| # | Name | Theme Tables | Notes |
|---|------|-------------|-------|
| 087 | theme_template_drafts | theme_template_drafts | TRACKED |
| 091 | theme_marketplace_stepup | theme_marketplace_stepup_votes | TRACKED |
| 100 | app_discovery_foundation | Indirectly: app_collections | TRACKED+MODIFIED — SECURITY_REVIEW_REQUIRED |
| 171 | liquid_bundle_persistence | themes.default_template | TRACKED+ROLLBACK |
| 172 | liquid_bundle_refresh | themes.default_template | TRACKED+ROLLBACK |
| 180 | urban_kicks_liquid_theme | themes (data) | TRACKED — R-23 GAP |
| 181 | urban_kicks_settings_schema_complete | themes.settings_schema (data) | TRACKED — R-23 GAP |
| 185 | v1_site_domains | site_domains | TRACKED+ROLLBACK |
| 187 | v1_sites_site_settings | sites.site_settings | UNTRACKED (??)|
| 188 | letbuyy_core_theme_row | themes (data) | TRACKED — R-23 GAP |
| 189 | theme_persistence_idempotency | theme_releases.idempotency_key | TRACKED — R-23 GAP — ARB GATE |
| 190 | theme_library_q | themes.owned_by_site_id, is_site_private | TRACKED — R-23 GAP |
| 191 | theme_purchases_rls_tenant_scope | theme_purchases (RLS only) | TRACKED — SECURITY_REVIEW_REQUIRED — R-23 GAP |

**ART-17 invariant:** None of the theme migrations (180-191) change `THEME_LIQUID_RENDERING_DEFAULT_ENABLED`. Confirmed: 180 sets `rendererEngine = 'liquid'` on the urban-kicks theme row (per-theme config), not the global flag. The global flag (`THEME_LIQUID_RENDERING_DEFAULT_ENABLED=false`) is an environment variable, not a migration artifact. ART-17 is NOT violated by the migration chain.

---

## 9. Auth, RLS, and SECURITY DEFINER Migrations

### Key migrations by category

**Auth/Identity:**
- 153 (`executable_identity_security`) — WITH ROLLBACK
- 159 (`identity_foundation_core`) — WITH ROLLBACK
- 161 (`foundation_session_security`) — SECURITY_DEFINER, WITH ROLLBACK
- 175 (`fix_session_rpc_search_path`) — SECURITY_DEFINER (fixes search_path for `validate_and_rotate_merchant_session`), NO ROLLBACK — R-23 GAP

**RLS hardening:**
- 107 (`security_rls_hardening_and_payment_uniqueness`) — pre-R-23
- 163 (`d2_live_data_leak_rls`) — D2 pattern (service_role explicit policies), WITH ROLLBACK
- 164 (`d4_tenant_role_guc`) — WITH ROLLBACK
- 191 (`theme_purchases_rls_tenant_scope`) — closes RISK-SEC-001, NO ROLLBACK — R-23 GAP

**Money/Canonical ledger:**
- 139, 141, 151, 154 — SECURITY_DEFINER, WITH ROLLBACK
- 160 (`foundation_money_ledger_authority`) — SECURITY_DEFINER, WITH ROLLBACK
- 165 (`d5_canonical_money_paths`) — SECURITY_DEFINER, WITH ROLLBACK
- 168 (`b1_b2_capture_refund_ledgering`) — WITH ROLLBACK
- 170 (`v1_shipping_rates_gst`) — SECURITY_DEFINER (modify `create_checkout_order`), NO ROLLBACK — R-23 GAP
- 173, 174 (`v1_gift_card_*`) — SECURITY_DEFINER, WITH ROLLBACK
- 176, 177 (`v1_founding_program_*`) — SECURITY_DEFINER, WITH ROLLBACK (rollback UNTRACKED)
- 184 (`v1_subscription_coupons`) — SECURITY_DEFINER, NO ROLLBACK — R-23 GAP

---

## 10. Classification Summary

| Classification | Migrations |
|----------------|-----------|
| TRACKED_CURRENT (clean, rollback N/A or covered) | 000-085, 086-099, 101-106, 108, 110, 112-137, 139, 141, 143-156, 158-169, 171-174, 176-178, 185 |
| TRACKED_CURRENT — IMMUTABILITY_CONCERN | 100, 109, 111, 142 |
| TRACKED_CURRENT — SECURITY_REVIEW_REQUIRED | 100 (RLS gap), 191 (UUID namespace) |
| TRACKED_CURRENT — R-23 ROLLBACK GAP | 138, 140, 157, 170, 175, 179-184, 188-191 |
| TRACKED_CURRENT — ROLLBACK UNTRACKED | 176, 177, 178 |
| TRACKED_CURRENT — ARB_GATE | 189 |
| FOREIGN_WIP — ORDER_BLOCKED | 186, 187 |
| NOT_CONNECTED (apply state) | ALL migrations, all environments |

---

## 11. Hard Blocking Gate

> **No migration proceeds to staging (Phase AI) until ALL entries below are resolved by human action.**

| Blocker | Required Action |
|---------|----------------|
| B1 | Migrations 186/187 are UNTRACKED — sequential-migration gate fails (EXIT 1). Human must `git add` and commit both files (with rollback files added simultaneously) OR explicitly delete them with a documented rationale and a replacement migration at the next free sequence number |
| B2 | Apply state of ALL migrations through 191 in staging and production is UNKNOWN (NOT_CONNECTED). A human with live Supabase credentials must run `supabase migration list` against each environment and reconcile |
| B3 | Modified historical migrations 109, 111 contain fixes that cannot be applied to live DBs without new forward migrations. If these fixes need to land in production, new migrations (192, 193, …) must be authored and committed |
| B4 | Rollback files for 176, 177, 178 are on disk but UNTRACKED. Must be committed before any of these migrations are applied to staging |
| B5 | Migration 189 carries explicit `ARB gate` comment. ARB sign-off required before staging apply |
| B6 | 14 new R-23 gaps post-LEG-059 (migrations 170, 175, 179-184, 188-191). Either rollback files are authored and committed, or each migration receives an explicit ARB-documented exception |

---

## 12. STOP/GO Inputs to AF_1 Decision

The following are this workstream's concrete contributions to the AF_12 STOP/GO decision:

1. **STOP INPUT:** Sequential-migration validator EXIT 1 — untracked 186/187 block the 107-validator governance gate. The gate cannot pass until 186/187 are committed or deleted.

2. **STOP INPUT:** Migration apply state (staging and production) is NOT_CONNECTED. Phase AI cannot begin without live confirmation that the migration chain is in the expected state in each environment.

3. **STOP INPUT:** Modified historical migrations 109 and 111 contain changes that cannot retroactively apply to a live DB. If these fixes need to be in production before AF_1 closes, new numbered migrations are required.

4. **STOP INPUT:** Migration 189 carries an explicit ARB gate. No staging apply of 189 without ARB approval.

5. **HIGH RISK INPUT:** 17 R-23 rollback gaps exist for migrations ≥138. 14 are new since LEG-059. The three with highest risk are 170 (create_checkout_order SECURITY_DEFINER), 175 (session RPC fix — AUTH), and 191 (RLS close — SECURITY). These must have rollbacks authored or explicit ARB exceptions before production apply.

6. **SECURITY INPUT:** Migration 100 (TRACKED+MODIFIED) contains USING(true) without TO role on four frozen app-marketplace tables. The no-public-using-true validator does NOT catch this. An ART-08/09 review of these four tables is required before AF_1 closes.

7. **SECURITY INPUT:** Migration 191 theme_purchases RLS uses user_id = auth.uid() where users_custom.id and auth.uid() are separate UUID namespaces. The defensive posture is correct and intentional, but the residual (RISK-AE-SEC-003) is explicitly deferred — AF_1 should track this as an OPEN risk item.

8. **INFO INPUT:** Rollback files 176/177/178 exist but are UNTRACKED. These must be committed before any of those migrations are applied to staging or production.

9. **INFO INPUT:** config.toml analytics disabled in working tree (FOREIGN_WIP). No migration apply impact but the working-tree state should be resolved before a clean baseline is established.
