# PHASE 7 — DATABASE FORENSIC AUDIT

**Repo:** `Letbuyy_Store` | **Audit date:** 2026-06-10
**Auditor:** Principal database forensic audit (Postgres/Supabase), code-only working-tree analysis
**Scope:** `database/supabase/{migrations,rollback,seeds,verification,scripts}`, `database/cloudflare/d1`, all other repo SQL, schema-vs-code spot checks across `apps/`, `services/`, `packages/`, `.github/workflows/`
**Baseline constitution:** `LETBUYY_EXECUTABLE_ARCHITECTURE_V1.md` §7–§8 (one transactional Postgres; RLS ENABLE+FORCE + tenant GUC on every tenant table; migrations continue from 138 with paired rollbacks; partitioning deferred behind the 131 seam; single-writer table ownership; append-only ledger enforced at DB layer; unique `provider_payment_id`; normalize `store_id`/`site_id` and `users`/`users_custom` (TD-7))

### Methodology

1. Full census of all 91 migration files (43,519 lines of SQL; `000_baseline.sql` alone is 28,072 lines, a pg_dump 17.6 snapshot) plus 21 rollback files, 3 seed files, 19 verification files, 1 D1 migration, and 72 archived migrations under `docs/archive/migrations-history/`.
2. Programmatic parsing (CREATE TABLE / FK / index / RLS / policy / trigger / function extraction) cross-checked by manual reads of every money-bearing migration.
3. Orphan analysis: every created table name grepped across `apps/`, `services/`, `packages/` (`*.ts,*.tsx,*.js,*.mjs,*.dart,*.sql,*.json`, node_modules excluded).
4. Prior-audit hypotheses (FOUNDATION_FORENSICS_2026_06_09: payout double-release, refund-not-ledgered, reconciliation auto-plug, mutable-balance-as-truth) re-verified against the current working tree and marked FIXED / PARTIAL / OPEN.
5. Everything below cites `file:line`. Claims that depend on live database state (not provable from code) are explicitly marked **UNVERIFIED**.

---

## 1. Executive Verdict

**The schema is two databases wearing one connection string.** A modern, constitution-compliant kernel (migrations 139–161: bigint-minor money, enforced append-only double-entry ledger, FORCE RLS + tenant-GUC, idempotency and dedupe uniques) has been welded onto a legacy 237-table baseline that still violates every one of those rules (numeric(12,2) rupee-major money, mutable balances, ENABLE-only RLS satisfied by `USING (true)` service-role policies, dual tenant keys, JSONB+relational dual models). The two regimes are bridged by sync triggers, shadow `_bigint` columns, compatibility tables, and "with_ledger"-named functions that do not actually write to the ledger.

Three of the four prior money P0s are materially improved on the current tree: **payout double-release is FIXED** (`claim_payout_statement_release`, 160:357–421, wired at `payouts.ts:559`), **reconciliation auto-plug is NOT PRESENT** (settlement ingest withholds ledger posting and records `recon_breaks` instead — `settlements.ts:208–283`), and **mutable-balance-as-truth is PARTIALLY FIXED** (payout release now checks the canonical ledger balance; gift-card and store-credit balances remain mutable truth). **Refund-not-ledgered remains OPEN on the legacy storefront/returns path** (`complete_order_refund`, baseline:1039–1208, touches no ledger table).

The single most corrosive fact: the repo itself documents that **the api-gateway connects as `service_role`, which BYPASSES RLS** (107:17–19). Every tenant-GUC policy, every FORCE RLS statement in the new kernel is therefore decorative on the primary write path. Tenant isolation is application discipline, not a database property.

The migration chain is **not replayable**: migration 142 references `public.customers(id)` (142:28), a table no migration in the chain creates (only `store_customers` exists, baseline:12175) — proof that the live database contains out-of-band schema. CI never replays migrations against a fresh database and never executes the verification SQL (it only string-matches the files), so none of this would ever be caught.

**Composite database verdict: 2.4/5 — sound new kernel, unreconciled legacy mass, decorative tenancy enforcement, unreplayable lineage.**

---

## 2. Migration Census & Anomaly Register

### 2.1 Counts

| Metric | Value | Evidence |
|---|---|---|
| Migration files in `database/supabase/migrations/` | **91** | `ls \| wc -l` |
| Numbered range | `000_baseline` + `073`–`161` | directory listing |
| **Current max migration** | **161** (`161_foundation_session_security.sql`) | directory listing |
| Migrations beyond V1's "live max 137 (2026-06-08)" | **24** (138–161, incl. duplicate 129 counted once) | directory listing |
| Total SQL lines (migrations dir) | 43,519 (`000_baseline.sql` = 28,072) | `wc -l` |
| Archived pre-baseline migrations | 72 (`001`–`072`) in `docs/archive/migrations-history/` | directory listing |
| Rollback files | 21 | `database/supabase/rollback/` |
| Distinct tables created across migrations | **419** | parser + grep cross-check |
| CREATE TABLE statements | 424 (172 `IF NOT EXISTS`, 252 bare) | grep counts |
| Functions defined | 149 (108 = 72% `SECURITY DEFINER`) | parser |
| Trigger attach statements | 191+ (plus DO-loop attachments) | parser |
| `REVOKE` statements in entire migration corpus | **0** | `grep -ln REVOKE` → no files |

### 2.2 Anomaly register

| # | Anomaly | Evidence | Assessment |
|---|---|---|---|
| A-1 | **Duplicate migration number 129** — `129_internal_os_executive_analytics_rollups.sql` and `129_mobile_customer_segments.sql` both exist. Two teams (internal-OS track, mobile track) forked the sequence. | directory listing | Supabase CLI versions migrations by numeric prefix; duplicate prefixes risk one file being skipped or version-collision on `db push`. **UNVERIFIED** how live applied both. |
| A-2 | **Gap 001–072**: consolidated into `000_baseline.sql` (pg_dump snapshot, header at 000:1–18), originals archived under `docs/archive/migrations-history/` (001–072 present). | baseline header; archive listing | Acceptable re-baselining, but the 28k-line dump hides 72 migrations of churn from review tooling. |
| A-3 | **Baseline is not a clean state@072 snapshot.** Baseline contains `site_preview_links`, `site_gate_attempts`, `site_domain_reviews`, `domain_orders` (baseline:12024, 12046, 12062, 12085) — the exact four tables that `090_custom_domains_and_store_access.sql:38,80,114,157` re-creates with `IF NOT EXISTS`. So the baseline snapshot was taken from a DB that had *already applied a future migration (090)*, but 090 is still kept as a forward file. The baseline is a point-in-time dump of a drifted production DB, not a deterministic state@072. | baseline vs 090 | Lineage is non-deterministic; replaying from 000 yields a different schema than production. |
| A-4 | **`store_metafield_*` and `customer_segments` etc. are post-137 forward migrations, but `site_preview_links` (a "future" object) sits in the baseline.** Confirms the baseline absorbed work past its nominal cut. | baseline:12024; 090:38 | Same root cause as A-3. |
| A-5 | **252 of 424 `CREATE TABLE` are bare (no `IF NOT EXISTS`)** — almost all inside `000_baseline.sql`. A bare `CREATE TABLE` aborts on replay if the object exists. Combined with A-3 drift, a fresh `db push --include-all` of the whole chain is not guaranteed to succeed. | grep counts | Replay fragility. |
| A-6 | **Duplicate `provider_payment_id` unique index defined twice** — `payment_transactions_provider_payment_id_v1_uniq` (142:148) and `idx_payment_transactions_provider_payment_global` (107:135) are the same `(gateway, provider_payment_id) WHERE provider_payment_id IS NOT NULL AND deleted_at IS NULL` predicate under two names. Harmless redundancy but signals two authors solving the same control independently. | 107:135; 142:148 | Cosmetic; flags coordination gap. |
| A-7 | **`orders.store_id` is SET NOT NULL twice** (108:50 and 130:54), and 130 additionally sets `site_id` NOT NULL (130:55). Re-running 108 after 130 is a no-op, but the two migrations encode contradictory "canonical key" comments (108 says store_id canonical; 130 reaffirms store_id but forces site_id to mirror). | 108:50; 130:54–55 | State-machine of the tenant key spans 3 migrations (108/130/158); see Duplicate-schema register. |
| A-8 | **No-op / report-only migration:** `085_orders_items_reconcile.sql` and `086_products_variants_reconcile.sql` create `dual_model_reconciliation_reports` and report functions but do not converge the JSONB↔relational dual model (085:1–2 explicitly: "The JSONB column stays for rollback/compatibility"). The dual model is permanent, not transitional. | 085:1–2 | Tech-debt frozen as architecture. |

---

## 3. Rollback-Pairing Audit

### 3.1 Coverage

V1 §7 requires **every** migration to ship a paired rollback. Reality:

| Bucket | Count | Detail |
|---|---|---|
| Forward migrations (excl. `000_baseline`) | 90 | `073`–`161` incl. dup-129 |
| Forward migrations **with** a rollback file | **20** | `139,141,142,143,144,145,146,147,148,149,150,151,152,153,154,155,156,158,159,160,161` (note: 21 rollback files, but `140` and `157` have none — see below) |
| Forward migrations **without** any rollback | **70** | every `073`–`138`, plus `140`, plus `157` |
| **Rollback-pairing rate (whole chain)** | **~22%** (20/90) | — |
| **Rollback-pairing rate (post-138 "executable" era only)** | **20/23 ≈ 87%** | only `140_mobile_cod_reconciliation`, `157_product_metadata`, and dup-`138` lack pairs |

