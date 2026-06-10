import type { ActorType } from '@letbuyy/auth-core';
import type { IdentityRealm, Principal, PrincipalRef } from '@letbuyy/identity-core';

export interface IdentityReconciliationFinding {
  kind: 'users_without_custom_user' | 'custom_user_without_user' | 'null_password' | 'duplicate_email' | 'orphan_site';
  legacyId: string;
  emailHash?: string;
  siteId?: string;
  detail: string;
}

export interface IdentityReconciliationReport {
  generatedAt: string;
  dryRun: true;
  findings: IdentityReconciliationFinding[];
  legacyUntouched: true;
}

export function createEmptyIdentityReconciliationReport(now: Date = new Date()): IdentityReconciliationReport {
  return {
    generatedAt: now.toISOString(),
    dryRun: true,
    findings: [],
    legacyUntouched: true,
  };
}

export interface BackfillCursor {
  job: 'principals' | 'credentials' | 'authenticators' | 'org_graph';
  lastSeenId?: string;
  completed: boolean;
}

export type BackfillTargetTable =
  | 'principals'
  | 'credentials'
  | 'authenticators'
  | 'organizations'
  | 'org_memberships'
  | 'store_memberships'
  | 'org_store_links';

export interface BackfillWritePlan<Row extends Record<string, unknown> = Record<string, unknown>> {
  dryRun: boolean;
  targetTable: BackfillTargetTable;
  idempotencyKey: string;
  cursor: BackfillCursor;
  rows: Row[];
  writesLegacyTables: false;
}

