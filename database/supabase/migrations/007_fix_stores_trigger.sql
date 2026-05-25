-- ============================================
-- Migration 007: Fix stores view trigger
-- The RETURNING * INTO NEW caused a column mismatch
-- because sites table has different columns than
-- the stores view. Fix: don't overwrite NEW.
-- ============================================

-- Fix the insert trigger function
CREATE OR REPLACE FUNCTION stores_insert_fn()
RETURNS TRIGGER AS $$
DECLARE
    inserted_row sites%ROWTYPE;
BEGIN
    INSERT INTO sites (
        user_id, custom_user_id, name, store_name, tagline, logo_url, favicon_url,
        site_type, subdomain, custom_domain, theme_id, theme_settings,
        template_config, sections, status
    ) VALUES (
        NEW.user_id,
        NEW.custom_user_id,
        COALESCE(NEW.name, NEW.display_name, NEW.store_name),
        NEW.store_name,
        COALESCE(NEW.tagline, NEW.description),
        NEW.logo_url,
        NEW.favicon_url,
        NEW.site_type,
        COALESCE(NEW.subdomain, NEW.store_name),
        NEW.custom_domain,
        COALESCE(NEW.theme_id, 'modern'),
        COALESCE(NEW.theme_settings, '{}'),
        COALESCE(NEW.template_config, '{}'),
        COALESCE(NEW.sections, '[]'),
        COALESCE(NEW.status, 'draft')
    )
    RETURNING * INTO inserted_row;

    -- Map sites columns back to the view's NEW record
    NEW.id := inserted_row.id;
    NEW.subdomain := inserted_row.subdomain;
    NEW.status := inserted_row.status;
    NEW.created_at := inserted_row.created_at;
    NEW.updated_at := inserted_row.updated_at;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