**Verdict: rollback pairing is satisfied only for the new "executable foundation" era (139–161, minus 140/157). The entire legacy/mobile/internal-OS body (073–138, ~65 migrations) ships zero rollbacks.** V1's "every migration ships a paired rollback" is false for 78% of the chain.

Specific post-138 gaps (these are the in-era violations that matter most):
- `140_mobile_cod_reconciliation.sql` — **NO ROLLBACK.** Alters `wallet_ledger_entries` CHECK constraint and creates `cod_reconciliation_entries`; an unpaired money-table migration.
- `157_product_metadata.sql` — **NO ROLLBACK.** Adds `products.metadata` + GIN index + CHECK; trivially reversible but unpaired.

### 3.2 Semantic diff of rollback pairs (sampled 15)

Rollback files self-describe as "local rollback proof … intentionally outside replayable migrations" (139.rollback:1–3). I diffed forward vs rollback semantics:

| Pair | Forward creates | Rollback drops | Reverses correctly? | Note |
|---|---|---|---|---|
| 139 | ledger_accounts/transactions/entries, compensation_actions, outbox_consumptions, 5 functions, 7 triggers, GUC helpers, outbox.published_at | all of the above in dependency order | **YES (complete)** | Drops `current_site_id()`/`set_current_site_id()` — these are depended on by *every later* tenant-GUC policy; rolling back 139 alone breaks 141–161 policies. Ordering hazard, not a content gap. |
| 141 | inventory_reservations/locations + FORCE RLS + version trigger | NO FORCE + drops policies/objects | YES | — |
| 142 | payments, payment_credentials, payment_tokens, 2 unique provider indexes, constraint swaps | drops tables/indexes, **restores prior CHECK constraints** (142.rb:38–76) | **YES (exemplary)** — even re-adds the pre-142 `payment_attempts`/`payment_transactions` CHECK enumerations | Best rollback in the repo. |
| 143 | discount_allocations + coupons columns | drops table + `DROP COLUMN allocation_method,priority,automatic,combines_with,discount_class` | YES | — |
| 144 | gst_invoices, hsn_rates, tax_overrides, tax_registrations | symmetric drops | YES | — |
| 145 | shipping_profiles, shipping_serviceability_rules | symmetric | YES | — |
| 146 | store_branding + checkout_sessions CHECK/column swaps | drops + restores prior CHECK | YES | — |
| 147 | order_risk_assessments, cod_confirmation_requests | symmetric | YES | — |
| 148 | notification_logs, notification_suppressions | symmetric | YES | — |
| 149 | email_suppressions, sender_domains | symmetric | YES | — |
| 150 | wa_optins/sessions/templates, whatsapp_messages | symmetric | YES | — |
| 151 | settlements, reserves, payouts, payout_items, recon_breaks, `post_settlement_ledger_transaction`, canonical-ledger FK columns on 3 compat tables | drops tables/triggers/policies | **PARTIAL** — drops the 5 tables but the `ADD COLUMN canonical_ledger_transaction_id` on `payout_statements`/`wallet_ledger_entries`/`commission_reconciliation_entries` (151:38–46) are **not** dropped by 151.rollback (file is 72 lines, ends after table drops). Forward-only column residue. | See DB-014. |
| 153 | consents, store_credit, store_credit_ledger_entries, step_up_challenges, sensitive_action_approvals, customer_dsr_exports | symmetric drops | YES | — |
| 155 | RLS/FORCE + 4 indexes on existing analytics tables (additive, creates no table) | `NO FORCE` + drop indexes/policies | **YES**, but leaves `ENABLE ROW LEVEL SECURITY` on (155.rb only issues `NO FORCE`, not `DISABLE`) — minor asymmetry | acceptable |
| 160 | payments ledger-FK columns + `refunded_amount_minor`, payout_statements `_bigint` columns, sync triggers/functions, money_ledger_site_reconciliations, claim/assert/refresh/backfill functions | drops columns, table, restores `mode/provider_mode DEFAULT 'mock'` (160.rb:53–62) | **PARTIAL** — drops the *bigint shadow columns it added* but the historical `UPDATE … SET …_bigint = …::bigint` backfills (160:147–171) are irreversible data writes; structurally reverses, data already mutated. | acceptable for additive shadow |

**Rollback-pairing summary:** content quality of the *existing* rollbacks is high (142/146 even restore prior CHECK enumerations). Two pairs (151, 160) leave forward-only `ADD COLUMN` residue. The dominant defect is **coverage**, not correctness.

---

## 4. Table Inventory (Appendix A — complete origin map)

419 distinct tables. RLS-FORCE confirmed on **76** of them (the new-kernel + executable-era tables). The remaining **343 tables have `ENABLE ROW LEVEL SECURITY` but NOT `FORCE`** — meaning the table owner / any `BYPASSRLS` role (incl. `service_role`, used by the gateway per 107:17) is not subject to policies. Full origin map below (grouped by the migration that first creates each table).

> Legend: tables in **76-FORCE set** are marked ✅FORCE. All others are ENABLE-only.

