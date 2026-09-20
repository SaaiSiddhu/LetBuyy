# DATABASE TRUTH REPORT — LetBuyy Repository Forensic Audit

**Axis:** Database Truth (Supabase/Postgres + Cloudflare D1)
**Date:** 2026-06-10
**Repo state:** branch `stepup/main`, HEAD `c4fc3cd6` ("fix(foundation): resolve final audit drift"), working tree massively dirty.
**Scope:** Repository-state audit only. **No live DB access.** All "final state" claims are derived from static parsing of the migration chain, not from a live catalog. Live-DB seams are tracked explicitly in the Unknowns section and in `SKIPPED_HUMAN_DECISIONS.md`.

---

## 1. Executive Summary

The schema is delivered by a **92-file Supabase migration chain** (`000_baseline.sql` → `166`), of which **`000` + 86 are committed at HEAD** and **5 (162–166) plus their 5 rollbacks are UNTRACKED working-tree-only files**. The baseline is a `pg_dump`-style snapshot (28,072 lines, 237 `CREATE TABLE`); the additive chain (073–166) layers on **~183 more tables**, yielding **419 distinct named base tables** (+5 partition-default children, +dynamic partition children). The chain is **strictly additive — zero `DROP TABLE` in the entire forward chain** — so every product-era dead table (portfolio/resume/gallery/skills) is still physically defined.

**Money is the load-bearing risk.** Two parallel money models coexist: a **mutable mobile model** (`wallet_ledger_entries`, `payout_statements`, `commission_*` from `119`) and a **canonical append-only double-entry ledger** (`ledger_accounts`/`ledger_transactions`/`ledger_entries` from `139`, with append-only triggers + a balance-enforcing constraint trigger). Migrations `160`/`165` bridge them with `canonical_ledger_transaction_id` columns and reconciliation RPCs. **The canonical-money hardening that closes the caller-supplied-`site_id` settlement hole (`165`) and the reserve→commit checkout authority (`166`) are BOTH untracked** — they exist only in the working tree and would not deploy from a clean checkout.

**RLS final-state verdict (repository-state):** Tenant isolation is materially improved over the baseline. The `163` emergency migration re-scopes 11 sensitive tables off PUBLIC; `164` installs a non-`BYPASSRLS` `app_tenant` role with GUC-driven `FORCE` policies across all `site_id`/`store_id` tables; `165` revokes `UPDATE/DELETE` on the canonical ledger from every role. The repo's own `no-public-using-true-validator` and `rls-force-coverage-validator` **both PASS**. **However**, those validators only police a 12-table sensitive allowlist and tracked files. Static final-state parsing still finds **25 PUBLIC/anon/authenticated policies with `USING(true)`/`WITH CHECK(true)`** surviving in the final state — mostly `service_role_*`-named baseline policies that omit a `TO` clause (so they grant to PUBLIC, the exact `163` bug class) plus genuinely-public insert policies (`audit_logs`, `theme_purchases`, `contact_submissions`, `leads`, `analytics_events`). These are outside the 12-table allowlist, so no validator blocks them.

**Top systemic issues:** (1) money's most important fixes are uncommitted; (2) `162` rewrites historical commission financial rows in place (no ledger entry); (3) a **`129` numbering collision** (two distinct migrations share the prefix); (4) rollback pairs only exist for `139`+ — **68 of the additive migrations (073–138, 140, 157) have no rollback**, and the safety validator is explicitly forward-fix-only; (5) the migration-safety validator scans `getTrackedFiles()` only, so it is **structurally blind to the untracked 162–166**; (6) 25 residual PUBLIC `USING(true)` policies the allowlist doesn't cover.

---

## 2. Method

- **Enumeration:** `ls`/`git ls-files`/`git status` over `database/supabase/migrations/`, `database/supabase/rollback/`, `database/cloudflare/`, `config/supabase/`, `docs/archive/migrations-history/`, `docs/archive/supabase-root-config/`.
- **Census:** `grep -c` for DDL verbs in `000_baseline.sql` and the additive chain; a read-only Node script (`/tmp/fsp.mjs`, ephemeral, not written to repo) replayed `CREATE/DROP POLICY`, `ENABLE/FORCE RLS`, and `GRANT/REVOKE` in file order to compute **final state**; a second script (`/tmp/norls.mjs`) cross-checked tables lacking static RLS. Both are read-only and create no repo artifacts.
- **Validators (read-only runs):** `no-public-using-true-validator.mjs`, `rls-force-coverage-validator.mjs`, `migration-safety-validator.mjs`, `commission-bps-zero-validator.mjs`.
- **Registry cross-check:** parsed `services/api-gateway/src/tenant/tenant-tables.registry.ts` (261 entries) against schema scope columns.
- **Dead-table probe:** `git status` confirms additive nature; code-reference probes via Grep across `apps/`/`services/`/`packages/` for candidate dead tables.
- **Limitation:** Dynamic DDL inside `DO $$ ... EXECUTE format(...)` blocks (11 migrations) is **not visible to naive static `CREATE POLICY` regex**. I read those loops directly (139/151/164 quoted below) and reconciled the apparent gaps; flagged where unresolved.

