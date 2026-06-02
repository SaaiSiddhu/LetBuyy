# Migration Audit

Generated during Phase 2.1 static validation.

## Summary

- Active migration files scanned: 2 (`database/supabase/migrations/000_baseline.sql`, `database/supabase/migrations/073_order_item_required_field_compatibility.sql`)
- Archived historical migrations: 72 (`docs/archive/migrations-history/001_*.sql` through `072_*.sql`)
- Live database apply: PASS for the baseline-plus-073 disposable Supabase Postgres replay during the 2026-06-02 production-readiness P1 real-stack mission.
- Static forward-reference issues: 0 in active replay authority.
- Migration health status: BASELINED

## 2026-06-02 Baseline Update

The old `001` through `072` migration chain is no longer active replay
authority. It is preserved under `docs/archive/migrations-history/` for audit
and rollback investigation only. Fresh environments must apply
`database/supabase/migrations/000_baseline.sql`; additive forward migration
`073_order_item_required_field_compatibility.sql` repairs the checkout
order-items compatibility contract discovered by real-stack COD checkout, and
new forward migrations now resume at `074_*.sql`.

## Issues Found

- None found by comment-stripped static ordering analysis.

## Migration Inventory

The inventory below is the archived historical chain that was squashed into the
verified baseline.

| # | Migration | Table targets |
|---:|---|---|
| 1 | `001_initial_schema.sql` | creates: users, sites, products, orders, coupons, projects, skills, education, testimonials, work_experience, certifications, resume_versions, leads, lead_forms, contacts; alters: users, sites, products, orders, coupons, projects, skills, education, testimonials, work_experience, certifications, resume_versions, leads, lead_forms, contacts |
| 2 | `002_roles_and_permissions.sql` | creates: employees, super_admins, audit_logs, employee_permissions; alters: employees, super_admins, audit_logs |
| 3 | `003_align_schema.sql` | creates: user_profiles, subscriptions, order_items, pages, shipping_zones, shipping_rates, employee_invites, analytics_events, notification_preferences, device_tokens; alters: user_profiles, subscriptions, order_items, pages, shipping_zones, shipping_rates, employee_invites, analytics_events, notification_preferences, device_tokens |
| 4 | `004_plan_alignment.sql` | metadata, policy, function, trigger, or data-only migration |
| 5 | `005_auth_system.sql` | creates: users_custom, devices, sessions, verification_tokens; alters: users_custom, sessions, devices, verification_tokens |
| 6 | `006_store_platform.sql` | creates: users_custom, sites, products, orders, pages, sessions, devices, email_logs, onboarding_attempts; alters: sites, products, orders, pages, email_logs, onboarding_attempts |
| 7 | `007_fix_stores_trigger.sql` | metadata, policy, function, trigger, or data-only migration |
| 8 | `008_fix_constraints_and_columns.sql` | creates: store_surveys; alters: sites, onboarding_attempts, store_surveys |
| 9 | `009_online_store_themes.sql` | creates: themes, store_themes; alters: themes, store_themes |
| 10 | `010_products_section.sql` | creates: product_options, product_variants, collections, collection_products, gift_cards; alters: products, product_options, product_variants, collections, collection_products, gift_cards |
| 11 | `011_plans_table.sql` | creates: plans, billing_history; alters: plans, subscriptions, billing_history |
| 12 | `012_fix_rls_recursion.sql` | metadata, policy, function, trigger, or data-only migration |
| 13 | `013_fix_subscription_rls.sql` | alters: subscriptions, billing_history |
| 14 | `014_fix_stale_super_admins_refs.sql` | metadata, policy, function, trigger, or data-only migration |
| 15 | `015_fix_audit_null_actor.sql` | alters: audit_logs |
| 16 | `016_razorpay_plan_ids.sql` | alters: plans |
| 17 | `017_app_store_ecosystem.sql` | creates: app_developers, app_categories, marketplace_apps, app_extensions, app_installations, app_reviews, app_webhooks; alters: app_developers, app_categories, marketplace_apps, app_extensions, app_installations, app_reviews, app_webhooks |
| 18 | `018_theme_marketplace_extensions.sql` | creates: theme_purchases, theme_reviews; alters: themes, theme_purchases, theme_reviews |
| 19 | `019_fix_product_rls.sql` | metadata, policy, function, trigger, or data-only migration |
| 20 | `020_notifications.sql` | creates: notifications; alters: notifications |
| 21 | `021_blog_system.sql` | creates: blog_categories, blog_tags, blog_posts, blog_post_tags, blog_comments; alters: blog_categories, blog_tags, blog_posts, blog_post_tags, blog_comments |
| 22 | `022_media_and_forms.sql` | creates: media, form_submissions; alters: media, form_submissions |
| 23 | `023_customer_system.sql` | creates: customer_addresses, wishlists, return_requests, payment_transactions; alters: customer_addresses, wishlists, return_requests, payment_transactions |
| 24 | `024_ai_and_notifications.sql` | creates: ai_credits, ai_usage; alters: notification_preferences, ai_credits, ai_usage |
| 25 | `025_customer_credentials.sql` | creates: customer_credentials; alters: customer_credentials |
| 26 | `026_store_customers.sql` | creates: store_customers, customer_wishlists, customer_activity_log; alters: store_customers, customer_wishlists, customer_activity_log |
| 27 | `027_missing_tables.sql` | creates: carts, product_reviews, tax_rates, inventory_locations, inventory_levels, inventory_adjustments, smart_collections, gallery_items, skill_endorsements; alters: carts, product_reviews, tax_rates, inventory_locations, inventory_levels, inventory_adjustments, smart_collections, gallery_items, skill_endorsements |
| 28 | `028_schema_compliance.sql` | alters: users, sites, products, orders, coupons, projects, skills, education, testimonials, work_experience, certifications, resume_versions, leads, lead_forms, contacts, blog_posts, blog_categories, blog_comments, carts, product_reviews, +9 more |
| 29 | `029_order_items.sql` | creates: order_items; alters: order_items |
| 30 | `030_theme_editor_and_payment_events.sql` | creates: theme_editor_drafts, payment_webhook_events; alters: theme_editor_drafts, payment_webhook_events, sites, orders |
| 31 | `031_enterprise_events_theme_releases.sql` | creates: audit_activity_events, outbox_events, theme_releases, theme_preview_sessions, storefront_cache_tags; alters: audit_activity_events, outbox_events, theme_releases, theme_preview_sessions, storefront_cache_tags, sites |
| 32 | `032_inventory_reservations_order_commit.sql` | creates: inventory_reservations, inventory_level_duplicate_snapshots; alters: inventory_level_duplicate_snapshots, inventory_reservations |
| 33 | `033_payment_state_machine.sql` | alters: orders |
| 34 | `034_inventory_level_runtime.sql` | metadata, policy, function, trigger, or data-only migration |
| 35 | `035_payment_failure_state.sql` | metadata, policy, function, trigger, or data-only migration |
| 36 | `036_shipping_tax_runtime_alignment.sql` | alters: shipping_zones, shipping_rates |
| 37 | `037_product_reviews_moderation_status.sql` | alters: product_reviews |
| 38 | `038_form_submissions_runtime_alignment.sql` | alters: form_submissions |
| 39 | `039_pages_runtime_alignment.sql` | alters: pages |
| 40 | `040_portfolio_resume_runtime_alignment.sql` | alters: skills, education, testimonials, work_experience, portfolio_projects |
| 41 | `041_store_employee_runtime_alignment.sql` | alters: employees |
| 42 | `042_collections_gift_cards_runtime_alignment.sql` | alters: collections, gift_cards |
| 43 | `043_app_store_runtime_alignment.sql` | alters: app_developers, marketplace_apps, app_reviews |
| 44 | `044_theme_purchase_payment_runtime.sql` | alters: theme_purchases |
| 45 | `045_tenant_context_idempotency_foundation.sql` | creates: idempotency_keys; alters: idempotency_keys |
| 46 | `046_checkout_payment_inventory_ledgers.sql` | creates: checkout_sessions, order_line_adjustments, order_tax_lines, order_shipping_lines, payment_attempts, refund_transactions, refund_attempts, inventory_events; alters: outbox_events, checkout_sessions, order_line_adjustments, order_tax_lines, order_shipping_lines, payment_transactions, payment_attempts, refund_transactions, refund_attempts, inventory_reservations, inventory_levels, inventory_events |
| 47 | `047_enterprise_theme_engine_foundation.sql` | creates: theme_packages, theme_package_versions, theme_renderer_manifests, theme_schema_manifests, theme_presets, theme_assets, theme_migrations, theme_instances, theme_instance_drafts, theme_draft_patches, theme_template_assignments, theme_layouts, theme_templates, theme_section_definitions, theme_block_definitions, storefront_pages, storefront_page_revisions, storefront_policies, navigation_menus, navigation_menu_items, media_assets, storefront_slug_redirects; alters: themes, theme_instances, storefront_pages, theme_releases, theme_packages, theme_package_versions, theme_renderer_manifests, theme_schema_manifests, theme_presets, theme_assets, theme_migrations, theme_instance_drafts, theme_draft_patches, theme_template_assignments, theme_layouts, theme_templates, theme_section_definitions, theme_block_definitions, storefront_page_revisions, storefront_policies, +4 more |
| 48 | `048_promotions_and_gift_card_ledgers.sql` | creates: promotions, promotion_codes, promotion_rules, promotion_effects, promotion_redemptions, promotion_usage_counters, gift_card_accounts, gift_card_ledger_entries, gift_card_redemptions; alters: coupons, promotions, promotion_codes, promotion_rules, promotion_effects, promotion_redemptions, promotion_usage_counters, gift_card_accounts, gift_card_ledger_entries, gift_card_redemptions |
| 49 | `049_fulfillment_returns_refund_engine.sql` | creates: fulfillment_orders, fulfillment_order_lines, shipments, shipment_events, returns, return_lines, refunds, refund_lines, restock_events; alters: order_items, orders, fulfillment_orders, fulfillment_order_lines, shipments, shipment_events, returns, return_lines, refunds, refund_lines, restock_events |
| 50 | `050_purchase_orders_and_transfers_engine.sql` | creates: suppliers, purchase_orders, purchase_order_lines, purchase_order_receipts, inventory_transfers, inventory_transfer_lines, inventory_transfer_receipts; alters: suppliers, purchase_orders, purchase_order_lines, purchase_order_receipts, inventory_transfers, inventory_transfer_lines, inventory_transfer_receipts |
| 51 | `051_outbox_dispatcher_observability.sql` | creates: outbox_dead_letters, platform_queue_jobs, webhook_subscriptions, webhook_deliveries, worker_request_logs, operation_metrics; alters: outbox_events, outbox_dead_letters, platform_queue_jobs, webhook_subscriptions, webhook_deliveries, worker_request_logs, operation_metrics |
| 52 | `052_saas_entitlements_usage_metering.sql` | creates: site_roles, site_role_permissions, site_memberships, plan_entitlements, site_entitlement_overrides, site_api_clients, site_usage_meters, usage_meter_entries; alters: site_roles, site_role_permissions, site_memberships, plan_entitlements, site_entitlement_overrides, site_api_clients, site_usage_meters, usage_meter_entries |
| 53 | `053_search_analytics_queue_consumers.sql` | creates: analytics_event_stream, analytics_rollups_daily, search_documents; alters: analytics_event_stream, analytics_rollups_daily, search_documents |
| 54 | `054_storefront_cms_navigation_backfill.sql` | metadata, policy, function, trigger, or data-only migration |
| 55 | `055_only_urban_kicks_theme_catalog.sql` | metadata, policy, function, trigger, or data-only migration |
| 56 | `056_restore_dynamic_theme_catalog.sql` | metadata, policy, function, trigger, or data-only migration |
| 57 | `057_theme_preview_instance_draft_runtime.sql` | alters: theme_preview_sessions |
| 58 | `058_deactivate_non_urban_kicks_themes.sql` | metadata, policy, function, trigger, or data-only migration |
| 59 | `059_distributed_runtime_operations_foundation.sql` | creates: distributed_event_streams, distributed_event_store, runtime_replay_executions, runtime_checkpoints, distributed_queue_messages, runtime_leases, projection_store, projection_rebuilds, tenant_execution_quotas, provider_health_snapshots, cache_invalidation_events, execution_audit_trail; alters: distributed_event_streams, distributed_event_store, runtime_replay_executions, runtime_checkpoints, distributed_queue_messages, runtime_leases, projection_store, projection_rebuilds, tenant_execution_quotas, provider_health_snapshots, cache_invalidation_events, execution_audit_trail |
| 60 | `060_operational_runtime_finalization.sql` | creates: runtime_command_journal, event_stream_snapshots, projection_checkpoints, query_snapshots, workflow_lifecycle, workflow_heartbeats, distributed_queue_heartbeats, runtime_telemetry_spans, runtime_telemetry_metrics, runtime_structured_logs, runtime_health_projections, provider_outage_events, runtime_control_commands; alters: runtime_command_journal, event_stream_snapshots, projection_checkpoints, query_snapshots, workflow_lifecycle, workflow_heartbeats, distributed_queue_heartbeats, runtime_telemetry_spans, runtime_telemetry_metrics, runtime_structured_logs, runtime_health_projections, provider_outage_events, runtime_control_commands |
| 61 | `061_operational_readiness_runtime.sql` | creates: runtime_deployment_topology_records, runtime_diagnostics, queue_operation_snapshots, queue_recovery_operations, replay_operation_schedules, replay_dry_run_results, workflow_operation_snapshots, runtime_alert_evaluations, tenant_operation_projections, cache_operation_snapshots, coordination_operation_diagnostics, regional_execution_diagnostics, projection_operation_snapshots, provider_recovery_plans; alters: runtime_deployment_topology_records, runtime_diagnostics, queue_operation_snapshots, queue_recovery_operations, replay_operation_schedules, replay_dry_run_results, workflow_operation_snapshots, runtime_alert_evaluations, tenant_operation_projections, cache_operation_snapshots, coordination_operation_diagnostics, regional_execution_diagnostics, projection_operation_snapshots, provider_recovery_plans |
| 62 | `062_production_rollout_operations.sql` | creates: production_db_rollout_plans, database_operation_snapshots, production_incidents, production_incident_events, failover_drill_runs, chaos_experiment_runs, load_test_runs, deployment_promotion_runs, runtime_secret_rotation_events, runtime_slo_definitions; alters: production_db_rollout_plans, database_operation_snapshots, production_incidents, production_incident_events, failover_drill_runs, chaos_experiment_runs, load_test_runs, deployment_promotion_runs, runtime_secret_rotation_events, runtime_slo_definitions |
| 63 | `063_absolute_production_operationalization.sql` | creates: production_readiness_gate_runs, deployment_health_gate_results, event_store_integrity_checks, runtime_event_retention_policies, operational_dashboard_snapshots, sre_error_budget_snapshots, security_enforcement_events, regional_routing_overrides; alters: production_readiness_gate_runs, deployment_health_gate_results, event_store_integrity_checks, runtime_event_retention_policies, operational_dashboard_snapshots, sre_error_budget_snapshots, security_enforcement_events, regional_routing_overrides |
| 64 | `064_live_production_certification.sql` | creates: operational_certification_reports; alters: operational_certification_reports |
| 65 | `065_enterprise_sdlc_lifecycle.sql` | creates: operational_feature_flags, operational_feature_flag_audit_events, operational_feature_flag_exposures, rollout_stage_evidence, shadow_traffic_comparison_runs, sandbox_provider_contracts; alters: operational_feature_flags, operational_feature_flag_audit_events, operational_feature_flag_exposures, rollout_stage_evidence, shadow_traffic_comparison_runs, sandbox_provider_contracts |

## Notes

- This audit read every SQL file under `database/supabase/migrations` in numeric order.
- The static checker detects table creation, alteration, drops, and foreign-key-style `REFERENCES` ordering after stripping SQL comments.
- A fresh Postgres/Supabase apply is still required once Docker Compose or another local database runtime is available.
