-- Theme preview sessions can now point at the release-engine draft table.
-- The legacy draft_id remains for compatibility during rollout.

ALTER TABLE theme_preview_sessions
    ADD COLUMN IF NOT EXISTS theme_instance_draft_id UUID;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'theme_preview_sessions_instance_draft_fk'
    ) THEN
        ALTER TABLE theme_preview_sessions
            ADD CONSTRAINT theme_preview_sessions_instance_draft_fk
            FOREIGN KEY (theme_instance_draft_id)
            REFERENCES theme_instance_drafts(id)
            ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_theme_preview_sessions_instance_draft
    ON theme_preview_sessions(theme_instance_draft_id)
    WHERE theme_instance_draft_id IS NOT NULL;

COMMENT ON COLUMN theme_preview_sessions.theme_instance_draft_id IS
    'Optional pointer to theme_instance_drafts for release-engine previews. Legacy draft_id remains during migration.';
