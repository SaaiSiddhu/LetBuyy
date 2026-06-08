-- Identity Platform foundation rails.
-- Additive only: no legacy auth/session table is removed or made authoritative.

CREATE TABLE IF NOT EXISTS public.principals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  realm text NOT NULL,
  actor_type text NOT NULL,
  legacy_user_id uuid,
  legacy_customer_id uuid,
  legacy_employee_id uuid,
  email text,
  phone text,
  display_name text,
  status text NOT NULL DEFAULT 'pending_migration',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1,
  created_by uuid,
  updated_by uuid,
  deleted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT principals_realm_check CHECK (realm IN ('merchant', 'customer', 'admin', 'partner', 'service')),
  CONSTRAINT principals_actor_type_check CHECK (actor_type IN ('shopper', 'customer', 'merchant', 'partner', 'platform-employee', 'platform-operator', 'service')),
  CONSTRAINT principals_status_check CHECK (status IN ('active', 'locked', 'disabled', 'pending_migration'))
);

CREATE TABLE IF NOT EXISTS public.account_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  principal_id uuid NOT NULL REFERENCES public.principals(id) ON DELETE CASCADE,
  realm text NOT NULL,
  provider text NOT NULL,
  provider_subject text NOT NULL,
  linked_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1,
  created_by uuid,
  updated_by uuid,
  deleted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT account_links_realm_check CHECK (realm IN ('merchant', 'customer', 'admin', 'partner', 'service')),
  CONSTRAINT account_links_provider_check CHECK (provider IN ('legacy_users', 'users_custom', 'store_customers', 'employees', 'oauth', 'saml')),
  UNIQUE (provider, provider_subject, realm)
);

CREATE TABLE IF NOT EXISTS public.credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  principal_id uuid NOT NULL REFERENCES public.principals(id) ON DELETE CASCADE,
  realm text NOT NULL,
  credential_type text NOT NULL DEFAULT 'password',
  identifier_hash text,
  secret_hash text NOT NULL,
  algo text NOT NULL,
  params jsonb NOT NULL DEFAULT '{}'::jsonb,
  migrated_from text,
  last_verified_at timestamptz,
  version integer NOT NULL DEFAULT 1,
  created_by uuid,
  updated_by uuid,
  deleted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT credentials_realm_check CHECK (realm IN ('merchant', 'customer', 'admin', 'partner', 'service')),
  CONSTRAINT credentials_type_check CHECK (credential_type IN ('password', 'magic_link', 'api_secret')),
  CONSTRAINT credentials_algo_check CHECK (algo IN ('bcrypt', 'argon2id_bcrypt', 'argon2id'))
);

CREATE TABLE IF NOT EXISTS public.authenticators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  principal_id uuid NOT NULL REFERENCES public.principals(id) ON DELETE CASCADE,
  realm text NOT NULL,
  authenticator_type text NOT NULL,
  label text,
  credential_id text,
  secret_ref text,
  public_key jsonb,
  transports text[] NOT NULL DEFAULT '{}'::text[],
  sign_count bigint NOT NULL DEFAULT 0,
  verified_at timestamptz,
  last_used_at timestamptz,
  legacy_merchant_2fa_factor_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1,
  created_by uuid,
  updated_by uuid,
  deleted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT authenticators_realm_check CHECK (realm IN ('merchant', 'customer', 'admin', 'partner', 'service')),
  CONSTRAINT authenticators_type_check CHECK (authenticator_type IN ('totp', 'passkey', 'hardware_key'))
);

CREATE TABLE IF NOT EXISTS public.recovery_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  principal_id uuid NOT NULL REFERENCES public.principals(id) ON DELETE CASCADE,
  authenticator_id uuid REFERENCES public.authenticators(id) ON DELETE CASCADE,
  code_hash text NOT NULL,
  used_at timestamptz,
  expires_at timestamptz,
  version integer NOT NULL DEFAULT 1,
  created_by uuid,
  updated_by uuid,
  deleted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.sessions_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  principal_id uuid NOT NULL REFERENCES public.principals(id) ON DELETE CASCADE,
  realm text NOT NULL,
  site_id uuid REFERENCES public.sites(id) ON DELETE CASCADE,
  legacy_session_id uuid,
  device_id uuid,
  sid text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  issued_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz,
  idle_expires_at timestamptz,
  absolute_expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  revoke_reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1,
  created_by uuid,
  updated_by uuid,
  deleted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT sessions_v2_realm_check CHECK (realm IN ('merchant', 'customer', 'admin', 'partner', 'service')),
  CONSTRAINT sessions_v2_status_check CHECK (status IN ('active', 'revoked', 'expired'))
);

