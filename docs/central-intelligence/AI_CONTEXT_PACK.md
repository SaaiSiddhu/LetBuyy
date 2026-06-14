# LetBuyy — AI Context Pack (generated)

Paste any block below into Claude / Gemini / Codex so the model understands a LetBuyy domain **without scanning the repository**. Each block is repository-truth; live values are query-bound to the named LCIS endpoints.

## Platform one-liner
A multi-tenant India-first commerce platform. Core unit = a merchant store (site_id). Merchants sell products; customers buy them; money flows through a canonical double-entry ledger. 414 tables, 156 RPCs, 22 domains, 4 Cloudflare Workers, 5 Vercel apps — all proxying the api-gateway (/v1).

## Per-domain context
```
# LetBuyy domain: Themes
Purpose: Theme engine — Liquid/JSON rendering with a locked sanitizer.
Criticality: Tier 2 — important (tenant data)
Owner: @saai-sidd
Depends on: analytics, merchant, storefront
Consumed by: operations
Routes (1): themes
RPCs (4): notify_on_theme_purchase, publish_theme_release, update_theme_install_count, update_theme_rating
Tables (32): store_themes, theme_assets, theme_block_definitions, theme_draft_patches, theme_editor_drafts, theme_instance_drafts, theme_instances, theme_layouts, theme_migrations, theme_package_versions, theme_packages, theme_presets, theme_preview_sessions, theme_purchases, theme_releases, theme_renderer_manifests, theme_reviews, theme_schema_manifests, theme_section_definitions, theme_template_assignments, theme_templates, themes, theme_collections, theme_collection_items, theme_saved_searches …
Workers: letbuyy-api, letbuyy-queue-workers · Queues: RUNTIME_QUEUE, EVENT_QUEUE
Secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
Security: standard; tenant-scoped (RLS + verifySiteOwnership).
Failure impact: Store renders broken or unsafe HTML.
Query without scanning: /api/domain?key=themes · /api/change-impact?key=themes · /api/incident-intelligence?domain=themes
```

```
# LetBuyy domain: Marketplace
Purpose: App store — app installs, extensions, billing and webhooks (frozen).
Criticality: Tier 2 — important (tenant data)
Owner: @saai-sidd
Depends on: merchant
Consumed by: none
Routes (14): app-store/app-lifecycle-routes, app-store/billing-oauth-routes, app-store/compliance-routes, app-store/developer-routes, app-store/developer-tooling-routes, app-store/extension-routes, app-store/growth-routes, app-store/install-lifecycle-routes, app-store/parity-data, app-store/schema-drift, app-store/search-score, app-store/shared, app-store, operations/marketplace-reviews
RPCs (4): notify_on_app_install, update_app_install_count, update_app_rating, update_marketplace_apps_search_vector
Tables (46): app_billing_charges, app_categories, app_developers, app_extensions, app_installations, app_reviews, app_webhooks, marketplace_apps, marketplace_review_records, app_extension_registrations, app_function_registrations, app_pricing_plans, app_usage_events, app_usage_meter_rollups, app_spend_controls, app_uninstall_feedback, app_versions, app_collections, app_collection_items, app_featured_placements, app_discovery_events, app_built_for_letbuyy_checks, app_review_reports, app_listing_reports, app_activity_events …
Workers: letbuyy-api, letbuyy-queue-workers, letbuyy-webhook · Queues: EVENT_QUEUE
Secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
Security: standard; tenant-scoped (RLS + verifySiteOwnership).
Failure impact: App ecosystem unavailable (currently frozen).
Query without scanning: /api/domain?key=marketplace · /api/change-impact?key=marketplace · /api/incident-intelligence?domain=marketplace
```

```
# LetBuyy domain: Developer Platform
Purpose: Developer platform — OAuth/PKCE, API clients and tooling (frozen).
Criticality: Tier 2 — important (tenant data)
Owner: @saai-sidd
Depends on: none
Consumed by: none
Routes (3): app-api, internal-console/developers, operations/developers
RPCs (0): 
Tables (4): site_api_clients, developer_profiles, oauth_clients, oauth_grants
Workers: letbuyy-api, letbuyy-queue-workers · Queues: EVENT_QUEUE
Secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
Security: standard; tenant-scoped (RLS + verifySiteOwnership).
Failure impact: Developer access unavailable (currently frozen).
Query without scanning: /api/domain?key=developer · /api/change-impact?key=developer · /api/incident-intelligence?domain=developer
```