---

## 3. Migration Chain Inventory

**Chain length:** `000_baseline.sql` + 91 additive files = **92 files**. Forward total **44,710 lines** (`000` alone = 28,072). **150 distinct `CREATE FUNCTION` names**, **396 `CREATE TRIGGER` statements**, **1 materialized view** (`commerce_analytics_daily_mv`, `154`), 1 plain view, **669 final-state RLS policies**.

**Committed vs untracked:**
- Tracked at HEAD: `000` + migrations 073–161 (90 forward files) + rollbacks 139–161 (21 files) + 19 verification files + 1 D1 migration.
- **UNTRACKED (working-tree only, `git status ??`):** forward `162,163,164,165,166`; rollbacks `162,163,164,165,166`. (10 files total.)
- **Modified-but-tracked at HEAD:** `090_custom_domains_and_store_access.sql`, `100_app_discovery_foundation.sql` (working-tree edits add `DROP TRIGGER/POLICY IF EXISTS` idempotency guards and a partial-index `ON CONFLICT ... WHERE` clause — replayability hardening, non-destructive).

### Inventory table (number → name → committed at HEAD? → rollback pair? → risk class)

| # | Name | Committed? | Rollback? | Risk class |
|---|------|-----------|-----------|------------|
| 000 | baseline (pg_dump snapshot) | yes | n/a (baseline) | Foundational; contains the legacy PUBLIC `USING(true)` policies |
| 073–089 | order/product reconcile, partitions, trigram, quarantine | yes | **NONE** | Mostly additive; `085/086` reconcile DDL |
| 090 | custom_domains_and_store_access | yes (modified) | **NONE** | Medium (RLS-bearing) |
| 091 | theme_marketplace_stepup | yes | **NONE** | Dynamic-policy `DO` block |
| 092–106 | app marketplace waves | yes | **NONE** | `103` adds dynamic legacy-table RLS |
| 103 | app_api_quota_and_legacy_rls | yes | **NONE** | 22 `DROP POLICY`; legacy tenant backfill |
| 107 | security_rls_hardening_and_payment_uniqueness | yes | **NONE** | **Medium-high**: 18 `DROP POLICY`, global unique on `(gateway, provider_payment_id)` |
| 108–111 | orders NOT NULL, money width, FK hygiene, customer creds | yes | **NONE** | `108/130` NOT-NULL backfills |
| 112 | app_marketplace_parity_data_layer | yes | **NONE** | 12 `DROP POLICY`; dynamic |
| 113 | internal_os_rbac_spine | yes | **NONE** | RBAC |
| 114–123 | mobile merchant V2 waves | yes | **NONE** | `119` = mobile money model (mutable) |
| **119** | **mobile_money_ledgers** | yes | **NONE** | **HIGH**: creates `wallet_ledger_entries`, `payout_statements`, `commission_*` (parallel money model) |
| 124–128 | internal OS risk/T&S/360/support/review | yes | **NONE** | |
| **129** | **internal_os_executive_analytics_rollups** | yes | **NONE** | **COLLISION** — shares prefix 129 |
| **129** | **mobile_customer_segments** | yes | **NONE** | **COLLISION** — shares prefix 129 |
| 130 | orders_site_id_not_null | yes | **NONE** | Backfill + NOT NULL |
| 131 | hot_table_partition_shadow_mirror | yes | **NONE** | Dynamic `INSERT...SELECT`/`DELETE` retention DML |
| 132–138 | mobile whatsapp/marketing/l10n/metafields | yes | **NONE** | |
| **139** | **executable_foundation_ledger_core** | yes | **YES** | **HIGH**: canonical append-only ledger + reject-mutation triggers + balance constraint trigger |
| 140 | mobile_cod_reconciliation | yes | **NONE** | COD money |
| 141 | executable_inventory_reservations | yes | YES | reserve/commit/release RPCs |
| 142 | executable_payment_sessions | yes | YES | unique `(provider, provider_payment_id)` |
| 143–150 | discount/tax/shipping/checkout/risk/notif/email/whatsapp | yes | YES | |
| **151** | **executable_settlement_ledger** | yes | YES | **HIGH**: settlement/payout/reserve money tables, dynamic RLS loop |
| 152 | executable_billing_autopay | yes | YES | billing mandates/dunning |
| 153 | executable_identity_security | yes | YES | store_credit, step-up, consents |
| 154 | executable_analytics_media_ai_seam | yes | YES | matview |
| 155 | storefront_session_analytics | yes | YES | additive FORCE proof |
| 156 | executable_cart_channel_handoff | yes | YES | |
| 157 | product_metadata | yes | **NONE** | additive |
| 158 | order_items_tenant_scope | yes | YES | |
| 159 | identity_foundation_core | yes | YES | 725 lines; identity tables |
| **160** | **foundation_money_ledger_authority** | yes | YES | **HIGH**: reconciliation RPCs, bigint money backfill, `claim_payout_statement_release` balance gate |
| 161 | foundation_session_security | yes | YES | |
| **162** | **phase_a_commission_zero** | **NO (untracked)** | NO (untracked) | **HIGH**: rewrites historical commission rows in place |
| **163** | **d2_live_data_leak_rls** | **NO (untracked)** | NO (untracked) | **CRITICAL**: closes PUBLIC `USING(true)` leak on 11 sensitive tables |
| **164** | **d4_tenant_role_guc** | **NO (untracked)** | NO (untracked) | **CRITICAL**: `app_tenant` non-BYPASSRLS role + GUC FORCE policies |
| **165** | **d5_canonical_money_paths** | **NO (untracked)** | NO (untracked) | **CRITICAL**: settlement ownership resolution, ledger UPDATE/DELETE revoke |
| **166** | **d6_checkout_handoff_inventory** | **NO (untracked)** | NO (untracked) | **HIGH**: reserve→commit checkout order authority |