CREATE TABLE IF NOT EXISTS public.refresh_chains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions_v2(id) ON DELETE CASCADE,
  family_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'active',
  reuse_detected_at timestamptz,
  latest_token_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1,
  created_by uuid,
  updated_by uuid,
  deleted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT refresh_chains_status_check CHECK (status IN ('active', 'revoked', 'reuse_detected'))
);

CREATE TABLE IF NOT EXISTS public.refresh_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_id uuid NOT NULL REFERENCES public.refresh_chains(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  revoked_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1,
  created_by uuid,
  updated_by uuid,
  deleted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (token_hash)
);

CREATE TABLE IF NOT EXISTS public.oauth_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid REFERENCES public.sites(id) ON DELETE CASCADE,
  client_id text NOT NULL UNIQUE,
  client_secret_hash text,
  client_type text NOT NULL,
  status text NOT NULL DEFAULT 'disabled',
  redirect_uris text[] NOT NULL DEFAULT '{}'::text[],
  allowed_scopes text[] NOT NULL DEFAULT '{}'::text[],
  jwks jsonb,
  legacy_app_installation_id uuid,
  legacy_site_api_client_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1,
  created_by uuid,
  updated_by uuid,
  deleted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT oauth_clients_type_check CHECK (client_type IN ('public', 'confidential', 'machine')),
  CONSTRAINT oauth_clients_status_check CHECK (status IN ('disabled', 'active', 'paused', 'revoked'))
);

CREATE TABLE IF NOT EXISTS public.oauth_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.oauth_clients(id) ON DELETE CASCADE,
  principal_id uuid REFERENCES public.principals(id) ON DELETE CASCADE,
  site_id uuid REFERENCES public.sites(id) ON DELETE CASCADE,
  consent_id uuid REFERENCES public.consents(id) ON DELETE SET NULL,
  scopes text[] NOT NULL DEFAULT '{}'::text[],
  status text NOT NULL DEFAULT 'active',
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1,
  created_by uuid,
  updated_by uuid,
  deleted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT oauth_grants_status_check CHECK (status IN ('active', 'revoked', 'expired'))
);

CREATE TABLE IF NOT EXISTS public.authorization_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.oauth_clients(id) ON DELETE CASCADE,
  principal_id uuid REFERENCES public.principals(id) ON DELETE CASCADE,
  code_hash text NOT NULL UNIQUE,
  redirect_uri text NOT NULL,
  scopes text[] NOT NULL DEFAULT '{}'::text[],
  pkce_challenge text,
  pkce_method text,
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1,
  created_by uuid,
  updated_by uuid,
  deleted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT authorization_codes_pkce_method_check CHECK ((pkce_method IS NULL) OR (pkce_method IN ('S256')))
);

CREATE TABLE IF NOT EXISTS public.federation_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  realm text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  principal_id uuid REFERENCES public.principals(id) ON DELETE CASCADE,
  site_id uuid REFERENCES public.sites(id) ON DELETE CASCADE,
  audience text NOT NULL,
  origin text,
  return_to text,
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  redeemed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1,
  created_by uuid,
  updated_by uuid,
  deleted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT federation_tokens_realm_check CHECK (realm IN ('merchant', 'customer', 'admin', 'partner', 'service'))
);

ALTER TABLE public.verification_tokens
  ADD COLUMN IF NOT EXISTS token_hash text,
  ADD COLUMN IF NOT EXISTS token_hash_algorithm text;

ALTER TABLE public.consents
  ADD COLUMN IF NOT EXISTS oauth_client_id uuid REFERENCES public.oauth_clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS scopes text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS processing_purpose text;

ALTER TABLE public.merchant_2fa_factors
  ADD COLUMN IF NOT EXISTS principal_id uuid REFERENCES public.principals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS realm text;

ALTER TABLE public.devices
  ADD COLUMN IF NOT EXISTS principal_id uuid REFERENCES public.principals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS realm text;

ALTER TABLE public.site_memberships
  ADD COLUMN IF NOT EXISTS org_id uuid;

CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_org_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  kind text NOT NULL DEFAULT 'merchant',
  name text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1,
  created_by uuid,
  updated_by uuid,
  deleted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT organizations_kind_check CHECK (kind IN ('merchant', 'agency', 'enterprise', 'partner', 'platform')),
  CONSTRAINT organizations_status_check CHECK (status IN ('active', 'suspended', 'disabled'))
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'site_memberships_org_id_fkey'
  ) THEN
    ALTER TABLE public.site_memberships
      ADD CONSTRAINT site_memberships_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.org_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  principal_id uuid NOT NULL REFERENCES public.principals(id) ON DELETE CASCADE,
  realm text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  role_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1,
  created_by uuid,
  updated_by uuid,
  deleted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT org_memberships_realm_check CHECK (realm IN ('merchant', 'customer', 'admin', 'partner', 'service')),
  CONSTRAINT org_memberships_status_check CHECK (status IN ('active', 'invited', 'suspended', 'removed')),
  UNIQUE (org_id, principal_id)
);

CREATE TABLE IF NOT EXISTS public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1,
  created_by uuid,
  updated_by uuid,
  deleted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT teams_status_check CHECK (status IN ('active', 'archived'))
);

CREATE TABLE IF NOT EXISTS public.team_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  principal_id uuid NOT NULL REFERENCES public.principals(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active',
  version integer NOT NULL DEFAULT 1,
  created_by uuid,
  updated_by uuid,
  deleted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT team_memberships_status_check CHECK (status IN ('active', 'removed')),
  UNIQUE (team_id, principal_id)
);

CREATE TABLE IF NOT EXISTS public.store_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  principal_id uuid NOT NULL REFERENCES public.principals(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active',
  role_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1,
  created_by uuid,
  updated_by uuid,
  deleted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT store_memberships_status_check CHECK (status IN ('active', 'invited', 'suspended', 'removed')),
  UNIQUE (store_id, principal_id)
);

CREATE TABLE IF NOT EXISTS public.org_store_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  relation text NOT NULL DEFAULT 'owns',
  version integer NOT NULL DEFAULT 1,
  created_by uuid,
  updated_by uuid,
  deleted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT org_store_links_relation_check CHECK (relation IN ('owns', 'operates', 'supports')),
  UNIQUE (org_id, store_id, relation)
);

CREATE TABLE IF NOT EXISTS public.delegations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  from_principal_id uuid NOT NULL REFERENCES public.principals(id) ON DELETE CASCADE,
  to_principal_id uuid NOT NULL REFERENCES public.principals(id) ON DELETE CASCADE,
  scopes text[] NOT NULL DEFAULT '{}'::text[],
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  revoked_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1,
  created_by uuid,
  updated_by uuid,
  deleted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT delegations_different_principals_check CHECK (from_principal_id <> to_principal_id)
);

CREATE TABLE IF NOT EXISTS public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  store_id uuid REFERENCES public.sites(id) ON DELETE CASCADE,
  email_hash text NOT NULL,
  role_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  status text NOT NULL DEFAULT 'pending',
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1,
  created_by uuid,
  updated_by uuid,
  deleted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT invitations_status_check CHECK (status IN ('pending', 'accepted', 'expired', 'revoked'))
);

CREATE TABLE IF NOT EXISTS public.ownership_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  from_principal_id uuid REFERENCES public.principals(id) ON DELETE SET NULL,
  to_principal_id uuid NOT NULL REFERENCES public.principals(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  requested_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1,
  created_by uuid,
  updated_by uuid,
  deleted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT ownership_transfers_status_check CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled', 'completed'))
);

CREATE TABLE IF NOT EXISTS public.signing_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  realm text NOT NULL,
  kid text NOT NULL UNIQUE,
  algorithm text NOT NULL DEFAULT 'ES256',
  state text NOT NULL DEFAULT 'next',
  public_jwk jsonb NOT NULL,
  kms_key_ref text NOT NULL,
  not_before timestamptz NOT NULL DEFAULT now(),
  not_after timestamptz,
  rotated_from_kid text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1,
  created_by uuid,
  updated_by uuid,
  deleted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT signing_keys_realm_check CHECK (realm IN ('merchant', 'customer', 'admin', 'partner', 'service', 'audit')),
  CONSTRAINT signing_keys_algorithm_check CHECK (algorithm = 'ES256'),
  CONSTRAINT signing_keys_state_check CHECK (state IN ('next', 'active', 'retiring', 'revoked'))
);

ALTER TABLE IF EXISTS public.risk_signals
  ADD COLUMN IF NOT EXISTS principal_id uuid REFERENCES public.principals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS realm text,
  ADD COLUMN IF NOT EXISTS request_id text;