```
# LetBuyy domain: Gift Cards
Purpose: Issues, redeems and restores gift cards as a ledger projection (no mutable decrement).
Criticality: Tier 1 — critical (money path)
Owner: @saai-sidd
Depends on: none
Consumed by: orders, payments, operations
Routes (2): gift-cards, wallet
RPCs (7): gift_card_available_balance, issue_gift_card, list_gift_cards, check_gift_card_balance, set_gift_card_status, gift_card_transactions, restore_gift_card_on_refund
Tables (5): gift_card_accounts, gift_card_ledger_entries, gift_card_redemptions, gift_cards, wallet_ledger_entries
Workers: letbuyy-api, letbuyy-queue-workers · Queues: EVENT_QUEUE
Secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
Security: money path (SECURITY DEFINER RPCs, canonical-ledger-only); tenant-scoped (RLS + verifySiteOwnership).
Failure impact: Unredeemable codes or balance leaks; liability mismatch.
Query without scanning: /api/domain?key=gift-cards · /api/change-impact?key=gift-cards · /api/incident-intelligence?domain=gift-cards
```

```
# LetBuyy domain: Refunds
Purpose: Reverses captured payments and restores gift-card balances via SECURITY DEFINER RPCs with step-up.
Criticality: Tier 1 — critical (money path)
Owner: @saai-sidd
Depends on: orders, analytics, inventory, payments
Consumed by: operations, payments
Routes (1): returns
RPCs (2): complete_order_refund, create_order_return_and_refund
Tables (7): refund_attempts, refund_lines, refund_transactions, refunds, return_lines, return_requests, returns
Workers: letbuyy-api, letbuyy-queue-workers, letbuyy-webhook · Queues: EVENT_QUEUE
Secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, STEP_UP_SIGNING_SECRET, PAYMENT_CONFIG_ENCRYPTION_KEY
Security: money path (SECURITY DEFINER RPCs, canonical-ledger-only); tenant-scoped (RLS + verifySiteOwnership).
Failure impact: Refunds stuck or double-refunded; chargebacks; ledger drift.
Query without scanning: /api/domain?key=refunds · /api/change-impact?key=refunds · /api/incident-intelligence?domain=refunds
```

```
# LetBuyy domain: Payouts
Purpose: Settles merchant earnings — settlement, commission, partner payout ledgers.
Criticality: Tier 1 — critical (money path)
Owner: @saai-sidd
Depends on: operations
Consumed by: payments, operations
Routes (4): cod-reconciliation, commission, payouts, settlements
RPCs (5): post_settlement_ledger_transaction, sync_payout_statement_money_bigint, sync_commission_reconciliation_money_bigint, claim_payout_statement_release, sync_cod_reconciliation_money_bigint
Tables (10): partner_payout_ledger_entries, payout_statements, commission_schedules, commission_reconciliation_entries, payout_reconciliation_records, payout_disputes, cod_reconciliation_entries, settlements, payouts, payout_items
Workers: letbuyy-api, letbuyy-queue-workers, letbuyy-webhook · Queues: EVENT_QUEUE
Secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, STEP_UP_SIGNING_SECRET, PAYMENT_CONFIG_ENCRYPTION_KEY
Security: money path (SECURITY DEFINER RPCs, canonical-ledger-only); tenant-scoped (RLS + verifySiteOwnership).
Failure impact: Merchants unpaid; settlement disputes.
Query without scanning: /api/domain?key=payouts · /api/change-impact?key=payouts · /api/incident-intelligence?domain=payouts
```

