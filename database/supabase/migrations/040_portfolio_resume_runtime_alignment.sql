-- ============================================================================
-- Portfolio/resume runtime alignment
-- Migration: 040_portfolio_resume_runtime_alignment.sql
-- Purpose:
--   Preserve legacy portfolio/resume tables while adding stable columns expected
--   by admin content modules and worker contracts.
-- ============================================================================

ALTER TABLE skills
    ADD COLUMN IF NOT EXISTS proficiency INT DEFAULT 50 CHECK (proficiency BETWEEN 0 AND 100);

ALTER TABLE education
    ADD COLUMN IF NOT EXISTS grade TEXT,
    ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE testimonials
    ADD COLUMN IF NOT EXISTS is_visible BOOLEAN DEFAULT true;

ALTER TABLE work_experience
    ADD COLUMN IF NOT EXISTS role TEXT,
    ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE portfolio_projects
    ADD COLUMN IF NOT EXISTS url TEXT,
    ADD COLUMN IF NOT EXISTS image_url TEXT,
    ADD COLUMN IF NOT EXISTS technologies TEXT[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS is_visible BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS start_date DATE,
    ADD COLUMN IF NOT EXISTS end_date DATE;

UPDATE skills
SET proficiency = COALESCE(proficiency, proficiency_level, 50)
WHERE deleted_at IS NULL;

UPDATE education
SET grade = COALESCE(grade, gpa::TEXT),
    description = COALESCE(description, array_to_string(honors, ', '))
WHERE deleted_at IS NULL;

UPDATE testimonials
SET is_visible = COALESCE(is_visible, true)
WHERE deleted_at IS NULL;

UPDATE work_experience
SET role = COALESCE(role, position),
    description = COALESCE(description, array_to_string(responsibilities, E'\n'))
WHERE deleted_at IS NULL;

UPDATE portfolio_projects
SET url = COALESCE(url, live_url, project_url),
    image_url = COALESCE(image_url, thumbnail_url, cover_image),
    technologies = COALESCE(technologies, tags, categories, '{}'),
    is_visible = COALESCE(is_visible, status IS DISTINCT FROM 'archived')
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_skills_store_active ON skills(store_id, display_order) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_education_store_active ON education(store_id, display_order) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_work_experience_store_active ON work_experience(store_id, display_order) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_certifications_store_active ON certifications(store_id, display_order) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_testimonials_store_active ON testimonials(store_id, display_order) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_portfolio_projects_store_active ON portfolio_projects(store_id, display_order) WHERE deleted_at IS NULL;
