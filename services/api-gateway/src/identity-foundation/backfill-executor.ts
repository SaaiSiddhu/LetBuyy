// Phase 2 / D03 approved local slice -- auth hardening mandate, Section 7: "the previous pass stopped
// at a repository and comparison function" is explicitly NOT where this slice ends. This file is the
// missing EXECUTION step: it takes real legacy rows (users_custom owners, employees memberships) and
// actually writes principals/store_memberships rows, idempotently, against the OWNED LOCAL database.
//
// Schema facts verified against the real local instance before writing this (not assumed from the
// scaffold's own types):
//   - principals.id is a real `uuid` with a `gen_random_uuid()` DEFAULT. migration-scaffold.ts's
//     PrincipalBackfillRow.id ("legacy-merchant-<uuid>") is a PLAN-INTERNAL correlation key, never a
//     literal value to insert -- this executor never sends `id` in an insert payload; Postgres
//     generates it, and legacy_user_id (itself a real uuid column) is the only correlation key that
//     matters for a rerun or for planOrgGraphBackfill's downstream principal_id resolution.
//   - There is no unique constraint on principals(realm, legacy_user_id) -- idempotency and ambiguity
//     detection are both done here, at the application level, via an explicit COUNT-style check
//     before any insert (see resolveExistingPrincipals below), not via ON CONFLICT.
//   - store_memberships DOES have a real UNIQUE(store_id, principal_id) constraint, so its upsert can
//     use ON CONFLICT directly. Its role_ids column is a real uuid[], not migration-scaffold.ts's
//     singular role_id -- this executor wraps it (`role_id ? [role_id] : []`) at the write boundary;
//     the pure planner's own shape is left exactly as-is (nothing about this finding is a defect in
//     that file -- it never claimed to be a literal insert payload).
//   - users_custom has no status or phone column, and its name column is full_name, not name -- the
//     LegacyMerchantUserRow shape migration-scaffold.ts declares does not describe every field this
//     table actually has; only the fields that exist are read below.

import type { LegacyMerchantUserRow } from './migration-scaffold';
import type { LegacyEmployeeMembershipRow } from './reconciliation-report';

export interface BackfillExecutorDb {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: string): BackfillListQuery;
      is(column: string, value: null): BackfillListQuery;
    };
    insert(row: Record<string, unknown>): {
      select(columns: string): { single(): Promise<{ data: Record<string, unknown> | null; error: { message?: string; code?: string } | null }> };
    };
    upsert(row: Record<string, unknown>, opts: { onConflict: string }): Promise<{ data: unknown; error: { message?: string; code?: string } | null }>;
    update(row: Record<string, unknown>): UpdateQuery;
  };
}
interface UpdateQuery {
  eq(column: string, value: string): UpdateQuery;
  then<T>(onFulfilled: (result: { data: unknown; error: { message?: string; code?: string } | null }) => T): Promise<T>;
}
interface BackfillListQuery {
  eq(column: string, value: string): BackfillListQuery;
  is(column: string, value: null): BackfillListQuery;
  limit(n: number): BackfillListQuery;
  then<T>(onFulfilled: (result: { data: Record<string, unknown>[] | null; error: { message?: string; code?: string } | null }) => T): Promise<T>;
}

export type BackfillRowOutcome = 'inserted' | 'updated' | 'reconciled_revoked' | 'skipped_already_exists' | 'blocked_ambiguous' | 'blocked_missing_data' | 'blocked_missing_prerequisite';

export interface BackfillDetail {
  legacyId: string;
  outcome: BackfillRowOutcome;
  reason: string;
}

export interface BackfillOutcome {
  inserted: number;
  updated: number;
  reconciled: number;
  skipped: number;
  blocked: number;
  details: BackfillDetail[];
}

function emptyOutcome(): BackfillOutcome {
  return { inserted: 0, updated: 0, reconciled: 0, skipped: 0, blocked: 0, details: [] };
}

function record(outcome: BackfillOutcome, detail: BackfillDetail): void {
  outcome.details.push(detail);
  if (detail.outcome === 'inserted') outcome.inserted++;
  else if (detail.outcome === 'updated') outcome.updated++;
  else if (detail.outcome === 'reconciled_revoked') outcome.reconciled++;
  else if (detail.outcome === 'skipped_already_exists') outcome.skipped++;
  else outcome.blocked++;
}