```
# LetBuyy domain: Payments
Purpose: Authorizes and captures money (Razorpay + COD) and posts it to the canonical double-entry ledger.
Criticality: Tier 1 — critical (money path)
Owner: @saai-sidd
Depends on: orders, analytics, payouts, gift-cards, refunds
Consumed by: refunds, operations, orders
Routes (3): payments, storefront/checkout-payment-routes, storefront/internal-payment-routes
RPCs (18): attach_order_payment_reference, attach_order_payment_reference_with_ledger, confirm_order_payment, confirm_order_payment_with_ledger, record_order_payment_failure, record_order_payment_failure_with_ledger, reject_ledger_mutation, enforce_ledger_transaction_balance, ensure_ledger_account, post_ledger_transaction, ledger_balance_breaks, sync_wallet_ledger_money_bigint, ledger_account_balance_minor, refresh_money_ledger_site_reconciliation, assert_money_ledger_site_reconciliation, backfill_wallet_ledger_to_canonical, money_ledger_source_uuid, resolve_money_ledger_source_site_id
Tables (11): payment_attempts, payment_transactions, payment_webhook_events, ledger_accounts, ledger_transactions, ledger_entries, payment_credentials, payment_tokens, payments, store_credit_ledger_entries, money_ledger_site_reconciliations
Workers: letbuyy-api, letbuyy-queue-workers, letbuyy-webhook · Queues: EVENT_QUEUE
Secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, STEP_UP_SIGNING_SECRET, CHECKOUT_SIGNING_SECRET, PAYMENT_CONFIG_ENCRYPTION_KEY
Security: money path (SECURITY DEFINER RPCs, canonical-ledger-only); tenant-scoped (RLS + verifySiteOwnership).
Failure impact: Payments fail or mis-post; revenue and ledger integrity at risk.
Query without scanning: /api/domain?key=payments · /api/change-impact?key=payments · /api/incident-intelligence?domain=payments
```

```
# LetBuyy domain: GST & Tax
Purpose: Computes India GST server-side and issues immutable invoices.
Criticality: Tier 2 — important (tenant data)
Owner: @saai-sidd
Depends on: none
Consumed by: none
Routes (1): tax
RPCs (1): reject_gst_invoice_mutation
Tables (6): order_tax_lines, tax_rates, tax_registrations, tax_overrides, gst_invoices, merchant_billing_invoices
Workers: letbuyy-api, letbuyy-queue-workers · Queues: EVENT_QUEUE
Secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
Security: standard; tenant-scoped (RLS + verifySiteOwnership).
Failure impact: Wrong tax; non-compliant invoices; legal exposure.
Query without scanning: /api/domain?key=gst · /api/change-impact?key=gst · /api/incident-intelligence?domain=gst
```

```
# LetBuyy domain: Discounts
Purpose: Applies coupons, promotions and marketing campaigns at checkout.
Criticality: Tier 2 — important (tenant data)
Owner: @saai-sidd
Depends on: none
Consumed by: orders, operations
Routes (2): coupons, marketing
RPCs (2): evaluate_checkout_promotion, record_deployment_promotion_run
Tables (11): deployment_promotion_runs, coupons, promotion_codes, promotion_effects, promotion_redemptions, promotion_rules, promotion_usage_counters, promotions, marketing_email_campaigns, marketing_email_recipients, discount_allocations
Workers: letbuyy-api, letbuyy-queue-workers · Queues: EVENT_QUEUE
Secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
Security: standard; tenant-scoped (RLS + verifySiteOwnership).
Failure impact: Wrong pricing; promo abuse; lost margin.
Query without scanning: /api/domain?key=discounts · /api/change-impact?key=discounts · /api/incident-intelligence?domain=discounts
```

```
# LetBuyy domain: Shipping
Purpose: Manages shipping zones/rates, fulfillment orders, shipments and labels.
Criticality: Tier 1 — critical (money path)
Owner: @saai-sidd
Depends on: orders, inventory, analytics
Consumed by: orders, operations
Routes (3): shipping-labels, shipping-tax, shipping
RPCs (1): create_order_fulfillment
Tables (10): fulfillment_order_lines, fulfillment_orders, order_shipping_lines, shipment_events, shipments, shipping_rates, shipping_zones, shipping_labels, shipping_profiles, shipping_serviceability_rules
Workers: letbuyy-api, letbuyy-queue-workers · Queues: EVENT_QUEUE
Secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
Security: money path (SECURITY DEFINER RPCs, canonical-ledger-only); tenant-scoped (RLS + verifySiteOwnership).
Failure impact: Orders cannot ship; tracking breaks.
Query without scanning: /api/domain?key=shipping · /api/change-impact?key=shipping · /api/incident-intelligence?domain=shipping
```

