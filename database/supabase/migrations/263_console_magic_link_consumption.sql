-- Phase 2 / Mandate 7, Section 6: atomic single-use enforcement for the platform console's
-- magic-link login token.
--
-- The token itself (packages/auth-core's LetbuyyPlatformMagicLinkPayload) is a self-contained,
-- signed JWT-like value verified by signature and expiry alone -- it carries no server-side state
-- by design, matching every other token in this codebase. Single-use therefore cannot live IN the
-- token; it needs a place to record "this specific token has already been redeemed", keyed by the
-- token's own `jti` (an unpredictable per-token identity, not the coarser (email, type) pair a
-- legitimate second real login attempt would also share).
--
-- The PRIMARY KEY on jti is the entire mechanism: two concurrent redemption attempts for the
-- identical token both attempt to INSERT the same jti; Postgres guarantees exactly one succeeds and
-- the other fails with SQLSTATE 23505 (unique_violation) -- the same pattern already proven correct
-- in this codebase for privacy-request idempotency (migration 262) and contact-public.ts. This is
-- deliberately NOT a read-then-update pattern (SELECT to check `used`, then UPDATE) -- that shape
-- has a real, exploitable TOCTOU race under concurrent redemption (confirmed while reviewing the
-- existing verification_tokens table's own validate path, services/api-gateway/src/routes/auth.ts
-- lines ~1327-1371: it reads `used`/`expires_at` in application code, then issues a separate
-- UPDATE unconditional on `used` -- two concurrent requests can both read used=false before either
-- commits). Flagged separately for the owner's attention; not fixed here, as it is a materially
-- different, pre-existing system (buyer/merchant OTP, email-verify and password-reset), out of this
-- migration's stated scope.
CREATE TABLE public.console_magic_link_consumptions (
    jti text PRIMARY KEY,
    email text NOT NULL,
    consumed_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL
);

COMMENT ON TABLE public.console_magic_link_consumptions IS
    'Phase 2 / Mandate 7: records each platform-console magic-link token jti at the moment it is redeemed. The PRIMARY KEY on jti is the atomic single-use guarantee -- a second redemption attempt for the same token fails to insert (23505) rather than being detected by a separate read.';

-- Bounded, disposable state: this table exists to make redemption durable ACROSS a request's
-- lifetime and across workers, not indefinitely. A row past its own expires_at can never again be
-- relevant to a live token (the JWT itself will already fail expiry verification), so it is safe to
-- prune on that column whenever a cleanup pass is added -- no such job is added by this migration,
-- since a token TTL of 15 minutes bounds this table's growth to real login attempts, which is
-- already small relative to every other audited table in this schema.
CREATE INDEX console_magic_link_consumptions_expires_at_idx
    ON public.console_magic_link_consumptions (expires_at);

ALTER TABLE public.console_magic_link_consumptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.console_magic_link_consumptions FORCE ROW LEVEL SECURITY;

-- No policy is granted to `authenticated` or `anon` -- this table is written and read exclusively by
-- the gateway's own service-role client (services/api-gateway/src/routes/internal-console.ts),
-- which is already gated by PLATFORM_CONSOLE_API_TOKEN and, upstream of that, the console app's own
-- MFA-gated session (apps/internal/console's (dashboard)/layout.tsx requireConsoleSession, and for
-- this specific pre-session flow, the login/callback routes themselves). FORCE ROW LEVEL SECURITY
-- with zero policies means even a future accidental grant to `authenticated`/`anon` still yields
-- zero rows and no mutation, matching this repository's tenant-isolation discipline for every other
-- security-sensitive table.

-- A brand-new table gets none of service_role's default privileges on this Supabase image (migration
-- 254's own finding: service_role held no SELECT/INSERT/UPDATE/DELETE on 146 pre-existing tables
-- until explicitly granted; the same default applies to every table created afterward). Without this
-- grant the gateway's service-role client would fail to read or write this table at all -- confirmed
-- by inspecting information_schema.role_table_grants on the owned local instance immediately after
-- creating this table, before adding this statement.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.console_magic_link_consumptions TO service_role;
