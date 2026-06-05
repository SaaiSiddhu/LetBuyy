-- P2-5 search performance fast win.
-- 079-083 are Phase 5 partition migrations in the implementation runbook.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_products_name_trgm
    ON public.products USING gin (name gin_trgm_ops)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_orders_order_number_trgm
    ON public.orders USING gin (order_number gin_trgm_ops)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_orders_customer_email_trgm
    ON public.orders USING gin (customer_email gin_trgm_ops)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_orders_customer_name_trgm
    ON public.orders USING gin (customer_name gin_trgm_ops)
    WHERE deleted_at IS NULL AND customer_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_marketplace_apps_name_trgm
    ON public.marketplace_apps USING gin (name gin_trgm_ops)
    WHERE status = 'published';

CREATE INDEX IF NOT EXISTS idx_marketplace_apps_tagline_trgm
    ON public.marketplace_apps USING gin (tagline gin_trgm_ops)
    WHERE status = 'published' AND tagline IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_themes_name_trgm
    ON public.themes USING gin (name gin_trgm_ops)
    WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_themes_description_trgm
    ON public.themes USING gin (description gin_trgm_ops)
    WHERE is_active = true AND description IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sites_name_trgm
    ON public.sites USING gin (name gin_trgm_ops)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_sites_store_name_trgm
    ON public.sites USING gin (store_name gin_trgm_ops)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_sites_subdomain_trgm
    ON public.sites USING gin (subdomain gin_trgm_ops)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_sites_custom_domain_trgm
    ON public.sites USING gin (custom_domain gin_trgm_ops)
    WHERE deleted_at IS NULL AND custom_domain IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_custom_email_trgm
    ON public.users_custom USING gin (email gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_users_custom_full_name_trgm
    ON public.users_custom USING gin (full_name gin_trgm_ops)
    WHERE full_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_trgm
    ON public.subscriptions USING gin (plan gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_subscriptions_status_trgm
    ON public.subscriptions USING gin (status gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_subscriptions_payment_gateway_trgm
    ON public.subscriptions USING gin (payment_gateway gin_trgm_ops)
    WHERE payment_gateway IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subscriptions_external_id_trgm
    ON public.subscriptions USING gin (external_subscription_id gin_trgm_ops)
    WHERE external_subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_employees_email_trgm
    ON public.employees USING gin (email gin_trgm_ops)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_employees_full_name_trgm
    ON public.employees USING gin (full_name gin_trgm_ops)
    WHERE deleted_at IS NULL AND full_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_employees_role_trgm
    ON public.employees USING gin (role gin_trgm_ops)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_email_trgm
    ON public.audit_logs USING gin (actor_email gin_trgm_ops)
    WHERE actor_email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_logs_action_trgm
    ON public.audit_logs USING gin (action gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_type_trgm
    ON public.audit_logs USING gin (resource_type gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_type_trgm
    ON public.audit_logs USING gin (actor_type gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_media_filename_trgm
    ON public.media USING gin (filename gin_trgm_ops)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_media_original_name_trgm
    ON public.media USING gin (original_name gin_trgm_ops)
    WHERE deleted_at IS NULL AND original_name IS NOT NULL;