**Numbering:** chain is contiguous 073→166 except the **`129` collision** (two files). No gaps. `supabase db push --include-all` (see §8) orders by filename; the two `129_*` files sort lexicographically (`129_internal_os...` before `129_mobile...`) — deterministic but a latent foot-gun if either is renamed.

---

## 4. Active Schema Census

**Tables:** 419 distinct named base tables across the chain (237 in baseline, ~183 additive). Plus 5 `*_partitioned_default` children and runtime-created monthly partitions (`079` `ensure_next_hot_table_partitions` creates `CREATE TABLE public.%I PARTITION OF ...` dynamically — the lone `CREATE TABLE public` token at `079:179` is this template, not a real table named `public`).

**Key domains present:**
- **Orders/checkout:** `orders`, `order_items`, `draft_orders`, `draft_order_lines`, `carts`, `checkout_sessions`, `inventory_reservations`, `inventory_levels`, `inventory_adjustments`.
- **Payments:** `payments`, `payment_transactions`, `payment_attempts`, `payment_sessions`, `payment_credentials`, `payment_tokens`, `chargeback_events`.
- **Canonical ledger (139):** `ledger_accounts`, `ledger_transactions`, `ledger_entries`, `compensation_actions`, `outbox_consumptions`.
- **Mobile/settlement money (119/151):** `wallet_ledger_entries`, `payout_statements`, `payouts`, `payout_items`, `payout_disputes`, `payout_reconciliation_records`, `settlements`, `reserves`, `recon_breaks`, `commission_schedules`, `commission_reconciliation_entries`, `money_ledger_site_reconciliations`, `dual_model_reconciliation_reports`.
- **COD:** `cod_reconciliation_entries`, `cod_confirmation_requests`.
- **Themes/sites/stores:** `sites` (canonical; `stores` is view/API language — a `CREATE TABLE stores` is explicitly forbidden by validator), `themes`, `theme_*` (marketplace), `store_branding`, `store_metafield_*`, `storefront_locales/translations`, `store_markets`, `store_credit`/`store_credit_ledger_entries`.
- **Identity/sessions:** `sessions_v2`, `refresh_tokens`, `refresh_chains`, `signing_keys`, `authenticators`, `recovery_codes`, `step_up_challenges`, `merchant_2fa_factors`, `oauth_clients/grants`, `authorization_codes`, `federation_tokens`, `principals`, `credentials`, `super_admin_allowlist`.
- **Apps marketplace:** ~50 `app_*` tables.
- **Internal OS:** `ts_cases/evidence/policies/takedowns/appeals`, `risk_*`, `support_tickets`+`ticket_*`, `impersonation_sessions`, `incident_postmortems`, `oncall_schedules`, `compliance`/`data_subject_requests`.
- **Legacy/product-era (DEAD candidates — see §6):** `portfolio_projects`, `resume_versions`, `gallery_items`, `skill_endorsements`, `projects`.

