export type SigningAlgorithm = 'ES256';
export type SigningKeyState = 'next' | 'active' | 'retiring' | 'revoked';

export interface JsonWebKeyLike {
  kty: string;
  kid: string;
  use: 'sig';
  alg: SigningAlgorithm;
  crv?: string;
  x?: string;
  y?: string;
}

export interface KeyDescriptor {
  kid: string;
  realm: string;
  algorithm: SigningAlgorithm;
  state: SigningKeyState;
  publicJwk: JsonWebKeyLike;
  notBefore: string;
  notAfter?: string;
}

export interface KeyService {
  currentSigningKey(realm: string): Promise<KeyDescriptor>;
  jwks(realm: string): Promise<{ keys: JsonWebKeyLike[] }>;
  rotate(realm: string, now?: Date): Promise<KeyDescriptor>;
  revoke(kid: string, reason: string): Promise<void>;
}