```
# LetBuyy domain: Inventory
Purpose: Tracks stock levels, reservations, transfers and adjustments per location.
Criticality: Tier 1 — critical (money path)
Owner: @saai-sidd
Depends on: products, orders, analytics, merchant
Consumed by: orders, refunds, operations, shipping
Routes (1): inventory
RPCs (18): adjust_inventory_level, create_inventory_transfer_with_lines, create_order_with_inventory_reservations, ensure_default_inventory_location, ensure_inventory_level_for_location, receive_inventory_transfer, receive_inventory_transfer_line, release_order_inventory, release_order_inventory_with_ledger, set_inventory_level_available, ship_inventory_transfer, set_inventory_levels_available_batch, set_inventory_level_store_id, require_inventory_site_guc, reserve_inventory, commit_inventory_reservation, release_inventory_reservation, expire_inventory_reservations
Tables (9): inventory_transfer_lines, inventory_transfers, inventory_adjustments, inventory_events, inventory_level_duplicate_snapshots, inventory_levels, inventory_locations, inventory_reservations, inventory_transfer_receipts
Workers: letbuyy-api, letbuyy-queue-workers · Queues: EVENT_QUEUE
Secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
Security: money path (SECURITY DEFINER RPCs, canonical-ledger-only); tenant-scoped (RLS + verifySiteOwnership).
Failure impact: Overselling or false out-of-stock; checkout failures.
Query without scanning: /api/domain?key=inventory · /api/change-impact?key=inventory · /api/incident-intelligence?domain=inventory
```

```
# LetBuyy domain: Collections
Purpose: Groups products into collections and categories for merchandising.
Criticality: Tier 2 — important (tenant data)
Owner: @saai-sidd
Depends on: none
Consumed by: none
Routes (1): categories
RPCs (0): 
Tables (4): blog_categories, collection_products, collections, smart_collections
Workers: letbuyy-api, letbuyy-queue-workers · Queues: SEARCH_QUEUE, EVENT_QUEUE
Secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
Security: standard; tenant-scoped (RLS + verifySiteOwnership).
Failure impact: Broken navigation; products undiscoverable.
Query without scanning: /api/domain?key=collections · /api/change-impact?key=collections · /api/incident-intelligence?domain=collections
```

```
# LetBuyy domain: Products
Purpose: The catalog — products, options, variants and metafields.
Criticality: Tier 1 — critical (high fan-in)
Owner: @saai-sidd
Depends on: none
Consumed by: inventory, operations, orders
Routes (2): metafields, products
RPCs (5): sync_product_review_moderation_status, report_products_variants_reconciliation, backfill_product_variants_from_jsonb, refresh_products_variants_jsonb_cache, reconcile_products_variants_dual_model
Tables (10): production_incidents, production_readiness_gate_runs, product_options, product_reviews, product_variants, production_db_rollout_plans, production_incident_events, products, store_metafield_definitions, store_metafield_values
Workers: letbuyy-api, letbuyy-queue-workers · Queues: SEARCH_QUEUE, EVENT_QUEUE
Secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
Security: standard; tenant-scoped (RLS + verifySiteOwnership).
Failure impact: Catalog unavailable; storefront empty.
Query without scanning: /api/domain?key=products · /api/change-impact?key=products · /api/incident-intelligence?domain=products
```

