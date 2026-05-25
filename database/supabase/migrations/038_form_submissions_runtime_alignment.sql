-- ============================================================================
-- Form submissions runtime alignment
-- Migration: 038_form_submissions_runtime_alignment.sql
-- Purpose:
--   Align admin Contact/Leads screens with durable database columns while keeping
--   the existing JSONB payload available for custom forms.
-- ============================================================================

ALTER TABLE form_submissions
    ADD COLUMN IF NOT EXISTS full_name TEXT,
    ADD COLUMN IF NOT EXISTS email TEXT,
    ADD COLUMN IF NOT EXISTS phone TEXT,
    ADD COLUMN IF NOT EXISTS subject TEXT,
    ADD COLUMN IF NOT EXISTS message TEXT,
    ADD COLUMN IF NOT EXISTS source TEXT;

ALTER TABLE form_submissions
    DROP CONSTRAINT IF EXISTS form_submissions_status_check;

ALTER TABLE form_submissions
    ADD CONSTRAINT form_submissions_status_check
    CHECK (status IN ('new', 'read', 'replied', 'contacted', 'converted', 'archived', 'spam'));

UPDATE form_submissions
SET
    full_name = COALESCE(full_name, data->>'full_name', data->>'name', data->>'customer_name'),
    email = COALESCE(email, data->>'email', data->>'customer_email'),
    phone = COALESCE(phone, data->>'phone', data->>'customer_phone'),
    subject = COALESCE(subject, data->>'subject', form_name),
    message = COALESCE(message, data->>'message', data->>'body', data->>'notes'),
    source = COALESCE(source, data->>'source', source_url, form_type)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_form_submissions_store_type_status_active
    ON form_submissions(store_id, form_type, status, created_at DESC)
    WHERE deleted_at IS NULL;
