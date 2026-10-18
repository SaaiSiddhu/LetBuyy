// Phase 2 / D03 approved local slice (Mandate 7, Section 10) -- a REAL PrincipalRepository backed
// by the actual `principals` and `account_links` tables (both already exist, both currently zero
// rows in every environment inspected). This does NOT replace createDormantPrincipalRepository in
// repository-implementations.ts -- that factory's `overrides` parameter already exists specifically
// to accept a real implementation like this one, so nothing there needs to change. Nothing in the
// gateway wires this in as the active authorization path; it exists to be called by the shadow
// evaluator (shadow-comparison.ts) and by a future, separately-approved cutover, never by
// staff-permission.ts directly in this pass.
//
// Reuses `identity-reconciliation-dry-run.ts`'s established table-column shapes rather than
// inventing new ones, and the identical `getSupabaseAdmin`-shaped client every other gateway route
// already uses -- no new database access pattern is introduced.

import type { AccountLink, Principal, PrincipalRef, PrincipalRepository } from '@letbuyy/identity-core';

/** The minimal query surface this file needs -- matches getSupabaseAdmin's own return shape closely
 *  enough to accept it directly, and small enough that a test can hand it a fake without importing
 *  the whole gateway. */
export interface PrincipalRepositoryDb {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: string): PrincipalRepositoryDb.Filterable;
      is(column: string, value: null): PrincipalRepositoryDb.Filterable;
    };
    insert(row: Record<string, unknown>): {
      select(): { single(): Promise<{ data: Record<string, unknown> | null; error: unknown }> };
    };
  };
}
// eslint-disable-next-line @typescript-eslint/no-namespace
declare namespace PrincipalRepositoryDb {
  export interface Filterable {
    eq(column: string, value: string): Filterable;
    is(column: string, value: null): Filterable;
    maybeSingle(): Promise<{ data: Record<string, unknown> | null; error: unknown }>;
  }
}

interface PrincipalRow {
  id: string;
  realm: string;
  actor_type: string;
  legacy_user_id: string | null;
  legacy_customer_id: string | null;
  legacy_employee_id: string | null;
  email: string | null;
  phone: string | null;
  display_name: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

function mapPrincipalRow(row: PrincipalRow): Principal {
  return {
    id: row.id,
    realm: row.realm as PrincipalRef['realm'],
    actorType: row.actor_type as PrincipalRef['actorType'],
    legacyUserId: row.legacy_user_id ?? undefined,
    legacyCustomerId: row.legacy_customer_id ?? undefined,
    legacyEmployeeId: row.legacy_employee_id ?? undefined,
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    displayName: row.display_name ?? undefined,
    status: row.status as Principal['status'],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

const PRINCIPAL_COLUMNS = 'id, realm, actor_type, legacy_user_id, legacy_customer_id, legacy_employee_id, email, phone, display_name, status, created_at, updated_at, deleted_at';

export function createSupabasePrincipalRepository(db: PrincipalRepositoryDb): PrincipalRepository {
  return {
    async findById(id) {
      const { data, error } = await db
        .from('principals')
        .select(PRINCIPAL_COLUMNS)
        .eq('id', id)
        .is('deleted_at', null)
        .maybeSingle();
      if (error || !data) return null;
      return mapPrincipalRow(data as unknown as PrincipalRow);
    },

    async findByLegacyRef(ref) {
      // Fail closed: a ref naming NONE of the three legacy id fields must never resolve to "match
      // everything for this realm" -- that would turn an omitted field into an accidental wildcard
      // lookup rather than a miss.
      let query = db.from('principals').select(PRINCIPAL_COLUMNS).eq('realm', ref.realm).is('deleted_at', null);
      if (ref.legacyEmployeeId) query = query.eq('legacy_employee_id', ref.legacyEmployeeId);
      else if (ref.legacyUserId) query = query.eq('legacy_user_id', ref.legacyUserId);
      else if (ref.legacyCustomerId) query = query.eq('legacy_customer_id', ref.legacyCustomerId);
      else return null;

      const { data, error } = await query.maybeSingle();
      if (error || !data) return null;
      return mapPrincipalRow(data as unknown as PrincipalRow);
    },

    async linkAccount(link: AccountLink): Promise<AccountLink> {
      const { data, error } = await db
        .from('account_links')
        .insert({
          id: link.id,
          principal_id: link.principalId,
          realm: link.realm,
          provider: link.provider,
          provider_subject: link.providerSubject,
        })
        .select()
        .single();

      if (error || !data) {
        throw new Error(`linkAccount failed: ${error ? JSON.stringify(error) : 'no row returned'}`);
      }

      return {
        id: String(data.id),
        principalId: String(data.principal_id),
        realm: data.realm as AccountLink['realm'],
        provider: data.provider as AccountLink['provider'],
        providerSubject: String(data.provider_subject),
        linkedAt: String(data.linked_at),
      };
    },
  };
}
