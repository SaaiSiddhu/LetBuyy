-- Wave 8 marketplace scale services: search vector, analytics queue indexing, and media-service guardrails.

ALTER TABLE public.marketplace_apps
    ADD COLUMN IF NOT EXISTS search_vector tsvector;

CREATE OR REPLACE FUNCTION public.update_marketplace_apps_search_vector()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('simple', coalesce(NEW.name, '')), 'A') ||
        setweight(to_tsvector('simple', coalesce(NEW.tagline, '')), 'A') ||
        setweight(to_tsvector('simple', coalesce(array_to_string(NEW.tags, ' '), '')), 'B') ||
        setweight(to_tsvector('simple', coalesce(array_to_string(NEW.compatibility_tags, ' '), '')), 'B') ||
        setweight(to_tsvector('simple', coalesce(array_to_string(NEW.supported_site_types, ' '), '')), 'C') ||
        setweight(to_tsvector('simple', coalesce(NEW.description, '')), 'D');
    RETURN NEW;
END;
$$;

UPDATE public.marketplace_apps
   SET search_vector =
        setweight(to_tsvector('simple', coalesce(name, '')), 'A') ||
        setweight(to_tsvector('simple', coalesce(tagline, '')), 'A') ||
        setweight(to_tsvector('simple', coalesce(array_to_string(tags, ' '), '')), 'B') ||
        setweight(to_tsvector('simple', coalesce(array_to_string(compatibility_tags, ' '), '')), 'B') ||
        setweight(to_tsvector('simple', coalesce(array_to_string(supported_site_types, ' '), '')), 'C') ||
        setweight(to_tsvector('simple', coalesce(description, '')), 'D')
 WHERE search_vector IS NULL;

DROP TRIGGER IF EXISTS update_marketplace_apps_search_vector ON public.marketplace_apps;
CREATE TRIGGER update_marketplace_apps_search_vector
    BEFORE INSERT OR UPDATE OF name, tagline, description, tags, compatibility_tags, supported_site_types
    ON public.marketplace_apps
    FOR EACH ROW
    EXECUTE FUNCTION public.update_marketplace_apps_search_vector();

CREATE INDEX IF NOT EXISTS idx_marketplace_apps_search_vector
    ON public.marketplace_apps USING gin (search_vector)
    WHERE ((status = 'published'::text) AND (deleted_at IS NULL));

CREATE INDEX IF NOT EXISTS idx_platform_queue_jobs_marketplace_analytics
    ON public.platform_queue_jobs USING btree (job_type, status, available_at, created_at)
    WHERE ((queue_name = 'analytics-events'::text) AND (job_type LIKE 'marketplace.%') AND (deleted_at IS NULL));

COMMENT ON COLUMN public.marketplace_apps.search_vector IS
    'Wave 8 marketplace search-service vector. Gateway search falls back to ILIKE until this migration is applied locally/prod.';

COMMENT ON INDEX public.idx_platform_queue_jobs_marketplace_analytics IS
    'Wave 8 analytics-pipeline sink index for queued marketplace discovery and telemetry events.';
