-- 227: mobile release gating (CAP-FB-APPUPDATE, under D-9).
--
-- ============================================================================
-- WHY THIS IS NOT app_versions
-- ============================================================================
-- public.app_versions already exists and looks like coverage. It is not: it carries app_id and
-- developer_id and belongs to the FROZEN app marketplace, where a third-party developer publishes
-- versions of an installable app. Nothing canonical answers the different question this table
-- answers -- "is this build of OUR mobile app still allowed to run".
--
-- ============================================================================
-- WHY THE POLICY LIVES HERE AND NOT IN THE CLIENT
-- ============================================================================
-- customer_app currently reads Firestore's app_updates, takes the newest active row, reads its own
-- buildNumber, and compares CLIENT-SIDE. The honest argument for moving that is not "a client cannot
-- bypass a server decision" -- any client can ignore any response. It is:
--
--   1. The comparison exists once, correctly, instead of being re-implemented in each app. A
--      client-side compare that treats a build as a string ranks "10" below "9" and silently stops
--      gating, and nothing would report it.
--   2. The threshold can change WITHOUT SHIPPING AN APP RELEASE. When a shipped build turns out to be
--      broken, that is the only lever available -- and customer_app is live on the Play Store today
--      with no such lever at all.
--
-- ============================================================================
-- TENANCY
-- ============================================================================
-- A mobile release belongs to the PLATFORM, not to a merchant: every store's buyers run the same
-- binary. So this table carries no site_id, is deliberately absent from the tenant registry, and its
-- read path is PUBLIC and unauthenticated by necessity -- the gate must work for a build too old to
-- authenticate, which is exactly the build most likely to need it.
--
-- Rollback: database/supabase/rollback/227_mobile_app_releases.rollback.sql

BEGIN;

CREATE TABLE IF NOT EXISTS public.mobile_app_releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL,
  -- The store identity, e.g. com.letbuyy.letbuyy. Matches config/governance/android-identity-registry.json.
  application_id text NOT NULL,
  -- Android versionCode / iOS CFBundleVersion. An INTEGER on purpose: the ordering that decides
  -- whether an install is out of date must be numeric, never a string compare over a version name.
  build_number integer NOT NULL CHECK (build_number > 0),
  version_name text NOT NULL,
  -- Builds strictly below this MUST update. Defaults to 0, meaning "nothing is forced" -- a new
  -- release should not lock anyone out until someone deliberately raises the floor.
  minimum_supported_build integer NOT NULL DEFAULT 0 CHECK (minimum_supported_build >= 0),
  update_url text NULL,
  message text NULL,
  is_active boolean NOT NULL DEFAULT true,
  released_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mobile_app_releases_platform_check CHECK (platform IN ('android', 'ios')),
  -- One row per shipped build. A second row for the same build is two policies for one install, and
  -- which one answers would depend on ordering.
  CONSTRAINT mobile_app_releases_build_key UNIQUE (platform, application_id, build_number),
  -- A release cannot demand a floor above itself: that would force every install to update to a
  -- build that does not satisfy the requirement either, including a fresh install from the store.
  CONSTRAINT mobile_app_releases_floor_check CHECK (minimum_supported_build <= build_number)
);

-- Resolving "the newest active release for this app" is the only read this table has.
CREATE INDEX IF NOT EXISTS mobile_app_releases_lookup_idx
  ON public.mobile_app_releases (platform, application_id, build_number DESC)
  WHERE is_active;

ALTER TABLE public.mobile_app_releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobile_app_releases FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_role_mobile_app_releases ON public.mobile_app_releases;
CREATE POLICY service_role_mobile_app_releases ON public.mobile_app_releases
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- No anon/authenticated policy even though the ENDPOINT is public: the gateway reads this with the
-- service client and returns COMPUTED booleans. Exposing the rows directly would publish the whole
-- release history and the force threshold, which is operational detail a client has no use for.
REVOKE ALL ON public.mobile_app_releases FROM app_tenant, authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mobile_app_releases TO service_role;

DO $$
BEGIN
  IF to_regprocedure('public.update_updated_at()') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_mobile_app_releases_updated_at ON public.mobile_app_releases;
    CREATE TRIGGER trg_mobile_app_releases_updated_at
      BEFORE UPDATE ON public.mobile_app_releases
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
  END IF;
END
$$;

COMMIT;
