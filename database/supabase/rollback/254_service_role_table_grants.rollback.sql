-- Rollback of 254: take back the service_role grants 254 added, and only where 254 is what added them.
--
-- On a database built under Supabase's CURRENT default privileges, 254 is the only source of these grants, and this
-- restores the state before it: the backend again cannot read users_custom or the other 147 relations, so identity
-- lookup, signup and login fail with 42501. Roll back only to undo a grant that turns out to be wrong, and prefer
-- revoking that one table by name over running this whole file.
--
-- On a database built under the OLD default, service_role held all of these privileges before 254, and 254 changed
-- nothing. Revoking them here would remove access that 254 never granted, so this file detects that default and
-- does nothing. The test is the default ACL for tables postgres creates in public: under the old default it
-- grants service_role SELECT ('r' in its ACL entry); under the current one it does not.
--
-- No data is changed; privileges only.

BEGIN;

DO $$
DECLARE
  v_acl text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    RETURN;
  END IF;

  SELECT array_to_string(d.defaclacl, ' ') INTO v_acl
    FROM pg_default_acl d
   WHERE d.defaclrole = (SELECT oid FROM pg_roles WHERE rolname = 'postgres')
     AND d.defaclnamespace = 'public'::regnamespace
     AND d.defaclobjtype = 'r';

  IF v_acl ~ '(^| )service_role=[^/ ]*r' THEN
    RAISE NOTICE 'rollback 254: this database grants service_role SELECT on new tables by default, so 254 granted nothing here; privileges left as they are';
    RETURN;
  END IF;

  REVOKE SELECT, INSERT, UPDATE, DELETE ON
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
  FROM service_role;

  REVOKE SELECT ON
    public.commerce_analytics_daily_mv,
    public.stores
  FROM service_role;
END
$$;

COMMIT;