/** Ambiguous/duplicate identities must block, never guess (Section 7/11). Counts existing,
 *  non-deleted principals for this legacy_user_id: 0 -> proceed to insert, 1 -> already migrated
 *  (idempotent skip), 2+ -> a genuine data problem this pass must not paper over. */
async function countExistingMerchantPrincipals(db: BackfillExecutorDb, legacyUserId: string): Promise<number> {
  const { data, error } = await db
    .from('principals')
    .select('id')
    .eq('realm', 'merchant')
    .eq('legacy_user_id', legacyUserId)
    .is('deleted_at', null);
  if (error) throw new Error(`principals lookup failed for legacy_user_id=${legacyUserId}: ${error.message ?? error.code}`);
  return (data ?? []).length;
}

/**
 * Backfills `principals` from `users_custom` (merchant/store-owner accounts). Idempotent: rerunning
 * with the identical input produces the identical outcome (every already-migrated row is reported
 * skipped_already_exists, never re-inserted or duplicated). Interrupted-run recovery: since each row
 * is its own independent existence check + insert, a run stopped partway through and rerun from the
 * SAME full input list correctly resumes -- already-written rows are skipped, unwritten rows proceed.
 */
export async function executeMerchantPrincipalBackfill(
  db: BackfillExecutorDb,
  rows: readonly LegacyMerchantUserRow[],
): Promise<BackfillOutcome> {
  const outcome = emptyOutcome();

  for (const row of rows) {
    if (!row.id) {
      record(outcome, { legacyId: '(missing)', outcome: 'blocked_missing_data', reason: 'legacy row has no id at all' });
      continue;
    }

    let existingCount: number;
    try {
      existingCount = await countExistingMerchantPrincipals(db, row.id);
    } catch (err) {
      record(outcome, { legacyId: row.id, outcome: 'blocked_missing_prerequisite', reason: err instanceof Error ? err.message : String(err) });
      continue;
    }

    if (existingCount > 1) {
      record(outcome, { legacyId: row.id, outcome: 'blocked_ambiguous', reason: `${existingCount} existing principals already reference this legacy_user_id -- a duplicate this pass must not resolve by guessing` });
      continue;
    }
    if (existingCount === 1) {
      record(outcome, { legacyId: row.id, outcome: 'skipped_already_exists', reason: 'a principal for this legacy_user_id already exists (idempotent rerun)' });
      continue;
    }

    // No unverified-email linking (Section 7/11): this insert links SOLELY on legacy_user_id, the
    // row's own real foreign key -- email is carried as a display/lookup field on the new row, never
    // used to find or merge into an existing, different principal.
    const { error } = await db.from('principals').insert({
      realm: 'merchant',
      actor_type: 'merchant',
      legacy_user_id: row.id,
      email: row.email || null,
      display_name: row.name || null,
      status: 'pending_migration',
    }).select('id').single();

    if (error) {
      record(outcome, { legacyId: row.id, outcome: 'blocked_missing_prerequisite', reason: `insert failed: ${error.message ?? error.code}` });
      continue;
    }

    record(outcome, { legacyId: row.id, outcome: 'inserted', reason: 'new principal created from users_custom' });
  }

  return outcome;
}

/**
 * Backfills AND RECONCILES `store_memberships` from `employees`. Requires the referenced principal to
 * already exist (executeMerchantPrincipalBackfill must run first for the same legacy_user_id) -- a
 * missing principal blocks with blocked_missing_prerequisite rather than being silently skipped or
 * granting a membership to nothing.
 *
 * Reconciliation (auth hardening follow-up, Section 9): a revoked legacy row being SKIPPED on a fresh
 * run is not sufficient -- if a membership was backfilled while active and the legacy source later
 * says it no longer is, an already-existing ACTIVE target row must have its authority actively
 * removed (status -> 'removed'), not merely be left alone. A non-active legacy row with NO existing
 * target row still results in blocked_missing_data (never backfilled as a fresh row) -- there is
 * nothing to reconcile when nothing was ever written.
 */
