import type { ActorType } from '@letbuyy/auth-core';
import type { IdentityRealm, PrincipalRef } from '@letbuyy/identity-core';
import type { SiteType } from '@letbuyy/tenant-core';

export type OrganizationKind = 'merchant' | 'agency' | 'enterprise' | 'partner' | 'platform';
export type MembershipStatus = 'active' | 'invited' | 'suspended' | 'removed';

export interface Organization {
  id: string;
  parentOrgId?: string | null;
  kind: OrganizationKind;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrgMembership {
  id: string;
  orgId: string;
  principal: PrincipalRef;
  actorType: ActorType;
  realm: IdentityRealm;
  status: MembershipStatus;
  roleIds: string[];
}

export interface StoreMembership {
  id: string;
  orgId: string;
  siteId: string;
  siteType: SiteType;
  principalId: string;
  roleIds: string[];
  status: MembershipStatus;
}

export interface Delegation {
  id: string;
  orgId: string;
  fromPrincipalId: string;
  toPrincipalId: string;
  scopes: string[];
  startsAt: string;
  endsAt: string;
}

export interface Invitation {
  id: string;
  orgId: string;
  email: string;
  roleIds: string[];
  expiresAt: string;
}

export interface OrganizationRepository {
  findOrganization(id: string): Promise<Organization | null>;
  listMemberships(orgId: string): Promise<OrgMembership[]>;
  listStoreMemberships(siteId: string): Promise<StoreMembership[]>;
}