```
# LetBuyy domain: Orders
Purpose: Captures and orchestrates the order lifecycle — cart → checkout → order → fulfillment.
Criticality: Tier 1 — critical (money path)
Owner: @saai-sidd
Depends on: inventory, gift-cards, discounts, shipping, analytics, payments, products
Consumed by: inventory, payments, refunds, operations, shipping
Routes (3): checkout, order-risk, orders
RPCs (12): create_checkout_order, create_purchase_order_with_lines, generate_order_number, receive_purchase_order, receive_purchase_order_line, fill_order_item_required_fields, set_pending_cod_order_status, backfill_order_items_from_jsonb, refresh_orders_items_jsonb_cache, sync_order_items_store_id, prevent_checkout_order_immutable_update, sync_order_items_site_id
Tables (10): purchase_order_lines, purchase_orders, carts, checkout_sessions, order_items, order_line_adjustments, orders, purchase_order_receipts, draft_order_lines, order_risk_assessments
Workers: letbuyy-api, letbuyy-queue-workers · Queues: RUNTIME_QUEUE, EVENT_QUEUE
Secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, CHECKOUT_SIGNING_SECRET
Security: money path (SECURITY DEFINER RPCs, canonical-ledger-only); tenant-scoped (RLS + verifySiteOwnership).
Failure impact: Checkout breaks; no new orders; revenue stops.
Query without scanning: /api/domain?key=orders · /api/change-impact?key=orders · /api/incident-intelligence?domain=orders
```

```
# LetBuyy domain: Storefront
Purpose: The customer-facing store rendered per tenant (Liquid/React) with cart and public pages.
Criticality: Tier 2 — important (tenant data)
Owner: @saai-sidd
Depends on: analytics
Consumed by: operations, themes
Routes (14): blog, contacts, custom-domains, domains, form-submissions, internal-custom-domain-reconcile, pages, reviews, storefront/cart-routes, storefront/customer-engagement-routes, storefront/customer-registration, storefront/public-routes, storefront, stores-localization
RPCs (4): claim_platform_queue_jobs, complete_platform_queue_job, fail_platform_queue_job, quarantine_platform_queue_job
Tables (21): platform_queue_jobs, blog_comments, blog_post_tags, blog_posts, blog_tags, contact_submissions, contacts, customer_wishlists, form_submissions, lead_forms, pages, storefront_cache_tags, storefront_page_revisions, storefront_pages, storefront_policies, storefront_slug_redirects, wishlists, platform_queue_jobs_partitioned, review_check_runs, storefront_locales, storefront_translations
Workers: letbuyy-api, letbuyy-queue-workers · Queues: RUNTIME_QUEUE, SEARCH_QUEUE, EVENT_QUEUE
Secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, TURNSTILE_SECRET_KEY, UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
Security: standard; tenant-scoped (RLS + verifySiteOwnership).
Failure impact: Store down; no traffic converts.
Query without scanning: /api/domain?key=storefront · /api/change-impact?key=storefront · /api/incident-intelligence?domain=storefront
```

```
# LetBuyy domain: Authorization
Purpose: RBAC, permissions, entitlements and step-up HMAC gating refunds/payouts.
Criticality: Tier 2 — important (tenant data)
Owner: @saai-sidd
Depends on: merchant
Consumed by: operations
Routes (2): operations/rbac, two-factor
RPCs (2): get_usage_limit_from_entitlements, resolve_site_entitlements
Tables (9): employee_permissions, plan_entitlements, site_entitlement_overrides, site_memberships, site_role_permissions, step_up_challenges, org_memberships, team_memberships, store_memberships
Workers: letbuyy-api, letbuyy-queue-workers · Queues: EVENT_QUEUE
Secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, STEP_UP_SIGNING_SECRET, LETBUYY_IDENTITY_PUBLIC_JWKS
Security: standard; tenant-scoped (RLS + verifySiteOwnership).
Failure impact: Privilege escalation or blocked operators.
Query without scanning: /api/domain?key=authorization · /api/change-impact?key=authorization · /api/incident-intelligence?domain=authorization
```

```
# LetBuyy domain: Authentication
Purpose: Issues sessions — customer HS256, merchant ES256 — with Turnstile and 2FA.
Criticality: Tier 2 — important (tenant data)
Owner: @saai-sidd
Depends on: operations
Consumed by: none
Routes (1): auth
RPCs (2): authorize_runtime_replay_operation, validate_and_rotate_merchant_session
Tables (10): customer_credentials, sessions, auth_password_set_intents, impersonation_sessions, wa_sessions, credentials, authenticators, sessions_v2, authorization_codes, session_token_rotation_events
Workers: letbuyy-api, letbuyy-queue-workers · Queues: EVENT_QUEUE
Secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, AUTH_SECRET, CSRF_SECRET, CUSTOMER_SESSION_SECRET, LETBUYY_IDENTITY_PUBLIC_JWKS, TURNSTILE_SECRET_KEY, UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
Security: standard; tenant-scoped (RLS + verifySiteOwnership).
Failure impact: Logins fail or sessions forgeable; account takeover risk.
Query without scanning: /api/domain?key=authentication · /api/change-impact?key=authentication · /api/incident-intelligence?domain=authentication
```

