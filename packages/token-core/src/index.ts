import type { KeyDescriptor } from '@letbuyy/auth-core/keys';
import type { IdentityRealm, SubjectClaims } from '@letbuyy/identity-core';

export type TokenKind =
  | 'id_token'
  | 'access_token'
  | 'refresh_token'
  | 'authorization_code'
  | 'device_code'
  | 'magic_link'
  | 'password_reset'
  | 'email_verify'
  | 'federation_token'
  | 'machine_token';

export interface TokenEnvelope<TClaims extends object = SubjectClaims> {
  kind: TokenKind;
  realm: IdentityRealm;
  issuer: string;
  audience: string[];
  subject: string;
  claims: TClaims;
  issuedAt: string;
  expiresAt: string;
  kid?: string;
}

export interface TokenSignResult {
  token: string;
  kid: string;
  algorithm: KeyDescriptor['algorithm'];
  expiresAt: string;
}

export interface TokenVerifyResult<TClaims extends object = SubjectClaims> {
  accepted: boolean;
  envelope?: TokenEnvelope<TClaims>;
  reason?: 'expired' | 'invalid_signature' | 'wrong_audience' | 'wrong_issuer' | 'revoked' | 'malformed';
}

export interface TokenSigner<TClaims extends object = SubjectClaims> {
  sign(envelope: TokenEnvelope<TClaims>): Promise<TokenSignResult>;
  verify(token: string, expected: { issuer: string; audience: string; realm: IdentityRealm }): Promise<TokenVerifyResult<TClaims>>;
}
