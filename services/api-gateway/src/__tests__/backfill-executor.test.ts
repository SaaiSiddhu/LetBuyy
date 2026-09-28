// Phase 2 / D03 backfill execution (auth hardening mandate, Section 7). Exercises
// executeMerchantPrincipalBackfill and executeStoreMembershipBackfill against a fake PostgREST that
// models real constraints this pass verified against the actual local schema: principals has NO
// unique constraint on (realm, legacy_user_id) -- ambiguity is an application-level check, not a DB
// conflict -- while store_memberships DOES have UNIQUE(store_id, principal_id), modeled here so the
// upsert-vs-lookup distinction (inserted vs updated) is real, not asserted.
//
// A companion real-Postgres run (seeded and cleaned up, not kept as a permanent test -- the
// established pattern in this session for live-DB proofs) is recorded in this pass's commit message.

import assert from 'node:assert/strict';
import test from 'node:test';
import type { BackfillExecutorDb } from '../identity-foundation/backfill-executor';
import { executeMerchantPrincipalBackfill, executeStoreMembershipBackfill } from '../identity-foundation/backfill-executor';
import type { LegacyMerchantUserRow } from '../identity-foundation/migration-scaffold';
import type { LegacyEmployeeMembershipRow } from '../identity-foundation/reconciliation-report';

type Row = Record<string, unknown>;

function fakeDb(tables: Record<string, Row[]>): BackfillExecutorDb {
  function applyFilters(rows: Row[]) {
    let filtered = rows;
    const chain = {
      eq(column: string, value: string) {
        filtered = filtered.filter((r) => String(r[column]) === value);
        return chain;
      },
      is(column: string, value: null) {
        filtered = filtered.filter((r) => r[column] === value);
        return chain;
      },
      then<T>(onFulfilled: (result: { data: Row[] | null; error: null }) => T): Promise<T> {
        return Promise.resolve(onFulfilled({ data: filtered, error: null }));
      },
    };
    return chain;
  }

  return {
    from(table: string) {
      const rows = tables[table] ?? (tables[table] = []);
      return {
        select() {
          return applyFilters(rows) as never;
        },
        insert(row: Row) {
          return {
            select: () => ({
              async single() {
                // Real Postgres defaults an omitted nullable column (deleted_at) to NULL; this fake
                // must match that so a later .is('deleted_at', null) lookup behaves identically.
                const stored = { id: `generated-${table}-${rows.length + 1}`, deleted_at: null, ...row };
                rows.push(stored);
                return { data: stored, error: null };
              },
            }),
          };
        },
        async upsert(row: Row, opts: { onConflict: string }) {
          const keys = opts.onConflict.split(',');
          const existing = rows.find((r) => keys.every((k) => r[k] === row[k]));
          if (existing) Object.assign(existing, row);
          else rows.push({ id: `generated-${table}-${rows.length + 1}`, deleted_at: null, ...row });
          return { data: null, error: null };
        },
        update(patch: Row) {
          let targetId: string | undefined;
          const chain = {
            eq(column: string, value: string) {
              if (column === 'id') targetId = value;
              return chain;
            },
            then<T>(onFulfilled: (result: { data: unknown; error: null }) => T): Promise<T> {
              const row2 = rows.find((r) => r.id === targetId);
              if (row2) Object.assign(row2, patch);
              return Promise.resolve(onFulfilled({ data: null, error: null }));
            },
          };
          return chain as never;
        },
      };
    },
  };
}

function merchant(id: string, email: string, name?: string): LegacyMerchantUserRow {
  return { id, email, name, created_at: '2026-01-01T00:00:00Z' };
}
function membership(id: string, storeId: string, userId: string, status = 'active'): LegacyEmployeeMembershipRow {
  return { id, store_id: storeId, user_id: userId, email: `${id}@example.test`, role: 'manager', status, deleted_at: null };
}

test('a fresh, real merchant account backfills as a new principal', async () => {
  const db = fakeDb({});
  const result = await executeMerchantPrincipalBackfill(db, [merchant('owner-1', 'owner@example.test', 'Owner One')]);
  assert.equal(result.inserted, 1);
  assert.equal(result.blocked, 0);
  assert.equal(result.details[0].outcome, 'inserted');
});

test('idempotent rerun: the identical input a second time skips, never duplicates', async () => {
  const db = fakeDb({});
  const rows = [merchant('owner-1', 'owner@example.test')];
  const first = await executeMerchantPrincipalBackfill(db, rows);
  const second = await executeMerchantPrincipalBackfill(db, rows);
  assert.equal(first.inserted, 1);
  assert.equal(second.inserted, 0);
  assert.equal(second.skipped, 1);
});