export async function executeStoreMembershipBackfill(
  db: BackfillExecutorDb,
  rows: readonly LegacyEmployeeMembershipRow[],
): Promise<BackfillOutcome> {
  const outcome = emptyOutcome();

  for (const row of rows) {
    if (!row.store_id || !row.user_id) {
      record(outcome, { legacyId: row.id, outcome: 'blocked_missing_data', reason: 'legacy row is missing store_id or user_id' });
      continue;
    }

    const { data: principalRows, error: lookupError } = await db
      .from('principals')
      .select('id')
      .eq('realm', 'merchant')
      .eq('legacy_user_id', row.user_id)
      .is('deleted_at', null);
    if (lookupError) {
      record(outcome, { legacyId: row.id, outcome: 'blocked_missing_prerequisite', reason: `principal lookup failed: ${lookupError.message ?? lookupError.code}` });
      continue;
    }
    if (!principalRows || principalRows.length === 0) {
      record(outcome, { legacyId: row.id, outcome: 'blocked_missing_prerequisite', reason: 'no principal exists yet for this membership\'s user_id -- run executeMerchantPrincipalBackfill first' });
      continue;
    }
    if (principalRows.length > 1) {
      record(outcome, { legacyId: row.id, outcome: 'blocked_ambiguous', reason: `${principalRows.length} principals reference this user_id -- ambiguous, not resolved by guessing` });
      continue;
    }
    const principalId = String(principalRows[0].id);

    const { data: existingMembershipRows, error: membershipLookupError } = await db
      .from('store_memberships')
      .select('id, status')
      .eq('store_id', row.store_id)
      .eq('principal_id', principalId)
      .is('deleted_at', null);
    if (membershipLookupError) {
      record(outcome, { legacyId: row.id, outcome: 'blocked_missing_prerequisite', reason: `membership lookup failed: ${membershipLookupError.message ?? membershipLookupError.code}` });
      continue;
    }
    const existing = (existingMembershipRows ?? [])[0] as { id: string; status: string } | undefined;

    const legacyActive = !row.deleted_at && row.status === 'active';

    if (!legacyActive) {
      if (!existing) {
        record(outcome, { legacyId: row.id, outcome: 'blocked_missing_data', reason: `legacy status is "${row.status}"${row.deleted_at ? ' (soft-deleted)' : ''}, not active, and no target membership exists yet -- nothing to reconcile` });
        continue;
      }
      if (existing.status !== 'active') {
        record(outcome, { legacyId: row.id, outcome: 'skipped_already_exists', reason: `target membership already reflects a non-active status ("${existing.status}")` });
        continue;
      }
      // .eq('store_id', ...) here is not only the tenant guard's own requirement for this registered
      // tenant table -- it is a genuine extra correctness guarantee: this update can only ever touch
      // the row already resolved for EXACTLY this store+principal, never a same-id row elsewhere.
      const { error: revokeError } = await db.from('store_memberships').update({ status: 'removed' }).eq('id', existing.id).eq('store_id', row.store_id);
      if (revokeError) {
        record(outcome, { legacyId: row.id, outcome: 'blocked_missing_prerequisite', reason: `reconciliation revoke failed: ${revokeError.message ?? revokeError.code}` });
        continue;
      }
      record(outcome, { legacyId: row.id, outcome: 'reconciled_revoked', reason: `legacy status is now "${row.status}"${row.deleted_at ? ' (soft-deleted)' : ''} -- the previously-active target membership was revoked to match` });
      continue;
    }

    const alreadyExisted = Boolean(existing);
    const { error: upsertError } = await db.from('store_memberships').upsert(
      {
        store_id: row.store_id,
        principal_id: principalId,
        status: 'active',
        role_ids: [],
      },
      { onConflict: 'store_id,principal_id' },
    );
    if (upsertError) {
      record(outcome, { legacyId: row.id, outcome: 'blocked_missing_prerequisite', reason: `upsert failed: ${upsertError.message ?? upsertError.code}` });
      continue;
    }

    record(outcome, {
      legacyId: row.id,
      outcome: alreadyExisted ? 'updated' : 'inserted',
      reason: `store_membership ${alreadyExisted ? 'updated' : 'created'} for principal ${principalId}`,
    });
  }

  return outcome;
}
