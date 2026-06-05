-- Scope theme editor drafts by template while preserving the legacy index draft.

ALTER TABLE public.theme_editor_drafts
    ADD COLUMN IF NOT EXISTS template_key text;

UPDATE public.theme_editor_drafts
SET template_key = 'index'
WHERE template_key IS NULL;

ALTER TABLE public.theme_editor_drafts
    ALTER COLUMN template_key SET DEFAULT 'index',
    ALTER COLUMN template_key SET NOT NULL;

ALTER TABLE public.theme_editor_drafts
    DROP CONSTRAINT IF EXISTS theme_editor_drafts_template_key_check;

ALTER TABLE public.theme_editor_drafts
    ADD CONSTRAINT theme_editor_drafts_template_key_check
    CHECK (template_key ~ '^[a-z0-9][a-z0-9_-]{0,79}$');

ALTER TABLE ONLY public.theme_editor_drafts
    DROP CONSTRAINT IF EXISTS theme_editor_drafts_store_id_theme_id_key;

ALTER TABLE ONLY public.theme_editor_drafts
    DROP CONSTRAINT IF EXISTS theme_editor_drafts_store_id_theme_id_template_key_key;

ALTER TABLE ONLY public.theme_editor_drafts
    ADD CONSTRAINT theme_editor_drafts_store_id_theme_id_template_key_key
    UNIQUE (store_id, theme_id, template_key);

CREATE INDEX IF NOT EXISTS idx_theme_editor_drafts_store_theme_template
    ON public.theme_editor_drafts USING btree (store_id, theme_id, template_key)
    WHERE deleted_at IS NULL;

COMMENT ON COLUMN public.theme_editor_drafts.template_key IS
    'Theme template key for template-scoped editor drafts. Legacy drafts default to index.';