test('duplicate/ambiguous identity: two existing principals for one legacy_user_id block, never guessed', async () => {
  const db = fakeDb({
    principals: [
      { id: 'p1', realm: 'merchant', legacy_user_id: 'owner-dup', deleted_at: null },
      { id: 'p2', realm: 'merchant', legacy_user_id: 'owner-dup', deleted_at: null },
    ],
  });
  const result = await executeMerchantPrincipalBackfill(db, [merchant('owner-dup', 'dup@example.test')]);
  assert.equal(result.blocked, 1);
  assert.equal(result.details[0].outcome, 'blocked_ambiguous');
});

test('missing legacy id blocks rather than inserting an unlinkable principal', async () => {
  const db = fakeDb({});
  const result = await executeMerchantPrincipalBackfill(db, [{ id: '', email: 'no-id@example.test' } as LegacyMerchantUserRow]);
  assert.equal(result.blocked, 1);
  assert.equal(result.details[0].outcome, 'blocked_missing_data');
});

test('restricted staff: an active employees row backfills to a real store_membership once its principal exists', async () => {
  const db = fakeDb({});
  await executeMerchantPrincipalBackfill(db, [merchant('staff-1', 'staff@example.test')]);
  const result = await executeStoreMembershipBackfill(db, [membership('m1', 'store-1', 'staff-1')]);
  assert.equal(result.inserted, 1);
  assert.equal(result.details[0].outcome, 'inserted');
});

test('missing account: a membership referencing a user_id with no backfilled principal yet blocks', async () => {
  const db = fakeDb({});
  const result = await executeStoreMembershipBackfill(db, [membership('m1', 'store-1', 'never-backfilled-user')]);
  assert.equal(result.blocked, 1);
  assert.equal(result.details[0].outcome, 'blocked_missing_prerequisite');
});

test('revoked staff: a non-active legacy membership is blocked, never backfilled as an active membership', async () => {
  const db = fakeDb({});
  await executeMerchantPrincipalBackfill(db, [merchant('staff-revoked', 'revoked@example.test')]);
  const result = await executeStoreMembershipBackfill(db, [membership('m1', 'store-1', 'staff-revoked', 'removed')]);
  assert.equal(result.blocked, 1);
  assert.equal(result.inserted, 0);
  assert.match(result.details[0].reason, /not active/);
});

test('multiple memberships: one principal can hold real memberships at two different stores', async () => {
  const db = fakeDb({});
  await executeMerchantPrincipalBackfill(db, [merchant('multi-staff', 'multi@example.test')]);
  const result = await executeStoreMembershipBackfill(db, [
    membership('m1', 'store-1', 'multi-staff'),
    membership('m2', 'store-2', 'multi-staff'),
  ]);
  assert.equal(result.inserted, 2);
});

test('conflicting mapping: two principals resolving to the same user_id block the membership, never pick one arbitrarily', async () => {
  const db = fakeDb({
    principals: [
      { id: 'p1', realm: 'merchant', legacy_user_id: 'ambiguous-user', deleted_at: null },
      { id: 'p2', realm: 'merchant', legacy_user_id: 'ambiguous-user', deleted_at: null },
    ],
  });
  const result = await executeStoreMembershipBackfill(db, [membership('m1', 'store-1', 'ambiguous-user')]);
  assert.equal(result.blocked, 1);
  assert.equal(result.details[0].outcome, 'blocked_ambiguous');
});

test('rerun after partial failure: a run stopped after row 1 resumes correctly from the full input on rerun', async () => {
  const db = fakeDb({});
  const rows = [merchant('a', 'a@example.test'), merchant('b', 'b@example.test'), merchant('c', 'c@example.test')];

  // Simulate "partial failure": only the first row was actually processed in an earlier, interrupted
  // run.
  const partial = await executeMerchantPrincipalBackfill(db, [rows[0]]);
  assert.equal(partial.inserted, 1);

  // Rerun from the FULL original input list, as an operator would after an interruption.
  const resumed = await executeMerchantPrincipalBackfill(db, rows);
  assert.equal(resumed.skipped, 1, 'row "a" must be recognized as already done, not re-inserted');
  assert.equal(resumed.inserted, 2, 'rows "b" and "c" must be inserted for the first time');
});