**Money RPCs (the load-bearing functions):**
- Canonical posting: `post_ledger_transaction` (139), `enforce_ledger_transaction_balance`, `reject_ledger_mutation` (append-only guard), `ensure_ledger_account`, `ledger_account_balance_minor` (160), `ledger_balance_breaks`.
- Settlement/payout: `post_settlement_ledger_transaction` (165 — resolves owning `site_id` from the source row, **rejects caller-supplied `p_site_id` mismatch**), `resolve_money_ledger_source_site_id` (165), `claim_payout_statement_release` (160 — balance-gated), `reconcile_cod_remittance_with_ledger` (165).
- Reconciliation: `refresh_money_ledger_site_reconciliation`, `assert_money_ledger_site_reconciliation` (raises on variance ≠ 0), `backfill_wallet_ledger_to_canonical` (160).
- Inventory: `reserve_inventory`, `commit_inventory_reservation`, `release_inventory_reservation`, `expire_inventory_reservations`, `require_inventory_site_guc`, `create_order_with_inventory_reservations` (166).
- Tenant GUC: `current_site_id()` = `SELECT NULLIF(current_setting('app.site_id', true), '')::uuid` (139:8), `set_current_site_id`.
- bigint-money sync triggers: `sync_cod/wallet/commission/payout_*_money_bigint` (widening `int4` minor → `int8`).

**Append-only enforcement (139):** `ledger_entries`/`ledger_transactions` get `BEFORE UPDATE`/`BEFORE DELETE` triggers calling `reject_ledger_mutation()` (`RAISE EXCEPTION 'ledger is append-only; use reversing entries'`), plus a `CREATE CONSTRAINT TRIGGER ledger_entries_balance_enforced`. `165` additionally `REVOKE UPDATE, DELETE ... FROM PUBLIC, anon, authenticated, service_role, app_tenant`. This is a genuine canonical-ledger design.

---

## 5. RLS / Grant Truth (final-state, repository-derived)

**Validator runs (read-only, all PASS):**
```
no-public-using-true-validator.mjs   → PASS  ("public USING true policies checked")
rls-force-coverage-validator.mjs     → PASS  ("RLS FORCE coverage ratchet checked")
migration-safety-validator.mjs       → PASS  ("checked for destructive replay hazards")
commission-bps-zero-validator.mjs    → PASS  ("commission_bps remains zero in active defaults")
```

**Final-state policy census (static replay of 92 files in order):** 669 surviving policies. **44 tables get explicit static `FORCE ROW LEVEL SECURITY`**; ~350 get `ENABLE` only via static DDL. **20 tables have no *static* `ENABLE`** — but **all 20 are covered by dynamic `DO`-block loops** (verified by reading 139/151) that do `ENABLE`+`FORCE`+tenant policy: `ledger_accounts/transactions/entries`, `compensation_actions`, `outbox_consumptions` (139 loop); `payout_statements`, `wallet_ledger_entries`, `commission_schedules`, `commission_reconciliation_entries`, `settlements`, `reserves`, `payouts`, `payout_items`, `recon_breaks` (151 loop); `store_credit`, `consents`, `step_up_challenges`, `sensitive_action_approvals`, `customer_dsr_exports` (153); `billing_*`, `merchant_billing_invoices` (152). **So the canonical money tables ARE RLS-protected at runtime** — the static gap is a parser artifact, not a real hole.

**The `164` `app_tenant` GUC template (quoted, 164:53–73):**
```sql
v_policy_name := 'app_tenant_guc_' || substr(md5(v_table.table_name), 1, 16);
IF v_table.has_site_id AND v_table.has_store_id THEN
  v_predicate := 'COALESCE(site_id, store_id) = public.current_site_id()';
ELSIF v_table.has_site_id THEN v_predicate := 'site_id = public.current_site_id()';
ELSE v_predicate := 'store_id = public.current_site_id()';
END IF;
EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', ...);
EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', ...);
EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO app_tenant USING (%s) WITH CHECK (%s)', ...);
```
`app_tenant` is created `NOLOGIN NOBYPASSRLS` (164:11) and granted to `postgres`+`service_role`. The gateway is expected to `SET LOCAL ROLE app_tenant` + `SET LOCAL app.site_id` from a validated ownership claim. This is the correct fail-closed tenant design **if and only if the gateway actually switches role** — that runtime behavior is out of this axis's scope (it's the gateway auditor's call).

