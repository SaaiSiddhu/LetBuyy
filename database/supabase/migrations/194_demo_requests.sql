-- Migration 194: Demo request capture (marketing lead intake)
--
-- PURPOSE
--   Backs the "Request Demo" form on the marketing site. A demo request is a
--   PRE-TENANT record: the person filling it in has no site_id, no account and
--   no session — they are a prospect, not a merchant. That single fact drives
--   every decision below.
--
-- WHY THIS TABLE IS NOT TENANT-SCOPED
--   Every other table in this schema carries site_id and is isolated by RLS on
--   it. This one cannot: there is no tenant yet. It is therefore treated as a
--   PLATFORM table — written only by the gateway (service_role), readable only
--   by service_role and platform operators. No anon or authenticated role gets
--   any access at all, which is stricter than tenant tables, not looser.
--
-- PII
--   Name, email, phone and company are personal data under the DPDP Act. The
--   lawful basis is the person's own request for a demo. Retention is handled
--   by the operator (there is no automated purge here) — see the note on
--   contacted_at / status below, which is what an operator prunes against.
--
-- ABUSE
--   A public form with no auth is a spam target. Mitigations are layered:
--     • Turnstile verified at the gateway before insert (application layer)
--     • a UNIQUE partial index on (lower(email)) for OPEN requests, so a
--       repeat submitter updates rather than floods
--     • ip_hash stored (hashed, never raw) so an operator can rate-limit
--       without holding a raw IP against a named person

CREATE TABLE IF NOT EXISTS public.demo_requests (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Who
    full_name           text        NOT NULL,
    email               text        NOT NULL,
    phone               text        NOT NULL,
    company_name        text,
    website_url         text,

    -- What they sell today
    business_type       text,
    current_channel     text,
    monthly_orders      text,
    monthly_gmv_band    text,
    product_categories  text[]      NOT NULL DEFAULT '{}',

    -- What they want
    interested_plan     text,
    goals               text[]      NOT NULL DEFAULT '{}',
    why_letbuyy         text,
    heard_about_us      text,
    heard_about_detail  text,

    -- Scheduling. Stored as an instant plus the caller's IANA zone: a demo at
    -- "10:00" is meaningless without knowing whose 10:00, and the operator and
    -- the prospect are frequently in different zones.
    preferred_at        timestamptz,
    preferred_timezone  text,
    preferred_language  text        NOT NULL DEFAULT 'en',

    -- Operator workflow
    status              text        NOT NULL DEFAULT 'new',
    contacted_at        timestamptz,
    internal_notes      text,

    -- Provenance
    locale              text,
    source_path         text,
    utm                 jsonb       NOT NULL DEFAULT '{}'::jsonb,
    ip_hash             text,
    user_agent          text,

    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT demo_requests_status_check
        CHECK (status IN ('new', 'contacted', 'scheduled', 'completed', 'declined', 'spam')),
    -- Cheap structural guard. Real validation happens at the gateway; this
    -- exists so a bad direct write cannot land obvious rubbish.
    CONSTRAINT demo_requests_email_shape_check
        CHECK (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
    CONSTRAINT demo_requests_full_name_present_check
        CHECK (length(btrim(full_name)) > 0),
    CONSTRAINT demo_requests_phone_present_check
        CHECK (length(btrim(phone)) > 0)
);

COMMENT ON TABLE public.demo_requests IS
    'Marketing demo requests. Pre-tenant: no site_id exists yet. Platform-scoped, service_role only.';
COMMENT ON COLUMN public.demo_requests.ip_hash IS
    'Salted hash of the submitter IP. Never store the raw address — it is personal data with no operational need here.';
COMMENT ON COLUMN public.demo_requests.preferred_timezone IS
    'IANA zone of the submitter. preferred_at alone cannot be rendered correctly without it.';

-- One OPEN request per email. Closed rows are excluded so a merchant who comes
-- back a year later can request again without an operator deleting history.
CREATE UNIQUE INDEX IF NOT EXISTS demo_requests_open_email_uniq
    ON public.demo_requests (lower(email))
    WHERE status IN ('new', 'contacted', 'scheduled');

CREATE INDEX IF NOT EXISTS demo_requests_status_created_idx
    ON public.demo_requests (status, created_at DESC);

CREATE INDEX IF NOT EXISTS demo_requests_preferred_at_idx
    ON public.demo_requests (preferred_at)
    WHERE preferred_at IS NOT NULL AND status IN ('new', 'contacted', 'scheduled');

-- updated_at maintenance, matching the platform convention.
CREATE OR REPLACE FUNCTION public.touch_demo_requests_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS demo_requests_touch_updated_at ON public.demo_requests;
CREATE TRIGGER demo_requests_touch_updated_at
    BEFORE UPDATE ON public.demo_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.touch_demo_requests_updated_at();

-- ─── RLS ────────────────────────────────────────────────────────────────────
-- FORCE, so even the table owner is subject to policy. There is exactly one
-- policy and it is service_role: the gateway is the only writer, and nothing
-- with an end-user session should ever read this table. No USING (true).
ALTER TABLE public.demo_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demo_requests FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "demo_requests service_role full access" ON public.demo_requests;
CREATE POLICY "demo_requests service_role full access"
    ON public.demo_requests
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Deliberately NO policy for anon or authenticated. A prospect must not be
-- able to read back the list of everyone who requested a demo, and the form
-- posts through the gateway rather than direct to PostgREST.
