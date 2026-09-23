-- 254 — service_role reaches every public table on a database built from migrations (F-GRANT-1).
--
-- WHAT IS WRONG (reproduced, not inferred)
-- On a real local Supabase (CLI 2.111, image postgres:17.6.1.156) with 000..253 applied, service_role holds no
-- SELECT on 146 of the 458 public tables, or on 2 views. service_role is the role behind the gateway's
-- getSupabaseAdmin client, the queue workers and the webhook service. Merchant identity breaks first:
--     POST /v1/auth/custom/users/by-email  ->  42501 permission denied for table users_custom
-- so account lookup, signup and login all fail. The same holds for sessions, devices, verification_tokens,
-- payment_webhook_events, plans, the employee tables, collection_products and every other table listed below.
--
-- WHY
-- The schema was written against Supabase's old default privileges. Under those, every table postgres creates in
-- public was granted in full to anon, authenticated and service_role. The current image grants those roles only
-- the reference, trigger and maintenance class on such tables; pg_default_acl reads `service_role=Dxtm/postgres`.
-- Migration 164 made service_role a member of app_tenant and gave app_tenant default SELECT, INSERT, UPDATE and
-- DELETE on every later table, which is why tables created after 164 work. The 146 are the older tables that no
-- migration ever granted explicitly, because under the old default nothing had to. No executable suite saw it:
-- tests/executable/supabase-faithful-bootstrap.mjs installs the OLD default for every API role.
--
-- WHAT THIS MIGRATION DOES
-- It grants service_role SELECT, INSERT, UPDATE and DELETE on exactly those 146 tables, and SELECT on the 2 views,
-- by name. The list is static so that a reviewer sees every table. It was measured on a database built from
-- 000..253 under the current default, and it is complete: the self-verification below fails this migration if any
-- public table or view is still unreadable by service_role afterwards.
--
-- WHAT IT DOES NOT DO
--   * It grants nothing a database built under the old default did not already hold. On such a database every
--     statement here is a no-op.
--   * It names none of the 11 tables whose service_role privileges were set explicitly and narrowly. Those are the
--     money fences of 165 (ledger_transactions, ledger_entries: no UPDATE or DELETE) and 236 (the four
--     stored-value ledgers read-only; ad_campaigns writable column by column), plus
--     channel_listing_moderation_events, marketplace_categories, site_domain_verifications and
--     subscription_coupon_redemptions. The self-verification re-reads every money fence afterwards.
--   * It grants anon and authenticated nothing. Whether the Data API roles should reach these tables directly is a
--     separate decision, and the backend does not use them.
--   * RLS is untouched. service_role bypasses RLS on Supabase, so these grants decide only whether the backend can
--     reach a table at all, which under the old default it always could.
--
-- Rollback: database/supabase/rollback/254_service_role_table_grants.rollback.sql

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    RAISE NOTICE '254: service_role absent, skipping';
    RETURN;
  END IF;

  GRANT SELECT, INSERT, UPDATE, DELETE ON
    public.access_review_records,
    public.account_links,
    public.app_api_usage_metrics,
    public.app_awards,
    public.app_built_for_letbuyy_checks,
    public.app_bundle_items,
    public.app_bundles,
    public.app_categories,
    public.app_collaborator_codes,
    public.app_collection_items,
    public.app_collection_sections,
    public.app_collections,
    public.app_developers,
    public.app_extensions,
    public.app_feature_groups,
    public.app_feature_tag_assignments,
    public.app_feature_tags,
    public.app_featured_placements,
    public.app_partner_analytics_daily,
    public.app_partner_tiers,
    public.app_pricing_plans,
    public.app_review_policies,
    public.app_review_summaries,
    public.app_versions,
    public.app_webhooks,
    public.audit_export_cursors,
    public.audit_logs,
    public.auth_password_set_intents,
    public.authenticators,
    public.authorization_codes,
    public.blog_post_tags,
    public.break_glass_grants,
    public.cache_operation_snapshots,
    public.chaos_experiment_runs,
    public.collection_products,
    public.coordination_operation_diagnostics,
    public.credentials,
    public.database_operation_snapshots,
    public.delegations,
    public.deployment_health_gate_results,
    public.deployment_promotion_runs,
    public.developer_profiles,
    public.device_tokens,
    public.devices,
    public.distributed_queue_heartbeats,
    public.dual_model_reconciliation_reports,
    public.employee_invites,
    public.employee_permissions,
    public.employee_roles,
    public.event_store_integrity_checks,
    public.failover_drill_runs,
    public.incident_postmortems,
    public.inventory_level_duplicate_snapshots,
    public.load_test_runs,
    public.marketplace_apps,
    public.marketplace_review_records,
    public.merchant_2fa_factors,
    public.notifications,
    public.oncall_schedules,
    public.operational_certification_reports,
    public.operational_dashboard_snapshots,
    public.operational_feature_flag_audit_events,
    public.org_memberships,
    public.organizations,
    public.partition_lifecycle_partitions,
    public.payment_webhook_events,
    public.payout_disputes,
    public.plan_entitlements,
    public.plans,
    public.principals,
    public.production_db_rollout_plans,
    public.production_incident_events,
    public.production_incidents,
    public.production_readiness_gate_runs,
    public.provider_health_snapshots,
    public.provider_outage_events,
    public.provider_recovery_plans,
    public.purchases,
    public.queue_recovery_operations,
    public.recovery_codes,
    public.refresh_chains,
    public.refresh_tokens,
    public.regional_execution_diagnostics,
    public.regional_routing_overrides,
    public.replay_dry_run_results,
    public.retention_policies,
    public.review_check_runs,
    public.risk_rules,
    public.rollout_stage_evidence,
    public.runtime_alert_evaluations,
    public.runtime_control_commands,
    public.runtime_deployment_topology_records,
    public.runtime_event_retention_policies,
    public.runtime_health_projections,
    public.runtime_leases,
    public.runtime_secret_rotation_events,
    public.runtime_slo_definitions,
    public.runtime_telemetry_spans,
    public.sandbox_provider_contracts,
    public.security_enforcement_events,
    public.session_token_rotation_events,
    public.sessions,
    public.shadow_traffic_comparison_runs,
    public.signing_keys,
    public.site_role_permissions,
    public.skill_endorsements,
    public.sre_error_budget_snapshots,
    public.team_memberships,
    public.teams,
    public.theme_assets,
    public.theme_block_definitions,
    public.theme_collection_items,
    public.theme_collections,
    public.theme_developer_listings,
    public.theme_developer_payout_accounts,
    public.theme_download_artifacts,
    public.theme_layouts,
    public.theme_marketplace_settings,
    public.theme_migrations,
    public.theme_package_versions,
    public.theme_packages,
    public.theme_presets,
    public.theme_purchase_receipts,
    public.theme_purchases,
    public.theme_refund_requests,
    public.theme_renderer_manifests,
    public.theme_reports,
    public.theme_reviews,
    public.theme_saved_searches,
    public.theme_schema_manifests,
    public.theme_section_definitions,
    public.theme_templates,
    public.themes,
    public.ticket_csat,
    public.ticket_macros,
    public.ticket_messages,
    public.ticket_sla_clocks,
    public.ts_appeals,
    public.ts_case_events,
    public.ts_evidence,
    public.ts_policies,
    public.user_profiles,
    public.users,
    public.users_custom,
    public.verification_tokens,
    public.workflow_heartbeats
  TO service_role;

  GRANT SELECT ON
    public.commerce_analytics_daily_mv,
    public.stores
  TO service_role;