**`000_baseline.sql` — 237 tables** (legacy core; ENABLE-only unless later FORCE'd):
ai_credits, ai_usage, analytics_event_stream✅, analytics_events, analytics_rollups_daily✅, app_billing_charges, app_categories, app_developers, app_extensions, app_installations, app_reviews, app_webhooks, audit_activity_events, audit_logs, billing_history✅, blog_categories, blog_comments, blog_post_tags, blog_posts, blog_tags, cache_invalidation_events, cache_operation_snapshots, carts✅, certifications, chaos_experiment_runs, checkout_sessions✅, collection_products, collections, contact_submissions, contacts, coordination_operation_diagnostics, coupons✅, customer_activity_log, customer_addresses✅, customer_credentials✅, customer_wishlists✅, database_operation_snapshots, deployment_health_gate_results, deployment_promotion_runs, device_tokens, devices, distributed_event_store, distributed_event_streams, distributed_queue_heartbeats, distributed_queue_messages, domain_orders, education, email_logs✅, employee_invites, employee_permissions, employee_roles, employees, event_store_integrity_checks, event_stream_snapshots, execution_audit_trail, failover_drill_runs, form_submissions, fulfillment_order_lines, fulfillment_orders✅, gallery_items, gift_card_accounts, gift_card_ledger_entries, gift_card_redemptions, gift_cards, idempotency_keys, inventory_adjustments, inventory_events, inventory_level_duplicate_snapshots, inventory_levels✅, inventory_locations✅, inventory_reservations✅, inventory_transfer_lines, inventory_transfer_receipts, inventory_transfers, lead_forms, leads, load_test_runs, marketplace_apps, marketplace_review_records, media, media_assets✅, navigation_menu_items, navigation_menus, notification_preferences✅, notifications, onboarding_attempts, operation_metrics, operational_certification_reports, operational_dashboard_snapshots, operational_feature_flag_audit_events, operational_feature_flag_exposures, operational_feature_flags, order_items, order_line_adjustments, order_shipping_lines, order_tax_lines, orders✅, outbox_dead_letters, outbox_events, pages, partner_payout_ledger_entries, payment_attempts✅, payment_transactions✅, payment_webhook_events, plan_entitlements, plans, platform_queue_jobs, portfolio_projects, product_options, product_reviews, product_variants, production_db_rollout_plans, production_incident_events, production_incidents, production_readiness_gate_runs, products, projection_checkpoints, projection_operation_snapshots, projection_rebuilds, projection_store, projects, promotion_codes, promotion_effects, promotion_redemptions, promotion_rules, promotion_usage_counters, promotions, provider_health_snapshots, provider_outage_events, provider_recovery_plans, purchase_order_lines, purchase_order_receipts, purchase_orders, query_snapshots, queue_operation_snapshots, queue_recovery_operations, refund_attempts, refund_lines, refund_transactions, refunds, regional_execution_diagnostics, regional_routing_overrides, replay_dry_run_results, replay_operation_schedules, restock_events, resume_versions, return_lines, return_requests, returns✅, rollout_stage_evidence, runtime_alert_evaluations, runtime_checkpoints, runtime_command_journal, runtime_control_commands, runtime_deployment_topology_records, runtime_diagnostics, runtime_event_retention_policies, runtime_health_projections, runtime_leases, runtime_replay_executions, runtime_secret_rotation_events, runtime_slo_definitions, runtime_structured_logs, runtime_telemetry_metrics, runtime_telemetry_spans, sandbox_provider_contracts, search_documents, security_enforcement_events, sessions, shadow_traffic_comparison_runs, shipment_events, shipments, shipping_rates✅, shipping_zones✅, site_api_clients, site_domain_reviews, site_entitlement_overrides, site_gate_attempts, site_memberships, site_preview_links, site_role_permissions, site_roles, site_usage_meters, sites, skill_endorsements, skills, smart_collections, store_customers✅, store_surveys, store_themes, storefront_cache_tags, storefront_page_revisions, storefront_pages, storefront_policies, storefront_slug_redirects, subscriptions✅, super_admin_allowlist, suppliers, tax_rates, tenant_execution_quotas, tenant_operation_projections, testimonials, theme_assets, theme_block_definitions, theme_draft_patches, theme_editor_drafts, theme_instance_drafts, theme_instances, theme_layouts, theme_migrations, theme_package_versions, theme_packages, theme_presets, theme_preview_sessions, theme_purchases, theme_releases, theme_renderer_manifests, theme_reviews, theme_schema_manifests, theme_template_assignments, theme_templates, themes, usage_meter_entries, user_profiles, users, users_custom, verification_tokens, webhook_deliveries✅, webhook_subscriptions✅, wishlists✅, work_experience, worker_request_logs, workflow_heartbeats, workflow_lifecycle, workflow_operation_snapshots.

**Post-baseline forward migrations (table → first-creating migration):**

| Migration | Tables created |
|---|---|
| 076_app_extension_registry | app_extension_registrations, app_function_registrations |
| 078_password_set_intents | auth_password_set_intents |
| 079_partition_worker_request_logs | partition_lifecycle_partitions, retention_policies, worker_request_logs_partitioned, worker_request_logs_partitioned_default |
| 080_partition_runtime_telemetry_metrics | runtime_telemetry_metrics_partitioned(+_default) |
| 081_partition_outbox_events | outbox_events_partitioned(+_default) |
| 082_partition_platform_queue_jobs | platform_queue_jobs_partitioned(+_default) |
| 083_partition_webhook_deliveries | webhook_deliveries_partitioned(+_default) |
| 085_orders_items_reconcile | dual_model_reconciliation_reports |
| 091_theme_marketplace_stepup | developer_profiles, theme_collections, theme_collection_items, theme_saved_searches, theme_download_artifacts, theme_purchase_receipts, theme_refund_requests, theme_reports, theme_marketplace_settings, theme_developer_listings, theme_developer_payout_accounts |
| 093 | app_pricing_plans |
| 095 | app_usage_events, app_usage_meter_rollups |
| 096 | app_spend_controls |
| 097 | app_uninstall_feedback |
| 098 | app_versions |
| 100 | app_collections, app_collection_items, app_featured_placements, app_discovery_events |
| 101 | app_review_policies, app_review_reports, app_listing_reports, app_built_for_letbuyy_checks, app_activity_events |
| 102 | app_partner_analytics_daily, app_api_usage_metrics, app_collaborator_codes, app_partner_agency_seats, app_partner_tiers, app_sandbox_stores, app_demo_sessions, app_telemetry_events |
| 103 | app_api_quotas |
| 106 | app_bundles, app_bundle_items, app_requests, app_review_proofs, app_saved_apps |
| 112 | app_awards, app_collection_sections, app_feature_groups, app_feature_tags, app_feature_tag_assignments, app_review_summaries |
| 113 | access_review_records, break_glass_grants |
| 116 | draft_orders, draft_order_lines |
| 117 | customer_notes, customer_tags |
| 118 | shipping_labels |
| 119 | payout_statements, wallet_ledger_entries, commission_schedules, commission_reconciliation_entries✅ |
| 120 | merchant_kyc_documents |
| 121 | merchant_2fa_factors |
| 124 | risk_rules, risk_signals, risk_scores, risk_action_events, chargeback_events, velocity_counters |
| 125 | ts_cases, ts_case_events, ts_evidence, ts_appeals, ts_policies, ts_takedowns |
| 126 | impersonation_sessions |
| 127 | support_tickets, ticket_messages, ticket_macros, ticket_csat, ticket_sla_clocks |
| 128 | review_check_runs |
| 129_internal_os_executive_analytics_rollups | metric_rollups, mrr_arr_rollups, cohort_snapshots, funnel_steps |
| 129_mobile_customer_segments | customer_segments |
| 132 | customer_whatsapp_messages |
| 133 | incident_postmortems, oncall_schedules |
| 134 | payout_reconciliation_records, payout_disputes |
| 135 | data_subject_requests, audit_export_cursors |
| 136 | marketing_email_campaigns, marketing_email_recipients |
| 137 | storefront_locales, storefront_translations, store_markets |
| 138 | store_metafield_definitions, store_metafield_values |
| 139 | ledger_accounts✅, ledger_transactions✅, ledger_entries✅, compensation_actions✅, outbox_consumptions✅ |
| 140 | cod_reconciliation_entries |
| 142 | payments✅, payment_credentials✅, payment_tokens✅ |
| 143 | discount_allocations✅ |
| 144 | gst_invoices✅, hsn_rates✅, tax_overrides✅, tax_registrations✅ |
| 145 | shipping_profiles✅, shipping_serviceability_rules✅ |
| 146 | store_branding✅ |
| 147 | order_risk_assessments✅, cod_confirmation_requests✅ |
| 148 | notification_logs✅, notification_suppressions✅ |
| 149 | email_suppressions✅, sender_domains✅ |
| 150 | wa_optins✅, wa_sessions✅, wa_templates✅, whatsapp_messages✅ |
| 151 | settlements✅, reserves✅, payouts✅, payout_items✅, recon_breaks✅ |
| 152 | billing_mandates✅, billing_usage_events✅, billing_dunning_events✅, merchant_billing_invoices✅ |
| 153 | consents✅, store_credit✅, store_credit_ledger_entries✅, step_up_challenges✅, sensitive_action_approvals✅, customer_dsr_exports✅ |
| 154 | ai_capability_seams✅ |
| 159_identity_foundation_core | principals, credentials, authenticators, recovery_codes, sessions_v2, refresh_tokens, refresh_chains, oauth_clients, oauth_grants, authorization_codes, signing_keys, federation_tokens, account_links, organizations, teams, org_memberships, team_memberships, store_memberships, org_store_links, ownership_transfers, delegations, invitations, security_events, audit_events |
| 160 | money_ledger_site_reconciliations |
| 161 | session_token_rotation_events |

---

## 5. Duplicate-Schema Register

| ID | Concept duplicated twice | Instance A | Instance B | Evidence | Verdict |
|---|---|---|---|---|---|
| DUP-1 | **Tenant key on `orders` (`store_id` vs `site_id`)** | `orders.store_id uuid` (canonical per 108) | `orders.site_id uuid` (compat mirror per 130) | baseline:10112,10139; 108:50; 130:54–55 | Both NOT NULL and forced equal by `sync_orders_tenant_keys` trigger (130:14–31) which raises if `site_id <> store_id`. Two columns that must always be identical = pure duplication kept "during transition" with no end date. **OPEN (TD-7).** |
| DUP-2 | **User identity (`users` vs `users_custom`)** | `users` (Supabase-auth shadow: display_name, subscription_tier — baseline:13095) | `users_custom` (password_hash, email_verified — baseline:13116) | baseline:13095,13116 | Two user tables; `users_custom` is the credential store, `users` the profile. FKs across the schema point at `users_custom` (e.g. 091 `created_by REFERENCES users_custom`). **OPEN (TD-7).** |
| DUP-3 | **Sessions (`sessions` vs `sessions_v2`)** | legacy opaque `sessions` (baseline:11694; extended by 161) | `sessions_v2` (159:113, realm-scoped identity-platform session) | baseline:11694; 159:113; 161:7 | 161 explicitly states "the current sessions table remains authoritative" while 159 builds the v2 successor. Two live session models. `sessions_v2` referenced only by the identity-foundation repository boundary (registry + boundary doc), not the live auth path → successor is dormant. **OPEN.** |
| DUP-4 | **Money ledger (canonical `ledger_*` vs compat `wallet_ledger_entries` + `partner_payout_ledger_entries` + `gift_card_ledger_entries` + `store_credit_ledger_entries`)** | canonical double-entry `ledger_accounts/transactions/entries` (139) | 4 single-entry "ledger" tables with mutable balances | 139:75–142; 119:44; baseline:9355,10225; 153:54 | The 119/baseline single-entry tables are bridged into canonical via `canonical_ledger_transaction_id` FK (151:42–46) and a backfill (160:279–355). Two ledger paradigms coexist; the compat ones are the live write target on mobile money routes. **PARTIAL (bridged, not unified).** |
| DUP-5 | **Payment row (`payments` vs `payment_transactions`)** | new `payments` session model (142:43) | legacy `payment_transactions` capture record (baseline) | 142:43,80–82; baseline:1618 | 142 links them via `payment_transactions.payment_id` FK (142:81). Both carry `provider_payment_id` with separate unique indexes (142:144 vs 142:148). Capture path writes `payment_transactions` (baseline confirm RPC 1618); new capture API writes `payments` (payments.ts:262). Dual source of payment truth. **OPEN.** |
| DUP-6 | **Order line items (`orders.items` JSONB vs `order_items` relational)** | `orders.items jsonb NOT NULL` (baseline:10119) | `order_items` table (baseline) | baseline:10119; 085:1–2 | 085 declares `order_items` authoritative but keeps JSONB "for rollback/compatibility"; reconcile is report-only. Permanent dual model. **OPEN.** |
| DUP-7 | **Product variants (`products` JSONB vs `product_variants` relational)** | products embedded variants | `product_variants` table | 086 (mirror of 085) | Same pattern as DUP-6. **OPEN.** |
| DUP-8 | **Gift-card balance (`gift_card_accounts` vs `gift_cards`)** | `gift_card_accounts.balance numeric(12,2)` (baseline:9355) | `gift_cards.balance numeric(10,2)` (baseline:9433) | baseline:9361,9438 | Two gift-card balance stores at *different precisions* (12,2 vs 10,2). Code reads `gift_cards` (products.ts:829). **OPEN — precision mismatch is a money bug.** |
| DUP-9 | **Partitioned shadow tables (`*_partitioned` + `*_partitioned_default`)** | live `outbox_events`, `webhook_deliveries`, `platform_queue_jobs`, `runtime_telemetry_metrics`, `worker_request_logs` | their `_partitioned` shadows (079–083) | 079–083; 131 | Shadows are mirrors fed by trigger (131:9–56) ahead of a human-approved rename swap that has not happened. 8 shadow tables duplicate 5 live tables. Per V1 this is the *allowed* deferred-partition seam — but it is now *active mirroring* (131), doubling writes. **By design, but doubles write amplification.** |

---

## 6. Orphan-Table Register

Methodology: each of 419 table names grepped (`\bname\b`) across `apps/ services/ packages/` (ts/tsx/js/mjs/dart/sql/json; node_modules excluded). "0 code refs" = appears in no application code, only in migrations.

### 6.1 Zero-reference orphans (43 tables) — confidence HIGH that these are unused by any runtime

`app_built_for_letbuyy_checks`, `app_partner_analytics_daily`, `cache_operation_snapshots`, `collection_products`, `coordination_operation_diagnostics`, `database_operation_snapshots`, `distributed_queue_heartbeats`, `dual_model_reconciliation_reports`, `inventory_level_duplicate_snapshots`, `operational_feature_flag_audit_events`, `outbox_events_partitioned_default`, `partition_lifecycle_partitions`, `plan_entitlements`, `platform_queue_jobs_partitioned_default`, `production_db_rollout_plans`, `provider_health_snapshots`, `provider_outage_events`, `provider_recovery_plans`, `queue_recovery_operations`, `regional_execution_diagnostics`, `replay_dry_run_results`, `retention_policies`, `rollout_stage_evidence`, `runtime_deployment_topology_records`, `runtime_event_retention_policies`, `runtime_leases`*, `runtime_secret_rotation_events`, `runtime_telemetry_metrics_partitioned_default`, `runtime_telemetry_spans`, `sandbox_provider_contracts`, `session_token_rotation_events`*, `shadow_traffic_comparison_runs`, `skill_endorsements`, `theme_assets`, `theme_block_definitions`, `theme_layouts`, `theme_migrations`, `theme_presets`, `theme_section_definitions`, `theme_templates`, `webhook_deliveries_partitioned_default`, `worker_request_logs_partitioned_default`, `workflow_heartbeats`.

Caveats lowering confidence for a few:
- `runtime_leases`* — has a `claim_runtime_lease()` SQL function (baseline:886) and the name appears in `scripts/validators/distributed-runtime-validator.mjs:180`; written via RPC, table name not string-referenced in app code. **Likely used via RPC, not a true orphan.**
- `session_token_rotation_events`* — written by `validate_and_rotate_merchant_session()` (161) via the session-security path; RPC-mediated. **Likely used.**
- `*_partitioned_default` (4) — these are Postgres default-partition children; never referenced by name by design. **Structural, not orphans.**
- `theme_templates`, `theme_assets`, `theme_layouts`, `theme_presets`, `theme_block_definitions`, `theme_section_definitions` — the theme runtime uses `theme_instances`/`theme_packages`/`theme_renderer_manifests`; these 6 older theme tables appear dead (superseded theme model). **HIGH confidence orphan.**
- `collection_products` — superseded by `smart_collections`/`product_options`; the storefront uses `collections` + product joins. **HIGH confidence orphan.**
- `dual_model_reconciliation_reports`, `inventory_level_duplicate_snapshots` — diagnostic byproducts of 085/086/034; written by SQL report functions only. **Diagnostic, effectively orphan from app.**
- `plan_entitlements` — entitlement logic lives in `plans`/`site_entitlement_overrides`; this table is unreferenced. **HIGH confidence orphan.**
- The `provider_*`, `*_operation_snapshots`, `*_diagnostics`, `replay_*`, `rollout_*`, `shadow_traffic_*`, `failover`/`chaos`/`load_test` family — "operational theater" tables created by 059–065 lineage; written (if at all) by ops scripts, read by nothing in the product. **HIGH confidence orphan from product runtime.**

### 6.2 Write-only / read-only asymmetry (sampled)

- **Append-only ledger tables are write-then-read-via-function:** `ledger_entries`/`ledger_transactions` show 2 code refs each (the post/balance RPCs), never a direct `from('ledger_entries')` read — reads go through `ledger_account_balance_minor()`/`ledger_balance_breaks()` (160:173; 139:344). Correct pattern, not an orphan.
- **`inventory_level_duplicate_snapshots`** — written by an inventory reconcile job, never read by product code. Write-only diagnostic.
- **`audit_logs` / `audit_events`** — two audit tables; `audit_logs` (baseline, written by `log_audit_event()` trigger 4425) vs `audit_events` (159 identity-platform). Both write-mostly. The duplication itself is a finding (DB-024).

**Orphan headline: ~37 genuinely product-dead tables (excluding the 4 RPC-mediated + 4 partition-default false positives), i.e. ~9% of the 419-table surface is operational/theme/diagnostic dead weight.**

---

## 7. Missing-Index Register

Parser found **487 indexes across 251 tables**; **168 tables have zero indexes** defined in migrations (mostly small config/ops tables, acceptable). The material gaps are FK columns used in joins/filters without a leading index, and money-safety uniques. Audit-only columns (`created_by`/`updated_by`/`deleted_by REFERENCES users_custom`) dominate the raw "529 unindexed FK" count and are intentionally not indexed (never filtered on) — excluded below.

### 7.1 Hot-path FK / tenant columns lacking an index

| ID | Table | Column(s) | Why it matters | Evidence | Sev |
|---|---|---|---|---|---|
| MI-1 | `commission_reconciliation_entries` | `order_id`, `payout_statement_id`, `commission_schedule_id` | money reconciliation joins on order/payout; only `(site_id,order_id)` unique exists (119:153), no index on `payout_statement_id`/`commission_schedule_id` | 119:103–104 | S2 |
| MI-2 | `cod_reconciliation_entries` | `order_id` | joined to orders on every COD reconcile; covered by `(site_id,order_id)` unique (140:61) → OK actually. **Cleared.** | 140:61 | — |
| MI-3 | `payouts` | `settlement_id`, `payout_statement_id` | payout→settlement join unindexed (only `(site_id,status,created_at)` 151:206) | 151:114–115 | S2 |
| MI-4 | `payout_items` | `settlement_id` | indexed on `(site_id,payout_id)` only (151:210); settlement rollups scan | 151:151 | S3 |
| MI-5 | `reserves` | `settlement_id` | reserve→settlement join unindexed | 151:91 | S3 |
| MI-6 | `refund_transactions` (legacy) | `order_id`, `payment_transaction_id` | `complete_order_refund` filters `refund_transactions WHERE order_id=… AND site_id=…` (baseline:1090) — confirm index exists? Only generic indexes; FK columns on legacy refund tables not composite-indexed by tenant | baseline:1084–1093 | S2 |
| MI-7 | `commission_schedules` | (lookup by active window) | `(site_id,status,effective_from)` exists (119:149) → OK | 119:149 | — |
| MI-8 | `wallet_ledger_entries` | `payout_statement_id` | FK to payout_statements (119:47) unindexed; payout detail scans | 119:47 | S3 |
| MI-9 | partitioned parents `*_partitioned` | `site_id` FK added via ALTER (079–083) | partition FKs to sites; verify per-partition index. Parser flags `add` (ALTER artifact) — **UNVERIFIED**, likely indexed on partition key not site_id | 080:24; 082:37 | S3 |

### 7.2 Money-safety uniques — present vs missing

| Control (V1 requirement) | Present? | Evidence |
|---|---|---|
| **Unique `provider_payment_id` on payment rows (V1 §8)** | **PRESENT (twice)** — `payments (provider, provider_payment_id)` partial unique (142:144) AND `payment_transactions (gateway, provider_payment_id)` partial unique (142:148 + global 107:135) | 142:144,148; 107:135 |
| Webhook event dedupe | **PRESENT** — `payment_webhook_events (provider, provider_event_id)` UNIQUE (baseline:14680) | baseline:14680 |
| Outbox dedupe | **PRESENT** — `outbox_events (idempotency_key)` UNIQUE (baseline:14608) + `event_id` unique index (baseline:17769); `outbox_consumptions (consumer,event_id)` + `(consumer,idempotency_key)` (139:71–72) | baseline:14608,17769; 139:71 |
| Idempotency key uniqueness | **PRESENT** — `idempotency_keys (site_id, scope, key)` UNIQUE (baseline:14200); per-table `(site_id, idempotency_key)` on checkout_sessions/fulfillment_orders/settlements/payouts/etc. | baseline:14200; 151:84,144 |
| Ledger reversal uniqueness | **PRESENT** — `ledger_transactions (site_id, source_type, source_id, idempotency_key)` UNIQUE (139:122); `reversal_of` self-FK (139:114); entries `(transaction_id, sequence)` UNIQUE (139:141) | 139:122,141 |
| Settlement dedupe | **PRESENT** — `settlements (site_id, idempotency_key)` and `(site_id, provider, settlement_reference)` UNIQUE (151:84–85) | 151:84 |
| COD remittance dedupe | **PRESENT** — `cod_reconciliation_entries (site_id, collection_idempotency_key)` + `(…reconciliation_idempotency_key)` (140:65,69) | 140:65 |

**Money-uniqueness verdict: the new kernel's idempotency/dedupe lattice is comprehensive and correct.** The gaps are join-index ergonomics (MI-1/3/6), not safety uniques.

---

## 8. Money-Integrity Deep Dive

### 8.1 Append-only enforcement — PROVEN at DB layer (for canonical ledger only)

The canonical ledger is append-only **by trigger, not by convention**:

```sql
-- 139:163-170
CREATE OR REPLACE FUNCTION public.reject_ledger_mutation() RETURNS trigger ...
BEGIN
  RAISE EXCEPTION 'ledger is append-only; use reversing entries';
END;
-- 139:358-376 — attached to BOTH ledger_entries and ledger_transactions, UPDATE and DELETE:
CREATE TRIGGER ledger_entries_reject_update  BEFORE UPDATE ON public.ledger_entries     ... reject_ledger_mutation();
CREATE TRIGGER ledger_entries_reject_delete  BEFORE DELETE ON public.ledger_entries     ... reject_ledger_mutation();
CREATE TRIGGER ledger_transactions_reject_update BEFORE UPDATE ON public.ledger_transactions ... reject_ledger_mutation();
CREATE TRIGGER ledger_transactions_reject_delete BEFORE DELETE ON public.ledger_transactions ... reject_ledger_mutation();
```

Plus a **balance constraint trigger** (139:172–198, 378–382): `enforce_ledger_transaction_balance()` runs `AFTER INSERT … DEFERRABLE INITIALLY DEFERRED` and raises if `SUM(debit) - SUM(credit) <> 0` per transaction. The posting function `post_ledger_transaction` (139:223–342) double-checks `v_debits = v_credits` (139:336) before returning. **This is a correct, enforced, balanced, append-only double-entry ledger.** ✅

Caveats:
- Enforcement is **trigger-based, not `REVOKE UPDATE,DELETE`** — there are **zero `REVOKE` statements in the entire corpus** (§2.1). A `BYPASSRLS`/owner role can `ALTER TABLE … DISABLE TRIGGER` and then mutate. Since the gateway runs as `service_role` (107:17), and `service_role` is typically table owner in Supabase, **the append-only guarantee is one `DISABLE TRIGGER` away.** Defense-in-depth (`REVOKE UPDATE, DELETE … FROM service_role`) is absent. (DB-009)
- These protections apply **only to `ledger_entries`/`ledger_transactions`.** The four compat "ledger" tables (`wallet_ledger_entries`, `gift_card_ledger_entries`, `store_credit_ledger_entries`, `partner_payout_ledger_entries`) have **no reject trigger** — they are freely UPDATE/DELETE-able and `wallet_ledger_entries` even carries a `BEFORE UPDATE` sync trigger (160:137) that mutates rows. They are append-only by convention only. (DB-010)

### 8.2 Unique `provider_payment_id` — PRESENT ✅

Verified in §7.2. Both the legacy capture table (`payment_transactions`) and the new session table (`payments`) carry a partial unique on `(gateway/provider, provider_payment_id) WHERE provider_payment_id IS NOT NULL AND deleted_at IS NULL` (107:135, 142:144, 142:148). One captured provider payment id can confirm at most one order globally. **V1 §8 satisfied.**

### 8.3 Float-money register — NO floats; but a major-unit / minor-unit SPLIT

**No `real`/`double precision`/`float` money columns exist anywhere** (grep returned zero). However money is stored in **two incompatible representations** across the two regimes:

| Representation | Where | Risk |
|---|---|---|
| **`bigint` minor units (paise)** — V1-correct | All new-kernel tables: `ledger_entries.amount_minor` (139:132), `payments.amount_minor` (142:50), `settlements.*_minor` (151:57–62, all bigint), `store_credit.balance_minor` (153:39) | Correct. |
| **`integer` minor units (paise)** — 32-bit, overflow at ₹21,474,836.47 | `wallet_ledger_entries.amount_minor integer` (119:52), `payout_statements.{gross,platform_fee,tax,net}_amount_minor integer` (119:16–19), `commission_reconciliation_entries.*_minor integer` (119:107–112), `cod_reconciliation_entries.*_minor integer` (140:26–29), `partner_payout_ledger_entries.amount_minor integer` (baseline:10227) | **32-bit overflow** — a single payout/settlement above ~₹2.14 crore overflows. ~25 integer-minor money columns. Migration 160 adds `_bigint` shadow columns (160:28–40) + sync triggers to *mitigate* exactly this, but the original `integer` columns remain the constraint-checked ones and the API still reads them. (DB-002) |
| **`numeric(10–16, 2..4)` rupee-major** — legacy | `orders.{subtotal,total,…} numeric(12,2)` (109:7–13), `refunds.amount numeric(12,2)` (baseline:11123), `gift_card_accounts.balance numeric(12,2)` vs `gift_cards.balance numeric(10,2)` (baseline:9361/9438), `partner_payout_ledger_entries` *also* has `amount_inr numeric(10,2)` (091:127), `usage_meter_entries.amount numeric(16,4)` (baseline:13057) | Mixing rupee-major `numeric` with paise-minor `bigint`/`integer` across tables that feed the same flows. Conversion happens in app code / sync triggers (`::bigint` casts, 160:101). Any missed cast is a 100× money error. (DB-003) |

`numeric(16,4)` on `usage_meter_entries.amount` (baseline:13057) is a *fourth* scale — billing usage in ten-thousandths. Four money representations across one schema.

### 8.4 Mutable-balance-as-truth — PARTIALLY FIXED

| Balance store | Mutable? | Is it source of truth? | Evidence | Verdict |
|---|---|---|---|---|
| Canonical merchant payable | No (derived) | Yes — `ledger_account_balance_minor(site,'merchant_payable')` sums entries (160:173–196) | 160:173 | FIXED — truth is the immutable ledger. |
| Payout release gate | n/a | Checks ledger balance, not a stored column: `claim_payout_statement_release` reads `ledger_account_balance_minor` and rejects if `< net_amount_minor_bigint` (160:398–404) | 160:398 | **FIXED** — release is gated on derived ledger truth, with `FOR UPDATE` row lock (160:373–379) + idempotency-key replay guard (160:385–392). This is the fix for prior "payout double-release." |
| `wallet_ledger_entries` "available" | Derived sum, reconciled | `refresh_money_ledger_site_reconciliation` sums posted entries and compares to ledger `merchant_payable`, flags `variance_minor` (160:212–254). Does **not** auto-correct — records mismatch. | 160:212 | FIXED (reconcile, no auto-plug). |
| `gift_card_accounts.balance` | **Yes, mutated in place** | `UPDATE gift_card_accounts SET balance = balance - v_gift_card_amount` inside checkout (baseline:1836) | baseline:1836 | **OPEN** — mutable balance is the truth; no ledger backing. |
| `gift_cards.balance` | **Yes** (separate, diff precision) | mutable `numeric(10,2)` (baseline:9438) | baseline:9438 | **OPEN.** |
| `ai_credits.balance integer` | **Yes** | mutable (baseline:8152) | baseline:8152 | OPEN (non-money-critical). |

**Mutable-balance verdict: FIXED for the merchant payout rail (the dangerous one), OPEN for gift cards / store-credit-legacy / ai_credits.** The prior "mutable-balance-as-truth" P0 is resolved where it threatened payouts; residual mutable balances remain on gift cards.

### 8.5 Prior-audit P0 re-verification (current working tree)

| Prior P0 (FOUNDATION_FORENSICS_2026_06_09) | Status now | Evidence |
|---|---|---|
| **Payout double-release** | **FIXED** | `claim_payout_statement_release` row-locks the statement (`FOR UPDATE` 160:379), replays idempotently on matching key (160:385–388), early-returns if already `released` (160:390), checks ledger balance (160:398), transitions `pending→processing` atomically. Wired at `payouts.ts:559`. |
| **Refund-not-ledgered** | **OPEN (legacy path)** / PARTIAL | New refund API path posts an F6 ledger txn (`payments.ts:516` → `postPaymentLedger` → writes `refund_ledger_transaction_id` 160:10, payments.ts:543). BUT the legacy storefront/returns RPC `complete_order_refund` (baseline:1039–1208) mutates `refunds`/`returns`/`orders`/`payment_transactions` and emits an outbox event — **and never touches any `ledger_*` table.** `returns.ts:279` and `order-execution.adapter.ts:495` call this legacy RPC. So refunds issued via returns are unledgered. |
| **Reconciliation auto-plug** | **NOT PRESENT (FIXED)** | Settlement ingest computes `recon_break_minor`; if non-zero it does **not** post a balancing ledger entry — it inserts a `recon_breaks` row (`settlements.ts:265–283`) and only posts the ledger when `recon_break_minor === 0 && balanced` (settlements.ts:237). No auto-plug to a suspense account. `recon_breaks.suspense_account_code` is CHECK-constrained to `'reserve'` (151:191) but nothing auto-posts to it. |
| **Mutable-balance-as-truth** | **PARTIAL** | §8.4 — fixed for payouts, open for gift cards. |

---

## 9. Trigger / Function Census & Dangerous-Function Register

**149 functions; 108 (72%) are `SECURITY DEFINER`.** 191+ trigger attachments. Census of dangerous patterns:

| ID | Function / trigger | Danger | Evidence | Assessment |
|---|---|---|---|---|
| DF-1 | `post_ledger_transaction`, `post_settlement_ledger_transaction`, `ensure_ledger_account`, `ledger_account_balance_minor`, `claim_payout_statement_release`, `refresh/assert_money_ledger_site_reconciliation`, `backfill_wallet_ledger_to_canonical` | All `SECURITY DEFINER SET search_path='public'` (139:207,235; 151:17; 160:179,203,265,284,365) | The money primitives | **Acceptable & correct** — search_path pinned; they self-validate the tenant GUC (`post_ledger_transaction` raises if `current_site_id() <> p_site_id`, 139:251). Good. |
| DF-2 | `post_settlement_ledger_transaction` | `PERFORM set_config('app.site_id', p_site_id, true)` (151:23) — **sets the tenant GUC to whatever caller passes**, then posts | 151:23 | A SECURITY DEFINER function that *sets* the tenant context from a parameter bypasses the GUC's purpose as an isolation boundary. Any caller of this RPC can post ledger entries for *any* site_id. Mitigated only by route-level auth. (DB-011) |
| DF-3 | `backfill_wallet_ledger_to_canonical` | `SECURITY DEFINER`, loops all sites, `set_config('app.site_id', v_entry.site_id, true)` per row, posts canonical txns (160:305–326) | 160:279 | Mass cross-tenant write tool. Necessary for migration but a standing footgun if callable in prod. **UNVERIFIED** whether route-exposed. (DB-012) |
| DF-4 | `mirror_hot_table_partition_shadow` | `SECURITY DEFINER`, dynamic `EXECUTE format('INSERT INTO public.%I SELECT ($1).*', shadow)` driven by `retention_policies.shadow_table` (131:49–52) | 131:9–56 | Dynamic DML into a table name read from a data row. If `retention_policies` is writable by a lesser role, this is an injection-to-arbitrary-table primitive. `retention_policies` is ENABLE-only RLS. (DB-013) |
| DF-5 | `confirm_order_payment_with_ledger` | Name implies ledger posting; body (baseline:1590–1709) updates `payment_transactions`/inserts `payment_attempts` and calls `confirm_order_payment` — **never inserts into `ledger_*`.** | baseline:1590–1709 | **Misleadingly named** — "_with_ledger" function does not write the canonical ledger. The actual ledger write is done separately in TS (`payments.ts`). Naming invites a false sense of ledger coverage. (DB-005) |
| DF-6 | `complete_order_refund` | `SECURITY DEFINER`; mutates 5 tables + outbox; **no ledger** | baseline:1039–1208 | The unledgered-refund path (DB-006 / §8.5). |
| DF-7 | `is_super_admin()` / `log_audit_event()` | `SECURITY DEFINER` audit/authz helpers (baseline:4409,4425) | baseline:4409 | Standard; `log_audit_event` writes `audit_logs` from a trigger — fine. |
| DF-8 | `sync_orders_tenant_keys` | trigger forces `site_id = store_id`, raises if they differ (130:14–31) | 130:14 | Enforces DUP-1 invariant; correct given the dual-key debt but is load-bearing glue. |
| DF-9 | 178 `update_updated_at` / `increment_version` triggers | benign | baseline:4365; 19515 | OK. `increment_version` provides optimistic-lock columns on orders/products/etc. |

**No auto-plug / balance-mutation-on-trigger found in the canonical money path.** The dangerous set is: search-path-OK-but-tenant-from-param SECURITY DEFINER money RPCs (DF-2/3), dynamic-DML mirror (DF-4), and the two misleadingly-"_with_ledger"/legacy refund functions that skip the ledger (DF-5/6).

---

## 10. Constraint-Integrity Register

| ID | Issue | Evidence | Sev |
|---|---|---|---|
| CI-1 | **`orders` has NO FK to `sites`** — `store_id uuid` and `site_id uuid` are plain columns in baseline (baseline:10112,10139); the canonical orders table relies on a trigger (`sync_orders_tenant_keys`) for tenancy, not a referential constraint. Child money tables (`commission_reconciliation_entries.order_id → orders`, 119:102) FK to orders, but orders itself doesn't FK to sites. | baseline:10112; 119:102 | S2 |
| CI-2 | **Nullable tenant columns in baseline:** 64 columns declared `store_id uuid,` / `site_id uuid,` (nullable) across baseline tables (e.g. `outbox_events.store_id`/`site_id` both nullable, baseline:1217,1233). Tenant scoping is therefore not NOT-NULL-guaranteed for legacy tables. New-kernel tables correctly declare `site_id uuid NOT NULL REFERENCES sites(id)`. | baseline:1217,1233 | S2 |
| CI-3 | **`ON DELETE CASCADE` on money/audit child tables** — `payout_items.payout_id → payouts ON DELETE CASCADE` (151:150); `cod_reconciliation_entries.order_id → orders ON DELETE CASCADE` (140:23); `commission_reconciliation_entries.site_id → sites ON DELETE CASCADE` (119:101); virtually all `site_id → sites ON DELETE CASCADE`. **Deleting a site cascades away its settlements/payouts/ledger-linked rows.** `ledger_entries.site_id → sites ON DELETE CASCADE` (139:128) means deleting a site **deletes immutable ledger history** — the one thing that must never be deletable. The reject-mutation trigger blocks direct DELETE on ledger_entries, but a CASCADE from `sites` deletion is a *referential* delete that the BEFORE DELETE trigger… would actually fire and RAISE, blocking the site delete — so the CASCADE is effectively un-executable on ledger, but silently so. Net: money/audit tables use CASCADE-to-sites broadly; only the ledger is accidentally protected by its own trigger. | 139:128; 151:150; 140:23 | S1 |
| CI-4 | **State columns as free-text vs CHECK** — orders DO have CHECKs (status/payment_status/return_status/refund_status, baseline:10157–10161). But **128 `status text` columns across the corpus lack any CHECK** (grep). Examples: many ops/runtime/app tables. Critical money/order state machines are CHECK-guarded; peripheral ones are free-text. Mixed discipline. | grep; baseline:10157 | S3 |
| CI-5 | **`recon_breaks.amount_minor > 0` but settlement can have negative break** — `recon_breaks_amount_check CHECK (amount_minor > 0)` (151:190) while the code stores `Math.abs(plan.recon_break_minor)` (settlements.ts:272). Sign of the break is dropped into metadata only. A short vs over remittance is indistinguishable at the column level. | 151:190; settlements.ts:272 | S3 |
| CI-6 | **`commission_schedules` GST bounded to ≤2800 bps (28%)** good, but `commission_bps ≤ 10000` (100%) (119:95) allows a 100% commission schedule — no upper-business-bound. | 119:95 | S3 |
| CI-7 | **Gift-card precision mismatch** (DUP-8): `gift_card_accounts.balance numeric(12,2)` vs `gift_cards.balance numeric(10,2)` — same concept, different max value (₹10^10 vs ₹10^8). | baseline:9361,9438 | S2 |
| CI-8 | **`payment_tokens.customer_id → customers(id)`** but no `customers` table exists in the chain (only `store_customers`). FK target is out-of-band. | 142:28; baseline:12175 | S1 (replayability) |

---

## 11. Seeds, Verification & CI

### 11.1 Seeds

- `001_seed.sql` (26 lines): inserts `employee_permissions` role→permission rows and informational comments. **Production-safe** (RBAC catalog data, `ON CONFLICT DO NOTHING`). No demo customers/orders. ✅
- `theme-marketplace-sample-catalog.sql` (300 lines) + `urban-kicks-theme.sql` (756 lines): seed a sample theme catalog. The archived migrations show a saga of "only urban kicks" / "restore dynamic catalog" / "deactivate non-urban-kicks" (archive 055/056/058/066/067) — i.e. **the theme catalog was repeatedly forced to a single demo theme in production migrations.** The sample catalog seed is demo data; if run on prod it injects sample themes. (DB-026)
- `scripts/seed-data.sh`: requires `SUPABASE_URL` + `SERVICE_ROLE_KEY` + `DATABASE_URL`, runs seeds via `psql`. Manual, not in CI.

### 11.2 Verification

`database/supabase/verification/` holds 19 `DO $$ … RAISE EXCEPTION` assertion scripts (e.g. `107_…_payment_uniqueness.sql` asserts the credential/session policies are `TO service_role`-scoped and the provider-payment unique exists; verification 107:7–40). These are **genuine, well-written post-migration assertions.** The problem is execution:

### 11.3 CI cross-check — verification SQL is NEVER executed

| Workflow | What it does with DB SQL | Evidence |
|---|---|---|
| `ci.yml` | No DB step; only sets a placeholder `NEXT_PUBLIC_SUPABASE_URL` (ci.yml:247). **Does not run migrations or verification.** | ci.yml:247 |
| `production-deploy.yml` | `migration-preflight` runs `pnpm run validate:migrations` (a **string/regex linter**, `migration-safety-validator.mjs`), generates a `supabase db diff` against prod, takes a `pg_dump` backup, then `supabase db push --include-all` (production-deploy.yml:128–240). | production-deploy.yml:129,222,240 |
| `validate:migrations` | `migration-safety-validator.mjs` greps for forbidden `DROP TABLE/COLUMN/TRUNCATE/RENAME` patterns (validator:16–25) and asserts replayability-doc coverage. **Never connects to a DB; never runs the `verification/` SQL.** | package.json:44; validator:16 |
| `production-readiness-validator.mjs` / `operational-lifecycle-validator.mjs` | `readFile()` the verification SQL (063/064/065) and **string-match** for required fragments (readiness-validator:504–566). | readiness-validator:504 |

**CI verdict: migrations are never replayed against an ephemeral database in CI, and the 19 verification scripts are never executed — they are only `readFile`+regex-matched.** This is why the `customers`-FK replay break (CI-8) and the dual-129 anomaly survive. The only DB contact is the production `db push` itself, gated by a regex linter. (DB-021)

---

## 12. D1 (Cloudflare) Split-Brain Analysis

`database/cloudflare/d1/migrations/0001_provider_execution_foundation.sql` (54 lines) creates 4 SQLite tables: `provider_execution_evidence`, `d1_migration_lineage`, `replay_restoration_lineage`, `rollback_lineage` (d1:1–54).

**Verdict: NOT a split-brain of business data.** These are **CI/CD provenance ledgers** — hashes of `wrangler` command executions, D1 migration checksums, replay/rollback lineage for the Cloudflare deployment pipeline. No `orders`, `payments`, `sites`, customer, or money tables. Postgres remains the sole transactional source of truth. The only conceptual overlap is "lineage/evidence" tracking, which is operational metadata, not duplicated business state. **No split-brain risk.** (One nit: it's a *second* migration system with its own `d1_migration_lineage` table, so the platform now has three migration tracking surfaces — Supabase versioning, this D1 lineage, and the governance validators — but they track disjoint object sets.)

---

## 13. Schema-vs-Code Spot Checks (critical tables)

| Table | Code usage | Match? | Evidence |
|---|---|---|---|
| `payments` | new capture/void/refund API reads/writes `payments`, sets `capture_ledger_transaction_id`/`refund_ledger_transaction_id` (payments.ts:262,317,543) | ✅ columns exist (142:43; 160:9–10) | payments.ts:262 |
| `ledger_*` | written only via `post_settlement_ledger_transaction` RPC from payments/payouts/settlements/commission support (payment-route-support.ts:185; payouts.ts:189; settlements.ts:121; commission.ts:148) | ✅ single-writer-via-RPC honored | settlements.ts:121 |
| `payout_statements` | release via `claim_payout_statement_release` RPC (payouts.ts:559) | ✅ | payouts.ts:559 |
| `customers` (FK target) | `analytics.ts:284` and `ai.ts:419` do `db.from('customers')` — **but the customer-engagement route uses `store_customers`** (customer-engagement-routes.ts:122) | ❌ **code is itself split** between `customers` and `store_customers`; only `store_customers` exists in migrations | analytics.ts:284; customer-engagement-routes.ts:122; baseline:12175 |
| `complete_order_refund` | called by `returns.ts:279`, `order-execution.adapter.ts:495` | ✅ exists, but unledgered (DB-006) | returns.ts:279 |
| `gift_cards` | read/written by `products.ts:829,872` | ✅ exists; but `gift_card_accounts` (the other balance store) unreferenced by name → DUP-8 confirmed orphan-leaning | products.ts:829 |

The `customers` vs `store_customers` finding is doubly damning: not only is `customers` a missing FK target (CI-8), but **app code queries both names** — `analytics.ts`/`ai.ts` hit `customers`, engagement routes hit `store_customers`. Either `customers` exists in prod out-of-band (confirming A-3 drift) or those analytics/AI customer counts silently error. **UNVERIFIED** which, without live DB. (DB-001)

---

## Findings Register

Severity: **S0** = active money/data-loss or cross-tenant exposure on the live write path; **S1** = serious correctness/safety latent or one-step-away; **S2** = meaningful defect / debt with real risk; **S3** = hygiene.

| ID | Sev | Area | Title | Root Cause | Evidence (path:line) | Impact | Fix | Recommended Fix |
|---|---|---|---|---|---|---|---|---|
| DB-001 | S1 | Schema/Code | `customers` FK target absent yet queried in code | Out-of-band prod schema vs migration chain; two customer-table names in code | 142:28; baseline:12175; analytics.ts:284; customer-engagement-routes.ts:122 | Migration replay fails; analytics/AI customer counts error or rely on undocumented table | M | Create `customers` as a view over `store_customers` (or rename-with-compat), unify code on one name, add to chain |
| DB-002 | S1 | Money | 32-bit `integer` minor-unit money columns overflow at ₹2.14cr | Mobile-money tables used `integer` not `bigint` for paise | 119:16–19,52,107–112; 140:26–29; baseline:10227 | Payout/settlement/commission above ~₹21.4M overflows silently | M | Finish the 160 `_bigint` cutover: make `_bigint` columns authoritative, drop `integer` originals via expand/contract, repoint API |
| DB-003 | S1 | Money | Four money representations coexist (bigint-paise / int-paise / numeric-rupee / numeric(16,4)) | Legacy numeric(_,2) never migrated; new kernel uses bigint-paise | 139:132; 119:52; 109:7; baseline:13057 | Cross-regime flows depend on `::bigint` casts in app/trigger; a missed cast = 100× error | L | Pick bigint-paise everywhere; migrate `orders`/`refunds`/`gift_*` money to `*_minor bigint` with backfill + compat views |
| DB-004 | S1 | Tenancy | FORCE RLS + tenant-GUC is decorative on the live write path | Gateway connects as `service_role`, which BYPASSES RLS (documented) | 107:17–19; 142:181–222 | Tenant isolation is app-discipline only; a query bug crosses tenants with no DB backstop | L | Run runtime connections as a non-BYPASSRLS role bound to `app.site_id` GUC; reserve `service_role` for migrations |
| DB-005 | S2 | Money | `confirm_order_payment_with_ledger` does not write the ledger | Misleading name; ledger write moved to TS, function body never inserts `ledger_*` | baseline:1590–1709 | False assurance of ledger coverage on capture; capture and ledger can diverge | M | Either post the ledger inside the RPC transactionally or rename to drop `_with_ledger` |
| DB-006 | S1 | Money | Refunds via returns path are NOT ledgered | Legacy `complete_order_refund` predates F6 ledger; never updated | baseline:1039–1208; returns.ts:279; order-execution.adapter.ts:495 | Refunds issued through returns leave the canonical ledger; merchant_payable/refund_clearing wrong | M | Wrap `complete_order_refund` to also `post_ledger_transaction` (refund: debit merchant_payable / credit refund_clearing) idempotently |
| DB-007 | S2 | Rollback | 78% of migrations ship no rollback (70/90) | Pairing enforced only for the post-138 "executable" era | rollback/ listing; V1 §7 | Cannot deterministically reverse legacy/mobile/internal-OS migrations | L | Backfill rollbacks for in-era money migrations first (140,157), document legacy as restore-point-only |
| DB-008 | S2 | Rollback | Forward-only `ADD COLUMN` residue in 151 & 160 rollbacks | Rollbacks drop tables but not columns added to pre-existing tables | 151:38–46 vs 151.rollback; 160:28–40 vs 160.rollback | Partial rollback leaves orphan `canonical_ledger_transaction_id`/`_bigint` columns | S | Add the missing `DROP COLUMN` statements to 151/160 rollbacks |
| DB-009 | S1 | Money | Ledger append-only is trigger-only; no `REVOKE`, owner can `DISABLE TRIGGER` | Zero REVOKE statements in corpus; gateway role likely table owner | 139:358–376; grep REVOKE=0; 107:17 | One `ALTER TABLE … DISABLE TRIGGER` re-enables mutation/deletion of immutable money history | S | `REVOKE UPDATE, DELETE ON ledger_entries, ledger_transactions FROM PUBLIC, service_role`; own ledger tables by a no-login role |
| DB-010 | S2 | Money | Compat "ledger" tables are append-only by convention only | `wallet/gift_card/store_credit/partner_payout_ledger_entries` have no reject trigger; wallet has a BEFORE UPDATE sync trigger | 119:44; 160:137; baseline:9383,10225; 153:54 | These ledgers can be silently mutated/deleted | M | Attach `reject_ledger_mutation` (UPDATE/DELETE) to all `*_ledger_entries`; replace wallet sync-on-update with insert-only |
| DB-011 | S1 | Money | `post_settlement_ledger_transaction` sets tenant GUC from its parameter | SECURITY DEFINER `set_config('app.site_id', p_site_id)` then posts | 151:6–36 (23) | Any caller can post ledger entries for any site_id; isolation depends solely on route auth | M | Derive site from an authenticated principal, not a raw param; assert caller authorization inside the RPC |
| DB-012 | S2 | Money | `backfill_wallet_ledger_to_canonical` is a standing cross-tenant mass-write RPC | Migration helper left as a callable SECURITY DEFINER function | 160:279–355 | If route-exposed, rewrites ledger across all sites | S | Drop the function post-backfill, or gate behind a break-glass-only schema |
| DB-013 | S2 | Security | `mirror_hot_table_partition_shadow` does dynamic DML into a table named in a data row | `EXECUTE format('INSERT INTO public.%I …', retention_policies.shadow_table)` | 131:49–52 | If `retention_policies` is writable by a lesser role, arbitrary-table insert primitive | S | Allowlist shadow table names; lock `retention_policies` writes to migration role |
| DB-014 | S1 | Constraint | `ledger_entries.site_id → sites ON DELETE CASCADE` | Blanket CASCADE-to-sites pattern applied to immutable ledger | 139:128 | Site deletion semantically targets ledger history (saved only by the reject trigger, opaquely) | S | Change ledger/audit FKs to `ON DELETE RESTRICT`; never CASCADE money/audit history |
| DB-015 | S2 | Constraint | `orders` has no FK to `sites`; tenancy via trigger | Legacy table; tenant key bolted on as plain columns + sync trigger | baseline:10112,10139; 130:14 | Orphan orders possible if trigger disabled; referential integrity not DB-guaranteed | M | Add `orders.store_id → sites(id)` FK (after backfilling integrity) |
| DB-016 | S2 | Constraint | 64 nullable `store_id`/`site_id` tenant columns in legacy tables | Baseline tables predate NOT-NULL tenant discipline | baseline:1217,1233 | Rows can exist with null tenant key → invisible to tenant-scoped queries/policies | M | Backfill + `SET NOT NULL` on tenant columns of active legacy tables |
| DB-017 | S2 | Duplicate | Dual tenant key on orders (`store_id` ≡ `site_id`) | Incomplete store→site rename (TD-7) | 108:50; 130:54–55 | Two always-equal columns + a trigger to keep them equal; permanent confusion/overhead | L | Choose `site_id`, make `store_id` a generated/compat column, retire the sync trigger |
| DB-018 | S2 | Duplicate | Dual user tables (`users` vs `users_custom`) | Supabase-auth shadow vs custom credential store | baseline:13095,13116 | FKs split; ambiguous identity source (TD-7) | L | Designate `users_custom` canonical; expose `users` as a view |
| DB-019 | S2 | Duplicate | Dual JSONB+relational models for orders.items / products.variants kept permanently | 085/086 declared relational authoritative but froze JSONB "for compatibility" | baseline:10119; 085:1–2 | Every write must keep two shapes in sync; report-only reconcile | M | Set a cutover date; backfill, switch reads to relational, demote JSONB to generated cache |
| DB-020 | S2 | Duplicate | Gift-card balance stored twice at different precision | `gift_card_accounts numeric(12,2)` vs `gift_cards numeric(10,2)` | baseline:9361,9438 | Money precision mismatch between two tables for one concept | M | Unify to one bigint-paise ledger-backed gift-card balance |
| DB-021 | S1 | CI/CD | Migrations never replayed in CI; verification SQL never executed | CI only regex-lints SQL; prod `db push` is the first real apply | ci.yml:247; production-deploy.yml:129,240; readiness-validator:504 | Replay breaks (DB-001/CI-8), dup-129, drift all reach production undetected | M | Add a CI job: `supabase db reset` on ephemeral PG, replay 000→161, then run all `verification/*.sql` |
| DB-022 | S2 | Anomaly | Duplicate migration number 129 (two files) | Two teams forked the sequence at 129 | dir listing | Version collision risk on `db push`; ordering ambiguity | S | Renumber one to 129b/162 with a lineage note |
| DB-023 | S2 | Lineage | Baseline snapshot taken from a drifted DB (contains 090's tables) | pg_dump captured post-090 state but 090 kept as forward file | baseline:12024 vs 090:38 | Non-deterministic replay; 000≠state@072 | M | Regenerate baseline from a clean replay, or move 090's objects out of baseline |
| DB-024 | S3 | Duplicate | Dual audit tables (`audit_logs` vs `audit_events`) | Legacy trigger-audit vs identity-platform audit | baseline:8429; 159 | Two audit trails; unclear system of record for compliance | M | Pick one canonical audit sink; mirror the other via view |
| DB-025 | S3 | Orphans | ~37 product-dead tables (theme-legacy, ops-theater, diagnostics) | Accumulated 059–065 "operational" lineage + superseded theme model | §6.1 | Schema bloat, review noise, backup cost | M | Drop after confirming no out-of-band writers; archive DDL |
| DB-026 | S3 | Seeds | Theme-catalog seeds + "only urban kicks" migrations are demo data in the prod path | Repeated forcing of a single demo theme via migrations 055/058/066 | archive 055/058/066; seeds/*.sql | Demo themes can be injected/forced in production | S | Move theme seeds to a non-prod fixtures path; gate behind env |
| DB-027 | S2 | Money | `recon_breaks` drops the sign of the variance (`amount_minor > 0`) | CHECK forbids ≤0; code stores `abs()` | 151:190; settlements.ts:272 | Short vs over remittance indistinguishable at column level | S | Add `direction`/signed column or split break_type by sign |
| DB-028 | S3 | Constraint | 128 free-text `status` columns lack CHECK | Mixed discipline; peripheral tables uncon­strained | grep; baseline:10157 (counter-example) | Invalid states insertable on non-core tables | M | Add CHECK enums to state columns on active tables |
| DB-029 | S3 | Index | Money join FKs unindexed (payouts/settlement/commission links) | Indexes cover tenant+status but not the cross-entity FK | 151:114–115; 119:103–104; 119:47 | Settlement/payout/commission joins seq-scan at scale | S | Add composite indexes on `(site_id, settlement_id)` / `(site_id, payout_statement_id)` |
| DB-030 | S2 | Constraint | Broad `ON DELETE CASCADE` to `sites` across money/audit children | Convenience cascade applied uniformly | 139:128; 140:23; 151:150; 119:101 | Site deletion would cascade settlements/payouts/recon/cod; ledger only saved opaquely by trigger | M | RESTRICT on money/audit; soft-delete sites instead of hard delete |
| DB-031 | S3 | Money | Compat int-minor mitigation (`_bigint` shadows) not yet authoritative | 160 adds shadow columns + sync triggers but originals remain CHECK-constrained source | 160:28–40,147–171 | Two columns per amount; sync-trigger dependence; cutover unfinished | M | Complete expand/contract; make `_bigint` the column of record |
| DB-032 | S3 | Duplicate | Dormant `sessions_v2` successor alongside live `sessions` | 159 builds v2 identity sessions; 161 keeps legacy `sessions` authoritative | 159:113; 161:7 | Two session models; v2 unused by live auth | M | Either cut over to `sessions_v2` or shelve 159's session tables |
| DB-033 | S2 | Schema/Code | `commission_bps ≤ 10000` allows 100% commission | Upper bound set to 100%, not a business max | 119:95 | Misconfigured schedule can take 100% of GMV | S | Tighten CHECK to a sane max (e.g. ≤3000 bps) |
| DB-034 | S3 | Constraint | `payment_tokens.customer_id → customers` (same missing target as DB-001) | FK to non-existent `customers` | 142:28 | Replay break; token-customer link unenforceable | M | Repoint to `store_customers` or the `customers` view from DB-001 |

**34 findings: S0 ×0 · S1 ×9 · S2 ×15 · S3 ×10.**

> Note on S0: no finding is rated S0 because the highest-impact issues (DB-004 decorative RLS, DB-006 unledgered refunds, DB-002 int overflow) require either an application bug, the returns path specifically, or transaction sizes >₹2.14cr to cause live loss — each is one trigger away from S0 but not continuously bleeding. DB-004 + DB-009 together are the closest to S0: tenant isolation and ledger immutability both reduce to "the gateway role is trusted and well-behaved."

---

## Appendix B — Verdict Scorecard

| Dimension | Score | Basis |
|---|---|---|
| Canonical money ledger (139/151/160) | 4.3/5 | Enforced append-only, balanced, idempotent, reconciled, payout-gated. Loses points for trigger-only (no REVOKE) enforcement and param-driven tenant GUC. |
| Legacy money (orders/refunds/gift cards) | 1.5/5 | numeric-rupee, mutable balances, unledgered refund path, precision mismatch. |
| Tenancy enforcement | 2.0/5 | FORCE RLS on 76 tables, tenant-GUC policies — all bypassed by `service_role` on the live path; 343 tables ENABLE-only; 64 nullable tenant keys. |
| Migration lineage / replayability | 1.8/5 | Missing `customers`, dup-129, drifted baseline, 78% no rollback, never replayed in CI. |
| Index / uniqueness safety | 3.8/5 | Idempotency/dedupe lattice comprehensive; join-index gaps remain. |
| Constraint integrity | 2.6/5 | Core order/money CHECKs strong; CASCADE-to-sites on money/audit, no orders→sites FK, 128 free-text statuses. |
| D1 split-brain | 5/5 | No business-data duplication; provenance-only. |
| **Composite** | **2.4/5** | Sound new kernel; unreconciled legacy mass; decorative tenancy on the write path; unreplayable lineage. |
