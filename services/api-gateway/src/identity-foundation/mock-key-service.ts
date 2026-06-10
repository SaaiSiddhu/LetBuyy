import type { JsonWebKeyLike, KeyDescriptor, KeyService } from '@letbuyy/auth-core/keys';
import type { IdentityRealm } from '@letbuyy/identity-core';
import type { TokenEnvelope, TokenSigner, TokenVerifyResult } from '@letbuyy/token-core';

function normalizeRealm(realm: string): string {
  return realm.trim().toLowerCase() || 'merchant';
}

function keyIdFor(realm: string, state: KeyDescriptor['state'], generation = 1): string {
  return `mock-${normalizeRealm(realm)}-${state}-es256-v${generation}`;
}

function base64UrlEncode(input: string | Uint8Array): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecode(input: string): Uint8Array {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

interface MockKeyMaterial {
  descriptor: KeyDescriptor;
  privateKey: CryptoKey;
  publicKey: CryptoKey;
}

async function generateKeyMaterial(
  realm: string,
  state: KeyDescriptor['state'],
  now: Date,
  generation: number,
): Promise<MockKeyMaterial> {
  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify'],
  ) as CryptoKeyPair;
  const jwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey) as JsonWebKey;
  const publicJwk: JsonWebKeyLike = {
    kty: 'EC',
    kid: keyIdFor(realm, state, generation),
    use: 'sig',
    alg: 'ES256',
    crv: jwk.crv,
    x: jwk.x,
    y: jwk.y,
  };

  return {
    descriptor: {
      kid: publicJwk.kid,
      realm,
      algorithm: 'ES256',
      state,
      publicJwk,
      notBefore: now.toISOString(),
    },
    privateKey: keyPair.privateKey,
    publicKey: keyPair.publicKey,
  };
}

export interface RealmKeyRegistryEntry {
  realm: IdentityRealm;
  activeKid: string;
  nextKid: string;
  algorithm: 'ES256';
  custody: 'sandbox-kms';
  replacementFor: readonly string[];
}

export interface KeyCompromiseRunbookStep {
  order: number;
  action: string;
  humanRequired?: 'HR-KMS-LIVE' | 'HR-PROD-MIGRATE-DEPLOY';
}

export interface MockRealmKeyInfrastructure {
  keyService: KeyService;
  tokenSigner: TokenSigner;
  registry(realm: IdentityRealm): Promise<RealmKeyRegistryEntry>;
  auditAnchorKey(realm: IdentityRealm): Promise<KeyDescriptor>;
  compromiseRunbook(kid: string): KeyCompromiseRunbookStep[];
}