END
$$;

-- ---------------------------------------------------------------------------
-- Self-verification: read the privileges back instead of trusting that the statements ran.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_unreadable text;
  v_fence record;
  v_actual text;
  -- The money fences of 165 and 236, which revoke explicitly and so read the same under either default.
  v_fences CONSTANT jsonb := '{"ad_campaigns":"SD","ad_credit_accounts":"S","ad_credit_ledger_entries":"S","ledger_entries":"SI","ledger_transactions":"SI","loyalty_accounts":"S","loyalty_ledger_entries":"S"}';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    RETURN;
  END IF;

  SELECT string_agg(c.relname, ', ' ORDER BY c.relname) INTO v_unreadable
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND c.relkind IN ('r', 'p', 'v', 'm')
     AND NOT has_table_privilege('service_role', c.oid, 'SELECT');
  IF v_unreadable IS NOT NULL THEN
    RAISE EXCEPTION '254: service_role still cannot read: %', v_unreadable;
  END IF;

  FOR v_fence IN SELECT key AS relname, value AS expected FROM jsonb_each_text(v_fences) LOOP
    v_actual := concat_ws('',
      CASE WHEN has_table_privilege('service_role', format('public.%I', v_fence.relname), 'SELECT') THEN 'S' END,
      CASE WHEN has_table_privilege('service_role', format('public.%I', v_fence.relname), 'INSERT') THEN 'I' END,
      CASE WHEN has_table_privilege('service_role', format('public.%I', v_fence.relname), 'UPDATE') THEN 'U' END,
      CASE WHEN has_table_privilege('service_role', format('public.%I', v_fence.relname), 'DELETE') THEN 'D' END);
    IF v_actual <> v_fence.expected THEN
      RAISE EXCEPTION '254: the money fence on public.% moved: service_role holds %, expected %', v_fence.relname, v_actual, v_fence.expected;
    END IF;
  END LOOP;
END
$$;

COMMIT;