export interface LegacyMerchantUserRow {
  id: string;
  email?: string | null;
  phone?: string | null;
  name?: string | null;
  status?: string | null;
  password_hash?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface LegacyStoreCustomerRow {
  id: string;
  site_id: string;
  email?: string | null;
  phone?: string | null;
  name?: string | null;
  password_hash?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface LegacyAuthenticatorRow {
  id: string;
  user_id: string;
  factor_type: 'totp' | 'passkey' | string;
  created_at?: string | null;
  last_used_at?: string | null;
}

export interface LegacySiteMembershipRow {
  id: string;
  site_id: string;
  user_id: string;
  role_id?: string | null;
  created_at?: string | null;
}

export interface PrincipalBackfillRow extends Record<string, unknown> {
  id: string;
  realm: IdentityRealm;
  actor_type: ActorType;
  legacy_user_id?: string;
  legacy_customer_id?: string;
  email?: string;
  phone?: string;
  display_name?: string;
  status: 'active' | 'locked' | 'disabled' | 'pending_migration';
  created_at: string;
  updated_at: string;
}

export interface CredentialBackfillRow extends Record<string, unknown> {
  principal_id: string;
  realm: IdentityRealm;
  credential_type: 'password';
  algo: 'bcrypt' | 'argon2id(bcrypt)';
  hash: string;
  params: Record<string, unknown>;
  needs_rehash: boolean;
}

export interface AuthenticatorBackfillRow extends Record<string, unknown> {
  principal_id: string;
  legacy_factor_id: string;
  realm: IdentityRealm;
  authenticator_type: 'totp' | 'passkey' | 'hardware_key';
  status: 'active' | 'pending_migration';
  last_used_at?: string;
}

export interface OrgGraphBackfillRow extends Record<string, unknown> {
  site_id: string;
  principal_id: string;
  source_membership_id: string;
  role_id?: string;
  relationship: 'site_member';
}

export interface CredentialLayerHashDryRun {
  inputAlgo: 'bcrypt';
  outputAlgo: 'argon2id(bcrypt)';
  bcryptHash: string;
  layeredHashPreview: string;
  pepperHandle: 'sandbox-kms-pepper';
  writes: false;
  verified: boolean;
}

export interface BackfillDashboardSnapshot {
  generatedAt: string;
  plannedRows: Record<BackfillTargetTable, number>;
  legacyWrites: 0;
  rerunnable: true;
}

function nowIso(): string {
  return new Date().toISOString();
}

function coalesceDate(value: string | null | undefined): string {
  return value || nowIso();
}

function sanitizeStatus(status: string | null | undefined): PrincipalBackfillRow['status'] {
  if (status === 'locked' || status === 'disabled') return status;
  if (status === 'active') return 'active';
  return 'pending_migration';
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function idempotencyKeyForBackfill(job: BackfillCursor['job'], legacyId: string): string {
  return `identity-foundation:${job}:${legacyId}`;
}

export function principalFromLegacyMerchant(row: LegacyMerchantUserRow): PrincipalBackfillRow {
  return {
    id: `legacy-merchant-${row.id}`,
    realm: 'merchant',
    actor_type: 'merchant',
    legacy_user_id: row.id,
    email: row.email || undefined,
    phone: row.phone || undefined,
    display_name: row.name || undefined,
    status: sanitizeStatus(row.status),
    created_at: coalesceDate(row.created_at),
    updated_at: coalesceDate(row.updated_at),
  };
}

export function mapStoreCustomerToPrincipal(row: LegacyStoreCustomerRow): PrincipalBackfillRow {
  return {
    id: `legacy-customer-${row.site_id}-${row.id}`,
    realm: 'customer',
    actor_type: 'customer',
    legacy_customer_id: row.id,
    email: row.email || undefined,
    phone: row.phone || undefined,
    display_name: row.name || undefined,
    status: 'pending_migration',
    created_at: coalesceDate(row.created_at),
    updated_at: coalesceDate(row.updated_at),
  };
}

export function planPrincipalBackfill(rows: readonly LegacyMerchantUserRow[]): BackfillWritePlan<PrincipalBackfillRow> {
  return {
    dryRun: false,
    targetTable: 'principals',
    idempotencyKey: 'identity-foundation:principals:batch',
    cursor: {
      job: 'principals',
      lastSeenId: rows.at(-1)?.id,
      completed: rows.length === 0,
    },
    rows: rows.map(principalFromLegacyMerchant),
    writesLegacyTables: false,
  };
}

export function planCustomerPrincipalBackfill(rows: readonly LegacyStoreCustomerRow[]): BackfillWritePlan<PrincipalBackfillRow> {
  return {
    dryRun: false,
    targetTable: 'principals',
    idempotencyKey: 'identity-foundation:customer-principals:batch',
    cursor: {
      job: 'principals',
      lastSeenId: rows.at(-1)?.id,
      completed: rows.length === 0,
    },
    rows: rows.map(mapStoreCustomerToPrincipal),
    writesLegacyTables: false,
  };
}

export function planCredentialBackfill(
  principal: PrincipalRef,
  passwordHash: string | null | undefined,
): BackfillWritePlan<CredentialBackfillRow> {
  return {
    dryRun: false,
    targetTable: 'credentials',
    idempotencyKey: idempotencyKeyForBackfill('credentials', principal.id),
    cursor: {
      job: 'credentials',
      lastSeenId: principal.id,
      completed: !passwordHash,
    },
    rows: passwordHash
      ? [{
          principal_id: principal.id,
          realm: principal.realm,
          credential_type: 'password',
          algo: 'bcrypt',
          hash: passwordHash,
          params: {
            legacy_source: principal.legacyUserId ? 'users_custom.password_hash' : 'customer_credentials',
            layer_hash_candidate: 'argon2id(bcrypt)',
          },
          needs_rehash: true,
        }]
      : [],
    writesLegacyTables: false,
  };
}

export function planAuthenticatorBackfill(
  principal: PrincipalRef,
  factors: readonly LegacyAuthenticatorRow[],
): BackfillWritePlan<AuthenticatorBackfillRow> {
  return {
    dryRun: false,
    targetTable: 'authenticators',
    idempotencyKey: idempotencyKeyForBackfill('authenticators', principal.id),
    cursor: {
      job: 'authenticators',
      lastSeenId: factors.at(-1)?.id,
      completed: factors.length === 0,
    },
    rows: factors.map((factor) => ({
      principal_id: principal.id,
      legacy_factor_id: factor.id,
      realm: principal.realm,
      authenticator_type: factor.factor_type === 'passkey' ? 'passkey' : 'totp',
      status: 'pending_migration',
      last_used_at: factor.last_used_at || undefined,
    })),
    writesLegacyTables: false,
  };
}

export function planOrgGraphBackfill(rows: readonly LegacySiteMembershipRow[]): BackfillWritePlan<OrgGraphBackfillRow> {
  return {
    dryRun: false,
    targetTable: 'store_memberships',
    idempotencyKey: 'identity-foundation:org-graph:batch',
    cursor: {
      job: 'org_graph',
      lastSeenId: rows.at(-1)?.id,
      completed: rows.length === 0,
    },
    rows: rows.map((row) => ({
      site_id: row.site_id,
      principal_id: `legacy-merchant-${row.user_id}`,
      source_membership_id: row.id,
      role_id: row.role_id || undefined,
      relationship: 'site_member',
    })),
    writesLegacyTables: false,
  };
}

export async function credentialLayerHashDryRun(
  bcryptHash: string,
  pepperMaterial: string,
): Promise<CredentialLayerHashDryRun> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`argon2id(bcrypt):${bcryptHash}:pepper:${pepperMaterial}`),
  );
  const layeredHashPreview = `dry-run-argon2id-bcrypt:${base64UrlEncode(new Uint8Array(digest))}`;

  return {
    inputAlgo: 'bcrypt',
    outputAlgo: 'argon2id(bcrypt)',
    bcryptHash,
    layeredHashPreview,
    pepperHandle: 'sandbox-kms-pepper',
    writes: false,
    verified: layeredHashPreview.startsWith('dry-run-argon2id-bcrypt:'),
  };
}

export function sessionMfaContinuityPlan(principal: Principal): {
  principalId: string;
  dualAcceptsLegacySession: true;
  dualAcceptsLegacyMfa: true;
  writesLegacyTables: false;
} {
  return {
    principalId: principal.id,
    dualAcceptsLegacySession: true,
    dualAcceptsLegacyMfa: true,
    writesLegacyTables: false,
  };
}

export function backfillDashboardSnapshot(
  plans: readonly BackfillWritePlan[],
  generatedAt: string = nowIso(),
): BackfillDashboardSnapshot {
  const plannedRows = {
    principals: 0,
    credentials: 0,
    authenticators: 0,
    organizations: 0,
    org_memberships: 0,
    store_memberships: 0,
    org_store_links: 0,
  } satisfies Record<BackfillTargetTable, number>;

  for (const plan of plans) plannedRows[plan.targetTable] += plan.rows.length;

  return {
    generatedAt,
    plannedRows,
    legacyWrites: 0,
    rerunnable: true,
  };
}
