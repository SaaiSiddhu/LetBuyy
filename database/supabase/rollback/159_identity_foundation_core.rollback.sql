-- Rollback for 159_identity_foundation_core.sql.
-- Removes only dormant identity-foundation rails added by migration 159.

DROP INDEX IF EXISTS public.verification_tokens_token_hash_idx;
DROP INDEX IF EXISTS public.risk_signals_identity_idx;

ALTER TABLE IF EXISTS public.risk_signals
  DROP COLUMN IF EXISTS request_id,
  DROP COLUMN IF EXISTS realm,
  DROP COLUMN IF EXISTS principal_id;

ALTER TABLE IF EXISTS public.site_memberships
  DROP CONSTRAINT IF EXISTS site_memberships_org_id_fkey,
  DROP COLUMN IF EXISTS org_id;

ALTER TABLE IF EXISTS public.devices
  DROP COLUMN IF EXISTS realm,
  DROP COLUMN IF EXISTS principal_id;

ALTER TABLE IF EXISTS public.merchant_2fa_factors
  DROP COLUMN IF EXISTS realm,
  DROP COLUMN IF EXISTS principal_id;

ALTER TABLE IF EXISTS public.consents
  DROP COLUMN IF EXISTS processing_purpose,
  DROP COLUMN IF EXISTS scopes,
  DROP COLUMN IF EXISTS oauth_client_id;

ALTER TABLE IF EXISTS public.verification_tokens
  DROP COLUMN IF EXISTS token_hash_algorithm,
  DROP COLUMN IF EXISTS token_hash;

DROP TABLE IF EXISTS public.audit_events CASCADE;
DROP TABLE IF EXISTS public.security_events CASCADE;
DROP TABLE IF EXISTS public.signing_keys CASCADE;
DROP TABLE IF EXISTS public.ownership_transfers CASCADE;
DROP TABLE IF EXISTS public.invitations CASCADE;
DROP TABLE IF EXISTS public.delegations CASCADE;
DROP TABLE IF EXISTS public.org_store_links CASCADE;
DROP TABLE IF EXISTS public.store_memberships CASCADE;
DROP TABLE IF EXISTS public.team_memberships CASCADE;
DROP TABLE IF EXISTS public.teams CASCADE;
DROP TABLE IF EXISTS public.org_memberships CASCADE;
DROP TABLE IF EXISTS public.organizations CASCADE;
DROP TABLE IF EXISTS public.federation_tokens CASCADE;
DROP TABLE IF EXISTS public.authorization_codes CASCADE;
DROP TABLE IF EXISTS public.oauth_grants CASCADE;
DROP TABLE IF EXISTS public.oauth_clients CASCADE;
DROP TABLE IF EXISTS public.refresh_tokens CASCADE;
DROP TABLE IF EXISTS public.refresh_chains CASCADE;
DROP TABLE IF EXISTS public.sessions_v2 CASCADE;
DROP TABLE IF EXISTS public.recovery_codes CASCADE;
DROP TABLE IF EXISTS public.authenticators CASCADE;
DROP TABLE IF EXISTS public.credentials CASCADE;
DROP TABLE IF EXISTS public.account_links CASCADE;
DROP TABLE IF EXISTS public.principals CASCADE;