CREATE TABLE IF NOT EXISTS public.security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid REFERENCES public.sites(id) ON DELETE CASCADE,
  principal_id uuid REFERENCES public.principals(id) ON DELETE SET NULL,
  realm text,
  event_type text NOT NULL,
  severity text NOT NULL DEFAULT 'low',
  request_id text,
  session_id uuid,
  device_id uuid,
  ip_hash text,
  user_agent_hash text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1,
  created_by uuid,
  updated_by uuid,
  deleted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT security_events_severity_check CHECK (severity IN ('low', 'medium', 'high', 'critical'))
);

CREATE TABLE IF NOT EXISTS public.audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL UNIQUE,
  category text NOT NULL,
  action text NOT NULL,
  actor_type text NOT NULL,
  actor_id text,
  actor_realm text,
  subject_type text,
  subject_id text,
  target_type text NOT NULL,
  target_id text,
  site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL,
  org_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  correlation_id text,
  request_id text,
  session_id text,
  device_id text,
  ip_hash text,
  user_agent_hash text,
  risk_level text NOT NULL DEFAULT 'low',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  encrypted_pii jsonb,
  seq bigint,
  prev_hash text,
  hash text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  version integer NOT NULL DEFAULT 1,
  created_by uuid,
  updated_by uuid,
  deleted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT audit_events_category_check CHECK (category IN ('auth', 'session', 'permission', 'mfa', 'credential', 'oauth', 'organization', 'compliance', 'security', 'system')),
  CONSTRAINT audit_events_risk_level_check CHECK (risk_level IN ('low', 'medium', 'high', 'critical'))
);

