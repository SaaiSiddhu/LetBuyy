import type { CookiePolicy, CookieRealm } from '@letbuyy/auth-core/cookies';
import type { SessionContract } from '@letbuyy/auth-core';
import type { IdentityRealm, PrincipalRef } from '@letbuyy/identity-core';

export interface SessionRecordV2 {
  id: string;
  realm: IdentityRealm;
  principal: PrincipalRef;
  deviceId?: string;
  createdAt: string;
  lastSeenAt?: string;
  expiresAt: string;
  idleExpiresAt?: string;
  revokedAt?: string | null;
}

export interface RefreshChain {
  id: string;
  sessionId: string;
  familyId: string;
  rotatedAt?: string;
  reuseDetectedAt?: string | null;
}

export interface RefreshTokenRecord {
  id: string;
  chainId: string;
  tokenHash: string;
  issuedAt: string;
  expiresAt: string;
  usedAt?: string | null;
  revokedAt?: string | null;
}

export interface SessionServiceV2 {
  create(record: Omit<SessionRecordV2, 'id' | 'createdAt'>): Promise<SessionContract>;
  validate(sessionId: string): Promise<SessionRecordV2 | null>;
  revoke(sessionId: string, reason: string): Promise<void>;
}

export interface RefreshTokenService {
  rotate(chainId: string, presentedTokenHash: string): Promise<RefreshTokenRecord>;
  detectReuse(chainId: string, tokenHash: string): Promise<boolean>;
}

export interface RevocationService {
  isRevoked(sessionId: string): Promise<boolean>;
  revoke(sessionId: string, ttlSeconds?: number): Promise<void>;
}

export interface CookiePolicyServiceV2 {
  policyFor(realm: CookieRealm): CookiePolicy;
}