export function createMockRealmKeyInfrastructure(now: () => Date = () => new Date()): MockRealmKeyInfrastructure {
  const cache = new Map<string, Promise<MockKeyMaterial>>();
  let generation = 1;

  async function material(realm: string, state: KeyDescriptor['state']): Promise<MockKeyMaterial> {
    const normalizedRealm = normalizeRealm(realm);
    const cacheKey = `${normalizedRealm}:${state}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    const created = generateKeyMaterial(normalizedRealm, state, now(), generation);
    cache.set(cacheKey, created);
    return created;
  }

  const keyService: KeyService = {
    currentSigningKey(realm) {
      return material(realm, 'active').then((value) => value.descriptor);
    },
    async jwks(realm) {
      const [active, next] = await Promise.all([
        material(realm, 'active'),
        material(realm, 'next'),
      ]);
      return { keys: [active.descriptor.publicJwk, next.descriptor.publicJwk] };
    },
    async rotate(realm) {
      const normalizedRealm = normalizeRealm(realm);
      const next = await material(normalizedRealm, 'next');
      generation += 1;
      cache.set(`${normalizedRealm}:active`, Promise.resolve({
        ...next,
        descriptor: { ...next.descriptor, state: 'active' },
      }));
      cache.delete(`${normalizedRealm}:next`);
      return next.descriptor;
    },
    async revoke(kid) {
      for (const [cacheKey, value] of cache.entries()) {
        const descriptorValue = await value;
        if (descriptorValue.descriptor.kid === kid) cache.delete(cacheKey);
      }
    },
  };

  const tokenSigner: TokenSigner = {
    async sign(envelope) {
      const signingMaterial = await material(envelope.realm, 'active');
      const header = {
        alg: 'ES256',
        kid: signingMaterial.descriptor.kid,
        typ: 'JWT',
      };
      const payload = {
        ...envelope.claims,
        iss: envelope.issuer,
        aud: envelope.audience,
        sub: envelope.subject,
        realm: envelope.realm,
        iat: Math.floor(Date.parse(envelope.issuedAt) / 1000),
        exp: Math.floor(Date.parse(envelope.expiresAt) / 1000),
        token_kind: envelope.kind,
      };
      const signingInput = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(payload))}`;
      const signature = new Uint8Array(await crypto.subtle.sign(
        { name: 'ECDSA', hash: 'SHA-256' },
        signingMaterial.privateKey,
        new TextEncoder().encode(signingInput),
      ));

      return {
        token: `${signingInput}.${base64UrlEncode(signature)}`,
        kid: signingMaterial.descriptor.kid,
        algorithm: 'ES256',
        expiresAt: envelope.expiresAt,
      };
    },
    async verify(token, expected) {
      const parts = token.split('.');
      if (parts.length !== 3) return { accepted: false, reason: 'malformed' };

      try {
        const header = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[0]))) as { kid?: string };
        const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[1]))) as Record<string, unknown>;
        const realm = typeof payload.realm === 'string' ? payload.realm : '';
        const signingMaterial = await material(realm, 'active');

        if (header.kid !== signingMaterial.descriptor.kid) return { accepted: false, reason: 'invalid_signature' };

        const verified = await crypto.subtle.verify(
          { name: 'ECDSA', hash: 'SHA-256' },
          signingMaterial.publicKey,
          base64UrlDecode(parts[2]),
          new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
        );
        if (!verified) return { accepted: false, reason: 'invalid_signature' };

        const exp = typeof payload.exp === 'number' ? payload.exp : 0;
        if (exp * 1000 <= now().getTime()) return { accepted: false, reason: 'expired' };
        if (payload.iss !== expected.issuer) return { accepted: false, reason: 'wrong_issuer' };
        if (!Array.isArray(payload.aud) || !payload.aud.includes(expected.audience)) {
          return { accepted: false, reason: 'wrong_audience' };
        }
        if (payload.realm !== expected.realm) return { accepted: false, reason: 'malformed' };

        const envelope: TokenEnvelope = {
          kind: String(payload.token_kind || 'access_token') as TokenEnvelope['kind'],
          realm: expected.realm,
          issuer: expected.issuer,
          audience: payload.aud as string[],
          subject: String(payload.sub),
          claims: payload as unknown as TokenEnvelope['claims'],
          issuedAt: new Date((Number(payload.iat) || 0) * 1000).toISOString(),
          expiresAt: new Date(exp * 1000).toISOString(),
          kid: header.kid,
        };

        return { accepted: true, envelope } satisfies TokenVerifyResult;
      } catch {
        return { accepted: false, reason: 'malformed' };
      }
    },
  };

  return {
    keyService,
    tokenSigner,
    async registry(realm) {
      const [active, next] = await Promise.all([
        keyService.currentSigningKey(realm),
        material(realm, 'next').then((value) => value.descriptor),
      ]);

      return {
        realm,
        activeKid: active.kid,
        nextKid: next.kid,
        algorithm: 'ES256',
        custody: 'sandbox-kms',
        replacementFor: [
          'AUTH_SECRET',
          'CUSTOMER_SESSION_SECRET',
          'PLATFORM_CONSOLE_SESSION_SECRET',
          'INTERNAL_API_SECRET',
          'PLATFORM_CONSOLE_TOTP_SECRET',
        ],
      };
    },
    auditAnchorKey(realm) {
      return material(`${realm}:audit-anchor`, 'active').then((value) => value.descriptor);
    },
    compromiseRunbook(kid) {
      return [
        { order: 1, action: `Mark ${kid} as retiring and publish next key ahead of use.` },
        { order: 2, action: 'Rotate active mock signing key and refresh JWKS caches.' },
        { order: 3, action: 'Revoke affected sessions through the dormant revocation service.' },
        { order: 4, action: 'Provision live KMS/HSM replacement before production enablement.', humanRequired: 'HR-KMS-LIVE' },
        { order: 5, action: 'Deploy through approved migration/deploy pipeline.', humanRequired: 'HR-PROD-MIGRATE-DEPLOY' },
      ];
    },
  };
}

export function createMockRealmKeyService(now: () => Date = () => new Date()): KeyService {
  return createMockRealmKeyInfrastructure(now).keyService;
}