CREATE INDEX IF NOT EXISTS principals_realm_email_idx ON public.principals(realm, lower(email)) WHERE deleted_at IS NULL AND email IS NOT NULL;
CREATE INDEX IF NOT EXISTS account_links_principal_idx ON public.account_links(principal_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS credentials_principal_idx ON public.credentials(principal_id, credential_type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS authenticators_principal_idx ON public.authenticators(principal_id, authenticator_type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS recovery_codes_principal_idx ON public.recovery_codes(principal_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS sessions_v2_principal_idx ON public.sessions_v2(principal_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS sessions_v2_site_idx ON public.sessions_v2(site_id, issued_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS refresh_chains_session_idx ON public.refresh_chains(session_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS refresh_tokens_chain_idx ON public.refresh_tokens(chain_id, issued_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS oauth_clients_site_idx ON public.oauth_clients(site_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS oauth_grants_principal_idx ON public.oauth_grants(principal_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS authorization_codes_client_idx ON public.authorization_codes(client_id, expires_at) WHERE used_at IS NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS federation_tokens_site_idx ON public.federation_tokens(site_id, expires_at) WHERE redeemed_at IS NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS verification_tokens_token_hash_idx ON public.verification_tokens(token_hash) WHERE token_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS organizations_parent_idx ON public.organizations(parent_org_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS org_memberships_principal_idx ON public.org_memberships(principal_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS teams_org_idx ON public.teams(org_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS team_memberships_principal_idx ON public.team_memberships(principal_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS store_memberships_store_idx ON public.store_memberships(store_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS org_store_links_store_idx ON public.org_store_links(store_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS delegations_to_principal_idx ON public.delegations(to_principal_id, ends_at) WHERE revoked_at IS NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS invitations_org_idx ON public.invitations(org_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ownership_transfers_store_idx ON public.ownership_transfers(store_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS signing_keys_realm_state_idx ON public.signing_keys(realm, state) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS risk_signals_identity_idx ON public.risk_signals(principal_id, observed_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS security_events_site_idx ON public.security_events(site_id, occurred_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS security_events_principal_idx ON public.security_events(principal_id, occurred_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS audit_events_site_idx ON public.audit_events(site_id, occurred_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS audit_events_actor_idx ON public.audit_events(actor_type, actor_id, occurred_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS audit_events_hash_chain_idx ON public.audit_events(seq) WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS update_principals_updated_at ON public.principals;
CREATE TRIGGER update_principals_updated_at BEFORE UPDATE ON public.principals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
DROP TRIGGER IF EXISTS update_account_links_updated_at ON public.account_links;
CREATE TRIGGER update_account_links_updated_at BEFORE UPDATE ON public.account_links FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
DROP TRIGGER IF EXISTS update_credentials_updated_at ON public.credentials;
CREATE TRIGGER update_credentials_updated_at BEFORE UPDATE ON public.credentials FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
DROP TRIGGER IF EXISTS update_authenticators_updated_at ON public.authenticators;
CREATE TRIGGER update_authenticators_updated_at BEFORE UPDATE ON public.authenticators FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
DROP TRIGGER IF EXISTS update_recovery_codes_updated_at ON public.recovery_codes;
CREATE TRIGGER update_recovery_codes_updated_at BEFORE UPDATE ON public.recovery_codes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
DROP TRIGGER IF EXISTS update_sessions_v2_updated_at ON public.sessions_v2;
CREATE TRIGGER update_sessions_v2_updated_at BEFORE UPDATE ON public.sessions_v2 FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
DROP TRIGGER IF EXISTS update_refresh_chains_updated_at ON public.refresh_chains;
CREATE TRIGGER update_refresh_chains_updated_at BEFORE UPDATE ON public.refresh_chains FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
DROP TRIGGER IF EXISTS update_refresh_tokens_updated_at ON public.refresh_tokens;
CREATE TRIGGER update_refresh_tokens_updated_at BEFORE UPDATE ON public.refresh_tokens FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
DROP TRIGGER IF EXISTS update_oauth_clients_updated_at ON public.oauth_clients;
CREATE TRIGGER update_oauth_clients_updated_at BEFORE UPDATE ON public.oauth_clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
DROP TRIGGER IF EXISTS update_oauth_grants_updated_at ON public.oauth_grants;
CREATE TRIGGER update_oauth_grants_updated_at BEFORE UPDATE ON public.oauth_grants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
DROP TRIGGER IF EXISTS update_authorization_codes_updated_at ON public.authorization_codes;
CREATE TRIGGER update_authorization_codes_updated_at BEFORE UPDATE ON public.authorization_codes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
DROP TRIGGER IF EXISTS update_federation_tokens_updated_at ON public.federation_tokens;
CREATE TRIGGER update_federation_tokens_updated_at BEFORE UPDATE ON public.federation_tokens FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
DROP TRIGGER IF EXISTS update_organizations_updated_at ON public.organizations;
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
DROP TRIGGER IF EXISTS update_org_memberships_updated_at ON public.org_memberships;
CREATE TRIGGER update_org_memberships_updated_at BEFORE UPDATE ON public.org_memberships FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
DROP TRIGGER IF EXISTS update_teams_updated_at ON public.teams;
CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON public.teams FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
DROP TRIGGER IF EXISTS update_team_memberships_updated_at ON public.team_memberships;
CREATE TRIGGER update_team_memberships_updated_at BEFORE UPDATE ON public.team_memberships FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
DROP TRIGGER IF EXISTS update_store_memberships_updated_at ON public.store_memberships;
CREATE TRIGGER update_store_memberships_updated_at BEFORE UPDATE ON public.store_memberships FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
DROP TRIGGER IF EXISTS update_org_store_links_updated_at ON public.org_store_links;
CREATE TRIGGER update_org_store_links_updated_at BEFORE UPDATE ON public.org_store_links FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
DROP TRIGGER IF EXISTS update_delegations_updated_at ON public.delegations;
CREATE TRIGGER update_delegations_updated_at BEFORE UPDATE ON public.delegations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
DROP TRIGGER IF EXISTS update_invitations_updated_at ON public.invitations;
CREATE TRIGGER update_invitations_updated_at BEFORE UPDATE ON public.invitations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
DROP TRIGGER IF EXISTS update_ownership_transfers_updated_at ON public.ownership_transfers;
CREATE TRIGGER update_ownership_transfers_updated_at BEFORE UPDATE ON public.ownership_transfers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
DROP TRIGGER IF EXISTS update_signing_keys_updated_at ON public.signing_keys;
CREATE TRIGGER update_signing_keys_updated_at BEFORE UPDATE ON public.signing_keys FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
DROP TRIGGER IF EXISTS update_security_events_updated_at ON public.security_events;
CREATE TRIGGER update_security_events_updated_at BEFORE UPDATE ON public.security_events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
DROP TRIGGER IF EXISTS update_audit_events_updated_at ON public.audit_events;
CREATE TRIGGER update_audit_events_updated_at BEFORE UPDATE ON public.audit_events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.principals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.authenticators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recovery_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refresh_chains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oauth_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oauth_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.authorization_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.federation_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_store_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delegations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ownership_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signing_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY principals_service_all ON public.principals FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY account_links_service_all ON public.account_links FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY credentials_service_all ON public.credentials FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY authenticators_service_all ON public.authenticators FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY recovery_codes_service_all ON public.recovery_codes FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY sessions_v2_service_all ON public.sessions_v2 FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY refresh_chains_service_all ON public.refresh_chains FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY refresh_tokens_service_all ON public.refresh_tokens FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY oauth_clients_service_all ON public.oauth_clients FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY oauth_grants_service_all ON public.oauth_grants FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY authorization_codes_service_all ON public.authorization_codes FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY federation_tokens_service_all ON public.federation_tokens FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY organizations_service_all ON public.organizations FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY org_memberships_service_all ON public.org_memberships FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY teams_service_all ON public.teams FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY team_memberships_service_all ON public.team_memberships FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY store_memberships_service_all ON public.store_memberships FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY org_store_links_service_all ON public.org_store_links FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY delegations_service_all ON public.delegations FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY invitations_service_all ON public.invitations FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY ownership_transfers_service_all ON public.ownership_transfers FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY signing_keys_service_all ON public.signing_keys FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY security_events_service_all ON public.security_events FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY audit_events_service_all ON public.audit_events FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY principals_self_read ON public.principals FOR SELECT TO authenticated
  USING (id = auth.uid() OR legacy_user_id = auth.uid());

CREATE POLICY account_links_self_read ON public.account_links FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.principals p WHERE p.id = account_links.principal_id AND (p.id = auth.uid() OR p.legacy_user_id = auth.uid()) AND p.deleted_at IS NULL));

CREATE POLICY sessions_v2_self_read ON public.sessions_v2 FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.principals p WHERE p.id = sessions_v2.principal_id AND (p.id = auth.uid() OR p.legacy_user_id = auth.uid()) AND p.deleted_at IS NULL));

CREATE POLICY oauth_clients_site_owner_read ON public.oauth_clients FOR SELECT TO authenticated
  USING (site_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.sites s WHERE s.id = oauth_clients.site_id AND s.user_id = auth.uid() AND s.deleted_at IS NULL));

CREATE POLICY oauth_grants_site_owner_read ON public.oauth_grants FOR SELECT TO authenticated
  USING (site_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.sites s WHERE s.id = oauth_grants.site_id AND s.user_id = auth.uid() AND s.deleted_at IS NULL));

CREATE POLICY federation_tokens_site_owner_read ON public.federation_tokens FOR SELECT TO authenticated
  USING (site_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.sites s WHERE s.id = federation_tokens.site_id AND s.user_id = auth.uid() AND s.deleted_at IS NULL));

CREATE POLICY organizations_member_read ON public.organizations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.org_memberships m WHERE m.org_id = organizations.id AND m.principal_id = auth.uid() AND m.deleted_at IS NULL));

CREATE POLICY org_memberships_member_read ON public.org_memberships FOR SELECT TO authenticated
  USING (principal_id = auth.uid());

CREATE POLICY store_memberships_site_owner_read ON public.store_memberships FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sites s WHERE s.id = store_memberships.store_id AND s.user_id = auth.uid() AND s.deleted_at IS NULL));

CREATE POLICY org_store_links_site_owner_read ON public.org_store_links FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sites s WHERE s.id = org_store_links.store_id AND s.user_id = auth.uid() AND s.deleted_at IS NULL));

CREATE POLICY invitations_site_owner_read ON public.invitations FOR SELECT TO authenticated
  USING (store_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.sites s WHERE s.id = invitations.store_id AND s.user_id = auth.uid() AND s.deleted_at IS NULL));

CREATE POLICY ownership_transfers_site_owner_read ON public.ownership_transfers FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sites s WHERE s.id = ownership_transfers.store_id AND s.user_id = auth.uid() AND s.deleted_at IS NULL));

CREATE POLICY security_events_site_owner_read ON public.security_events FOR SELECT TO authenticated
  USING (site_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.sites s WHERE s.id = security_events.site_id AND s.user_id = auth.uid() AND s.deleted_at IS NULL));

CREATE POLICY audit_events_site_owner_read ON public.audit_events FOR SELECT TO authenticated
  USING (site_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.sites s WHERE s.id = audit_events.site_id AND s.user_id = auth.uid() AND s.deleted_at IS NULL));
