import type { ActorType, SessionContract, SessionKind } from '@letbuyy/auth-core';
import type { CookiePolicy, CookieRealm } from '@letbuyy/auth-core/cookies';
import type { IdentityRealm } from '@letbuyy/identity-core';
import type {
  CookiePolicyServiceV2,
  RefreshTokenRecord,
  RefreshTokenService,
  RevocationService,
  SessionRecordV2,
  SessionServiceV2,
} from '@letbuyy/session-core';
import { REALM_REGISTRY } from './realm-registry';

function sessionKindForRealm(realm: IdentityRealm): SessionKind {
  if (realm === 'customer') return 'customer';
  if (realm === 'admin') return 'employee';
  if (realm === 'service') return 'service';
  return 'merchant';
}

function actorTypeForRealm(realm: IdentityRealm): ActorType {
  if (realm === 'customer') return 'customer';
  if (realm === 'admin') return 'platform-operator';
  if (realm === 'partner') return 'partner';
  if (realm === 'service') return 'service';
  return 'merchant';
}

export function createDormantSessionService(now: () => Date = () => new Date()): SessionServiceV2 {
  const sessions = new Map<string, SessionRecordV2>();

  return {
    async create(input) {
      const id = crypto.randomUUID();
      const issuedAt = now().toISOString();
      const record: SessionRecordV2 = {
        ...input,
        id,
        createdAt: issuedAt,
      };
      sessions.set(id, record);

      return {
        session_id: id,
        actor: {
          actor_id: input.principal.id,
          actor_type: input.principal.actorType || actorTypeForRealm(input.realm),
          site_id: undefined,
          roles: [],
          permissions: [],
        },
        kind: sessionKindForRealm(input.realm),
        expires_at: input.expiresAt,
        issued_at: issuedAt,
      } satisfies SessionContract;
    },
    async validate(sessionId) {
      const record = sessions.get(sessionId);
      if (!record) return null;
      if (record.revokedAt) return null;
      if (Date.parse(record.expiresAt) <= now().getTime()) return null;
      if (record.idleExpiresAt && Date.parse(record.idleExpiresAt) <= now().getTime()) return null;
      return record;
    },
    async revoke(sessionId, reason) {
      const record = sessions.get(sessionId);
      if (!record) return;
      sessions.set(sessionId, {
        ...record,
        revokedAt: now().toISOString(),
        lastSeenAt: reason,
      });
    },
  };
}

export function createDormantRefreshTokenService(now: () => Date = () => new Date()): RefreshTokenService {
  const used = new Set<string>();

  return {
    async rotate(chainId, presentedTokenHash) {
      used.add(`${chainId}:${presentedTokenHash}`);
      return {
        id: crypto.randomUUID(),
        chainId,
        tokenHash: `shadow:${presentedTokenHash}`,
        issuedAt: now().toISOString(),
        expiresAt: new Date(now().getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      } satisfies RefreshTokenRecord;
    },
    async detectReuse(chainId, tokenHash) {
      return used.has(`${chainId}:${tokenHash}`);
    },
  };
}

export function createInMemoryRevocationService(): RevocationService {
  const revoked = new Map<string, number>();

  return {
    async isRevoked(sessionId) {
      const expiresAt = revoked.get(sessionId);
      if (!expiresAt) return false;
      if (expiresAt <= Date.now()) {
        revoked.delete(sessionId);
        return false;
      }
      return true;
    },
    async revoke(sessionId, ttlSeconds = 60 * 60) {
      revoked.set(sessionId, Date.now() + ttlSeconds * 1000);
    },
  };
}

export function createDormantCookiePolicyService(): CookiePolicyServiceV2 {
  return {
    policyFor(realm: CookieRealm): CookiePolicy {
      const registryKey = realm === 'employee' ? 'admin' : realm;
      const config = REALM_REGISTRY[registryKey];
      return {
        name: config.cookieName,
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        path: '/',
        maxAgeSeconds: config.sessionTtlSeconds,
        hostOnly: true,
      };
    },
  };
}

export function evaluateSessionContinuity(input: {
  legacyAccepted: boolean;
  newAccepted: boolean;
  dualAcceptEnabled: boolean;
}): { returnedLegacy: boolean; wouldDiverge: boolean } {
  return {
    returnedLegacy: input.legacyAccepted,
    wouldDiverge: input.dualAcceptEnabled && input.legacyAccepted !== input.newAccepted,
  };
}