```
# LetBuyy domain: Identity
Purpose: Customer + merchant identity records, KYC and onboarding.
Criticality: Tier 2 — important (tenant data)
Owner: @saai-sidd
Depends on: none
Consumed by: none
Routes (2): customers, kyc
RPCs (1): update_store_customers_updated_at
Tables (8): customer_activity_log, customer_addresses, store_customers, customer_notes, customer_tags, customer_segments, customer_whatsapp_messages, customer_dsr_exports
Workers: letbuyy-api, letbuyy-queue-workers · Queues: EVENT_QUEUE
Secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, CUSTOMER_SESSION_SECRET, LETBUYY_IDENTITY_PUBLIC_JWKS
Security: standard; tenant-scoped (RLS + verifySiteOwnership).
Failure impact: Cannot identify/onboard; KYC gaps.
Query without scanning: /api/domain?key=identity · /api/change-impact?key=identity · /api/incident-intelligence?domain=identity
```

```
# LetBuyy domain: Merchant
Purpose: Stores/sites, memberships, employees, billing and onboarding.
Criticality: Tier 1 — critical (high fan-in)
Owner: @saai-sidd
Depends on: none
Consumed by: inventory, analytics, marketplace, themes, authorization, operations
Routes (5): billing, employee, internal-billing, onboarding, stores
RPCs (4): record_site_usage, stores_delete_fn, stores_insert_fn, stores_update_fn
Tables (20): site_usage_meters, billing_history, employee_invites, employee_roles, employees, onboarding_attempts, site_roles, sites, site_preview_links, site_gate_attempts, site_domain_reviews, store_surveys, merchant_kyc_documents, merchant_2fa_factors, store_markets, store_branding, billing_mandates, billing_dunning_events, billing_usage_events, store_credit
Workers: letbuyy-api, letbuyy-queue-workers · Queues: EVENT_QUEUE
Secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
Security: standard; tenant-scoped (RLS + verifySiteOwnership).
Failure impact: Merchant management down; onboarding blocked.
Query without scanning: /api/domain?key=merchant · /api/change-impact?key=merchant · /api/incident-intelligence?domain=merchant
```

```
# LetBuyy domain: Notifications
Purpose: Transactional + lifecycle email (Resend), WhatsApp and tickets.
Criticality: Tier 2 — important (tenant data)
Owner: @saai-sidd
Depends on: operations
Consumed by: operations
Routes (3): email, notifications, whatsapp
RPCs (6): claim_distributed_queue_messages, complete_distributed_queue_message, create_notification, dead_letter_distributed_queue_message, heartbeat_distributed_queue_message, retry_distributed_queue_message
Tables (15): distributed_queue_messages, email_logs, notification_preferences, notifications, support_tickets, ticket_macros, ticket_messages, ticket_sla_clocks, ticket_csat, notification_logs, notification_suppressions, email_suppressions, wa_templates, wa_optins, whatsapp_messages
Workers: letbuyy-api, letbuyy-queue-workers, letbuyy-webhook · Queues: NOTIFICATION_QUEUE, EVENT_QUEUE
Secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, QUEUE_TENANT_ENVELOPE_SECRET, RESEND_API_KEY
Security: standard; tenant-scoped (RLS + verifySiteOwnership).
Failure impact: Customers not notified; support degraded.
Query without scanning: /api/domain?key=notifications · /api/change-impact?key=notifications · /api/incident-intelligence?domain=notifications
```