**Residual PUBLIC `USING(true)`/`WITH CHECK(true)` in final state (25 — these survive because they're outside the 12-table validator allowlist):**
- Baseline `service_role_*`-named policies that **omit `TO service_role`** → default to PUBLIC (the exact `163` bug class, never fixed for these): `collections.service_role_collections`, `collection_products.service_role_collection_products`, `gift_cards.service_role_gift_cards`, `onboarding_attempts.service_role_onboarding`, `pages.service_role_pages`, `store_surveys.service_role_store_surveys`, `ai_usage."Service role manages AI usage"`, `auth_password_set_intents."Service role manages auth password set intents"` (078:52), `app_collections/app_collection_items/app_featured_placements/app_discovery_events_service_all` (100), `employee_permissions_read` (107:121).
- Genuinely public insert/read: `audit_logs.audit_insert` (`FOR INSERT WITH CHECK (true)`), `theme_purchases."Users create theme purchases"` + `"Users view own theme purchases"`, `themes."Themes are viewable by everyone"`, `plans.anyone_read_plans`, `employee_roles.anyone_read_roles`, `contact_submissions.public_submit_contact`, `leads.public_submit_leads`, `analytics_events.public_track_analytics`, `skill_endorsements.*` (anon), `smart_collections.public_view_smart_collections` (anon).

Some of these are intentional (public read of `themes`/`plans`, anonymous lead/contact capture). But the `service_role_*`-named-but-PUBLIC ones (`gift_cards`, `pages`, `collections`, `onboarding_attempts`, `ai_usage`, `auth_password_set_intents`) are the same latent privilege bug `163` was created to fix — and they are **not** on the validator's 12-table allowlist, so nothing blocks them. **UNVERIFIED whether `gift_cards`/`pages`/`collections` are still reachable by anon at runtime** (depends on table-level GRANTs not visible statically; needs live `pg_policies`+`information_schema.role_table_grants`).

**GRANT/REVOKE census (explicit statements in chain; excludes dynamic loop grants):** 12 top-level statements — `REVOKE` from PUBLIC/anon/authenticated ×4 each (163 sensitive-table lockdown), `GRANT ... TO service_role` ×1, `GRANT ... TO app_tenant` ×7 (164), `REVOKE ... FROM service_role/app_tenant` ×2 (165 ledger immutability). `164` also sets `ALTER DEFAULT PRIVILEGES ... GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO app_tenant` (so new tables auto-grant to the tenant role — relies on RLS to constrain).

**super_admin_allowlist lock:** `163` (RT-9) drops the legacy policy and recreates `super_admin_manage_allowlist` (`TO authenticated USING (public.is_super_admin())`), a service-role policy, and `REVOKE ALL ... FROM PUBLIC, anon, authenticated`. `is_super_admin()` (000:4409) = `EXISTS (SELECT 1 FROM super_admin_allowlist WHERE user_id = auth.uid() AND is_active)`. Self-referential but `SECURITY DEFINER STABLE` — standard pattern.

---

## 6. Dead / Duplicate / Legacy Schema

**DEAD candidates (product/personal-site era — `SKIP-D11-PRODUCT-DEAD-TABLE-WRITER-PROBE`):** The repo names this seam in `SKIPPED_HUMAN_DECISIONS.md:26` pointing at `dead-residue-validator.mjs`, but that validator actually polices env-var/route residue, **not** dead tables — so there is **no machine-checked dead-table candidate list**; the candidates must be inferred. The `sites.site_type` CHECK still enumerates `store,portfolio,resume,landing,blog` (000:12013), and these tables exist with zero or near-zero live code references:

| Table | Code refs (apps/services/packages) | Status |
|-------|-----|--------|
| `skill_endorsements` | **0** (only docs/archive + baseline) | DEAD — no reader/writer in any runtime |
| `gallery_items` | 1 (`packages/cms-core` index re-export) | Near-dead |
| `resume_versions` | references only in `cms-core`/`portfolio.ts` | Likely dead (personal-site era) |
| `portfolio_projects` | 3 (`cms-core`, `api-gateway/routes/portfolio.ts` + registry) | Route still mounted (`/portfolio`) but product-dead |
| `gift_card_accounts` / `gift_card_ledger_entries` | 1 (tenant registry only) | Suspect — gift-card money tables with mutable `balance numeric` and no RPC writer found |

`portfolio.ts` is still routed in `api-gateway/src/index.ts:738` (`api.route('/portfolio', portfolioRouter)`), so the personal-site/portfolio subsystem is **wired but product-abandoned** — a live-DB writer probe is the right gate (correctly deferred). **Live-DB writer/`pg_stat_user_tables` proof is out of scope** for this repository audit.

**Mutable-balance legacy (vs canonical append-only ledger):** Pre-canonical mutable money columns still present:
- `ai_credits.balance integer` (000:8152)
- `gift_card_accounts.balance numeric(12,2)` + `gift_card_ledger_entries.balance_after numeric(12,2)` (000:9361/9390) — has CHECK `>= 0` but is mutated in place, not append-only.
- `gift_cards.balance numeric(10,2)` (000:9438)
- `store_credit.balance_minor bigint` (153:39) — mutable balance column on a 2026 table.
- `wallet_ledger_entries.amount_minor` (119) — entries are append-ish but the *derived* wallet "available" is summed at read time in `refresh_money_ledger_site_reconciliation`, not stored as a mutable column (good). The canonical `ledger_*` is the only truly append-only-enforced store.

**DUPLICATE schema:**
- **`provider_payment_id` indexes (claim verified):** baseline has `idx_theme_purchases_provider_payment` on `theme_purchases(payment_provider, provider_payment_id)` (000:18969). `107` adds `idx_payment_transactions_provider_payment_global` on `payment_transactions(gateway, provider_payment_id)` (107:135). `142` then adds `payment_transactions_provider_payment_id_v1_uniq` on the **same** `payment_transactions(gateway, provider_payment_id)` partial predicate (142:148) — **this is the duplicate index**: `107`'s and `142`'s are functionally identical unique partial indexes on `payment_transactions(gateway, provider_payment_id) WHERE provider_payment_id IS NOT NULL AND deleted_at IS NULL`. `142` also adds `payments_provider_payment_id_uniq` on `payments(provider, provider_payment_id)` (different table, not a dup). The duplicate is acknowledged in `SKIPPED_HUMAN_DECISIONS.md:25` (`SKIP-D11-PROVIDER-PAYMENT-ID-INDEX-LIVE-DB`) — drop deferred to a live maintenance window. **Confirmed real duplicate; harmless correctness-wise, wastes write throughput.**
- **Wallet vs ledger (overlapping money stores):** `wallet_ledger_entries` (119) and `ledger_entries` (139) both record money movements at different abstraction levels; `dual_model_reconciliation_reports` + `money_ledger_site_reconciliations` exist precisely to reconcile the two. This is intentional dual-model, not accidental duplication — but it is **two parallel money systems** requiring continuous reconciliation (variance-asserting RPC), which is the project-wide "two parallel systems" anti-pattern manifesting in money.
- **Commission tables:** `commission_schedules`/`commission_reconciliation_entries` are not duplicated, but `162` zeroes them permanently (commission_bps=0), making the commission subsystem **schema-present, logically inert**.

**LEGACY (firebase-era):** Firebase remnants are quarantined under `docs/archive/firebase-legacy/` (`firebase.json`, `firestore.rules`, `firestore.indexes.json`, `storage.rules`, `functions/`) — **archive-only, not in the active schema or migration chain.** No Firestore tables in Postgres. `docs/archive/migrations-history/` holds 72 pre-baseline `.sql` files (001–~072) collapsed into `000_baseline.sql` — historical, not applied.

**Cloudflare D1 (`database/cloudflare/d1/migrations/0001_provider_execution_foundation.sql`):** This is **Cloudflare D1 (SQLite)**, not commerce data. Tables: `provider_execution_evidence`, `d1_migration_lineage`, `replay_restoration_lineage`, `rollback_lineage` — operational **deploy/provider-execution audit trail** (command hashes, exit codes, migration checksums, rollback version IDs). SQLite dialect (`strftime`, `INTEGER CHECK IN (0,1)` booleans, `TEXT` ids). Single migration, tracked. No tenant/money data. Referenced by `services/*/runtime.manifest.json` (D1 binding). Not part of the Postgres tenant surface.

---

## 7. Dangerous Migrations

1. **`162_phase_a_commission_zero` (untracked):** Issues bare `UPDATE public.commission_reconciliation_entries SET commission_bps=0, commission_amount_minor=0, gst_amount_minor=0, net_payable_minor=gross_amount_minor` on historical rows (162:14–22) — **mutates financial history in place with no ledger/audit entry**. For a system whose whole premise is an append-only canonical ledger, silently rewriting settled commission rows is a governance/audit contradiction. Also alters column DEFAULTs to 0 permanently.
2. **`163_d2_live_data_leak_rls` (untracked):** Net-positive (closes leaks) but contains broad `REVOKE INSERT,UPDATE,DELETE ON <11 tables> FROM PUBLIC, anon, authenticated` and `GRANT ALL ... TO service_role` (163:202–231). Correct direction, but its absence from HEAD means the leak it fixes is **still open in any deployed-from-HEAD environment**.
3. **`165_d5_canonical_money_paths` (untracked):** `REVOKE UPDATE, DELETE ON ledger_transactions/ledger_entries FROM PUBLIC, anon, authenticated, service_role, app_tenant` (165:463–464) — good immutability, but untracked. Its `post_settlement_ledger_transaction` is the function that **rejects caller-supplied `site_id`** — the single most important money-safety fix, and it is not committed.
4. **`131_hot_table_partition_shadow_mirror`:** Executes dynamic `DELETE FROM public.%I` and `INSERT INTO public.%I SELECT ($1).*` (131:35/44/50) driven by `retention_policies` rows — data-moving DML in a migration. Partition retention is legitimate, but destructive DML gated on a config table is a replay hazard if `retention_policies` content differs between environments.
5. **Reconciliation auto-plug check:** `refresh_money_ledger_site_reconciliation` (160:198) computes variance and **records** a `mismatch` row rather than auto-plugging — and `assert_money_ledger_site_reconciliation` **raises** on variance ≠ 0. This is the *correct* (non-auto-plug) behavior. No auto-plug found in the canonical path. (Earlier audits flagged auto-plug elsewhere; in the canonical 160 path it is fail-loud, not auto-balance.)
6. **No `DROP TABLE`/`DROP SCHEMA`/`TRUNCATE`/`DROP COLUMN`/`RENAME` anywhere** — confirmed by `migration-safety-validator` forbidden-pattern scan and independent grep. The chain is non-destructive by construction. The danger is the *inverse*: dead tables accumulate forever.

---

## 8. Unapplied / Uncommitted Risk

**The runner:** `scripts/supabase/run-migrations.mjs` calls `pnpm exec supabase db push --project-ref <ref>`; `config/supabase/{staging,production}.json` are **placeholder-only** (`PRODUCTION_PROJECT_REF_PLACEHOLDER`) and the runner throws if the ref still says PLACEHOLDER — so **migrations have never been applied to a real project from this config** (or the real config lives in CI secrets). The production CI path (`.github/workflows/production-deploy.yml:254`) runs `supabase db push --db-url <secret> --include-all`. `--include-all` applies every file in `database/supabase/migrations/` ordered by filename.

**Deployment risk of the untracked 162–166:**
- `supabase db push` operates on the **working-tree files**, so a CI checkout of HEAD `c4fc3cd6` (clean) would push **only 000–161** and **silently omit 162–166**. The four CRITICAL fixes (commission-zero, live-data-leak RLS, app_tenant GUC, canonical money paths) and the checkout authority (166) **would not deploy**. Their effect exists only on this one dirty working tree.
- **`migration-safety-validator.mjs` is blind to them:** it iterates `getTrackedFiles()` (line 28), and untracked files are not tracked — so the safety gate **cannot see 162–166 at all**. They could contain any hazard and pass CI.
- The `rls-force-coverage-validator` *does* `readFile("database/supabase/migrations/164_d4_tenant_role_guc.sql")` directly (line 11) and asserts on its contents — so it reads the untracked file from disk and passes **on the local dirty tree**, but in clean CI that `readFile` would throw (file absent) → the validator would **fail/error in a clean checkout**. This is a hidden coupling: the governance suite currently depends on an uncommitted file existing on disk.

**Numbering collision:** two `129_*` files (§3). `--include-all` sorts by full filename so both apply, but any tool keying on the numeric prefix (or a future `129_*` addition) is ambiguous.

**Rollback coverage:** rollbacks exist only for `139–161` (and the untracked `162–166`). **073–138, 140, 157 (68 migrations) have no rollback pair.** The repo's stated strategy is `strategy: forward-fix-preferred` (in `infrastructure/deployment/migration-orchestration.yaml`), so this is by policy, not omission — but it means there is **no scripted reverse path** for the entire app-marketplace + mobile-V2 + internal-OS body of work, only forward-fix.

---

## 9. Validator Runs (raw output)

```
$ node scripts/validators/no-public-using-true-validator.mjs
No public USING true validator passed (public USING true policies checked).

$ node scripts/validators/rls-force-coverage-validator.mjs
RLS FORCE coverage validator passed (RLS FORCE coverage ratchet checked).
   [NOTE: reads untracked 164_d4_tenant_role_guc.sql from disk — passes on dirty tree;
    would error in a clean HEAD checkout where that file is absent.]

$ node scripts/validators/migration-safety-validator.mjs
Migration safety validator passed (Supabase migration history checked for destructive replay hazards).
   [NOTE: scans getTrackedFiles() only — 162–166 are invisible to it.]

$ node scripts/validators/commission-bps-zero-validator.mjs
Commission bps zero validator passed (commission_bps remains zero in active defaults).
```

All four PASS, but two carry the caveats noted inline: the FORCE-coverage validator's pass is **contingent on the untracked 164 existing on disk**, and the safety validator **structurally cannot inspect** the highest-risk untracked migrations.

---

## 10. Tenant Registry Cross-Check

`services/api-gateway/src/tenant/tenant-tables.registry.ts` — **GENERATED 2026-06-10T10:52:34Z**, 261 entries (confirmed `261` occurrences of `"table":`). Scope-column distribution: **192 `site_id`, 68 `store_id`, 1 `null` (`sites` itself, the tenant root)**. **260 of 261 are `site_id`/`store_id`-scoped**, i.e. exactly the columns `164`'s dynamic loop targets — so the registry and the `164` GUC coverage are consistent. The registry is git-tracked and regenerated by `scripts/generators/generate-tenant-table-registry.mjs`.

**261 registry entries vs 419 schema tables:** the 158-table gap is tables **without** a tenant scope column (global/reference tables: `plans`, `employee_roles`, `employee_permissions`, `hsn_rates`, `super_admin_allowlist`, partition children, lineage tables, etc.) — correctly excluded from tenant scoping. **No drift detected** between the claimed 261 and the schema's tenant-scoped table count. The "261 tenant tables" claim is accurate as *tenant-scoped tables*, not as *total tables*.

---

## 11. Unknowns / UNVERIFIED (live-DB seams explicitly out of scope)

1. **Live RLS reality** — whether the deployed DB actually has the policies/grants the chain *would* produce. Requires live `pg_policies`, `information_schema.role_table_grants`, `pg_class.relforcerowsecurity`. **Out of scope** (no live DB).
2. **Whether 162–166 are applied to staging/production** — they're untracked locally; they may already be applied out-of-band, or may be missing live. The repo cannot tell. (`SKIPPED_HUMAN_DECISIONS.md` tracks the live seams.)
3. **Dead-table writer proof** — `portfolio_projects`/`resume_versions`/`gallery_items`/`skill_endorsements`/`gift_card_accounts` writer/reader activity. `SKIP-D11-PRODUCT-DEAD-TABLE-WRITER-PROBE` defers to live `pg_stat_user_tables`. **Out of scope.**
4. **Duplicate `provider_payment_id` index** — which physical index is redundant and safe to drop needs live `pg_indexes` + query-plan proof (`SKIP-D11-PROVIDER-PAYMENT-ID-INDEX-LIVE-DB`). Static analysis confirms `107` and `142` create functionally identical indexes on `payment_transactions(gateway, provider_payment_id)`; live confirmation **out of scope**.
5. **Residual PUBLIC `service_role_*` policies** (`gift_cards`, `pages`, `collections`, `onboarding_attempts`, `ai_usage`, `auth_password_set_intents`) — whether table-level GRANTs make them anon-reachable at runtime. Needs live grant inspection. **UNVERIFIED.**
6. **Gateway role-switch** — whether the API actually executes `SET LOCAL ROLE app_tenant` + `SET LOCAL app.site_id`, which is what makes `164` load-bearing. That's a gateway-code question (different axis), not schema.
7. **Dynamic-policy completeness** — 11 migrations build policies inside `DO/EXECUTE format` blocks; I verified 139/151/164 by reading them, but `091/102/142/143/144/145/152/153` dynamic blocks were not each fully traced. Believed consistent (same idiom) but **not exhaustively verified**.
8. **Whether `supabase db push` from clean HEAD silently drops 162–166** is inferred from `--include-all` semantics + `git status`; not executed against a real project (no live DB/CI run available).

---

*Holds-at: every finding above is evaluated against the working tree (where 162–166 exist). Findings that change between HEAD and the working tree are flagged "untracked" / "would not deploy from clean HEAD." Nothing here required or used live database access.*
