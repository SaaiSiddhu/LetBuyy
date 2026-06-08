import type { ActorType, SessionKind } from '@letbuyy/auth-core';
import { z } from 'zod';

export type { ActorType, SessionKind };

export const IdentityRealmSchema = z.enum(['merchant', 'customer', 'admin', 'partner', 'service']);
export type IdentityRealm = z.infer<typeof IdentityRealmSchema>;

export const PrincipalStatusSchema = z.enum(['active', 'locked', 'disabled', 'pending_migration']);
export type PrincipalStatus = z.infer<typeof PrincipalStatusSchema>;

export interface PrincipalRef {
  id: string;
  realm: IdentityRealm;
  actorType: ActorType;
  legacyUserId?: string;
  legacyCustomerId?: string;
  legacyEmployeeId?: string;
}

export interface Principal extends PrincipalRef {
  email?: string;
  phone?: string;
  displayName?: string;
  status: PrincipalStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface AccountLink {
  id: string;
  principalId: string;
  provider: 'legacy_users' | 'users_custom' | 'store_customers' | 'employees' | 'oauth' | 'saml';
  providerSubject: string;
  realm: IdentityRealm;
  linkedAt: string;
}

export interface SubjectClaims {
  sub: string;
  realm: IdentityRealm;
  actor_type: ActorType;
  session_kind: SessionKind;
  sid?: string;
  org?: string | null;
  sites: string[];
  roles: string[];
  scopes: string[];
  amr: string[];
  acr: 'urn:letbuyy:acr:anonymous' | 'urn:letbuyy:acr:password' | 'urn:letbuyy:acr:mfa' | 'urn:letbuyy:acr:step-up';
  iat: number;
  exp: number;
}

export interface PrincipalRepository {
  findById(id: string): Promise<Principal | null>;
  findByLegacyRef(ref: Pick<PrincipalRef, 'realm' | 'legacyUserId' | 'legacyCustomerId' | 'legacyEmployeeId'>): Promise<Principal | null>;
  linkAccount(link: AccountLink): Promise<AccountLink>;
}
