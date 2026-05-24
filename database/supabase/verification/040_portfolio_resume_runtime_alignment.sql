-- Verification for 040_portfolio_resume_runtime_alignment.sql

SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    (table_name = 'skills' AND column_name = 'proficiency')
    OR (table_name = 'education' AND column_name IN ('grade', 'description'))
    OR (table_name = 'testimonials' AND column_name = 'is_visible')
    OR (table_name = 'work_experience' AND column_name IN ('role', 'description'))
    OR (table_name = 'portfolio_projects' AND column_name IN ('url', 'image_url', 'technologies', 'tags', 'is_visible', 'start_date', 'end_date'))
  )
ORDER BY table_name, column_name;

SELECT indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'idx_skills_store_active',
    'idx_education_store_active',
    'idx_work_experience_store_active',
    'idx_certifications_store_active',
    'idx_testimonials_store_active',
    'idx_portfolio_projects_store_active'
  )
ORDER BY indexname;
