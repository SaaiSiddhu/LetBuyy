-- ============================================================================
-- Pages runtime alignment
-- Migration: 039_pages_runtime_alignment.sql
-- Purpose:
--   Standardize custom storefront pages around store_id while preserving legacy
--   content/html columns and adding the fields used by admin storefront pages.
-- ============================================================================

ALTER TABLE pages
    ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES sites(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS body TEXT,
    ADD COLUMN IF NOT EXISTS page_type TEXT DEFAULT 'custom',
    ADD COLUMN IF NOT EXISTS show_in_nav BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'pages'
          AND column_name = 'site_id'
    ) THEN
        EXECUTE 'UPDATE pages SET store_id = COALESCE(store_id, site_id) WHERE store_id IS NULL';
    END IF;
END $$;

UPDATE pages
SET body = COALESCE(body, html_content, content->>'body', content->>'html', ''),
    page_type = COALESCE(page_type, 'custom'),
    show_in_nav = COALESCE(show_in_nav, false),
    published_at = CASE
        WHEN status = 'published' THEN COALESCE(published_at, updated_at, NOW())
        ELSE published_at
    END
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_pages_store_status_active
    ON pages(store_id, status, updated_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_pages_store_slug_active
    ON pages(store_id, slug)
    WHERE deleted_at IS NULL;