test('re-running the membership backfill on an already-migrated row reports updated, not a second insert', async () => {
  const db = fakeDb({});
  await executeMerchantPrincipalBackfill(db, [merchant('staff-1', 'staff@example.test')]);
  const first = await executeStoreMembershipBackfill(db, [membership('m1', 'store-1', 'staff-1')]);
  const second = await executeStoreMembershipBackfill(db, [membership('m1', 'store-1', 'staff-1')]);
  assert.equal(first.details[0].outcome, 'inserted');
  assert.equal(first.inserted, 1);
  assert.equal(second.details[0].outcome, 'updated');
  assert.equal(second.updated, 1, 'a re-upsert of the identical membership is counted as updated, distinct from inserted');
  assert.equal(second.inserted, 0, 'must not double-count an update as a fresh insert');
});

// ============================================================================
// Reconciliation (auth hardening follow-up, Section 9): "a revoked legacy row being skipped on a
// fresh run is not sufficient" -- a previously-backfilled ACTIVE target membership must actively lose
// authority when the legacy source is later revoked, not merely be left untouched.
// ============================================================================

test('RECONCILIATION: an active membership, later revoked at the source, loses active authority in the target on the next run', async () => {
  const db = fakeDb({});
  await executeMerchantPrincipalBackfill(db, [merchant('staff-1', 'staff@example.test')]);

  // 1. Active legacy membership is backfilled.
  const initial = await executeStoreMembershipBackfill(db, [membership('m1', 'store-1', 'staff-1', 'active')]);
  assert.equal(initial.details[0].outcome, 'inserted');

  // 2-3. That membership is later revoked at the source; reconciliation runs again with the updated
  // legacy row.
  const reconciled = await executeStoreMembershipBackfill(db, [membership('m1', 'store-1', 'staff-1', 'removed')]);

  // 4. The existing target membership must lose active authority.
  assert.equal(reconciled.details[0].outcome, 'reconciled_revoked');
  assert.equal(reconciled.reconciled, 1);
  assert.equal(reconciled.blocked, 0, 'this is an active reconciliation action, not a block');
});

test('RECONCILIATION: re-running reconciliation on an already-revoked target membership is idempotent (skipped, not re-revoked)', async () => {
  const db = fakeDb({});
  await executeMerchantPrincipalBackfill(db, [merchant('staff-1', 'staff@example.test')]);
  await executeStoreMembershipBackfill(db, [membership('m1', 'store-1', 'staff-1', 'active')]);
  const first = await executeStoreMembershipBackfill(db, [membership('m1', 'store-1', 'staff-1', 'removed')]);
  const second = await executeStoreMembershipBackfill(db, [membership('m1', 'store-1', 'staff-1', 'removed')]);
  assert.equal(first.details[0].outcome, 'reconciled_revoked');
  assert.equal(second.details[0].outcome, 'skipped_already_exists', 'reconciling an already-revoked membership a second time must not error or re-report a revoke');
});

test('RECONCILIATION: a soft-deleted legacy membership also reconciles an existing active target membership', async () => {
  const db = fakeDb({});
  await executeMerchantPrincipalBackfill(db, [merchant('staff-1', 'staff@example.test')]);
  await executeStoreMembershipBackfill(db, [membership('m1', 'store-1', 'staff-1', 'active')]);
  const deletedRow: LegacyEmployeeMembershipRow = { ...membership('m1', 'store-1', 'staff-1', 'active'), deleted_at: '2026-09-28T00:00:00Z' };
  const result = await executeStoreMembershipBackfill(db, [deletedRow]);
  assert.equal(result.details[0].outcome, 'reconciled_revoked');
});

test('RECONCILIATION: a non-active legacy row with no prior target membership blocks -- there is nothing to reconcile when nothing was ever written', async () => {
  const db = fakeDb({});
  await executeMerchantPrincipalBackfill(db, [merchant('staff-1', 'staff@example.test')]);
  const result = await executeStoreMembershipBackfill(db, [membership('m1', 'store-1', 'staff-1', 'removed')]);
  assert.equal(result.details[0].outcome, 'blocked_missing_data');
  assert.equal(result.reconciled, 0);
});

test('RECONCILIATION: re-approving a revoked staff member (legacy flips back to active) restores active authority in the target', async () => {
  const db = fakeDb({});
  await executeMerchantPrincipalBackfill(db, [merchant('staff-1', 'staff@example.test')]);
  await executeStoreMembershipBackfill(db, [membership('m1', 'store-1', 'staff-1', 'active')]);
  await executeStoreMembershipBackfill(db, [membership('m1', 'store-1', 'staff-1', 'removed')]);
  const restored = await executeStoreMembershipBackfill(db, [membership('m1', 'store-1', 'staff-1', 'active')]);
  assert.equal(restored.details[0].outcome, 'updated', 're-approval upserts the membership back to active');
});
