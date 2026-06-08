import type { IdentityRealm, SubjectClaims } from '@letbuyy/identity-core';
import type { TokenEnvelope } from '@letbuyy/token-core';
import { DEFAULT_MOCK_IDENTITY_ORIGIN, REALM_REGISTRY } from './realm-registry';

export interface OidcDiscoveryDocument {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
  jwks_uri: string;
  response_types_supported: readonly ['code'];
  grant_types_supported: readonly ['authorization_code', 'refresh_token', 'client_credentials', 'urn:ietf:params:oauth:grant-type:device_code'];
  code_challenge_methods_supported: readonly ['S256'];
  token_endpoint_auth_methods_supported: readonly ['client_secret_basic', 'client_secret_post', 'private_key_jwt'];
}

export function discoveryDocumentForRealm(realm: IdentityRealm, origin = DEFAULT_MOCK_IDENTITY_ORIGIN): OidcDiscoveryDocument {
  const config = REALM_REGISTRY[realm === 'admin' ? 'admin' : realm === 'customer' ? 'customer' : 'merchant'];
  const base = `${origin}/oauth2`;

  return {
    issuer: `${origin}/realms/${config.realm}`,
    authorization_endpoint: `${base}/authorize`,
    token_endpoint: `${base}/token`,
    userinfo_endpoint: `${base}/userinfo`,
    jwks_uri: `${origin}/.well-known/jwks.json?realm=${realm}`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token', 'client_credentials', 'urn:ietf:params:oauth:grant-type:device_code'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post', 'private_key_jwt'],
  };
}

export interface AuthorizationCodePlan {
  clientId: string;
  redirectUri: string;
  scopes: string[];
  codeHash: string;
  expiresAt: string;
  singleUse: true;
  legacyUntouched: true;
}

export function planAuthorizationCode(input: {
  clientId: string;
  redirectUri: string;
  scopes?: string[];
  code: string;
  issuedAt?: Date;
}): AuthorizationCodePlan {
  const issuedAt = input.issuedAt || new Date();
  return {
    clientId: input.clientId,
    redirectUri: input.redirectUri,
    scopes: input.scopes || [],
    codeHash: `sha256:${input.code}`,
    expiresAt: new Date(issuedAt.getTime() + 60 * 1000).toISOString(),
    singleUse: true,
    legacyUntouched: true,
  };
}

export function tokenEnvelopeForSubject(input: {
  realm: IdentityRealm;
  subject: string;
  sessionId: string;
  scopes: string[];
  issuedAt?: Date;
}): TokenEnvelope<SubjectClaims> {
  const issuedAt = input.issuedAt || new Date();
  const config = REALM_REGISTRY[input.realm === 'admin' ? 'admin' : input.realm === 'customer' ? 'customer' : 'merchant'];
  const exp = new Date(issuedAt.getTime() + config.accessTokenTtlSeconds * 1000);

  return {
    kind: 'access_token',
    realm: input.realm,
    issuer: config.issuer,
    audience: [config.audience],
    subject: input.subject,
    claims: {
      sub: input.subject,
      realm: input.realm,
      actor_type: input.realm === 'customer' ? 'customer' : input.realm === 'admin' ? 'platform-operator' : 'merchant',
      session_kind: input.realm === 'customer' ? 'customer' : input.realm === 'admin' ? 'employee' : 'merchant',
      sid: input.sessionId,
      sites: [],
      roles: [],
      scopes: input.scopes,
      amr: ['pwd'],
      acr: 'urn:letbuyy:acr:password',
      iat: Math.floor(issuedAt.getTime() / 1000),
      exp: Math.floor(exp.getTime() / 1000),
    },
    issuedAt: issuedAt.toISOString(),
    expiresAt: exp.toISOString(),
  };
}