```
# LetBuyy domain: Analytics
Purpose: Event stream, rollups, projections and exports.
Criticality: Tier 1 — critical (high fan-in)
Owner: @saai-sidd
Depends on: operations, merchant
Consumed by: inventory, payments, refunds, operations, orders, themes, shipping, storefront
Routes (4): analytics, export, internal-events, portfolio
RPCs (13): append_distributed_event, archive_distributed_events, claim_outbox_events, complete_outbox_event, fail_outbox_event, increment_analytics_rollup, log_audit_event, record_projection_operation_snapshot, record_security_enforcement_event, record_tenant_operation_projection, replay_outbox_dead_letter, validate_event_stream_consistency, refresh_commerce_analytics_daily_mv
Tables (36): outbox_events, analytics_rollups_daily, projection_operation_snapshots, security_enforcement_events, tenant_operation_projections, event_store_integrity_checks, analytics_event_stream, analytics_events, audit_activity_events, cache_invalidation_events, distributed_event_store, distributed_event_streams, event_stream_snapshots, operation_metrics, operational_feature_flag_audit_events, outbox_dead_letters, portfolio_projects, projection_checkpoints, projection_rebuilds, projection_store, provider_outage_events, restock_events, runtime_event_retention_policies, runtime_health_projections, runtime_secret_rotation_events …
Workers: letbuyy-api, letbuyy-queue-workers · Queues: ANALYTICS_QUEUE, EVENT_QUEUE
Secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, QUEUE_TENANT_ENVELOPE_SECRET
Security: standard; tenant-scoped (RLS + verifySiteOwnership).
Failure impact: Reporting stale; projections lag.
Query without scanning: /api/domain?key=analytics · /api/change-impact?key=analytics · /api/incident-intelligence?domain=analytics
```

```
# LetBuyy domain: Internal Operations
Purpose: Internal ops — incidents, RBAC, risk, trust & safety, reconciliation.
Criticality: Tier 1 — critical (money path)
Owner: @saai-sidd
Depends on: products, notifications, orders, analytics, inventory, storefront, payments, refunds, payouts, gift-cards, discounts, shipping, authorization, merchant, themes
Consumed by: authentication, notifications, analytics, payouts
Routes (11): admin, internal-console/compliance, internal-console/money-reconciliation, internal-console, internal-store-access, operations/incident-command, operations/risk, operations/support, operations/trust-safety, operations, security
RPCs (18): claim_operational_control_command, claim_runtime_lease, inspect_distributed_queue, is_super_admin, record_operational_certification_report, record_operational_dashboard_snapshot, record_operational_feature_flag_exposure, record_production_incident, record_production_readiness_gate_run, record_runtime_diagnostic, recover_stuck_distributed_queue_leases, redrive_distributed_dead_letters, schedule_runtime_replay_operation, update_production_incident_status, record_dual_model_reconciliation_report, report_orders_items_reconciliation, reconcile_orders_items_dual_model, reconcile_cod_remittance_with_ledger
Tables (34): runtime_replay_executions, runtime_control_commands, runtime_leases, operational_certification_reports, operational_dashboard_snapshots, operational_feature_flag_exposures, runtime_diagnostics, audit_logs, cache_operation_snapshots, coordination_operation_diagnostics, database_operation_snapshots, distributed_queue_heartbeats, execution_audit_trail, operational_feature_flags, queue_operation_snapshots, queue_recovery_operations, regional_execution_diagnostics, replay_operation_schedules, runtime_alert_evaluations, runtime_checkpoints, runtime_command_journal, runtime_deployment_topology_records, runtime_slo_definitions, runtime_structured_logs, runtime_telemetry_spans …
Workers: letbuyy-api, letbuyy-queue-workers · Queues: EVENT_QUEUE
Secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, INTERNAL_API_SECRET, LETBUYY_INTERNAL_API_SECRET, INTERNAL_API_KEYRING, QUEUE_TENANT_ENVELOPE_SECRET, PLATFORM_CONSOLE_API_TOKEN, UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
Security: money path (SECURITY DEFINER RPCs, canonical-ledger-only); tenant-scoped (RLS + verifySiteOwnership).
Failure impact: Ops blind; incident response degraded.
Query without scanning: /api/domain?key=operations · /api/change-impact?key=operations · /api/incident-intelligence?domain=operations
```


> Auto-generated by `pnpm graph:explain` from the LCIS Explain model (repository truth in prose). Live values stay query-bound. Open the Explain mode at http://localhost:3333 for the interactive version.
